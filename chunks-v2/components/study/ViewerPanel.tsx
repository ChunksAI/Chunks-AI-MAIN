'use client';

/**
 * components/study/ViewerPanel.tsx — Left-panel viewer (P2-3).
 *
 * Reads from ViewerContext and renders the appropriate UI:
 *  - youtube   → YouTube iframe; seeks via postMessage on SEEK_YOUTUBE
 *  - research  → fetches paper metadata from /api/research/ingest and
 *                renders a structured paper card
 *  - none      → renders nothing (panel is hidden)
 */

import { useEffect, useRef, useState } from 'react';
import { useViewerContext } from '@/contexts/ViewerContext';
import { ingestResearch, type ResearchIngestResponse } from '@/lib/studyApi';
import FBDViewer from '@/components/study/FBDViewer';
import { getAccessToken } from '@/lib/supabaseClient';

// ─── AI summary helpers ───────────────────────────────────────────────────────

async function fetchAiSummary(title: string, abstract: string, authors?: string[], year?: number): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      task: 'research-summary',
      title,
      abstract,
      authors: authors?.join(', ') ?? '',
      year: year ?? null,
    }),
  });
  if (!res.ok) throw new Error('AI summary request failed');
  const data = await res.json() as { content?: Array<{ text?: string }> };
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Empty AI summary response');
  return text;
}

// ─── YouTube helpers ──────────────────────────────────────────────────────────

