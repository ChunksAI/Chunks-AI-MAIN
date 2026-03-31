// @ts-nocheck
/**
 * src/state/workspace/pdf.js — PDF badge, page nav, zoom, PDF.js loader, page rendering
 */

import { ws, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX } from './state.js';
import { $el, $qs, setText } from '../domHelpers.js';
import { ChunksDB } from '../../lib/chunksDb.js';

let _wsSavePosTm, _wsSaveZoomTm;

// ── PDF badge ─────────────────────────────────────────────────────────────

export function _wsUpdateBadge(page) {
  setText($el('ws-page-badge'), `${page} / ${ws.totalPages}`);
  setText($el('mpn-page-label'), `${page} / ${ws.totalPages}`);
  setText($el('ws-chat-page-label'), `Page ${page} / ${ws.totalPages}`);
  // Update progress bar fill
  const fill = $el('ws-page-progress');
  if (fill && ws.totalPages > 1) {
    fill.style.width = `${Math.round(((page - 1) / (ws.totalPages - 1)) * 100)}%`;
  }
}

// ── Page navigation ───────────────────────────────────────────────────────

export function wsPrevPage() {
  if (!ws.pdfDoc || ws.currentPage <= 1) return;
  wsGoToPage(ws.currentPage - 1);
}
export function wsNextPage() {
  if (!ws.pdfDoc || ws.currentPage >= ws.totalPages) return;
  wsGoToPage(ws.currentPage + 1);
}
export function wsGoToPage(n) {
  n = Math.max(1, Math.min(n, ws.totalPages));
  ws.currentPage = n;
  _wsUpdateBadge(n);
  const wrap   = $el('ws-pdf-canvas-wrap');
  const target = ws.pageContainers[n - 1];
  if (target && wrap) wrap.scrollTop = target.offsetTop - 16;
  // Phase 3: debounced position sync (avoids per-scroll-pixel writes)
  clearTimeout(_wsSavePosTm);
  _wsSavePosTm = setTimeout(() => {
    ChunksDB?.ws?.savePosition?.(ws.bookId, { page: n, zoom: ws.scale });
  }, 1200);
}
export function wsJumpToPage() {
  const n = parseInt(prompt(`Go to page (1 – ${ws.totalPages}):`, ws.currentPage));
  if (!isNaN(n)) wsGoToPage(n);
}

// ── Zoom ─────────────────────────────────────────────────────────────────

export async function wsZoomIn()  { await _wsRescale(ws.scale + ZOOM_STEP); }
export async function wsZoomOut() { await _wsRescale(ws.scale - ZOOM_STEP); }

/** Re-fit the PDF to the current container width (fit-to-width). */
export async function wsFitWidth() {
  if (!ws.pdfDoc) return;
  try {
    const view = $el('ws-pdf-view');
    if (!view) return;
    const availW = view.clientWidth - 40;
    if (availW <= 100) return;
    const page = await ws.pdfDoc.getPage(1);
    const naturalW = page.getViewport({ scale: 1 }).width;
    if (naturalW <= 0) return;
    const newScale = Math.min(Math.max(availW / naturalW, ZOOM_MIN), ZOOM_MAX);
    await _wsRescale(newScale);
  } catch (_) {}
}

/**
 * Attach a ResizeObserver to `ws-pdf-view` that re-fits the PDF width
 * whenever the container changes size (e.g. the drag-splitter is moved).
 * Disconnects any previously attached observer first.
 */
export function _wsAttachResizeObserver() {
  ws.resizeObserver?.disconnect();
  const viewEl = $el('ws-pdf-view');
  if (!viewEl) return;
  ws.resizeObserver = new ResizeObserver(() => {
    if (ws.resizeRaf) cancelAnimationFrame(ws.resizeRaf);
    ws.resizeRaf = requestAnimationFrame(() => { ws.resizeRaf = 0; wsFitWidth(); });
  });
  ws.resizeObserver.observe(viewEl);
}

