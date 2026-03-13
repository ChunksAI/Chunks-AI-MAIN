/**
 * src/components/Toast.js — Toast notification component
 *
 * The monolith has two separate toast implementations:
 *
 *   wsShowToast(icon, text, color)
 *     — used by workspace, settings, shortcuts, flashcard screens
 *     — targets the static `#ws-toast` element already in the DOM
 *
 *   _showToast(icon, text, color)
 *     — used by the research / exam / writing screens
 *     — lazily creates its own fixed-position element on first call
 *
 * This module provides a single canonical `showToast(icon, text, color)`
 * and re-exports it as both legacy names so every existing call site keeps
 * working unchanged.
 *
 * Exports
 * ───────
 *   showToast(icon, text, color)  Unified toast — prefers #ws-toast if
 *                                 present, otherwise creates a floating one.
 *
 * window globals set
 * ──────────────────
 *   window.showToast    canonical name
 *   window.wsShowToast  legacy alias (workspace + settings callers)
 *   window._showToast   legacy alias (research / exam / writing callers)
 *
 * Task 20 — extracted from monolith:
 *   wsShowToast  → line 3570
 *   _showToast   → line 9232
 *
 * NOTE: The static `<div id="ws-toast"></div>` in index.html is NOT removed
 * here — it is the anchor element used by showToast when available, and
 * removing it would require updating the CSS that styles it. It will be
 * cleaned up as part of Task 37 (build clean pass) or Task 38 (smoke test).
 */

// ── Internal state ─────────────────────────────────────────────────────────

/** Lazily-created floating element used when #ws-toast is absent. */
let _floatingEl = null;

/** Active auto-hide timer handle. */
let _timer = null;

// ── showToast ──────────────────────────────────────────────────────────────

/**
 * Display a brief notification toast.
 *
 * Prefers the static `#ws-toast` element (styled via sidebar.css / base.css).
 * If that element is not in the DOM (e.g. on a screen that doesn't include it)
 * it falls back to a lazily-created fixed-position element — identical
 * behaviour to the old _showToast.
 *
 * @param {string} icon   Emoji or short glyph shown on the left
 * @param {string} text   Message text
 * @param {string} [color] Optional CSS border-color override (e.g. '#f87171',
 *                         'var(--gold-border)').  Pass '' or omit to reset.
 */
export function showToast(icon, text, color = '') {
  const staticEl = document.getElementById('ws-toast');

  if (staticEl) {
    // ── Static element path (workspace + most screens) ──
    staticEl.innerHTML = `<span style="font-size:14px;">${icon}</span><span>${text}</span>`;
    staticEl.style.borderColor = color || '';
    staticEl.classList.add('show');
    clearTimeout(_timer);
    _timer = setTimeout(() => staticEl.classList.remove('show'), 2400);
  } else {
    // ── Floating element path (research / exam / writing screens) ──
    if (!_floatingEl) {
      _floatingEl = document.createElement('div');
      _floatingEl.style.cssText = [
        'position:fixed',
        'bottom:24px',
        'left:50%',
        'transform:translateX(-50%) translateY(8px)',
        'background:var(--surface-3)',
        'border:1px solid var(--border-md)',
        'border-radius:var(--r-pill)',
        'padding:8px 16px',
        'font-size:12px',
        'color:var(--text-1)',
        'display:flex',
        'align-items:center',
        'gap:8px',
        'z-index:9997',
        'opacity:0',
        'transition:opacity 0.2s,transform 0.2s',
        'font-family:var(--font-body)',
        'box-shadow:0 4px 24px rgba(0,0,0,0.5)',
      ].join(';');
      document.body.appendChild(_floatingEl);
    }
    _floatingEl.innerHTML = `<span style="font-size:14px;">${icon}</span><span>${text}</span>`;
    _floatingEl.style.borderColor = color || '';
    _floatingEl.style.opacity     = '1';
    _floatingEl.style.transform   = 'translateX(-50%) translateY(0)';
    clearTimeout(_timer);
    _timer = setTimeout(() => {
      _floatingEl.style.opacity   = '0';
      _floatingEl.style.transform = 'translateX(-50%) translateY(8px)';
    }, 2600);
  }
}

// ── Legacy window globals ──────────────────────────────────────────────────

window.showToast   = showToast;
window.wsShowToast = showToast;   // workspace, settings, flashcard callers
window._showToast  = showToast;   // research, exam, writing callers
