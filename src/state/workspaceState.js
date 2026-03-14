/**
 * src/state/workspaceState.js — Workspace state
 *
 * Owns all state and logic for the Workspace screen:
 *  • PDF viewer (PDF.js lazy-load, page render, zoom, page nav, outline)
 *  • Book selection and welcome message
 *  • Chat (history, send, append helpers, follow-ups, regenerate)
 *  • Toast notifications
 *  • Attachment system (workspace + home)
 *  • Library modal filters
 *
 * Task 16 — extracted from monolith:
 *   PDF / book block  → lines 2049–2673
 *   Chat / toast      → lines 3571–4318
 */

import { API_BASE, askQuestion } from '../lib/api.js';
import {
  createSession,
  appendMessage,
  getSession,
  getActiveSessionId,
  setActiveSessionId,
} from '../utils/storage.js';

// ── Book metadata ──────────────────────────────────────────────────────────

export const wsBookMeta = {
  zumdahl:  { name: 'General Chemistry',              author: 'Zumdahl & Zumdahl' },
  atkins:   { name: 'Physical Chemistry',             author: 'Atkins & de Paula' },
  klein:    { name: 'Organic Chemistry',              author: 'David Klein' },
  harris:   { name: 'Quantitative Chemical Analysis', author: 'Daniel C. Harris' },
  berg:     { name: 'Biochemistry',                   author: 'Berg, Tymoczko & Stryer' },
  netter:   { name: 'Atlas of Human Anatomy',         author: 'Frank H. Netter' },
  anaphy2e: { name: 'Anatomy & Physiology',           author: 'Patton & Thibodeau' },
};

// ── PDF state ──────────────────────────────────────────────────────────────

export let _wsPdfDoc        = null;
export let _wsScale         = 1.0;
export let _wsCurrentPage   = 1;
export let _wsTotalPages    = 0;
export let _wsPageContainers = [];
export const ZOOM_STEP = 0.2, ZOOM_MIN = 0.6, ZOOM_MAX = 3.0;

// ── Chat state ─────────────────────────────────────────────────────────────

export let _wsBookId      = localStorage.getItem('chunks_default_book') || 'atkins';
export let _wsChatHistory = [];
let _wsSessionId = null; // tracks the current workspace session in localStorage
export let _newChatIsIncognito = false;
export let _wsTyping      = false;

// ── Per-book fallback outlines ─────────────────────────────────────────────

export const _wsBookOutlines = {
  atkins: [
    { title:'1. The Properties of Gases',    page:1,   level:0 },
    { title:'2. The First Law',              page:45,  level:0 },
    { title:'3. The Second & Third Laws',    page:87,  level:0 },
    { title:'3A. Entropy',                   page:88,  level:1 },
    { title:'3B. Entropy Changes',           page:98,  level:1 },
    { title:'3C. Concentrating on System',   page:109, level:1 },
    { title:'4. Physical Transformations',   page:131, level:0 },
    { title:'5. Simple Mixtures',            page:159, level:0 },
    { title:'6. Chemical Equilibrium',       page:199, level:0 },
    { title:'7. Quantum Theory',             page:239, level:0 },
    { title:'8. Atomic Structure',           page:285, level:0 },
    { title:'9. Molecular Structure',        page:321, level:0 },
    { title:'10. Molecular Symmetry',        page:371, level:0 },
    { title:'11. Molecular Spectroscopy',    page:399, level:0 },
    { title:'12. Statistical Thermodynamics',page:455, level:0 },
    { title:'13. Molecules in Motion',       page:503, level:0 },
    { title:'14. Chemical Kinetics',         page:543, level:0 },
    { title:'15. Reaction Dynamics',         page:591, level:0 },
    { title:'16. Magnetic Resonance',        page:631, level:0 },
  ],
  zumdahl: [
    { title:'1. Chemical Foundations',       page:1,   level:0 },
    { title:'2. Atoms, Molecules, Ions',     page:37,  level:0 },
    { title:'3. Stoichiometry',              page:79,  level:0 },
    { title:'4. Types of Chemical Reactions',page:127, level:0 },
    { title:'5. Gases',                      page:183, level:0 },
    { title:'6. Thermochemistry',            page:237, level:0 },
    { title:'7. Atomic Structure',           page:281, level:0 },
    { title:'8. Bonding: General Concepts',  page:329, level:0 },
    { title:'9. Covalent Bonding: Orbitals', page:379, level:0 },
    { title:'10. Liquids and Solids',        page:417, level:0 },
    { title:'11. Properties of Solutions',   page:461, level:0 },
    { title:'12. Chemical Kinetics',         page:505, level:0 },
    { title:'13. Chemical Equilibrium',      page:555, level:0 },
    { title:'14. Acids and Bases',           page:601, level:0 },
    { title:'15. Acid-Base Equilibria',      page:647, level:0 },
    { title:'16. Solubility Equilibria',     page:695, level:0 },
    { title:'17. Spontaneity, Entropy, Free Energy', page:731, level:0 },
    { title:'18. Electrochemistry',          page:779, level:0 },
  ],
};

