/**
 * src/components/HelpBugShortcutsModals.js
 *
 * Wires up the three utility modals whose HTML already exists in index.html
 * but had zero JavaScript:
 *
 *   #help-modal         — Help Center (FAQ accordion + search)
 *   #bug-modal          — Bug Report (category picker + textarea + submit)
 *   #shortcuts-modal    — Keyboard Shortcuts (static list)
 *
 * window globals set
 * ──────────────────
 *   window.openHelpCenter      open #help-modal
 *   window.closeHelpCenter     close #help-modal
 *   window.filterFAQs(q)       live-search the FAQ items
 *   window.toggleFAQ(el)       accordion open/close for a single .faq-item
 *   window.showSupportEmail    show the support email in a toast / alert
 *
 *   window.openBugReport       open #bug-modal
 *   window.closeBugReport      close #bug-modal
 *   window.submitBugReport     validate + submit via api.js submitBugReport()
 *
 *   window.openShortcuts       open #shortcuts-modal
 *   window.closeShortcuts      close #shortcuts-modal
 */

import { submitBugReport as _apiBugReport } from '../lib/api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Toggle .active class and manage focus-trap for any modal. */
function _openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
  if (typeof window.trapFocus === 'function') {
    el._releaseFocus = window.trapFocus(el);
  }
  document.addEventListener('keydown', _globalEscape);
}

function _closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active');
  if (typeof el._releaseFocus === 'function') {
    el._releaseFocus();
    el._releaseFocus = null;
  }
  // Only remove the listener when ALL three modals are closed
  if (!_anyOpen()) {
    document.removeEventListener('keydown', _globalEscape);
  }
}

function _anyOpen() {
  return ['help-modal', 'bug-modal', 'shortcuts-modal'].some(
    id => document.getElementById(id)?.classList.contains('active')
  );
}

function _globalEscape(e) {
  if (e.key !== 'Escape') return;
  if (document.getElementById('shortcuts-modal')?.classList.contains('active')) { closeShortcuts(); return; }
  if (document.getElementById('bug-modal')?.classList.contains('active'))       { closeBugReport(); return; }
  if (document.getElementById('help-modal')?.classList.contains('active'))      { closeHelpCenter(); return; }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELP CENTER
// ─────────────────────────────────────────────────────────────────────────────

export function openHelpCenter() {
  _openModal('help-modal');
  // Reset search on open
  const input = document.getElementById('help-search-input');
  if (input) { input.value = ''; filterFAQs(''); }
}

export function closeHelpCenter() {
  _closeModal('help-modal');
}

/**
 * Live-filter FAQ items by query string.
 * Hides any .faq-item whose question + answer text doesn't match.
 * Shows the empty-state div when nothing matches.
 */
export function filterFAQs(query) {
  const q = (query || '').toLowerCase().trim();
  const items = document.querySelectorAll('#help-body .faq-item');
  const noResults = document.getElementById('faq-no-results');
  const labels = document.querySelectorAll('#help-body .help-section-label');
  let anyVisible = false;

  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    const match = !q || text.includes(q);
    item.style.display = match ? '' : 'none';
    if (match) anyVisible = true;
  });

  // Hide section labels when nothing underneath them is visible
  labels.forEach(label => {
    let next = label.nextElementSibling;
    let hasVisible = false;
    while (next && !next.classList.contains('help-section-label')) {
      if (next.classList.contains('faq-item') && next.style.display !== 'none') {
        hasVisible = true;
      }
      next = next.nextElementSibling;
    }
    label.style.display = hasVisible ? '' : 'none';
  });

  if (noResults) noResults.style.display = anyVisible ? 'none' : 'block';
}

/**
 * Toggle a single FAQ accordion item open/closed.
 * Accepts the clicked .faq-q element (data-action="toggleFAQ-self").
 */
export function toggleFAQ(el) {
  const item = el.closest('.faq-item');
  if (!item) return;
  const isOpen = item.classList.contains('open');
  // Close all others first (optional accordion behaviour)
  item.closest('#help-body')?.querySelectorAll('.faq-item.open').forEach(i => {
    if (i !== item) i.classList.remove('open');
  });
  item.classList.toggle('open', !isOpen);
}

