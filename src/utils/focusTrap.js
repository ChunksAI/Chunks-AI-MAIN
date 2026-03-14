/**
 * src/utils/focusTrap.js — Focus trap utility
 *
 * Traps keyboard focus inside a modal or drawer while it is open,
 * then restores focus to the previously-focused element on release.
 * Supports nested modals via an internal stack.
 *
 * Usage
 * ─────
 *   import { trapFocus } from './utils/focusTrap.js';
 *
 *   // on open:
 *   const release = trapFocus(modalEl);
 *
 *   // on close:
 *   release();
 *
 * Task 14 — extracted from monolith (lines ~2259–2326).
 * Replaces the inline IIFE that set window.trapFocus.
 */

/** CSS selector matching all keyboard-focusable elements. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]:not([tabindex="-1"])',
  '[role="menuitem"]:not([tabindex="-1"])',
  '[role="option"]:not([tabindex="-1"])',
  '[role="tab"]:not([tabindex="-1"])',
].join(',');

/** Stack of active traps — allows nested modals to restore correctly. */
const _stack = [];

/**
 * Activate a focus trap on `modalEl`.
 *
 * - Immediately focuses the first focusable child (via rAF).
 * - Intercepts Tab / Shift-Tab to cycle within `modalEl`.
 * - Returns a `release()` function that removes the trap and
 *   restores focus to the element that was active before the trap.
 *
 * @param {HTMLElement} modalEl
 * @returns {() => void} release function
 */
export function trapFocus(modalEl) {
  const previouslyFocused = document.activeElement;

  /** Returns visible, enabled focusable descendants of modalEl. */
  const focusable = () =>
    Array.from(modalEl.querySelectorAll(FOCUSABLE)).filter(
      el => !el.closest('[hidden]') && getComputedStyle(el).display !== 'none'
    );

  // Focus first element on next frame (modal may still be animating in)
  requestAnimationFrame(() => {
    const first = focusable()[0];
    if (first) first.focus();
  });

  function onKeyDown(e) {
    if (e.key !== 'Tab') return;
    const els = focusable();
    if (!els.length) { e.preventDefault(); return; }
    const first = els[0];
    const last  = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !modalEl.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !modalEl.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  document.addEventListener('keydown', onKeyDown, true);
  _stack.push({ modal: modalEl, handler: onKeyDown, prev: previouslyFocused });

  return function release() {
    const idx = _stack.findIndex(s => s.modal === modalEl);
    if (idx === -1) return;
    const [{ handler, prev }] = _stack.splice(idx, 1);
    document.removeEventListener('keydown', handler, true);
    try { if (prev && prev.focus) prev.focus(); } catch (_) {}
  };
}

// Legacy global bridge — inline script blocks call window.trapFocus directly
window.trapFocus = trapFocus;