function buildYouTubeSrc(videoId: string, startSeconds: number): string {
  const params = new URLSearchParams({
    start: String(Math.floor(startSeconds)),
    enablejsapi: '1',
    rel: '0',
    modestbranding: '1',
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/** Seek the embedded YouTube player to `seconds` via the IFrame API postMessage. */
function seekYouTube(iframe: HTMLIFrameElement, seconds: number): void {
  iframe.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
    '*',
  );
}

// ─── Research card ────────────────────────────────────────────────────────────

function SummaryShimmer() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[100, 85, 72].map((w) => (
        <div
          key={w}
          style={{
            height: 12,
            width: `${w}%`,
            borderRadius: 4,
            background: 'linear-gradient(90deg, var(--border) 25%, var(--surface2, #f0f0f0) 50%, var(--border) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
          }}
        />
      ))}
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

function ResearchCard({
  meta,
  url,
}: {
  meta: ResearchIngestResponse;
  url: string;
}) {
  const displayTitle = meta.title ?? 'Research Paper';
  const authorList = meta.authors?.join(', ') ?? '';

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const fetchedKeyRef = useRef<string | null>(null);

  // Fetch AI summary whenever we have at least a title.
  // Abstract is passed when available but is not required — when absent the
  // AI generates a summary from the title and author metadata alone.
  useEffect(() => {
    if (!meta.title) return;
    const key = `${meta.title}\x00${meta.abstract ?? ''}\x00${meta.authors?.join(',') ?? ''}`;
    if (fetchedKeyRef.current === key) return;
    fetchedKeyRef.current = key;
    setSummaryLoading(true);
    setSummaryError(false);
    fetchAiSummary(meta.title, meta.abstract ?? '', meta.authors, meta.year)
      .then(setAiSummary)
      .catch(() => setSummaryError(true))
      .finally(() => setSummaryLoading(false));
  }, [meta.title, meta.abstract, meta.authors, meta.year]);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: 'var(--text)' }}>
        {displayTitle}
      </h3>

      {(authorList || meta.year) && (
        <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {authorList && <span>{authorList}</span>}
          {meta.year && <span style={{ color: 'var(--text3)' }}>· {meta.year}</span>}
        </div>
      )}

      {/* Metadata pills */}
      {(meta.journal || meta.doi || meta.pages) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {meta.journal && (
            <span style={pillStyle}>{meta.journal}</span>
          )}
          {meta.doi && (
            <a
              href={`https://doi.org/${meta.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...pillStyle, color: 'var(--accent)', textDecoration: 'none' }}
            >
              DOI: {meta.doi}
            </a>
          )}
          {meta.pages && (
            <span style={pillStyle}>{meta.pages} pages</span>
          )}
        </div>
      )}

      {/* Abstract — always shown; falls back to a note when unavailable */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
          Abstract
        </div>
        {meta.abstract ? (
          <p style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--text2)',
            lineHeight: 1.65,
          }}>
            {meta.abstract}
          </p>
        ) : (
          <p style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--text3)',
            lineHeight: 1.65,
            fontStyle: 'italic',
          }}>
            Abstract not available from source. See the AI summary below.
          </p>
        )}
      </div>

      {/* AI Summary — always shown once title is known */}
      <div style={{
        background: 'var(--surface2, #f7f7fb)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          ✦ AI Summary
        </span>
        {summaryLoading ? (
          <SummaryShimmer />
        ) : summaryError ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
            Summary unavailable — open the paper to read it directly.
          </p>
        ) : aiSummary ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>
            {aiSummary}
          </p>
        ) : null}
      </div>

      <a
        href={meta.source_url ?? url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', marginTop: 4 }}
      >
        Open paper ↗
      </a>
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 11,
  background: 'var(--surface2, #f0f0f5)',
  border: '1px solid var(--border)',
  color: 'var(--text2)',
  whiteSpace: 'nowrap',
};

// ─── Panel icons ──────────────────────────────────────────────────────────────

function YouTubeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#ff0000', flexShrink: 0 }}>
      <path d="M23.5 6.2a3.01 3.01 0 0 0-2.12-2.13C19.54 3.62 12 3.62 12 3.62s-7.54 0-9.38.45A3.01 3.01 0 0 0 .5 6.2C.06 8.06 0 12 0 12s.06 3.94.5 5.8a3.01 3.01 0 0 0 2.12 2.13C4.46 20.38 12 20.38 12 20.38s7.54 0 9.38-.45a3.01 3.01 0 0 0 2.12-2.13C23.94 15.94 24 12 24 12s-.06-3.94-.5-5.8zM9.75 15.5V8.5L16 12l-6.25 3.5z"/>
    </svg>
  );
}

function ResearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)', flexShrink: 0 }}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      <line x1="9" y1="9" x2="15" y2="9"/>
      <line x1="9" y1="13" x2="13" y2="13"/>
    </svg>
  );
}

function PhysicsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="12" x2="15" y2="15"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
    </svg>
  );
}

// ─── ViewerPanel ──────────────────────────────────────────────────────────────

interface ViewerPanelProps {
  style?: React.CSSProperties;
}

export default function ViewerPanel({ style }: ViewerPanelProps) {
  const { viewerState, viewerDispatch } = useViewerContext();
  const { viewerType, videoId, currentTimestamp, researchUrl, isViewerOpen, fbdData } = viewerState;

  // ── YouTube seek via IFrame postMessage ────────────────────────────────────
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSeekRef = useRef<number>(currentTimestamp);

  useEffect(() => {
    if (viewerType !== 'youtube') return;
    if (currentTimestamp === lastSeekRef.current) return;
    lastSeekRef.current = currentTimestamp;
    if (iframeRef.current) {
      seekYouTube(iframeRef.current, currentTimestamp);
    }
  }, [currentTimestamp, viewerType]);

  // ── Receive playback-position updates from the YouTube IFrame API ──────────
  // The YouTube embedded player emits `infoDelivery` postMessage events with
  // `info.currentTime` while the video is playing.  We forward the timestamp
  // to ViewerContext (SEEK_YOUTUBE) so StudyContext can derive the current
  // visible transcript segment and ground subsequent /ask requests in it.
  useEffect(() => {
    if (viewerType !== 'youtube') return;
    const handler = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return;
      try {
        const msg = JSON.parse(e.data) as { event?: string; info?: { currentTime?: number } };
        if (msg.event === 'infoDelivery' && typeof msg.info?.currentTime === 'number') {
          viewerDispatch({ type: 'SEEK_YOUTUBE', timestamp: msg.info.currentTime });
        }
      } catch { /* ignore non-JSON messages from other origins */ }
    };
    window.addEventListener('message', handler);
    // Subscribe to IFrame API events once the iframe is ready
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'listening', id: 1 }), '*',
      );
    }
    return () => window.removeEventListener('message', handler);
  }, [viewerType, viewerDispatch]);

  // ── Research metadata fetch ────────────────────────────────────────────────
  const [researchMeta, setResearchMeta] = useState<ResearchIngestResponse | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const lastFetchedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (viewerType !== 'research' || !researchUrl) return;
    if (researchUrl === lastFetchedUrl.current) return;

    lastFetchedUrl.current = researchUrl;
    setResearchMeta(null);
    setResearchError(null);
    setResearchLoading(true);

    ingestResearch(researchUrl)
      .then((meta) => setResearchMeta(meta))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load paper';
        setResearchError(msg);
      })
      .finally(() => setResearchLoading(false));
  }, [viewerType, researchUrl]);

  // ── Render nothing when viewer is closed ───────────────────────────────────
  if (!isViewerOpen || viewerType === 'none') return null;

  const panelTitle =
    viewerType === 'youtube'
      ? 'Video'
      : viewerType === 'fbd'
        ? 'Physics Diagram'
        : researchMeta?.title ?? 'Research Paper';

  return (
    <div className="content-panel" style={style}>
      {/* ── Header ── */}
      <div className="panel-header">
        {viewerType === 'youtube' ? <YouTubeIcon /> : viewerType === 'fbd' ? <PhysicsIcon /> : <ResearchIcon />}
        <span className="panel-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {panelTitle}
        </span>
        <div className="panel-actions">
          <button
            className="panel-btn"
            title="Close viewer"
            onClick={() => viewerDispatch({ type: 'CLOSE_VIEWER' })}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* ── YouTube iframe ── */}
      {viewerType === 'youtube' && videoId && (
        <iframe
          key={videoId}
          ref={iframeRef}
          src={buildYouTubeSrc(videoId, currentTimestamp)}
          className="pdf-iframe"
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}

      {viewerType === 'youtube' && !videoId && (
        <div className="pdf-viewer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text3)', fontSize: 13 }}>
          No video loaded
        </div>
      )}

      {/* ── Free Body Diagram ── */}
      {viewerType === 'fbd' && fbdData && (
        <div className="pdf-viewer" style={{ padding: 16, overflowY: 'auto' }}>
          <FBDViewer data={fbdData} />
        </div>
      )}

      {viewerType === 'fbd' && !fbdData && (
        <div className="pdf-viewer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text3)', fontSize: 13 }}>
          Generating diagram…
        </div>
      )}

      {/* ── Research paper card ── */}
      {viewerType === 'research' && (
        <div className="pdf-viewer">
          {researchLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 40, color: 'var(--text2)', fontSize: 13 }}>
              <div style={{ fontSize: 28 }}>📄</div>
              <span>Loading paper…</span>
            </div>
          )}

          {researchError && !researchLoading && (
            <div style={{ padding: '16px 0' }}>
              <div style={{ color: 'var(--danger, #e53)', fontSize: 13, marginBottom: 12 }}>
                ⚠️ {researchError}
              </div>
              {researchUrl && (
                <a
                  href={researchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', wordBreak: 'break-all' }}
                >
                  Open original link ↗
                </a>
              )}
            </div>
          )}

          {researchMeta && !researchLoading && (
            <ResearchCard meta={researchMeta} url={researchUrl ?? ''} />
          )}
        </div>
      )}
    </div>
  );
}
