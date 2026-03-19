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
  '/workspace':   'workspace',
  '/library':     'library',
  '/flashcard':   'flash',
  '/studyplan':   'studyplan',
  '/visualtutor': 'visual',
  '/research':    'research',
  '/exam':        'exam',
};

const SCREEN_TO_PATH = {
  home:      '/home',
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
    const path = SCREEN_TO_PATH[name] || '/home';
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
    if (name === 'visual') {
      if (typeof window._vtClear === 'function') window._vtClear();
      if (typeof _setActiveRecent === 'function') _setActiveRecent(null);
    }
    if (name === 'studyplan') {
      if (typeof window.spInitScreen === 'function') window.spInitScreen();
    }

    // Clear active chat highlight when navigating to a screen that doesn't
    // own the active session. Each screen only owns sessions by source type:
    //   home → general | workspace → workspace | exam → exam | visual → visual
    // All other screens (flash, research, library, studyplan) own nothing.
    // This prevents a workspace highlight showing in the sidebar when on Home, etc.
    if (typeof _setActiveRecent === 'function' && typeof _recentItems !== 'undefined') {
      const _activeId = typeof _activeRecentId !== 'undefined' ? _activeRecentId : null;
      if (_activeId) {
        const _activeItem = _recentItems.find(r => r.id === _activeId);
        const _src = _activeItem?.source || '';
        const _owns = { home: 'general', workspace: 'workspace', exam: 'exam', visual: 'visual' };
        // If the destination screen doesn't own the active session source → clear it
        if (_owns[name] !== _src) {
          _setActiveRecent(null);
        }
      }
    }

    // (plan highlight clearing moved outside this block — see below)
  }
  // ── Always clear plan highlight when not on studyplan ─────────────────────
  // Runs even for history navigation (_navFromHistory=true) so a plan item
  // never stays highlighted while viewing a different screen's content.
  if (name !== 'studyplan' && typeof window.setActivePlan === 'function') {
    window.setActivePlan(null);
  }
  // ── Always clear chat highlight when on studyplan ──────────────────────────
  // studyplan owns no chat sessions — no chat item should be highlighted there.
  if (name === 'studyplan' && typeof _setActiveRecent === 'function') {
    _setActiveRecent(null);
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
