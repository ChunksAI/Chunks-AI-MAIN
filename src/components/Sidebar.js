/**
 * src/components/Sidebar.js — Sidebar component
 *
 * The monolith contains 6 identical (except for the active-item and
 * recent-list IDs) copies of the sidebar HTML — one per screen.
 * This module owns the single canonical template and can render any
 * variant from a config object.
 *
 * Usage (Phase 5 / Task 36)
 * ─────────────────────────
 *   import { renderSidebar, SIDEBAR_CONFIGS } from './components/Sidebar.js';
 *
 *   // Replace a static copy with the live component:
 *   const aside = document.querySelector('#screen-home .sidebar');
 *   aside.outerHTML = renderSidebar(SIDEBAR_CONFIGS.home);
 *
 * Exports
 * ───────
 *   SIDEBAR_CONFIGS   Pre-built config object for each screen
 *   renderSidebar(cfg) → HTML string  Full sidebar outer-HTML
 *   mountAllSidebars() Replace all 6 static copies in the document
 *                      (called by Task 36 once static HTML is removed)
 *
 * Config shape
 * ────────────
 *   {
 *     activeScreen:    'home'|'workspace'|'flash'|'research'|'exam'|'studyplan'
 *     recentGeneralId: string   id for the "General AI" recent list div
 *     recentWorkspaceId: string id for the "Workspace" recent list div
 *     extraSections?:  string   additional HTML inserted after recent lists
 *   }
 *
 * Task 19 — component extracted from duplicate sidebar HTML at monolith
 * lines 74, 349, 624, 820, 1243, 10884.
 * Static copies are NOT removed here — that is Task 36.
 */

// ── SVG constants ──────────────────────────────────────────────────────────

const LOGO_SVG = `
<svg class="logo-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <ellipse class="orbit" cx="50" cy="50" rx="40" ry="14" fill="none" stroke="url(#lg-gv)" stroke-width="7" opacity="0.95"/>
  <ellipse class="orbit" cx="50" cy="50" rx="40" ry="14" fill="none" stroke="url(#lg-vg)" stroke-width="7" transform="rotate(60 50 50)" opacity="0.88"/>
  <ellipse class="orbit" cx="50" cy="50" rx="40" ry="14" fill="none" stroke="url(#lg-gv)" stroke-width="7" transform="rotate(120 50 50)" opacity="0.80"/>
  <circle cx="50" cy="50" r="7" fill="#e8ac2e"/>
</svg>`.trim();

const PANEL_ICON = `
<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="1.5" y="1.5" width="17" height="17" rx="3.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="M7 1.5V18.5" stroke="currentColor" stroke-width="1.6"/>
</svg>`.trim();

// ── Nav item definitions ───────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    key: 'home',
    label: 'Home',
    action: 'goHome',
    screen: null,
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  },
  {
    key: 'workspace',
    label: 'Workspace',
    action: 'showScreen',
    screen: 'workspace',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
  },
  {
    key: 'library',
    label: 'Library',
    action: 'openLibraryModal',
    screen: null,
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`,
  },
  {
    key: 'flash',
    label: 'Flashcards',
    action: 'showScreen',
    screen: 'flash',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>`,
  },
  {
    key: 'studyplan',
    label: 'Study Plan',
    action: 'showScreen',
    screen: 'studyplan',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  },
  {
    key: 'research',
    label: 'Research',
    action: 'showScreen',
    screen: 'research',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12h6m-3-3v6"/><path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/><path d="M21 7H3l1.5 11A2 2 0 0 0 6.48 20h11.04a2 2 0 0 0 1.98-2L21 7z"/></svg>`,
  },
  {
    key: 'exam',
    label: 'Exam',
    action: 'showScreen',
    screen: 'exam',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  },
];

// ── Per-screen configs ─────────────────────────────────────────────────────

/**
 * Pre-built config for each of the 6 screen sidebars.
 * Pass one of these (or a custom object) to renderSidebar().
 */
export const SIDEBAR_CONFIGS = {
  home: {
    activeScreen:      'home',
    recentGeneralId:   'recent-list-general',
    recentWorkspaceId: 'recent-list-home',
  },
  workspace: {
    activeScreen:      'workspace',
    recentGeneralId:   'recent-list-general-ws',
    recentWorkspaceId: 'recent-list-workspace',
  },
  flash: {
    activeScreen:      'flash',
    recentGeneralId:   'recent-list-general-flash',
    recentWorkspaceId: 'recent-list-flash',
    extraSections: `
    <div class="sidebar-divider"></div>
    <div class="sidebar-section">
      <div class="sidebar-section-label sidebar-section-label-row">
        My Decks
        <span id="fc-deck-count" class="fc-deck-count-badge"></span>
      </div>
      <div id="fc-saved-decks-list" class="recent-list">
        <div class="recent-empty">No saved decks yet</div>
      </div>
    </div>`,
  },
  research: {
    activeScreen:      'research',
    recentGeneralId:   'recent-list-general-research',
    recentWorkspaceId: 'recent-list-ws-research',
  },
  exam: {
    activeScreen:      'exam',
    recentGeneralId:   'recent-list-general-exam',
    recentWorkspaceId: 'recent-list-ws-exam',
  },
  studyplan: {
    activeScreen:      'studyplan',
    recentGeneralId:   'recent-list-general-studyplan',
    recentWorkspaceId: 'recent-list-ws-studyplan',
  },
};