/** Show the support email address via toast or alert. */
export function showSupportEmail() {
  const email = 'support@chunks.ai';
  if (typeof window._showToast === 'function') {
    window._showToast('✉', `Email us at ${email}`, 'var(--gold-border)');
  } else if (typeof window.wsShowToast === 'function') {
    window.wsShowToast('✉', `Email us at ${email}`, 'var(--gold-border)');
  } else {
    alert(`Contact us at ${email}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUG REPORT
// ─────────────────────────────────────────────────────────────────────────────

/** Currently selected category label */
let _bugCategory = 'UI / Display';

export function openBugReport() {
  _openModal('bug-modal');
  // Reset form
  const desc = document.getElementById('bug-description');
  if (desc) desc.value = '';
  _bugCategory = 'UI / Display';
  // Reset category buttons
  document.querySelectorAll('#bug-cat-row .bug-cat-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === 0);
  });
  _setBugSubmitState(false);
}

export function closeBugReport() {
  _closeModal('bug-modal');
}

/** Called when a category pill is clicked (delegated via DOMContentLoaded below). */
function _selectBugCategory(btn) {
  document.querySelectorAll('#bug-cat-row .bug-cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _bugCategory = btn.dataset.cat || btn.textContent.trim();
}

function _setBugSubmitState(loading) {
  const btn = document.getElementById('bug-submit-btn');
  if (!btn) return;
  btn.disabled = loading;
  btn.querySelector('svg') && (btn.querySelector('svg').style.display = loading ? 'none' : '');
  const span = btn.childNodes[btn.childNodes.length - 1];
  if (span && span.nodeType === Node.TEXT_NODE) {
    span.textContent = loading ? ' Sending…' : ' Send Report';
  }
}

export async function submitBugReport() {
  const desc = (document.getElementById('bug-description')?.value || '').trim();
  if (!desc) {
    document.getElementById('bug-description')?.focus();
    return;
  }

  _setBugSubmitState(true);

  try {
    await _apiBugReport({
      category:    _bugCategory,
      description: desc,
      user:        window._currentUser || null,
    });
    closeBugReport();
    if (typeof window._showToast === 'function') {
      window._showToast('✓', 'Bug report sent — thanks!', 'var(--green)');
    } else if (typeof window.wsShowToast === 'function') {
      window.wsShowToast('✓', 'Bug report sent — thanks!', 'var(--green)');
    }
  } catch (err) {
    console.error('[BugReport] Submit failed:', err);
    _setBugSubmitState(false);
    if (typeof window._showToast === 'function') {
      window._showToast('⚠', 'Could not send report — try again.', '#f87171');
    } else if (typeof window.wsShowToast === 'function') {
      window.wsShowToast('⚠', 'Could not send report — try again.', '#f87171');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

export function openShortcuts() {
  _openModal('shortcuts-modal');
}

export function closeShortcuts() {
  _closeModal('shortcuts-modal');
}

// ─────────────────────────────────────────────────────────────────────────────
// DOMContentLoaded wiring
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Category pill clicks inside the bug report modal
  document.getElementById('bug-cat-row')?.addEventListener('click', e => {
    const btn = e.target.closest('.bug-cat-btn');
    if (btn) _selectBugCategory(btn);
  });

  // Enable/disable submit button as user types
  document.getElementById('bug-description')?.addEventListener('input', function () {
    const btn = document.getElementById('bug-submit-btn');
    if (btn) btn.disabled = this.value.trim().length === 0;
  });

  // Backdrop clicks — close when clicking the dark overlay, not the inner card
  document.getElementById('help-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('help-modal')) closeHelpCenter();
  });
  document.getElementById('bug-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('bug-modal')) closeBugReport();
  });
  document.getElementById('shortcuts-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('shortcuts-modal')) closeShortcuts();
  });

  // Wire the oninput on help search (replaces the inline oninput= attribute)
  const helpSearch = document.getElementById('help-search-input');
  if (helpSearch) {
    helpSearch.addEventListener('input', function () { filterFAQs(this.value); });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Window globals
// ─────────────────────────────────────────────────────────────────────────────

window.openHelpCenter   = openHelpCenter;
window.closeHelpCenter  = closeHelpCenter;
window.filterFAQs       = filterFAQs;
window.toggleFAQ        = toggleFAQ;
window.showSupportEmail = showSupportEmail;

window.openBugReport    = openBugReport;
window.closeBugReport   = closeBugReport;
window.submitBugReport  = submitBugReport;

window.openShortcuts    = openShortcuts;
window.closeShortcuts   = closeShortcuts;

console.log('[HelpBugShortcutsModals] Module ready');
