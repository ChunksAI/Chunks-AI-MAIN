import { saveDoc, listDocs, deleteDoc } from '../lib/userDocDb.js';

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
 * Window bridges: none (filterLibrary / filterLibSection live in workspaceState)
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
            <span class="lib-title-count" id="lib-page-total-count">· 20 books</span>
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
        <button class="lib-pill" onclick="filterLibPageSection('nursing',this)">
          <span class="lib-pill-dot" style="background:#f472b6"></span>Nursing
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('biology',this)">
          <span class="lib-pill-dot" style="background:#4ade80"></span>Biology
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('physics',this)">
          <span class="lib-pill-dot" style="background:#fb923c"></span>Physics
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('pharmacology',this)">
          <span class="lib-pill-dot" style="background:#a78bfa"></span>Pharmacology
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('anatomy',this)">
          <span class="lib-pill-dot" style="background:#f87171"></span>Anatomy
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('math',this)">
          <span class="lib-pill-dot" style="background:#facc15"></span>Math
        </button>
      </div>
    </div><!-- /page-header -->

    <!-- Scrollable body -->
    <div class="lib-page-body" id="lib-page-body">

      <!-- ── MY DOCUMENTS ──────────────────────────────────── -->
      <div class="lib-section lib-section--my-docs" data-page-section="my-docs" id="lib-my-docs-section">
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
        </div>
        <div class="library-grid" id="lib-my-docs-grid">

          <!-- Upload card — always present -->
          <div class="library-book-card lib-upload-card" id="lib-upload-card"
               onclick="libTriggerUpload()" ondragover="libDragOver(event)" ondrop="libDrop(event)" ondragleave="libDragLeave(event)">
            <div class="lib-upload-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div class="lib-book-info">
              <div class="library-book-title" style="color:var(--violet);">Upload Document</div>
              <div class="library-book-author">PDF or PowerPoint</div>
              <div class="library-book-edition" id="lib-upload-hint">Drag & drop or click to browse</div>
              <div class="library-book-meta">
                <span class="library-book-badge" style="color:var(--violet);border-color:var(--violet-border);">+ Add file</span>
              </div>
            </div>
            <!-- Hidden progress bar shown during upload -->
            <div class="lib-upload-progress" id="lib-upload-progress">
              <div class="lib-upload-progress-bar" id="lib-upload-progress-bar"></div>
            </div>
          </div>

        </div>
      </div><!-- /my-docs -->

      <!-- ── CHEMISTRY ────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="chemistry">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(34,211,238,.1);color:#22d3ee">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 3h6l1 9H8z"/><path d="M8 12a5 5 0 0 0 8 0"/>
              <path d="M6.7 19.8A2 2 0 0 0 8 21h8a2 2 0 0 0 1.3-3.5L14 12H10z"/>
            </svg>
          </div>
          <span class="lib-section-name">Chemistry</span>
          <span class="lib-section-count">5 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">

          <div class="library-book-card" onclick="selectBook('zumdahl')">
            <div class="library-book-icon">
              <img src="/public/covers/zumdahl.jpg" alt="General Chemistry cover" onerror="this.parentElement.innerHTML='📗'">
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">General Chemistry</div>
              <div class="library-book-author">Zumdahl &amp; Zumdahl</div>
              <div class="library-book-edition">9th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-avail">✓ Available</span>
                <span class="library-book-badge">Chemistry</span>
              </div>
            </div>
          </div>

          <div class="library-book-card" onclick="selectBook('atkins')">
            <div class="library-book-icon">
              <img src="/public/covers/atkins.jpg" alt="Physical Chemistry cover" onerror="this.parentElement.innerHTML='📘'">
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Physical Chemistry</div>
              <div class="library-book-author">Atkins &amp; de Paula</div>
              <div class="library-book-edition">8th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-avail">✓ Available</span>
                <span class="library-book-badge">Physical Chem</span>
              </div>
            </div>
          </div>

          <div class="library-book-card" onclick="selectBook('klein')">
            <div class="library-book-icon">
              <img src="/public/covers/klein.jpg" alt="Organic Chemistry cover" onerror="this.parentElement.innerHTML='📙'">
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Organic Chemistry</div>
              <div class="library-book-author">David Klein</div>
              <div class="library-book-edition">4th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-avail">✓ Available</span>
                <span class="library-book-badge">Organic</span>
              </div>
            </div>
          </div>

          <div class="library-book-card" onclick="selectBook('harris')">
            <div class="library-book-icon">
              <img src="/public/covers/harris.jpg" alt="Quantitative Chemical Analysis cover" onerror="this.parentElement.innerHTML='📒'">
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Quantitative Chemical Analysis</div>
              <div class="library-book-author">Daniel C. Harris</div>
              <div class="library-book-edition">10th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-avail">✓ Available</span>
                <span class="library-book-badge">Analytical</span>
              </div>
            </div>
          </div>

          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(34,211,238,0.06);">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.5)"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 3h6l1 9H8z"/><path d="M8 12a5 5 0 0 0 8 0"/>
                <path d="M6.7 19.8A2 2 0 0 0 8 21h8a2 2 0 0 0 1.3-3.5L14 12H10z"/>
              </svg>
            </div>
            <div class="lib-cs-overlay">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Chemistry: The Central Science</div>
              <div class="library-book-author">Brown, LeMay &amp; Bursten</div>
              <div class="library-book-edition">14th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── NURSING ─────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="nursing">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(244,114,182,.1);color:#f472b6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z"/>
            </svg>
          </div>
          <span class="lib-section-name">Nursing</span>
          <span class="lib-section-count">2 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">

          <div class="library-book-card" onclick="selectBook('netter')">
            <div class="library-book-icon">
              <img src="/public/covers/netter.jpg" alt="Netter's Atlas cover" onerror="this.parentElement.innerHTML='📕'">
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Netter's Atlas of Human Anatomy</div>
              <div class="library-book-author">Frank H. Netter</div>
              <div class="library-book-edition">8th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-avail">✓ Available</span>
                <span class="library-book-badge">Nursing</span>
              </div>
            </div>
          </div>

          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(244,114,182,0.06);">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(244,114,182,0.5)"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z"/>
              </svg>
            </div>
            <div class="lib-cs-overlay">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Fundamentals of Nursing</div>
              <div class="library-book-author">Potter, Perry &amp; Stockert</div>
              <div class="library-book-edition">10th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── BIOLOGY ─────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="biology">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(74,222,128,.1);color:#4ade80">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 2c2.76 0 5 4.48 5 10s-2.24 10-5 10S7 17.52 7 12"/>
              <path d="M2 12h20"/>
            </svg>
          </div>
          <span class="lib-section-name">Biology</span>
          <span class="lib-section-count">2 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">

          <div class="library-book-card" onclick="selectBook('anaphy2e')">
            <div class="library-book-icon">
              <img src="/public/covers/anaphy2e.jpg" alt="Anatomy & Physiology cover" onerror="this.parentElement.innerHTML='🧬'">
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Anatomy &amp; Physiology</div>
              <div class="library-book-author">OpenStax</div>
              <div class="library-book-edition">2nd Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-avail">✓ Available</span>
                <span class="library-book-badge">Biology</span>
              </div>
            </div>
          </div>

          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(74,222,128,0.06);">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,0.5)"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 2c2.76 0 5 4.48 5 10s-2.24 10-5 10S7 17.52 7 12"/><path d="M2 12h20"/>
              </svg>
            </div>
            <div class="lib-cs-overlay">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Campbell Biology</div>
              <div class="library-book-author">Urry, Cain &amp; Wasserman</div>
              <div class="library-book-edition">12th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── PHARMACOLOGY ──────────────────────────────────────── -->
      <div class="lib-section" data-page-section="pharmacology">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(167,139,250,.1);color:#a78bfa">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/>
              <path d="m8.5 8.5 7 7"/>
            </svg>
          </div>
          <span class="lib-section-name">Pharmacology</span>
          <span class="lib-section-count">2 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">

          <div class="library-book-card" onclick="selectBook('biochem')">
            <div class="library-book-icon">
              <img src="/public/covers/Biochem.jpg" alt="Biochemistry cover" onerror="this.parentElement.innerHTML='💊'">
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Biochemistry</div>
              <div class="library-book-author">Berg, Tymoczko &amp; Stryer</div>
              <div class="library-book-edition">9th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-avail">✓ Available</span>
                <span class="library-book-badge">Pharmacology</span>
              </div>
            </div>
          </div>

          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(167,139,250,0.06);">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,0.5)"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="m8.5 8.5 7 7"/>
              </svg>
            </div>
            <div class="lib-cs-overlay">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Pharmacology: A Nursing Process Approach</div>
              <div class="library-book-author">Kee, Hayes &amp; McCuistion</div>
              <div class="library-book-edition">10th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── ANATOMY ────────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="anatomy">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(248,113,113,.1);color:#f87171">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
              <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
              <circle cx="20" cy="10" r="2"/>
            </svg>
          </div>
          <span class="lib-section-name">Anatomy</span>
          <span class="lib-section-count">1 book</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">

          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(248,113,113,0.06);">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,0.5)"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
                <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>
              </svg>
            </div>
            <div class="lib-cs-overlay">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Gray's Anatomy for Students</div>
              <div class="library-book-author">Drake, Vogl &amp; Mitchell</div>
              <div class="library-book-edition">4th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── PHYSICS ────────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="physics">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(251,146,60,.1);color:#fb923c">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1"/>
              <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5z"/>
              <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5z"/>
            </svg>
          </div>
          <span class="lib-section-name">Physics</span>
          <span class="lib-section-count">2 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">

          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(251,146,60,0.06);">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(251,146,60,0.5)"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1"/>
                <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5z"/>
                <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5z"/>
              </svg>
            </div>
            <div class="lib-cs-overlay">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">University Physics</div>
              <div class="library-book-author">Young &amp; Freedman</div>
              <div class="library-book-edition">15th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span>
              </div>
            </div>
          </div>

          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(251,146,60,0.06);">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(251,146,60,0.5)"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44"/>
                <path d="m13.56 11.747 4.332-.924"/><path d="m16 21-3.105-6.21"/>
                <path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.078a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z"/>
                <path d="m6.158 8.633 1.114 4.456"/><path d="m8 21 3.105-6.21"/><circle cx="12" cy="21" r="1"/>
              </svg>
            </div>
            <div class="lib-cs-overlay">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Conceptual Physics</div>
              <div class="library-book-author">Paul G. Hewitt</div>
              <div class="library-book-edition">13th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── MATH ───────────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="math">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(250,204,21,.1);color:#facc15">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 2H7L3 12l4 10h3"/><path d="m14 2h3l4 10-4 10h-3"/>
            </svg>
          </div>
          <span class="lib-section-name">Mathematics</span>
          <span class="lib-section-count">2 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">

          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(250,204,21,0.06);">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(250,204,21,0.5)"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>
              </svg>
            </div>
            <div class="lib-cs-overlay">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Calculus: Early Transcendentals</div>
              <div class="library-book-author">James Stewart</div>
              <div class="library-book-edition">9th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span>
              </div>
            </div>
          </div>

          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(250,204,21,0.06);">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(250,204,21,0.5)"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 3h7l-7 9 7 9H3"/><path d="M21 3H11"/><path d="M21 21H11"/>
              </svg>
            </div>
            <div class="lib-cs-overlay">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Linear Algebra and Its Applications</div>
              <div class="library-book-author">David C. Lay</div>
              <div class="library-book-edition">6th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span>
              </div>
            </div>
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

