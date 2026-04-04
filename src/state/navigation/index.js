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
export { showScreen, drawerNav, mobileNav, _currentScreen, setNavFromHistory } from './screens.js';
export { openMobileDrawer, closeMobileDrawer, toggleSidebar, handleLogoClick } from './mobile.js';
export { _navInit } from './init.js';

console.log('[navigation] module loaded ✦');
