/**
 * src/screens/WorkspaceScreen.js — Study Workspace screen
 *
 * Owns all JavaScript for the Study Workspace (#screen-workspace):
 *   - PDF viewer: load, render pages, zoom, page nav, scroll-sync
 *   - PDF outline / TOC panel (real + hardcoded fallback)
 *   - selectBook() — main book loader with Cache API + progress
 *   - Workspace chat: send, append, thinking, copy, regenerate
 *   - Follow-up suggestions, auto-flashcard prompt
 *   - wsMakeFlashcard() — calls /generate-flashcards, wires flash screen
 *   - Attachment system (workspace slot)
 *   - wsMobileView() + showScreen patch for mobile tab reset
 *
 * The static HTML (#screen-workspace) remains in index.html until Task 38.
 *
 * Exports / window globals set
 * ────────────────────────────
 *   window.selectBook
 *   window.togglePdfOutline
 *   window.wsPrevPage, window.wsNextPage
 *   window.wsGoToPage, window.wsJumpToPage
 *   window.wsZoomIn, window.wsZoomOut
 *   window.wsCopyMsg, window.wsMakeFlashcard
 *   window.wsSetInput, window.wsAutoResize
 *   window.wsScrollBottom, window.wsClearChat
 *   window.wsAppendUser, window.wsAppendAI, window.wsAppendError
 *   window.wsAppendThinking, window.wsRemoveThinking
 *   window.wsChatSend
 *   window.wsToggleAttachMenu, window.wsAttachTrigger, window.wsHandleAttach
 *   window.wsMobileView
 *
 * Globals consumed from earlier modules (window.*):
 *   API_BASE          ← lib/api.js (Task 10)
 *   wsRender          ← utils/render.js (Task 12)
 *   sanitize          ← utils/render.js (Task 12)
 *   _saveWsSession    ← utils/storage.js (Task 13)
 *   _getStudyMode     ← utils/storage.js (Task 13)
 *   _isFollowupsEnabled, _isAutoFlashEnabled ← utils/storage.js (Task 13)
 *   showScreen        ← state/navigation.js (Task 15)
 *   wsBookMeta        ← state/workspaceState.js (Task 16)
 *   _wsBookId…        ← state/workspaceState.js (Task 16)
 *   _fcDeck…          ← state/flashState.js (Task 17)
 *   wsShowToast       ← components/Toast.js (Task 20)
 *   showConfirmModal  ← components/ConfirmModal.js (Task 21)
 *   closeLibraryModal ← components/LibraryModal.js (Task 23)
 *
 * Task 26 — extracted from monolith:
 *   _wsUpdateBadge / page nav / zoom     → line 2110
 *   _loadPdfJs / _wsRenderPage           → line 2177
 *   selectBook                           → line 2195
 *   _wsShowWelcome / togglePdfOutline    → line 2439
 *   _wsBookOutlines (hardcoded TOC)      → line 2561 (const block)
 *   _wsBuildOutline / _wsSetActiveOutlineItem / _wsUpdateOutlineActive → line 2561
 *   wsCopyMsg / wsMakeFlashcard          → line 3519
 *   wsSetInput / wsAutoResize / wsScrollBottom / wsClearChat → line 3829
 *   wsAppend* / _wsAvatarSvg            → line 3867
 *   _wsFollowups / _wsRegenerate         → line 4009
 *   wsChatSend / _wsAsk                  → line 4034
 *   wsToggleAttachMenu / wsAttachTrigger
 *     / wsHandleAttach / _wsRenderPreview → line 4135
 *   wsMobileView + showScreen patch      → line 13419
 */

// ── Constants ──────────────────────────────────────────────────────────────

const _WS_PDF_CACHE = 'chunks-pdf-v1';

