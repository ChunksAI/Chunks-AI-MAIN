'use client';

/**
 * PdfViewer — pdf.js-powered PDF renderer with a custom toolbar.
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
 * The custom toolbar (sticky at the top) provides:
 *  - current page / total pages
 *  - zoom out / zoom in / fit-width (reset zoom)
 *  - download
 *  - open in new tab
 *  - 🎧 Listen (Professor Listen Mode)
 *
 * Worker configuration: webpack 5 (Next.js 13+) processes the
 * `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`
 * pattern statically — it copies the worker bundle to
 * `_next/static/chunks/` and returns the correct same-origin URL,
 * so no CDN or manual file-copying is required.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import { listenToPage } from '@/lib/studyApi';
import type { ListenAction, ListenActionContext } from '@/types/api';

const RENDER_SCALE = 1.5;
const MAX_VISIBLE_TEXT = 500;
const OBSERVER_THRESHOLDS = [0, 0.25, 0.5, 0.75, 1.0];
const ZOOM_STEP = 0.25;
const ZOOM_MIN  = 0.5;
const ZOOM_MAX  = 3.0;

const PLAYBACK_RATES = [1, 1.25, 1.5] as const;
type PlaybackRate = typeof PLAYBACK_RATES[number];

type ListenStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'done' | 'error';

interface PdfViewerProps {
  blobUrl: string;
  onPageChange: (page: number, visibleText: string) => void;
  /** Optional filename used when downloading. Defaults to 'document.pdf'. */
  fileName?: string;
  /** Optional book ID forwarded to the /listen/page backend. */
  bookId?: string;
  /**
   * Called when the student taps a post-listen learning action.
   * The parent (ContentPanel) translates these into actual chat prompts.
   */
  onListenAction?: (action: ListenAction, ctx: ListenActionContext) => void;
}

type Status = 'loading' | 'ready' | 'error';

