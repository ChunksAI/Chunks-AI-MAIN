/**
 * src/state/navigation/index.js — Barrel re-export + window bridges
 *
 * Replaces the monolithic src/state/navigation.js.
 * Sub-modules:
 *   routes.js   — route tables + URL helpers
 *   screens.js  — showScreen, drawerNav, mobileNav, _currentScreen
 *   mobile.js   — openMobileDrawer, closeMobileDrawer, toggleSidebar, handleLogoClick
 *   init.js     — _navInit (bootstrap)
 */

export { PATH_TO_SCREEN, SCREEN_TO_PATH, SCREEN_MAP } from './routes.js';
export { showScreen, drawerNav, mobileNav, _currentScreen } from './screens.js';
export { openMobileDrawer, closeMobileDrawer, toggleSidebar, handleLogoClick } from './mobile.js';
export { _navInit } from './init.js';

// ── Window bridges ────────────────────────────────────────────────────────────
import { showScreen, drawerNav, mobileNav } from './screens.js';
import { openMobileDrawer, closeMobileDrawer, toggleSidebar, handleLogoClick } from './mobile.js';

window.showScreen        = showScreen;
window.drawerNav         = drawerNav;
window.mobileNav         = mobileNav;
window.toggleSidebar     = toggleSidebar;
window.handleLogoClick   = handleLogoClick;
window.openMobileDrawer  = openMobileDrawer;
window.closeMobileDrawer = closeMobileDrawer;

console.log('[navigation] module loaded ✦');
