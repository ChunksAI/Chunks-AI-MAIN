/**
 * src/components/ProfileDropdown.js — Task 22
 *
 * Owns the profile dropdown, help submenu, and terms submenu.
 *
 * Previously in index.html:
 *   • #pd-help-submenu + #pd-terms-submenu  HTML elements (~lines 2426–2464)
 *   • #profile-dropdown                     HTML element  (~line 8663)
 *   • toggleProfileDropdown / pdAction / submenu logic  JS block (~lines 2646–2854)
 *
 * window bridges set here:
 *   window.toggleProfileDropdown
 *   window.pdAction
 *   window.pdOpenHelp
 *   window.pdToggleHelp
 *   window.pdOpenTerms
 *   window._closeHelp    — used by delegated hover handler in index.html
 *   window._closeTerms   — used by delegated hover handler in index.html
 */

// ── HTML templates ────────────────────────────────────────────────────────────

const HELP_SUBMENU_HTML = `
<div class="pd-submenu" id="pd-help-submenu">
  <div class="pd-menu">
    <div class="pd-item" onclick="pdAction('help-center')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
      Help center
    </div>
    <div class="pd-item" onclick="pdAction('bug')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 4-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17 17c2.3.1 4 1.9 4 4"/></svg>
      Report a bug
    </div>
    <div class="pd-item" onclick="pdAction('shortcuts')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>
      Keyboard shortcuts
    </div>
    <div class="pd-item" id="pd-terms-item">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      Terms &amp; policies
      <svg class="pd-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-left:auto;" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  </div>
</div>`;

const TERMS_SUBMENU_HTML = `
<div class="pd-submenu" id="pd-terms-submenu">
  <div class="pd-menu">
    <div class="pd-item" onclick="pdAction('terms')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      Terms of Service
    </div>
    <div class="pd-item" onclick="pdAction('privacy')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Privacy Policy
    </div>
  </div>
</div>`;

const DROPDOWN_HTML = `
<div class="profile-dropdown" id="profile-dropdown" role="menu" aria-label="Profile menu">
  <div class="pd-header" role="presentation">
    <div class="pd-avatar" aria-hidden="true"></div>
    <div>
      <div class="pd-name"></div>
      <div class="pd-handle"></div>
    </div>
  </div>
  <div class="pd-menu">
    <div class="pd-item upgrade" role="menuitem" tabindex="0" onclick="pdAction('upgrade')" onkeydown="if(event.key==='Enter'||event.key===' ')pdAction('upgrade')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      Upgrade plan
    </div>
    <div class="pd-item" id="pd-admin-btn" role="menuitem" tabindex="0" onclick="pdAction('admin')" style="display:none;color:#ff6b6b;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Admin Panel
    </div>
    <div class="pd-divider" role="separator"></div>
    <div class="pd-item" role="menuitem" tabindex="0" onclick="pdAction('personalization')" onkeydown="if(event.key==='Enter'||event.key===' ')pdAction('personalization')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
      Personalization
    </div>
    <div class="pd-item" role="menuitem" tabindex="0" onclick="pdAction('settings')" onkeydown="if(event.key==='Enter'||event.key===' ')pdAction('settings')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      Settings
    </div>
    <div class="pd-item" role="menuitem" tabindex="0" onclick="pdAction('incognito')" onkeydown="if(event.key==='Enter'||event.key===' ')pdAction('incognito')" id="pd-incognito-item">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      Incognito Chat
      <span class="pd-incognito-badge">Private</span>
    </div>
    <div class="pd-divider" role="separator"></div>
    <div class="pd-item" id="pd-help-item" role="menuitem" tabindex="0" aria-haspopup="true" onkeydown="if(event.key==='Enter'||event.key===' ')pdOpenHelp(event)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
      Help
      <svg class="pd-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </div>
    <div class="pd-item danger" role="menuitem" tabindex="0" onclick="pdAction('logout')" onkeydown="if(event.key==='Enter'||event.key===' ')pdAction('logout')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Log out
    </div>
  </div>
</div>`;

// ── Inject HTML on DOMContentLoaded ───────────────────────────────────────────

function _injectHTML() {
  if (document.getElementById('profile-dropdown')) return;

  const tmp = document.createElement('div');

  tmp.innerHTML = HELP_SUBMENU_HTML;
  document.body.appendChild(tmp.firstElementChild);

  tmp.innerHTML = TERMS_SUBMENU_HTML;
  document.body.appendChild(tmp.firstElementChild);

  tmp.innerHTML = DROPDOWN_HTML;
  document.body.appendChild(tmp.firstElementChild);

  _attachSubmenuListeners();
}

