/**
 * src/components/LibraryModal.js — Library Modal component
 *
 * Owns all JavaScript for the textbook library modal:
 *   - open / close with focus-trap and sessionStorage flag
 *   - dynamic book count computation on open
 *   - search/filter (text query + section pill)
 *   - backdrop-click listener
 *
 * The static HTML (`#library-modal`) remains in index.html until Task 37/38.
 *
 * Exports
 * ───────
 *   openLibraryModal()
 *   closeLibraryModal()
 *   filterLibrary(q)
 *   filterLibSection(section, btn)
 *
 * window globals set
 * ──────────────────
 *   window.openLibraryModal
 *   window.closeLibraryModal
 *   window.filterLibrary
 *   window.filterLibSection
 *
 * Task 23 — extracted from monolith:
 *   _libraryFocusRelease, openLibraryModal, closeLibraryModal → line 2100
 *   filterLibrary, filterLibSection, backdrop listener       → line 2676
 */

// ── State ──────────────────────────────────────────────────────────────────

let _libraryFocusRelease = null;

// ── Open / Close ───────────────────────────────────────────────────────────

export function openLibraryModal() {
  const modal = document.getElementById('library-modal');
  if (!modal) return;
  modal.classList.add('active');
  sessionStorage.setItem('chunks_library_open', '1');

  if (typeof window.trapFocus === 'function') {
    _libraryFocusRelease = window.trapFocus(modal);
  }

  // Dynamically compute book counts
  try {
    const available = modal.querySelectorAll('.library-book-card:not(.lib-coming-soon)').length;
    const totalEl   = document.getElementById('lib-total-count');
    if (totalEl) totalEl.textContent = `· ${available} book${available !== 1 ? 's' : ''}`;

    modal.querySelectorAll('.lib-section').forEach(section => {
      const countEl = section.querySelector('.lib-section-count');
      if (!countEl) return;
      const n = section.querySelectorAll('.library-book-card:not(.lib-coming-soon)').length;
      countEl.textContent = `${n} book${n !== 1 ? 's' : ''}`;
    });
  } catch (e) { /* non-critical — counts stay as fallback text */ }
}

export function closeLibraryModal() {
  const modal = document.getElementById('library-modal');
  if (!modal) return;
  modal.classList.remove('active');
  sessionStorage.removeItem('chunks_library_open');
  if (_libraryFocusRelease) { _libraryFocusRelease(); _libraryFocusRelease = null; }
}

// ── Filter / Search ────────────────────────────────────────────────────────

export function filterLibrary(q) {
  const query = (q || '').toLowerCase();
  document.querySelectorAll('.library-book-card').forEach(card => {
    card.style.display = card.textContent.toLowerCase().includes(query) ? '' : 'none';
  });
  document.querySelectorAll('.lib-section').forEach(sec => {
    const visible = [...sec.querySelectorAll('.library-book-card')].some(c => c.style.display !== 'none');
    sec.style.display = visible ? '' : 'none';
  });
  const emptyEl = document.getElementById('lib-empty-state');
  if (emptyEl) {
    emptyEl.style.display =
      [...document.querySelectorAll('.library-book-card')].every(c => c.style.display === 'none')
        ? 'flex' : 'none';
  }
}

export function filterLibSection(section, btn) {
  document.querySelectorAll('.lib-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.lib-section').forEach(sec => {
    sec.style.display = (section === 'all' || sec.dataset.section === section) ? '' : 'none';
  });
}

// ── Backdrop click ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('library-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLibraryModal();
  });
});

// ── Window globals ─────────────────────────────────────────────────────────

window.openLibraryModal   = openLibraryModal;
window.closeLibraryModal  = closeLibraryModal;
window.filterLibrary      = filterLibrary;
window.filterLibSection   = filterLibSection;
