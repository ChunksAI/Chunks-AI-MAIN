/**
 * src/components/StorageErrorBanner.js — Persistent storage error banner
 *
 * Shows a dismissible banner at the top of the app when:
 *  • localStorage or IndexedDB hits a quota / out-of-space error
 *  • The localStorage → IndexedDB data migration fails
 *
 * Only one banner is shown at a time.  Dismissing sets a sessionStorage
 * flag so the same category of error doesn't reappear until the next
 * session.
 *
 * API
 * ───
 *  showStorageError(kind)    — display the banner for the given error kind
 *  dismissStorageError()     — close the banner (also used by the ✕ button)
 */

// ── Error kind definitions ───────────────────────────────────────────────────

const ERRORS = {
  quota: {
    icon: '⚠',
    title: 'Storage is full',
    body:  'Some data may not be saved. Try clearing old chat sessions or documents in Settings → Data.',
  },
  migration: {
    icon: '⚠',
    title: 'Data migration incomplete',
    body:  'Some data could not be moved to faster storage and may only be available temporarily. Your data is still safe.',
  },
  'out-of-space': {
    icon: '⚠',
    title: 'Device storage is low',
    body:  'There isn\u2019t enough space to save new data. Free up space on your device or clear old sessions in Settings.',
  },
};

// ── State ────────────────────────────────────────────────────────────────────

const SS_DISMISSED_PREFIX = 'chunks_storage_err_dismissed_';

/** @type {string | null} current error kind shown */
let _activeKind = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function _isDismissed(kind) {
  try { return sessionStorage.getItem(SS_DISMISSED_PREFIX + kind) === '1'; }
  catch (_) { return false; }
}

function _setDismissed(kind) {
  try { sessionStorage.setItem(SS_DISMISSED_PREFIX + kind, '1'); }
  catch (_) { /* ignore */ }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Show the storage-error banner for a specific error kind.
 * If the user already dismissed this kind during the current session, the
 * call is silently ignored.
 *
 * @param {'quota' | 'migration' | 'out-of-space'} kind
 */
export function showStorageError(kind) {
  const def = ERRORS[kind];
  if (!def) return;
  if (_isDismissed(kind)) return;

  // If a banner is already showing, don't replace it
  if (_activeKind) {
    console.warn('[StorageErrorBanner] "%s" suppressed — "%s" already visible', kind, _activeKind);
    return;
  }
  _activeKind = kind;

  let el = document.getElementById('storage-error-banner');

  if (!el) {
    el = document.createElement('div');
    el.id = 'storage-error-banner';
    el.setAttribute('role', 'alert');
    // Insert at the very start of <body> so it sits above everything
    document.body.prepend(el);
  }

  el.innerHTML =
    `<div class="seb-inner">` +
      `<span class="seb-icon">${def.icon}</span>` +
      `<div class="seb-text">` +
        `<strong>${def.title}</strong> ` +
        `<span>${def.body}</span>` +
      `</div>` +
      `<button class="seb-close" aria-label="Dismiss" onclick="dismissStorageError()">✕</button>` +
    `</div>`;
  el.classList.add('seb-show');
}

/**
 * Dismiss the currently visible storage-error banner.
 * Marks the error kind as dismissed for this session.
 */
export function dismissStorageError() {
  const el = document.getElementById('storage-error-banner');
  if (el) {
    el.classList.remove('seb-show');
  }
  if (_activeKind) {
    _setDismissed(_activeKind);
    _activeKind = null;
  }
}

// ── Utility for storage modules ──────────────────────────────────────────────

/**
 * Returns true if the error looks like a storage-quota / out-of-space error.
 * Works for both localStorage (QuotaExceededError) and IndexedDB (DOMException
 * with name "QuotaExceededError" or code 22).
 *
 * @param {*} err
 * @returns {boolean}
 */
export function isQuotaError(err) {
  if (!err) return false;
  if (err.name === 'QuotaExceededError') return true;
  // Older browsers throw a generic DOMException with code 22
  if (err instanceof DOMException && err.code === 22) return true;
  // Safari private browsing
  if (err.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  return false;
}
