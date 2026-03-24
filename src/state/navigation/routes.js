/**
 * src/state/navigation/routes.js — Route tables & URL helpers
 */

// ── Screen map: pathname → screen name, and screen name → pathname ─────────

export const PATH_TO_SCREEN = {
  '/':              'home',
  '/home':          'home',
  '/app':           'home',
  '/workspace':     'workspace',
  '/library':       'library',
  '/flashcard':     'flash',
  '/studyplan':     'studyplan',
  '/visualtutor':   'visual',
  '/research':      'research',
  '/exam':          'exam',
  // Guest-prefixed paths
  '/guest':         'home',
  '/guest/home':    'home',
  '/guest/workspace':   'workspace',
  '/guest/library':     'library',
  '/guest/flashcard':   'flash',
  '/guest/studyplan':   'studyplan',
  '/guest/visualtutor': 'visual',
  '/guest/research':    'research',
  '/guest/exam':        'exam',
};

export const SCREEN_TO_PATH = {
  home:      '/home',
  workspace: '/workspace',
  library:   '/library',
  flash:     '/flashcard',
  studyplan: '/studyplan',
  visual:    '/visualtutor',
  research:  '/research',
  exam:      '/exam',
};

export const SCREEN_MAP = {
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
export function _isOAuthHash() {
  const h = window.location.hash;
  return h.includes('access_token') || h.includes('error_description');
}

/** Write the screen pathname via pushState. No-op during OAuth flow. */
export function _setPath(name) {
  if (_isOAuthHash()) return;
  try {
    const base = sessionStorage.getItem('chunks_guest_mode') === '1' ? '/guest' : '';
    const path = base + (SCREEN_TO_PATH[name] || '/home');
    if (window.location.pathname !== path) {
      window.history.pushState({ screen: name }, '', path);
    }
  } catch (e) { /* sandboxed iframe — ignore */ }
}

/** Parse a valid screen name from the current pathname, or return null. */
export function _screenFromPath() {
  if (_isOAuthHash()) return null;
  const path = window.location.pathname;
  return PATH_TO_SCREEN[path] || null;
}
