/**
 * src/utils/storage.js — Storage utilities
 *
 * Single source of truth for every localStorage / sessionStorage access.
 * All callers should import from here instead of calling the Web Storage
 * API directly. Every operation is wrapped in try/catch so a quota error
 * (private-browsing, full storage) never propagates to the caller.
 *
 * Exports
 * ───────
 *  KEYS                         All storage key strings (prevents typos)
 *
 *  // Low-level safe wrappers
 *  lsGet(key)                   localStorage.getItem  → string | null
 *  lsSet(key, value)            localStorage.setItem  → void
 *  lsRemove(key)                localStorage.removeItem → void
 *  ssGet(key)                   sessionStorage.getItem → string | null
 *  ssSet(key, value)            sessionStorage.setItem → void
 *  ssRemove(key)                sessionStorage.removeItem → void
 *
 *  // History / incognito
 *  isHistorySavingEnabled()     true if history saving is on
 *
 *  // Home chat sessions
 *  saveHomeSession(id, historyArr)
 *  loadHomeSession(id)          → { html, history } | null
 *
 *  // Workspace sessions
 *  saveWsSession(bookId, historyArr)
 *  loadWsSession(bookId)        → { html, history } | null
 *
 *  // Recent items
 *  loadRecentItems()            → array (parsed JSON or [])
 *  saveRecentItems(items)       → void
 *
 *  // Active-session pointers
 *  getActiveHomeSession()       → string | null
 *  setActiveHomeSession(id)     → void
 *  clearActiveHomeSession()     → void
 *  getActiveWsBook()            → string | null
 *  setActiveWsBook(bookId)      → void
 *  clearActiveWsBook()          → void
 *  getActiveRecentId()          → string | null
 *  setActiveRecentId(id)        → void
 *  clearActiveRecentId()        → void
 *
 *  // Settings
 *  getSetting(key)              → string | null
 *  setSetting(key, value)       → void
 *  getStudyMode()               → 'balanced' | string
 *  isFollowupsEnabled()         → boolean
 *  isAutoFlashEnabled()         → boolean
 *  getChatFontSize()            → 'small' | 'medium' | 'large' | null
 *  setChatFontSize(size)        → void
 *  getDefaultBook()             → string | null
 *  setDefaultBook(bookId)       → void
 *  getAccentName()              → string | null
 *  getAccentColor()             → string | null
 *  setSaveHistory(enabled)      → void
 *  isSaveHistoryEnabled()       → boolean
 *
 *  // sessionStorage navigation flags
 *  getActiveScreen()            → string | null
 *  setActiveScreen(name)        → void
 *  wasHere()                    → boolean
 *  setWasHere()                 → void
 *  getIsRefresh()               → boolean
 *  setIsRefresh()               → void
 *  clearIsRefresh()             → void
 *  isLibraryOpen()              → boolean
 *  setLibraryOpen(open)         → void
 *
 * Task 13 — extracted from monolith:
 *   _historySavingEnabled  → line 2961
 *   _saveRecent / items    → lines 2957-2970
 *   _saveSession           → line 2971
 *   _loadSession           → line 2978
 *   _saveWsSession         → line 2986
 *   _loadWsSession         → line 2994
 *   settingsFontSize save  → line 4876
 *   getSetting / setSetting → lines 5407, 5515
 *   _getStudyMode          → line 5545
 *   _isFollowupsEnabled    → line 5549
 *   _isAutoFlashEnabled    → line 5553
 *   sessionStorage flags   → lines 1743-1814
 */

// ── Storage key constants ──────────────────────────────────────────────────

/** All localStorage / sessionStorage key strings in one place. */
export const KEYS = {
  // History / recent
  RECENT:               'chunks_recent',
  SAVE_HISTORY:         'chunks_save_history',
  INCOGNITO_SESSION:    'chunks_incognito_session',

  // Home chat sessions  (suffix: <id>)
  SESSION_PREFIX:       'chunks_session_',

  // Workspace sessions  (suffix: <bookId>)
  WS_SESSION_PREFIX:    'chunks_ws_session_',

  // Active pointers
  ACTIVE_HOME_SESSION:  'chunks_active_home_session',
  ACTIVE_WS_BOOK:       'chunks_active_ws_book',
  ACTIVE_RECENT_ID:     'chunks_active_recent_id',

  // Settings
  SETTING_PREFIX:       'chunks_setting_',
  STUDY_MODE:           'chunks_study_mode',
  DEFAULT_BOOK:         'chunks_default_book',
  CHAT_FONT_SIZE:       'chunks-chat-font-size',  // note: hyphen separator (legacy)

  // sessionStorage navigation flags
  SS_ACTIVE_SCREEN:     'chunks_active_screen',
  SS_WAS_HERE:          'chunks_was_here',
  SS_IS_REFRESH:        'chunks_is_refresh',
  SS_LIBRARY_OPEN:      'chunks_library_open',
};

