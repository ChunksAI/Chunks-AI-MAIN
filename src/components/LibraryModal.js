import { saveDoc, listDocs, deleteDoc } from '../lib/userDocDb.js';

/**
 * src/components/LibraryModal.js — Task 23
 *
 * Owns the textbook library modal HTML and open/close logic.
 *
 * Previously in index.html:
 *   • #library-modal HTML block (~lines 1257–1651, 395 lines)
 *   • openLibraryModal / closeLibraryModal JS (~lines 1658–1685)
 *
 * filterLibrary / filterLibSection are already in src/state/workspaceState.js (Task 16)
 * and stay there — they are not moved here.
 *
 * window bridges set here:
 *   window.openLibraryModal
 *   window.closeLibraryModal
 */

// ── HTML template ─────────────────────────────────────────────────────────────

const LIBRARY_MODAL_HTML = `
<div class="library-modal" id="library-modal" role="dialog" aria-modal="true" aria-labelledby="library-modal-title">
  <div class="library-modal-content">

    <!-- Header -->
    <div class="library-modal-header">
      <div class="lib-top-row">
        <div class="lib-title-group">
          <div class="lib-title-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            </svg>
          </div>
          <div>
            <span class="lib-title-text" id="library-modal-title">Textbook Library</span>
            <span class="lib-title-count" id="lib-total-count">· 20 books</span>
          </div>
        </div>
        <button class="library-modal-close" data-action="closeLibraryModal" aria-label="Close library">✕</button>
      </div>

      <!-- Search -->
      <div class="lib-search-row">
        <div class="lib-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input class="lib-search-input" type="text"
                 placeholder="Search textbooks, authors…"
                 oninput="filterLibrary(this.value)">
        </div>
      </div>

      <!-- Category pills -->
      <div class="lib-pills">
        <button class="lib-pill active" onclick="filterLibSection('all',this)">
          <span class="lib-pill-dot" style="background:#8b7cf8"></span>All Courses
        </button>
        <button class="lib-pill" onclick="filterLibSection('chemistry',this)">
          <span class="lib-pill-dot" style="background:#22d3ee"></span>Chemistry
        </button>
        <button class="lib-pill" onclick="filterLibSection('nursing',this)">
          <span class="lib-pill-dot" style="background:#f472b6"></span>Nursing
        </button>
        <button class="lib-pill" onclick="filterLibSection('biology',this)">
          <span class="lib-pill-dot" style="background:#4ade80"></span>Biology
        </button>
        <button class="lib-pill" onclick="filterLibSection('physics',this)">
          <span class="lib-pill-dot" style="background:#fb923c"></span>Physics
        </button>
        <button class="lib-pill" onclick="filterLibSection('pharmacology',this)">
          <span class="lib-pill-dot" style="background:#a78bfa"></span>Pharmacology
        </button>
        <button class="lib-pill" onclick="filterLibSection('anatomy',this)">
          <span class="lib-pill-dot" style="background:#f87171"></span>Anatomy
        </button>
        <button class="lib-pill" onclick="filterLibSection('math',this)">
          <span class="lib-pill-dot" style="background:#facc15"></span>Math
        </button>
      </div>
    </div><!-- /header -->

    <!-- Body -->
    <div class="library-modal-body">

      <!-- ── MY DOCUMENTS ──────────────────────────────────── -->
      <div class="lib-section lib-section--my-docs" data-section="my-docs" id="lib-modal-my-docs-section"
           ondragover="libModalDragOver(event)" ondrop="libModalDrop(event)" ondragleave="libModalDragLeave(event)">

        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(139,124,248,.1);color:#8b7cf8">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <span class="lib-section-name">My Documents</span>
          <span class="lib-section-count" id="lib-modal-my-docs-count">0 files</span>
          <div class="lib-section-line"></div>
          <button class="lib-upload-btn" id="lib-modal-upload-btn" onclick="libModalTriggerUpload()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span id="lib-modal-upload-btn-label">Upload</span>
          </button>
        </div>

        <!-- Progress bar -->
        <div class="lib-upload-progress" id="lib-modal-upload-progress" style="margin-bottom:0;border-radius:var(--r-pill);overflow:hidden;height:3px;background:var(--surface-4);display:none;">
          <div class="lib-upload-progress-bar" id="lib-modal-upload-progress-bar"></div>
        </div>

        <!-- Drop zone -->
        <div class="lib-drop-zone" id="lib-modal-drop-zone">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Drop PDF or PowerPoint here
        </div>

        <!-- Row list -->
        <div class="lib-docs-list" id="lib-modal-my-docs-list"></div>

        <!-- Empty state -->
        <div class="lib-docs-empty" id="lib-modal-docs-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.25;color:var(--violet)">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span>Upload a PDF or PowerPoint to study it with AI</span>
        </div>

      </div><!-- /my-docs -->

      <!-- ── CHEMISTRY ─────────────────────────────────────── -->
      <div class="lib-section" data-section="chemistry">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(34,211,238,.1);color:#22d3ee">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 3h6l1 9H8z"/>
              <path d="M8 12a5 5 0 0 0 8 0"/>
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
              <img src="data:," alt="General Chemistry by Zumdahl &amp; Zumdahl — textbook cover" onerror="this.parentElement.innerHTML='📗'">
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
              <img src="data:," alt="Physical Chemistry by Atkins &amp; de Paula — textbook cover" onerror="this.parentElement.innerHTML='📘'">
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
              <img src="data:," alt="Organic Chemistry by David Klein — textbook cover" onerror="this.parentElement.innerHTML='📙'">
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
              <img src="data:," alt="Quantitative Chemical Analysis by Daniel C. Harris — textbook cover" onerror="this.parentElement.innerHTML='📒'">
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)"
                   stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
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

      <!-- ── NURSING ────────────────────────────────────────── -->
      <div class="lib-section" data-section="nursing">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(244,114,182,.1);color:#f472b6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z"/>
            </svg>
          </div>
          <span class="lib-section-name">Nursing</span>
          <span class="lib-section-count">4 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(244,114,182,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(244,114,182,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info">
              <div class="library-book-title">Fundamentals of Nursing</div>
              <div class="library-book-author">Potter &amp; Perry</div>
              <div class="library-book-edition">10th Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div>
            </div>
          </div>
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(244,114,182,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(244,114,182,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info">
              <div class="library-book-title">Medical-Surgical Nursing</div>
              <div class="library-book-author">Lewis, Bucher &amp; Heitkemper</div>
              <div class="library-book-edition">11th Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div>
            </div>
          </div>
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(244,114,182,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(244,114,182,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="m17 6-2.5-2.5"/><path d="m14 8-1-1"/><path d="m7 18 2.5 2.5"/><path d="m10 16 1 1"/><path d="M2 9c6.667 6 13.333 0 20 6"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info">
              <div class="library-book-title">Nursing: A Concept-Based Approach</div>
              <div class="library-book-author">Pearson Education</div>
              <div class="library-book-edition">3rd Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div>
            </div>
          </div>
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(244,114,182,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(244,114,182,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info">
              <div class="library-book-title">Maternal &amp; Child Health Nursing</div>
              <div class="library-book-author">Pillitteri</div>
              <div class="library-book-edition">8th Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── BIOLOGY ────────────────────────────────────────── -->
      <div class="lib-section" data-section="biology">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(74,222,128,.1);color:#4ade80">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="m17 6-2.5-2.5"/><path d="m14 8-1-1"/><path d="m7 18 2.5 2.5"/><path d="m10 16 1 1"/><path d="M2 9c6.667 6 13.333 0 20 6"/></svg>
          </div>
          <span class="lib-section-name">Biology</span>
          <span class="lib-section-count">3 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(74,222,128,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info"><div class="library-book-title">Campbell Biology</div><div class="library-book-author">Urry, Cain &amp; Wasserman</div><div class="library-book-edition">12th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div></div>
          </div>
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(74,222,128,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 8V4"/><path d="m6.3 6.3-1.4-1.4"/><path d="M4 12H2"/><path d="m6.3 17.7-1.4 1.4"/><path d="M12 20v-2"/><path d="m17.7 17.7 1.4 1.4"/><path d="M22 12h-2"/><path d="m17.7 6.3 1.4-1.4"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info"><div class="library-book-title">Molecular Biology of the Cell</div><div class="library-book-author">Alberts et al.</div><div class="library-book-edition">7th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div></div>
          </div>
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(74,222,128,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l1 9H8z"/><path d="M8 12a5 5 0 0 0 8 0"/><path d="M6.7 19.8A2 2 0 0 0 8 21h8a2 2 0 0 0 1.3-3.5L14 12H10z"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info"><div class="library-book-title">Biochemistry</div><div class="library-book-author">Berg, Tymoczko &amp; Stryer</div><div class="library-book-edition">8th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div></div>
          </div>
        </div>
      </div>

      <!-- ── PHARMACOLOGY ───────────────────────────────────── -->
      <div class="lib-section" data-section="pharmacology">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(167,139,250,.1);color:#a78bfa">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
          </div>
          <span class="lib-section-name">Pharmacology</span>
          <span class="lib-section-count">2 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(167,139,250,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="m8.5 8.5 7 7"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info"><div class="library-book-title">Pharmacology for Nurses</div><div class="library-book-author">Adams &amp; Urban</div><div class="library-book-edition">5th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div></div>
          </div>
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(167,139,250,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/><path d="M14.5 16h-5"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info"><div class="library-book-title">Clinical Pharmacology &amp; Nursing</div><div class="library-book-author">Roach &amp; Ford</div><div class="library-book-edition">8th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div></div>
          </div>
        </div>
      </div>

      <!-- ── ANATOMY ────────────────────────────────────────── -->
      <div class="lib-section" data-section="anatomy">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(248,113,113,.1);color:#f87171">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          </div>
          <span class="lib-section-name">Anatomy &amp; Physiology</span>
          <span class="lib-section-count">3 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card" onclick="selectBook('anaphy2e')">
            <div class="library-book-icon" style="background:rgba(248,113,113,0.06);">
              <img src="data:," alt="Anatomy &amp; Physiology by Patton &amp; Thibodeau — textbook cover" onerror="this.parentElement.innerHTML='🫁'">
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Anatomy &amp; Physiology</div>
              <div class="library-book-author">Patton &amp; Thibodeau</div>
              <div class="library-book-edition">2nd Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-avail">✓ Available</span>
                <span class="library-book-badge">Anatomy</span>
              </div>
            </div>
          </div>
          <div class="library-book-card" onclick="selectBook('netter')">
            <div class="library-book-icon" style="background:rgba(248,113,113,0.06);">
              <img src="data:," alt="Atlas of Human Anatomy by Frank H. Netter — textbook cover" onerror="this.parentElement.innerHTML='🫀'">
            </div>
            <div class="lib-book-info">
              <div class="library-book-title">Atlas of Human Anatomy</div>
              <div class="library-book-author">Frank H. Netter</div>
              <div class="library-book-edition">7th Edition</div>
              <div class="library-book-meta">
                <span class="library-book-badge lib-badge-avail">✓ Available</span>
                <span class="library-book-badge">Anatomy</span>
              </div>
            </div>
          </div>
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(248,113,113,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info"><div class="library-book-title">Gray's Anatomy for Students</div><div class="library-book-author">Drake, Vogl &amp; Mitchell</div><div class="library-book-edition">4th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div></div>
          </div>
        </div>
      </div>

      <!-- ── PHYSICS ────────────────────────────────────────── -->
      <div class="lib-section" data-section="physics">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(251,146,60,.1);color:#fb923c">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/></svg>
          </div>
          <span class="lib-section-name">Physics</span>
          <span class="lib-section-count">2 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(251,146,60,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(251,146,60,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5z"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info"><div class="library-book-title">University Physics</div><div class="library-book-author">Young &amp; Freedman</div><div class="library-book-edition">15th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div></div>
          </div>
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(251,146,60,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(251,146,60,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44"/><path d="m13.56 11.747 4.332-.924"/><path d="m16 21-3.105-6.21"/><path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.078a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z"/><path d="m6.158 8.633 1.114 4.456"/><path d="m8 21 3.105-6.21"/><circle cx="12" cy="21" r="1"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info"><div class="library-book-title">Conceptual Physics</div><div class="library-book-author">Paul G. Hewitt</div><div class="library-book-edition">13th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div></div>
          </div>
        </div>
      </div>

      <!-- ── MATH ───────────────────────────────────────────── -->
      <div class="lib-section" data-section="math">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(250,204,21,.1);color:#facc15">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2H7L3 12l4 10h3"/><path d="m14 2h3l4 10-4 10h-3"/></svg>
          </div>
          <span class="lib-section-name">Mathematics</span>
          <span class="lib-section-count">2 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(250,204,21,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(250,204,21,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info"><div class="library-book-title">Calculus: Early Transcendentals</div><div class="library-book-author">James Stewart</div><div class="library-book-edition">9th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div></div>
          </div>
          <div class="library-book-card lib-coming-soon">
            <div class="library-book-icon" style="background:rgba(250,204,21,0.06);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(250,204,21,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h7l-7 9 7 9H3"/><path d="M21 3H11"/><path d="M21 21H11"/></svg></div>
            <div class="lib-cs-overlay"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="lib-book-info"><div class="library-book-title">Linear Algebra and Its Applications</div><div class="library-book-author">David C. Lay</div><div class="library-book-edition">6th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-soon">⏳ Coming Soon</span></div></div>
          </div>
        </div>
      </div>

      <!-- Empty state (shown via JS when search yields nothing) -->
      <div class="lib-empty-state" id="lib-empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <div class="lib-empty-title">No results found</div>
        <div class="lib-empty-desc">Try a different search term or category</div>
      </div>

    </div><!-- /modal-body -->
  </div><!-- /modal-content -->
</div><!-- /library-modal -->`;