export let _wsOutlineFlat = [];

// ── Toast ─────────────────────────────────────────────────────────────────

let _wsToastTimer = null;

export function wsShowToast(icon, text, color) {
  const t = document.getElementById('ws-toast');
  if (!t) return;
  t.innerHTML = `<span style="font-size:14px;">${icon}</span><span>${text}</span>`;
  t.style.borderColor = color || '';
  t.classList.add('show');
  clearTimeout(_wsToastTimer);
  _wsToastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ── PDF badge ─────────────────────────────────────────────────────────────

export function _wsUpdateBadge(page) {
  const b = document.getElementById('ws-page-badge');
  if (b) b.textContent = `${page} / ${_wsTotalPages}`;
  const m = document.getElementById('mpn-page-label');
  if (m) m.textContent = `${page} / ${_wsTotalPages}`;
}

// ── Page navigation ───────────────────────────────────────────────────────

export function wsPrevPage() {
  if (!_wsPdfDoc || _wsCurrentPage <= 1) return;
  wsGoToPage(_wsCurrentPage - 1);
}
export function wsNextPage() {
  if (!_wsPdfDoc || _wsCurrentPage >= _wsTotalPages) return;
  wsGoToPage(_wsCurrentPage + 1);
}
export function wsGoToPage(n) {
  n = Math.max(1, Math.min(n, _wsTotalPages));
  _wsCurrentPage = n;
  _wsUpdateBadge(n);
  const wrap   = document.getElementById('ws-pdf-canvas-wrap');
  const target = _wsPageContainers[n - 1];
  if (target && wrap) wrap.scrollTop = target.offsetTop - 16;
}
export function wsJumpToPage() {
  const n = parseInt(prompt(`Go to page (1 – ${_wsTotalPages}):`, _wsCurrentPage));
  if (!isNaN(n)) wsGoToPage(n);
}

// ── Zoom ─────────────────────────────────────────────────────────────────

export async function wsZoomIn()  { await _wsRescale(_wsScale + ZOOM_STEP); }
export async function wsZoomOut() { await _wsRescale(_wsScale - ZOOM_STEP); }

export async function _wsRescale(newScale) {
  if (!_wsPdfDoc) return;
  newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newScale));
  if (Math.abs(newScale - _wsScale) < 0.01) return;
  _wsScale = newScale;
  for (let i = 0; i < _wsPageContainers.length; i++) {
    const c = _wsPageContainers[i];
    if (!c.dataset.rendered) continue;
    c.dataset.rendered = '';
    await _wsRenderPage(i + 1, c);
  }
}

// ── PDF.js lazy loader ────────────────────────────────────────────────────

let _pdfjsLib = null;
export function _loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (_pdfjsLib) return resolve(_pdfjsLib);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      _pdfjsLib = window.pdfjsLib;
      _pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(_pdfjsLib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ── Render one page ───────────────────────────────────────────────────────

export async function _wsRenderPage(pageNum, container) {
  if (container.dataset.rendered === '1') return;
  container.dataset.rendered = '1';
  try {
    const page     = await _wsPdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: _wsScale });
    const canvas   = container.querySelector('canvas');
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    container.style.width  = viewport.width  + 'px';
    container.style.height = viewport.height + 'px';
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  } catch (e) { console.warn('Page render error', pageNum, e); }
}

// ── Book loader ───────────────────────────────────────────────────────────

