/**
 * src/lib/syncManager.js — Phase 4: login merge + sync UI
 *
 * Wraps ChunksDB.pullAll() with:
 *   • A "Syncing…" pill indicator visible to the user
 *   • Retry logic (up to 3 attempts, exponential back-off)
 *   • Conflict detection: shows a banner when remote data overwrites local
 *   • Pre-signout flush: ensures all pending writes land before logout
 *   • Online/offline awareness: queues a sync when connectivity returns
 *   • Idempotent: safe to call multiple times — de-dupes in-flight calls
 *
 * Public API (all set on window.SyncManager):
 *   SyncManager.loginSync()         — called on SIGNED_IN / session restore
 *   SyncManager.flushBeforeSignOut()— called by chunksSignOut() before redirect
 *   SyncManager.nudge()             — lightweight re-sync after a long offline gap
 *   SyncManager.status              — 'idle' | 'syncing' | 'error' | 'success'
 */

import { ChunksDB } from './chunksDb.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RETRIES   = 3;
const BASE_DELAY_MS = 1200;   // first retry after 1.2s
const PILL_SUCCESS_DURATION = 2200;  // how long "Synced ✓" stays visible
const CONFLICT_FIELDS = {             // human-readable names for conflict report
  chat_sessions: 'chat history',
  user_settings: 'settings',
  streak_state:  'streak data',
  ws_state:      'reading position',
};

// ── State ─────────────────────────────────────────────────────────────────────

let _status        = 'idle';   // 'idle' | 'syncing' | 'error' | 'success'
let _inFlight      = false;    // prevents overlapping pullAll calls
let _retryCount    = 0;
let _retryTimer    = null;
let _pillHideTimer = null;
let _conflictsFound = [];      // list of table names where remote overwrote local
let _lastNudgeTime  = 0;       // timestamp of last nudge() call for cooldown

// ── DOM helpers ───────────────────────────────────────────────────────────────

function _pill()         { return document.getElementById('sync-pill'); }
function _pillIcon()     { return document.getElementById('sync-pill-icon'); }
function _pillText()     { return document.getElementById('sync-pill-text'); }
function _conflictBanner(){ return document.getElementById('sync-conflict-banner'); }
function _conflictText() { return document.getElementById('sync-conflict-text'); }

/**
 * Show/update the sync pill with a given state.
 * @param {'syncing'|'success'|'error'|'conflict'} state
 * @param {string} text
 * @param {boolean} [autoHide]  — hide after PILL_SUCCESS_DURATION ms
 */
function _showPill(state, text, autoHide = false) {
  const pill = _pill();
  const icon = _pillIcon();
  const msg  = _pillText();
  if (!pill || !icon || !msg) return;

  clearTimeout(_pillHideTimer);

  // Reset classes
  pill.className = '';
  pill.classList.add(state, 'show');

  // Icon by state
  const icons = {
    syncing:  '↻',   // spins via CSS animation
    success:  '✓',
    error:    '!',
    conflict: '↕',
  };
  icon.textContent = icons[state] || '';
  msg.textContent  = text;

  if (autoHide) {
    _pillHideTimer = setTimeout(() => _hidePill(), PILL_SUCCESS_DURATION);
  }
}

function _hidePill() {
  const pill = _pill();
  if (!pill) return;
  pill.classList.remove('show');
  setTimeout(() => { pill.className = ''; }, 300);
}

function _showConflictBanner(fields) {
  const banner = _conflictBanner();
  const text   = _conflictText();
  if (!banner || !text) return;
  const names = fields.map(f => CONFLICT_FIELDS[f] || f).join(', ');
  text.textContent = `Updated from another device: ${names}. Changes applied.`;
  banner.classList.add('show');
  // Auto-dismiss after 8s
  setTimeout(() => banner.classList.remove('show'), 8000);
}

// ── Core sync with retry ──────────────────────────────────────────────────────

/**
 * Run pullAll with retry and UI feedback.
 * @param {{ silent?: boolean }} [opts]  — silent=true skips the "Syncing…" pill
 * @returns {Promise<boolean>}  — true if sync succeeded
 */
