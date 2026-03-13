/**
 * src/utils/focusTrap.js — Keyboard focus trap utility
 *
 * Keeps Tab / Shift+Tab cycling inside a modal element so keyboard and
 * assistive-technology users can't accidentally escape into the background.
 * Supports nested modals via an internal stack — each release() restores
 * focus to whichever element opened that particular layer.
 *
 * Usage
 * ─────
 *   import { trapFocus } from './utils/focusTrap.js';
 *
 *   // On modal open:
 *   const release = trapFocus(modalEl);
 *
 *   // On modal close:
 *   release();
 *
 * Exports
 * ───────
 *   trapFocus(modalEl) → release()   Trap focus inside modalEl; returns a
 *                                    cleanup function that removes the trap
 *                                    and restores prior focus.
 *
 * Task 14 — extracted from monolith lines 2263–2327 (inline IIFE that set
 * window.trapFocus directly).
 */

// ── Focusable element selector ─────────────────────────────────────────────

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

// ── Internal stack (supports nested modals) ────────────────────────────────

const _stack = [];

// ── trapFocus ──────────────────────────────────────────────────────────────

/**
 * Trap keyboard focus inside `modalEl`.
 * Tab and Shift+Tab will cycle only through focusable descendants.
 * Focus is moved to the first focusable child immediately (via rAF).
 *
 * @param   {HTMLElement} modalEl  The modal / drawer / overlay element.
 * @returns {() => void}           Call this function to release the trap and
 *                                 restore focus to the previously active element.
 */
export function trapFocus(modalEl) {
  const previouslyFocused = document.activeElement;

  // Live query — respects dynamic content changes inside the modal
  const focusable = () =>
    Array.from(modalEl.querySelectorAll(FOCUSABLE))
      .filter(el => !el.closest('[hidden]') && getComputedStyle(el).display !== 'none');

  // Move focus into the modal on the next paint so CSS transitions don't
  // interfere with the element being ready to receive focus.
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
      // Shift+Tab: wrap from first → last
      if (document.activeElement === first || !modalEl.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: wrap from last → first
      if (document.activeElement === last || !modalEl.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  document.addEventListener('keydown', onKeyDown, true);
  _stack.push({ modal: modalEl, handler: onKeyDown, prev: previouslyFocused });

  /** Release this trap and restore prior focus. */
  return function release() {
    const idx = _stack.findIndex(s => s.modal === modalEl);
    if (idx === -1) return;
    const [{ handler, prev }] = _stack.splice(idx, 1);
    document.removeEventListener('keydown', handler, true);
    // Restore focus to whatever triggered this modal layer
    try { if (prev && prev.focus) prev.focus(); } catch (_) {}
  };
}

// ── Legacy global ──────────────────────────────────────────────────────────
// Keep window.trapFocus alive so all existing call sites in the monolith
// (openLibraryModal, openSettings, openShortcuts, openHelp, bug report,
// study-plan explain drawer) continue to work without changes.

window.trapFocus = trapFocus;