export async function selectBook(bookId) {
  if (typeof closeLibraryModal === 'function') closeLibraryModal();
  const meta = wsBookMeta[bookId];
  if (!meta) return;

  _wsBookId = bookId;
  _wsChatHistory = [];
  const short  = meta.name.split(' ').slice(0, 2).join(' ');
  const ctag   = document.getElementById('ws-context-tag');
  const ctitle = document.getElementById('ws-chat-title');
  if (ctag)   ctag.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg> ${short}`;
  if (ctitle) ctitle.textContent = meta.name;

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

  if (typeof showScreen === 'function') showScreen('workspace');

  document.getElementById('ws-book-name').textContent   = meta.name;
  document.getElementById('ws-book-author').textContent = meta.author;

  const mwtTitle = document.getElementById('mwt-book-name');
  const mwtSub   = document.getElementById('mwt-book-sub');
  const mwtBadge = document.getElementById('mwt-badge');
  const mwtBadgeTxt = document.getElementById('mwt-badge-text');
  if (mwtTitle) mwtTitle.textContent = meta.name;
  if (mwtSub)   mwtSub.textContent   = meta.author || '';
  if (mwtBadge && mwtBadgeTxt) {
    mwtBadgeTxt.textContent = 'Open';
    mwtBadge.style.display = 'flex';
  }

  const coverWrap = document.getElementById('ws-outline-cover');
  const coverImg  = document.getElementById('ws-outline-cover-img');
  if (coverWrap && coverImg) {
    coverImg.src = '/public/covers/' + bookId + '.jpg';
    coverWrap.style.display = 'block';
  }

  document.getElementById('ws-default-content').style.display = 'none';
  document.getElementById('ws-pdf-canvas-wrap').style.display = 'none';
  document.getElementById('ws-pdf-loading').style.display     = 'flex';
  document.getElementById('ws-loading-text').textContent      = 'Loading ' + meta.name + '…';
  document.getElementById('ws-loading-progress').textContent  = 'Fetching from server…';

  const pdfUrl    = `${API_BASE}/pdf/${bookId}`;
  const CACHE_NAME = 'chunks-pdf-v1';

  try {
    const pdfjsLib = await _loadPdfJs();
    let pdfData = null;

    if ('caches' in window) {
      try {
        const cache  = await caches.open(CACHE_NAME);
        const cached = await cache.match(pdfUrl);
        if (cached) {
          const bar = document.getElementById('ws-chat-progress-bar');
          const txt = document.getElementById('ws-chat-progress-text');
          if (bar) bar.style.width = '100%';
          if (txt) txt.textContent = 'Loaded from cache ⚡';
          document.getElementById('ws-loading-progress').textContent = 'From cache — rendering…';
          pdfData = await cached.arrayBuffer();
        }
      } catch (e) { console.warn('Cache read failed:', e); }
    }

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
      const merged = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
      pdfData = merged.buffer;

      if ('caches' in window) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(pdfUrl, new Response(pdfData.slice(0), { headers: { 'Content-Type': 'application/pdf' } }));
        } catch (e) { console.warn('Cache write failed:', e); }
      }
    }

    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    _wsPdfDoc      = await loadingTask.promise;
    _wsTotalPages  = _wsPdfDoc.numPages;
    _wsCurrentPage = 1;
    _wsPageContainers = [];

    document.getElementById('ws-loading-progress').textContent = `${_wsTotalPages} pages — rendering…`;
    _wsUpdateBadge(1);

    const wrap = document.getElementById('ws-pdf-canvas-wrap');
    wrap.innerHTML = '';

    try {
      const _fitPage  = await _wsPdfDoc.getPage(1);
      const _naturalW = _fitPage.getViewport({ scale: 1 }).width;
      const _availW   = wrap.clientWidth - 40;
      if (_naturalW > 0 && _availW > 100) {
        _wsScale = Math.min(Math.max(_availW / _naturalW, ZOOM_MIN), ZOOM_MAX);
      }
    } catch (_) { /* keep default scale */ }

    for (let i = 1; i <= _wsTotalPages; i++) {
      const pageWrap = document.createElement('div');
      pageWrap.style.cssText = 'position:relative;box-shadow:0 4px 24px rgba(0,0,0,0.6);flex-shrink:0;';
      pageWrap.dataset.pageNum = i;
      const canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      pageWrap.appendChild(canvas);
      wrap.appendChild(pageWrap);
      _wsPageContainers.push(pageWrap);
    }

    for (let i = 0; i < Math.min(2, _wsPageContainers.length); i++) {
      await _wsRenderPage(i + 1, _wsPageContainers[i]);
    }

    _wsPageContainers.forEach(c => {
      if (!c.dataset.rendered) {
        const cv = c.querySelector('canvas');
        cv.width = 850; cv.height = 1100;
        c.style.width = '850px'; c.style.height = '1100px';
        cv.getContext('2d').fillStyle = '#1e1e24';
        cv.getContext('2d').fillRect(0, 0, 850, 1100);
      }
    });

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const num = parseInt(entry.target.dataset.pageNum);
          _wsRenderPage(num, entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { root: wrap, rootMargin: '300px' });
    _wsPageContainers.slice(2).forEach(c => observer.observe(c));

    wrap.addEventListener('scroll', () => {
      const scrollMid = wrap.scrollTop + wrap.clientHeight / 2;
      let closest = 1;
      for (let i = 0; i < _wsPageContainers.length; i++) {
        const c = _wsPageContainers[i];
        if (c.offsetTop <= scrollMid) closest = i + 1;
        else break;
      }
      if (closest !== _wsCurrentPage) {
        _wsCurrentPage = closest;
        _wsUpdateBadge(closest);
        _wsUpdateOutlineActive(closest);
      }
    });

    document.getElementById('ws-pdf-loading').style.display    = 'none';
    document.getElementById('ws-default-content').style.display = 'none';
    wrap.style.display = 'flex';

    _wsShowWelcome(meta);
    await _wsBuildOutline(_wsPdfDoc, bookId);

  } catch (err) {
    console.error('PDF load error:', err);
    document.getElementById('ws-pdf-loading').style.display     = 'none';
    document.getElementById('ws-default-content').style.display = 'flex';
    const msgs = document.getElementById('ws-messages');
    if (msgs) msgs.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;text-align:center;padding:40px;">
        <div style="font-size:13px;color:var(--red);">⚠ Could not load this textbook. The server may be unavailable.</div>
        <button onclick="selectBook('${bookId}')" style="padding:7px 18px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-1);font-size:12px;font-family:var(--font-body);cursor:pointer;">Retry</button>
      </div>`;
  }
}

