// @ts-nocheck
import { saveDoc, listDocs, deleteDoc } from '../lib/userDocDb.js';
import { getBookProgress, formatLastStudied, calcReadPct } from '../lib/bookProgress.js';
import { API_BASE } from '../lib/api.js';
import { _loadPdfJs } from '../state/workspace/pdf.js';

/**
 * src/screens/LibraryScreen.js
 *
 * Owns:
 *   • #screen-library HTML injection (replaces data-library-screen placeholder)
 *
 * The library content (book cards, sections, search, pills) is identical to
 * LibraryModal.js but rendered as a full page — no overlay, no close button,
 * no max-height constraint. The sidebar Library nav item points here via
 * showScreen('library').
 *
 * The workspace popup (openLibraryModal) is completely untouched and still
 * works — it pulls from LibraryModal.js as before.
 *
 * Window bridges: none (filterLibrary / filterLibSection live in state/workspace/)
 */

// ── HTML template ─────────────────────────────────────────────────────────────

const LIBRARY_SCREEN_HTML = /* html */`
<div class="screen" id="screen-library">

  <aside class="sidebar" data-sidebar-screen="library"></aside>

  <main class="lib-page-main">

    <!-- Page header -->
    <div class="lib-page-header">
      <div class="lib-page-title-row">
        <div class="lib-page-title-group">
          <div class="lib-title-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            </svg>
          </div>
          <div>
            <h1 class="lib-page-heading">Textbook Library</h1>
            <span class="lib-title-count" id="lib-page-total-count">· 11 books</span>
          </div>
        </div>
      </div>

      <!-- Search -->
      <div class="lib-search-row" style="margin-top:18px;">
        <div class="lib-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input class="lib-search-input" id="lib-page-search" type="text"
                 placeholder="Search textbooks, authors…"
                 oninput="filterLibraryPage(this.value)">
        </div>
      </div>

      <!-- Category pills -->
      <div class="lib-pills" style="margin-top:12px;">
        <button class="lib-pill active" onclick="filterLibPageSection('all',this)">
          <span class="lib-pill-dot" style="background:#8b7cf8"></span>All Courses
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('chemistry',this)">
          <span class="lib-pill-dot" style="background:#22d3ee"></span>Chemistry
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('biology',this)">
          <span class="lib-pill-dot" style="background:#4ade80"></span>Biology
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('nursing',this)">
          <span class="lib-pill-dot" style="background:#f472b6"></span>Nursing
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('physics',this)">
          <span class="lib-pill-dot" style="background:#fb923c"></span>Physics
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('psychology',this)">
          <span class="lib-pill-dot" style="background:#8b5cf6"></span>Psychology
        </button>
      </div>
    </div><!-- /page-header -->

    <!-- Scrollable body -->
    <div class="lib-page-body" id="lib-page-body">

      <!-- ── MY DOCUMENTS ──────────────────────────────────── -->
      <div class="lib-section lib-section--my-docs" data-page-section="my-docs" id="lib-my-docs-section"
           ondragover="libDragOver(event)" ondrop="libDrop(event)" ondragleave="libDragLeave(event)">

        <!-- Section header with inline Upload button -->
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(139,124,248,.1);color:#8b7cf8">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <span class="lib-section-name">My Documents</span>
          <span class="lib-section-count" id="lib-my-docs-count">0 files</span>
          <div class="lib-section-line"></div>
          <!-- Upload button — lives in header, no wasted card slot -->
          <button class="lib-upload-btn" id="lib-upload-btn" onclick="libTriggerUpload()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span id="lib-upload-btn-label">Upload</span>
          </button>
        </div>

        <!-- Upload progress bar — full width, hidden until uploading -->
        <div class="lib-upload-progress" id="lib-upload-progress" style="margin-bottom:0;border-radius:var(--r-pill);overflow:hidden;height:3px;background:var(--surface-4);display:none;">
          <div class="lib-upload-progress-bar" id="lib-upload-progress-bar"></div>
        </div>

        <!-- Drop zone hint — only visible while dragging over -->
        <div class="lib-drop-zone" id="lib-drop-zone">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Drop PDF or PowerPoint here
        </div>

        <!-- Row list — populated by libRenderMyDocs() -->
        <div class="lib-docs-list" id="lib-my-docs-list"></div>

        <!-- Empty state — shown when no docs yet -->
        <div class="lib-docs-empty" id="lib-docs-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.25;color:var(--violet)">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span>Upload a PDF or PowerPoint to study it with AI</span>
        </div>

      </div><!-- /my-docs -->

      <!-- ── CHEMISTRY ────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="chemistry">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(34,211,238,.1);color:#22d3ee">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l1 9H8z"/><path d="M8 12a5 5 0 0 0 8 0"/><path d="M6.7 19.8A2 2 0 0 0 8 21h8a2 2 0 0 0 1.3-3.5L14 12H10z"/></svg>
          </div>
          <span class="lib-section-name">Chemistry</span>
          <span class="lib-section-count">4 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card" onclick="selectBook('zumdahl')">
            <div class="library-book-icon"><img loading="lazy" decoding="async" src="/covers/zumdahl.jpg" alt="General Chemistry cover" onerror="this.parentElement.innerHTML='📗'"></div>
            <div class="lib-book-info"><div class="library-book-title">General Chemistry</div><div class="library-book-author">Zumdahl &amp; Zumdahl</div><div class="library-book-edition">9th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Chemistry</span></div></div>
          </div>
          <div class="library-book-card" onclick="selectBook('atkins')">
            <div class="library-book-icon"><img loading="lazy" decoding="async" src="/covers/atkins.jpg" alt="Physical Chemistry cover" onerror="this.parentElement.innerHTML='📘'"></div>
            <div class="lib-book-info"><div class="library-book-title">Physical Chemistry</div><div class="library-book-author">Atkins &amp; de Paula</div><div class="library-book-edition">8th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Physical Chem</span></div></div>
          </div>
          <div class="library-book-card" onclick="selectBook('klein')">
            <div class="library-book-icon"><img loading="lazy" decoding="async" src="/covers/klein.jpg" alt="Organic Chemistry cover" onerror="this.parentElement.innerHTML='📙'"></div>
            <div class="lib-book-info"><div class="library-book-title">Organic Chemistry</div><div class="library-book-author">David Klein</div><div class="library-book-edition">4th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Organic</span></div></div>
          </div>
          <div class="library-book-card" onclick="selectBook('harris')">
            <div class="library-book-icon"><img loading="lazy" decoding="async" src="/covers/harris.jpg" alt="Quantitative Chemical Analysis cover" onerror="this.parentElement.innerHTML='📒'"></div>
            <div class="lib-book-info"><div class="library-book-title">Quantitative Chemical Analysis</div><div class="library-book-author">Daniel C. Harris</div><div class="library-book-edition">10th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Analytical</span></div></div>
          </div>
        </div>
      </div>

      <!-- ── BIOLOGY ─────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="biology">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(74,222,128,.1);color:#4ade80">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="m17 6-2.5-2.5"/><path d="m14 8-1-1"/><path d="m7 18 2.5 2.5"/><path d="m10 16 1 1"/><path d="M2 9c6.667 6 13.333 0 20 6"/></svg>
          </div>
          <span class="lib-section-name">Biology</span>
          <span class="lib-section-count">3 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card" onclick="selectBook('anaphy2e')">
            <div class="library-book-icon"><img loading="lazy" decoding="async" src="/covers/anaphy2e.jpg" alt="Anatomy &amp; Physiology cover" onerror="this.parentElement.innerHTML='🧬'"></div>
            <div class="lib-book-info"><div class="library-book-title">Anatomy &amp; Physiology</div><div class="library-book-author">Patton &amp; Thibodeau</div><div class="library-book-edition">2nd Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Biology</span></div></div>
          </div>
          <div class="library-book-card" onclick="selectBook('biology2e')">
            <div class="library-book-icon"><img loading="lazy" decoding="async" src="/covers/biology2e.jpg" alt="Biology cover" onerror="this.parentElement.innerHTML='🌿'"></div>
            <div class="lib-book-info"><div class="library-book-title">Biology</div><div class="library-book-author">OpenStax</div><div class="library-book-edition">2nd Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Biology</span></div></div>
          </div>
          <div class="library-book-card" onclick="selectBook('biochem')">
            <div class="library-book-icon"><img loading="lazy" decoding="async" src="/covers/Biochem.jpg" alt="Biochemistry cover" onerror="this.parentElement.innerHTML='🔬'"></div>
            <div class="lib-book-info"><div class="library-book-title">Biochemistry</div><div class="library-book-author">Berg, Tymoczko &amp; Stryer</div><div class="library-book-edition">9th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Biochem</span></div></div>
          </div>
        </div>
      </div>

      <!-- ── NURSING ─────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="nursing">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(244,114,182,.1);color:#f472b6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z"/></svg>
          </div>
          <span class="lib-section-name">Nursing</span>
          <span class="lib-section-count">2 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card" onclick="selectBook('netter')">
            <div class="library-book-icon"><img loading="lazy" decoding="async" src="/covers/netter.jpg" alt="Atlas of Human Anatomy cover" onerror="this.parentElement.innerHTML='🫀'"></div>
            <div class="lib-book-info"><div class="library-book-title">Atlas of Human Anatomy</div><div class="library-book-author">Frank H. Netter</div><div class="library-book-edition">7th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Anatomy</span></div></div>
          </div>
          <div class="library-book-card" onclick="selectBook('nursing-skills-2e')">
            <div class="library-book-icon"><img loading="lazy" decoding="async" src="/covers/nursing-skills-2e.jpg" alt="Nursing Skills cover" onerror="this.parentElement.innerHTML='🩺'"></div>
            <div class="lib-book-info"><div class="library-book-title">Nursing Skills</div><div class="library-book-author">OpenStax</div><div class="library-book-edition">2nd Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Nursing</span></div></div>
          </div>
        </div>
      </div>

      <!-- ── PHYSICS ──────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="physics">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(251,146,60,.1);color:#fb923c">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/></svg>
          </div>
          <span class="lib-section-name">Physics</span>
          <span class="lib-section-count">1 book</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card" onclick="selectBook('physics2e')">
            <div class="library-book-icon"><img loading="lazy" decoding="async" src="/covers/physics2e.jpg" alt="College Physics cover" onerror="this.parentElement.innerHTML='⚛️'"></div>
            <div class="lib-book-info"><div class="library-book-title">College Physics</div><div class="library-book-author">OpenStax</div><div class="library-book-edition">2nd Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Physics</span></div></div>
          </div>
        </div>
      </div>

      <!-- ── PSYCHOLOGY ───────────────────────────────────────── -->
      <div class="lib-section" data-page-section="psychology">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(139,92,246,.1);color:#8b5cf6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 1 8 8c0 4.4-3.6 8-8 8a8 8 0 0 1 0-16z"/><path d="M12 18v4"/><path d="M8 22h8"/><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M9.5 14a3.5 3.5 0 0 0 5 0"/></svg>
          </div>
          <span class="lib-section-name">Psychology</span>
          <span class="lib-section-count">1 book</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card" onclick="selectBook('psychology2e')">
            <div class="library-book-icon"><img loading="lazy" decoding="async" src="/covers/psychology2e.jpg" alt="Psychology cover" onerror="this.parentElement.innerHTML='🧠'"></div>
            <div class="lib-book-info"><div class="library-book-title">Psychology</div><div class="library-book-author">OpenStax</div><div class="library-book-edition">2nd Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Psychology</span></div></div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div class="lib-empty-state" id="lib-page-empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <div class="lib-empty-title">No results found</div>
        <div class="lib-empty-desc">Try a different search term or category</div>
      </div>

    </div><!-- /lib-page-body -->
  </main>
</div>`;

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mountLibraryScreen() {
  const placeholder = document.querySelector('[data-library-screen]');
  if (!placeholder) {
    console.warn('[LibraryScreen] placeholder [data-library-screen] not found');
    return;
  }
  placeholder.outerHTML = LIBRARY_SCREEN_HTML;
}