// ── Inject on DOMContentLoaded ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('library-modal')) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = LIBRARY_MODAL_HTML;
  document.body.appendChild(tmp.firstElementChild);
});

// ── Open / close ──────────────────────────────────────────────────────────────

let _libraryFocusRelease = null;

export function openLibraryModal() {
  const modal = document.getElementById('library-modal');
  if (!modal) return;
  modal.classList.add('active');
  sessionStorage.setItem('chunks_library_open', '1');
  _libraryFocusRelease = window.trapFocus?.(modal) ?? null;

  // Refresh My Documents list each time modal opens
  libModalRenderMyDocs().catch(() => {});

  // Dynamically compute book counts
  try {
    const available = modal.querySelectorAll('.library-book-card:not(.lib-coming-soon)').length;
    const totalEl = document.getElementById('lib-total-count');
    if (totalEl) totalEl.textContent = `· ${available} book${available !== 1 ? 's' : ''}`;

    modal.querySelectorAll('.lib-section[data-section]').forEach(section => {
      if (section.dataset.section === 'my-docs') return; // skip — count managed by libModalRenderMyDocs
      const countEl = section.querySelector('.lib-section-count');
      if (!countEl) return;
      const n = section.querySelectorAll('.library-book-card:not(.lib-coming-soon)').length;
      countEl.textContent = `${n} book${n !== 1 ? 's' : ''}`;
    });
  } catch (e) { /* non-critical */ }
}