window.filterLibraryPage = function(query) {
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
};

window.filterLibPageSection = function(cat, btn) {
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
};


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

window.libTriggerUpload = function() {
  _libGetFileInput().click();
};

window.libDragOver = function(e) {
  e.preventDefault();
  document.getElementById('lib-upload-card')?.classList.add('lib-upload-drag');
};
window.libDragLeave = function() {
  document.getElementById('lib-upload-card')?.classList.remove('lib-upload-drag');
};
window.libDrop = function(e) {
  e.preventDefault();
  document.getElementById('lib-upload-card')?.classList.remove('lib-upload-drag');
  const file = e.dataTransfer?.files?.[0];
  if (file) libHandleFile(file);
};

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

  // Show progress state on upload card
  const hint = document.getElementById('lib-upload-hint');
  const prog = document.getElementById('lib-upload-progress');
  const bar  = document.getElementById('lib-upload-progress-bar');
  const card = document.getElementById('lib-upload-card');
  if (hint) hint.textContent = 'Reading file…';
  if (prog) prog.style.display = 'block';
  if (bar)  bar.style.width = '15%';
  if (card) card.style.pointerEvents = 'none';

  try {
    let extractedText = '';
    let pageCount     = 0;

    const isPpt = /\.(pptx?|ppt)$/i.test(file.name);

    if (isPpt) {
      // PPT: send to backend for python-pptx extraction
      if (bar) bar.style.width = '35%';
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch(`${window._API_BASE || 'https://api.chunks.online'}/upload-document`, { method: 'POST', body: fd });
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
      const pdfjsLib = await (window._loadPdfJs?.() || Promise.reject('PDF.js not loaded'));
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
      if (hint) hint.textContent = 'Drag & drop or click to browse';
      if (card) card.style.pointerEvents = '';
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
    if (hint) hint.textContent = 'Drag & drop or click to browse';
    if (card) card.style.pointerEvents = '';
  }
}

