/**
 * src/state/navigation.js — Navigation state
 *
 * Owns everything related to which screen is currently visible and how the
 * sidebar behaves.  Runs its own self-contained bootstrap (restoreScreen)
 * so the correct screen is shown as soon as this module is imported.
 *
 * Exports
 * ───────
 *   showScreen(name)       Show a named screen, update sidebar highlights,
 *                          persist to sessionStorage, run screen-specific init.
 *   toggleSidebar(el)      Toggle compact/expanded state on all sidebars.
 *   handleLogoClick(el)    Expand sidebar if compact, else navigate home.
 *   animateOrbits(el, b)   Animate the logo orbit SVG on expand.
 *
 * Screen names
 * ────────────
 *   'home' | 'workspace' | 'flash' | 'research' | 'exam' | 'studyplan'
 *
 * Task 15 — extracted from monolith lines 1648–1817:
 *   animateOrbits      → line 1650
 *   toggleSidebar      → line 1662
 *   handleLogoClick    → line 1677
 *   expandSidebar      → line 1688  (legacy alias)
 *   showScreen         → line 1692
 *   restoreScreen IIFE → line 1781
 */

import { ssGet, ssSet, ssRemove, lsRemove } from '../utils/storage.js';

// ── Sidebar animation ──────────────────────────────────────────────────────

/**
 * Animate the SVG orbit ellipses in the logo when the sidebar expands.
 * No-ops when collapsing (keeps the compact logo shape).
 *
 * @param {HTMLElement} sidebar
 * @param {boolean}     toCompact  true = collapsing, false = expanding
 */
export function animateOrbits(sidebar, toCompact) {
  if (toCompact) return;
  const orbits = sidebar.querySelectorAll('.logo-mark .orbit');
  const fromRx = 6, toRx = 40;
  const fromRy = 6, toRy = 14;
  const dur = 420, start = performance.now();
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function step(now) {
    const t = ease(Math.min((now - start) / dur, 1));
    const rx = fromRx + (toRx - fromRx) * t;
    const ry = fromRy + (toRy - fromRy) * t;
    orbits.forEach(el => { el.setAttribute('rx', rx); el.setAttribute('ry', ry); });
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Sidebar compact toggle ─────────────────────────────────────────────────

/**
 * Toggle the compact/expanded state of all sidebars in the document.
 * Applies to every `.sidebar` element so state is consistent across screens.
 *
 * @param {HTMLElement} el  The sidebar element or any child of it.
 */
export function toggleSidebar(el) {
  const sidebar = el.classList.contains('sidebar') ? el : el.closest('.sidebar');
  const toCompact = !sidebar.classList.contains('compact');
  document.querySelectorAll('.sidebar').forEach(s => s.classList.toggle('compact', toCompact));
  animateOrbits(sidebar, toCompact);
}

// ── Logo click ─────────────────────────────────────────────────────────────

/**
 * If the sidebar is compact, expand it.
 * If already expanded, navigate to the home screen via goHome().
 *
 * @param {HTMLElement} el  The logo element that was clicked.
 */
export function handleLogoClick(el) {
  const sidebar = el.closest('.sidebar');
  if (sidebar.classList.contains('compact')) {
    document.querySelectorAll('.sidebar').forEach(s => s.classList.remove('compact'));
    animateOrbits(sidebar, false);
  } else {
    // goHome() is defined in the monolith and will be moved to HomeScreen (Task 25).
    // Call through window so this module doesn't create a circular dependency.
    if (typeof window.goHome === 'function') window.goHome();
  }
}

/** @deprecated Use handleLogoClick. Kept for any remaining legacy call sites. */
export function expandSidebar(el) {
  if (typeof window.goHome === 'function') window.goHome();
}

// ── showScreen ─────────────────────────────────────────────────────────────

/**
 * Navigate to a named screen.
 *
 * - Hides all `.screen` elements, shows `#screen-<name>`
 * - Preserves the compact-sidebar state across screens
 * - Updates `.sidebar-item` active highlights on ALL sidebars
 * - Persists the active screen name to sessionStorage
 * - Runs screen-specific init callbacks (flash, research, exam, studyplan)
 * - Cancels the research outline-generation timer when leaving that screen
 *
 * @param {'home'|'workspace'|'flash'|'research'|'exam'|'studyplan'} name
 */
export function showScreen(name) {
  const screens    = document.querySelectorAll('.screen');
  const wasCompact = !!document.querySelector('.sidebar.compact');

  // Cancel research outline-generation timer when navigating away
  if (name !== 'research' &&
      typeof window._stageTimerHandle !== 'undefined' &&
      window._stageTimerHandle) {
    clearInterval(window._stageTimerHandle);
    window._stageTimerHandle = null;
  }

  // Hide all screens, show target
  screens.forEach(s => s.classList.remove('active'));

  const target = document.getElementById('screen-' + name);
  if (!target) return;
  target.classList.add('active');
  target.style.animation = 'none';
  requestAnimationFrame(() => { target.style.animation = ''; });

  // Preserve compact sidebar across screens
  if (wasCompact) {
    const newSidebar = target.querySelector('.sidebar');
    if (newSidebar) newSidebar.classList.add('compact');
  }

  // Sidebar active highlight — map each screen to its trigger identifier
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
    const isActive =
      oc === activeOnclick ||
      ds === name ||
      (name === 'home' && (oc === "goHome()" || oc === "handleLogoClick(this)" || da === 'goHome')) ||
      (name !== 'home' && da === 'showScreen' && ds === name);
    item.classList.toggle('active', isActive);
    item.style.background = isActive ? 'var(--gold-muted)' : '';
    item.style.color      = isActive ? 'var(--gold)'       : '';
  });

  // Persist for refresh restore
  ssSet('chunks_active_screen', name);

  // ── Screen-specific init ───────────────────────────────────────────────
  if (name === 'flash') {
    if (typeof window._fcRenderDeckList === 'function') {
      // Render immediately from localStorage — never blank on refresh
      window._fcRenderDeckList().catch(() => {});
      // Once auth settles, re-render to merge in Supabase decks
      const _waitForAuth = (attempts) => {
        if (window._currentUser?.id) {
          window._fcRenderDeckList().catch(() => {});
        } else if (attempts > 0) {
          setTimeout(() => _waitForAuth(attempts - 1), 200);
        }
      };
      _waitForAuth(15); // up to 3 seconds
    }
  }

  if (name === 'research') {
    if (typeof window._load === 'function') {
      window._load();
      if (typeof window._renderRecentList === 'function') window._renderRecentList();
      if (window.RS?.started && typeof window._showResearchView === 'function') window._showResearchView();
    }
  }

  if (name === 'exam') {
    if (typeof window.initExamSidebar === 'function') window.initExamSidebar();
  }

  if (name === 'studyplan') {
    if (typeof window.spInitScreen === 'function') window.spInitScreen();
  }
}