export function closeLibraryModal() {
  document.getElementById('library-modal')?.classList.remove('active');
  sessionStorage.removeItem('chunks_library_open');
  if (_libraryFocusRelease) { _libraryFocusRelease(); _libraryFocusRelease = null; }
}

// ── My Documents — modal-scoped handlers ─────────────────────────────────────

let _libModalFileInput = null;
function _getLibModalFileInput() {
  if (_libModalFileInput) return _libModalFileInput;
  _libModalFileInput = document.createElement('input');
  _libModalFileInput.type = 'file';
  _libModalFileInput.accept = '.pdf,.ppt,.pptx';
  _libModalFileInput.style.display = 'none';
  _libModalFileInput.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) libModalHandleFile(file);
    _libModalFileInput.value = '';
  });
  document.body.appendChild(_libModalFileInput);
  return _libModalFileInput;
}

window.libModalTriggerUpload = function() {
  _getLibModalFileInput().click();
};

window.libModalDragOver = function(e) {
  e.preventDefault();
  document.getElementById('lib-modal-my-docs-section')?.classList.add('lib-upload-drag');
  const dz = document.getElementById('lib-modal-drop-zone');
  if (dz) dz.style.display = 'flex';
};
window.libModalDragLeave = function(e) {
  const section = document.getElementById('lib-modal-my-docs-section');
  if (section && !section.contains(e.relatedTarget)) {
    section.classList.remove('lib-upload-drag');
    const dz = document.getElementById('lib-modal-drop-zone');
    if (dz) dz.style.display = 'none';
  }
};
window.libModalDrop = function(e) {
  e.preventDefault();
  document.getElementById('lib-modal-my-docs-section')?.classList.remove('lib-upload-drag');
  const dz = document.getElementById('lib-modal-drop-zone');
  if (dz) dz.style.display = 'none';
  const file = e.dataTransfer?.files?.[0];
  if (file) libModalHandleFile(file);
};