document.addEventListener('DOMContentLoaded', _injectHTML);

// ── State ─────────────────────────────────────────────────────────────────────

let _pdOpen      = false;
let _pdHelpOpen  = false;
let _pdTermsOpen = false;
let _helpCloseTimer  = null;
let _termsCloseTimer = null;

// ── Toggle main dropdown ──────────────────────────────────────────────────────

export function toggleProfileDropdown(e) {
  e && e.stopPropagation();
  const dd = document.getElementById('profile-dropdown');
  if (!dd) return;

  _pdOpen = !_pdOpen;
  if (!_pdOpen) { _closeHelp(); _closeTerms(); }
  dd.classList.toggle('open', _pdOpen);

  if (_pdOpen) {
    const trigger  = e?.currentTarget;
    const sidebar  = trigger?.closest('.sidebar');
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
      dd.style.left = isCompact ? '58px' : Math.max(8, rect.left) + 'px';
      const ddWidth = 230;
      if (rect.left + ddWidth > window.innerWidth - 8) {
        dd.style.left  = 'auto';
        dd.style.right = (window.innerWidth - rect.right) + 'px';
      } else {
        dd.style.right = 'auto';
      }
    } else {
      dd.style.left   = isCompact ? '58px' : '10px';
      dd.style.bottom = '60px';
      dd.style.top    = 'auto';
    }
  }
}

// ── Help submenu ──────────────────────────────────────────────────────────────

