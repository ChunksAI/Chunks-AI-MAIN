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
 * Task 13 — extracted from monolith.
 * Replaces the identical lsGet/lsSet/lsRemove helpers inside ChunksDB
 * (lines ~6839–6852) and the 90+ raw localStorage calls scattered across
 * every script block.
 *
 * NOTE: window.* bridges are set at the bottom so inline script blocks
 * that haven't been migrated yet continue to work unchanged.
 */

// ── localStorage helpers ───────────────────────────────────────────────────

/**
 * Read a JSON value from localStorage.
 * Returns `fallback` (default null) if the key is absent or parse fails.
 *
 * @template T
 * @param {string} key
 * @param {T}      [fallback=null]
 * @returns {T}
 */
export function lsGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

/**
 * Write a JSON-serialisable value to localStorage.
 * Silently swallows QuotaExceededError and SecurityError.
 *
 * @param {string} key
 * @param {*}      value
 */
export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    console.warn('[storage] localStorage write failed:', key);
  }
}

/**
 * Remove a key from localStorage.
 *
 * @param {string} key
 */
export function lsRemove(key) {
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
  DEFAULT_BOOK:    'chunks_default_book',
  STUDY_MODE:      'chunks_study_mode',
  SAVE_HISTORY:    'chunks_save_history',
  IMPROVE_DATA:    'chunks_improve_data',

  // ── Exam ───────────────────────────────────────────────────────────
  EXAM_RECENT:     'exam_recent',
  EXAM_SNAP_PREFIX:'exam_snap_',                 // + id

  // ── Study plan ─────────────────────────────────────────────────────
  SP_RECENT_PLANS: 'sp_recent_plans',

  // ── Supabase credentials (set by admin.html / fetchConfig) ────────
  SB_URL:          'chunks_sb_url',
  SB_ANON:         'chunks_sb_anon',

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

// ── Legacy global bridges ──────────────────────────────────────────────────
// Inline script blocks that call localStorage directly continue to work.
// These helpers are also exposed so ChunksDB can delegate to them in Task 31.
window._lsGet    = lsGet;
window._lsSet    = lsSet;
window._lsRemove = lsRemove;
window._ssGet    = ssGet;
window._ssSet    = ssSet;
window._ssRemove = ssRemove;
window.getSetting = getSetting;
window.setSetting = setSetting;
window.STORAGE_KEYS = KEYS;