// Per-book hardcoded TOC fallback (used when PDF has no embedded outline)
const _wsBookOutlines = {
  atkins: [
    { title: '1. The Properties of Gases',   page: 1,   level: 0 },
    { title: '2. The First Law',             page: 45,  level: 0 },
    { title: '3. The Second & Third Laws',   page: 87,  level: 0 },
    { title: '3A. Entropy',                  page: 88,  level: 1 },
    { title: '3B. Entropy Changes',          page: 98,  level: 1 },
    { title: '3C. Concentrating on System',  page: 109, level: 1 },
    { title: '3D. Combining Laws',           page: 116, level: 1 },
    { title: '4. Physical Transformations',  page: 127, level: 0 },
    { title: '5. Simple Mixtures',           page: 172, level: 0 },
    { title: '6. Chemical Equilibrium',      page: 214, level: 0 },
    { title: '7. Quantum Theory',            page: 244, level: 0 },
    { title: '8. Atomic Structure',          page: 290, level: 0 },
  ],
  zumdahl: [
    { title: '1. Chemical Foundations',        page: 1,   level: 0 },
    { title: '2. Atoms, Molecules & Ions',     page: 38,  level: 0 },
    { title: '3. Stoichiometry',               page: 76,  level: 0 },
    { title: '4. Types of Chemical Reactions', page: 130, level: 0 },
    { title: '5. Gases',                       page: 182, level: 0 },
    { title: '6. Thermochemistry',             page: 234, level: 0 },
    { title: '7. Atomic Structure',            page: 280, level: 0 },
    { title: '8. Bonding: General Concepts',   page: 330, level: 0 },
  ],
  klein: [
    { title: '1. A Review of General Chemistry',     page: 1,   level: 0 },
    { title: '2. Molecular Representations',          page: 42,  level: 0 },
    { title: '3. Acids and Bases',                    page: 88,  level: 0 },
    { title: '4. Alkanes and Cycloalkanes',            page: 132, level: 0 },
    { title: '5. Stereoisomerism',                    page: 178, level: 0 },
    { title: '6. Chemical Reactivity and Mechanisms', page: 224, level: 0 },
    { title: '7. Substitution Reactions',             page: 264, level: 0 },
    { title: '8. Elimination Reactions',              page: 308, level: 0 },
    { title: '9. Addition Reactions',                 page: 348, level: 0 },
  ],
  harris: [
    { title: '1. Chemical Measurements',      page: 1,   level: 0 },
    { title: '2. Tools of the Trade',         page: 28,  level: 0 },
    { title: '3. Experimental Error',         page: 56,  level: 0 },
    { title: '4. Statistics',                 page: 80,  level: 0 },
    { title: '5. Quality Assurance',          page: 108, level: 0 },
    { title: '6. Chemical Equilibrium',       page: 130, level: 0 },
    { title: '7. Activity and Ionic Strength', page: 158, level: 0 },
  ],
  berg: [
    { title: '1. Biochemistry and the Unity of Life', page: 1,   level: 0 },
    { title: '2. Protein Composition',               page: 28,  level: 0 },
    { title: '3. Protein Structure',                 page: 56,  level: 0 },
    { title: '4. DNA, RNA & the Flow of Information', page: 100, level: 0 },
    { title: '5. Exploring Genes',                   page: 140, level: 0 },
    { title: '6. Exploring Proteins',                page: 174, level: 0 },
    { title: '7. Hemoglobin',                        page: 210, level: 0 },
    { title: '8. Enzymes',                           page: 240, level: 0 },
  ],
  netter: [
    { title: 'Head and Neck',         page: 1,   level: 0 },
    { title: 'Back and Spinal Cord',  page: 140, level: 0 },
    { title: 'Thorax',                page: 200, level: 0 },
    { title: 'Abdomen',               page: 320, level: 0 },
    { title: 'Pelvis and Perineum',   page: 470, level: 0 },
    { title: 'Upper Limb',            page: 560, level: 0 },
    { title: 'Lower Limb',            page: 680, level: 0 },
  ],
  anaphy2e: [
    { title: '1. Introduction to the Human Body', page: 1,   level: 0 },
    { title: '2. The Chemical Basis of Life',     page: 28,  level: 0 },
    { title: '3. Cells',                          page: 58,  level: 0 },
    { title: '4. Tissues',                        page: 96,  level: 0 },
    { title: '5. The Integumentary System',       page: 130, level: 0 },
    { title: '6. Bones and Bone Tissue',          page: 154, level: 0 },
    { title: '7. The Skeletal System',            page: 186, level: 0 },
    { title: '8. Joints',                         page: 220, level: 0 },
  ],
};

// ── Private file helpers (also defined in HomeScreen; duplicated here
//    until a shared utils/file.js is created in a later task) ───────────────

