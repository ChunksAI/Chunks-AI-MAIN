/**
 * src/state/navigation.js — Navigation state
 *
 * Owns all screen-switching, sidebar, and mobile nav logic.
 * State is minimal: the active screen name is persisted in
 * sessionStorage (key: 'chunks_active_screen').
 *
 * Exports / globals set
 * ─────────────────────
 *  showScreen(name)          — switch to a named screen
 *  toggleSidebar(el)         — compact ↔ expanded sidebar
 *  handleLogoClick(el)       — logo: expand if compact, else goHome
 *  animateOrbits(sidebar, toCompact) — logo orbit animation
 *  expandSidebar(el)         — legacy alias (calls goHome)
 *  flipCard()                — flash-card flip + keyboard shortcuts
 *  mobileNav(tab, btn)       — bottom-nav tab handler
 *  openMobileDrawer()        — open the mobile "more" drawer
 *  closeMobileDrawer()       — close the mobile drawer
 *  drawerNav(screen)         — navigate from inside the drawer
 *  syncDrawerRecentChats()   — populate drawer recent-chat list
 *
 * Task 15 — extracted from monolith:
 *   animateOrbits/toggleSidebar/showScreen/restoreScreen → lines 1648–1860
 *   patchShowScreenForWsMobile/mobileNav/patchShowScreen  → lines 13960–14093
 */

// ── Sidebar animation ──────────────────────────────────────────────────────

/**
 * Animate the logo orbit ellipses when the sidebar expands.
 * No-ops on collapse (instant shape change).
 *
 * @param {HTMLElement} sidebar
 * @param {boolean}     toCompact
 */
