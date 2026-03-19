/**
 * src/components/Sidebar.js — Sidebar component
 *
 * Replaces 6 identical (modulo active-item + list IDs) sidebar copies
 * with a single JS template. Injects rendered HTML into every
 * <aside class="sidebar" data-sidebar-screen="SCREEN"> placeholder.
 *
 * Per-screen differences
 * ──────────────────────
 *  active nav item   → determined by data-sidebar-screen attribute
 *  recent list IDs   → suffixed per-screen so _renderAllRecent() works
 *  studyplan extra   → sp-recent-plans-section / sp-recent-plans-list
 *
 * Task 19 — replaces 6 copies (home, workspace, flash, research, exam,
 * studyplan) with this single component.
 */

// ── SVG constants ──────────────────────────────────────────────────────────

// Gradient IDs must be unique per sidebar instance — if multiple sidebars
// share the same ID, browsers resolve url(#id) against the first definition
// found in the DOM, making every other screen's logo render as a bare dot.
const _logoSvg = (screen) => {
  return `
  <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/>
  <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/>
  <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/>
  <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>`;
};

const PANEL_ICON = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="1.5" y="1.5" width="17" height="17" rx="3.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="M7 1.5V18.5" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

const DOTS_SVG = `<svg class="profile-dots" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-3);margin-left:auto;flex-shrink:0;"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`;

// ── Nav items config ───────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    id:     'home',
    label:  'Home',
    action: 'goHome',
    svg:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    extra:  '',
  },
  {
    id:     'workspace',
    label:  'Workspace',
    action: 'showScreen',
    screen: 'workspace',
    svg:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
  },
  {
    id:     'library',
    label:  'Library',
    action: 'showScreen',
    screen: 'library',
    svg:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`,
  },
  {
    id:     'flash',
    label:  'Flashcards',
    action: 'showScreen',
    screen: 'flash',
    svg:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>`,
  },
  {
    id:     'studyplan',
    label:  'Study Plan',
    action: 'showScreen',
    screen: 'studyplan',
    onclick: `onclick="showScreen('studyplan')"`,
    svg:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  },
  {
    id:     'visual',
    label:  'Visual Tutor',
    action: 'showScreen',
    screen: 'visual',
    svg:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 21h8m-4-4v4"/></svg>`,
  },
  {
    id:     'research',
    label:  'Research',
    action: 'showScreen',
    screen: 'research',
    svg:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12h6m-3-3v6"/><path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/><path d="M21 7H3l1.5 11A2 2 0 0 0 6.48 20h11.04a2 2 0 0 0 1.98-2L21 7z"/></svg>`,
  },
  {
    id:     'exam',
    label:  'Exam',
    action: 'showScreen',
    screen: 'exam',
    svg:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  },
];

// ── Recent list ID map ─────────────────────────────────────────────────────

const RECENT_IDS = {
  home:      { general: 'recent-list-general',           workspace: 'recent-list-home',          visual: 'recent-list-vt-home',          exam: 'recent-list-exam-home' },
  workspace: { general: 'recent-list-general-ws',        workspace: 'recent-list-workspace',      visual: 'recent-list-vt-ws',            exam: 'recent-list-exam-ws' },
  library:   { general: 'recent-list-general-lib',       workspace: 'recent-list-ws-lib',         visual: 'recent-list-vt-lib',           exam: 'recent-list-exam-lib' },
  flash:     { general: 'recent-list-general-flash',     workspace: 'recent-list-flash',          visual: 'recent-list-vt-flash',         exam: 'recent-list-exam-flash' },
  research:  { general: 'recent-list-general-research',  workspace: 'recent-list-ws-research',    visual: 'recent-list-vt-research',      exam: 'recent-list-exam-research' },
  exam:      { general: 'recent-list-general-exam',      workspace: 'recent-list-ws-exam',        visual: 'recent-list-vt-exam',          exam: 'recent-list-exam-exam' },
  studyplan: { general: 'recent-list-general-studyplan', workspace: 'recent-list-ws-studyplan',   visual: 'recent-list-vt-studyplan',     exam: 'recent-list-exam-studyplan' },
  visual:    { general: 'recent-list-general-visual',    workspace: 'recent-list-ws-visual',      visual: 'recent-list-vt-visual',        exam: 'recent-list-exam-visual' },
};