window.libDeleteDoc = async function(e, docId) {
  e.stopPropagation(); // don't open doc when clicking delete
  if (!confirm('Remove this document from your library?')) return;
  await deleteDoc(docId);
  await libRenderMyDocs();
  wsShowToast?.('✦', 'Document removed', 'var(--text-3)');
};

async function libRenderMyDocs() {
  const grid  = document.getElementById('lib-my-docs-grid');
  const count = document.getElementById('lib-my-docs-count');
  if (!grid) return;

  const { data: docs } = await listDocs();

  // Update count badge
  if (count) count.textContent = `${docs.length} file${docs.length !== 1 ? 's' : ''}`;

  // Remove old user doc cards (keep upload card)
  grid.querySelectorAll('.lib-user-doc-card').forEach(el => el.remove());

  // Insert user doc cards after the upload card
  const uploadCard = document.getElementById('lib-upload-card');
  docs.forEach(doc => {
    const isPpt  = /\.(pptx?|ppt)$/i.test(doc.name);
    const ext    = doc.name.split('.').pop().toUpperCase();
    const sizeMb = (doc.size / 1048576).toFixed(1);
    const date   = new Date(doc.uploadedAt).toLocaleDateString(undefined, { month:'short', day:'numeric' });
    const card   = document.createElement('div');
    card.className = 'library-book-card lib-user-doc-card';
    card.onclick   = () => { if (typeof selectUserDoc === 'function') selectUserDoc(doc.id); };
    card.innerHTML = `
      <div class="library-book-icon" style="background:${isPpt ? 'rgba(251,146,60,0.08)' : 'rgba(139,124,248,0.08)'};position:relative;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${isPpt ? '#fb923c' : '#8b7cf8'}"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          ${isPpt ? '<line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>' : '<polyline points="10 9 9 9 8 9"/><polyline points="10 13 9 13 8 13"/><polyline points="10 17 9 17 8 17"/>'}
        </svg>
        <button class="lib-doc-delete-btn" onclick="libDeleteDoc(event,'${doc.id}')" title="Remove">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="lib-book-info">
        <div class="library-book-title" style="font-size:12px;line-height:1.4;">${doc.name.replace(/\.[^.]+$/, '').slice(0, 40)}${doc.name.length > 40 ? '…' : ''}</div>
        <div class="library-book-author" style="font-size:11px;">${doc.pageCount} ${isPpt ? 'slides' : 'pages'}</div>
        <div class="library-book-edition">${date} · ${sizeMb} MB</div>
        <div class="library-book-meta">
          <span class="library-book-badge" style="color:${isPpt ? '#fb923c' : '#8b7cf8'};border-color:${isPpt ? 'rgba(251,146,60,0.25)' : 'var(--violet-border)'};">${ext}</span>
          <span class="library-book-badge lib-badge-avail">✓ Your file</span>
        </div>
      </div>`;
    uploadCard.after(card);
  });
}

// ── Init: load user docs when the library screen mounts ──────────────────
// Called once after DOMContentLoaded. The screen HTML is injected synchronously
// by mountLibraryScreen(), so the grid already exists at this point.
document.addEventListener('DOMContentLoaded', () => {
  libRenderMyDocs();
});

// Also expose for external callers (e.g. after upload from workspace)
window.libRenderMyDocs = libRenderMyDocs;
