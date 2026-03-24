/**
 * src/components/Toast.js — Task 20 (Preact migration)
 *
 * Backward-compatible wrapper around the Preact `<ToastIsland>` component.
 * Every existing `import { showToast } from './Toast.js'` continues to work
 * unchanged — the public API is identical.
 *
 * Migration note:
 *   The actual UI is now rendered declaratively by Preact in Toast.jsx.
 *   This file mounts the Preact island into `#ws-toast` at import time
 *   and delegates `showToast()` calls to the component's imperative handle.
 */

import { mountIsland } from '../preact/bridge.js';
import { ToastIsland } from './Toast.jsx';

// ── Mount Preact island ──────────────────────────────────────────────────────

let _handle = null;

function _mount() {
  const el = document.getElementById('ws-toast');
  if (!el || _handle) return;
  _handle = mountIsland(ToastIsland, el);
}

// Mount as soon as the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _mount, { once: true });
} else {
  _mount();
}

// ── Public API (unchanged) ───────────────────────────────────────────────────

/**
 * showToast(icon, text, color?)
 *
 * @param {string} icon   — emoji or symbol shown on the left
 * @param {string} text   — message body
 * @param {string} [color] — optional CSS colour for the border (e.g. 'var(--teal)')
 */
export function showToast(icon, text, color) {
  if (!_handle) _mount();          // lazy mount if called before DOMContentLoaded
  if (_handle?.show) {
    _handle.show(icon, text, color);
  }
}

