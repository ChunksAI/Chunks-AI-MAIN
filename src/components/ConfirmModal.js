/**
 * src/components/ConfirmModal.js — Task 21
 *
 * Replaces the confirm modal stub in public/shared.js with a real
 * implementation, and owns the #simple-notif pill element.
 *
 * Previously:
 *   • shared.js stub  → window.confirm() fallback
 *   • index.html      → #simple-notif <style>/<div>/<script> block
 *                        + thin wrappers showConfirmModal / closeConfirmModal
 *
 * window bridges set here:
 *   window._showSharedConfirm   — called by showConfirmModal() in index.html
 *   window._closeSharedConfirm  — called by closeConfirmModal() in index.html
 *   window.showConfirmModal     — convenience alias (used by inline scripts)
 *   window.closeConfirmModal    — convenience alias
 *   window.showSimpleNotif      — simple pill notification (used by settings)
 *
 * opts shape for showConfirmModal:
 *   { title, desc, confirmLabel, onConfirm }
 */

// ── Inject HTML ───────────────────────────────────────────────────────────────

function _injectHTML() {
  if (document.getElementById('confirm-modal')) return; // already present

  const el = document.createElement('div');
  el.id = 'confirm-modal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="confirm-box">
      <p class="confirm-title" id="confirm-title"></p>
      <p class="confirm-desc"  id="confirm-desc"></p>
      <div class="confirm-actions">
        <button class="confirm-cancel-btn" id="confirm-cancel-btn">Cancel</button>
        <button class="confirm-ok-btn"     id="confirm-ok-btn">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  // backdrop click → close
  el.addEventListener('click', e => {
    if (e.target === el) closeConfirmModal();
  });

  // inject simple-notif pill (used by settings screen)
  if (!document.getElementById('simple-notif')) {
    const notif = document.createElement('div');
    notif.id = 'simple-notif';
    document.body.appendChild(notif);
  }
}

// ── State ─────────────────────────────────────────────────────────────────────

let _pendingConfirm = null;

// ── Core implementation ───────────────────────────────────────────────────────

export function showConfirmModal(opts = {}) {
  _injectHTML();

  const modal   = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-title');
  const descEl  = document.getElementById('confirm-desc');
  const okBtn   = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');

  if (!modal) return;

  titleEl.textContent = opts.title        || 'Are you sure?';
  descEl.textContent  = opts.desc         || '';
  okBtn.textContent   = opts.confirmLabel || 'Confirm';

  _pendingConfirm = typeof opts.onConfirm === 'function' ? opts.onConfirm : null;

  // wire buttons (replace to remove old listeners)
  const newOk     = okBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  okBtn.replaceWith(newOk);
  cancelBtn.replaceWith(newCancel);

  newOk.textContent = opts.confirmLabel || 'Confirm';
  newOk.addEventListener('click', () => {
    const cb = _pendingConfirm;   // capture BEFORE closeConfirmModal nulls it
    closeConfirmModal();
    if (typeof cb === 'function') cb();
  });
  newCancel.addEventListener('click', closeConfirmModal);

  modal.classList.add('active');

  // Focus Cancel by default, allow arrow keys to switch between buttons
  newCancel.focus();

  const handleArrows = (e) => {
    if (!modal.classList.contains('active')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      newOk.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      newCancel.focus();
    } else if (e.key === 'Enter') {
      // Let focused button handle it naturally
    }
  };
  modal.addEventListener('keydown', handleArrows);
  // Clean up listener when modal closes
  const origClose = closeConfirmModal;
  newOk._arrowCleanup = newCancel._arrowCleanup = () => modal.removeEventListener('keydown', handleArrows);
}

export function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  if (modal) {
    modal.classList.remove('active');
    // Clean up arrow key listener if present
    const okBtn = document.getElementById('confirm-ok-btn');
    if (okBtn?._arrowCleanup) { okBtn._arrowCleanup(); okBtn._arrowCleanup = null; }
  }
  _pendingConfirm = null;
}

// ── Simple notif pill ─────────────────────────────────────────────────────────

let _notifTimer = null;

export function showSimpleNotif(text) {
  _injectHTML();
  const el = document.getElementById('simple-notif');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(_notifTimer);
  _notifTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Keyboard: Escape closes ───────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('confirm-modal');
    if (modal?.classList.contains('active')) closeConfirmModal();
  }
});

// ── Window bridges ────────────────────────────────────────────────────────────

window._showSharedConfirm  = showConfirmModal;
window._closeSharedConfirm = closeConfirmModal;
window.showConfirmModal    = showConfirmModal;
window.closeConfirmModal   = closeConfirmModal;
window.showSimpleNotif     = showSimpleNotif;
