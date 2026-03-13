/**
 * src/components/ConfirmModal.js — Confirm Modal component
 *
 * Provides a styled, accessible confirmation dialog that replaces the
 * native `window.confirm()` fallback used by the shared.js stub.
 *
 * The modal is created once (lazily on first call) and reused for every
 * subsequent invocation by updating its content.
 *
 * Usage (via existing public API — no call sites need to change)
 * ──────────────────────────────────────────────────────────────
 *   showConfirmModal({
 *     title:        'Delete this chat?',
 *     desc:         'This cannot be undone.',
 *     confirmLabel: 'Delete',     // optional — default 'Confirm'
 *     cancelLabel:  'Cancel',     // optional — default 'Cancel'
 *     onConfirm:    () => { … },  // called on confirm button click
 *     onCancel:     () => { … },  // optional — called on cancel / Esc
 *   });
 *
 *   closeConfirmModal();  // close programmatically
 *
 * Exports
 * ───────
 *   showConfirmModal(opts)   Show the modal with given options
 *   closeConfirmModal()      Close without firing any callback
 *
 * window globals set
 * ──────────────────
 *   window.showConfirmModal   public API (replaces stub + monolith wrapper)
 *   window.closeConfirmModal  public API
 *   window._showSharedConfirm   internal alias (shared.js / legacy)
 *   window._closeSharedConfirm  internal alias (shared.js / legacy)
 *
 * Task 21 — replaces:
 *   - native confirm fallback in public/shared.js  (lines 21–28)
 *   - showConfirmModal / closeConfirmModal wrappers → monolith line 6353–6354
 */

// ── Modal DOM element (created once) ──────────────────────────────────────

let _modalEl    = null;
let _focusRelease = null;

