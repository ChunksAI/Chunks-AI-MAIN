/**
 * src/components/ProfileDropdown.js — Profile Dropdown component
 *
 * Owns all JavaScript for the profile dropdown menu, including:
 *   - open/close state and positioning
 *   - "Help" and "Terms & policies" fly-out submenus
 *   - outside-click and Escape key handlers
 *   - pdAction() dispatcher
 *
 * The static HTML (`#profile-dropdown`, `#pd-help-submenu`,
 * `#pd-terms-submenu`) remains in index.html until Task 37/38.
 *
 * Exports
 * ───────
 *   toggleProfileDropdown(e)
 *   pdAction(action)
 *   pdOpenHelp(e)
 *   pdToggleHelp(e)
 *   pdOpenTerms(e)
 *
 * window globals set
 * ──────────────────
 *   window.toggleProfileDropdown
 *   window.pdAction
 *   window.pdOpenHelp  window.pdToggleHelp  window.pdHelpMouseLeave
 *   window.pdOpenTerms window.pdTermsMouseLeave
 *
 * Task 22 — extracted from monolith lines 4336–4541:
 *   state vars _pdOpen … _termsCloseTimer
 *   toggleProfileDropdown, _closeHelp, _openHelpSubmenu, pdOpenHelp,
 *   pdHelpMouseLeave, pdToggleHelp, _openTermsSubmenu, _closeTerms,
 *   pdOpenTerms, pdTermsMouseLeave, outside-click listener,
 *   Escape listener, pdAction
 */

// ── State ──────────────────────────────────────────────────────────────────

let _pdOpen      = false;
let _pdHelpOpen  = false;
let _helpCloseTimer  = null;
let _pdTermsOpen = false;
let _termsCloseTimer = null;

// ── Helpers ────────────────────────────────────────────────────────────────

function _closeHelp() {
  _pdHelpOpen = false;
  document.getElementById('pd-help-submenu')?.classList.remove('open');
  document.getElementById('pd-help-item')?.classList.remove('active');
}

function _openHelpSubmenu() {
  _pdHelpOpen = true;
  const sub  = document.getElementById('pd-help-submenu');
  const item = document.getElementById('pd-help-item');
  if (!sub || !item) return;
  sub.classList.add('open');
  item.classList.add('active');

  const ddRect   = document.getElementById('profile-dropdown').getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  sub.style.position    = 'fixed';
  sub.style.left        = (ddRect.right + 2) + 'px';
  sub.style.paddingLeft = '';
  sub.style.bottom      = (window.innerHeight - itemRect.bottom) + 'px';
  sub.style.top         = 'auto';
  sub.style.right       = 'auto';
}

function _openTermsSubmenu() {
  _pdTermsOpen = true;
  const item = document.getElementById('pd-terms-item');
  const sub  = document.getElementById('pd-terms-submenu');
  if (!item || !sub) return;
  const rect = item.getBoundingClientRect();
  sub.style.bottom      = (window.innerHeight - rect.bottom) + 'px';
  sub.style.top         = 'auto';
  sub.style.left        = (rect.right + 2) + 'px';
  sub.style.paddingLeft = '';
  sub.classList.add('open');
  item.classList.add('active');
}

function _closeTerms() {
  _pdTermsOpen = false;
  clearTimeout(_termsCloseTimer);
  document.getElementById('pd-terms-submenu')?.classList.remove('open');
  document.getElementById('pd-terms-item')?.classList.remove('active');
}

// ── Public API ─────────────────────────────────────────────────────────────

export function toggleProfileDropdown(e) {
  e && e.stopPropagation();
  const dd = document.getElementById('profile-dropdown');
  if (!dd) return;
  _pdOpen = !_pdOpen;
  if (!_pdOpen) { _closeHelp(); _closeTerms(); }
  dd.classList.toggle('open', _pdOpen);

  if (_pdOpen) {
    const trigger   = e?.currentTarget;
    const sidebar   = trigger?.closest('.sidebar');
    const isCompact = sidebar?.classList.contains('compact');

    if (trigger) {
      const rect     = trigger.getBoundingClientRect();
      const ddHeight = 320;
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      if (spaceAbove > ddHeight || spaceAbove > spaceBelow) {
        dd.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
        dd.style.top    = 'auto';
      } else {
        dd.style.top    = (rect.bottom + 6) + 'px';
        dd.style.bottom = 'auto';
      }

      const ddWidth = 230;
      if (rect.left + ddWidth > window.innerWidth - 8) {
        dd.style.left  = 'auto';
        dd.style.right = (window.innerWidth - rect.right) + 'px';
      } else {
        dd.style.left  = isCompact ? '58px' : Math.max(8, rect.left) + 'px';
        dd.style.right = 'auto';
      }
    } else {
      dd.style.left   = isCompact ? '58px' : '10px';
      dd.style.bottom = '60px';
      dd.style.top    = 'auto';
    }
  }
}

