/**
 * src/state/navigation/mobile.js — Mobile drawer, sidebar toggle, logo
 */

import { $el, $qsa, addClass, removeClass, toggleClass, setAttr }
  from '../domHelpers.js';
import { showScreen } from './screens.js';

// ── Mobile drawer ─────────────────────────────────────────────────────────────

export function openMobileDrawer() {
  const drawer = $el('mobile-drawer');
  const overlay = $el('mobile-drawer-overlay');
  if (drawer) { addClass(drawer, 'open'); setAttr(drawer, 'aria-hidden', 'false'); }
  if (overlay) addClass(overlay, 'open');
  document.body.style.overflow = 'hidden';
}

export function closeMobileDrawer() {
  const drawer = $el('mobile-drawer');
  const overlay = $el('mobile-drawer-overlay');
  if (drawer) { removeClass(drawer, 'open'); setAttr(drawer, 'aria-hidden', 'true'); }
  if (overlay) removeClass(overlay, 'open');
  document.body.style.overflow = '';
}

// ── Sidebar toggle ────────────────────────────────────────────────────────────

export function toggleSidebar() {
  const activeSidebar = document.querySelector('.screen.active .sidebar');
  if (!activeSidebar) return;
  const willCollapse = !activeSidebar.classList.contains('compact');
  $qsa('.sidebar').forEach(sb => {
    toggleClass(sb, 'compact', willCollapse);
  });
  try { sessionStorage.setItem('chunks_sidebar_compact', willCollapse ? '1' : '0'); } catch(e) {}
}

// Restore sidebar compact state on page load
(function _restoreSidebarState() {
  try {
    const compact = sessionStorage.getItem('chunks_sidebar_compact') === '1';
    if (!compact) return;
    const apply = () => $qsa('.sidebar').forEach(sb => addClass(sb, 'compact'));
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply);
    } else {
      apply();
    }
  } catch(e) {}
})();

// ── Logo ──────────────────────────────────────────────────────────────────────

export function handleLogoClick() { showScreen('home'); }
