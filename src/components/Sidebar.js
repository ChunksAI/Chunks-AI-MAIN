// @ts-nocheck
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
    svg:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  },
  {
    id:     'research',
    label:  'Research',
    action: 'showScreen',
    screen: 'research',
    svg:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12h6m-3-3v6"/><path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/><path d="M21 7H3l1.5 11A2 2 0 0 0 6.48 20h11.04a2 2 0 0 0 1.98-2L21 7z"/></svg>`,
  },
  {
    id:     'visual',
    label:  'Visual Tutor',
    action: 'showScreen',
    screen: 'visual',
    svg:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 21h8m-4-4v4"/></svg>`,
    isPower: true,
    badge: 'AI',
    badgeClass: 'power-badge-ai',
  },
  {
    id:     'exam',
    label:  'Exam Mode',
    action: 'showScreen',
    screen: 'exam',
    svg:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    isPower: true,
    badge: 'Pro',
    badgeClass: 'power-badge-pro',
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

  // Build item HTML helper
  function _itemHtml(item) {
    const isActive = item.id === screen || (item.id === 'home' && screen === 'home');
    const activeAttr   = isActive ? ' active' : '';
    const ariaCurrent  = isActive ? ' aria-current="page"' : '';
    const dataAction   = item.action === 'goHome'
      ? `data-action="goHome"`
      : item.action === 'openLibraryModal'
        ? `data-action="openLibraryModal"`
        : `data-action="showScreen" data-screen="${item.screen}"`;
    const onclickExtra = item.onclick || '';
    const onkeydown    = item.action === 'goHome'
      ? `onkeydown="if(event.key==='Enter'||event.key===' ')goHome()"`
      : item.action === 'openLibraryModal'
        ? `onkeydown="if(event.key==='Enter'||event.key===' ')openLibraryModal()"`
        : `onkeydown="if(event.key==='Enter'||event.key===' ')showScreen('${item.screen}')"`;
    const idAttr = (item.id === 'home' && screen === 'home') ? ' id="sidebar-home-btn"' : '';
    const badgeHtml = item.badge
      ? `<span class="power-badge ${item.badgeClass}">${item.badge}</span>`
      : '';
    const powerClass = item.isPower ? ` sidebar-item-power sidebar-item-${item.id}` : '';
    return `      <div class="sidebar-item${activeAttr}${powerClass}"${idAttr} role="button" tabindex="0" aria-label="${item.label}"${ariaCurrent} ${dataAction} ${onclickExtra} ${onkeydown} style="cursor:pointer;">
        ${item.svg}
        <span>${item.label}</span>
        ${badgeHtml}
      </div>`;
  }

  // All nav items in display order (research before visual/exam per spec)
  const allNavHTML = NAV_ITEMS.map(_itemHtml).join('\n');

  // Hidden legacy containers — kept for backward compat with _renderAllRecent() in appBridge.js
  const plansSectionId = `sp-recent-plans-section-${screen}`;
  const plansListId    = `sp-recent-plans-list-${screen}`;

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

    <nav aria-label="Main navigation" class="sidebar-nav-flat">
${allNavHTML}
    </nav>

    <div class="sidebar-divider"></div>

    <div class="sidebar-history-header">
      <span class="sidebar-history-label">Recents</span>
      <button class="sidebar-search-btn" data-action="openChatSearch-self" title="Search chats" aria-label="Search chats">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </button>
    </div>

    <div class="sidebar-history-scroll" id="sidebar-history-scroll">
      <!-- Unified recents: top 8, sorted by last used, with type icons -->
      <div id="sidebar-unified-recents-${screen}" class="sidebar-unified-recents-list"></div>

      <!-- Hidden legacy containers for appBridge.js _renderAllRecent() backward compat -->
      <div style="display:none;" aria-hidden="true">
        <div class="sidebar-history-section" id="sidebar-recent-chats-section-${screen}">
          <div id="sidebar-recent-chats-${screen}" class="sidebar-recent-chats-list hist-list"></div>
        </div>
        <div class="sidebar-history-section" id="sidebar-recent-workspace-section-${screen}">
          <div id="sidebar-recent-workspace-${screen}" class="sidebar-recent-workspace-list sidebar-doc-groups hist-list"></div>
        </div>
        <div class="sidebar-section sidebar-history-section sp-recent-plans-outer" id="${plansSectionId}">
          <div id="${plansListId}" class="sp-recent-plans-list hist-list"></div>
        </div>
      </div>
    </div>

    <div class="sidebar-footer">

      <!-- Guest upsell card (visible for guests, hidden for logged-in users) -->
      <div class="guest-upsell-card" id="guest-upsell-card">
        <!-- Compact mode: icon-only button -->
        <button class="guest-icon-btn" onclick="window.openAuthModal?.()" title="Sign in to your account" aria-label="Sign in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </button>
        <!-- Expanded mode: full upsell card -->
        <div class="guest-upsell-title">Get responses tailored to you</div>
        <div class="guest-upsell-desc">Log in to get answers based on saved chats, plus create images and upload files.</div>
        <div class="guest-auth-btns">
          <button class="guest-login-btn" onclick="window.openAuthModal?.()">Log in</button>
          <button class="guest-signup-btn" onclick="window.openAuthModal?.()">Sign up for free</button>
        </div>
      </div>

      <!-- Study streak widget (shown for logged-in users) -->
      <div class="sidebar-streak-widget" id="sidebar-streak-widget" style="display:none;">
        <span class="streak-fire-icon">🔥</span>
        <div class="streak-info">
          <div class="streak-title">Study streak — <span class="streak-days">0</span>d</div>
          <div class="streak-sub">Keep it going!</div>
        </div>
      </div>

      <!-- Logged-in profile row (shown for authenticated users) -->
      <div class="sidebar-profile-area">
        <div class="profile-row" role="button" tabindex="0" aria-label="Open profile menu" aria-haspopup="true" onclick="toggleProfileDropdown(event)" onkeydown="if(event.key==='Enter'||event.key===' ')toggleProfileDropdown(event)">
          <div class="avatar" aria-hidden="true"></div>
          <div class="profile-text">
            <div class="profile-name"></div>
            <div class="profile-plan"></div>
          </div>
          ${DOTS_SVG}
        </div>
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
// Active plan ID — tracks which plan is currently loaded, survives refresh
let _activePlanId = (function() {
  try { return localStorage.getItem('sp_active_plan_id') || null; } catch(e) { return null; }
})();

/** Set the active plan and update all sidebar highlights */
export function setActivePlan(planId) {
  _activePlanId = planId || null;
  try {
    if (_activePlanId) localStorage.setItem('sp_active_plan_id', _activePlanId);
    else localStorage.removeItem('sp_active_plan_id');
  } catch(e) {}
  // Update active class on all plan items across all sidebars
  document.querySelectorAll('.sp-plan-sidebar-item').forEach(el => {
    el.classList.toggle('active', !!_activePlanId && el.dataset.planId === _activePlanId);
  });
}

export function mountSidebars() {
  document.querySelectorAll('aside.sidebar[data-sidebar-screen]').forEach(el => {
    const screen = el.dataset.sidebarScreen || 'home';
    el.innerHTML = buildSidebar(screen);
  });

  // Re-render recent chat/workspace lists now that sidebar DOM containers exist
  window._renderAllRecent?.();

  // Populate unified recents in the new sidebar
  _renderUnifiedRecentsAllSidebars();

  // Populate all recent-plans sections from localStorage (keeps hidden compat containers fresh)
  _renderRecentPlansAllSidebars();
}

/** Render the unified "Recents" list in every sidebar (top 8, type icons) */
export function _renderUnifiedRecentsAllSidebars() {
  const UNIFIED_MAX = 8;

  // ── Gather recent chat/workspace items ──────────────────────────────────
  const recentItems = Array.isArray(window._getRecentItems?.()) ? window._getRecentItems() : [];

  // ── Gather recent plan items ─────────────────────────────────────────────
  let planTopics = [];
  try { planTopics = JSON.parse(localStorage.getItem('sp_recent_plans') || '[]'); } catch (_) {}

  let allPlans = {};
  try {
    allPlans = window._lsGet
      ? window._lsGet('sp_all_plans', {})
      : JSON.parse(localStorage.getItem('sp_all_plans') || '{}');
  } catch (_) {}

  const _lsActivePlanId = (() => { try { return localStorage.getItem('sp_active_plan_id') || null; } catch (e) { return null; } })();

  // Build combined list: chat/workspace items have updatedAt (ISO string);
  // plan items use an approximate timestamp (index-based offset from epoch start).
  const combined = [];

  recentItems.forEach(item => {
    combined.push({
      type:      item.source === 'workspace' ? 'workspace' : 'chat',
      item,
      sortKey:   item.updatedAt || '1970-01-01',
    });
  });

  planTopics.forEach((topic, idx) => {
    const entry  = Object.entries(allPlans).find(([, e]) => e.topic === topic);
    const planId = entry ? entry[0] : '';
    // Plans don't have timestamps in their array entry; use index-based old date
    // so they are placed after recent chat/workspace items of similar age.
    const planUpdatedAt = entry?.[1]?.updatedAt || `1970-01-0${String(idx + 1).padStart(2, '0')}`;
    combined.push({
      type:      'plan',
      topic,
      planId,
      planUpdatedAt,
      sortKey:   planUpdatedAt,
    });
  });

  // Sort newest first (ISO strings sort lexicographically correctly)
  combined.sort((a, b) => (b.sortKey > a.sortKey ? 1 : b.sortKey < a.sortKey ? -1 : 0));

  const top = combined.slice(0, UNIFIED_MAX);

  // ── Render into each unified list container ──────────────────────────────
  document.querySelectorAll('.sidebar-unified-recents-list').forEach(container => {
    if (top.length === 0) {
      container.innerHTML = '<div class="recent-empty">No history yet</div>';
      return;
    }

    container.innerHTML = '';

    top.forEach(entry => {
      if (entry.type === 'plan') {
        const { topic, planId } = entry;
        const isActive = _lsActivePlanId && planId && planId === _lsActivePlanId;
        const safeTopic = topic.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/'/g, '&#39;');
        const el = document.createElement('div');
        el.className = 'recent-item' + (isActive ? ' active' : '');
        el.title = topic;
        // Use data-action for navigation (same as existing plan sidebar items)
        el.dataset.action    = 'spNavigateToPlan-self';
        el.dataset.planId    = planId;
        el.dataset.planTopic = safeTopic;
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.innerHTML = `<span class="recent-type-icon">📅</span><span class="recent-title">${topic.replace(/</g, '&lt;')}</span><span class="recent-menu-btn sp-plan-menu-btn" data-action="spPlanCtxMenu-self" data-plan-id="${planId}" data-plan-topic="${safeTopic}" title="More options">···</span>`;
        container.appendChild(el);

      } else {
        // Chat or workspace item — use _buildRecentItem if available, else inline
        const item = entry.item;
        const icon = entry.type === 'workspace' ? '📄' : '💬';

        if (typeof window._buildRecentItem === 'function') {
          const el = window._buildRecentItem(item);
          // Prepend the type icon
          const iconSpan = document.createElement('span');
          iconSpan.className = 'recent-type-icon';
          iconSpan.textContent = icon;
          el.insertBefore(iconSpan, el.firstChild);
          container.appendChild(el);
        } else {
          // Fallback inline render
          const el = document.createElement('div');
          el.className = 'recent-item';
          el.dataset.id = item.id;
          el.title = item.question || '';
          el.innerHTML = `<span class="recent-type-icon">${icon}</span><span class="recent-title">${(item.pinned ? '📌 ' : '') + (item.label || '').replace(/</g, '&lt;')}</span><span class="recent-menu-btn" title="More options">···</span>`;
          el.addEventListener('click', () => window._clickRecent?.(item));
          el.querySelector('.recent-menu-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            window._showRecentCtxMenu?.(item, e);
          });
          container.appendChild(el);
        }
      }
    });
  });
}
window._renderUnifiedRecents = _renderUnifiedRecentsAllSidebars;

