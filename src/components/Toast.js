/**
 * src/components/Toast.js — Task 20
 *
 * Unified toast notification for all screens.
 *
 * Previously split across two implementations:
 *   • wsShowToast()  in workspaceState.js → used #ws-toast + CSS .show class
 *   • _showToast()   in index.html        → dynamically created its own element
 *
 * Now: one element (#ws-toast, already in HTML), one function, two window bridges.
 *
 * window bridges set here:
 *   window._showToast    — used by research / study-plan inline scripts
 *   window.wsShowToast   — re-exported from workspaceState.js (that module now
 *                          imports showToast from here, keeping its own name)
 */

// ── Timer ────────────────────────────────────────────────────────────────────

let _toastTimer = null;

// ── Core implementation ───────────────────────────────────────────────────────

/**
 * showToast(icon, text, color?)
 *
 * @param {string} icon   — emoji or symbol shown on the left
 * @param {string} text   — message body
 * @param {string} [color] — optional CSS colour for the border (e.g. 'var(--teal)')
 */
export function showToast(icon, text, color) {
  const t = document.getElementById('ws-toast');
  if (!t) return;

  t.innerHTML = `<span style="font-size:14px;">${icon}</span><span>${text}</span>`;
  t.style.borderColor = color || '';
  t.classList.add('show');

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    t.classList.remove('show');
    t.style.borderColor = '';
  }, 2500);
}

// ── Window bridges ────────────────────────────────────────────────────────────

window._showToast  = showToast;   // research / study-plan inline callers
window.wsShowToast = showToast;   // workspace inline callers (workspaceState re-imports)
