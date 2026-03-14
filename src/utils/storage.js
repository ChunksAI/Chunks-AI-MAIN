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
  INCOGNITO:       'chunks_incognito_session',
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

// ── Chat session helpers ───────────────────────────────────────────────────
//
// Single source of truth for persistent chat history.
// All reads/writes go through these functions — no raw localStorage calls
// elsewhere. Uses the same key constants already in KEYS above.
//
// Storage layout
// ──────────────
//  chunks_recent              → JSON array of { id, title, updatedAt, source }
//  chunks_session_<id>        → JSON object  { id, title, createdAt, updatedAt, source, messages[] }
//  chunks_active_recent_id    → plain string — the ID of the currently open session
//
// Guide reference: Implementation Guide v1.0 §04 — Code Changes

const _RECENT_KEY  = KEYS.RECENT;          // 'chunks_recent'
const _ACTIVE_KEY  = KEYS.ACTIVE_RECENT_ID; // 'chunks_active_recent_id'
const _SFX         = KEYS.SESSION_PREFIX;   // 'chunks_session_'
const _MAX_RECENT  = 20;

/** Returns true when saving is permitted (respects incognito + save_history). */
function _canSave() {
  try {
    if (localStorage.getItem(KEYS.INCOGNITO)    === '1')  return false;
    if (localStorage.getItem(KEYS.SAVE_HISTORY) === '0')  return false;
    return true;
  } catch (_) { return false; }
}

/**
 * Create a new chat session. Called on the FIRST message of a new chat.
 * @param {string} firstMessage  - The user's first message (used as title).
 * @param {'general'|'workspace'} [source='general']
 * @returns {{ id, title, createdAt, updatedAt, source, messages }} | null
 */
export function createSession(firstMessage, source = 'general') {
  if (!_canSave()) return null;

  const id    = `session_${Date.now()}`;
  const title = (firstMessage || '').slice(0, 40).trim() || 'New chat';
  const now   = Date.now();

  const session = { id, title, createdAt: now, updatedAt: now, source, messages: [] };

  // Persist full session
  try { localStorage.setItem(`${_SFX}${id}`, JSON.stringify(session)); } catch (_) { return null; }

  // Prepend to recent list (cap at _MAX_RECENT)
  const recent = getRecentList();
  recent.unshift({ id, title, updatedAt: now, source });
  if (recent.length > _MAX_RECENT) recent.splice(_MAX_RECENT);
  try { localStorage.setItem(_RECENT_KEY, JSON.stringify(recent)); } catch (_) {}

  // Mark as the active session
  try { localStorage.setItem(_ACTIVE_KEY, id); } catch (_) {}

  return session;
}

/**
 * Append a message to an existing session.
 * Called after every user message AND every AI response.
 * @param {string} sessionId
 * @param {'user'|'assistant'} role
 * @param {string} content
 */
export function appendMessage(sessionId, role, content) {
  if (!_canSave() || !sessionId) return;

  try {
    const raw = localStorage.getItem(`${_SFX}${sessionId}`);
    if (!raw) return;

    const session   = JSON.parse(raw);
    const now       = Date.now();
    session.messages.push({ role, content, time: now });
    session.updatedAt = now;
    localStorage.setItem(`${_SFX}${sessionId}`, JSON.stringify(session));

    // Bump updatedAt in the recent list so sidebar order stays fresh
    const recent = getRecentList();
    const entry  = recent.find(r => r.id === sessionId);
    if (entry) {
      entry.updatedAt = now;
      localStorage.setItem(_RECENT_KEY, JSON.stringify(recent));
    }
  } catch (_) {}
}

/**
 * Return the recent-list array (sorted newest first, already stored that way).
 * Safe to call at any time — returns [] on error or empty storage.
 * @returns {Array<{ id, title, updatedAt, source }>}
 */
export function getRecentList() {
  try { return JSON.parse(localStorage.getItem(_RECENT_KEY) || '[]') || []; }
  catch (_) { return []; }
}

/**
 * Return the full session object for a given ID, or null.
 * @param {string} id
 * @returns {{ id, title, createdAt, updatedAt, source, messages[] } | null}
 */
export function getSession(id) {
  try { return JSON.parse(localStorage.getItem(`${_SFX}${id}`)) ?? null; }
  catch (_) { return null; }
}

/**
 * Return the ID of the currently active session (set by createSession /
 * setActiveSessionId). Used on page load to restore the last open chat.
 * @returns {string | null}
 */
export function getActiveSessionId() {
  try { return localStorage.getItem(_ACTIVE_KEY) || null; }
  catch (_) { return null; }
}

/**
 * Mark a session as active (persists across refresh / new tab).
 * Pass null to clear the active marker.
 * @param {string | null} id
 */
export function setActiveSessionId(id) {
  try {
    if (id) localStorage.setItem(_ACTIVE_KEY, id);
    else    localStorage.removeItem(_ACTIVE_KEY);
  } catch (_) {}
}

/**
 * Remove a single session from storage and from the recent list.
 * If it was the active session, the active marker is also cleared.
 * @param {string} id
 */
export function deleteSession(id) {
  try { localStorage.removeItem(`${_SFX}${id}`); } catch (_) {}
  try {
    const recent = getRecentList().filter(r => r.id !== id);
    localStorage.setItem(_RECENT_KEY, JSON.stringify(recent));
  } catch (_) {}
  try {
    if (localStorage.getItem(_ACTIVE_KEY) === id) localStorage.removeItem(_ACTIVE_KEY);
  } catch (_) {}
}

/**
 * Wipe all session data — called by Settings → "Clear Chat History".
 * Removes every chunks_session_* key plus the recent list and active marker.
 */
export function clearAllHistory() {
  try {
    const recent = getRecentList();
    recent.forEach(r => { try { localStorage.removeItem(`${_SFX}${r.id}`); } catch (_) {} });
    localStorage.removeItem(_RECENT_KEY);
    localStorage.removeItem(_ACTIVE_KEY);
  } catch (_) {}
}

// Expose session helpers on window so inline script blocks (index.html) and
// any non-module code can also call them without an ES-module import.
window.createSession      = createSession;
window.appendMessage      = appendMessage;
window.getRecentList      = getRecentList;
window.getSession         = getSession;
window.getActiveSessionId = getActiveSessionId;
window.setActiveSessionId = setActiveSessionId;
window.deleteSession      = deleteSession;
window.clearAllHistory    = clearAllHistory;
