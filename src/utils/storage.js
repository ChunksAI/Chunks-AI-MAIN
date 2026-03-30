/**
 * src/utils/storage.js — Storage utilities
 *
 * Centralises every localStorage / sessionStorage access for the app.
 * All callers should import the helpers below rather than calling the
 * Web Storage API directly.
 *
 * Design
 * ──────
 *  • lsGet / lsSet / lsRemove  — safe JSON wrappers for localStorage
 *  • ssGet / ssSet / ssRemove  — same for sessionStorage
 *  • KEYS                      — typed constant object (prevents typos)
 *  • getSetting / setSetting   — shorthand for chunks_setting_* keys
 *
 * Large, mutable data (chat sessions, flashcard decks/sessions, study
 * plans) is transparently stored in IndexedDB via src/lib/idbStorage.js
 * while small settings and flags remain in localStorage.
 *
 * NOTE: window.* bridges are centralised in src/globals.js so inline
 * script blocks that haven't been migrated yet continue to work unchanged.
 */

import { isIdbKey, idbGet, idbSet, idbRemove } from '../lib/idbStorage.js';
import { isQuotaError, showStorageError } from '../components/StorageErrorBanner.js';
import { checkStorageQuota } from './storageQuota.js';
import { memGet, memSet, memRemove } from '../lib/memCache.js';

// ── In-memory-only keys ────────────────────────────────────────────────────
// These keys were previously stored in localStorage or IndexedDB as caches
// of Supabase data.  They are now kept ONLY in the in-memory cache
// (src/lib/memCache.js) so that Supabase remains the single source of truth.
// On page load the cache starts empty; pullAll() repopulates from Supabase.

/** Exact keys stored only in memory (never persisted to disk) */
const MEM_ONLY_KEYS = new Set([
  // Tombstone list — canonical copy lives in user_settings.notifications.deleted_sessions
  'chunks_deleted_sessions',
  // Exam recent list — synced from recent_items table
  'exam_recent',
  // Study plan recent list — synced from recent_items table
  'sp_recent_plans',
  // Streak / XP data — synced from streak_state table
  'fc_streak_data',
  // Default book pointer — synced from ws_state.active_book_id
  'chunks_default_book',
  // Admin / owner email cache — verified via backend on every session
  'chunks_admin_email',
  'chunks_owner_email',
  // One-time settings guard — re-evaluated on login
  'chunks_settings_initialized',
  // Sync timestamps — transient, repopulated by pullAndApply
  'chunks_settings_updated_at',
  'chunks_recent_items_updated_at',
  'chunks_ws_last_visited',
]);

/** Key prefixes stored only in memory */
const MEM_ONLY_PREFIXES = [
  'exam_snap_',       // exam snapshots — full results live in exams table
  'sp_exam_date_',    // exam dates — part of study_plans records
];

/**
 * Returns true if `key` should be stored only in the in-memory cache.
 * @param {string} key
 * @returns {boolean}
 */
function _isMemOnly(key) {
  if (MEM_ONLY_KEYS.has(key)) return true;
  for (let i = 0; i < MEM_ONLY_PREFIXES.length; i++) {
    if (key.startsWith(MEM_ONLY_PREFIXES[i])) return true;
  }
  return false;
}

// ── localStorage helpers ───────────────────────────────────────────────────

/**
 * Read a JSON value from the in-memory cache, IndexedDB, or localStorage.
 * Keys in MEM_ONLY_KEYS/MEM_ONLY_PREFIXES are served from in-memory cache
 * only (Supabase is the single source of truth for these).
 * Returns `fallback` (default null) if the key is absent or parse fails.
 *
 * @template T
 * @param {string} key
 * @param {T}      [fallback=null]
 * @returns {T}
 */
export function lsGet(key, fallback = null) {
  if (_isMemOnly(key)) return memGet(key, fallback);
  if (isIdbKey(key)) return idbGet(key, fallback);
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

/**
 * Write a JSON-serialisable value to the in-memory cache, IndexedDB, or
 * localStorage.  Keys in MEM_ONLY_KEYS/MEM_ONLY_PREFIXES are written to
 * in-memory cache only (never persisted to disk).
 *
 * @param {string} key
 * @param {*}      value
 */
export function lsSet(key, value) {
  if (_isMemOnly(key)) { memSet(key, value); return; }
  if (isIdbKey(key)) { idbSet(key, value); return; }
  checkStorageQuota();   // fire-and-forget — warn before potential quota failure
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[storage] localStorage write failed:', key);
    if (isQuotaError(e)) showStorageError('quota');
  }
}

