/**
 * src/state/navigation.js
 * Implements: showScreen, drawerNav, mobileNav, toggleSidebar, closeMobileDrawer
 *
 * URL routing — clean pathnames via history.pushState:
 *   /          → home
 *   /home      → home
 *   /workspace → workspace
 *   /library   → library
 *   /flashcard → flash
 *   /studyplan → studyplan
 *   /visualtutor → visual
 *   /research  → research
 *   /exam      → exam
 *
 * OAuth hashes (containing 'access_token' or 'error_description') are
 * never overwritten and never parsed as screen names.
 */

// ── Screen map: pathname → screen name, and screen name → pathname ─────────

const PATH_TO_SCREEN = {
  '/':            'home',
  '/home':        'home',
  '/app':         'home',
  '/workspace':   'workspace',
  '/library':     'library',
  '/flashcard':   'flash',
  '/studyplan':   'studyplan',
  '/visualtutor': 'visual',
  '/research':    'research',
  '/exam':        'exam',
};

const SCREEN_TO_PATH = {
  home:      '/',
  workspace: '/workspace',
  library:   '/library',
  flash:     '/flashcard',
  studyplan: '/studyplan',
  visual:    '/visualtutor',
  research:  '/research',
  exam:      '/exam',
};

const SCREEN_MAP = {
  home:      'screen-home',
  workspace: 'screen-workspace',
  library:   'screen-library',
  flash:     'screen-flash',
  exam:      'screen-exam',
  studyplan: 'screen-studyplan',
  research:  'screen-research',
  visual:    'screen-visual',
};

// ── URL helpers ───────────────────────────────────────────────────────────────

/** True if the current URL is an OAuth callback — never touch these. */
function _isOAuthHash() {
  const h = window.location.hash;
  return h.includes('access_token') || h.includes('error_description');
}

/** Write the screen pathname via pushState. No-op during OAuth flow. */
function _setPath(name) {
  if (_isOAuthHash()) return;
  try {
    const path = SCREEN_TO_PATH[name] || '/';
    if (window.location.pathname !== path) {
      window.history.pushState({ screen: name }, '', path);
    }
  } catch (e) { /* sandboxed iframe — ignore */ }
}

/** Parse a valid screen name from the current pathname, or return null. */
function _screenFromPath() {
  if (_isOAuthHash()) return null;
  const path = window.location.pathname;
  return PATH_TO_SCREEN[path] || null;
}

// ── Core navigation ───────────────────────────────────────────────────────────

