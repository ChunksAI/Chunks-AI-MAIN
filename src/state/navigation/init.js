/**
 * src/state/navigation/init.js — Navigation bootstrap
 */

import { $el, $qsa, hide, removeClass } from '../domHelpers.js';
import { _isOAuthHash, _screenFromPath, SCREEN_MAP } from './routes.js';
import { showScreen, _currentScreen, setNavFromHistory } from './screens.js';
import { closeMobileDrawer } from './mobile.js';
import { spInitScreen } from '../studyplan/index.js';

export function _navInit() {
  // ── Strip OAuth hash and land on /home ──────────────────────────────────
  const _hadOAuthHash = window.location.hash.includes('access_token') ||
                        window.location.hash.includes('error_description');
  const _hadOAuthCode = window.location.search.includes('code=');

  if (_hadOAuthHash || _hadOAuthCode) {
    try { sessionStorage.setItem('chunks_oauth_callback', '1'); } catch(e) {}
    $qsa('.screen').forEach(s => { hide(s); removeClass(s, 'active'); });
    showScreen('workspace');
    const overlay = $el('mobile-drawer-overlay');
    if (overlay) overlay.addEventListener('click', closeMobileDrawer);
    window.addEventListener('popstate', (e) => {
      const name = (e.state && e.state.screen) ? e.state.screen : _screenFromPath();
      if (name && name !== _currentScreen()) {
        setNavFromHistory(true);
        showScreen(name);
      }
    });
    return;
  }

  // Priority: current pathname → sessionStorage → 'workspace'
  const fromPath    = _screenFromPath();
  const fromSession = (() => { try { return sessionStorage.getItem('chunks_last_screen'); } catch(e) { return null; } })();
  // 'home' is no longer a distinct destination — redirect to the unified workspace
  const _resolvedSession = (fromSession === 'home') ? 'workspace' : fromSession;
  const start       = (fromPath && SCREEN_MAP[fromPath] && fromPath !== 'home') ? fromPath
                    : (_resolvedSession && SCREEN_MAP[_resolvedSession]) ? _resolvedSession
                    : 'workspace';

  $qsa('.screen').forEach(s => { hide(s); removeClass(s, 'active'); });
  if (start !== 'workspace') setNavFromHistory(true);
  showScreen(start);

  if (start === 'studyplan') {
    setTimeout(() => { if (typeof spInitScreen === 'function') spInitScreen(); }, 0);
  }

  const overlay = $el('mobile-drawer-overlay');
  if (overlay) overlay.addEventListener('click', closeMobileDrawer);

  // ── Browser back/forward (popstate) ─────────────────────────────────────
  window.addEventListener('popstate', (e) => {
    const name = (e.state && e.state.screen) ? e.state.screen : _screenFromPath();
    if (name && name !== _currentScreen()) {
      setNavFromHistory(true);
      showScreen(name);
    }
  });
}
