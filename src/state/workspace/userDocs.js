// @ts-nocheck
/**
 * src/state/workspace/userDocs.js — User document handling
 */

import { ws, ZOOM_MIN, ZOOM_MAX } from './state.js';
import { _wsUpdateBadge, _loadPdfJs, _wsRenderPage, wsFitWidth, _wsAttachResizeObserver } from './pdf.js';
import { _wsBuildOutline } from './outline.js';
import { wsShowToast, wsSetInput } from './chat.js';
import { _wsWelcomeHtml } from './books.js';
import { subscribeToChatRealtime } from './chatRealtime.js';
import { subscribeToFlashcardRealtime } from '../flash/flashcardRealtime.js';
import { getDocBlob, getDocMeta, deleteDoc } from '../../lib/userDocDb.js';
import { lsGet, lsSet } from '../../utils/storage.js';
import { $el, hide, setText, setHtml } from '../domHelpers.js';

// ── User document loader ─────────────────────────────────────────────────
// Mirrors selectBook() but loads from IndexedDB instead of R2.
// Sets ws.userDocId and ws.userDocText so _wsAsk sends doc_context.

let _udSavePosTm;
const _UD_PAGE_KEY = 'chunks_ws_page___user_doc__';
// Sentinel bookId used when a user-uploaded doc is active — prevents textbook index lookups
export const WS_USER_DOC_SENTINEL = '__user_doc__';

export async function selectUserDoc(docId) {
  if (typeof closeLibraryModal === 'function') closeLibraryModal();

  const { data: meta, error: metaErr } = await getDocMeta(docId);
  if (!meta || metaErr) {
    wsShowToast('⚠', 'Could not load document', 'var(--red)');
    return;
  }

  // Switch workspace into user-doc mode
  ws.userDocId   = docId;
  ws.userDocText = meta.extractedText || '';
  ws.bookId      = WS_USER_DOC_SENTINEL;
  ws.chatHistory = [];
  // Persist active user doc so a refresh can restore it
  lsSet('chunks_active_ws_book', WS_USER_DOC_SENTINEL);
  lsSet('chunks_active_ws_user_doc', docId);
  lsSet('chunks_active_ws_user_doc_name', meta.name);

  // Switch from chat-only layout to split PDF+chat layout
  document.getElementById('screen-workspace')?.classList.remove('ws-chat-only');

  // Start realtime subscriptions for this user document
  subscribeToChatRealtime(docId);
  subscribeToFlashcardRealtime(docId);

  setText($el('ws-chat-title'), meta.name.replace(/\.[^.]+$/, ''));
  setText($el('ws-chat-subtitle'), meta.pageCount ? `${meta.pageCount} pages · Your upload` : 'Your upload');
  const _wsChatInp = document.getElementById('ws-chat-input');
  if (_wsChatInp) _wsChatInp.placeholder = 'Ask anything about this document\u2026';

  // Show loading state in chat
  const msgs = $el('ws-messages');
  if (msgs) {
    setHtml(msgs, `
      <div id="ws-download-banner" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:18px;text-align:center;padding:40px;">
        <div style="width:56px;height:56px;border-radius:16px;background:var(--violet-muted);border:1px solid var(--violet-border);display:flex;align-items:center;justify-content:center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div>
          <div style="font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--text-1);margin-bottom:5px;">Opening document…</div>
          <div style="font-size:12px;color:var(--text-3);line-height:1.6;max-width:220px;">Loading <strong style="color:var(--text-2);">${meta.name}</strong></div>
        </div>
      </div>`);
  }

  if (typeof showScreen === 'function') showScreen('workspace');

  setText($el('ws-book-name'), meta.name.replace(/\.[^.]+$/, ''));
  setText($el('ws-book-author'), `${meta.pageCount} pages · Uploaded by you`);

  setText($el('mwt-book-name'), meta.name.replace(/\.[^.]+$/, ''));
  setText($el('mwt-book-sub'), 'Your document');

  hide($el('ws-default-content'));
  hide($el('ws-pdf-canvas-wrap'));
  $el('ws-pdf-loading').style.display = 'flex';
  setText($el('ws-loading-text'), 'Opening ' + meta.name + '…');
  setText($el('ws-loading-progress'), 'Reading from storage…');

  const isPpt = meta.name.match(/\.(pptx?|ppt|ytx)$/i);

  try {
    if (isPpt) {
      // PPT / YouTube transcript: render as slide text cards (no PDF.js needed)
      await _wsRenderPptSlides(meta);
    } else {
      // PDF: load bytes from IndexedDB → PDF.js
      const { data: buf, error: blobErr } = await getDocBlob(docId);
      if (!buf || blobErr) throw new Error(blobErr || 'Blob not found');

      const pdfjsLib = await _loadPdfJs();
      const loadingTask = pdfjsLib.getDocument({ data: buf });
      ws.pdfDoc      = await loadingTask.promise;
      ws.totalPages  = ws.pdfDoc.numPages;
      ws.currentPage = 1;
      ws.pageContainers = [];

      setText($el('ws-loading-progress'), `${ws.totalPages} pages — rendering…`);
      _wsUpdateBadge(1);

      const wrap = $el('ws-pdf-canvas-wrap');
      wrap.innerHTML = '';

      // Auto-fit scale
      try {
        const _fitPage  = await ws.pdfDoc.getPage(1);
        const _naturalW = _fitPage.getViewport({ scale: 1 }).width;
        const _availW   = ($el('ws-pdf-view')?.clientWidth || 0) - 40;
        if (_naturalW > 0 && _availW > 100) {
          ws.scale = Math.min(Math.max(_availW / _naturalW, ZOOM_MIN), ZOOM_MAX);
          setText($el('ws-zoom-badge'), Math.round(ws.scale * 100) + '%');
        }
      } catch (_) {}

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

      let _udScrollRaf = 0;
      wrap.addEventListener('scroll', () => {
        if (_udScrollRaf) return;
        _udScrollRaf = requestAnimationFrame(() => {
          _udScrollRaf = 0;
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
            // Persist page position for restore on refresh
            clearTimeout(_udSavePosTm);
            _udSavePosTm = setTimeout(() => { lsSet(_UD_PAGE_KEY, closest); }, 1500);
          }
        });
      }, { passive: true });

      hide($el('ws-pdf-loading'));
      hide($el('ws-default-content'));
      wrap.style.display = 'flex';

      // Restore saved page position
      const _savedPage = lsGet(_UD_PAGE_KEY);
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
    }

    // Welcome message for user docs
    _wsShowUserDocWelcome(meta);

    // Build outline from PDF (page list if no embedded outline)
    if (ws.pdfDoc) {
      await _wsBuildOutline(ws.pdfDoc, '__user_doc__');
    }

  } catch (err) {
    console.error('[selectUserDoc] error:', err);
    hide($el('ws-pdf-loading'));
    $el('ws-default-content').style.display = 'flex';
    wsShowToast('⚠', 'Could not open document: ' + err.message, 'var(--red)');
  }
}