export default function PdfViewer({
  blobUrl,
  onPageChange,
  fileName,
  bookId,
  onListenAction,
}: PdfViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pagesContainerRef  = useRef<HTMLDivElement>(null);
  const audioRef           = useRef<HTMLAudioElement>(null);

  const [status,      setStatus]      = useState<Status>('loading');
  const [errorMsg,    setErrorMsg]    = useState('');
  const [totalPages,  setTotalPages]  = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel,   setZoomLevel]   = useState(1.0);

  // Professor Listen Mode state
  const [listenStatus,   setListenStatus]   = useState<ListenStatus>('idle');
  const [listenError,    setListenError]    = useState('');
  const [audioUrl,       setAudioUrl]       = useState<string | null>(null);
  const [playbackRate,   setPlaybackRate]   = useState<PlaybackRate>(1);
  const [audioProgress,  setAudioProgress]  = useState(0);   // 0–1
  const [audioDuration,  setAudioDuration]  = useState(0);   // seconds
  const [audioCurrentT,  setAudioCurrentT]  = useState(0);   // seconds

  // Keep onPageChange in a ref so the IntersectionObserver callback
  // always calls the latest version without re-creating the observer.
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => { onPageChangeRef.current = onPageChange; }, [onPageChange]);

  // Revoke stale blob URLs on cleanup to avoid memory leaks.
  const prevAudioUrl = useRef<string | null>(null);
  useEffect(() => {
    if (audioUrl !== prevAudioUrl.current) {
      if (prevAudioUrl.current) URL.revokeObjectURL(prevAudioUrl.current);
      prevAudioUrl.current = audioUrl;
    }
  }, [audioUrl]);
  useEffect(() => {
    return () => {
      if (prevAudioUrl.current) URL.revokeObjectURL(prevAudioUrl.current);
    };
  }, []);

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
    setTotalPages(0);
    setCurrentPage(1);

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

      setTotalPages(pdf.numPages);

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

        setCurrentPage(bestPage);
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

  // ── Sync playback rate to audio element ───────────────────────────────────
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // ── Toolbar actions ────────────────────────────────────────────────────────
  const handleZoomOut = useCallback(() => {
    setZoomLevel(z => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))));
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(z => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))));
  }, []);

  const handleFitWidth = useCallback(() => { setZoomLevel(1.0); }, []);

  const handleDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = blobUrl;
    let downloadName = 'document.pdf';
    if (fileName) {
      downloadName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    }
    a.download = downloadName;
    a.click();
  }, [blobUrl, fileName]);

  const handleOpenNewTab = useCallback(() => {
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  }, [blobUrl]);

  // ── Listen Mode actions ────────────────────────────────────────────────────
  const handleListen = useCallback(async () => {
    // Get the visible text for the current page from the DOM dataset.
    const pageEl = pagesContainerRef.current?.querySelector<HTMLElement>(
      `[data-page="${currentPage}"]`,
    );
    const visibleText = pageEl?.dataset.text ?? '';

    if (!visibleText.trim()) {
      setListenStatus('error');
      setListenError('No readable text found on this page.');
      return;
    }

    // Stop any previous playback.
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setAudioUrl(null);
    setListenStatus('loading');
    setListenError('');
    setAudioProgress(0);
    setAudioCurrentT(0);
    setAudioDuration(0);

    try {
      const blob = await listenToPage({
        doc_title: fileName ?? '',
        page: currentPage,
        visible_text: visibleText,
        ...(bookId ? { book_id: bookId } : {}),
        mode: 'professor',
      });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setListenStatus('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Audio generation failed. Please try again.';
      setListenError(msg);
      setListenStatus('error');
    }
  }, [currentPage, fileName, bookId]);

  // Auto-play when the audio URL becomes available.
  useEffect(() => {
    if (listenStatus === 'ready' && audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().then(() => {
        setListenStatus('playing');
      }).catch(() => {
        // Autoplay blocked — stay in 'ready' (user can press play manually).
      });
    }
  }, [listenStatus, audioUrl, playbackRate]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (listenStatus === 'playing') {
      audio.pause();
      setListenStatus('paused');
    } else if (listenStatus === 'paused' || listenStatus === 'ready') {
      audio.play().catch(() => {});
      setListenStatus('playing');
    } else if (listenStatus === 'done') {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      setListenStatus('playing');
    }
  }, [listenStatus]);

  const handleStop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setListenStatus('idle');
    setAudioUrl(null);
    setAudioProgress(0);
    setAudioCurrentT(0);
    setAudioDuration(0);
    setListenError('');
  }, []);

  const handleAudioTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setAudioCurrentT(audio.currentTime);
    setAudioProgress(audio.currentTime / audio.duration);
  }, []);

  const handleAudioLoaded = useCallback(() => {
    const audio = audioRef.current;
    if (audio) setAudioDuration(audio.duration);
  }, []);

  const handleAudioEnded = useCallback(() => {
    setListenStatus('done');
    setAudioProgress(1);
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
    setAudioProgress(pct);
  }, []);

  const handleListenAction = useCallback((action: ListenAction) => {
    onListenAction?.(action, { page: currentPage, docTitle: fileName ?? '' });
    // Keep the player visible but dismiss the action strip.
  }, [onListenAction, currentPage, fileName]);

  const handleNextPage = useCallback(() => {
    const pagesContainer = pagesContainerRef.current;
    const scrollContainer = scrollContainerRef.current;
    if (!pagesContainer || !scrollContainer) return;
    const next = pagesContainer.querySelector<HTMLElement>(
      `[data-page="${currentPage + 1}"]`,
    );
    if (next) {
      next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // Dismiss the player after navigating.
    handleStop();
  }, [currentPage, handleStop]);

  // ── Time formatter ─────────────────────────────────────────────────────────
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const isListenActive = listenStatus !== 'idle';

  return (
    <div className="pdf-viewer-outer">
      {/* Hidden audio element — controlled imperatively */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleAudioLoaded}
        onEnded={handleAudioEnded}
        preload="auto"
      />

      {/* ── Sticky toolbar ── */}
      <div className="pdf-toolbar">
        <span className="pdf-toolbar-pages">
          {status === 'ready' ? `${currentPage} / ${totalPages}` : '— / —'}
        </span>

        <div className="pdf-toolbar-sep" />

        <button
          className="pdf-toolbar-btn"
          onClick={handleZoomOut}
          disabled={zoomLevel <= ZOOM_MIN}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="pdf-toolbar-zoom">{Math.round(zoomLevel * 100)}%</span>
        <button
          className="pdf-toolbar-btn"
          onClick={handleZoomIn}
          disabled={zoomLevel >= ZOOM_MAX}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          className="pdf-toolbar-btn"
          onClick={handleFitWidth}
          title="Fit width (reset zoom)"
          aria-label="Fit width"
        >
          ⊡
        </button>

        <div className="pdf-toolbar-sep" />

        <button
          className="pdf-toolbar-btn"
          onClick={handleDownload}
          title="Download PDF"
          aria-label="Download PDF"
        >
          ↓
        </button>
        <button
          className="pdf-toolbar-btn"
          onClick={handleOpenNewTab}
          title="Open in new tab"
          aria-label="Open in new tab"
        >
          ↗
        </button>

        <div className="pdf-toolbar-sep" />

        {/* 🎧 Listen button */}
        <button
          className={`pdf-toolbar-btn pdf-listen-btn${listenStatus === 'loading' ? ' pdf-listen-btn--loading' : ''}`}
          onClick={listenStatus === 'loading' ? undefined : handleListen}
          disabled={status !== 'ready' || listenStatus === 'loading'}
          title="Professor Listen Mode — hear an AI professor explain this page"
          aria-label="Listen to this page"
        >
          {listenStatus === 'loading' ? '⏳' : '🎧'}
        </button>
      </div>

      {/* ── Professor Listen Player ── */}
      {isListenActive && (
        <div className="pdf-listen-player">
          {listenStatus === 'error' ? (
            <div className="pdf-listen-error">
              <span>⚠️ {listenError || 'Audio generation failed. Please try again.'}</span>
              <button className="pdf-listen-close" onClick={handleStop} aria-label="Dismiss">✕</button>
            </div>
          ) : (
            <>
              {/* Controls row */}
              <div className="pdf-listen-controls">
                {/* Play / Pause */}
                <button
                  className="pdf-listen-ctrl-btn"
                  onClick={handlePlayPause}
                  disabled={listenStatus === 'loading'}
                  title={listenStatus === 'playing' ? 'Pause' : 'Play'}
                  aria-label={listenStatus === 'playing' ? 'Pause' : 'Play'}
                >
                  {listenStatus === 'playing' ? '⏸' : '▶'}
                </button>

                {/* Stop */}
                <button
                  className="pdf-listen-ctrl-btn"
                  onClick={handleStop}
                  title="Stop and close"
                  aria-label="Stop"
                >
                  ⏹
                </button>

                {/* Progress bar */}
                <div className="pdf-listen-progress-wrap" onClick={handleSeek} role="progressbar" aria-valuenow={Math.round(audioProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="pdf-listen-progress-bar" style={{ width: `${audioProgress * 100}%` }} />
                </div>

                {/* Time */}
                <span className="pdf-listen-time">
                  {listenStatus === 'loading'
                    ? '…'
                    : `${fmtTime(audioCurrentT)} / ${fmtTime(audioDuration)}`}
                </span>

                {/* Playback rate */}
                <div className="pdf-listen-speed-group">
                  {PLAYBACK_RATES.map(r => (
                    <button
                      key={r}
                      className={`pdf-listen-speed-btn${playbackRate === r ? ' pdf-listen-speed-btn--active' : ''}`}
                      onClick={() => setPlaybackRate(r)}
                      aria-label={`${r}x speed`}
                    >
                      {r}×
                    </button>
                  ))}
                </div>

                {/* Close */}
                <button
                  className="pdf-listen-close"
                  onClick={handleStop}
                  title="Close player"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Post-listen actions — shown after audio finishes */}
              {listenStatus === 'done' && (
                <div className="pdf-listen-actions">
                  <span className="pdf-listen-actions-label">What&apos;s next?</span>
                  <button
                    className="pdf-listen-action-btn"
                    onClick={() => handleListenAction('explain_slower')}
                    title="Get a simpler explanation in the chat"
                  >
                    🐢 Explain slower
                  </button>
                  <button
                    className="pdf-listen-action-btn"
                    onClick={() => handleListenAction('quiz_me')}
                    title="Quiz me on this page"
                  >
                    ❓ Quiz me
                  </button>
                  <button
                    className="pdf-listen-action-btn"
                    onClick={() => handleListenAction('flashcards')}
                    title="Generate flashcards for this page"
                  >
                    🃏 Flashcards
                  </button>
                  {currentPage < totalPages && (
                    <button
                      className="pdf-listen-action-btn"
                      onClick={handleNextPage}
                      title="Scroll to next page"
                    >
                      ➡ Next page
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Scrollable page area ── */}
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
          style={{
            display: status === 'ready' ? 'block' : 'none',
            width: `${Math.round(zoomLevel * 100)}%`,
          }}
        />
      </div>
    </div>
  );
}
