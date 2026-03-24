/**
 * src/state/workspace/library.js — Library filtering
 */

import { $el, $qs, $qsa } from '../domHelpers.js';

// ── Library search filters ────────────────────────────────────────────────

export function filterLibrary(q) {
  const modal = $el('library-modal');
  if (!modal) return;
  const query = q.toLowerCase();
  $qsa('.library-book-card', modal).forEach(card => {
    card.style.display = card.textContent.toLowerCase().includes(query) ? '' : 'none';
  });
  $qsa('.lib-section', modal).forEach(sec => {
    sec.style.display = [...$qsa('.library-book-card', sec)].some(c => c.style.display !== 'none') ? '' : 'none';
  });
  const emptyEl = $el('lib-empty-state');
  if (emptyEl) emptyEl.style.display =
    [...$qsa('.library-book-card', modal)].every(c => c.style.display === 'none') ? 'flex' : 'none';
}

export function filterLibSection(section, btn) {
  const modal = $el('library-modal');
  if (!modal) return;
  $qsa('.lib-pill', modal).forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  $qsa('.lib-section', modal).forEach(sec => {
    sec.style.display = (section === 'all' || sec.dataset.section === section) ? '' : 'none';
  });
}

// Library modal backdrop close
document.addEventListener('DOMContentLoaded', () => {
  $el('library-modal')?.addEventListener('click', function(e) {
    if (e.target === this && typeof closeLibraryModal === 'function') closeLibraryModal();
  });
});