/**
 * Remove a key from the in-memory cache, IndexedDB, or localStorage.
 *
 * @param {string} key
 */
export function lsRemove(key) {
  if (_isMemOnly(key)) { memRemove(key); return; }
  if (isIdbKey(key)) { idbRemove(key); return; }
  try { localStorage.removeItem(key); } catch (_) {}
}

// ── sessionStorage helpers ─────────────────────────────────────────────────

/**
 * Read a string value from sessionStorage (no JSON parsing — SS values are
 * always plain strings in this app).
 *
 * @param {string} key
 * @param {string} [fallback='']
 * @returns {string}
 */
export function ssGet(key, fallback = '') {
  try { return sessionStorage.getItem(key) ?? fallback; } catch (_) { return fallback; }
}

/**
 * Write a string value to sessionStorage.
 *
 * @param {string} key
 * @param {string} value
 */
export function ssSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch (_) {}
}

/**
 * Remove a key from sessionStorage.
 *
 * @param {string} key
 */
export function ssRemove(key) {
  try { sessionStorage.removeItem(key); } catch (_) {}
}

// ── Key constants ──────────────────────────────────────────────────────────

/**
 * All localStorage / sessionStorage key strings used by the app.
 * Import KEYS and use KEYS.* to avoid magic strings.
 */
export const KEYS = Object.freeze({
  // ── Navigation / sessions ──────────────────────────────────────────
  RECENT:              'chunks_recent',
  HOME_SESSION:        'chunks_home_session',
  ACTIVE_HOME_SESSION: 'chunks_active_home_session',
  ACTIVE_RECENT_ID:    'chunks_active_recent_id',
  ACTIVE_WS_BOOK:      'chunks_active_ws_book',
  ACTIVE_WS_USER_DOC:  'chunks_active_ws_user_doc',
  SESSION_PREFIX:      'chunks_session_',        // + id
  WS_SESSION_PREFIX:   'chunks_ws_session_',     // + bookId

  // ── Settings ───────────────────────────────────────────────────────
  SETTING_PREFIX:       'chunks_setting_',       // + key
  SETTING_APPEARANCE:   'chunks_setting_appearance',
  SETTING_LANGUAGE:     'chunks_setting_language',
  SETTING_SPOKEN_LANG:  'chunks_setting_spoken-language',
  SETTING_VOICE:        'chunks_setting_voice',
  SETTING_ACCENT:       'chunks_setting_accent',
  SETTING_ACCENT_COLOR: 'chunks_setting_accent_color',
  SETTING_FOLLOWUPS:    'chunks_setting_followups',
  SETTING_AUTO_FLASH:   'chunks_setting_auto-flash',
  CHAT_FONT_SIZE:       'chunks-chat-font-size',

  // ── App state ──────────────────────────────────────────────────────
  DEFAULT_BOOK:    'chunks_default_book',           // in-memory only (synced via ws_state)
  STUDY_MODE:      'chunks_study_mode',
  IMPROVE_DATA:    'chunks_improve_data',

  // ── Exam ───────────────────────────────────────────────────────────
  EXAM_RECENT:     'exam_recent',                   // in-memory only (synced via recent_items)
  EXAM_SNAP_PREFIX:'exam_snap_',                 // + id

  // ── Study plan ─────────────────────────────────────────────────────
  SP_RECENT_PLANS: 'sp_recent_plans',

  // ── sessionStorage keys ────────────────────────────────────────────
  SS_WAS_HERE:       'chunks_was_here',
  SS_IS_REFRESH:     'chunks_is_refresh',
  SS_ACTIVE_SCREEN:  'chunks_active_screen',
  SS_LIBRARY_OPEN:   'chunks_library_open',
});

// ── Settings shortcuts ─────────────────────────────────────────────────────

/**
 * Read a setting value by short key (without the 'chunks_setting_' prefix).
 * Returns null if the key hasn't been saved yet.
 *
 * @param {string}  key        - e.g. 'followups', 'voice', 'accent'
 * @param {*}       [fallback]
 * @returns {string|null}
 */
export function getSetting(key, fallback = null) {
  try {
    const val = localStorage.getItem(KEYS.SETTING_PREFIX + key);
    return val !== null ? val : fallback;
  } catch (_) {
    return fallback;
  }
}

/**
 * Write a setting value (always stored as a plain string).
 *
 * @param {string} key   - short key, e.g. 'followups'
 * @param {string} value
 */
export function setSetting(key, value) {
  try {
    localStorage.setItem(KEYS.SETTING_PREFIX + key, value);
  } catch (_) {}
}