export function animateOrbits(sidebar, toCompact) {
  if (toCompact) return;
  const orbits = sidebar.querySelectorAll('.logo-mark .orbit');
  const fromRx = 6, toRx = 40;
  const fromRy = 6, toRy = 14;
  const dur = 420, start = performance.now();
  const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
  function step(now) {
    const t = ease(Math.min((now - start) / dur, 1));
    const rx = fromRx + (toRx - fromRx) * t;
    const ry = fromRy + (toRy - fromRy) * t;
    orbits.forEach(el => { el.setAttribute('rx', rx); el.setAttribute('ry', ry); });
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/**
 * Toggle sidebar compact ↔ expanded across all sidebar copies.
 *
 * @param {HTMLElement} el — the clicked element (or the sidebar itself)
 */
export function toggleSidebar(el) {
  const sidebar   = el.classList.contains('sidebar') ? el : el.closest('.sidebar');
  const toCompact = !sidebar.classList.contains('compact');
  document.querySelectorAll('.sidebar').forEach(s => s.classList.toggle('compact', toCompact));
  animateOrbits(sidebar, toCompact);
}

/**
 * Logo click: expand sidebar if compact, go to home screen if already expanded.
 *
 * @param {HTMLElement} el
 */
export function handleLogoClick(el) {
  const sidebar = el.closest('.sidebar');
  if (sidebar.classList.contains('compact')) {
    document.querySelectorAll('.sidebar').forEach(s => s.classList.remove('compact'));
    animateOrbits(sidebar, false);
  } else {
    goHome();
  }
}

/** @deprecated Legacy alias — kept for safety. */
export function expandSidebar(_el) { goHome(); }

// ── Screen navigation ──────────────────────────────────────────────────────

/**
 * Navigate to a named screen.
 * Handles sidebar highlight, sessionStorage persistence, and screen-specific
 * init hooks.
 *
 * @param {string} name — 'home' | 'workspace' | 'flash' | 'research' | 'exam' | 'studyplan'
 */
export function showScreen(name) {
  const screens    = document.querySelectorAll('.screen');
  const wasCompact = !!document.querySelector('.sidebar.compact');

  // Cancel research outline timer when navigating away
  if (name !== 'research' &&
      typeof _stageTimerHandle !== 'undefined' && _stageTimerHandle) {
    clearInterval(_stageTimerHandle); _stageTimerHandle = null;
  }

  screens.forEach(s => s.classList.remove('active'));

  const target = document.getElementById('screen-' + name);
  if (!target) return;
  target.classList.add('active');
  // Reset screen entry animation without causing a visible flash
  void target.offsetWidth; // force reflow
  target.style.animation = '';

  // Carry compact state to the new screen's sidebar
  if (wasCompact) {
    const newSidebar = target.querySelector('.sidebar');
    if (newSidebar) newSidebar.classList.add('compact');
  }

  // Sidebar active highlight — works for both onclick= and data-action/data-screen patterns
  const activeOnclick = {
    home:      "goHome()",
    workspace: "showScreen('workspace')",
    flash:     "showScreen('flash')",
    research:  "showScreen('research')",
    exam:      "showScreen('exam')",
    studyplan: "showScreen('studyplan')",
  }[name];

  document.querySelectorAll('.sidebar-item').forEach(item => {
    const oc = (item.getAttribute('onclick') || '').trim();
    const ds = item.dataset.screen || '';
    const da = item.dataset.action || '';
    const isActive = oc === activeOnclick ||
      ds === name ||
      (name === 'home' && (oc === "goHome()" || oc === "handleLogoClick(this)" || da === 'goHome')) ||
      (name !== 'home' && da === 'showScreen' && ds === name);
    item.classList.toggle('active', isActive);
    item.style.background = isActive ? 'var(--gold-muted)' : '';
    item.style.color      = isActive ? 'var(--gold)'       : '';
  });

  sessionStorage.setItem('chunks_active_screen', name);

  // ── Screen-specific init hooks ──
  if (name === 'flash') {
    if (typeof _fcRenderDeckList === 'function') {
      _fcRenderDeckList().catch(() => {});
      const _waitForAuth = (attempts) => {
        if (window._currentUser?.id) {
          _fcRenderDeckList().catch(() => {});
        } else if (attempts > 0) {
          setTimeout(() => _waitForAuth(attempts - 1), 200);
        }
      };
      _waitForAuth(15);
    }
  }

  if (name === 'research') {
    if (typeof _load === 'function') {
      _load();
      if (typeof _renderRecentList === 'function') _renderRecentList();
      if (RS.started) _showResearchView();
    }
  }

  if (name === 'exam') {
    if (typeof initExamSidebar === 'function') initExamSidebar();
  }

  if (name === 'studyplan') {
    if (typeof spInitScreen === 'function') spInitScreen();
  }
}

// ── Restore screen on page load ────────────────────────────────────────────

(function _restoreScreen() {
  // 'chunks_was_here' survives a refresh but not a fresh open
  const isRefresh = sessionStorage.getItem('chunks_was_here') === '1';

  if (isRefresh) {
    const last = sessionStorage.getItem('chunks_active_screen');
    if (last && document.getElementById('screen-' + last)) {
      showScreen(last);
    }
    // Restore library modal state
    if (sessionStorage.getItem('chunks_library_open') === '1') {
      const restoreModal = () => {
        const modal = document.getElementById('library-modal');
        if (modal) modal.classList.add('active');
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', restoreModal, { once: true });
      } else {
        restoreModal();
      }
    }
    sessionStorage.setItem('chunks_is_refresh', '1');
  } else {
    showScreen('home');
    sessionStorage.removeItem('chunks_is_refresh');
    localStorage.removeItem('chunks_active_recent_id');
  }

  // Reveal page after screen is restored — prevents scroll-jump flash
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.add('chunks-ready');
    });
  });

  window.addEventListener('beforeunload', () => {
    // Don't mark as refresh if the user is signing out
    if (sessionStorage.getItem('chunks_signing_out') === '1') return;
    sessionStorage.setItem('chunks_was_here', '1');
  });
})();

// ── Flash-card flip + keyboard shortcuts ───────────────────────────────────

let _cardFlipped = false;

/**
 * Flip the active flashcard and toggle the rating buttons.
 */
export function flipCard() {
  const card = document.getElementById('flashCard');
  const hint = document.getElementById('flipHint');

  _cardFlipped = !_cardFlipped;
  card.classList.toggle('flipped', _cardFlipped);
  hint.textContent = _cardFlipped
    ? 'Click again to see the question'
    : 'Click the card or press Space to reveal the answer';

  document.querySelectorAll('.flash-btn.hard, .flash-btn.ok, .flash-btn.easy').forEach(btn => {
    btn.disabled       = !_cardFlipped;
    btn.style.opacity      = _cardFlipped ? '' : '0.38';
    btn.style.pointerEvents = _cardFlipped ? '' : 'none';
  });
}

// Flash-card keyboard shortcuts (Space/Enter = flip, 1/2/3 = rate)
document.addEventListener('keydown', e => {
  const flashScreen = document.getElementById('screen-flash');
  if (!flashScreen?.classList.contains('active')) return;
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;

  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    flipCard();
  }
  if (_cardFlipped) {
    const [hard, ok, easy] = document.querySelectorAll('.flash-btn.hard, .flash-btn.ok, .flash-btn.easy');
    if (e.key === '1') hard?.click();
    if (e.key === '2') ok?.click();
    if (e.key === '3') easy?.click();
  }
});

// ── Mobile navigation ──────────────────────────────────────────────────────

