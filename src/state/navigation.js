/**
 * src/state/navigation.js — Task 15
 * Implements: showScreen, drawerNav, mobileNav, toggleSidebar, closeMobileDrawer
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

function _navInit() {
  const last = (() => { try { return sessionStorage.getItem('chunks_last_screen'); } catch(e) { return null; } })();
  const start = last && SCREEN_MAP[last] ? last : 'home';
  document.querySelectorAll('.screen').forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
  showScreen(start);
  const overlay = document.getElementById('mobile-drawer-overlay');
  if (overlay) overlay.addEventListener('click', closeMobileDrawer);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    _navInit();
    document.body.classList.add('chunks-ready');
  });
} else {
  _navInit();
  document.body.classList.add('chunks-ready');
}

window.showScreen        = showScreen;
window.drawerNav         = drawerNav;
window.mobileNav         = mobileNav;
window.toggleSidebar     = toggleSidebar;
window.handleLogoClick   = handleLogoClick;
window.openMobileDrawer  = openMobileDrawer;
window.closeMobileDrawer = closeMobileDrawer;

console.log('[navigation] module loaded ✦');