// ── Welcome message ───────────────────────────────────────────────────────

export function _wsShowWelcome(meta) {
  const msgs = document.getElementById('ws-messages');
  if (!msgs) return;
  const suggestions = {
    atkins:   ['Explain entropy and the second law', 'What is Gibbs free energy?', 'Derive the Clausius inequality', 'Compare enthalpy and internal energy'],
    zumdahl:  ["Explain Le Chatelier's principle", 'What is a limiting reagent?', 'How do ionic bonds form?', 'Explain gas laws'],
    klein:    ['What are SN1 vs SN2 reactions?', 'Explain stereoisomerism', 'How does aromaticity work?', "What is Markovnikov's rule?"],
    harris:   ['What is a titration?', 'Explain standard deviation in measurements', 'What is activity coefficient?', 'How does EDTA work?'],
    netter:   ['Describe the brachial plexus', 'What bones make up the shoulder?', 'Explain the femoral triangle', 'What is the carpal tunnel?'],
    anaphy2e: ['Explain the sliding filament theory', 'What is a sarcomere?', 'How does the renal system work?', 'Describe the cardiac cycle'],
  };
  const chips = (suggestions[_wsBookId] || ['Summarize chapter 1', 'What are the key topics?', 'Give me an overview', 'Start a quiz']).slice(0, 3);
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

// ── Outline panel ─────────────────────────────────────────────────────────

export function togglePdfOutline() {
  const panel = document.getElementById('ws-outline-panel');
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

export async function _wsBuildOutline(pdfDoc, bookId) {
  const container = document.getElementById('ws-outline-items');
  container.innerHTML = '';
  _wsOutlineFlat = [];
  let items = [];

  try {
    const outline = await pdfDoc.getOutline();
    if (outline && outline.length > 0) {
      const flatten = async (nodes, level) => {
        for (const node of nodes) {
          let page = null;
          try {
            if (node.dest) {
              const dest = typeof node.dest === 'string' ? await pdfDoc.getDestination(node.dest) : node.dest;
              if (dest) page = await pdfDoc.getPageIndex(dest[0]) + 1;
            }
          } catch (_) {}
          items.push({ title: node.title, page: page || 1, level });
          if (node.items && node.items.length && level < 1) await flatten(node.items, level + 1);
        }
      };
      await flatten(outline, 0);
    }
  } catch (e) { console.warn('TOC extraction failed:', e); }

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
    el.addEventListener('click', () => { wsGoToPage(item.page); _wsSetActiveOutlineItem(idx); });
    container.appendChild(el);
    _wsOutlineFlat.push({ ...item, el });
  });

  _wsUpdateOutlineActive(1);
}

