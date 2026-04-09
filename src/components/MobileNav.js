// @ts-nocheck
/**
 * src/components/MobileNav.js — Mobile navigation
 * Injects the mobile drawer and bottom navigation bar into the page.
 */

// ── HTML injection ────────────────────────────────────────────────────────────
(function _injectMobileNav() {
  document.body.insertAdjacentHTML('beforeend', `
<div class="mobile-drawer-overlay" id="mobile-drawer-overlay" data-action="closeMobileDrawer"></div>

<div class="mobile-drawer" id="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu">

  <!-- Header -->
  <div class="md-header">
    <div class="md-logo-row">
      <svg width="26" height="26" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="overflow:hidden;display:block;flex-shrink:0;">
        <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/>
        <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/>
        <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/>
        <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
      </svg>
      <span class="md-logo-text">Chunks</span>
    </div>
    <button type="button" class="md-close" data-action="closeMobileDrawer" aria-label="Close menu">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>

  <!-- Study nav -->
  <div class="md-section">
    <div class="md-section-label">Study</div>
    <div class="md-item active" id="md-item-home" data-action="drawerNav" data-screen="workspace">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      Study
    </div>
    <div class="md-item" id="md-item-workspace" data-action="drawerNav" data-screen="workspace" style="display:none;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      Workspace
    </div>
    <div class="md-item" id="md-item-library" data-action="drawerNav" data-screen="library">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
      Library
    </div>
    <div class="md-item" id="md-item-flash" data-action="drawerNav" data-screen="flash">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
      Flashcards
    </div>
    <div class="md-item" id="md-item-exam" data-action="drawerNav" data-screen="exam">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      Exam
    </div>
    <div class="md-item" id="md-item-studyplan" data-action="drawerNav" data-screen="studyplan">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      Study Plan
    </div>
    <div class="md-item" id="md-item-visual" data-action="drawerNav" data-screen="visual">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 21h8m-4-4v4"/></svg>
      Visual Tutor
    </div>
    <div class="md-item" id="md-item-research" data-action="drawerNav" data-screen="research">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6m-3-3v6"/><path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/><path d="M21 7H3l1.5 11A2 2 0 0 0 6.48 20h11.04a2 2 0 0 0 1.98-2L21 7z"/></svg>
      Research
    </div>
  </div>

  <div class="md-divider"></div>

  <!-- Recent chats (populated by JS) -->
  <div class="md-section">
    <div class="md-section-label">Recent Chats</div>
    <div id="md-recent-list">
      <div class="md-recent-item" style="color:var(--text-4);font-style:italic;font-size:12px;padding:8px 10px;">No recent chats</div>
    </div>
  </div>

  <!-- Footer / profile -->
  <div class="md-footer">
    <div class="md-profile">
      <div class="md-avatar"></div>
      <div>
        <div class="md-profile-name"></div>
        <div class="md-profile-plan"></div>
      </div>
      <div class="md-upgrade" data-action="drawerUpgrade" style="cursor:pointer;">Upgrade</div>
    </div>
  </div>

</div>`);

  document.body.insertAdjacentHTML('beforeend', `
<nav class="mobile-bottom-nav" id="mobile-bottom-nav" role="navigation" aria-label="Main navigation">

  <button type="button" class="mobile-nav-item active" id="mnav-home" data-action="mobileNav-self" data-screen="workspace">
    <div class="mobile-nav-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    </div>
    <span class="mobile-nav-label">Study</span>
  </button>

  <button type="button" class="mobile-nav-item" id="mnav-workspace" data-action="mobileNav-self" data-screen="workspace" style="display:none;">
    <div class="mobile-nav-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
    </div>
    <span class="mobile-nav-label">Workspace</span>
  </button>

  <button type="button" class="mobile-nav-item" id="mnav-flash" data-action="mobileNav-self" data-screen="flash">
    <div class="mobile-nav-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8m-4-4v4"/>
      </svg>
    </div>
    <span class="mobile-nav-label">Cards</span>
  </button>

  <button type="button" class="mobile-nav-item" id="mnav-exam" data-action="mobileNav-self" data-screen="exam">
    <div class="mobile-nav-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    </div>
    <span class="mobile-nav-label">Exam</span>
  </button>

  <button type="button" class="mobile-nav-item" id="mnav-more" data-action="mobileNav-self" data-screen="more">
    <div class="mobile-nav-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </div>
    <span class="mobile-nav-label">More</span>
  </button>

  <div class="mobile-home-indicator"></div>
</nav>`);
})();