function _ensureModal() {
  if (_modalEl) return;

  _modalEl = document.createElement('div');
  _modalEl.id = 'confirm-modal';
  _modalEl.setAttribute('role', 'dialog');
  _modalEl.setAttribute('aria-modal', 'true');
  _modalEl.setAttribute('aria-labelledby', 'confirm-modal-title');
  _modalEl.style.cssText = [
    'display:none',
    'position:fixed',
    'inset:0',
    'z-index:10000',
    'align-items:center',
    'justify-content:center',
    'background:rgba(0,0,0,0.55)',
    'backdrop-filter:blur(3px)',
    '-webkit-backdrop-filter:blur(3px)',
  ].join(';');

  _modalEl.innerHTML = `
    <div class="confirm-modal-box" style="
      background:var(--surface-2);
      border:1px solid var(--border-sm);
      border-radius:var(--r-lg,12px);
      padding:24px 28px 20px;
      min-width:320px;
      max-width:440px;
      width:90%;
      box-shadow:0 8px 40px rgba(0,0,0,0.55);
      display:flex;
      flex-direction:column;
      gap:10px;
      animation:fadeUp 0.18s ease;
    ">
      <h3 id="confirm-modal-title" style="
        margin:0;
        font-family:var(--font-head);
        font-size:15px;
        font-weight:700;
        color:var(--text-1);
        line-height:1.35;
      "></h3>
      <p id="confirm-modal-desc" style="
        margin:0;
        font-size:13px;
        color:var(--text-3);
        line-height:1.55;
      "></p>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
        <button id="confirm-modal-cancel" style="
          padding:7px 16px;
          font-size:12px;
          font-family:var(--font-body);
          background:var(--surface-3);
          border:1px solid var(--border-sm);
          border-radius:var(--r-md,8px);
          color:var(--text-2);
          cursor:pointer;
          transition:background 0.15s;
        ">Cancel</button>
        <button id="confirm-modal-confirm" style="
          padding:7px 16px;
          font-size:12px;
          font-family:var(--font-body);
          background:var(--red,#f87171);
          border:1px solid transparent;
          border-radius:var(--r-md,8px);
          color:#fff;
          cursor:pointer;
          font-weight:600;
          transition:opacity 0.15s;
        ">Confirm</button>
      </div>
    </div>
  `.trim();

  // Inject keyframe if not already present
  if (!document.getElementById('confirm-modal-style')) {
    const style = document.createElement('style');
    style.id = 'confirm-modal-style';
    style.textContent = `
      @keyframes fadeUp {
        from { opacity:0; transform:translateY(6px); }
        to   { opacity:1; transform:translateY(0); }
      }
      #confirm-modal-cancel:hover  { background:var(--surface-4,#2a2a2a); }
      #confirm-modal-confirm:hover { opacity:0.85; }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(_modalEl);

  // Close on backdrop click
  _modalEl.addEventListener('click', e => {
    if (e.target === _modalEl) closeConfirmModal();
  });
}

// ── showConfirmModal ───────────────────────────────────────────────────────

/**
 * @param {{
 *   title:         string,
 *   desc?:         string,
 *   confirmLabel?: string,
 *   cancelLabel?:  string,
 *   onConfirm?:    () => void,
 *   onCancel?:     () => void,
 * }} opts
 */
export function showConfirmModal(opts = {}) {
  _ensureModal();

  const {
    title        = 'Are you sure?',
    desc         = '',
    confirmLabel = 'Confirm',
    cancelLabel  = 'Cancel',
    onConfirm,
    onCancel,
  } = opts;

  // Update content
  document.getElementById('confirm-modal-title').textContent  = title;
  document.getElementById('confirm-modal-desc').textContent   = desc;
  document.getElementById('confirm-modal-confirm').textContent = confirmLabel;
  document.getElementById('confirm-modal-cancel').textContent  = cancelLabel;

  // Wire buttons (replace to remove stale listeners)
  const confirmBtn = document.getElementById('confirm-modal-confirm');
  const cancelBtn  = document.getElementById('confirm-modal-cancel');

  const newConfirm = confirmBtn.cloneNode(true);
  const newCancel  = cancelBtn.cloneNode(true);
  confirmBtn.replaceWith(newConfirm);
  cancelBtn.replaceWith(newCancel);

  newConfirm.textContent = confirmLabel;
  newCancel.textContent  = cancelLabel;

  newConfirm.addEventListener('click', () => {
    closeConfirmModal();
    if (typeof onConfirm === 'function') onConfirm();
  });
  newCancel.addEventListener('click', () => {
    closeConfirmModal();
    if (typeof onCancel === 'function') onCancel();
  });

  // Show
  _modalEl.style.display = 'flex';

  // Trap focus
  if (typeof window.trapFocus === 'function') {
    _focusRelease = window.trapFocus(_modalEl);
  }

  // Esc to close
  const onKeyDown = e => {
    if (e.key === 'Escape') {
      closeConfirmModal();
      if (typeof onCancel === 'function') onCancel();
      document.removeEventListener('keydown', onKeyDown, true);
    }
  };
  document.addEventListener('keydown', onKeyDown, true);
  // Store so closeConfirmModal can remove it
  _modalEl._escHandler = onKeyDown;
}

// ── closeConfirmModal ──────────────────────────────────────────────────────

/** Close the modal without firing any callback. */
export function closeConfirmModal() {
  if (!_modalEl) return;
  _modalEl.style.display = 'none';
  if (_focusRelease) { _focusRelease(); _focusRelease = null; }
  if (_modalEl._escHandler) {
    document.removeEventListener('keydown', _modalEl._escHandler, true);
    _modalEl._escHandler = null;
  }
}

// ── Window globals ─────────────────────────────────────────────────────────

window.showConfirmModal    = showConfirmModal;
window.closeConfirmModal   = closeConfirmModal;
// Replace the stubs in shared.js — these are what the monolith calls internally
window._showSharedConfirm  = showConfirmModal;
window._closeSharedConfirm = closeConfirmModal;