// ── Component builder ──────────────────────────────────────────────────────

/**
 * Build the sidebar HTML string for a given screen.
 *
 * @param {string} screen — 'home' | 'workspace' | 'flash' | 'research' | 'exam' | 'studyplan'
 * @returns {string} innerHTML to set on the <aside> element
 */
export function buildSidebar(screen) {
  const ids = RECENT_IDS[screen] || RECENT_IDS.home;

  // Nav items
  const navHTML = NAV_ITEMS.map(item => {
    const isActive = item.id === screen || (item.id === 'home' && screen === 'home');
    const activeAttr     = isActive ? ' active' : '';
    const ariaCurrent    = isActive ? ' aria-current="page"' : '';
    const dataAction     = item.action === 'goHome'
      ? `data-action="goHome"`
      : item.action === 'openLibraryModal'
        ? `data-action="openLibraryModal"`
        : `data-action="showScreen" data-screen="${item.screen}"`;
    const onclickExtra   = item.onclick || '';
    const onkeydown      = item.action === 'goHome'
      ? `onkeydown="if(event.key==='Enter'||event.key===' ')goHome()"`
      : item.action === 'openLibraryModal'
        ? `onkeydown="if(event.key==='Enter'||event.key===' ')openLibraryModal()"`
        : `onkeydown="if(event.key==='Enter'||event.key===' ')showScreen('${item.screen}')"`;
    const idAttr = (item.id === 'home' && screen === 'home') ? ' id="sidebar-home-btn"' : '';

    return `      <div class="sidebar-item${activeAttr}"${idAttr} role="button" tabindex="0" aria-label="${item.label}"${ariaCurrent} ${dataAction} ${onclickExtra} ${onkeydown} style="cursor:pointer;">
        ${item.svg}
        <span>${item.label}</span>
      </div>`;
  }).join('\n');

  // Recent Plans section — shown on ALL screens, inside the scroll area
  const plansSectionId = `sp-recent-plans-section-${screen}`;
  const plansListId    = `sp-recent-plans-list-${screen}`;
  const recentPlansSection = `
      <div class="sidebar-section sidebar-history-section sp-recent-plans-outer" id="${plansSectionId}" style="display:none;">
        <div class="sidebar-section-label sidebar-section-toggle" data-action="toggleRecentPlans-self" data-section="${plansSectionId}">
          Recent Plans
          <svg class="hist-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div id="${plansListId}" class="sp-recent-plans-list hist-list"></div>
      </div>`;

  return `
    <div class="sidebar-header">
      <div class="logo-link" data-action="handleLogoClick-self" title="Go to home / expand">
        <svg class="logo-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${_logoSvg(screen)}
        </svg>
        <span class="logo-text">Chunks</span>
        <div class="sidebar-expand-btn" title="Expand sidebar">${PANEL_ICON}</div>
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
${navHTML}
    </div>
    </nav>

    <div class="sidebar-divider"></div>

    <div class="sidebar-history-scroll">
      <div class="sidebar-section sidebar-history-section" id="hist-section-general">
        <div class="sidebar-section-label sidebar-section-toggle" data-action="toggleHistorySection-self" data-section="hist-section-general">
          General AI
          <svg class="hist-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div id="${ids.general}" class="recent-list hist-list"></div>
      </div>
      <div class="sidebar-section sidebar-history-section" id="hist-section-workspace">
        <div class="sidebar-section-label sidebar-section-toggle" data-action="toggleHistorySection-self" data-section="hist-section-workspace">
          Workspace
          <svg class="hist-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div id="${ids.workspace}" class="recent-list hist-list"></div>
      </div>
      <div class="sidebar-section sidebar-history-section" id="hist-section-visual">
        <div class="sidebar-section-label sidebar-section-toggle" data-action="toggleHistorySection-self" data-section="hist-section-visual">
          Visual Tutor Chats
          <svg class="hist-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div id="${ids.visual}" class="recent-list hist-list"></div>
      </div>
      <div class="sidebar-section sidebar-history-section" id="hist-section-exam">
        <div class="sidebar-section-label sidebar-section-toggle" data-action="toggleHistorySection-self" data-section="hist-section-exam">
          Exam Chats
          <svg class="hist-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div id="${ids.exam}" class="recent-list hist-list"></div>
      </div>
      ${recentPlansSection}
    </div>

    <div class="sidebar-footer">
      <div class="profile-row" role="button" tabindex="0" aria-label="Open profile menu" aria-haspopup="true" onclick="toggleProfileDropdown(event)" onkeydown="if(event.key==='Enter'||event.key===' ')toggleProfileDropdown(event)">
        <div class="avatar" aria-hidden="true"></div>
        <div class="profile-text">
          <div class="profile-name"></div>
          <div class="profile-plan"></div>
        </div>
        ${DOTS_SVG}
      </div>
    </div>`;
}

