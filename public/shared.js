/**
 * public/shared.js — STUB for Task 2 baseline
 *
 * The original project loads this file for Supabase Auth + the shared
 * confirm modal. It will be replaced by src/lib/auth.js in Task 32.
 *
 * For now this stub:
 *  - Prevents a 404 that would otherwise surface in the console
 *  - Registers the two globals the inline code depends on as no-ops
 *    so closeConfirmModal() / showConfirmModal() don't throw
 */
(function () {
  'use strict';

  // Guard: don't double-register if a real shared.js is later swapped in
  if (window._sharedStubLoaded) return;
  window._sharedStubLoaded = true;

  // Confirm modal no-ops — real impl provided by Task 21 (ConfirmModal component)
  if (!window._showSharedConfirm) {
    window._showSharedConfirm = function (opts) {
      // Fallback: native confirm so the action isn't silently swallowed
      const ok = window.confirm(
        (opts && opts.message) ? opts.message : 'Are you sure?'
      );
      if (ok && opts && typeof opts.onConfirm === 'function') opts.onConfirm();
    };
  }

  if (!window._closeSharedConfirm) {
    window._closeSharedConfirm = function () {};
  }

  console.log('[shared.js] stub loaded — replace with src/lib/auth.js in Task 32');
})();
