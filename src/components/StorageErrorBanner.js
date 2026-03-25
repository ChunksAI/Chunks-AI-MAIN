/**
 * src/components/StorageErrorBanner.js — Preact migration wrapper
 *
 * Backward-compatible wrapper around the Preact `<StorageErrorBannerIsland>`.
 * All existing callers — `showStorageError(kind)`, `dismissStorageError()`,
 * `isQuotaError(err)` — continue to work unchanged.
 *
 * Migration note:
 *   The UI is now rendered declaratively by Preact in StorageErrorBanner.jsx.
 *   This file mounts the Preact island into a dedicated container prepended
 *   to <body> and delegates imperative calls to the component's handle.
 */

import { mountIsland } from '../preact/bridge.js';
import { StorageErrorBannerIsland } from './StorageErrorBanner.jsx';

// ── Mount Preact island ──────────────────────────────────────────────────────

let _handle = null;

function _mount() {
  if (_handle) return;

  // Remove any leftover vanilla-JS element
  document.getElementById('storage-error-banner')?.remove();

  // Create a dedicated Preact root at the very top of <body>
  const root = document.createElement('div');
  root.setAttribute('data-preact-root', 'storage-error-banner');
  document.body.prepend(root);

  _handle = mountIsland(StorageErrorBannerIsland, root);
}

// Mount as soon as the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _mount, { once: true });
} else {
  _mount();
}

// ── Public API (unchanged) ───────────────────────────────────────────────────

/**
 * Show the storage-error banner for a specific error kind.
 * If the user already dismissed this kind during the current session, the
 * call is silently ignored.
 *
 * @param {'quota' | 'near-quota' | 'migration' | 'out-of-space'} kind
 */
export function showStorageError(kind) {
  if (!_handle) _mount();
  _handle?.show?.(kind);
}

/**
 * Dismiss the currently visible storage-error banner.
 * Marks the error kind as dismissed for this session.
 */
export function dismissStorageError() {
  _handle?.dismiss?.();
}

// ── Utility for storage modules (pure function — unchanged) ──────────────────

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