export function _wsSetActiveOutlineItem(idx) {
  _wsOutlineFlat.forEach((item, i) => item.el.classList.toggle('active', i === idx));
  _wsOutlineFlat[idx]?.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export function _wsUpdateOutlineActive(currentPage) {
  if (!_wsOutlineFlat.length) return;
  let activeIdx = 0;
  for (let i = 0; i < _wsOutlineFlat.length; i++) {
    if (_wsOutlineFlat[i].page <= currentPage) activeIdx = i;
    else break;
  }
  _wsSetActiveOutlineItem(activeIdx);
}

// ── Library search filters ────────────────────────────────────────────────

export function filterLibrary(q) {
  const query = q.toLowerCase();
  document.querySelectorAll('.library-book-card').forEach(card => {
    card.style.display = card.textContent.toLowerCase().includes(query) ? '' : 'none';
  });
  document.querySelectorAll('.lib-section').forEach(sec => {
    sec.style.display = [...sec.querySelectorAll('.library-book-card')].some(c => c.style.display !== 'none') ? '' : 'none';
  });
  document.getElementById('lib-empty-state').style.display =
    [...document.querySelectorAll('.library-book-card')].every(c => c.style.display === 'none') ? 'flex' : 'none';
}

export function filterLibSection(section, btn) {
  document.querySelectorAll('.lib-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.lib-section').forEach(sec => {
    sec.style.display = (section === 'all' || sec.dataset.section === section) ? '' : 'none';
  });
}

// Library modal backdrop close
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('library-modal')?.addEventListener('click', function(e) {
    if (e.target === this && typeof closeLibraryModal === 'function') closeLibraryModal();
  });
});

// ── Chat helpers ──────────────────────────────────────────────────────────

