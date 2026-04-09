
// @ts-nocheck
/**
 * src/state/workspace/books.js — Book loader + welcome message
 */

import { ws, wsBookMeta, ZOOM_MIN, ZOOM_MAX } from './state.js';
import { _wsUpdateBadge, _loadPdfJs, _wsRenderPage, wsFitWidth, _wsAttachResizeObserver } from './pdf.js';
import { _wsBuildOutline, _wsUpdateOutlineActive } from './outline.js';
import { API_BASE }    from '../../lib/api.js';
import { trackBookOpen, trackBookPage } from '../../lib/bookProgress.js';
import { isGuest, guestGate, recordUsage } from '../../lib/guestLimits.js';
import { ChunksDB } from '../../lib/chunksDb.js';
import { checkStorageQuota } from '../../utils/storageQuota.js';
import { lsGet, lsSet } from '../../utils/storage.js';
import { $el, hide, setText, setHtml } from '../domHelpers.js';
import { subscribeToChatRealtime, unsubscribeChatRealtime } from './chatRealtime.js';
import { subscribeToFlashcardRealtime } from '../flash/flashcardRealtime.js';
import { _wsRenderMessageFromBlocks, _wsBuildBlocks } from './chat.js';
import { createThinkingAccordion } from '../../components/ThinkingAccordion.js';

let _wsSaveScrollTm;
let _noteCardsListenerAttached = false;

// ── Per-page note cards ───────────────────────────────────────────────────

const _NOTES_KEY          = 'chunks-ai-notes-v2';
const _NOTE_PREVIEW_CHARS = 220;

function _wsRefreshNoteCards() {
  const cards = document.querySelectorAll('.ws-page-note-card');
  if (!cards.length) return;
  let notesMap;
  try {
    notesMap = new Map(JSON.parse(localStorage.getItem(_NOTES_KEY) || '[]'));
  } catch (_) { notesMap = new Map(); }

  cards.forEach(card => {
    const pageNum = parseInt(card.dataset.notePageNum, 10);
    const html = notesMap.get(pageNum) || '';
    let text = '';
    if (html) {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      text = (tmp.textContent || '').trim();
    }
    card.innerHTML = '';

    if (text) {
      card.classList.remove('wpnc-empty');
      const label = document.createElement('div');
      label.className = 'wpnc-label';
      label.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/></svg>';
      label.append(' Your note \u2014 Page ' + pageNum);
      card.appendChild(label);
      const content = document.createElement('div');
      content.className = 'wpnc-content';
      content.textContent = text.length > _NOTE_PREVIEW_CHARS ? text.slice(0, _NOTE_PREVIEW_CHARS) + '\u2026' : text;
      card.appendChild(content);
    } else {
      card.classList.add('wpnc-empty');
      const add = document.createElement('div');
      add.className = 'wpnc-add';
      add.textContent = '\u270F Add a note for page ' + pageNum + '\u2026';
      card.appendChild(add);
    }

    card.onclick = () => {
      const wsEl = document.getElementById('screen-workspace');
      if (wsEl && wsEl.classList.contains('ws-pdf-mode')) window.wsMobileView?.('chat');
      window.wsShowPanel?.('notes');
    };
  });
}

// ── Book loader ───────────────────────────────────────────────────────────

