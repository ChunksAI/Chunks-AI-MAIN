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
 *  recent list IDs   → suffixed per-screen so renderSidebarHistory() works
 *  flash extra       → fc-saved-decks-list / fc-deck-count
 *  studyplan extra   → sp-recent-plans-section / sp-recent-plans-list
 *
 * Task 19 — replaces 6 copies (home, workspace, flash, research, exam,
 * studyplan) with this single component.
 */

import {
  getRecentList,
  getSession,
  deleteSession,
  getActiveSessionId,
  setActiveSessionId,
} from '../utils/storage.js';

// ── SVG constants ──────────────────────────────────────────────────────────

const LOGO_SVG = `
  <ellipse class="orbit" cx="50" cy="50" rx="40" ry="14" fill="none" stroke="url(#lg-gv)" stroke-width="7" opacity="0.95"/>
  <ellipse class="orbit" cx="50" cy="50" rx="40" ry="14" fill="none" stroke="url(#lg-vg)" stroke-width="7" transform="rotate(60 50 50)" opacity="0.88"/>
  <ellipse class="orbit" cx="50" cy="50" rx="40" ry="14" fill="none" stroke="url(#lg-gv)" stroke-width="7" transform="rotate(120 50 50)" opacity="0.80"/>
  <circle cx="50" cy="50" r="7" fill="#e8ac2e"/>`;

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
    action: 'openLibraryModal',
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
  home:      { general: 'recent-list-general',            workspace: 'recent-list-home' },
  workspace: { general: 'recent-list-general-ws',         workspace: 'recent-list-workspace' },
  flash:     { general: 'recent-list-general-flash',      workspace: 'recent-list-flash' },
  research:  { general: 'recent-list-general-research',   workspace: 'recent-list-ws-research' },
  exam:      { general: 'recent-list-general-exam',       workspace: 'recent-list-ws-exam' },
  studyplan: { general: 'recent-list-general-studyplan',  workspace: 'recent-list-ws-studyplan' },
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

  // Screen-specific extra sections
  let extraSections = '';

  if (screen === 'flash') {
    extraSections = `
    <div class="sidebar-divider"></div>
    <div class="sidebar-section">
      <div class="sidebar-section-label" style="display:flex;align-items:center;justify-content:space-between;">
        My Decks
        <span id="fc-deck-count" style="font-size:10px;color:var(--text-4);"></span>
      </div>
      <div id="fc-saved-decks-list" class="recent-list">
        <div class="recent-empty">No saved decks yet</div>
      </div>
    </div>`;
  }

  if (screen === 'studyplan') {
    extraSections = `
    <div id="sp-recent-plans-section" style="display:none;">
      <div class="sidebar-divider"></div>
      <div class="sidebar-section">
        <div class="sidebar-section-label">Recent Plans</div>
        <div id="sp-recent-plans-list"></div>
      </div>
    </div>`;
  }

  return `
    <div class="sidebar-header">
      <div class="logo-link" data-action="handleLogoClick-self" title="Go to home / expand">
        <svg class="logo-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${LOGO_SVG}
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

    <div class="sidebar-divider"></div>

    <div class="sidebar-section">
      <div class="sidebar-section-label">General AI</div>
      <div id="${ids.general}" class="recent-list"></div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-label">Workspace</div>
      <div id="${ids.workspace}" class="recent-list"></div>
    </div>
    </nav>
    ${extraSections}

    <div class="sidebar-footer">
      <div class="profile-row" role="button" tabindex="0" aria-label="Open profile menu" aria-haspopup="true" onclick="toggleProfileDropdown(event)" onkeydown="if(event.key==='Enter'||event.key===' ')toggleProfileDropdown(event)">
        <div class="avatar" aria-hidden="true">A</div>
        <div class="profile-text">
          <div class="profile-name">Alex Cruz</div>
          <div class="profile-plan">Free Plan</div>
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
  renderSidebarHistory();
}

// ── History rendering ──────────────────────────────────────────────────────

const CHAT_SVG_SB = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

const ALL_GENERAL_IDS   = ['recent-list-general','recent-list-general-ws','recent-list-general-flash','recent-list-general-research','recent-list-general-exam','recent-list-general-studyplan'];
const ALL_WORKSPACE_IDS = ['recent-list-home','recent-list-workspace','recent-list-flash','recent-list-ws-research','recent-list-ws-exam','recent-list-ws-studyplan'];

/**
 * Read chunks_recent from localStorage via storage.js and populate every
 * sidebar list container that currently exists in the DOM.
 *
 * Called by mountSidebars() on every page load / refresh / new tab.
 * Also exposed as window._renderAllRecent so any code that saves a new
 * message can call it to immediately update the sidebar.
 */
export function renderSidebarHistory() {
  const items    = getRecentList();
  const activeId = getActiveSessionId();

  const generalItems = items.filter(r => r.source === 'general' || !r.source);
  const wsItems      = items.filter(r => r.source === 'workspace');

  ALL_GENERAL_IDS.forEach(id   => _fillList(id, generalItems, activeId, 'No chats yet'));
  ALL_WORKSPACE_IDS.forEach(id => _fillList(id, wsItems,      activeId, 'No recent chats yet'));
}

function _fillList(containerId, items, activeId, emptyMsg) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  if (!items.length) {
    el.innerHTML = `<div class="recent-empty">${emptyMsg}</div>`;
    return;
  }
  items.forEach(item => el.appendChild(_buildSidebarItem(item, activeId)));
}

function _buildSidebarItem(item, activeId) {
  const div = document.createElement('div');
  div.className = 'recent-item' + (item.id === activeId ? ' active' : '');
  div.dataset.id = item.id;
  div.title = item.title || '';
  div.innerHTML = `
    ${CHAT_SVG_SB}
    <span>${(item.title || '').replace(/</g, '&lt;')}</span>
    <span class="recent-menu-btn" title="More options">···</span>`;

  // Click → load session
  div.addEventListener('click', () => _loadSessionIntoUI(item));

  // ··· menu → context menu (keep legacy working) or inline delete
  div.querySelector('.recent-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    if (typeof window._showRecentCtxMenu === 'function') {
      window._showRecentCtxMenu(item, e);
    } else {
      _inlineDeleteItem(item.id);
    }
  });

  return div;
}

function _loadSessionIntoUI(item) {
  setActiveSessionId(item.id);

  // Highlight active in all sidebars
  document.querySelectorAll('.recent-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === item.id);
  });

  // Delegate to inline-script handler for full restore if available
  if (typeof window._clickRecent === 'function') {
    // Convert storage item shape to legacy recentItems shape
    const legacyItem = {
      id:       item.id,
      label:    item.title,
      question: item.title,
      bookId:   item.source === 'workspace' ? item.bookId || '' : null,
      source:   item.source || 'general',
    };
    window._clickRecent(legacyItem);
    return;
  }

  // Fallback: restore general AI chat from messages array
  if (item.source !== 'workspace') {
    const session = getSession(item.id);
    if (!session) return;
    window.showScreen?.('home');
    const landing    = document.getElementById('home-landing');
    const hero       = document.querySelector('.home-hero');
    const bar        = document.getElementById('home-input-bar');
    const scrollArea = document.getElementById('home-scroll-area');
    const chatHist   = document.getElementById('home-chat-history');
    if (landing)    landing.style.display = 'none';
    if (hero)       hero.style.display = 'none';
    if (bar)        bar.style.display = 'flex';
    if (scrollArea) scrollArea.style.justifyContent = 'flex-start';
    if (chatHist) {
      chatHist.innerHTML = '';
      (session.messages || []).forEach(msg => {
        if (msg.role === 'user')      window.homeAppendUser?.(msg.content);
        else if (msg.role === 'assistant') window.homeAppendAI?.(msg.content, null);
      });
    }
    if (window._homeSessionId !== undefined) window._homeSessionId = item.id;
    if (window.homeHistory !== undefined)    window.homeHistory = (session.messages || []).map(m => ({ role: m.role, content: m.content }));
    setTimeout(() => window.homeScrollBottom?.(true), 80);
  }
}

function _inlineDeleteItem(id) {
  deleteSession(id);
  renderSidebarHistory();
}

// Auto-mount
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountSidebars);
} else {
  mountSidebars();
}

// Legacy global
window.buildSidebar         = buildSidebar;
window.mountSidebars        = mountSidebars;
window.renderSidebarHistory = renderSidebarHistory;
// Point window._renderAllRecent here — every appendMessage call triggers this
// to refresh the sidebar immediately.
window._renderAllRecent  = renderSidebarHistory;
window._renderRecentList = renderSidebarHistory;