export function wsSetInput(text) {
  const inp = document.getElementById('ws-chat-input');
  if (!inp) return;
  inp.value = text; inp.focus(); wsAutoResize(inp);
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
  _wsChatHistory = [];
  const msgs = document.getElementById('ws-messages');
  if (msgs) msgs.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-4);text-align:center;padding:24px;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <div style="font-size:12px;color:var(--text-4);">Ask a question to start the conversation</div>
    </div>`;
  if (_wsBookId && typeof _saveWsSession === 'function') _saveWsSession(_wsBookId, []);
  wsShowToast('🗑', 'Chat cleared', 'var(--border-md)');
}

export function wsAppendUser(text) {
  const msgs = document.getElementById('ws-messages');
  const d = document.createElement('div');
  d.className = 'msg msg-user';
  d.innerHTML = `<div class="bubble-user">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>`;
  msgs.appendChild(d); wsScrollBottom();
}

export function _wsAvatarSvg() {
  const id = 'av' + Math.random().toString(36).slice(2, 6);
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="13" height="13">
    <defs>
      <linearGradient id="${id}a" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#c8a84b"/>
        <stop offset="100%" stop-color="#a855f7"/>
      </linearGradient>
      <linearGradient id="${id}b" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#a855f7"/>
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
  const d = document.createElement('div');
  d.className = 'msg msg-ai'; d.id = 'ws-thinking-msg';
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
  msgs.appendChild(d); wsScrollBottom();
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
  const bookName = document.getElementById('ws-book-name')?.textContent || '';
  const msgId    = 'ws-msg-' + Date.now();

  let sourcesHtml = '';
  if (sources && sources.length > 0) {
    const items = sources.map(s => {
      const preview = (s.text || '').trim().slice(0, 55).replace(/&/g,'&amp;').replace(/</g,'&lt;');
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

  const followups    = (typeof _isFollowupsEnabled === 'function' && _isFollowupsEnabled()) ? _wsFollowups(answer, question) : [];
  const followupHtml = followups.length ? `
    <div class="followups" style="margin-top:10px;">
      <div class="followup-head">Follow-up questions</div>
      <div class="followup-list">
        ${followups.map(q => `
          <div class="followup-item" onclick="wsSetInput('${q.replace(/'/g, "\\'")}')">
            ${q.replace(/&/g,'&amp;').replace(/</g,'&lt;')}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
          </div>`).join('')}
      </div>
    </div>` : '';

  const autoFlashHtml = (typeof _isAutoFlashEnabled === 'function' && _isAutoFlashEnabled()) ? `
    <div style="margin-top:8px;padding:8px 10px;background:var(--violet-muted);border:1px solid var(--violet-border);border-radius:var(--r-md);display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <span style="font-size:11px;color:var(--text-2);">💡 Save this as a flashcard?</span>
      <button onclick="wsMakeFlashcard(this,'${msgId}',\`${(question||'').replace(/`/g,"'").replace(/\n/g,' ').slice(0,120)}\`)" style="font-size:11px;padding:4px 10px;border-radius:var(--r-pill);background:var(--violet-muted);border:1px solid var(--violet-border);color:var(--violet);cursor:pointer;font-family:var(--font-body);">Save flashcard</button>
    </div>` : '';

  const d = document.createElement('div');
  d.className = 'msg msg-ai'; d.id = msgId;
  d.innerHTML = `
    <div class="ai-row">
      <div class="ai-ava">${_wsAvatarSvg()}</div>
      <div class="ai-body">
        <div class="ai-text">${wsRender(answer)}</div>
        ${sourcesHtml}
        <div class="msg-acts" style="margin-top:10px;">
          <button class="msg-act" onclick="wsCopyMsg(this, '${msgId}')">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy
          </button>
          <button class="msg-act" onclick="wsMakeFlashcard(this, '${msgId}', \`${(question||'').replace(/`/g,"'").replace(/\n/g,' ').slice(0,120)}\`)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg> Make Flashcard
          </button>
          <button class="msg-act" onclick="_wsRegenerate('${msgId}', \`${(question||'').replace(/`/g,"'").replace(/\n/g,' ')}\`)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.67"/></svg> Regenerate
          </button>
        </div>
        ${followupHtml}
        ${autoFlashHtml}
      </div>
    </div>`;
  msgs.appendChild(d); wsScrollBottom();
}

export function wsAppendError(msg) {
  const msgs = document.getElementById('ws-messages');
  const d = document.createElement('div');
  d.className = 'msg msg-ai';
  d.innerHTML = `<div class="ai-row"><div class="ai-ava">${_wsAvatarSvg()}</div><div class="ai-body"><p class="ai-text" style="color:#f87171;">⚠ ${msg.replace(/</g,'&lt;')}</p></div></div>`;
  msgs.appendChild(d); wsScrollBottom();
}

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

export function _wsFollowups(answer, question) {
  const a = (answer || '').toLowerCase();
  const q = (question || '').toLowerCase();
  if (a.includes('entropy')    || q.includes('entropy'))    return ['What happens to entropy during an adiabatic process?', 'Derive the entropy change for an ideal gas expansion'];
  if (a.includes('equilibrium')|| q.includes('equilibrium'))return ['How does temperature affect the equilibrium constant?', "What is Le Chatelier's principle?"];
  if (a.includes('kinetic')    || q.includes('kinetic') || a.includes('rate')) return ['What factors affect reaction rate?', 'Explain the Arrhenius equation'];
  if (a.includes('bond')       || q.includes('bond')  || a.includes('orbital')) return ['What is hybridization and how does it affect molecular shape?', 'Compare ionic vs covalent bonding'];
  if (a.includes('thermodynam')|| q.includes('thermodynam')) return ['How are enthalpy and internal energy related?', 'What does the second law of thermodynamics state?'];
  return ['Can you give a worked example?', 'How does this relate to real-world applications?'];
}

export async function _wsRegenerate(msgId, question) {
  document.getElementById(msgId)?.remove();
  if (_wsChatHistory.length && _wsChatHistory[_wsChatHistory.length - 1].role === 'assistant') _wsChatHistory.pop();
  await _wsAsk(question);
}

export async function wsChatSend() {
  if (_wsTyping) return;
  const inp = document.getElementById('ws-chat-input');
  const question = inp.value.trim();
  if (!question) return;
  wsAppendUser(question);
  inp.value = ''; wsAutoResize(inp); inp.focus();
  _wsChatHistory.push({ role: 'user', content: question });

  // First message → create session in localStorage (guide §04)
  if (!_wsSessionId) {
    const session = createSession(question, 'workspace');
    if (session) {
      _wsSessionId = session.id;
      setActiveSessionId(session.id);
    }
    window.recentAdd?.(question, _wsBookId, 'workspace');
  }
  appendMessage(_wsSessionId, 'user', question);
  window._renderAllRecent?.();

  await _wsAsk(question);
}

export async function _wsAsk(question) {
  _wsTyping = true;
  document.getElementById('ws-chat-send').disabled = true;
  wsAppendThinking();
  try {
    const mode       = typeof _getStudyMode === 'function' ? _getStudyMode() : 'study';
    const complexity = mode === 'concise' ? 3 : mode === 'detailed' ? 8 : 5;
    const { answer, sources } = await askQuestion({
      question,
      bookId:     _wsBookId || 'atkins',
      mode,
      complexity,
      history:    _wsChatHistory.slice(-10),
    });
    wsRemoveThinking();
    wsAppendAI(answer, sources, question);
    _wsChatHistory.push({ role: 'assistant', content: answer });
    appendMessage(_wsSessionId, 'assistant', answer);
  } catch (e) {
    wsRemoveThinking();
    wsAppendError(e.message || 'Could not reach the server. Check your connection.');
    _wsChatHistory.pop();
  } finally {
    _wsTyping = false;
    document.getElementById('ws-chat-send').disabled = false;
  }
}

// ── Keyboard listener ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ws-chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); wsChatSend(); }
  });
  document.getElementById('ws-chat-input')?.addEventListener('input', function() { wsAutoResize(this); });
});

// ── Attachment system ─────────────────────────────────────────────────────

export let _wsAttachments   = [];
export let _homeAttachments = [];

export function _closeAllAttachMenus() {
  document.querySelectorAll('.attach-menu').forEach(m => m.classList.remove('open'));
}
document.addEventListener('click', e => {
  if (!e.target.closest('.chat-plus-wrap') && !e.target.closest('.ask-plus-wrap')) _closeAllAttachMenus();
});

export function _buildThumb(att, removeFn) {
  const wrap = document.createElement('div');
  wrap.className = 'attach-thumb';
  if (att.type === 'image') {
    const img = document.createElement('img');
    img.src = att.dataUrl; img.alt = att.name;
    wrap.appendChild(img);
  } else {
    const label = document.createElement('div');
    label.className = 'attach-thumb-pdf';
    label.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${att.name.slice(0,8)}</span>`;
    wrap.appendChild(label);
  }
  const rm = document.createElement('button');
  rm.className = 'attach-remove'; rm.innerHTML = '✕';
  rm.onclick = removeFn;
  wrap.appendChild(rm);
  return wrap;
}