function _readFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function _buildThumb(att, removeFn) {
  const wrap = document.createElement('div');
  wrap.className = 'attach-thumb';
  if (att.type === 'image') {
    const img = document.createElement('img');
    img.src = att.dataUrl; img.alt = att.name;
    wrap.appendChild(img);
  } else {
    const label = document.createElement('div');
    label.className = 'attach-thumb-pdf';
    label.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${att.name.slice(0, 8)}</span>`;
    wrap.appendChild(label);
  }
  const rm = document.createElement('button');
  rm.className   = 'attach-remove';
  rm.innerHTML   = '✕';
  rm.onclick     = removeFn;
  wrap.appendChild(rm);
  return wrap;
}

// ── PDF page badge ─────────────────────────────────────────────────────────

function _wsUpdateBadge(page) {
  const b = document.getElementById('ws-page-badge');
  if (b) b.textContent = `${page} / ${window._wsTotalPages}`;
  const m = document.getElementById('mpn-page-label');
  if (m) m.textContent = `${page} / ${window._wsTotalPages}`;
}

// ── Toolbar: prev / next / jump ────────────────────────────────────────────

export function wsPrevPage() {
  if (!window._wsPdfDoc || window._wsCurrentPage <= 1) return;
  wsGoToPage(window._wsCurrentPage - 1);
}
export function wsNextPage() {
  if (!window._wsPdfDoc || window._wsCurrentPage >= window._wsTotalPages) return;
  wsGoToPage(window._wsCurrentPage + 1);
}
export function wsGoToPage(n) {
  n = Math.max(1, Math.min(n, window._wsTotalPages));
  window._wsCurrentPage = n;
  _wsUpdateBadge(n);
  const wrap   = document.getElementById('ws-pdf-canvas-wrap');
  const target = window._wsPageContainers[n - 1];
  if (target && wrap) wrap.scrollTop = target.offsetTop - 16;
}
export function wsJumpToPage() {
  const n = parseInt(prompt(`Go to page (1 – ${window._wsTotalPages}):`, window._wsCurrentPage));
  if (!isNaN(n)) wsGoToPage(n);
}

// ── Toolbar: zoom ──────────────────────────────────────────────────────────

export async function wsZoomIn()  { await _wsRescale(window._wsScale + window.ZOOM_STEP); }
export async function wsZoomOut() { await _wsRescale(window._wsScale - window.ZOOM_STEP); }

async function _wsRescale(newScale) {
  if (!window._wsPdfDoc) return;
  newScale = Math.max(window.ZOOM_MIN, Math.min(window.ZOOM_MAX, newScale));
  if (Math.abs(newScale - window._wsScale) < 0.01) return;
  window._wsScale = newScale;
  for (let i = 0; i < window._wsPageContainers.length; i++) {
    const c = window._wsPageContainers[i];
    if (!c.dataset.rendered) continue;
    c.dataset.rendered = '';
    await _wsRenderPage(i + 1, c);
  }
}

// ── PDF.js loader ──────────────────────────────────────────────────────────

function _loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window._pdfjsLib) return resolve(window._pdfjsLib);
    const script   = document.createElement('script');
    script.src     = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload  = () => {
      window._pdfjsLib = window.pdfjsLib;
      window._pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window._pdfjsLib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ── Render one PDF page ────────────────────────────────────────────────────

async function _wsRenderPage(pageNum, container) {
  if (container.dataset.rendered === '1') return;
  container.dataset.rendered = '1';
  try {
    const page     = await window._wsPdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: window._wsScale });
    const canvas   = container.querySelector('canvas');
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    container.style.width  = viewport.width  + 'px';
    container.style.height = viewport.height + 'px';
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  } catch (e) { console.warn('Page render error', pageNum, e); }
}

// ── Main book loader ───────────────────────────────────────────────────────

export async function selectBook(bookId) {
  window.closeLibraryModal?.();
  const meta = window.wsBookMeta?.[bookId];
  if (!meta) return;

  // Sync chat state
  window._wsBookId      = bookId;
  window._wsChatHistory = [];
  const short  = meta.name.split(' ').slice(0, 2).join(' ');
  const ctag   = document.getElementById('ws-context-tag');
  const ctitle = document.getElementById('ws-chat-title');
  if (ctag)   ctag.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg> ${short}`;
  if (ctitle) ctitle.textContent = meta.name;

  // Show downloading banner in chat panel
  const msgs = document.getElementById('ws-messages');
  if (msgs) {
    msgs.innerHTML = `
      <div id="ws-download-banner" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:18px;text-align:center;padding:40px;">
        <div style="width:56px;height:56px;border-radius:16px;background:var(--gold-muted);border:1px solid var(--gold-border);display:flex;align-items:center;justify-content:center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            <path d="M12 8v8M9 13l3 3 3-3"/>
          </svg>
        </div>
        <div>
          <div style="font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--text-1);margin-bottom:5px;">Downloading textbook…</div>
          <div style="font-size:12px;color:var(--text-3);line-height:1.6;max-width:220px;">Loading <strong style="color:var(--text-2);">${meta.name}</strong>. This may take a moment on first load.</div>
        </div>
        <div style="width:180px;height:3px;background:var(--surface-4);border-radius:99px;overflow:hidden;">
          <div id="ws-chat-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--gold),var(--violet));border-radius:99px;transition:width 0.4s ease;"></div>
        </div>
        <div id="ws-chat-progress-text" style="font-family:var(--font-mono);font-size:11px;color:var(--text-3);">Connecting…</div>
      </div>`;
  }

  window.showScreen?.('workspace');

  document.getElementById('ws-book-name').textContent   = meta.name;
  document.getElementById('ws-book-author').textContent = meta.author;

  // Sync mobile topbar
  const mwtTitle   = document.getElementById('mwt-book-name');
  const mwtSub     = document.getElementById('mwt-book-sub');
  const mwtBadge   = document.getElementById('mwt-badge');
  const mwtBadgeTxt = document.getElementById('mwt-badge-text');
  if (mwtTitle) mwtTitle.textContent = meta.name;
  if (mwtSub)   mwtSub.textContent   = meta.author || '';
  if (mwtBadge && mwtBadgeTxt) {
    const chapterMatch  = (meta.author || '').match(/Ch\.?\s*\d+/i);
    mwtBadgeTxt.textContent = chapterMatch ? chapterMatch[0] : 'Open';
    mwtBadge.style.display  = 'flex';
  }

  // Show cover in outline panel
  const coverWrap = document.getElementById('ws-outline-cover');
  const coverImg  = document.getElementById('ws-outline-cover-img');
  if (coverWrap && coverImg) {
    coverImg.src = '/covers/' + bookId + '.jpg';
    coverWrap.style.display = 'block';
  }

  document.getElementById('ws-default-content').style.display = 'none';
  document.getElementById('ws-pdf-canvas-wrap').style.display = 'none';
  document.getElementById('ws-pdf-loading').style.display     = 'flex';
  document.getElementById('ws-loading-text').textContent      = 'Loading ' + meta.name + '…';
  document.getElementById('ws-loading-progress').textContent  = 'Fetching from server…';

  const pdfUrl = `${window.API_BASE}/pdf/${bookId}`;

  try {
    const pdfjsLib = await _loadPdfJs();

    // ── Try Cache API first ────────────────────────────────────────────────
    let pdfData   = null;

    if ('caches' in window) {
      try {
        const cache  = await caches.open(_WS_PDF_CACHE);
        const cached = await cache.match(pdfUrl);
        if (cached) {
          const bar = document.getElementById('ws-chat-progress-bar');
          const txt = document.getElementById('ws-chat-progress-text');
          if (bar) bar.style.width  = '100%';
          if (txt) txt.textContent  = 'Loaded from cache ⚡';
          document.getElementById('ws-loading-progress').textContent = 'From cache — rendering…';
          pdfData = await cached.arrayBuffer();
        }
      } catch (e) { console.warn('Cache read failed:', e); }
    }

    // ── Fetch from network if not cached ──────────────────────────────────
    if (!pdfData) {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentLength = response.headers.get('Content-Length');
      const total  = contentLength ? parseInt(contentLength) : 0;
      const reader = response.body.getReader();
      const chunks = [];
      let loaded   = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total) {
          const pct = Math.round((loaded / total) * 100);
          const mb  = (loaded / 1048576).toFixed(1);
          document.getElementById('ws-loading-progress').textContent = `${pct}% — ${mb} MB`;
          const bar = document.getElementById('ws-chat-progress-bar');
          const txt = document.getElementById('ws-chat-progress-text');
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = `${pct}% — ${mb} MB`;
        }
      }

      const totalBytes = chunks.reduce((sum, c) => sum + c.length, 0);
      const merged     = new Uint8Array(totalBytes);
      let offset       = 0;
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
      pdfData = merged.buffer;

      // Save to cache for next load
      if ('caches' in window) {
        try {
          const cache          = await caches.open(_WS_PDF_CACHE);
          const responseToCache = new Response(pdfData.slice(0), {
            headers: { 'Content-Type': 'application/pdf' },
          });
          await cache.put(pdfUrl, responseToCache);
        } catch (e) { console.warn('Cache write failed:', e); }
      }
    }

    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    window._wsPdfDoc      = await loadingTask.promise;
    window._wsTotalPages  = window._wsPdfDoc.numPages;
    window._wsCurrentPage = 1;
    window._wsPageContainers = [];

    document.getElementById('ws-loading-progress').textContent = `${window._wsTotalPages} pages — rendering…`;
    _wsUpdateBadge(1);

    const wrap = document.getElementById('ws-pdf-canvas-wrap');
    wrap.innerHTML = '';

    // Auto fit-to-width
    try {
      const fitPage  = await window._wsPdfDoc.getPage(1);
      const naturalW = fitPage.getViewport({ scale: 1 }).width;
      const availW   = wrap.clientWidth - 40;
      if (naturalW > 0 && availW > 100) {
        window._wsScale = Math.min(Math.max(availW / naturalW, window.ZOOM_MIN), window.ZOOM_MAX);
      }
    } catch (_) { /* keep default scale */ }

    // Build page container placeholders
    for (let i = 1; i <= window._wsTotalPages; i++) {
      const pageWrap = document.createElement('div');
      pageWrap.style.cssText  = 'position:relative;box-shadow:0 4px 24px rgba(0,0,0,0.6);flex-shrink:0;';
      pageWrap.dataset.pageNum = i;
      const canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      pageWrap.appendChild(canvas);
      wrap.appendChild(pageWrap);
      window._wsPageContainers.push(pageWrap);
    }

    // Render first 2 pages immediately
    for (let i = 0; i < Math.min(2, window._wsPageContainers.length); i++) {
      await _wsRenderPage(i + 1, window._wsPageContainers[i]);
    }

    // Grey placeholder for unrendered pages
    window._wsPageContainers.forEach(c => {
      if (!c.dataset.rendered) {
        const cv  = c.querySelector('canvas');
        cv.width  = 850; cv.height = 1100;
        c.style.width = '850px'; c.style.height = '1100px';
        cv.getContext('2d').fillStyle = '#1e1e24';
        cv.getContext('2d').fillRect(0, 0, 850, 1100);
      }
    });

    // Lazy render on scroll
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const num = parseInt(entry.target.dataset.pageNum);
          _wsRenderPage(num, entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { root: wrap, rootMargin: '300px' });
    window._wsPageContainers.slice(2).forEach(c => observer.observe(c));

    // Scroll-sync: update page badge + outline as user scrolls
    wrap.addEventListener('scroll', () => {
      const scrollMid = wrap.scrollTop + wrap.clientHeight / 2;
      let closest     = 1;
      for (let i = 0; i < window._wsPageContainers.length; i++) {
        const c = window._wsPageContainers[i];
        if (c.offsetTop <= scrollMid) closest = i + 1;
        else break;
      }
      if (closest !== window._wsCurrentPage) {
        window._wsCurrentPage = closest;
        _wsUpdateBadge(closest);
        _wsUpdateOutlineActive(closest);
      }
    });

    document.getElementById('ws-pdf-loading').style.display    = 'none';
    document.getElementById('ws-default-content').style.display = 'none';
    wrap.style.display = 'flex';

    _wsShowWelcome(meta);
    await _wsBuildOutline(window._wsPdfDoc, bookId);

  } catch (err) {
    console.error('PDF load error:', err);
    document.getElementById('ws-pdf-loading').style.display     = 'none';
    document.getElementById('ws-default-content').style.display = 'flex';
    if (msgs) msgs.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;text-align:center;padding:40px;">
        <div style="font-size:13px;color:var(--red);">⚠ Could not load this textbook. The server may be unavailable.</div>
        <button onclick="selectBook('${bookId}')" style="padding:7px 18px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-1);font-size:12px;font-family:var(--font-body);cursor:pointer;">Retry</button>
      </div>`;
  }
}

// ── Welcome message after book loads ──────────────────────────────────────

function _wsShowWelcome(meta) {
  const msgs = document.getElementById('ws-messages');
  if (!msgs) return;

  const suggestions = {
    atkins:   ['Explain entropy and the second law', 'What is Gibbs free energy?', 'Derive the Clausius inequality', 'Compare enthalpy and internal energy'],
    zumdahl:  ['Explain Le Chatelier\'s principle', 'What is a limiting reagent?', 'How do ionic bonds form?', 'Explain gas laws'],
    klein:    ['What are SN1 vs SN2 reactions?', 'Explain stereoisomerism', 'How does aromaticity work?', 'What is Markovnikov\'s rule?'],
    harris:   ['What is a titration?', 'Explain standard deviation in measurements', 'What is activity coefficient?', 'How does EDTA work?'],
    netter:   ['Describe the brachial plexus', 'What bones make up the shoulder?', 'Explain the femoral triangle', 'What is the carpal tunnel?'],
    anaphy2e: ['Explain the sliding filament theory', 'What is a sarcomere?', 'How does the renal system work?', 'Describe the cardiac cycle'],
  };
  const chips = (suggestions[window._wsBookId] || ['Summarize chapter 1', 'What are the key topics?', 'Give me an overview', 'Start a quiz']).slice(0, 3);

  msgs.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;padding:20px 16px 8px;">
      <div class="hc-ai" style="align-items:flex-start;">
        <div class="hc-ai-avatar" style="background:var(--gold-muted);border:1px solid var(--gold-border);color:var(--gold);font-size:13px;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">✦</div>
        <div style="background:var(--surface-1);border:1px solid var(--border-sm);border-radius:4px 14px 14px 14px;padding:13px 15px;font-size:13px;color:var(--text-1);line-height:1.65;flex:1;">
          <p style="margin:0 0 8px;"><strong>${meta.name}</strong> is ready! I've indexed the full textbook — ask me anything about it.</p>
          <p style="margin:0;color:var(--text-2);">Here are a few things you could ask:</p>
          <div style="display:flex;flex-direction:column;gap:5px;margin-top:10px;">
            ${chips.map(q => `
              <div class="ws-chip-item" onclick="wsSetInput('${q.replace(/'/g, "\\'")}');document.getElementById('ws-chat-input').focus();"
                style="display:flex;align-items:center;justify-content:space-between;padding:7px 11px;border:1px solid var(--border-xs);border-radius:8px;background:var(--surface-2);cursor:pointer;font-size:12px;color:var(--text-2);transition:all 120ms;">
                ${q}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