export function pdOpenHelp(e) {
  e && e.stopPropagation();
  clearTimeout(_helpCloseTimer);
  _closeTerms();
  _openHelpSubmenu();
}

export function pdHelpMouseLeave(e) {
  // Intentionally empty — closes only on outside click
}

export function pdToggleHelp(e) {
  e && e.stopPropagation();
  if (_pdHelpOpen) _closeHelp(); else _openHelpSubmenu();
}

export function pdOpenTerms(e) {
  e && e.stopPropagation();
  clearTimeout(_termsCloseTimer);
  _openTermsSubmenu();
}

export function pdTermsMouseLeave(e) {
  // Intentionally empty — closes only on outside click
}

export async function pdAction(action) {
  _pdOpen = false;
  _closeHelp();
  _closeTerms();
  const dd = document.getElementById('profile-dropdown');
  if (dd) dd.classList.remove('open');

  switch (action) {
    case 'upgrade':
      if (typeof window.openUpgradeModal === 'function') window.openUpgradeModal();
      break;
    case 'admin':
      if (typeof window.openAdminPanel === 'function') window.openAdminPanel();
      break;
    case 'personalization':
      if (typeof window.openSettings === 'function') window.openSettings('personalization');
      break;
    case 'settings':
      if (typeof window.openSettings === 'function') window.openSettings('general');
      break;
    case 'help-center':
      if (typeof window.openHelpCenter === 'function') window.openHelpCenter();
      break;
    case 'terms':
      window.open('terms.html', '_blank');
      break;
    case 'privacy':
      window.open('privacy.html', '_blank');
      break;
    case 'bug':
      if (typeof window.openBugReport === 'function') window.openBugReport();
      break;
    case 'shortcuts':
      if (typeof window.openShortcuts === 'function') window.openShortcuts();
      break;
    case 'logout': {
      const _userEmail = document.querySelector('.pd-handle')?.textContent?.trim() || '';
      if (typeof window.showConfirmModal === 'function') {
        window.showConfirmModal({
          title:        'Are you sure you want to log out?',
          desc:         _userEmail ? `Log out of Chunks AI as ${_userEmail}?` : 'Log out of Chunks AI?',
          confirmLabel: 'Log out',
          onConfirm:    () => { if (typeof window.chunksSignOut === 'function') window.chunksSignOut(); },
        });
      }
      break;
    }
    default:
      console.warn('[pdAction] Unknown action:', action);
  }
}

// ── Global event listeners ─────────────────────────────────────────────────

// Close on outside click
document.addEventListener('click', e => {
  const dd       = document.getElementById('profile-dropdown');
  const helpSub  = document.getElementById('pd-help-submenu');
  const termsSub = document.getElementById('pd-terms-submenu');
  if (!dd) return;

  if (_pdHelpOpen && helpSub &&
      !helpSub.contains(e.target) && !dd.contains(e.target) &&
      !(termsSub && termsSub.contains(e.target))) {
    _closeHelp();
  }
  if (_pdTermsOpen && termsSub &&
      !termsSub.contains(e.target) &&
      !(helpSub && helpSub.contains(e.target)) &&
      !dd.contains(e.target)) {
    _closeTerms();
  }
  if (_pdOpen && !dd.contains(e.target) &&
      !(helpSub && helpSub.contains(e.target)) &&
      !(termsSub && termsSub.contains(e.target))) {
    _pdOpen = false;
    _closeHelp();
    _closeTerms();
    dd.classList.remove('open');
  }
});

// Escape key
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('confirm-modal')?.style.display === 'flex') return;
  if (_pdHelpOpen)  { _closeHelp();  return; }
  if (_pdTermsOpen) { _closeTerms(); return; }
  if (_pdOpen) {
    _pdOpen = false;
    document.getElementById('profile-dropdown')?.classList.remove('open');
  }
});

// Close help/terms submenus when hovering a different main-menu item
document.addEventListener('mouseover', e => {
  const item = e.target.closest('.pd-item');
  if (!item) return;
  if (item.closest('#pd-help-submenu') || item.closest('#pd-terms-submenu')) return;
  if (item.closest('.pd-menu') && item.id !== 'pd-help-item' && item.id !== 'pd-terms-item') {
    _closeHelp();
    _closeTerms();
  }
}, false);

// ── Legacy window globals ──────────────────────────────────────────────────

window.toggleProfileDropdown = toggleProfileDropdown;
window.pdAction              = pdAction;
window.pdOpenHelp            = pdOpenHelp;
window.pdHelpMouseLeave      = pdHelpMouseLeave;
window.pdToggleHelp          = pdToggleHelp;
window.pdOpenTerms           = pdOpenTerms;
window.pdTermsMouseLeave     = pdTermsMouseLeave;