function showScreen(name) {
  if (!name) return;
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const id = SCREEN_MAP[name] || `screen-${name}`;
  const target = document.getElementById(id);
  if (target) {
    target.style.display = 'flex';
    target.classList.add('active');
    // Apply persisted sidebar compact state to this screen's sidebar
    try {
      const compact = sessionStorage.getItem('chunks_sidebar_compact') === '1';
      const sb = target.querySelector('.sidebar');
      if (sb) sb.classList.toggle('compact', compact);
    } catch(e) {}
    // Restore collapsed state for history sections in this screen's sidebar
    ['hist-section-general','hist-section-workspace','hist-section-visual','hist-section-exam'].forEach(secId => {
      try {
        const collapsed = sessionStorage.getItem('hist_collapsed_' + secId) === '1';
        target.querySelectorAll('#' + secId).forEach(sec => sec.classList.toggle('collapsed', collapsed));
      } catch(e) {}
    });
  } else {
    console.warn(`[navigation] screen not found: ${id}`);
    const home = document.getElementById('screen-home');
    if (home) { home.style.display = 'flex'; home.classList.add('active'); }
    return;
  }

  // ── Fresh navigation resets ────────────────────────────────────────────────
  if (!window._navFromHistory) {
    if (name === 'exam') {
      if (typeof _examShow === 'function') {
        _examShow('exam-setup');
        _activeExamRecentId = null;
        if (typeof _setActiveRecent === 'function') _setActiveRecent(null);
      }
    }
    // studyplan init is handled unconditionally outside this block

    // ── Fresh nav = new session. History nav (_navFromHistory=true) = restore. ─
    // Home uses goHome() which already resets to landing — no extra work needed here.

    if (name === 'workspace') {
      // Silent reset — clear chat and book, NO toast (toast is for explicit "clear" action)
      try {
        const msgs = document.getElementById('ws-messages');
        if (msgs) msgs.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-4);text-align:center;padding:24px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><div style="font-size:12px;color:var(--text-4);">Ask a question to start the conversation</div></div>';
        if (typeof window._wsChatHistory !== 'undefined') window._wsChatHistory = [];
        localStorage.removeItem('chunks_active_ws_book');
        const wsNoBook  = document.getElementById('ws-no-book-bar');
        const wsBookBar = document.getElementById('ws-book-bar');
        if (wsNoBook)  wsNoBook.style.display  = '';
        if (wsBookBar) wsBookBar.style.display = 'none';
      } catch(_) {}
    }
    if (name === 'visual') {
      // vtClear already runs silently (no toast) when fired from here
      if (typeof window._vtClear === 'function') window._vtClear();
    }
    if (name === 'flash') {
      if (typeof window._fcExitStudy === 'function') window._fcExitStudy();
    }
    if (name === 'library') {
      // Refresh progress overlays every time library is shown
      setTimeout(() => { if (typeof window._libInjectProgress === 'function') window._libInjectProgress(); }, 50);
    }
    if (name === 'research') {
      if (typeof window._researchBackToSetup === 'function') window._researchBackToSetup();
    }
    // Clear active chat highlight — fresh nav means no session is active
    if (typeof _setActiveRecent === 'function') _setActiveRecent(null);
  }

  // ── Always enforce source ownership for chat highlights ───────────────────
  // Runs for EVERY navigation (fresh or history) to ensure only the item
  // matching the current screen's source type stays highlighted.
  // Each screen owns one session source:
  //   home → general | workspace → workspace | exam → exam | visual → visual
  // All other screens (flash, research, library, studyplan) own nothing → clear.
  if (typeof _setActiveRecent === 'function' && typeof _recentItems !== 'undefined') {
    const _activeId = typeof _activeRecentId !== 'undefined' ? _activeRecentId : null;
    if (_activeId) {
      const _activeItem = _recentItems.find(r => r.id === _activeId);
      // Handle old items without explicit source: if no bookId → treat as general
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
  if (name !== 'studyplan' && typeof window.setActivePlan === 'function') {
    window.setActivePlan(null);
  }
  // ── Studyplan: fresh nav = new session, history nav = restore plan ─────────
  if (name === 'studyplan') {
    if (window._navFromHistory) {
      // Came here via a recent plan click or browser back — restore active plan
      if (typeof window.spInitScreen === 'function') window.spInitScreen();
    } else {
      // Fresh nav click on "Study Plan" sidebar item — show empty state (new plan)
      if (typeof window.spShowEmpty === 'function') window.spShowEmpty();
      if (typeof window.setActivePlan === 'function') window.setActivePlan(null);
    }
    // studyplan never owns chat sessions
    if (typeof _setActiveRecent === 'function') _setActiveRecent(null);
  }
  window._navFromHistory = false;

  document.querySelectorAll('.md-item').forEach(el => {
    el.classList.toggle('active', el.dataset.screen === name);
  });
  document.querySelectorAll('.mobile-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.screen === name);
  });

  try { sessionStorage.setItem('chunks_last_screen', name); } catch(e) {}
  _setPath(name);
}

function drawerNav(name) {
  closeMobileDrawer();
  showScreen(name);
}

function mobileNav(name) {
  if (name === 'more') { openMobileDrawer(); return; }
  showScreen(name);
}

function openMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('mobile-drawer-overlay');
  if (drawer)  { drawer.classList.add('open'); drawer.setAttribute('aria-hidden','false'); }
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('mobile-drawer-overlay');
  if (drawer)  { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); }
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function toggleSidebar() {
  const activeSidebar = document.querySelector('.screen.active .sidebar');
  if (!activeSidebar) return;
  const willCollapse = !activeSidebar.classList.contains('compact');
  document.querySelectorAll('.sidebar').forEach(sb => {
    sb.classList.toggle('compact', willCollapse);
  });
  try { sessionStorage.setItem('chunks_sidebar_compact', willCollapse ? '1' : '0'); } catch(e) {}
}

