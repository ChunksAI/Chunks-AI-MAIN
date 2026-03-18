/**
 * src/state/navigation.js — Task 15
 * Implements: showScreen, drawerNav, mobileNav, toggleSidebar, closeMobileDrawer
 *
 * Task 11 addition: URL hash routing.
 * • showScreen() writes  location.hash = '#screen-NAME'
 * • _navInit()   reads   location.hash on load (falls back to sessionStorage)
 * • hashchange   listener handles browser back/forward
 * • OAuth hashes (containing 'access_token' or 'error_description') are
 *   never overwritten and never parsed as screen names.
 */

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

// ── Hash helpers ──────────────────────────────────────────────────────────────

/** Return true if the current hash is an OAuth callback — never touch these. */
function _isOAuthHash() {
  const h = window.location.hash;
  return h.includes('access_token') || h.includes('error_description');
}

/** Write the screen name into location.hash (no-op during OAuth flow). */
function _setHash(name) {
  if (_isOAuthHash()) return;
  try {
    const desired = `#screen-${name}`;
    if (window.location.hash !== desired) {
      window.history.replaceState(null, '', desired);
    }
  } catch (e) { /* sandboxed iframe — ignore */ }
}

/** Parse a valid screen name from location.hash, or return null. */
function _screenFromHash() {
  if (_isOAuthHash()) return null;
  const m = window.location.hash.match(/^#screen-([a-z]+)$/);
  if (!m) return null;
  return SCREEN_MAP[m[1]] ? m[1] : null;
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
    ['hist-section-general','hist-section-workspace','hist-section-visual','hist-section-exam'].forEach(id => {
      try {
        const collapsed = sessionStorage.getItem('hist_collapsed_' + id) === '1';
        target.querySelectorAll('#' + id).forEach(sec => sec.classList.toggle('collapsed', collapsed));
      } catch(e) {}
    });
  } else {
    console.warn(`[navigation] screen not found: ${id}`);
    const home = document.getElementById('screen-home');
    if (home) { home.style.display = 'flex'; home.classList.add('active'); }
    return;
  }

  // ── Fresh navigation resets ───────────────────────────────
  // When user clicks the nav button (not a sidebar history item), reset
  // exam to setup view and visual tutor to a clean canvas.
  // _clickRecent sets window._navFromHistory = true before calling showScreen
  // to skip this reset when restoring a saved session.
  if (!window._navFromHistory) {
    if (name === 'exam') {
      // Reset to setup view — don't show previous results/quiz
      if (typeof _examShow === 'function') {
        _examShow('exam-setup');
        _activeExamRecentId = null;
        if (typeof _setActiveRecent === 'function') _setActiveRecent(null);
      }
    }
    if (name === 'visual') {
      // Reset canvas and chat to fresh state
      if (typeof window._vtClear === 'function') window._vtClear();
      if (typeof _setActiveRecent === 'function') _setActiveRecent(null);
    }
    if (name === 'studyplan') {
      // Restore saved plan + mastery from localStorage on every visit
      if (typeof window.spInitScreen === 'function') window.spInitScreen();
    }
  }
  // Always reset the flag after consuming it
  window._navFromHistory = false;

  document.querySelectorAll('.md-item').forEach(el => {
    el.classList.toggle('active', el.dataset.screen === name);
  });
  document.querySelectorAll('.mobile-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.screen === name);
  });
  try { sessionStorage.setItem('chunks_last_screen', name); } catch(e) {}
  _setHash(name);
}

function drawerNav(name) {
  closeMobileDrawer();
  showScreen(name);
}

function mobileNav(name, el) {
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

function toggleSidebar(el) {
  // Determine target sidebar — prefer the active screen's sidebar
  const activeSidebar = document.querySelector('.screen.active .sidebar');
  if (!activeSidebar) return;

  const willCollapse = !activeSidebar.classList.contains('compact');

  // Apply to ALL sidebars so state is consistent when switching screens
  document.querySelectorAll('.sidebar').forEach(sb => {
    sb.classList.toggle('compact', willCollapse);
  });

  // Persist so state survives screen switches
  try { sessionStorage.setItem('chunks_sidebar_compact', willCollapse ? '1' : '0'); } catch(e) {}
}

// Restore sidebar compact state on page load
(function _restoreSidebarState() {
  try {
    const compact = sessionStorage.getItem('chunks_sidebar_compact') === '1';
    if (!compact) return;
    // Run after DOM is ready — sidebars may not exist yet at parse time
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
  // Priority: URL hash → sessionStorage → 'home'
  const fromHash    = _screenFromHash();
  const fromSession = (() => { try { return sessionStorage.getItem('chunks_last_screen'); } catch(e) { return null; } })();
  const start       = (fromHash && SCREEN_MAP[fromHash])    ? fromHash
                    : (fromSession && SCREEN_MAP[fromSession]) ? fromSession
                    : 'home';

  document.querySelectorAll('.screen').forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
  // On refresh, preserve the state of whatever screen was active —
  // set the flag so showScreen skips its fresh-nav reset logic
  if (start !== 'home') window._navFromHistory = true;
  showScreen(start);
  // If refreshing directly onto the study plan screen, restore the saved plan.
  // showScreen runs synchronously but spInitScreen may not be registered yet
  // (studyPlanState.js is a module — its window bridge runs after this iife).
  // Defer one tick so the bridge is guaranteed to be in place.
  if (start === 'studyplan') {
    setTimeout(() => { if (typeof window.spInitScreen === 'function') window.spInitScreen(); }, 0);
  }

  const overlay = document.getElementById('mobile-drawer-overlay');
  if (overlay) overlay.addEventListener('click', closeMobileDrawer);

  // ── Browser back/forward (hashchange) ────────────────────────────────────
  window.addEventListener('hashchange', () => {
    const name = _screenFromHash();
    if (name && name !== _currentScreen()) {
      window._navFromHistory = true;  // treat as history navigation, not fresh click
      showScreen(name);
    }
  });
}

/** Return the name of the currently active screen, or null. */
function _currentScreen() {
  const active = document.querySelector('.screen.active');
  if (!active) return null;
  for (const [name, id] of Object.entries(SCREEN_MAP)) {
    if (active.id === id) return name;
  }
  return null;
}

// _navInit is now called from main.js after all screens are mounted
// so that screen elements exist when showScreen() runs

window.showScreen        = showScreen;
window.drawerNav         = drawerNav;
window.mobileNav         = mobileNav;
window.toggleSidebar     = toggleSidebar;
window.handleLogoClick   = handleLogoClick;
window.openMobileDrawer  = openMobileDrawer;
window.closeMobileDrawer = closeMobileDrawer;

console.log('[navigation] module loaded ✦');