const MOBILE_NAV_MAP = {
  home:      'home',
  workspace: 'workspace',
  flash:     'flash',
  exam:      'exam',
  more:      null,  // opens drawer
};

/**
 * Bottom-nav tab handler.
 *
 * @param {string}      tab - 'home' | 'workspace' | 'flash' | 'exam' | 'more'
 * @param {HTMLElement} btn - the tapped nav button
 */
export function mobileNav(tab, btn) {
  document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));

  const screenId = MOBILE_NAV_MAP[tab];
  if (screenId) showScreen(screenId);
  if (tab === 'more') openMobileDrawer();
}

// Patch showScreen to mirror active state on the bottom nav
(function _patchShowScreenMobileNav() {
  const _orig = window.showScreen;
  if (typeof _orig !== 'function') return;
  window.showScreen = function(id) {
    _orig(id);
    const map = {
      home:'mnav-home', workspace:'mnav-workspace',
      flash:'mnav-flash', exam:'mnav-exam', research:'mnav-more',
    };
    if (map[id]) {
      document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
      const el = document.getElementById(map[id]);
      if (el) el.classList.add('active');
    }
  };
})();

// Patch showScreen to reset workspace to chat view on mobile
(function _patchShowScreenWsMobile() {
  const _orig = window.showScreen;
  if (typeof _orig !== 'function') return;
  window.showScreen = function(id) {
    _orig(id);
    if (id === 'workspace' && window.innerWidth <= 768) {
      if (typeof wsMobileView === 'function') wsMobileView('chat');
    }
  };
})();

// ── Mobile drawer ──────────────────────────────────────────────────────────

/** Open the "more" mobile drawer. */
export function openMobileDrawer() {
  const overlay = document.getElementById('mobile-drawer-overlay');
  const drawer  = document.getElementById('mobile-drawer');
  if (!overlay || !drawer) return;
  syncDrawerRecentChats();
  overlay.classList.add('open');
  drawer.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/** Close the mobile drawer. */
export function closeMobileDrawer() {
  const overlay = document.getElementById('mobile-drawer-overlay');
  const drawer  = document.getElementById('mobile-drawer');
  if (!overlay || !drawer) return;
  overlay.classList.remove('open');
  drawer.classList.remove('open');
  document.body.style.overflow = '';
}

// Escape key closes drawer
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMobileDrawer();
});

/**
 * Navigate to a screen from inside the drawer.
 *
 * @param {string} screen
 */
export function drawerNav(screen) {
  closeMobileDrawer();
  document.querySelectorAll('.md-item').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('md-item-' + screen);
  if (target) target.classList.add('active');

  const navMap = {
    home:'mnav-home', workspace:'mnav-workspace',
    flash:'mnav-flash', exam:'mnav-exam',
    studyplan:'mnav-more', research:'mnav-more', library:'mnav-more',
  };
  document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById(navMap[screen] || 'mnav-more');
  if (navEl) navEl.classList.add('active');

  if (screen === 'library') {
    if (typeof openLibraryModal === 'function') openLibraryModal();
  } else {
    showScreen(screen);
  }
}

/** Populate the drawer's recent-chat list from the desktop sidebar lists. */
export function syncDrawerRecentChats() {
  const target = document.getElementById('md-recent-list');
  if (!target) return;
  const items = [];
  ['recent-list-general', 'recent-list-home'].forEach(id => {
    const src = document.getElementById(id);
    if (!src) return;
    src.querySelectorAll('.recent-item').forEach(el => {
      const span = el.querySelector('span');
      const text = span ? span.textContent.trim() : '';
      const onclickAttr = el.getAttribute('onclick') || '';
      if (text) items.push({ text, onclick: onclickAttr });
    });
  });
  if (!items.length) return;
  target.innerHTML = items.map(item =>
    `<div class="md-recent-item" onclick="closeMobileDrawer();${item.onclick}">` +
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>` +
    `<span>${item.text}</span>` +
    `</div>`
  ).join('');
}

// ── Legacy global bridges ──────────────────────────────────────────────────
window.showScreen         = showScreen;
window.toggleSidebar      = toggleSidebar;
window.handleLogoClick    = handleLogoClick;
window.animateOrbits      = animateOrbits;
window.expandSidebar      = expandSidebar;
window.flipCard           = flipCard;
window.mobileNav          = mobileNav;
window.openMobileDrawer   = openMobileDrawer;
window.closeMobileDrawer  = closeMobileDrawer;
window.drawerNav          = drawerNav;
window.syncDrawerRecentChats = syncDrawerRecentChats;
// cardFlipped exposed for legacy inline access
Object.defineProperty(window, 'cardFlipped', {
  get: () => _cardFlipped,
  set: v => { _cardFlipped = v; },
});