// Restore sidebar compact state on page load
(function _restoreSidebarState() {
  try {
    const compact = sessionStorage.getItem('chunks_sidebar_compact') === '1';
    if (!compact) return;
    const apply = () => document.querySelectorAll('.sidebar').forEach(sb => sb.classList.add('compact'));
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply);
    } else {
      apply();
    }
  } catch(e) {}
})();

function handleLogoClick() { showScreen('home'); }

export function _navInit() {
  // ── Strip OAuth hash and land on /home ──────────────────────────────────
  // After Google/email login, Supabase redirects to /home with #access_token=...
  // or /home?code=... in the URL. We need to clean this up immediately so
  // the user sees /home rather than /#access_token=... or /?code=...
  // IMPORTANT: Save the OAuth flag to sessionStorage BEFORE stripping the hash
  // so that auth.js can still detect the OAuth flow after replaceState clears the URL.
  const _hadOAuthHash = window.location.hash.includes('access_token') ||
                        window.location.hash.includes('error_description');
  const _hadOAuthCode = window.location.search.includes('code=');

  if (_hadOAuthHash || _hadOAuthCode) {
    // Signal to auth.js that this page load is an OAuth callback.
    // DO NOT strip the hash/code here — Supabase needs it to complete the
    // PKCE/implicit exchange. auth.js will clean the URL after exchanging.
    try { sessionStorage.setItem('chunks_oauth_callback', '1'); } catch(e) {}
    // Show home screen without touching the URL
    document.querySelectorAll('.screen').forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
    showScreen('home');
    const overlay = document.getElementById('mobile-drawer-overlay');
    if (overlay) overlay.addEventListener('click', closeMobileDrawer);
    window.addEventListener('popstate', (e) => {
      const name = (e.state && e.state.screen) ? e.state.screen : _screenFromPath();
      if (name && name !== _currentScreen()) {
        window._navFromHistory = true;
        showScreen(name);
      }
    });
    return;
  }

  // Priority: current pathname → sessionStorage → 'home'
  const fromPath    = _screenFromPath();
  const fromSession = (() => { try { return sessionStorage.getItem('chunks_last_screen'); } catch(e) { return null; } })();
  const start       = (fromPath && SCREEN_MAP[fromPath])    ? fromPath
                    : (fromSession && SCREEN_MAP[fromSession]) ? fromSession
                    : 'home';

  document.querySelectorAll('.screen').forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
  if (start !== 'home') window._navFromHistory = true;
  showScreen(start);

  if (start === 'studyplan') {
    setTimeout(() => { if (typeof window.spInitScreen === 'function') window.spInitScreen(); }, 0);
  }

  const overlay = document.getElementById('mobile-drawer-overlay');
  if (overlay) overlay.addEventListener('click', closeMobileDrawer);

  // ── Browser back/forward (popstate) ─────────────────────────────────────
  window.addEventListener('popstate', (e) => {
    const name = (e.state && e.state.screen) ? e.state.screen : _screenFromPath();
    if (name && name !== _currentScreen()) {
      window._navFromHistory = true;
      showScreen(name);
    }
  });
}

function _currentScreen() {
  const active = document.querySelector('.screen.active');
  if (!active) return null;
  for (const [name, id] of Object.entries(SCREEN_MAP)) {
    if (active.id === id) return name;
  }
  return null;
}

window.showScreen        = showScreen;
window.drawerNav         = drawerNav;
window.mobileNav         = mobileNav;
window.toggleSidebar     = toggleSidebar;
window.handleLogoClick   = handleLogoClick;
window.openMobileDrawer  = openMobileDrawer;
window.closeMobileDrawer = closeMobileDrawer;

console.log('[navigation] module loaded ✦');