/** Render recent plans into every sidebar's recent-plans list */
export function _renderRecentPlansAllSidebars() {
  let plans = [];
  try { plans = JSON.parse(localStorage.getItem('sp_recent_plans') || '[]'); } catch(_) {}

  let allPlans = {};
  // sp_all_plans lives in IndexedDB — use the window._lsGet bridge (set by
  // globals.js) which routes IDB keys through the in-memory cache, or fall
  // back to raw localStorage for backward compat during early boot.
  try {
    allPlans = window._lsGet
      ? window._lsGet('sp_all_plans', {})
      : JSON.parse(localStorage.getItem('sp_all_plans') || '{}');
  } catch(_) {}

  document.querySelectorAll('.sp-recent-plans-outer').forEach(section => {
    const listEl = section.querySelector('.sp-recent-plans-list');
    if (!listEl) return;

    // Always show the section - display empty state when no plans
    section.style.display = '';

    if (!plans || plans.length === 0) {
      listEl.innerHTML = `<div class="recent-empty" style="padding:4px 16px 6px;font-size:11px;color:var(--text-4);">No plans yet</div>`;
      return;
    }

    // Always read active plan ID from localStorage — ground truth that all
    // callers (spSwitchToPlan, setActivePlan) write to. The in-memory
    // _activePlanId can drift if setActivePlan is called with a stale value
    // between the click and the re-render, so localStorage wins.
    const _lsActivePlanId = (() => { try { return localStorage.getItem('sp_active_plan_id') || null; } catch(e) { return null; } })();
    const _currentActivePlanId = _lsActivePlanId || _activePlanId;

    listEl.innerHTML = plans.map(topic => {
      const entry = Object.entries(allPlans).find(([, e]) => e.topic === topic);
      const planId = entry ? entry[0] : '';
      const safeTopic = topic.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const isActive = _currentActivePlanId && planId && planId === _currentActivePlanId;
      return `
        <div class="sidebar-item sp-plan-sidebar-item${isActive ? ' active' : ''}" role="button" tabindex="0"
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
    _renderUnifiedRecentsAllSidebars();
    _renderRecentPlansAllSidebars();
    _renderSidebarStreak();
    _syncThemeToggleBtns();
  });
} else {
  mountSidebars();
  window._renderAllRecent?.();
  _renderUnifiedRecentsAllSidebars();
  _renderRecentPlansAllSidebars();
  _renderSidebarStreak();
  _syncThemeToggleBtns();
}

/** Render the study streak widget in all sidebars */
export function _renderSidebarStreak() {
  try {
    // Use the storage bridge (lsGet handles JSON parsing + IDB routing)
    const streak = window._lsGet
      ? window._lsGet('chunks_fc_streak_v1', null)
      : (() => { try { const r = localStorage.getItem('chunks_fc_streak_v1'); return r ? JSON.parse(r) : null; } catch (_) { return null; } })();
    const count = streak?.current || 0;
    document.querySelectorAll('#sidebar-streak-widget').forEach(el => {
      const daysEl = el.querySelector('.streak-days');
      if (daysEl) daysEl.textContent = count;
      // Only show if user has any streak history or non-zero streak
      if (count > 0) el.style.display = '';
    });
  } catch (_) {}
}

export function _syncThemeToggleBtns() {
  const isStudy = document.documentElement.getAttribute('data-theme') === 'study';
  document.querySelectorAll('#theme-toggle-btn').forEach(btn => {
    if (typeof window._updateThemeBtn === 'function') window._updateThemeBtn(btn, isStudy);
    else btn.innerHTML = isStudy
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Switch to Dark'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Study Mode';
  });
}

// Safety net: if screens mount asynchronously (e.g. code-split chunks),
// re-run mountSidebars on the next tick so any <aside> elements that
// weren't in the DOM yet get populated.
setTimeout(() => {
  const unmounted = document.querySelectorAll('aside.sidebar[data-sidebar-screen]:empty');
  if (unmounted.length) {
    mountSidebars();
    window._renderAllRecent?.();
    _renderUnifiedRecentsAllSidebars();
    _renderRecentPlansAllSidebars();
  }
}, 0);