export async function selectBook(bookId) {
  if (typeof closeLibraryModal === 'function') closeLibraryModal();
  const meta = wsBookMeta[bookId];
  if (!meta) return;
  // Guest: allow if this is the same book as before; gate on any new book
  if (isGuest()) {
    const prevBook = localStorage.getItem('chunks_guest_book');
    if (prevBook !== bookId) {
      if (!guestGate('library')) return;
    }
  }

  // Leave user-doc mode
  ws.userDocId   = null;
  ws.userDocText = '';
  ws.bookId = bookId;
  ws.chatHistory = [];
  // Persist active book immediately so a refresh can restore it
  lsSet('chunks_active_ws_book', bookId);
  try { localStorage.setItem('chunks_default_book', bookId); } catch (_) {}
  try { localStorage.removeItem('chunks_active_ws_user_doc'); } catch (_) {}
  trackBookOpen(bookId);

  // Start realtime subscriptions for this document
  subscribeToChatRealtime(bookId);
  subscribeToFlashcardRealtime(bookId);
  setText($el('ws-chat-title'), meta.name);
  setText($el('ws-chat-subtitle'), meta.author || '');
  const _wsChatInp = $el('ws-chat-input');
  if (_wsChatInp) _wsChatInp.placeholder = 'Ask anything about this document\u2026';

  // Show close-book button
  const closeBtn = document.getElementById('ws-close-book-btn');
  if (closeBtn) closeBtn.style.display = 'inline-flex';

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

  // Expand the chat panel if it is collapsed
  const _chatPanel = document.getElementById('ws-chat-panel');
  if (_chatPanel && _chatPanel.classList.contains('ws-panel-collapsed')) {
    _chatPanel.classList.remove('ws-panel-collapsed');
  }

  // Update home screen document context bar
  const _homeDocLabel = document.getElementById('home-doc-label');
  if (_homeDocLabel) _homeDocLabel.textContent = meta.name;

  // Signal that a document is now active
  window._wsDocLoaded = true;

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
          await checkStorageQuota(pdfData.byteLength);   // warn before large cache write
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

    // Restore saved zoom if available, otherwise auto-fit to container width
    const _savedZoom = lsGet('chunks_ws_zoom_' + bookId);
    if (isFinite(_savedZoom) && _savedZoom >= ZOOM_MIN && _savedZoom <= ZOOM_MAX) {
      ws.scale = _savedZoom;
      setText($el('ws-zoom-badge'), Math.round(_savedZoom * 100) + '%');
    } else {
      try {
        const _fitPage  = await ws.pdfDoc.getPage(1);
        const _naturalW = _fitPage.getViewport({ scale: 1 }).width;
        const _availW   = ($el('ws-pdf-view')?.clientWidth || 0) - 40;
        if (_naturalW > 0 && _availW > 100) {
          ws.scale = Math.min(Math.max(_availW / _naturalW, ZOOM_MIN), ZOOM_MAX);
          setText($el('ws-zoom-badge'), Math.round(ws.scale * 100) + '%');
        }
      } catch (_) { /* keep default scale */ }
    }

    for (let i = 1; i <= ws.totalPages; i++) {
      const pageWrap = document.createElement('div');
      pageWrap.style.cssText = 'position:relative;box-shadow:0 4px 24px rgba(0,0,0,0.6);flex-shrink:0;';
      pageWrap.dataset.pageNum = i;
      const canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      pageWrap.appendChild(canvas);
      wrap.appendChild(pageWrap);
      ws.pageContainers.push(pageWrap);

      // Note card shown after each page in the scroll area
      const noteCard = document.createElement('div');
      noteCard.className = 'ws-page-note-card';
      noteCard.dataset.notePageNum = i;
      wrap.appendChild(noteCard);
    }

    _wsRefreshNoteCards();

    if (!_noteCardsListenerAttached) {
      _noteCardsListenerAttached = true;
      document.addEventListener('ws:notes-saved', _wsRefreshNoteCards);
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

    let _booksScrollRaf = 0;
    wrap.addEventListener('scroll', () => {
      if (_booksScrollRaf) return;
      _booksScrollRaf = requestAnimationFrame(() => {
        _booksScrollRaf = 0;
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
          clearTimeout(_wsSaveScrollTm);
          _wsSaveScrollTm = setTimeout(() => {
            ChunksDB?.ws?.savePosition?.(ws.bookId, { page: closest, zoom: ws.scale });
          }, 2000);
        }
      });
    }, { passive: true });

    hide($el('ws-pdf-loading'));
    hide($el('ws-default-content'));
    wrap.style.display = 'flex';

    // Restore saved page position (use requestAnimationFrame so layout is ready)
    const _savedPage = lsGet('chunks_ws_page_' + bookId);
    if (isFinite(_savedPage) && _savedPage > 1 && _savedPage <= ws.totalPages) {
      ws.currentPage = _savedPage;
      _wsUpdateBadge(_savedPage);
      const _target = ws.pageContainers[_savedPage - 1];
      if (_target) {
        requestAnimationFrame(() => { wrap.scrollTop = _target.offsetTop - 16; });
      }
    }

    // Disconnect any previous resize observer, then watch for container resizes
    _wsAttachResizeObserver();

    _wsShowWelcome(meta);
    if (isGuest()) {
      const prevBook = localStorage.getItem('chunks_guest_book');
      if (prevBook !== bookId) {
        localStorage.setItem('chunks_guest_book', bookId);
        recordUsage('library');
      }
    }
    await _wsBuildOutline(ws.pdfDoc, bookId);

    // Fetch fresh chat history for this book from Supabase (authoritative source).
    // If a prior conversation exists it replaces the welcome message so the user
    // immediately sees their history — without reading from localStorage.
    const { data: freshHistory } = await ChunksDB.chat.getSessionByBook(bookId);
    if (freshHistory?.length) {
      ws.chatHistory = freshHistory;
      _wsRenderHistory($el('ws-messages'), freshHistory);
    }

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

// ── History renderer ─────────────────────────────────────────────────────────
// Shared utility used by selectBook (document change / page load) and
// _doRestore (app.html — recent-item click) to build the chat DOM from a
// message array. Clears the container before rendering.

export function _wsRenderHistory(msgs, history) {
  if (!msgs || !history?.length) return;
  msgs.innerHTML = '';
  const bookName = $el('ws-book-name')?.textContent || '';
  history.forEach((msg, i) => {
    if (msg.role === 'user') {
      if (msg.imageDataUrl && /^data:image\/[a-zA-Z+]+;base64,/.test(msg.imageDataUrl)) {
        const imgEl = document.createElement('div');
        imgEl.className = 'msg msg-user';
        const imgSrc = msg.imageDataUrl;
        const imgWrap = document.createElement('div');
        imgWrap.className = 'bubble-user';
        const imgContainer = document.createElement('div');
        imgContainer.className = 'chat-img-wrap';
        imgContainer.setAttribute('onclick', 'openImgLightbox(this)');
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = 'attached image';
        imgContainer.appendChild(img);
        imgWrap.appendChild(imgContainer);
        imgEl.appendChild(imgWrap);
        msgs.appendChild(imgEl);
      }
      const text = (msg.content || '').replace(/\n\[Attached:[^\]]*\]/g, '').trim();
      if (text) {
        const el = document.createElement('div');
        el.className = 'msg msg-user';
        const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        el.innerHTML = `<div class="bubble-user">${escaped}</div>`;
        msgs.appendChild(el);
      }
    } else if (msg.role === 'assistant') {
      // Restore ThinkingAccordion if this response had thinking content
      if (msg.thinkContent) {
        const accordionWrap = document.createElement('div');
        accordionWrap.className = 'msg msg-ai';
        const container = document.createElement('div');
        container.style.cssText = 'width:100%;';
        accordionWrap.appendChild(container);
        createThinkingAccordion(container, {
          thinkingText: msg.thinkContent,
          elapsed: msg.thinkDuration || 0,
          isStreaming: false,
          noAnimation: true,
        });
        msgs.appendChild(accordionWrap);
      }
      if (msg.blocks?.length) {
        // Re-create the full UI (text + sources + action buttons) from structured blocks
        const msgId = 'ws-msg-hist-' + i + '-' + Date.now();
        const el = _wsRenderMessageFromBlocks(msgId, msg.blocks, bookName);
        el.dataset.histIdx = String(i);
        // Restore feedback active state if saved
        if (msg.feedback) {
          const thumbBtn = el.querySelector(`.msg-act--thumb[data-type="${msg.feedback}"]`);
          if (thumbBtn) thumbBtn.classList.add('active');
        }
        msgs.appendChild(el);
      } else {
        // Legacy messages without blocks — build minimal blocks so the same
        // component path is used and action buttons are always rendered.
        const prevUserMsg = history.slice(0, i).reverse().find(m => m.role === 'user');
        const legacyBlocks = _wsBuildBlocks(msg.content || '', [], prevUserMsg?.content || '', null);
        const msgId = 'ws-msg-hist-legacy-' + i;
        const el = _wsRenderMessageFromBlocks(msgId, legacyBlocks, bookName);
        el.dataset.histIdx = String(i);
        if (msg.feedback) {
          const thumbBtn = el.querySelector(`.msg-act--thumb[data-type="${msg.feedback}"]`);
          if (thumbBtn) thumbBtn.classList.add('active');
        }
        msgs.appendChild(el);
      }
    }
  });
  msgs.scrollTop = msgs.scrollHeight;
}

