/**
 * src/utils/storage.js — Storage utilities (in-memory, no localStorage)
 *
 * All app data is fetched from and written to Supabase only.
 * These helpers provide a transient in-memory store for the current
 * browser session. Data is populated on login via ChunksDB.pullAll()
 * and is intentionally not persisted to Web Storage APIs.
 *
 * ssGet / ssSet / ssRemove remain as sessionStorage wrappers because
 * sessionStorage is used only for ephemeral UI flags (guest mode,
 * OAuth callback, screen restore) — not user data.
 */

// ── In-memory store ────────────────────────────────────────────────────────────

/** @type {Map<string, *>} */
const _mem = new Map();

// ── localStorage helpers (in-memory) ──────────────────────────────────────────

/**
 * Read a value from the in-memory store.
 * @template T
 * @param {string} key
 * @param {T}      [fallback=null]
 * @returns {T}
 */
export function lsGet(key, fallback = null) {
  return _mem.has(key) ? _mem.get(key) : fallback;
}

/**
 * Write a value to the in-memory store.
 * @param {string} key
 * @param {*}      value
 */
export function lsSet(key, value) {
  _mem.set(key, value);
}

/**
 * Remove a key from the in-memory store.
 * @param {string} key
 */
export function lsRemove(key) {
  _mem.delete(key);
}

/**
 * Clear all in-memory data (call on sign-out to prevent cross-user leaks).
 */
export function memClear() {
  _mem.clear();
}

/**
 * Return all keys with a given prefix (used by chat/ws namespace scans).
 * @param {string} [prefix='']
 * @returns {string[]}
 */
export function memKeys(prefix = '') {
  const out = [];
  for (const k of _mem.keys()) {
    if (k.startsWith(prefix)) out.push(k);
  }
  return out;
}

// ── sessionStorage helpers ─────────────────────────────────────────────────────

/**
 * Read a string value from sessionStorage.
 * @param {string} key
 * @param {string} [fallback='']
 * @returns {string}
 */
export function ssGet(key, fallback = '') {
  try { return sessionStorage.getItem(key) ?? fallback; } catch (_) { return fallback; }
}

/**
 * Write a string value to sessionStorage.
 * @param {string} key
 * @param {string} value
 */
export function ssSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch (_) {}
}

/**
 * Remove a key from sessionStorage.
 * @param {string} key
 */
export function ssRemove(key) {
  try { sessionStorage.removeItem(key); } catch (_) {}
}

// ── Key constants ──────────────────────────────────────────────────────────────

export const KEYS = Object.freeze({
  // ── Navigation / sessions ──────────────────────────────────────────
  RECENT:              'chunks_recent',
  HOME_SESSION:        'chunks_home_session',
  ACTIVE_HOME_SESSION: 'chunks_active_home_session',
  ACTIVE_RECENT_ID:    'chunks_active_recent_id',
  ACTIVE_WS_BOOK:      'chunks_active_ws_book',
  ACTIVE_WS_USER_DOC:  'chunks_active_ws_user_doc',
  SESSION_PREFIX:      'chunks_session_',
  WS_SESSION_PREFIX:   'chunks_ws_session_',

  // ── Settings ───────────────────────────────────────────────────────
  SETTING_PREFIX:       'chunks_setting_',
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
  EXAM_SNAP_PREFIX:'exam_snap_',

  // ── Study plan ─────────────────────────────────────────────────────
  SP_RECENT_PLANS: 'sp_recent_plans',

  // ── sessionStorage keys ────────────────────────────────────────────
  SS_WAS_HERE:       'chunks_was_here',
  SS_IS_REFRESH:     'chunks_is_refresh',
  SS_ACTIVE_SCREEN:  'chunks_active_screen',
  SS_LIBRARY_OPEN:   'chunks_library_open',
});

// ── Settings shortcuts ─────────────────────────────────────────────────────────

/**
 * Read a setting value by short key (without the 'chunks_setting_' prefix).
 * @param {string} key        e.g. 'accent', 'voice', 'appearance'
 * @param {*}      [fallback]
 * @returns {string|null}
 */
export function getSetting(key, fallback = null) {
  const val = _mem.get(KEYS.SETTING_PREFIX + key);
  return val !== undefined ? val : fallback;
}

/**
 * Write a setting value (stored as a plain string in the in-memory store).
 * @param {string} key   short key, e.g. 'followups'
 * @param {string} value
 */
export function setSetting(key, value) {
  _mem.set(KEYS.SETTING_PREFIX + key, value);
}