export function _closeHelp() {
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

export function pdOpenHelp(e) {
  e && e.stopPropagation();
  clearTimeout(_helpCloseTimer);
  _closeTerms();
  _openHelpSubmenu();
}

export function pdToggleHelp(e) {
  e && e.stopPropagation();
  if (_pdHelpOpen) _closeHelp(); else _openHelpSubmenu();
}

// ── Terms submenu ─────────────────────────────────────────────────────────────

export function _closeTerms() {
  _pdTermsOpen = false;
  clearTimeout(_termsCloseTimer);
  document.getElementById('pd-terms-submenu')?.classList.remove('open');
  document.getElementById('pd-terms-item')?.classList.remove('active');
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

export function pdOpenTerms(e) {
  e && e.stopPropagation();
  clearTimeout(_termsCloseTimer);
  _openTermsSubmenu();
}

// ── Click / keyboard outside listeners ───────────────────────────────────────

document.addEventListener('click', function (e) {
  const dd       = document.getElementById('profile-dropdown');
  const helpSub  = document.getElementById('pd-help-submenu');
  const termsSub = document.getElementById('pd-terms-submenu');
  if (!dd) return;

  if (_pdHelpOpen && !helpSub?.contains(e.target) && !dd.contains(e.target) && !termsSub?.contains(e.target)) {
    _closeHelp();
  }
  if (_pdTermsOpen && !termsSub?.contains(e.target) && !helpSub?.contains(e.target) && !dd.contains(e.target)) {
    _closeTerms();
  }
  if (_pdOpen && !dd.contains(e.target) && !helpSub?.contains(e.target) && !termsSub?.contains(e.target)) {
    _pdOpen = false;
    _closeHelp();
    _closeTerms();
    dd.classList.remove('open');
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (document.getElementById('confirm-modal')?.classList.contains('active')) return;
    if (_pdHelpOpen)  { _closeHelp();  return; }
    if (_pdTermsOpen) { _closeTerms(); return; }
    if (_pdOpen) {
      _pdOpen = false;
      document.getElementById('profile-dropdown')?.classList.remove('open');
    }
  }
});

// ── pdAction ──────────────────────────────────────────────────────────────────

export async function pdAction(action) {
  _pdOpen = false;
  _closeHelp();
  _closeTerms();
  document.getElementById('profile-dropdown')?.classList.remove('open');

  switch (action) {
    case 'upgrade':       window.openUpgradeModal?.();            break;
    case 'admin':         window.location.href = 'admin.html';         break;
    case 'personalization': window.openSettings?.('personalization'); break;
    case 'settings':      window.openSettings?.('general');       break;
    case 'incognito':     window.openIncognitoChat?.();            break;
    case 'help-center':   window.openHelpCenter?.();              break;
    case 'terms':         window.open('terms.html', '_blank');    break;
    case 'privacy':       window.open('privacy.html', '_blank');  break;
    case 'bug':           window.openBugReport?.();               break;
    case 'shortcuts':     window.openShortcuts?.();               break;
    case 'logout': {
      const email = document.querySelector('.pd-handle')?.textContent?.trim() || '';
      window.showConfirmModal?.({
        title:        'Are you sure you want to log out?',
        desc:         email ? `Log out of Chunks AI as ${email}?` : 'Log out of Chunks AI?',
        confirmLabel: 'Log out',
        onConfirm:    () => window.chunksSignOut?.()
      });
      break;
    }
    default:
      console.warn('[pdAction] Unknown action:', action);
  }
}

// ── Submenu hover listeners (attached after inject) ───────────────────────────

function _attachSubmenuListeners() {
  const helpItem  = document.getElementById('pd-help-item');
  const termsItem = document.getElementById('pd-terms-item');
  const helpSub   = document.getElementById('pd-help-submenu');
  const termsSub  = document.getElementById('pd-terms-submenu');
  const mainDd    = document.getElementById('profile-dropdown');

  // ── Help item in main dropdown → open help submenu ────────────────────────
  if (helpItem) helpItem.addEventListener('mouseenter', e => pdOpenHelp(e));

  // ── Terms item inside help submenu → open terms submenu ───────────────────
  if (termsItem) termsItem.addEventListener('mouseenter', e => {
    clearTimeout(_termsCloseTimer);
    _openTermsSubmenu();
  });

  // ── Hovering any OTHER item in the main dropdown closes both submenus ─────
  // Use mouseenter on each main-dropdown item individually so we never
  // accidentally fire on submenu items (mouseover bubbles up through the DOM
  // and can't be reliably filtered when submenus are appended to <body>).
  if (mainDd) {
    mainDd.querySelectorAll('.pd-item').forEach(item => {
      if (item.id === 'pd-help-item') return; // handled above
      item.addEventListener('mouseenter', () => {
        _closeHelp();
        _closeTerms();
      });
    });
  }

  // ── Hovering items inside the help submenu (not Terms) closes terms ────────
  if (helpSub) {
    helpSub.querySelectorAll('.pd-item').forEach(item => {
      if (item.id === 'pd-terms-item') return; // handled above
      item.addEventListener('mouseenter', () => {
        _closeTerms();
      });
    });
  }

  // ── Keep submenus open while mouse is inside them ─────────────────────────
  if (helpSub) {
    helpSub.addEventListener('mouseleave', () => {
      _helpCloseTimer = setTimeout(() => {
        if (!_pdTermsOpen) _closeHelp();
      }, 120);
    });
    helpSub.addEventListener('mouseenter', () => {
      clearTimeout(_helpCloseTimer);
    });
  }

  if (termsSub) {
    termsSub.addEventListener('mouseleave', () => {
      _termsCloseTimer = setTimeout(_closeTerms, 120);
    });
    termsSub.addEventListener('mouseenter', () => {
      clearTimeout(_termsCloseTimer);
    });
  }
}

// ── Window bridges ────────────────────────────────────────────────────────────

window.toggleProfileDropdown = toggleProfileDropdown;
window.pdAction              = pdAction;
window.pdOpenHelp            = pdOpenHelp;
window.pdToggleHelp          = pdToggleHelp;
window.pdOpenTerms           = pdOpenTerms;
window._closeHelp            = _closeHelp;
window._closeTerms           = _closeTerms;

// ── Upgrade modal ─────────────────────────────────────────────────────────────
// These were lost during monolith migration — restored in Task 38 smoke test.
// The upgrade modal uses .active class to show/hide (see src/styles/modals.css).

window.openUpgradeModal = function openUpgradeModal() {
  document.getElementById('upgrade-modal')?.classList.add('active');
};

window.closeUpgradeModal = function closeUpgradeModal() {
  document.getElementById('upgrade-modal')?.classList.remove('active');
};

window.handleUpgradeClick = function handleUpgradeClick(plan) {
  window.closeUpgradeModal();
  // TODO: wire up payment / billing redirect when ready
  console.log('[upgrade] plan selected:', plan);
  if (typeof wsShowToast === 'function') {
    wsShowToast('⭐', `${plan === 'ultra' ? 'Ultra' : 'Pro'} — payment coming soon!`, 'var(--gold-border)');
  }
};