// Render a PPT as styled text slide cards (no PDF.js)
async function _wsRenderPptSlides(meta) {
  const wrap = $el('ws-pdf-canvas-wrap');
  wrap.innerHTML = '';

  let slides = [];
  let videoId = null;
  try {
    const parsed = JSON.parse(meta.extractedText || '[]');
    if (Array.isArray(parsed)) {
      // Legacy format: plain array of slides (PPT or old .ytx)
      slides = parsed;
    } else if (parsed && Array.isArray(parsed.slides)) {
      // New .ytx format: { video_id, slides }
      slides = parsed.slides;
      videoId = parsed.video_id || null;
    }
  } catch (_) {}
  if (!Array.isArray(slides) || !slides.length) {
    // Fall back: show raw text
    slides = [{ slide_number: 1, title: meta.name, content: [meta.extractedText || 'No content'], notes: '' }];
  }

  // ── YouTube player embed ────────────────────────────────────────────────
  // Validate video ID: YouTube IDs are exactly 11 alphanumeric/-/_ chars
  const validVideoId = videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : null;
  if (validVideoId) {
    const playerWrap = document.createElement('div');
    playerWrap.id = 'yt-player-wrap';
    playerWrap.style.cssText = [
      'width:100%;max-width:760px;flex-shrink:0;',
      'background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-lg);',
      'overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.4);',
    ].join('');
    // 16:9 responsive container using youtube-nocookie for privacy
    const iframe = document.createElement('iframe');
    iframe.id = 'yt-iframe';
    iframe.src = `https://www.youtube-nocookie.com/embed/${validVideoId}?rel=0&modestbranding=1&enablejsapi=1`;
    iframe.title = 'YouTube video player';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.loading = 'lazy';
    iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;';
    const ratio = document.createElement('div');
    ratio.style.cssText = 'position:relative;padding-bottom:56.25%;height:0;overflow:hidden;';
    ratio.appendChild(iframe);
    playerWrap.appendChild(ratio);
    wrap.appendChild(playerWrap);
  }

  ws.totalPages  = slides.length;
  ws.currentPage = 1;
  ws.pageContainers = [];
  _wsUpdateBadge(1);

  slides.forEach((slide, idx) => {
    const card = document.createElement('div');
    card.dataset.pageNum = idx + 1;
    card.id = `ws-slide-card-${idx + 1}`;
    card.style.cssText = 'width:100%;max-width:760px;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-lg);padding:28px 32px;box-shadow:0 4px 24px rgba(0,0,0,0.4);flex-shrink:0;';
    const num = slide.slide_number ?? (idx + 1);
    const title = slide.title || `Slide ${num}`;
    const body = (slide.content || []).join('\n\n');
    const notes = slide.notes ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-xs);font-size:11px;color:var(--text-4);font-style:italic;">${slide.notes}</div>` : '';
    // Wrap each word in a span for TTS word-level highlighting
    const bodyHtml = _wrapWordsInSpans(body);
    card.innerHTML = `
      <div style="font-size:10px;font-family:var(--font-mono);color:var(--text-4);margin-bottom:10px;letter-spacing:0.08em;">SLIDE ${num}</div>
      <div style="font-family:var(--font-head);font-size:18px;font-weight:700;color:var(--text-1);margin-bottom:14px;line-height:1.3;">${title}</div>
      <div class="ws-slide-body" style="font-size:13px;color:var(--text-2);line-height:1.7;white-space:pre-wrap;">${bodyHtml}</div>
      ${notes}`;
    wrap.appendChild(card);
    ws.pageContainers.push(card);
  });

  let _udSlideScrollRaf = 0;
  wrap.addEventListener('scroll', () => {
    if (_udSlideScrollRaf) return;
    _udSlideScrollRaf = requestAnimationFrame(() => {
      _udSlideScrollRaf = 0;
      const scrollMid = wrap.scrollTop + wrap.clientHeight / 2;
      let closest = 1;
      for (let i = 0; i < ws.pageContainers.length; i++) {
        if (ws.pageContainers[i].offsetTop <= scrollMid) closest = i + 1;
        else break;
      }
      if (closest !== ws.currentPage) {
        ws.currentPage = closest;
        _wsUpdateBadge(closest);
        // Persist slide position for restore on refresh
        clearTimeout(_udSavePosTm);
        _udSavePosTm = setTimeout(() => { lsSet(_UD_PAGE_KEY, closest); }, 1500);
      }
    });
  }, { passive: true });

  hide($el('ws-pdf-loading'));
  hide($el('ws-default-content'));
  wrap.style.display = 'flex';

  // Restore saved slide position
  const _savedSlide = lsGet(_UD_PAGE_KEY);
  if (isFinite(_savedSlide) && _savedSlide > 1 && _savedSlide <= ws.pageContainers.length) {
    ws.currentPage = _savedSlide;
    _wsUpdateBadge(_savedSlide);
    const _slideTarget = ws.pageContainers[_savedSlide - 1];
    if (_slideTarget) {
      requestAnimationFrame(() => { wrap.scrollTop = _slideTarget.offsetTop - 16; });
    }
  }
}

/**
 * Wrap every whitespace-separated word in a <span class="tts-word"> for
 * TTS word-level highlighting. Non-word tokens (newlines, whitespace) are
 * passed through verbatim. Word content is HTML-escaped.
 */
function _wrapWordsInSpans(text) {
  return text.replace(/[^\s]+/g, (word) => {
    const escaped = word
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<span class="tts-word">${escaped}</span>`;
  });
}


function _wsShowUserDocWelcome(meta) {
  const msgs = $el('ws-messages');
  if (!msgs) return;
  const name = meta.name.replace(/\.[^.]+$/, '');
  setHtml(msgs, _wsWelcomeHtml(name, null));
}
