// @ts-nocheck
/**
 * src/components/UpgradeModal.js — Upgrade/pricing modal
 * Injects the upgrade modal HTML into the page and provides open/close/upgrade functions.
 */

// ── HTML injection ────────────────────────────────────────────────────────────
(function _injectUpgradeModal() {
  document.body.insertAdjacentHTML('beforeend', `
<div class="upgrade-modal" id="upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title" data-action="closeUpgradeModal-backdrop">
  <div class="upgrade-content">

    <div class="upgrade-header">
      <div class="upgrade-header-text">
        <div class="upgrade-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Upgrade your plan
        </div>
        <div class="upgrade-title" id="upgrade-modal-title">Study smarter, no limits.</div>
        <div class="upgrade-subtitle">Unlock unlimited AI messages, exam prep, research tools, and more.</div>
      </div>
      <button class="upgrade-close" data-action="closeUpgradeModal" aria-label="Close">✕</button>
    </div>

    <div class="upgrade-plans">

      <!-- Free -->
      <div class="upgrade-plan">
        <div>
          <div class="up-plan-name">Free</div>
          <div class="up-plan-price">
            <span class="amount">$0</span>
            <span class="period">/ mo</span>
          </div>
        </div>
        <div class="up-features">
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            25 AI messages / day
          </div>
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            10 flashcard sets / month
          </div>
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            5 study plans / month
          </div>
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            3 workspaces
          </div>
          <div class="up-feature" style="color:var(--text-3);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Exam prep &amp; research
          </div>
        </div>
        <button class="up-plan-btn" data-action="closeUpgradeModal">Current plan</button>
      </div>

      <!-- Pro (featured) -->
      <div class="upgrade-plan featured">
        <div>
          <div class="up-plan-name" style="color:var(--gold)">Pro</div>
          <div class="up-plan-price">
            <span class="amount">$12</span>
            <span class="period">/ mo</span>
          </div>
        </div>
        <div class="up-features">
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Unlimited AI messages
          </div>
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Unlimited flashcards &amp; study plans
          </div>
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Full Exam Prep suite
          </div>
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Research Assistant
          </div>
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Unlimited workspaces
          </div>
        </div>
        <button class="up-plan-btn primary" data-action="handleUpgradeClick" data-plan="pro">Get Pro →</button>
      </div>

      <!-- Ultra -->
      <div class="upgrade-plan" style="border-color:rgba(139,124,248,0.25);background:linear-gradient(160deg,rgba(139,124,248,0.06) 0%,var(--surface-2) 60%);position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--violet),transparent);"></div>
        <div>
          <div class="up-plan-name" style="color:var(--violet)">Ultra</div>
          <div class="up-plan-price">
            <span class="amount">$29</span>
            <span class="period">/ mo</span>
          </div>
        </div>
        <div class="up-features">
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Everything in Pro
          </div>
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Priority AI models
          </div>
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Unlimited file uploads
          </div>
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Early access to new features
          </div>
          <div class="up-feature">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Priority support
          </div>
        </div>
        <button class="up-plan-btn ultra" style="border-color:rgba(139,124,248,0.3);color:var(--violet);" data-action="handleUpgradeClick" data-plan="ultra">Get Ultra →</button>
      </div>

    </div>

    <div class="upgrade-footer">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      Secure checkout · Cancel anytime · No hidden fees
    </div>

  </div>
</div>`);
})();

// ── Logic ─────────────────────────────────────────────────────────────────────

function openUpgradeModal() {
  document.getElementById('upgrade-modal')?.classList.add('active');
  // On mobile, scroll the featured (Pro) card into view
  if (window.innerWidth <= 600) {
    requestAnimationFrame(() => {
      const featured = document.querySelector('.upgrade-plan.featured');
      featured?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }
}

function closeUpgradeModal() {
  document.getElementById('upgrade-modal')?.classList.remove('active');
}

function handleUpgradeClick(plan) {
  if (!window._currentUser) {
    closeUpgradeModal();
    window.openAuthModal?.();
    return;
  }
  // Payment integration not yet available — show feedback and keep modal open
  const safePlan = (typeof plan === 'string' && plan) ? plan : 'plan';
  const label = safePlan.charAt(0).toUpperCase() + safePlan.slice(1);
  if (typeof wsShowToast === 'function') {
    wsShowToast('📬', `Thanks for your interest in ${label}! Subscriptions are coming soon.`, 'var(--gold)');
  }
}

window.openUpgradeModal   = openUpgradeModal;
window.closeUpgradeModal  = closeUpgradeModal;
window.handleUpgradeClick = handleUpgradeClick;