// ── Auto-mount (synchronous) ──────────────────────────────────────────────────
mountLibraryScreen();

// ── Search & filter (page-scoped, separate from modal's filterLibrary) ────────

export function filterLibraryPage(query) {
  const q = query.trim().toLowerCase();
  const screen = document.getElementById('screen-library');
  if (!screen) return;

  let anyVisible = false;
  screen.querySelectorAll('.library-book-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    const show = !q || text.includes(q);
    card.style.display = show ? '' : 'none';
    if (show) anyVisible = true;
  });

  // Hide sections where all cards are hidden
  screen.querySelectorAll('.lib-section').forEach(section => {
    const visibleCards = [...section.querySelectorAll('.library-book-card')]
      .filter(c => c.style.display !== 'none');
    section.style.display = visibleCards.length ? '' : 'none';
  });

  const emptyState = document.getElementById('lib-page-empty-state');
  if (emptyState) emptyState.style.display = anyVisible ? 'none' : 'flex';
}

export function filterLibPageSection(cat, btn) {
  const screen = document.getElementById('screen-library');
  if (!screen) return;

  // Update active pill
  screen.querySelectorAll('.lib-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Clear search input
  const searchEl = document.getElementById('lib-page-search');
  if (searchEl) searchEl.value = '';

  // Show/hide sections
  screen.querySelectorAll('.lib-section').forEach(section => {
    const show = cat === 'all' || section.dataset.pageSection === cat;
    section.style.display = show ? '' : 'none';
    // Restore all cards within shown sections
    if (show) section.querySelectorAll('.library-book-card').forEach(c => c.style.display = '');
  });

  const emptyState = document.getElementById('lib-page-empty-state');
  if (emptyState) emptyState.style.display = 'none';
}


// ═══════════════════════════════════════════════════════════════════════
// MY DOCUMENTS — Upload, render, delete
// ═══════════════════════════════════════════════════════════════════════

// Hidden file input — created once, reused on every upload trigger
let _libFileInput = null;

function _libGetFileInput() {
  if (_libFileInput) return _libFileInput;
  _libFileInput = document.createElement('input');
  _libFileInput.type     = 'file';
  _libFileInput.accept   = '.pdf,.ppt,.pptx';
  _libFileInput.style.display = 'none';
  _libFileInput.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) libHandleFile(file);
    e.target.value = ''; // reset so same file can be re-uploaded
  });
  document.body.appendChild(_libFileInput);
  return _libFileInput;
}