export function _readFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function wsToggleAttachMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('ws-attach-menu');
  const isOpen = menu.classList.contains('open');
  _closeAllAttachMenus();
  if (!isOpen) menu.classList.add('open');
}
export function wsAttachTrigger(type) {
  _closeAllAttachMenus();
  document.getElementById(type === 'image' ? 'ws-attach-image' : 'ws-attach-pdf').click();
}
export async function wsHandleAttach(input, type) {
  const file = input.files[0]; if (!file) return;
  input.value = '';
  const dataUrl = await _readFile(file);
  _wsAttachments.push({ type, file, dataUrl, name: file.name });
  _wsRenderPreview();
}
export function _wsRenderPreview() {
  const strip = document.getElementById('ws-attach-preview');
  strip.innerHTML = '';
  strip.style.display = _wsAttachments.length ? 'flex' : 'none';
  _wsAttachments.forEach((att, i) => {
    strip.appendChild(_buildThumb(att, () => { _wsAttachments.splice(i, 1); _wsRenderPreview(); }));
  });
}

// Patch wsChatSend to include attachments
const _origWsChatSend = wsChatSend;
window.wsChatSend = async function() {
  if (_wsTyping) return;
  const inp = document.getElementById('ws-chat-input');
  const question = inp.value.trim();
  if (!question && !_wsAttachments.length) return;

  let bubbleHtml = question ? question.replace(/&/g,'&amp;').replace(/</g,'&lt;') : '';
  if (_wsAttachments.length) {
    bubbleHtml += _wsAttachments.map(a =>
      a.type === 'image'
        ? `<img src="${a.dataUrl}" style="max-width:180px;max-height:140px;border-radius:8px;display:block;margin-top:6px;">`
        : `<div style="display:inline-flex;align-items:center;gap:6px;background:var(--surface-3);border:1px solid var(--border-md);border-radius:8px;padding:6px 10px;font-size:12px;margin-top:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>${a.name}</div>`
    ).join('');
  }

  const msgs = document.getElementById('ws-messages');
  const d = document.createElement('div');
  d.className = 'msg msg-user';
  d.innerHTML = `<div class="bubble-user">${bubbleHtml}</div>`;
  msgs.appendChild(d); wsScrollBottom();

  let fullQuestion = question;
  if (_wsAttachments.length) {
    fullQuestion += `\n[Attached: ${_wsAttachments.map(a => `"${a.name}" (${a.type})`).join(', ')}]`;
  }

  inp.value = ''; wsAutoResize(inp); inp.focus();
  _wsChatHistory.push({ role: 'user', content: fullQuestion });
  _wsAttachments = []; _wsRenderPreview();
  await _wsAsk(fullQuestion);
};