// ── PDF outline panel ──────────────────────────────────────────────────────

export function togglePdfOutline() {
  const panel = document.getElementById('ws-outline-panel');
  if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

async function _wsBuildOutline(pdfDoc, bookId) {
  const container = document.getElementById('ws-outline-items');
  if (!container) return;
  container.innerHTML = '';
  window._wsOutlineFlat = [];

  let items = [];

  // Try embedded PDF TOC first
  try {
    const outline = await pdfDoc.getOutline();
    if (outline && outline.length > 0) {
      const flatten = async (nodes, level) => {
        for (const node of nodes) {
          let page = null;
          try {
            if (node.dest) {
              const dest = typeof node.dest === 'string'
                ? await pdfDoc.getDestination(node.dest)
                : node.dest;
              if (dest) {
                const ref = dest[0];
                page = await pdfDoc.getPageIndex(ref) + 1;
              }
            }
          } catch (_) {}
          items.push({ title: node.title, page: page || 1, level });
          if (node.items && node.items.length && level < 1) {
            await flatten(node.items, level + 1);
          }
        }
      };
      await flatten(outline, 0);
    }
  } catch (e) { console.warn('TOC extraction failed:', e); }

  // Fallback to hardcoded outline
  if (!items.length) items = _wsBookOutlines[bookId] || [];

  if (!items.length) {
    container.innerHTML = '<div style="padding:8px 14px;font-size:11px;color:var(--text-4);">No contents available</div>';
    return;
  }

  items.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = 'outline-item' + (item.level > 0 ? ' sub' : '');
    el.innerHTML = `<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.title}</span><span class="outline-pg">${item.page}</span>`;
    el.dataset.page = item.page;
    el.addEventListener('click', () => {
      wsGoToPage(item.page);
      _wsSetActiveOutlineItem(idx);
    });
    container.appendChild(el);
    window._wsOutlineFlat.push({ ...item, el });
  });

  _wsUpdateOutlineActive(1);
}

