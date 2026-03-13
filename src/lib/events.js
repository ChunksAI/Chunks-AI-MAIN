/**
 * src/lib/events.js — Global data-action event delegation  (Task 34)
 *
 * Single click listener on document dispatches every [data-action] button
 * to the correct window.* function with the right arguments.
 */

document.addEventListener('click', function (e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  const raw    = el.dataset.action || '';
  const screen = el.dataset.screen || '';

  // Strip -self / -text suffix
  const isSelf = raw.endsWith('-self');
  const isText = raw.endsWith('-text');
  const action = raw.replace(/-self$/, '').replace(/-text$/, '');

  // ── Special cases that don't need window.* ──────────────────────────

  if (action === 'mobileNav') {
    if (screen === 'more') { _openMobileDrawer(); }
    else if (screen && typeof window.showScreen === 'function') {
      window.showScreen(screen); _syncMobileNav(screen);
    }
    return;
  }

  if (action === 'drawerNav') {
    _closeMobileDrawer();
    if (screen === 'library') { if (typeof window.openLibraryModal === 'function') window.openLibraryModal(); }
    else if (screen && typeof window.showScreen === 'function') { window.showScreen(screen); _syncMobileNav(screen); }
    return;
  }

  if (action === 'closeMobileDrawer') { _closeMobileDrawer(); return; }

  if (action === 'mobileUpgrade') {
    _closeMobileDrawer();
    if (typeof window.openUpgradeModal === 'function') window.openUpgradeModal();
    return;
  }

  // ── Look up window function ─────────────────────────────────────────
  const fn = window[action];
  if (typeof fn !== 'function') return;

  // ── Dispatch with correct args per function signature ───────────────

  if (action === 'settingsNav')               { fn(el.dataset.nav || '', el); return; }
  if (action === 'settingsFontSize')           { fn(el.dataset.size || '', el); return; }
  if (action === 'settingsDropdown')           { fn(el); return; }
  if (action === 'settingsSelect')             { fn(el); return; }
  if (action === 'settingsSelectAccent')       { fn(el); return; }
  if (action === 'settingsSelectVoice')        { fn(el); return; }
  if (action === 'settingsSelectDefaultBook')  { fn(el); return; }
  if (action === 'settingsSelectStudyMode')    { fn(el); return; }
  if (action === 'pdAction')                   { fn(el.dataset.pd || ''); return; }
  if (action === 'showScreen')                 { fn(screen); return; }
  if (action === 'selectBook')                 { fn(el.dataset.bookid || el.dataset.book || el.dataset.id || ''); return; }
  if (action === 'researchSelectLayer')        { fn(el.dataset.layer || el.textContent.trim()); return; }
  if (action === 'homeSetInput')               { fn(el.dataset.text || el.textContent.trim()); return; }
  if (action === 'wsSetInput')                 { fn(el.dataset.text || el.textContent.trim()); return; }
  if (action === 'searchChip')                 { fn(el.textContent.trim()); return; }
  if (action === 'spDrawerTab')                { fn(el.dataset.tab || ''); return; }
  if (action === 'spSetDepth')                 { fn(el.dataset.depth || el.textContent.trim()); return; }
  if (action === 'spSwitchTab')                { fn(el.dataset.tab || el.textContent.trim()); return; }
  if (action === 'switchResearchTab')          { fn(el.dataset.tab || ''); return; }
  if (action === 'switchCitTab')               { fn(el.dataset.tab || ''); return; }
  if (action === 'handleLogoClick')            { fn(el); return; }
  if (action === 'toggleSidebar')              { fn(el); return; }
  if (action === 'toggleProfileDropdown') {
    // toggleProfileDropdown expects a real event with currentTarget
    const syntheticE = { stopPropagation: () => e.stopPropagation(), currentTarget: el };
    fn(syntheticE); return;
  }
  if (action === 'toggleFAQ')                  { fn(el); return; }
  if (action === 'roToggleSection')            { fn(el); return; }
  if (action === 'filterLibSection')           { fn(el); return; }
  if (action === 'examSelectType')             { fn(el); return; }
  if (action === 'examSelectDiff')             { fn(el); return; }
  if (action === 'examSelectScanMode')         { fn(el); return; }
  if (action === 'examSrcTab')                 { fn(el); return; }
  if (action === '_fcNext')                    { fn(el.dataset.rate || undefined); return; }

  // Default
  if (isSelf || fn.length > 0) { fn(el); } else { fn(); }

}, true);

// ── Mobile drawer helpers ────────────────────────────────────────────────

function _openMobileDrawer() {
  document.getElementById('mobile-drawer')?.classList.add('open');
  document.getElementById('mobile-drawer-overlay')?.classList.add('open');
}

function _closeMobileDrawer() {
  document.getElementById('mobile-drawer')?.classList.remove('open');
  document.getElementById('mobile-drawer-overlay')?.classList.remove('open');
}

function _syncMobileNav(screen) {
  document.querySelectorAll('.mobile-nav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.screen === screen));
  document.querySelectorAll('.md-item').forEach(i =>
    i.classList.toggle('active', i.dataset.screen === screen));
}

window.openMobileDrawer  = _openMobileDrawer;
window.closeMobileDrawer = _closeMobileDrawer;

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#mobile-menu-btn, .mobile-menu-btn').forEach(btn =>
    btn.addEventListener('click', _openMobileDrawer));
});

console.log('[events.js] Global data-action delegation active');