export async function _wsRescale(newScale) {
  if (!ws.pdfDoc) return;
  newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newScale));
  if (Math.abs(newScale - ws.scale) < 0.01) return;
  ws.scale = newScale;
  // Update zoom badge (desktop + mobile)
  setText($el('ws-zoom-badge'), Math.round(newScale * 100) + '%');
  setText($el('mpn-zoom-label'), Math.round(newScale * 100) + '%');
  for (let i = 0; i < ws.pageContainers.length; i++) {
    const c = ws.pageContainers[i];
    if (!c.dataset.rendered) continue;
    c.dataset.rendered = '';
    await _wsRenderPage(i + 1, c);
  }
  // Phase 3: sync zoom change to Supabase
  clearTimeout(_wsSaveZoomTm);
  _wsSaveZoomTm = setTimeout(() => {
    ChunksDB?.ws?.savePosition?.(ws.bookId, { zoom: newScale, page: ws.currentPage });
  }, 1200);
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
    const page     = await ws.pdfDoc.getPage(pageNum);
    const dpr      = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: ws.scale * dpr });
    const canvas   = $qs('canvas', container);
    // Physical pixel size (high-res)
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    // CSS display size (logical pixels — what the user sees)
    canvas.style.width  = (viewport.width  / dpr) + 'px';
    canvas.style.height = (viewport.height / dpr) + 'px';
    container.style.width  = (viewport.width  / dpr) + 'px';
    container.style.height = (viewport.height / dpr) + 'px';

    // Canvas must NOT capture pointer events — text layer sits on top and needs them
    canvas.style.pointerEvents = 'none';

    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    // ── Text layer — transparent selectable text over the canvas ──────────
    // PDF.js 3.x requires --scale-factor to equal viewport.scale.
    // The canvas viewport includes dpr, but the text layer works in CSS
    // pixels, so build a separate CSS-pixel viewport for it.
    const textViewport = page.getViewport({ scale: ws.scale });
    let textDiv = $qs('.ws-text-layer', container);
    if (textDiv) textDiv.remove();
    textDiv = document.createElement('div');
    textDiv.className = 'ws-text-layer';
    textDiv.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      `width:${textViewport.width}px`,
      `height:${textViewport.height}px`,
      'overflow:hidden',
      'line-height:1',
      'pointer-events:auto',
      'user-select:text',
      '-webkit-user-select:text',
      `--scale-factor:${textViewport.scale}`,
    ].join(';');
    container.appendChild(textDiv);

    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) return;

    try {
      const textStream = page.streamTextContent({ includeMarkedContent: false });
      const textDivs   = [];
      const task = pdfjsLib.renderTextLayer({
        textContentSource: textStream,
        container:         textDiv,
        viewport:          textViewport,
        textDivs,
      });
      await task.promise;

      // PDF.js positions each span — just make them transparent + selectable
      textDivs.forEach(el => {
        el.style.color         = 'transparent';
        el.style.cursor        = 'text';
        el.style.pointerEvents = 'auto';
      });
    } catch (layerErr) {
      console.warn('[ws] renderTextLayer failed, manual fallback:', layerErr.message);
      try {
        const textContent = await page.getTextContent();
        _wsManualTextLayer(textDiv, textContent, textViewport);
      } catch (_) { /* text selection unavailable for this page */ }
    }
  } catch (e) { console.warn('Page render error', pageNum, e); }
}

// Fallback: manually position text spans when PDF.js renderTextLayer is unavailable
function _wsManualTextLayer(container, textContent, viewport) {
  const { width: vw, height: vh } = viewport;
  textContent.items.forEach(item => {
    if (!item.str || !item.transform) return;
    const [a, b, c, d, e, f] = item.transform;
    const span = document.createElement('span');
    span.textContent = item.str;
    // Convert PDF transform to CSS — PDF coords have y flipped
    const scaleX = Math.sqrt(a * a + b * b);
    const scaleY = Math.sqrt(c * c + d * d);
    const angle  = Math.atan2(b, a);
    const tx = e * (vw / viewport.viewBox[2]);
    const ty = (viewport.viewBox[3] - f) * (vh / viewport.viewBox[3]);
    span.style.cssText = [
      `position:absolute`,
      `left:${tx}px`,
      `top:${ty}px`,
      `font-size:${Math.abs(d * (vh / viewport.viewBox[3]))}px`,
      `transform:scaleX(${item.width ? (item.width * (vw / viewport.viewBox[2])) / (span.textContent.length * Math.abs(d * (vh / viewport.viewBox[3])) * 0.6) : 1})`,
      `transform-origin:0% 0%`,
      `color:transparent`,
      `white-space:pre`,
      `cursor:text`,
      `pointer-events:auto`,
    ].join(';');
    container.appendChild(span);
  });
}