export function libTriggerUpload() {
  _libGetFileInput().click();
}

export function libDragOver(e) {
  e.preventDefault();
  document.getElementById('lib-my-docs-section')?.classList.add('lib-upload-drag');
  const dz = document.getElementById('lib-drop-zone');
  if (dz) dz.style.display = 'flex';
}
export function libDragLeave(e) {
  // Only hide if leaving the section entirely (not entering a child)
  const section = document.getElementById('lib-my-docs-section');
  if (section && !section.contains(e.relatedTarget)) {
    section.classList.remove('lib-upload-drag');
    const dz = document.getElementById('lib-drop-zone');
    if (dz) dz.style.display = 'none';
  }
}
export function libDrop(e) {
  e.preventDefault();
  document.getElementById('lib-my-docs-section')?.classList.remove('lib-upload-drag');
  const dz = document.getElementById('lib-drop-zone');
  if (dz) dz.style.display = 'none';
  const file = e.dataTransfer?.files?.[0];
  if (file) libHandleFile(file);
}

async function libHandleFile(file) {
  const allowed = /\.(pdf|pptx?|ppt)$/i;
  if (!allowed.test(file.name)) {
    wsShowToast?.('⚠', 'Only PDF and PowerPoint files are supported', 'var(--red)');
    return;
  }
  const MAX = 80 * 1024 * 1024; // 80 MB
  if (file.size > MAX) {
    wsShowToast?.('⚠', 'File too large (max 80 MB)', 'var(--red)');
    return;
  }

  // Show progress on the header button + progress bar
  const btn  = document.getElementById('lib-upload-btn');
  const lbl  = document.getElementById('lib-upload-btn-label');
  const prog = document.getElementById('lib-upload-progress');
  const bar  = document.getElementById('lib-upload-progress-bar');
  if (lbl)  lbl.textContent = 'Reading…';
  if (btn)  btn.disabled = true;
  if (prog) prog.style.display = 'block';
  if (bar)  bar.style.width = '15%';

  try {
    let extractedText = '';
    let pageCount     = 0;

    const isPpt = /\.(pptx?|ppt)$/i.test(file.name);

    if (isPpt) {
      // PPT: send to backend for python-pptx extraction
      if (bar) bar.style.width = '35%';
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch(`${API_BASE}/upload-document`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Server extraction failed');
      // Store slides as JSON string so _wsRenderPptSlides can parse it
      extractedText = JSON.stringify(json.slides || []);
      pageCount     = json.total_slides || 0;
      if (bar) bar.style.width = '75%';
    } else {
      // PDF: extract text client-side with PDF.js
      if (bar) bar.style.width = '25%';
      const buf = await file.arrayBuffer();
      if (bar) bar.style.width = '40%';
      const pdfjsLib = await (_loadPdfJs?.() || Promise.reject('PDF.js not loaded'));
      const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
      pageCount = pdfDoc.numPages;
      const textParts = [];
      const maxPages = Math.min(pageCount, 300); // cap for very large textbooks
      for (let i = 1; i <= maxPages; i++) {
        if (bar) bar.style.width = (40 + Math.round((i / maxPages) * 45)) + '%';
        const page    = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(it => it.str).join(' ').trim();
        if (pageText) textParts.push(`[Page ${i}]\n${pageText}`);
      }
      extractedText = textParts.join('\n\n');
    }

    if (bar) bar.style.width = '90%';

    // Save to IndexedDB
    const { data: meta, error } = await saveDoc(file, extractedText, pageCount);
    if (error || !meta) throw new Error(error || 'Save failed');

    if (bar) bar.style.width = '100%';
    setTimeout(() => {
      if (prog) prog.style.display = 'none';
      if (bar)  bar.style.width = '0%';
      if (lbl)  lbl.textContent = 'Upload';
      if (btn)  btn.disabled = false;
    }, 600);

    // Re-render the doc list and open the new doc
    await libRenderMyDocs();
    wsShowToast?.('✦', `"${file.name}" added to your library`, 'var(--violet-border)');
    // Auto-open the just-uploaded document
    if (typeof selectUserDoc === 'function') selectUserDoc(meta.id);

  } catch (err) {
    console.error('[libHandleFile] error:', err);
    wsShowToast?.('⚠', 'Upload failed: ' + err.message, 'var(--red)');
    if (prog) prog.style.display = 'none';
    if (bar)  bar.style.width = '0%';
    if (lbl)  lbl.textContent = 'Upload';
    if (btn)  btn.disabled = false;
  }
}

export async function libDeleteDoc(e, docId) {
  e.stopPropagation(); // don't open doc when clicking delete
  if (!confirm('Remove this document from your library?')) return;
  await deleteDoc(docId);
  await libRenderMyDocs();
  wsShowToast?.('✦', 'Document removed', 'var(--text-3)');
}

export async function libRenderMyDocs() {
  const list  = document.getElementById('lib-my-docs-list');
  const count = document.getElementById('lib-my-docs-count');
  const empty = document.getElementById('lib-docs-empty');
  if (!list) return;

  const { data: docs } = await listDocs();

  // Update count badge
  if (count) count.textContent = `${docs.length} file${docs.length !== 1 ? 's' : ''}`;

  // Show/hide empty state
  if (empty) empty.style.display = docs.length === 0 ? 'flex' : 'none';

  // Re-render all rows
  list.innerHTML = '';
  docs.forEach(doc => {
    const isPpt  = /\.(pptx?|ppt)$/i.test(doc.name);
    const ext    = doc.name.split('.').pop().toUpperCase();
    const sizeMb = (doc.size / 1048576).toFixed(1);
    const pages  = doc.pageCount;
    const date   = new Date(doc.uploadedAt).toLocaleDateString(undefined, { month:'short', day:'numeric' });
    const accentColor = isPpt ? '#fb923c' : '#8b7cf8';
    const accentBorder = isPpt ? 'rgba(251,146,60,0.25)' : 'var(--violet-border)';
    const accentBg     = isPpt ? 'rgba(251,146,60,0.08)' : 'rgba(139,124,248,0.08)';
    const nameClean = doc.name.replace(/\.[^.]+$/, '');
    const row = document.createElement('div');
    row.className = 'lib-doc-row';
    row.onclick   = () => { if (typeof selectUserDoc === 'function') selectUserDoc(doc.id); };
    row.innerHTML = `
      <div class="lib-doc-row-icon" style="background:${accentBg};border-color:${accentBorder};">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${accentColor}"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="lib-doc-row-info">
        <div class="lib-doc-row-name">${nameClean}</div>
        <div class="lib-doc-row-meta">
          <span class="lib-doc-row-badge" style="color:${accentColor};border-color:${accentBorder};background:${accentBg};">${ext}</span>
          <span>${pages} ${isPpt ? 'slides' : 'pages'}</span>
          <span>·</span>
          <span>${sizeMb} MB</span>
          <span>·</span>
          <span>${date}</span>
        </div>
      </div>
      <button class="lib-doc-row-delete" onclick="libDeleteDoc(event,'${doc.id}')" title="Remove document">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    list.appendChild(row);
  });
}

// ── Init: load user docs when the library screen mounts ──────────────────
// Called once after DOMContentLoaded. The screen HTML is injected synchronously
// by mountLibraryScreen(), so the grid already exists at this point.
document.addEventListener('DOMContentLoaded', () => {
  libRenderMyDocs();
  _libInjectProgress();
});

// ── Per-book progress overlay ─────────────────────────────────────────────
export function _libInjectProgress() {
  const BOOK_IDS = ['zumdahl','atkins','klein','harris','berg','netter','anaphy2e','biochem'];
  BOOK_IDS.forEach(bookId => {
    const card = document.querySelector(`.library-book-card[onclick*="${bookId}"]`);
    if (!card) return;

    const prog = getBookProgress(bookId);
    if (!prog) return;

    const pct       = calcReadPct(prog);
    const label     = formatLastStudied(prog.lastOpened);
    const sessions  = prog.openCount || 0;

    // Remove existing progress block if re-injecting
    card.querySelector('.lib-progress-block')?.remove();

    const block = document.createElement('div');
    block.className = 'lib-progress-block';
    block.innerHTML = `
      <div class="lib-progress-row">
        <span class="lib-progress-label">${label ? '🕐 ' + label : ''}</span>
        <span class="lib-progress-sessions">${sessions} session${sessions !== 1 ? 's' : ''}</span>
      </div>
      ${pct > 0 ? `
      <div class="lib-progress-bar-wrap">
        <div class="lib-progress-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="lib-progress-pct">${pct}% read</div>
      ` : ''}
    `;
    card.appendChild(block);

    // Add studied ring to cover
    if (sessions > 0) {
      const icon = card.querySelector('.library-book-icon');
      if (icon && !icon.querySelector('.lib-studied-ring')) {
        const ring = document.createElement('div');
        ring.className = 'lib-studied-ring';
        icon.appendChild(ring);
      }
    }
  });
}

// Window bridges for LibraryScreen functions are in globals.js.