// ── Bootstrap: restore screen on page load ─────────────────────────────────

/**
 * Called once at module load time.
 * Detects whether this is a fresh open or a tab refresh and restores the
 * correct screen accordingly.
 *
 * Fresh open  → show home screen, clear active-session pointer
 * Refresh     → restore the last active screen (and library modal if open)
 */
(function restoreScreen() {
  // 'chunks_was_here' is set by the beforeunload listener below.
  // Present = tab refresh.  Absent = fresh open.
  const isRefresh = ssGet('chunks_was_here') === '1';

  if (isRefresh) {
    const last = ssGet('chunks_active_screen');
    if (last && document.getElementById('screen-' + last)) {
      showScreen(last);
    }

    // Restore the library modal if it was open before the refresh
    if (ssGet('chunks_library_open') === '1') {
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

    ssSet('chunks_is_refresh', '1');
  } else {
    showScreen('home');
    ssRemove('chunks_is_refresh');
    // On fresh open clear only the active-session pointer — sidebar still
    // shows all past chats but none is pre-highlighted
    lsRemove('chunks_active_recent_id');
  }

  // Mark this tab as having been visited — survives refresh, cleared on fresh open
  window.addEventListener('beforeunload', () => {
    ssSet('chunks_was_here', '1');
  });
})();

// ── Legacy window globals ──────────────────────────────────────────────────
// Keep all call sites in the monolith and inline onclick= handlers working
// until Phase 5 replaces them screen-by-screen.

window.showScreen     = showScreen;
window.toggleSidebar  = toggleSidebar;
window.handleLogoClick = handleLogoClick;
window.expandSidebar  = expandSidebar;
window.animateOrbits  = animateOrbits;