// ── Low-level safe wrappers ────────────────────────────────────────────────

/**
 * Safe localStorage.getItem — returns null on error.
 * @param {string} key
 * @returns {string|null}
 */
export function lsGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

/**
 * Safe localStorage.setItem — silently ignores quota / security errors.
 * @param {string} key
 * @param {string} value
 */
export function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
}

/**
 * Safe localStorage.removeItem.
 * @param {string} key
 */
export function lsRemove(key) {
  try { localStorage.removeItem(key); } catch (_) {}
}

/**
 * Safe sessionStorage.getItem — returns null on error.
 * @param {string} key
 * @returns {string|null}
 */
export function ssGet(key) {
  try { return sessionStorage.getItem(key); } catch (_) { return null; }
}

/**
 * Safe sessionStorage.setItem.
 * @param {string} key
 * @param {string} value
 */
export function ssSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch (_) {}
}

/**
 * Safe sessionStorage.removeItem.
 * @param {string} key
 */
export function ssRemove(key) {
  try { sessionStorage.removeItem(key); } catch (_) {}
}

// ── History / incognito ────────────────────────────────────────────────────

/**
 * Returns true when the user has not disabled history saving and is not in
 * an incognito session.  All save helpers call this before writing.
 * @returns {boolean}
 */
export function isHistorySavingEnabled() {
  if (lsGet(KEYS.INCOGNITO_SESSION) === '1') return false;
  return lsGet(KEYS.SAVE_HISTORY) !== '0';
}

/** @deprecated use isHistorySavingEnabled() */
export const _historySavingEnabled = isHistorySavingEnabled;

// ── Home chat sessions ─────────────────────────────────────────────────────

/**
 * Persist the current home-chat HTML + message history for a given session id.
 * No-ops when history saving is disabled.
 * @param {string}   id          Session UUID
 * @param {Array}    historyArr  Raw message history array
 */
export function saveHomeSession(id, historyArr) {
  if (!isHistorySavingEnabled()) return;
  const html = document.getElementById('home-chat-history')?.innerHTML || '';
  lsSet(KEYS.SESSION_PREFIX + id, JSON.stringify({ html, history: historyArr }));
}

/**
 * Load a previously saved home-chat session.
 * @param {string} id
 * @returns {{ html: string, history: Array }|null}
 */