// ── renderSidebar ──────────────────────────────────────────────────────────

/**
 * Build the complete sidebar outer-HTML for a given screen config.
 *
 * @param {{
 *   activeScreen:      string,
 *   recentGeneralId:   string,
 *   recentWorkspaceId: string,
 *   extraSections?:    string
 * }} cfg
 * @returns {string} Full `<aside class="sidebar">…</aside>` HTML
 */
export function renderSidebar(cfg) {
  const { activeScreen, recentGeneralId, recentWorkspaceId, extraSections = '' } = cfg;

  const navItems = NAV_ITEMS.map(item => {
    const isActive = item.key === activeScreen;
    const isHome   = item.key === 'home';

    // Build data-attributes
    const dataAction = `data-action="${item.action}"`;
    const dataScreen = item.screen ? ` data-screen="${item.screen}"` : '';

    // Active styling
    const activeClass  = isActive ? ' active' : '';
    const ariaCurrent  = isActive && isHome ? ' aria-current="page"' : '';
    const homeId       = isHome ? ' id="sidebar-home-btn"' : '';

    // studyplan items need an explicit onclick for legacy reasons (data-action
    // delegation doesn't yet cover all call sites)
    const studyOnclick = item.screen === 'studyplan'
      ? ` onclick="showScreen('studyplan')"` : '';

    return `
      <div class="sidebar-item${activeClass}"${homeId} role="button" tabindex="0" aria-label="${item.label}"${ariaCurrent} ${dataAction}${dataScreen}${studyOnclick}>
        ${item.icon}
        <span>${item.label}</span>
      </div>`.trimStart();
  }).join('\n      ');

  return `
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo-link" data-action="handleLogoClick-self" title="Go to home / expand">
        ${LOGO_SVG}
        <span class="logo-text">Chunks</span>
        <div class="sidebar-expand-btn" title="Expand sidebar">
          ${PANEL_ICON}
        </div>
      </div>
      <button class="sidebar-collapse-btn" data-action="toggleSidebar-self" title="Collapse sidebar">
        ${PANEL_ICON}
      </button>
    </div>

    <button class="sidebar-new-btn" data-action="newChat" aria-label="New Chat">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>New Chat</span>
    </button>

    <nav aria-label="Main navigation">
      <div class="sidebar-section">
        <div class="sidebar-section-label">Study</div>
        ${navItems}
      </div>

      <div class="sidebar-divider"></div>

      <div class="sidebar-section">
        <div class="sidebar-section-label">General AI</div>
        <div id="${recentGeneralId}" class="recent-list"></div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-section-label">Workspace</div>
        <div id="${recentWorkspaceId}" class="recent-list"></div>
      </div>
    </nav>
    ${extraSections}
    <div class="sidebar-footer">
      <div class="profile-row" role="button" tabindex="0" aria-label="Open profile menu" aria-haspopup="true" data-action="toggleProfileDropdown">
        <div class="avatar" aria-hidden="true">A</div>
        <div class="profile-text">
          <div class="profile-name">Alex Cruz</div>
          <div class="profile-plan">Free Plan</div>
        </div>
        <svg class="profile-dots" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
      </div>
    </div>
  </aside>`.trimStart();
}

// ── mountAllSidebars ───────────────────────────────────────────────────────

/**
 * Replace every static sidebar `<aside>` in the document with a freshly
 * rendered version from this component.
 *
 * Must be called after DOMContentLoaded.  Each screen's sidebar is found
 * by its parent `#screen-<name>` element.
 *
 * This function is intentionally NOT called here — it is the job of Task 36
 * (Polish phase) to invoke it once the static HTML copies are removed.
 */
export function mountAllSidebars() {
  const screenMap = {
    'screen-home':      SIDEBAR_CONFIGS.home,
    'screen-workspace': SIDEBAR_CONFIGS.workspace,
    'screen-flash':     SIDEBAR_CONFIGS.flash,
    'screen-research':  SIDEBAR_CONFIGS.research,
    'screen-exam':      SIDEBAR_CONFIGS.exam,
    'screen-studyplan': SIDEBAR_CONFIGS.studyplan,
  };

  for (const [screenId, cfg] of Object.entries(screenMap)) {
    const screen = document.getElementById(screenId);
    if (!screen) continue;

    // If a static sidebar still exists (dev fallback), replace it
    const existing = screen.querySelector('.sidebar');
    if (existing) {
      existing.outerHTML = renderSidebar(cfg);
      continue;
    }

    // Task 36: static copies removed — insert as first child of the screen
    const tmp = document.createElement('div');
    tmp.innerHTML = renderSidebar(cfg);
    const aside = tmp.firstElementChild;
    screen.insertBefore(aside, screen.firstChild);
  }
}

// ── Window export ──────────────────────────────────────────────────────────
// Expose for any future inline usage or debugging.
window.renderSidebar    = renderSidebar;
window.mountAllSidebars = mountAllSidebars;
window.SIDEBAR_CONFIGS  = SIDEBAR_CONFIGS;
