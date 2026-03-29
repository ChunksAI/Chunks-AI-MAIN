// @ts-nocheck
/**
 * src/lib/syncManager.js — Phase 4: login merge + sync
 *
 * Silent background sync — no UI notifications shown to the user.
 *
 * Public API (all set on window.SyncManager):
 *   SyncManager.loginSync()          — called on SIGNED_IN / session restore
 *   SyncManager.flushBeforeSignOut() — called by chunksSignOut() before redirect
 *   SyncManager.nudge()              — lightweight re-sync after long idle
 *   SyncManager.status               — 'idle' | 'syncing' | 'error' | 'success'
 */

import { ChunksDB } from './chunksDb.js';
import { lsGet as _lsGet } from '../utils/storage.js';
import { idbKeys as _idbKeys } from './idbStorage.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RETRIES   = 3;
const BASE_DELAY_MS = 1200;

// ── State ─────────────────────────────────────────────────────────────────────

let _status        = 'idle';
let _inFlight      = false;
let _retryCount    = 0;
let _retryTimer    = null;
let _lastNudgeTime = 0;
let _syncManagerDone = false;

// ── Core sync with retry ──────────────────────────────────────────────────────

async function _runSync({ force = false } = {}) {
  if (_inFlight) return false;
  if (!ChunksDB.isLoggedIn()) return false;

  _inFlight = true;
  _status   = 'syncing';
  _syncManagerDone = false;

  try {
    await ChunksDB.pullAll({ force });

    _status     = 'success';
    _retryCount = 0;
    _inFlight   = false;
    _syncManagerDone = true;

    return true;

  } catch (e) {
    _inFlight = false;
    _status   = 'error';

    console.warn('[SyncManager] pullAll failed:', e?.message || e);

    if (_retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, _retryCount);
      _retryCount++;
      clearTimeout(_retryTimer);
      _retryTimer = setTimeout(() => _runSync({ force }), delay);
    } else {
      _retryCount = 0;
      console.error('[SyncManager] All retries exhausted. Will re-sync on next login or reconnect.');
    }

    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const SyncManager = {

  get status() { return _status; },

  /**
   * Full login merge — called on SIGNED_IN and session restore.
   * @param {{ force?: boolean }} [opts]
   */
  async loginSync({ force = false } = {}) {
    if (!ChunksDB.isLoggedIn()) return;

    if (!navigator.onLine) {
      console.log('[SyncManager] Offline at login — queued for reconnect');
      return;
    }

    await _runSync({ force });
    _applyPostSyncUI();
  },

  /**
   * Flush all pending local data to Supabase before sign-out.
   * Max 1.5s wait.
   */
  async flushBeforeSignOut() {
    if (!ChunksDB.isLoggedIn()) return;

    const timeout = new Promise(r => setTimeout(r, 1500));
    const flush   = Promise.allSettled([
      ChunksDB.settings.pushLocalToRemote?.(),
      ChunksDB.streak.pushLocalToRemote?.(),
      ChunksDB.ws.pushLocalToRemote?.(),
      _uploadPendingChatSessions(),
    ]);

    await Promise.race([flush, timeout]);
  },

  /**
   * Lightweight re-sync after long idle or network restore.
   */
  async nudge() {
    if (!ChunksDB.isLoggedIn()) return;
    const now = Date.now();
    if (_status === 'success' && (now - (_lastNudgeTime || 0)) < 60_000) return;
    _lastNudgeTime = now;
    if (_inFlight) return;
    await _runSync({ silent: true });
    _applyPostSyncUI();
  },
};

// ── Post-sync UI refresh ──────────────────────────────────────────────────────

function _applyPostSyncUI() {
  try {
    import('../state/flash/index.js').then(m => m._fcRenderStreak?.()).catch(() => {});

    const accent = localStorage.getItem('chunks_setting_accent');
    const color  = localStorage.getItem('chunks_setting_accent_color');
    if (accent && color) {
      import('../components/SettingsModal.js').then(m => m.applyAccentColor?.(color)).catch(() => {});
    }

    const appearance = localStorage.getItem('chunks_setting_appearance');
    if (appearance) {
      import('../components/SettingsModal.js').then(m => m.applyAppearance?.(appearance)).catch(() => {});
    }

    const fs = localStorage.getItem('chunks-chat-font-size');
    const fsMap = { small: '12px', medium: '15px', large: '17px', S: '12px', M: '15px', L: '17px' };
    if (fs && fsMap[fs]) {
      document.documentElement.style.setProperty('--chat-font-size', fsMap[fs]);
    }

    setTimeout(() => {
      window._homeMountLatestSession?.();
      window._renderAllRecent?.();
      import('../components/Sidebar.js').then(m => m._renderRecentPlansAllSidebars?.()).catch(() => {});
    }, 150);

  } catch (e) {
    console.warn('[SyncManager] post-sync UI refresh error:', e.message);
  }
}

// ── Upload locally-queued chat sessions ───────────────────────────────────────

async function _uploadPendingChatSessions() {
  try {
    const tombs = new Set(_lsGet('chunks_deleted_sessions', []));
    const keys = _idbKeys('chunks_session_');
    for (const k of keys) {
      const s = _lsGet(k);
      if (!s) continue;
      if (tombs.has(s.id) || (s.supabaseId && tombs.has(s.supabaseId))) continue;
      if (!s.supabaseId || /^r[0-9]+$/.test(s.supabaseId)) continue;
      const messages = s.history || s.messages || [];
      if (!messages.length) continue;
      await ChunksDB.chat.saveFull({
        id:        s.supabaseId,
        localId:   /^r[0-9]+$/.test(s.id) ? s.id : null,
        messages,
        bookId:    s.bookId || null,
        title:     s.title  || null,
        updatedAt: s.updatedAt || new Date().toISOString(),
      });
    }
  } catch (_) {}
}

// ── Online / offline listener ─────────────────────────────────────────────────

window.addEventListener('online', () => {
  console.log('[SyncManager] Network restored — running nudge sync');
  SyncManager.nudge();
});

// ── Idle / re-focus sync ──────────────────────────────────────────────────────

let _lastFocusSync = Date.now();
const IDLE_THRESHOLD_MS = 15 * 60 * 1000;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const elapsed = Date.now() - _lastFocusSync;
  if (elapsed >= IDLE_THRESHOLD_MS) {
    _lastFocusSync = Date.now();
    SyncManager.nudge();
  }
});

console.log('[SyncManager] Phase 4 sync manager ready ✦');

export { SyncManager, _syncManagerDone };