// ── Mount ──────────────────────────────────────────────────────────────────

/**
 * Inject sidebar HTML into every placeholder element.
 * Placeholders: <aside class="sidebar" data-sidebar-screen="SCREEN"></aside>
 *
 * Call once on DOMContentLoaded (done automatically below).
 */
export function mountSidebars() {
  document.querySelectorAll('aside.sidebar[data-sidebar-screen]').forEach(el => {
    const screen = el.dataset.sidebarScreen || 'home';
    el.innerHTML = buildSidebar(screen);
  });
  // Restore persisted collapsed state for each history section
  ['hist-section-general','hist-section-workspace','hist-section-visual','hist-section-exam'].forEach(id => {
    try {
      const collapsed = sessionStorage.getItem('hist_collapsed_' + id) === '1';
      if (collapsed) {
        document.querySelectorAll('#' + id).forEach(sec => sec.classList.add('collapsed'));
      }
    } catch(e) {}
  });
  // Restore collapsed state for recent plans sections
  document.querySelectorAll('.sp-recent-plans-outer').forEach(sec => {
    try {
      const key = 'sp_plans_collapsed_' + sec.id;
      if (sessionStorage.getItem(key) === '1') sec.classList.add('collapsed');
    } catch(e) {}
  });

  // Populate all recent-plans sections from localStorage
  _renderRecentPlansAllSidebars();
}

/** Render recent plans into every sidebar's recent-plans list */
export function _renderRecentPlansAllSidebars() {
  let plans = [];
  try { plans = JSON.parse(localStorage.getItem('sp_recent_plans') || '[]'); } catch(_) {}

  let allPlans = {};
  try { allPlans = JSON.parse(localStorage.getItem('sp_all_plans') || '{}'); } catch(_) {}

  document.querySelectorAll('.sp-recent-plans-outer').forEach(section => {
    const listEl = section.querySelector('.sp-recent-plans-list');
    if (!listEl) return;
    if (!plans || plans.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';

    listEl.innerHTML = plans.map(topic => {
      const entry = Object.entries(allPlans).find(([, e]) => e.topic === topic);
      const planId = entry ? entry[0] : '';
      const safeTopic = topic.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      return `
        <div class="sidebar-item sp-plan-sidebar-item" role="button" tabindex="0"
             aria-label="${safeTopic}"
             data-action="spNavigateToPlan-self"
             data-plan-id="${planId}"
             data-plan-topic="${safeTopic}"
             title="${safeTopic}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;opacity:0.55;"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px;">${topic}</span>
          <span class="sp-plan-menu-btn recent-menu-btn"
                data-action="spPlanCtxMenu-self"
                data-plan-id="${planId}"
                data-plan-topic="${safeTopic}"
                title="More options">···</span>
        </div>`;
    }).join('');
  });
}

// Auto-mount
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    mountSidebars();
    window._renderAllRecent?.();
    _renderRecentPlansAllSidebars();
  });
} else {
  mountSidebars();
  window._renderAllRecent?.();
  _renderRecentPlansAllSidebars();
}

// Safety net: if screens mount asynchronously (e.g. code-split chunks),
// re-run mountSidebars on the next tick so any <aside> elements that
// weren't in the DOM yet get populated.
setTimeout(() => {
  const unmounted = document.querySelectorAll('aside.sidebar[data-sidebar-screen]:empty');
  if (unmounted.length) {
    mountSidebars();
    window._renderAllRecent?.();
    _renderRecentPlansAllSidebars();
  }
}, 0);

// Legacy global
window.buildSidebar  = buildSidebar;
window.mountSidebars = mountSidebars;
window._renderRecentPlansAllSidebars = _renderRecentPlansAllSidebars;