function _wsSetActiveOutlineItem(idx) {
  window._wsOutlineFlat.forEach((item, i) => {
    item.el.classList.toggle('active', i === idx);
  });
  window._wsOutlineFlat[idx]?.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function _wsUpdateOutlineActive(currentPage) {
  if (!window._wsOutlineFlat.length) return;
  let activeIdx = 0;
  for (let i = 0; i < window._wsOutlineFlat.length; i++) {
    if (window._wsOutlineFlat[i].page <= currentPage) activeIdx = i;
    else break;
  }
  _wsSetActiveOutlineItem(activeIdx);
}

// ── Chat: copy / make flashcard ────────────────────────────────────────────

export function wsCopyMsg(btn, msgId) {
  const textEl = document.getElementById(msgId)?.querySelector('.ai-text');
  if (!textEl) return;
  navigator.clipboard?.writeText(textEl.innerText).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2000);
  });
}

export async function wsMakeFlashcard(btn, msgId, question) {
  if (btn.classList.contains('loading')) return;
  btn.classList.add('loading');
  btn.innerHTML = `<div class="hc-thinking" style="display:inline-flex;gap:3px;"><span></span><span></span><span></span></div> Generating…`;

  const topic = (question || document.getElementById(msgId)?.querySelector('.ai-text')?.innerText?.slice(0, 120) || 'this topic').trim();

  try {
    const res  = await fetch(`${window.API_BASE}/generate-flashcards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, bookId: window._wsBookId || 'atkins', count: 10 }),
    });
    const data = await res.json();
    if (!data.success || !data.flashcards?.length) throw new Error(data.error || 'No cards returned');

    // Load into flashcard screen state
    window._fcDeck          = data.flashcards;
    window._fcDeckTopic     = topic;
    window._fcCurrentDeckId = null;
    window._fcIndex         = 0;
    window._fcStats         = { easy: 0, ok: 0, hard: 0, skipped: 0 };
    window._fcCardRatings   = [];
    window._fcClearSkeleton?.();
    window._fcRenderCard?.();

    window.wsShowToast?.('🃏', `${data.flashcards.length} flashcards generated!`, 'var(--gold-border)');
    setTimeout(() => window.showScreen?.('flash'), 600);

    await window._fcSaveDeck?.(topic, data.flashcards);
  } catch (e) {
    window.wsShowToast?.('⚠', 'Could not generate flashcards', '#f87171');
    console.error(e);
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg> Make Flashcard`;
  }
}

// ── Chat input helpers ─────────────────────────────────────────────────────

export function wsSetInput(text) {
  const inp = document.getElementById('ws-chat-input');
  if (!inp) return;
  inp.value = text;
  inp.focus();
  wsAutoResize(inp);
}
export function wsAutoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
export function wsScrollBottom() {
  const msgs = document.getElementById('ws-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}
export function wsClearChat() {
  window._wsChatHistory = [];
  const msgs = document.getElementById('ws-messages');
  if (msgs) msgs.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-4);text-align:center;padding:24px;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <div style="font-size:12px;color:var(--text-4);">Ask a question to start the conversation</div>
    </div>`;
  if (window._wsBookId) window._saveWsSession?.(window._wsBookId, []);
  window.wsShowToast?.('🗑', 'Chat cleared', 'var(--border-md)');
}

// ── Chat rendering ─────────────────────────────────────────────────────────

export function wsAppendUser(text) {
  const msgs = document.getElementById('ws-messages');
  if (!msgs) return;
  const d = document.createElement('div');
  d.className = 'msg msg-user';
  d.innerHTML = `<div class="bubble-user">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`;
  msgs.appendChild(d);
  wsScrollBottom();
}

function _wsAvatarSvg() {
  const id = 'av' + Math.random().toString(36).slice(2, 6);
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="13" height="13">
    <defs>
      <linearGradient id="${id}a" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="#c8a84b"/>
        <stop offset="100%" stop-color="#a855f7"/>
      </linearGradient>
      <linearGradient id="${id}b" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="#a855f7"/>
        <stop offset="100%" stop-color="#c8a84b"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="50" rx="38" ry="13" fill="none" stroke="url(#${id}a)" stroke-width="9" opacity="0.95"/>
    <ellipse cx="50" cy="50" rx="38" ry="13" fill="none" stroke="url(#${id}b)" stroke-width="9" transform="rotate(60 50 50)" opacity="0.85"/>
    <ellipse cx="50" cy="50" rx="38" ry="13" fill="none" stroke="url(#${id}a)" stroke-width="9" transform="rotate(120 50 50)" opacity="0.75"/>
    <circle cx="50" cy="50" r="7" fill="#e8ac2e"/>
  </svg>`;
}

export function wsAppendThinking() {
  const msgs = document.getElementById('ws-messages');
  if (!msgs) return;
  const d = document.createElement('div');
  d.className = 'msg msg-ai';
  d.id        = 'ws-thinking-msg';
  d.innerHTML = `
    <div class="ai-row">
      <div class="ai-ava">${_wsAvatarSvg()}</div>
      <div class="ai-body">
        <div style="display:flex;align-items:center;gap:9px;padding:3px 0;">
          <div class="hc-thinking"><span></span><span></span><span></span><span></span><span></span></div>
          <span id="ws-thinking-label" style="font-size:11px;color:var(--text-3);font-family:var(--font-mono);letter-spacing:0.04em;">Thinking…</span>
        </div>
      </div>
    </div>`;
  msgs.appendChild(d);
  wsScrollBottom();
  const labels = ['Thinking…', 'Searching book…', 'Reading context…', 'Composing answer…'];
  let li = 0;
  d._labelTimer = setInterval(() => {
    const el = document.getElementById('ws-thinking-label');
    if (el) { li = (li + 1) % labels.length; el.textContent = labels[li]; }
  }, 1800);
}

export function wsRemoveThinking() {
  const el = document.getElementById('ws-thinking-msg');
  if (el) { clearInterval(el._labelTimer); el.remove(); }
}

export function wsAppendAI(answer, sources, question) {
  const msgs     = document.getElementById('ws-messages');
  if (!msgs) return;
  const bookName = document.getElementById('ws-book-name')?.textContent || '';
  const msgId    = 'ws-msg-' + Date.now();

  // Sources block
  let sourcesHtml = '';
  if (sources && sources.length > 0) {
    const items = sources.map(s => {
      const preview = (s.text || '').trim().slice(0, 55).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return `
        <div class="source-item" onclick="wsGoToPage(${s.page})" title="Jump to page ${s.page}" style="cursor:pointer;">
          <div class="source-icon">📘</div>
          <div style="flex:1;min-width:0;">
            <div class="source-name">${bookName}</div>
            <div class="source-meta">${preview}…</div>
          </div>
          <span class="source-page">p. ${s.page}</span>
        </div>`;
    }).join('');
    sourcesHtml = `
      <div class="sources-head" style="margin-top:12px;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        Sources
      </div>
      <div class="source-list">${items}</div>`;
  }

  // Follow-up suggestions
  const followups     = window._isFollowupsEnabled?.() ? _wsFollowups(answer, question) : [];
  const followupHtml  = followups.length ? `
    <div class="followups" style="margin-top:10px;">
      <div class="followup-head">Follow-up questions</div>
      <div class="followup-list">
        ${followups.map(q => `
          <div class="followup-item" onclick="wsSetInput('${q.replace(/'/g, "\\'")}')">
            ${q.replace(/&/g, '&amp;').replace(/</g, '&lt;')}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
          </div>`).join('')}
      </div>
    </div>` : '';

  // Auto-flashcard prompt
  const autoFlashHtml = window._isAutoFlashEnabled?.() ? `
    <div style="margin-top:8px;padding:8px 10px;background:var(--violet-muted);border:1px solid var(--violet-border);border-radius:var(--r-md);display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <span style="font-size:11px;color:var(--text-2);">💡 Save this as a flashcard?</span>
      <button onclick="wsMakeFlashcard(this,'${msgId}',\`${(question || '').replace(/`/g, "'").replace(/\n/g, ' ').slice(0, 120)}\`)" style="font-size:11px;padding:4px 10px;border-radius:var(--r-pill);background:var(--violet-muted);border:1px solid var(--violet-border);color:var(--violet);cursor:pointer;font-family:var(--font-body);">Save flashcard</button>
    </div>` : '';

  const d = document.createElement('div');
  d.className = 'msg msg-ai';
  d.id        = msgId;
  d.innerHTML = `
    <div class="ai-row">
      <div class="ai-ava">${_wsAvatarSvg()}</div>
      <div class="ai-body">
        <div class="ai-text">${window.wsRender?.(answer) ?? answer}</div>
        ${sourcesHtml}
        <div class="msg-acts" style="margin-top:10px;">
          <button class="msg-act" onclick="wsCopyMsg(this, '${msgId}')">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy
          </button>
          <button class="msg-act" onclick="wsMakeFlashcard(this, '${msgId}', \`${(question || '').replace(/`/g, "'").replace(/\n/g, ' ').slice(0, 120)}\`)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg> Make Flashcard
          </button>
          <button class="msg-act" onclick="_wsRegenerate('${msgId}', \`${(question || '').replace(/`/g, "'").replace(/\n/g, ' ')}\`)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.67"/></svg> Regenerate
          </button>
        </div>
        ${followupHtml}
        ${autoFlashHtml}
      </div>
    </div>`;
  msgs.appendChild(d);
  wsScrollBottom();
}