export function loadHomeSession(id) {
  try {
    const raw = lsGet(KEYS.SESSION_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

// ── Workspace sessions ─────────────────────────────────────────────────────

/**
 * Persist the current workspace chat HTML + history for a given book.
 * Also records which book was last active.
 * @param {string} bookId
 * @param {Array}  historyArr
 */
export function saveWsSession(bookId, historyArr) {
  if (!isHistorySavingEnabled()) return;
  const html = document.getElementById('ws-messages')?.innerHTML || '';
  lsSet(KEYS.WS_SESSION_PREFIX + bookId, JSON.stringify({ html, history: historyArr }));
  lsSet(KEYS.ACTIVE_WS_BOOK, bookId);
}

/**
 * Load a previously saved workspace session.
 * @param {string} bookId
 * @returns {{ html: string, history: Array }|null}
 */
export function loadWsSession(bookId) {
  try {
    const raw = lsGet(KEYS.WS_SESSION_PREFIX + bookId);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

// ── Recent items ───────────────────────────────────────────────────────────

/**
 * Load the recent-items array from localStorage.
 * @returns {Array}
 */
export function loadRecentItems() {
  try {
    return JSON.parse(lsGet(KEYS.RECENT) || 'null') || [];
  } catch (_) { return []; }
}

/**
 * Persist the recent-items array.  No-ops when history saving is disabled.
 * @param {Array} items
 */
export function saveRecentItems(items) {
  if (!isHistorySavingEnabled()) return;
  lsSet(KEYS.RECENT, JSON.stringify(items));
}

// ── Active-session pointers ────────────────────────────────────────────────

export const getActiveHomeSession  = ()       => lsGet(KEYS.ACTIVE_HOME_SESSION);
export const setActiveHomeSession  = (id)     => lsSet(KEYS.ACTIVE_HOME_SESSION, id);
export const clearActiveHomeSession = ()      => lsRemove(KEYS.ACTIVE_HOME_SESSION);

export const getActiveWsBook       = ()       => lsGet(KEYS.ACTIVE_WS_BOOK);
export const setActiveWsBook       = (bookId) => lsSet(KEYS.ACTIVE_WS_BOOK, bookId);
export const clearActiveWsBook     = ()       => lsRemove(KEYS.ACTIVE_WS_BOOK);

export const getActiveRecentId     = ()       => lsGet(KEYS.ACTIVE_RECENT_ID);
export const setActiveRecentId     = (id)     => {
  if (id) lsSet(KEYS.ACTIVE_RECENT_ID, id);
  else    lsRemove(KEYS.ACTIVE_RECENT_ID);
};
export const clearActiveRecentId   = ()       => lsRemove(KEYS.ACTIVE_RECENT_ID);

// ── Settings ───────────────────────────────────────────────────────────────

/**
 * Read a persisted settings value (stored under `chunks_setting_<key>`).
 * @param {string} key
 * @returns {string|null}
 */
export function getSetting(key) {
  return lsGet(KEYS.SETTING_PREFIX + key);
}

/**
 * Persist a settings value.
 * @param {string} key
 * @param {string} value
 */
export function setSetting(key, value) {
  lsSet(KEYS.SETTING_PREFIX + key, value);
}

/** @returns {'balanced'|string} */
export function getStudyMode() {
  return lsGet(KEYS.STUDY_MODE) || 'balanced';
}

/** @returns {boolean} */
export function isFollowupsEnabled() {
  return getSetting('followups') !== '0';
}

/** @returns {boolean} */
export function isAutoFlashEnabled() {
  return getSetting('auto-flash') === '1';
}

/** @returns {string|null} */
export function getChatFontSize() {
  return lsGet(KEYS.CHAT_FONT_SIZE);
}

/** @param {'small'|'medium'|'large'} size */
export function setChatFontSize(size) {
  lsSet(KEYS.CHAT_FONT_SIZE, size);
}

/** @returns {string|null} */
export function getDefaultBook() {
  return lsGet(KEYS.DEFAULT_BOOK);
}

/** @param {string} bookId */
export function setDefaultBook(bookId) {
  lsSet(KEYS.DEFAULT_BOOK, bookId);
}

/** @returns {string|null} Saved accent name (e.g. 'Emerald') */
export function getAccentName() {
  return getSetting('accent');
}

/** @returns {string|null} Saved accent hex color (e.g. '#10b981') */
export function getAccentColor() {
  return getSetting('accent_color');
}

/**
 * Persist the save-history toggle state.
 * @param {boolean} enabled
 */
export function setSaveHistory(enabled) {
  lsSet(KEYS.SAVE_HISTORY, enabled ? '1' : '0');
}

/** @returns {boolean} */
export function isSaveHistoryEnabled() {
  return lsGet(KEYS.SAVE_HISTORY) !== '0';
}

// ── sessionStorage navigation flags ───────────────────────────────────────

/** The screen that was active when the tab was last refreshed. */
export const getActiveScreen = ()        => ssGet(KEYS.SS_ACTIVE_SCREEN);
export const setActiveScreen = (name)    => ssSet(KEYS.SS_ACTIVE_SCREEN, name);

/** True if the user has visited at least once in this tab session. */
export const wasHere  = ()               => ssGet(KEYS.SS_WAS_HERE) === '1';
export const setWasHere = ()             => ssSet(KEYS.SS_WAS_HERE, '1');

/** True when a page refresh (not a fresh open) is in progress. */
export const getIsRefresh  = ()          => ssGet(KEYS.SS_IS_REFRESH) === '1';
export const setIsRefresh  = ()          => ssSet(KEYS.SS_IS_REFRESH, '1');
export const clearIsRefresh = ()         => ssRemove(KEYS.SS_IS_REFRESH);

/** Whether the library modal was open before the last refresh. */
export const isLibraryOpen  = ()         => ssGet(KEYS.SS_LIBRARY_OPEN) === '1';
export const setLibraryOpen = (open)     =>
  open ? ssSet(KEYS.SS_LIBRARY_OPEN, '1') : ssRemove(KEYS.SS_LIBRARY_OPEN);

// ── Legacy window globals (keep monolith working) ─────────────────────────
//
// Until Phase 5 these are still called from inline onclick= handlers and
// script blocks that haven't been migrated yet.  Do NOT remove until the
// corresponding screen module is wired in.

window._historySavingEnabled  = isHistorySavingEnabled;
window._saveSession           = saveHomeSession;
window._loadSession           = loadHomeSession;
window._saveWsSession         = saveWsSession;
window._loadWsSession         = loadWsSession;
window._saveRecent            = saveRecentItems; // called with no args in monolith — see note below
window._getStudyMode          = getStudyMode;
window._isFollowupsEnabled    = isFollowupsEnabled;
window._isAutoFlashEnabled    = isAutoFlashEnabled;

// NOTE: The monolith's _saveRecent() reads _recentItems from module-level state
// and passes nothing.  The exported saveRecentItems(items) requires the array.
// The window shim below bridges that gap until state/navigation.js (Task 15)
// owns _recentItems and calls saveRecentItems directly.
window._saveRecentCompat = function() {
  if (typeof window._recentItems !== 'undefined') {
    saveRecentItems(window._recentItems);
  }
};
