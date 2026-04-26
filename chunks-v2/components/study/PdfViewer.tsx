'use client';

/**
 * PdfViewer — pdf.js-powered PDF renderer.
 *
 * Replaces the native <iframe> approach so the app can track:
 *  - the real current page number
 *  - the visible text on that page (for the AI context)
 *
 * Each page is rendered to a <canvas> element at 1.5× scale for
 * crisp display. An IntersectionObserver on the scroll container
 * determines the most-visible page and fires onPageChange whenever
 * the user scrolls.
 *
 * Worker configuration: webpack 5 (Next.js 13+) processes the
 * `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`
 * pattern statically — it copies the worker bundle to
 * `_next/static/chunks/` and returns the correct same-origin URL,
 * so no CDN or manual file-copying is required.
 */

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';

const RENDER_SCALE = 1.5;
const MAX_VISIBLE_TEXT = 500;
const OBSERVER_THRESHOLDS = [0, 0.25, 0.5, 0.75, 1.0];

interface PdfViewerProps {
  blobUrl: string;
  onPageChange: (page: number, visibleText: string) => void;
}

type Status = 'loading' | 'ready' | 'error';

export default function PdfViewer({ blobUrl, onPageChange }: PdfViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Keep onPageChange in a ref so the IntersectionObserver callback
  // always calls the latest version without re-creating the observer.
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => { onPageChangeRef.current = onPageChange; }, [onPageChange]);

  // ── Load & render PDF ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!blobUrl) return;

    let cancelled = false;
    // Store the loading task handle for cleanup.
    let loadingTask: PDFDocumentLoadingTask | null = null;
    const pagesContainer = pagesContainerRef.current;
    if (!pagesContainer) return;

    // Capture to a local non-nullable variable — TypeScript cannot narrow refs.
    const container: HTMLDivElement = pagesContainer;

    // Clear previous pages so the DOM is clean before rendering the new PDF.
    container.innerHTML = '';
    setStatus('loading');
    setErrorMsg('');

    async function renderPdf() {
      // Dynamic import keeps pdf.js out of the server bundle entirely.
      const pdfjsLib = await import('pdfjs-dist');

      // webpack 5 / Next.js: processes this new URL() call statically and
      // outputs the worker to _next/static/chunks/ at the correct same-origin URL.
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).href;

      loadingTask = pdfjsLib.getDocument(blobUrl);
      const pdf = await loadingTask.promise;
      if (cancelled) return;

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (cancelled) break;

        const page = await pdf.getPage(pageNum);
        if (cancelled) { page.cleanup(); break; }

        const viewport = page.getViewport({ scale: RENDER_SCALE });

        // Build the wrapper div that the IntersectionObserver will watch.
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-page pdf-canvas-page';
        wrapper.dataset.page = String(pageNum);

        // Canvas element for the rendered page.
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        // CSS width 100% → canvas scales to container; height auto keeps ratio.
        canvas.style.cssText = 'width:100%;height:auto;display:block;';

        wrapper.appendChild(canvas);
        container.appendChild(wrapper);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }
        if (cancelled) { page.cleanup(); break; }

        // Extract plain text from pdf.js for the AI context.
        // `TextItem` objects have a `str` field; `TextMarkedContent` objects do not.
        const textContent = await page.getTextContent();
        if (cancelled) { page.cleanup(); break; }

        const pageText = textContent.items
          .map(item => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, MAX_VISIBLE_TEXT);

        wrapper.dataset.text = pageText;
        page.cleanup();
      }

      if (!cancelled) {
        setStatus('ready');
        // Fire the initial page-change for page 1 as soon as rendering completes.
        const firstPage = container.querySelector<HTMLElement>('[data-page="1"]');
        onPageChangeRef.current(1, firstPage?.dataset.text ?? '');
      }
    }

    renderPdf().catch(err => {
      if (!cancelled) {
        console.error('[PdfViewer] render error:', err);
        setErrorMsg('Failed to render PDF. Please try re-uploading the document.');
        setStatus('error');
      }
    });

    return () => {
      cancelled = true;
      try { loadingTask?.destroy(); } catch { /* ignore */ }
    };
  }, [blobUrl]);

  // ── IntersectionObserver — track most-visible page ─────────────────────────
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const pagesContainer = pagesContainerRef.current;
    if (!scrollContainer || !pagesContainer || status !== 'ready') return;

    const ratios = new Map<number, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const page = parseInt(
            (entry.target as HTMLElement).dataset.page ?? '',
            10,
          );
          if (!isNaN(page)) {
            if (entry.intersectionRatio > 0) {
              ratios.set(page, entry.intersectionRatio);
            } else {
              ratios.delete(page);
            }
          }
        });

        let bestPage = 1;
        let bestRatio = 0;
        ratios.forEach((r, p) => {
          if (r > bestRatio) { bestRatio = r; bestPage = p; }
        });

        const el = pagesContainer.querySelector<HTMLElement>(
          `[data-page="${bestPage}"]`,
        );
        onPageChangeRef.current(bestPage, el?.dataset.text ?? '');
      },
      { root: scrollContainer, threshold: OBSERVER_THRESHOLDS },
    );

    pagesContainer
      .querySelectorAll<HTMLElement>('[data-page]')
      .forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [status]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="pdf-viewer" ref={scrollContainerRef}>
      {status === 'loading' && (
        <div className="pdf-loading-overlay">
          <div style={{ fontSize: 28 }}>⏳</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>
            Rendering pages…
          </div>
        </div>
      )}
      {status === 'error' && (
        <div style={{ padding: '20px', color: 'var(--danger, #e53)', fontSize: 13 }}>
          ⚠️ {errorMsg}
        </div>
      )}
      {/* Pages are injected here imperatively by the render effect. */}
      <div
        ref={pagesContainerRef}
        style={{ display: status === 'ready' ? 'block' : 'none' }}
      />
    </div>
  );
}
