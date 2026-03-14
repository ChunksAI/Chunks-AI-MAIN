/**
 * src/components/UpgradeModal.js — Upgrade / Pricing Modal
 *
 * Owns all JavaScript for the #upgrade-modal element that already exists
 * in index.html. Wires up every previously-dead data-action on that modal.
 *
 * Functions exposed on window.*
 * ─────────────────────────────
 *   openUpgradeModal(opts?)   Open the modal. opts: { highlight: 'pro'|'ultra' }
 *   closeUpgradeModal()       Close the modal.
 *   handleUpgradeClick(el)    Called by "Get Pro →" / "Get Ultra →" buttons.
 *                             Reads el.dataset.plan ('pro' | 'ultra').
 *   upgradeModalBackdrop(e)   Backdrop click — closes only when clicking the
 *                             overlay itself, not the inner card.
 *   settingsUpgrade()         Shortcut used by the Settings → Account page.
 *
 * No external dependencies. Works with the existing modal HTML + CSS that
 * lives in index.html (`.upgrade-modal`, `.upgrade-content`, etc.).
 */

// ── Helpers ────────────────────────────────────────────────────────────────

let _focusRelease = null;

function _getModal() {
  return document.getElementById('upgrade-modal');
}

// ── Open ───────────────────────────────────────────────────────────────────

/**
 * Open the upgrade modal.
 * @param {object}  [opts]
 * @param {'pro'|'ultra'} [opts.highlight]  Pre-highlight a specific plan card.
 */
export function openUpgradeModal(opts = {}) {
  const modal = _getModal();
  if (!modal) return;

  modal.style.display = 'flex';
  // Tick needed so the transition fires after display:flex is painted
  requestAnimationFrame(() => modal.classList.add('open'));

  // Optionally highlight a plan
  if (opts.highlight) {
    modal.querySelectorAll('.upgrade-plan').forEach(card => {
      card.classList.toggle('featured', card.dataset.plan === opts.highlight);
    });
  }

  // Focus trap
  if (typeof window.trapFocus === 'function') {
    _focusRelease = window.trapFocus(modal);
  }

  // Close on Escape
  document.addEventListener('keydown', _onEscape);
}

// ── Close ──────────────────────────────────────────────────────────────────

export function closeUpgradeModal() {
  const modal = _getModal();
  if (!modal) return;

  modal.classList.remove('open');
  // Wait for the CSS fade-out before hiding
  const onEnd = () => {
    modal.style.display = '';
    modal.removeEventListener('transitionend', onEnd);
  };
  modal.addEventListener('transitionend', onEnd);

  if (typeof _focusRelease === 'function') { _focusRelease(); _focusRelease = null; }
  document.removeEventListener('keydown', _onEscape);
}

function _onEscape(e) {
  if (e.key === 'Escape') closeUpgradeModal();
}

// ── Backdrop click ─────────────────────────────────────────────────────────

/**
 * Fired when the user clicks the modal overlay (data-action="upgradeModalBackdrop").
 * Only closes if the click landed on the backdrop itself, not the inner card.
 */
export function upgradeModalBackdrop(e) {
  if (e && e.target === _getModal()) closeUpgradeModal();
}

// ── Upgrade button handler ─────────────────────────────────────────────────

/**
 * Called by "Get Pro →" and "Get Ultra →" buttons.
 * Reads data-plan="pro"|"ultra" from the clicked element.
 *
 * Currently shows a toast / coming-soon notice. Replace the body of
 * _startCheckout() with real payment logic (GCash, PayMongo, etc.) when ready.
 *
 * @param {HTMLElement} el
 */
export function handleUpgradeClick(el) {
  const plan = (el && el.dataset && el.dataset.plan) || 'pro';
  closeUpgradeModal();
  _startCheckout(plan);
}

function _startCheckout(plan) {
  const labels = { pro: 'Pro (₱149/mo)', ultra: 'Ultra (₱299/mo)' };
  const label  = labels[plan] || plan;

  // ── Swap this block for a real payment redirect ─────────────────────────
  //
  //   Example (PayMongo):
  //   window.location.href = `https://your-backend.up.railway.app/api/checkout?plan=${plan}`;
  //
  //   Example (GCash deep-link via PayMongo source):
  //   fetch('/api/create-source', { method:'POST', body: JSON.stringify({ plan }) })
  //     .then(r => r.json())
  //     .then(d => window.location.href = d.checkoutUrl);
  //
  // ── For now: friendly toast ─────────────────────────────────────────────
  if (typeof window._showToast === 'function') {
    window._showToast('⭐', `${label} — checkout coming soon!`, 'var(--gold-border)');
  } else if (typeof window.wsShowToast === 'function') {
    window.wsShowToast('⭐', `${label} — checkout coming soon!`, 'var(--gold-border)');
  } else {
    // Absolute fallback
    console.info(`[UpgradeModal] Plan selected: ${plan}`);
  }
}

// ── Settings page shortcut ─────────────────────────────────────────────────

/**
 * Called by the "Upgrade" button inside Settings → Account page
 * (data-action="settingsUpgrade").
 * Closes Settings first, then opens the upgrade modal.
 */
export function settingsUpgrade() {
  if (typeof window.closeSettings === 'function') window.closeSettings();
  // Small delay so Settings close animation finishes before modal opens
  setTimeout(() => openUpgradeModal(), 180);
}

// ── DOMContentLoaded bootstrap ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const modal = _getModal();
  if (!modal) return;

  // Ensure the modal starts hidden (in case CSS hasn't applied yet)
  if (!modal.style.display) modal.style.display = '';
});

// ── Window globals ─────────────────────────────────────────────────────────

window.openUpgradeModal      = openUpgradeModal;
window.closeUpgradeModal     = closeUpgradeModal;
window.handleUpgradeClick    = handleUpgradeClick;
window.upgradeModalBackdrop  = upgradeModalBackdrop;
window.settingsUpgrade       = settingsUpgrade;

console.log('[UpgradeModal] Module ready');