async function _runSync({ silent = false, force = false } = {}) {
  if (_inFlight) return false;
  if (!ChunksDB.isLoggedIn()) return false;

  _inFlight = true;
  _status   = 'syncing';
  _conflictsFound = [];
  window._syncManagerDone = false;  // reset so restore waits

  if (!silent) _showPill('syncing', 'Syncing…');

  try {
    // Intercept conflict signals from the pull methods.
    // We monkey-patch _remoteIsNewer results via an event the pull
    // methods can fire on window.
    const conflictListener = (e) => {
      if (e.detail?.table && !_conflictsFound.includes(e.detail.table)) {
        _conflictsFound.push(e.detail.table);
      }
    };
    window.addEventListener('chunksdb:conflict', conflictListener, { once: false });

    await ChunksDB.pullAll({ force });

    window.removeEventListener('chunksdb:conflict', conflictListener);

    // Success
    _status     = 'success';
    _retryCount = 0;
    _inFlight   = false;
    // Signal to HomeScreen restore that localStorage is now populated
    window._syncManagerDone = true;

    if (_conflictsFound.length > 0) {
      // Remote overwrote something local — inform the user
      if (!silent) _showPill('conflict', 'Synced (updated from another device)', true);
      _showConflictBanner(_conflictsFound);
    } else {
      if (!silent) _showPill('success', 'Synced ✓', true);
    }

    return true;

  } catch (e) {
    _inFlight = false;
    _status   = 'error';

    console.warn('[SyncManager] pullAll failed:', e?.message || e);

    if (_retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, _retryCount); // 1.2s, 2.4s, 4.8s
      _retryCount++;

      if (!silent) _showPill('syncing', `Sync failed — retrying (${_retryCount}/${MAX_RETRIES})…`);

      clearTimeout(_retryTimer);
      _retryTimer = setTimeout(() => _runSync({ silent }), delay);
    } else {
      // All retries exhausted
      _retryCount = 0;
      if (!silent) _showPill('error', 'Sync failed — will retry when online', true);
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
   * Shows the sync pill so the user knows their data is loading.
   *
   * @param {{ force?: boolean }} [opts] — force:true bypasses the 60s pullAll cooldown
   */
  async loginSync({ force = false } = {}) {
    if (!ChunksDB.isLoggedIn()) return;

    // If offline, queue for reconnect
    if (!navigator.onLine) {
      console.log('[SyncManager] Offline at login — queued for reconnect');
      _showPill('syncing', 'Offline — will sync when connected');
      return;
    }

    // Small delay so the page has painted before we show the pill
    await new Promise(r => setTimeout(r, 300));
    await _runSync({ silent: false, force });

    // After sync, apply any UI changes needed (e.g. re-render streak widget)
    _applyPostSyncUI();
  },

  /**
   * Flush all pending local data up to Supabase before sign-out.
   * We don't await individual saves — we fire them all in parallel and
   * wait up to 3s for them to settle before the redirect happens.
   *
   * @returns {Promise<void>}
   */
  async flushBeforeSignOut() {
    if (!ChunksDB.isLoggedIn()) return;
    _showPill('syncing', 'Saving…');

    const timeout = new Promise(r => setTimeout(r, 3000)); // max 3s wait
    const flush   = Promise.allSettled([
      ChunksDB.settings.pushLocalToRemote?.(),
      ChunksDB.streak.pushLocalToRemote?.(),
      ChunksDB.ws.pushLocalToRemote?.(),
      _uploadPendingChatSessions(),
    ]);

    await Promise.race([flush, timeout]);
    _hidePill();
  },

  /**
   * Lightweight nudge — re-runs pullAll silently.
   * Called when the app regains focus after a long idle (>15 min)
   * or when connectivity is restored.
   */
  async nudge() {
    if (!ChunksDB.isLoggedIn()) return;
    // Set the cooldown timestamp FIRST — before any early-return guards.
    // If nudge() returns early because _inFlight=true, we still want the
    // cooldown stamped so the next trigger (online/visibilitychange) doesn't
    // fire a second full sync the instant _inFlight becomes false.
    const now = Date.now();
    if (_status === 'success' && (now - (_lastNudgeTime || 0)) < 60_000) return;
    _lastNudgeTime = now;
    if (_inFlight) return;
    await _runSync({ silent: true });
    _applyPostSyncUI();
  },
};

// ── Post-sync UI refresh ──────────────────────────────────────────────────────
// After a successful pull, re-render any widgets that read from localStorage
// (streak widget, settings dropdowns) so they reflect the merged data.

function _applyPostSyncUI() {
  try {
    // Re-render streak widget if on flashcards screen
    window._fcRenderStreak?.();

    // Re-apply accent color in case it changed on another device
    const accent = localStorage.getItem('chunks_setting_accent');
    const color  = localStorage.getItem('chunks_setting_accent_color');
    if (accent && color) window.applyAccentColor?.(color);

    // Re-apply appearance / theme
    const appearance = localStorage.getItem('chunks_setting_appearance');
    if (appearance) window.applyAppearance?.(appearance);

    // Re-apply font size
    const fs = localStorage.getItem('chunks-chat-font-size');
    const fsMap = { small: '11px', medium: '13px', large: '15px', S: '11px', M: '13px', L: '15px' };
    if (fs && fsMap[fs]) {
      document.documentElement.style.setProperty('--chat-font-size', fsMap[fs]);
    }

    // Mount the latest chat session from Supabase if the home screen is
    // currently showing the landing (no chat active yet on this device).
    // Small delay so the DOM is settled after sync writes to localStorage.
    setTimeout(() => {
      window._homeMountLatestSession?.();
    }, 150);

  } catch (e) {
    console.warn('[SyncManager] post-sync UI refresh error:', e.message);
  }
}

// ── Upload any locally-queued chat sessions ───────────────────────────────────

async function _uploadPendingChatSessions() {
  try {
    const tombs = new Set(JSON.parse(localStorage.getItem('chunks_deleted_sessions') || '[]'));
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith('chunks_session_')) continue;
      const s = JSON.parse(localStorage.getItem(k) || 'null');
      if (!s) continue;
      // Skip tombstoned (deleted) sessions
      if (tombs.has(s.id) || (s.supabaseId && tombs.has(s.supabaseId))) continue;
      if (!s.supabaseId || /^r[0-9]+$/.test(s.supabaseId)) continue; // no UUID — skip
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

// ── Online / offline listeners ────────────────────────────────────────────────

window.addEventListener('online', () => {
  console.log('[SyncManager] Network restored — running nudge sync');
  SyncManager.nudge();
});

// ── Idle / re-focus sync ──────────────────────────────────────────────────────
// Re-sync when the user comes back to the tab after ≥15 min away.

let _lastFocusSync = Date.now();
const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const elapsed = Date.now() - _lastFocusSync;
  if (elapsed >= IDLE_THRESHOLD_MS) {
    _lastFocusSync = Date.now();
    SyncManager.nudge();
  }
});

// ── Window bridge ─────────────────────────────────────────────────────────────

window.SyncManager = SyncManager;
console.log('[SyncManager] Phase 4 sync manager ready ✦');

export { SyncManager };