export function wsAppendError(msg) {
  const msgs = document.getElementById('ws-messages');
  if (!msgs) return;
  const d = document.createElement('div');
  d.className = 'msg msg-ai';
  d.innerHTML = `<div class="ai-row"><div class="ai-ava">${_wsAvatarSvg()}</div><div class="ai-body"><p class="ai-text" style="color:#f87171;">⚠ ${msg.replace(/</g, '&lt;')}</p></div></div>`;
  msgs.appendChild(d);
  wsScrollBottom();
}

// ── Follow-up generator ────────────────────────────────────────────────────

function _wsFollowups(answer, question) {
  const a = (answer   || '').toLowerCase();
  const q = (question || '').toLowerCase();
  if (a.includes('entropy')      || q.includes('entropy'))
    return ['What happens to entropy during an adiabatic process?', 'Derive the entropy change for an ideal gas expansion'];
  if (a.includes('equilibrium')  || q.includes('equilibrium'))
    return ['How does temperature affect the equilibrium constant?', "What is Le Chatelier's principle?"];
  if (a.includes('kinetic')      || q.includes('kinetic') || a.includes('rate'))
    return ['What factors affect reaction rate?', 'Explain the Arrhenius equation'];
  if (a.includes('bond')         || q.includes('bond') || a.includes('orbital'))
    return ['What is hybridization and how does it affect molecular shape?', 'Compare ionic vs covalent bonding'];
  if (a.includes('thermodynam')  || q.includes('thermodynam'))
    return ['How are enthalpy and internal energy related?', 'What does the second law of thermodynamics state?'];
  return ['Can you give a worked example?', 'How does this relate to real-world applications?'];
}