export function homeToggleAttachMenu(e, slot) {
  e.stopPropagation();
  const id = slot === 'bottom' ? 'home-attach-menu-bottom' : 'home-attach-menu';
  const menu = document.getElementById(id);
  const isOpen = menu.classList.contains('open');
  _closeAllAttachMenus();
  if (!isOpen) menu.classList.add('open');
}
export function homeAttachTrigger(type, slot) {
  _closeAllAttachMenus();
  const id = type === 'image'
    ? `home-attach-image${slot === 'bottom' ? '-bottom' : ''}`
    : `home-attach-pdf${slot === 'bottom' ? '-bottom' : '-new'}`;
  document.getElementById(id)?.click();
}
export async function homeHandleAttach(input, type, slot) {
  const file = input.files[0]; if (!file) return;
  input.value = '';
  const dataUrl = await _readFile(file);
  _homeAttachments.push({ type, file, dataUrl, name: file.name });
  _homeRenderPreview();
  if (type === 'pdf') {
    const name = file.name.replace(/\.pdf$/i, '');
    window._uploadedPdfFile = file; window._uploadedPdfName = name;
    if (typeof homeSetInput === 'function') homeSetInput(`Summarize "${name}" for me`);
  }
}
export function _homeRenderPreview() {
  ['home-attach-preview', 'home-attach-preview-bottom'].forEach(id => {
    const strip = document.getElementById(id); if (!strip) return;
    strip.innerHTML = '';
    strip.style.display = _homeAttachments.length ? 'flex' : 'none';
    _homeAttachments.forEach((att, i) => {
      strip.appendChild(_buildThumb(att, () => { _homeAttachments.splice(i, 1); _homeRenderPreview(); }));
    });
  });
}

// ── Legacy global bridges ─────────────────────────────────────────────────
window.wsBookMeta          = wsBookMeta;
window.selectBook          = selectBook;
window.wsPrevPage          = wsPrevPage;
window.wsNextPage          = wsNextPage;
window.wsGoToPage          = wsGoToPage;
window.wsJumpToPage        = wsJumpToPage;
window.wsZoomIn            = wsZoomIn;
window.wsZoomOut           = wsZoomOut;
window.togglePdfOutline    = togglePdfOutline;
window.wsShowToast         = wsShowToast;
window.wsSetInput          = wsSetInput;
window.wsAutoResize        = wsAutoResize;
window.wsScrollBottom      = wsScrollBottom;
window.wsClearChat         = wsClearChat;
window.wsAppendUser        = wsAppendUser;
window.wsAppendThinking    = wsAppendThinking;
window.wsRemoveThinking    = wsRemoveThinking;
window.wsAppendAI          = wsAppendAI;
window.wsAppendError       = wsAppendError;
window.wsCopyMsg           = wsCopyMsg;
window.wsMakeFlashcard     = async function(btn, msgId, question) {
  // wsMakeFlashcard is defined in flashState.js (Task 17) — this is a forward-reference stub
  // that will be replaced when that module loads. The actual implementation references
  // _fcDeck/_fcIndex etc which live there.
  console.warn('[ws] wsMakeFlashcard called before flashState loaded');
};
window._wsRegenerate       = _wsRegenerate;
window.filterLibrary       = filterLibrary;
window.filterLibSection    = filterLibSection;
window.wsToggleAttachMenu  = wsToggleAttachMenu;
window.wsAttachTrigger     = wsAttachTrigger;
window.wsHandleAttach      = wsHandleAttach;
window.homeToggleAttachMenu= homeToggleAttachMenu;
window.homeAttachTrigger   = homeAttachTrigger;
window.homeHandleAttach    = homeHandleAttach;
window._wsRenderPage          = _wsRenderPage;
window._wsUpdateOutlineActive = _wsUpdateOutlineActive;
window._loadPdfJs             = _loadPdfJs;   // used by studyPlanState.js PDF extraction

// Live-binding bridges for mutable state read by non-module scripts (e.g. recentAdd in index.html)
Object.defineProperty(window, '_wsBookId', {
  get: () => _wsBookId,
  set: (v) => { _wsBookId = v; },
  configurable: true,
});
Object.defineProperty(window, '_wsChatHistory', {
  get: () => _wsChatHistory,
  set: (v) => { _wsChatHistory = v; },
  configurable: true,
});