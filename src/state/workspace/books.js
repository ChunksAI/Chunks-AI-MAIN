/**
 * src/state/workspace/books.js — Book loader + welcome message
 */

import { ws, wsBookMeta, ZOOM_MIN, ZOOM_MAX } from './state.js';
import { _wsUpdateBadge, _loadPdfJs, _wsRenderPage } from './pdf.js';
import { _wsBuildOutline, _wsUpdateOutlineActive } from './outline.js';
import { API_BASE }    from '../../lib/api.js';
import { trackBookOpen, trackBookPage } from '../../lib/bookProgress.js';
import { $el, hide, setText, setHtml } from '../domHelpers.js';

// ── Book loader ───────────────────────────────────────────────────────────

export async function selectBook(bookId) {
  if (typeof closeLibraryModal === 'function') closeLibraryModal();
  const meta = wsBookMeta[bookId];
  if (!meta) return;
  // Guest: allow if this is the first book OR the same book as before
  if (typeof window.isGuestMode === 'function' && window.isGuestMode()) {
    const prevBook = localStorage.getItem('chunks_guest_book');
    if (prevBook && prevBook !== bookId) {
      // Different book — hits the limit
      window.showGuestLoginWall?.('library');
      return;
    }
    if (!prevBook) localStorage.setItem('chunks_guest_book', bookId);
  }

  // Leave user-doc mode
  ws.userDocId   = null;
  ws.userDocText = '';
  ws.bookId = bookId;
  ws.chatHistory = [];
  trackBookOpen(bookId);
  const short  = meta.name.split(' ').slice(0, 2).join(' ');
  setHtml($el('ws-context-tag'), `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg> ${short}`);
  setText($el('ws-chat-title'), meta.name);

  const msgs = $el('ws-messages');
  if (msgs) {
    setHtml(msgs, `
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
      </div>`);
  }

  if (typeof showScreen === 'function') showScreen('workspace');

  setText($el('ws-book-name'), meta.name);
  setText($el('ws-book-author'), meta.author);

  setText($el('mwt-book-name'), meta.name);
  setText($el('mwt-book-sub'), meta.author || '');
  const mwtBadge    = $el('mwt-badge');
  const mwtBadgeTxt = $el('mwt-badge-text');
  if (mwtBadge && mwtBadgeTxt) {
    setText(mwtBadgeTxt, 'Open');
    mwtBadge.style.display = 'flex';
  }

  const coverWrap = $el('ws-outline-cover');
  const coverImg  = $el('ws-outline-cover-img');
  if (coverWrap && coverImg) {
    // Cover images not deployed — hide the img element silently
    hide(coverImg);
    coverWrap.style.display = 'block';
  }

  hide($el('ws-default-content'));
  hide($el('ws-pdf-canvas-wrap'));
  $el('ws-pdf-loading').style.display = 'flex';
  setText($el('ws-loading-text'), 'Loading ' + meta.name + '…');
  setText($el('ws-loading-progress'), 'Fetching from server…');

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
          const bar = $el('ws-chat-progress-bar');
          const txt = $el('ws-chat-progress-text');
          if (bar) bar.style.width = '100%';
          if (txt) setText(txt, 'Loaded from cache ⚡');
          setText($el('ws-loading-progress'), 'From cache — rendering…');
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
          setText($el('ws-loading-progress'), `${pct}% — ${mb} MB`);
          const bar = $el('ws-chat-progress-bar');
          const txt = $el('ws-chat-progress-text');
          if (bar) bar.style.width = pct + '%';
          if (txt) setText(txt, `${pct}% — ${mb} MB`);
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
    ws.pdfDoc      = await loadingTask.promise;
    ws.totalPages  = ws.pdfDoc.numPages;
    ws.currentPage = 1;
    ws.pageContainers = [];

    setText($el('ws-loading-progress'), `${ws.totalPages} pages — rendering…`);
    _wsUpdateBadge(1);

    const wrap = $el('ws-pdf-canvas-wrap');
    wrap.innerHTML = '';

    try {
      const _fitPage  = await ws.pdfDoc.getPage(1);
      const _naturalW = _fitPage.getViewport({ scale: 1 }).width;
      const _availW   = wrap.clientWidth - 40;
      if (_naturalW > 0 && _availW > 100) {
        ws.scale = Math.min(Math.max(_availW / _naturalW, ZOOM_MIN), ZOOM_MAX);
      }
    } catch (_) { /* keep default scale */ }

    for (let i = 1; i <= ws.totalPages; i++) {
      const pageWrap = document.createElement('div');
      pageWrap.style.cssText = 'position:relative;box-shadow:0 4px 24px rgba(0,0,0,0.6);flex-shrink:0;';
      pageWrap.dataset.pageNum = i;
      const canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      pageWrap.appendChild(canvas);
      wrap.appendChild(pageWrap);
      ws.pageContainers.push(pageWrap);
    }

    for (let i = 0; i < Math.min(2, ws.pageContainers.length); i++) {
      await _wsRenderPage(i + 1, ws.pageContainers[i]);
    }

    ws.pageContainers.forEach(c => {
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
    ws.pageContainers.slice(2).forEach(c => observer.observe(c));

    wrap.addEventListener('scroll', () => {
      const scrollMid = wrap.scrollTop + wrap.clientHeight / 2;
      let closest = 1;
      for (let i = 0; i < ws.pageContainers.length; i++) {
        const c = ws.pageContainers[i];
        if (c.offsetTop <= scrollMid) closest = i + 1;
        else break;
      }
      if (closest !== ws.currentPage) {
        ws.currentPage = closest;
        _wsUpdateBadge(closest);
        _wsUpdateOutlineActive(closest);
        // Phase 3: debounced sync on scroll-based page change
        clearTimeout(window._wsSaveScrollTm);
        window._wsSaveScrollTm = setTimeout(() => {
          window.ChunksDB?.ws?.savePosition?.(ws.bookId, { page: closest, zoom: ws.scale });
        }, 2000);
      }
    });

    hide($el('ws-pdf-loading'));
    hide($el('ws-default-content'));
    wrap.style.display = 'flex';

    _wsShowWelcome(meta);
    await _wsBuildOutline(ws.pdfDoc, bookId);

  } catch (err) {
    console.error('PDF load error:', err);
    hide($el('ws-pdf-loading'));
    $el('ws-default-content').style.display = 'flex';
    const msgs = $el('ws-messages');
    if (msgs) setHtml(msgs, `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;text-align:center;padding:40px;">
        <div style="font-size:13px;color:var(--red);">⚠ Could not load this textbook. The server may be unavailable.</div>
        <button onclick="selectBook('${bookId}')" style="padding:7px 18px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-1);font-size:12px;font-family:var(--font-body);cursor:pointer;">Retry</button>
      </div>`);
  }
}

// ── Welcome message ───────────────────────────────────────────────────────

export function _wsShowWelcome(meta) {
  const msgs = $el('ws-messages');
  if (!msgs) return;
  const suggestions = {
    atkins:   ['Explain entropy and the second law', 'What is Gibbs free energy?', 'Derive the Clausius inequality', 'Compare enthalpy and internal energy'],
    zumdahl:  ["Explain Le Chatelier's principle", 'What is a limiting reagent?', 'How do ionic bonds form?', 'Explain gas laws'],
    klein:    ['What are SN1 vs SN2 reactions?', 'Explain stereoisomerism', 'How does aromaticity work?', "What is Markovnikov's rule?"],
    harris:   ['What is a titration?', 'Explain standard deviation in measurements', 'What is activity coefficient?', 'How does EDTA work?'],
    netter:   ['Describe the brachial plexus', 'What bones make up the shoulder?', 'Explain the femoral triangle', 'What is the carpal tunnel?'],
    anaphy2e: ['Explain the sliding filament theory', 'What is a sarcomere?', 'How does the renal system work?', 'Describe the cardiac cycle'],
  };
  const chips = (suggestions[ws.bookId] || ['Summarize chapter 1', 'What are the key topics?', 'Give me an overview', 'Start a quiz']).slice(0, 3);
  setHtml(msgs, `
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
    </div>`);
}