window.libModalDeleteDoc = async function(e, docId) {
  e.stopPropagation();
  if (!confirm('Remove this document from your library?')) return;
  await deleteDoc(docId);
  await libModalRenderMyDocs();
  window.wsShowToast?.('✦', 'Document removed', 'var(--text-3)');
};

async function libModalHandleFile(file) {
  const allowed = /\.(pdf|pptx?|ppt)$/i;
  if (!allowed.test(file.name)) {
    window.wsShowToast?.('⚠', 'Only PDF and PowerPoint files are supported', 'var(--red)');
    return;
  }
  const MAX = 80 * 1024 * 1024;
  if (file.size > MAX) {
    window.wsShowToast?.('⚠', 'File too large (max 80 MB)', 'var(--red)');
    return;
  }

  const btn  = document.getElementById('lib-modal-upload-btn');
  const lbl  = document.getElementById('lib-modal-upload-btn-label');
  const prog = document.getElementById('lib-modal-upload-progress');
  const bar  = document.getElementById('lib-modal-upload-progress-bar');
  if (lbl)  lbl.textContent = 'Reading…';
  if (btn)  btn.disabled = true;
  if (prog) prog.style.display = 'block';
  if (bar)  bar.style.width = '15%';

  try {
    let extractedText = '';
    let pageCount = 0;
    const isPpt = /\.(pptx?|ppt)$/i.test(file.name);

    if (isPpt) {
      if (bar) bar.style.width = '35%';
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch(`${window._API_BASE || 'https://api.chunks.online'}/upload-document`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Server extraction failed');
      extractedText = JSON.stringify(json.slides || []);
      pageCount = json.total_slides || 0;
      if (bar) bar.style.width = '75%';
    } else {
      if (bar) bar.style.width = '25%';
      const buf = await file.arrayBuffer();
      if (bar) bar.style.width = '40%';
      const pdfjsLib = await (window._loadPdfJs?.() || Promise.reject('PDF.js not loaded'));
      const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
      pageCount = pdfDoc.numPages;
      const textParts = [];
      const maxPages = Math.min(pageCount, 300);
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
    const { data: meta, error } = await saveDoc(file, extractedText, pageCount);
    if (error || !meta) throw new Error(error || 'Save failed');

    if (bar) bar.style.width = '100%';
    setTimeout(() => {
      if (prog) prog.style.display = 'none';
      if (bar)  bar.style.width = '0%';
      if (lbl)  lbl.textContent = 'Upload';
      if (btn)  btn.disabled = false;
    }, 600);

    await libModalRenderMyDocs();
    window.wsShowToast?.('✦', `"${file.name}" added to your library`, 'var(--violet-border)');
    // Auto-open the just-uploaded doc in workspace and close modal
    if (typeof window.selectUserDoc === 'function') {
      window.selectUserDoc(meta.id);
      closeLibraryModal();
    }
  } catch (err) {
    console.error('[libModalHandleFile] error:', err);
    window.wsShowToast?.('⚠', 'Upload failed: ' + err.message, 'var(--red)');
    if (prog) prog.style.display = 'none';
    if (bar)  bar.style.width = '0%';
    if (lbl)  lbl.textContent = 'Upload';
    if (btn)  btn.disabled = false;
  }
}

async function libModalRenderMyDocs() {
  const list  = document.getElementById('lib-modal-my-docs-list');
  const count = document.getElementById('lib-modal-my-docs-count');
  const empty = document.getElementById('lib-modal-docs-empty');
  if (!list) return;

  const { data: docs } = await listDocs();
  if (count) count.textContent = `${docs.length} file${docs.length !== 1 ? 's' : ''}`;
  if (empty) empty.style.display = docs.length === 0 ? 'flex' : 'none';

  list.innerHTML = '';
  docs.forEach(doc => {
    const isPpt  = /\.(pptx?|ppt)$/i.test(doc.name);
    const ext    = doc.name.split('.').pop().toUpperCase();
    const sizeMb = (doc.size / 1048576).toFixed(1);
    const date   = new Date(doc.uploadedAt).toLocaleDateString(undefined, { month:'short', day:'numeric' });
    const accentColor  = isPpt ? '#fb923c' : '#8b7cf8';
    const accentBorder = isPpt ? 'rgba(251,146,60,0.25)' : 'var(--violet-border)';
    const accentBg     = isPpt ? 'rgba(251,146,60,0.08)' : 'rgba(139,124,248,0.08)';
    const nameClean    = doc.name.replace(/\.[^.]+$/, '');
    const row = document.createElement('div');
    row.className = 'lib-doc-row';
    row.onclick   = () => {
      if (typeof window.selectUserDoc === 'function') {
        window.selectUserDoc(doc.id);
        closeLibraryModal();
      }
    };
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
          <span>${doc.pageCount} ${isPpt ? 'slides' : 'pages'}</span>
          <span>·</span>
          <span>${sizeMb} MB</span>
          <span>·</span>
          <span>${date}</span>
        </div>
      </div>
      <button class="lib-doc-row-delete" onclick="libModalDeleteDoc(event,'${doc.id}')" title="Remove document">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    list.appendChild(row);
  });
}

// ── Window bridges ────────────────────────────────────────────────────────────

window.openLibraryModal  = openLibraryModal;
window.closeLibraryModal = closeLibraryModal;