// ── Regenerate ─────────────────────────────────────────────────────────────

async function _wsRegenerate(msgId, question) {
  document.getElementById(msgId)?.remove();
  const hist = window._wsChatHistory;
  if (hist.length && hist[hist.length - 1].role === 'assistant') hist.pop();
  await _wsAsk(question);
}

// ── Main send ──────────────────────────────────────────────────────────────

export async function wsChatSend() {
  if (window._wsTyping) return;
  const inp      = document.getElementById('ws-chat-input');
  const question = inp?.value?.trim();
  if (!question && !window._wsAttachments?.length) return;

  const atts = window._wsAttachments ?? [];

  // Build display bubble (text + attachment thumbnails)
  let bubbleHtml = question ? question.replace(/&/g, '&amp;').replace(/</g, '&lt;') : '';
  if (atts.length) {
    bubbleHtml += atts.map(a =>
      a.type === 'image'
        ? `<img src="${a.dataUrl}" style="max-width:180px;max-height:140px;border-radius:8px;display:block;margin-top:6px;">`
        : `<div style="display:inline-flex;align-items:center;gap:6px;background:var(--surface-3);border:1px solid var(--border-md);border-radius:8px;padding:6px 10px;font-size:12px;margin-top:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>${a.name}</div>`
    ).join('');
  }

  const msgs = document.getElementById('ws-messages');
  if (msgs) {
    const d = document.createElement('div');
    d.className = 'msg msg-user';
    d.innerHTML = `<div class="bubble-user">${bubbleHtml}</div>`;
    msgs.appendChild(d);
    wsScrollBottom();
  }

  // Build text prompt (include attachment names for context)
  let fullQuestion = question;
  if (atts.length) {
    const names = atts.map(a => `"${a.name}" (${a.type})`).join(', ');
    fullQuestion += `\n[Attached: ${names}]`;
  }

  if (inp)  { inp.value = ''; wsAutoResize(inp); inp.focus(); }
  window._wsChatHistory.push({ role: 'user', content: fullQuestion });
  if (window._wsAttachments) window._wsAttachments = [];
  _wsRenderPreview();

  await _wsAsk(fullQuestion);
}