// ── Welcome message ───────────────────────────────────────────────────────

const _CHEVRON_SVG = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>`;

const _WELCOME_CARDS = [
  {
    label: 'Flashcards', desc: 'Generate from doc',
    color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.25)',
    onclick: 'wsGenerateFlashcardsInChat()',
    svg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 2v3M8 2v3"/></svg>',
  },
  {
    label: 'Quiz me', desc: 'Test your knowledge',
    color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.25)',
    onclick: "wsSetInput('Quiz me on this document');wsChatSend()",
    svg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>',
  },
  {
    label: 'Summarize', desc: 'Key points only',
    color: '#14b8a6', bg: 'rgba(20,184,166,0.15)', border: 'rgba(20,184,166,0.25)',
    onclick: "wsSetInput('Summarize the key points');wsChatSend()",
    svg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  },
  {
    label: 'Mind map', desc: 'Visual overview',
    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.25)',
    onclick: "wsSetInput('Create a mind map for this document');wsChatSend()",
    svg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 9V3M12 21v-6M9.8 14.2l-4.2 2.4M18.4 7.4l-4.2 2.4M9.8 9.8L5.6 7.4M18.4 16.6l-4.2-2.4"/></svg>',
  },
  {
    label: 'Explain it', desc: 'Simple breakdown',
    color: '#ec4899', bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.25)',
    onclick: "wsSetInput('Explain the main concepts in simple terms');wsChatSend()",
    svg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  },
  {
    label: 'Listen', desc: 'Audio summary',
    color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.25)',
    onclick: 'wsListenPdf()',
    svg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M7.76 7.76a6 6 0 0 0 0 8.49"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
  },
];

const _EXAM_CARD = {
  label: 'Exam prep', desc: 'What should I focus on first based on this document?',
  color: '#f43f5e', bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.25)',
  onclick: "wsSetInput('What should I focus on first based on this document?');wsChatSend()",
  svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
};

const _WELCOME_SUGGESTIONS = [
  'What are the main topics covered?',
  'What should I focus on for my exam?',
];

export function _wsWelcomeHtml(title, chapterName) {
  const cleanTitle = title.replace(/[\[\]]/g, '').trim();
  const chapterHtml = chapterName
    ? `<span class="ws-welcome-badge-chapter">&nbsp;· ${chapterName}</span>`
    : '';
  const cardHtml = _WELCOME_CARDS.map(c => `
    <div class="ws-action-card" onclick="${c.onclick}">
      <div class="ws-action-icon" style="background:${c.bg};color:${c.color};border-color:${c.border};">${c.svg}</div>
      <div>
        <div class="ws-action-name">${c.label}</div>
        <div class="ws-action-desc">${c.desc}</div>
      </div>
    </div>`).join('');
  const suggestionHtml = _WELCOME_SUGGESTIONS.map(q => `
    <div class="ws-suggestion-row" data-q="${q.replace(/"/g, '&quot;')}" onclick="wsSetInput(this.dataset.q);wsChatSend()">
      ${q}
      ${_CHEVRON_SVG}
    </div>`).join('');
  return `
    <div class="ws-welcome" id="ws-welcome-state">
      <div class="ws-welcome-badge">
        <div class="ws-welcome-badge-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <span class="ws-welcome-badge-title">${cleanTitle}</span>
        ${chapterHtml}
      </div>
      <div class="ws-welcome-heading">What do you want to do?</div>
      <div class="ws-welcome-sub">I've read the full document — pick an action or ask anything.</div>
      <div class="ws-action-grid">
        ${cardHtml}
        <div class="ws-action-card ws-action-card--wide" onclick="${_EXAM_CARD.onclick}">
          <div class="ws-action-icon" style="background:${_EXAM_CARD.bg};color:${_EXAM_CARD.color};border-color:${_EXAM_CARD.border};">${_EXAM_CARD.svg}</div>
          <div class="ws-action-text">
            <div class="ws-action-name">${_EXAM_CARD.label}</div>
            <div class="ws-action-desc">${_EXAM_CARD.desc}</div>
          </div>
          <div class="ws-action-chevron">${_CHEVRON_SVG}</div>
        </div>
      </div>
      <div class="ws-suggestions-label">Or ask directly</div>
      ${suggestionHtml}
    </div>`;
}

export function _wsShowWelcome(meta) {
  const msgs = $el('ws-messages');
  if (!msgs) return;
  setHtml(msgs, _wsWelcomeHtml(meta.name, null));
}

// ── Close / unload current book ───────────────────────────────────────────────

export function closeBook() {
  // Clear state
  ws.bookId      = null;
  ws.pdfDoc      = null;
  ws.chatHistory = [];
  ws.userDocId   = null;
  ws.userDocText = '';

  // Clear persisted active book
  try { localStorage.removeItem('chunks_active_ws_book'); } catch (_) {}
  try { localStorage.removeItem('chunks_default_book'); } catch (_) {}
  try { localStorage.removeItem('chunks_active_ws_user_doc'); } catch (_) {}

  // Reset header labels
  setText($el('ws-book-name'), 'No book loaded');
  setText($el('ws-book-author'), '');
  setText($el('ws-chat-title'), 'General AI');
  setText($el('ws-chat-subtitle'), '');
  setText($el('mwt-book-name'), 'Study Workspace');
  setText($el('mwt-book-sub'), 'Select a book to begin');
  const mwtBadge = $el('mwt-badge');
  if (mwtBadge) mwtBadge.style.display = 'none';

  // Reset chat input placeholder to general mode
  const _wsChatInp = $el('ws-chat-input');
  if (_wsChatInp) _wsChatInp.placeholder = 'Ask me anything\u2026';

  // Hide close-book button
  const closeBtn = document.getElementById('ws-close-book-btn');
  if (closeBtn) closeBtn.style.display = 'none';

  // Hide PDF views, show default content
  const canvasWrap     = $el('ws-pdf-canvas-wrap');
  const loadingState   = $el('ws-pdf-loading');
  const defaultContent = $el('ws-default-content');
  if (canvasWrap)      { canvasWrap.style.display = 'none'; canvasWrap.innerHTML = ''; }
  if (loadingState)    loadingState.style.display = 'none';
  if (defaultContent)  defaultContent.style.display = 'flex';

  // Clear chat panel
  const msgs = $el('ws-messages');
  if (msgs) setHtml(msgs, '');

  // Clear doc-loaded flag and reset home screen context bar
  window._wsDocLoaded = false;
  const _homeDocLabel = document.getElementById('home-doc-label');
  if (_homeDocLabel) _homeDocLabel.textContent = 'No document loaded';
}
