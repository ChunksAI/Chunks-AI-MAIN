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
  } else {
    console.warn(`[navigation] screen not found: ${id}`);
    const home = document.getElementById('screen-home');
    if (home) { home.style.display = 'flex'; home.classList.add('active'); }
    return;
  }
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
  const sidebar = document.querySelector('.screen.active .sidebar') || document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed');
}

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