async function _wsAsk(question) {
  window._wsTyping = true;
  const sendBtn = document.getElementById('ws-chat-send');
  if (sendBtn) sendBtn.disabled = true;
  wsAppendThinking();

  try {
    const res = await fetch(`${window.API_BASE}/ask`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        bookId:     window._wsBookId || 'atkins',
        mode:       window._getStudyMode?.() ?? 'balanced',
        complexity: window._getStudyMode?.() === 'concise' ? 3 : window._getStudyMode?.() === 'detailed' ? 8 : 5,
        history:    (window._wsChatHistory || []).slice(-10),
      }),
    });
    wsRemoveThinking();

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      wsAppendError(err.error || `Server error ${res.status}`);
      window._wsChatHistory.pop();
    } else {
      const data   = await res.json();
      const answer = data.answer || 'No response.';
      wsAppendAI(answer, data.sources || [], question);
      window._wsChatHistory.push({ role: 'assistant', content: answer });
      window._saveWsSession?.(window._wsBookId, window._wsChatHistory);
    }
  } catch (e) {
    wsRemoveThinking();
    wsAppendError('Could not reach the server. Check your connection.');
    window._wsChatHistory.pop();
  } finally {
    window._wsTyping = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

// ── Workspace attachment system ────────────────────────────────────────────

export function wsToggleAttachMenu(e) {
  e.stopPropagation();
  const menu   = document.getElementById('ws-attach-menu');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('.attach-menu').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

export function wsAttachTrigger(type) {
  document.querySelectorAll('.attach-menu').forEach(m => m.classList.remove('open'));
  document.getElementById(type === 'image' ? 'ws-attach-image' : 'ws-attach-pdf')?.click();
}

export async function wsHandleAttach(input, type) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const dataUrl = await _readFile(file);
  const att     = { type, file, dataUrl, name: file.name };
  if (!window._wsAttachments) window._wsAttachments = [];
  window._wsAttachments.push(att);
  _wsRenderPreview();
}

function _wsRenderPreview() {
  const strip = document.getElementById('ws-attach-preview');
  if (!strip) return;
  strip.innerHTML = '';
  const atts = window._wsAttachments ?? [];
  strip.style.display = atts.length ? 'flex' : 'none';
  atts.forEach((att, i) => {
    strip.appendChild(_buildThumb(att, () => {
      atts.splice(i, 1);
      _wsRenderPreview();
    }));
  });
}

// ── Mobile view toggle ─────────────────────────────────────────────────────

export function wsMobileView(view) {
  const ws       = document.getElementById('screen-workspace');
  const pdfPanel = document.querySelector('#screen-workspace .pdf-panel');
  const tabChat  = document.getElementById('mwt-tab-chat');
  const tabPdf   = document.getElementById('mwt-tab-pdf');
  if (!ws || !pdfPanel) return;

  if (view === 'pdf') {
    ws.classList.add('ws-pdf-mode');
    pdfPanel.classList.add('mobile-visible');
    tabChat?.classList.remove('active');
    tabPdf?.classList.add('active');
  } else {
    ws.classList.remove('ws-pdf-mode');
    pdfPanel.classList.remove('mobile-visible');
    tabChat?.classList.add('active');
    tabPdf?.classList.remove('active');
  }
}

// ── DOM-ready wiring ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Chat input — Enter to send + auto-resize
  const chatInput = document.getElementById('ws-chat-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); wsChatSend(); }
    });
    chatInput.addEventListener('input', function () { wsAutoResize(this); });
  }

  // Close attach menus when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.chat-plus-wrap')) {
      document.querySelectorAll('.attach-menu').forEach(m => m.classList.remove('open'));
    }
  });

  // Patch showScreen to reset mobile tab to Chat when switching to workspace
  const _origShowScreen = window.showScreen;
  if (typeof _origShowScreen === 'function') {
    window.showScreen = function (id) {
      _origShowScreen(id);
      if (id === 'workspace' && window.innerWidth <= 768) {
        wsMobileView('chat');
      }
    };
  }
});

// ── Window globals ─────────────────────────────────────────────────────────

window.selectBook          = selectBook;
window.togglePdfOutline    = togglePdfOutline;
window.wsPrevPage          = wsPrevPage;
window.wsNextPage          = wsNextPage;
window.wsGoToPage          = wsGoToPage;
window.wsJumpToPage        = wsJumpToPage;
window.wsZoomIn            = wsZoomIn;
window.wsZoomOut           = wsZoomOut;
window.wsCopyMsg           = wsCopyMsg;
window.wsMakeFlashcard     = wsMakeFlashcard;
window.wsSetInput          = wsSetInput;
window.wsAutoResize        = wsAutoResize;
window.wsScrollBottom      = wsScrollBottom;
window.wsClearChat         = wsClearChat;
window.wsAppendUser        = wsAppendUser;
window.wsAppendThinking    = wsAppendThinking;
window.wsRemoveThinking    = wsRemoveThinking;
window.wsAppendAI          = wsAppendAI;
window.wsAppendError       = wsAppendError;
window.wsChatSend          = wsChatSend;
window.wsToggleAttachMenu  = wsToggleAttachMenu;
window.wsAttachTrigger     = wsAttachTrigger;
window.wsHandleAttach      = wsHandleAttach;
window.wsMobileView        = wsMobileView;
// Private helpers exposed for monolith cross-script calls
window._wsRegenerate       = _wsRegenerate;
window._wsRenderPage       = _wsRenderPage;
