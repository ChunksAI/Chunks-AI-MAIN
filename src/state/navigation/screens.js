// @ts-nocheck
/**
 * src/state/navigation/screens.js — Core screen switching
 */

import { $el, $qs, $qsa, hide, show, addClass, removeClass, toggleClass }
  from '../domHelpers.js';
import { SCREEN_MAP, _setPath } from './routes.js';
import { setActivePlan } from '../../components/Sidebar.js';
import { spInitScreen, spShowEmpty } from '../studyplan/index.js';
import { closeMobileDrawer, openMobileDrawer } from './mobile.js';

// ── Shared navigation flag ────────────────────────────────────────────────────
export let _navFromHistory = false;
export function setNavFromHistory(v) { _navFromHistory = v; }

// ── Core navigation ───────────────────────────────────────────────────────────

export function showScreen(name) {
  if (!name) return;
  $qsa('.screen').forEach(s => {
    removeClass(s, 'active');
    hide(s);
  });
  const id = SCREEN_MAP[name] || `screen-${name}`;
  const target = $el(id);
  if (target) {
    show(target);
    target.style.display = 'flex';
    addClass(target, 'active');
    // Apply persisted sidebar compact state to this screen's sidebar
    try {
      const compact = sessionStorage.getItem('chunks_sidebar_compact') === '1';
      const sb = $qs('.sidebar', target);
      if (sb) toggleClass(sb, 'compact', compact);
    } catch(e) {}
    // Restore collapsed state for history sections in this screen's sidebar
    ['hist-section-general','hist-section-workspace','hist-section-visual','hist-section-exam'].forEach(secId => {
      try {
        const collapsed = sessionStorage.getItem('hist_collapsed_' + secId) === '1';
        target.querySelectorAll('#' + secId).forEach(sec => toggleClass(sec, 'collapsed', collapsed));
      } catch(e) {}
    });
  } else {
    console.warn(`[navigation] screen not found: ${id}`);
    const home = $el('screen-home');
    if (home) { home.style.display = 'flex'; addClass(home, 'active'); }
    return;
  }

  // ── Fresh navigation resets ────────────────────────────────────────────────
  if (!_navFromHistory) {
    if (name === 'exam') {
      if (typeof _examShow === 'function') {
        _examShow('exam-setup');
        _activeExamRecentId = null;
        if (typeof _setActiveRecent === 'function') _setActiveRecent(null);
        // Apply guest exam constraints (MCQ only, max 5 questions)
        setTimeout(() => window.enforceExamConstraints?.(), 50);
      }
      // Refresh nav context banner whenever exam screen is shown
      setTimeout(() => { if (typeof window._fcCheckNavFrom === 'function') window._fcCheckNavFrom(); }, 100);
    }

    if (name === 'workspace') {
      // Silent reset — clear chat and book, NO toast (toast is for explicit "clear" action)
      try {
        const msgs = $el('ws-messages');
        if (msgs) msgs.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-4);text-align:center;padding:24px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><div style="font-size:12px;color:var(--text-4);">Ask a question to start the conversation</div></div>';
        if (typeof window._wsChatHistory !== 'undefined') window._wsChatHistory = [];
        localStorage.removeItem('chunks_active_ws_book');
        const wsNoBook  = $el('ws-no-book-bar');
        const wsBookBar = $el('ws-book-bar');
        if (wsNoBook)  wsNoBook.style.display  = '';
        if (wsBookBar) wsBookBar.style.display = 'none';
      } catch(_) {}
    }
    if (name === 'visual') {
      if (typeof window._vtClear === 'function') window._vtClear();
    }
    if (name === 'flash') {
      if (typeof window._fcExitStudy === 'function') window._fcExitStudy();
      // Refresh nav context banner whenever flash screen is shown
      setTimeout(() => { if (typeof window._fcCheckNavFrom === 'function') window._fcCheckNavFrom(); }, 50);
    }
    if (name === 'library') {
      setTimeout(() => { if (typeof window._libInjectProgress === 'function') window._libInjectProgress(); }, 50);
    }
    if (name === 'research') {
      if (typeof window._researchBackToSetup === 'function') window._researchBackToSetup();
    }
    if (typeof _setActiveRecent === 'function') _setActiveRecent(null);
  }

  // ── Always enforce source ownership for chat highlights ───────────────────
  if (typeof _setActiveRecent === 'function' && typeof _recentItems !== 'undefined') {
    const _activeId = typeof _activeRecentId !== 'undefined' ? _activeRecentId : null;
    if (_activeId) {
      const _activeItem = _recentItems.find(r => r.id === _activeId);
      const _src = _activeItem
        ? (_activeItem.source || (_activeItem.bookId ? 'workspace' : 'general'))
        : '';
      const _owns = { home: 'general', workspace: 'workspace', exam: 'exam', visual: 'visual' };
      if (_owns[name] !== _src) {
        _setActiveRecent(null);
      }
    }
  }

  // ── Always clear plan highlight when not on studyplan ─────────────────────
  if (name !== 'studyplan' && typeof setActivePlan === 'function') {
    setActivePlan(null);
  }
  // ── Studyplan: fresh nav = new session, history nav = restore plan ─────────
  if (name === 'studyplan') {
    if (_navFromHistory) {
      if (typeof spInitScreen === 'function') spInitScreen();
    } else {
      if (typeof spShowEmpty === 'function') spShowEmpty();
      if (typeof setActivePlan === 'function') setActivePlan(null);
    }
    if (typeof _setActiveRecent === 'function') _setActiveRecent(null);
  }
  _navFromHistory = false;

  // Refresh home landing activities when navigating to home
  if (name === 'home' && typeof window._renderHomeActivities === 'function') {
    window._renderHomeActivities();
  }

  $qsa('.md-item').forEach(el => {
    toggleClass(el, 'active', el.dataset.screen === name);
  });
  $qsa('.mobile-nav-item').forEach(el => {
    toggleClass(el, 'active', el.dataset.screen === name);
  });

  try { sessionStorage.setItem('chunks_last_screen', name); } catch(e) {}
  _setPath(name);
}

export function drawerNav(name) {
  // closeMobileDrawer is on window — avoid circular import
  if (typeof closeMobileDrawer === 'function') closeMobileDrawer();
  showScreen(name);
}

export function mobileNav(name) {
  if (name === 'more') { openMobileDrawer?.(); return; }
  showScreen(name);
}

export function _currentScreen() {
  const active = $qs('.screen.active');
  if (!active) return null;
  for (const [name, id] of Object.entries(SCREEN_MAP)) {
    if (active.id === id) return name;
  }
  return null;
}
