/**
 * src/components/ConfirmModal.js — Task 21 (Preact migration)
 *
 * Backward-compatible wrapper around the Preact `<ConfirmModalIsland>`.
 * Every existing caller — `showConfirmModal(opts)`, `closeConfirmModal()`,
 * `showSimpleNotif(text)` — continues to work unchanged.
 *
 * Migration note:
 *   The UI is now rendered declaratively by Preact in ConfirmModal.jsx.
 *   This file mounts the Preact island into a dedicated container appended
 *   to <body> and delegates imperative calls to the component's handle.
 */

import { mountIsland } from '../preact/bridge.js';
import { ConfirmModalIsland } from './ConfirmModal.jsx';

// ── Mount Preact island ──────────────────────────────────────────────────────

let _handle = null;

function _mount() {
  if (_handle) return;

  // Remove any leftover vanilla-JS elements from a previous life
  document.getElementById('confirm-modal')?.remove();
  document.getElementById('simple-notif')?.remove();

  // Create a dedicated Preact root — the component renders both elements inside
  const root = document.createElement('div');
  root.setAttribute('data-preact-root', 'confirm-modal');
  document.body.appendChild(root);

  _handle = mountIsland(ConfirmModalIsland, root);
}

// Mount as soon as the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _mount, { once: true });
} else {
  _mount();
}

// ── Public API (unchanged) ───────────────────────────────────────────────────

/**
 * Show the confirm modal.
 * @param {{ title?: string, desc?: string, confirmLabel?: string, onConfirm?: Function }} opts
 */
export function showConfirmModal(opts = {}) {
  if (!_handle) _mount();
  _handle?.show?.(opts);
}

/** Close the confirm modal. */
export function closeConfirmModal() {
  _handle?.close?.();
}

/**
 * Show a simple pill notification for ~3 s.
 * @param {string} text
 */
export function showSimpleNotif(text) {
  if (!_handle) _mount();
  _handle?.notify?.(text);
}

