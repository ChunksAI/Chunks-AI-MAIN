'use client';

import { useRef, useState } from 'react';
import { useStudy } from '@/contexts/StudyContext';

interface ContentPanelProps {
  style?: React.CSSProperties;
  onExplain?: (text: string) => void;
  onQuiz?: (text: string) => void;
  onSummarize?: () => void;
}

export default function ContentPanel({ style, onExplain, onQuiz, onSummarize }: ContentPanelProps) {
  const { state, handleUploadDocument } = useStudy();
  const { slides, docTitle, pdfBlobUrl, uploadLoading, uploadError } = state;

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showTooltip = (id: string) => {
    setActiveTooltip(id);
    setTimeout(() => setActiveTooltip(null), 4000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleUploadDocument(file);
    // reset so the same file can be re-uploaded if needed
    e.target.value = '';
  };

  // ── Empty / upload state ──────────────────────────────────────────────────
  if (!pdfBlobUrl && slides.length === 0) {
    return (
      <div className="content-panel" style={style}>
        <div className="panel-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)' }}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <span className="panel-title">No document loaded</span>
        </div>

        <div className="pdf-viewer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, padding: '2rem' }}>
          {uploadLoading ? (
            <>
              <div style={{ fontSize: 32 }}>⏳</div>
              <div style={{ fontWeight: 500 }}>Uploading &amp; parsing document…</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40 }}>📄</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Upload a PDF to get started</div>
              <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', maxWidth: 260 }}>
                Your document will be displayed here so you can read, highlight, and quiz yourself on it.
              </div>
              {uploadError && (
                <div style={{ color: 'var(--danger, #e53)', fontSize: 13 }}>⚠️ {uploadError}</div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                className="panel-btn"
                style={{ padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose PDF…
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Document loaded — show uploading overlay or real PDF ──────────────────
  return (
    <div className="content-panel" style={style}>
      {/* ── Panel header ── */}
      <div className="panel-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)' }}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <span className="panel-title">{docTitle || 'Loading…'}</span>
        <div className="panel-actions">
          <button
            className="panel-btn"
            title="Upload a different document"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadLoading}
          >
            {uploadLoading ? '…' : '↑ Replace'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* ── PDF iframe ── */}
      {uploadLoading ? (
        <div className="pdf-viewer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16 }}>
          <div style={{ fontSize: 32 }}>⏳</div>
          <div style={{ fontWeight: 500 }}>Uploading &amp; parsing document…</div>
        </div>
      ) : pdfBlobUrl ? (
        <iframe
          src={pdfBlobUrl}
          className="pdf-iframe"
          title={docTitle || 'PDF document'}
        />
      ) : (
        /* Fallback: no blob URL (e.g. after a page refresh — slides restored from sessionStorage) */
        <div className="pdf-viewer">
          {slides.map((slide, idx) => {
            const pageNum = slide.slide_number ?? idx + 1;
            const tooltipId = `slide-${pageNum}`;

            return (
              <div key={pageNum} className="pdf-page">
                {slide.title && <div className="pdf-chapter">{slide.title}</div>}
                <div className="pdf-body">
                  {slide.content.map((paragraph, pIdx) => {
                    const isFirst = pIdx === 0;
                    return isFirst ? (
                      <p key={pIdx}>
                        <span
                          className="highlight"
                          onClick={() => showTooltip(tooltipId)}
                        >
                          {paragraph}
                          <span className={`selection-tooltip${activeTooltip === tooltipId ? ' visible' : ''}`}>
                            <button
                              className="tooltip-btn"
                              onClick={(e) => { e.stopPropagation(); onExplain?.(slide.title || paragraph.slice(0, 60)); }}
                            >
                              ✦ Explain
                            </button>
                            <span className="divider-v" />
                            <button
                              className="tooltip-btn"
                              onClick={(e) => { e.stopPropagation(); onQuiz?.(slide.title || paragraph.slice(0, 60)); }}
                            >
                              ❓ Quiz me
                            </button>
                            <span className="divider-v" />
                            <button
                              className="tooltip-btn"
                              onClick={(e) => { e.stopPropagation(); onSummarize?.(); }}
                            >
                              ↓ Summarize
                            </button>
                          </span>
                        </span>
                      </p>
                    ) : (
                      <p key={pIdx}>{paragraph}</p>
                    );
                  })}
                  {slide.notes && (
                    <p style={{ color: 'var(--text3)', fontSize: '0.85em', fontStyle: 'italic' }}>
                      {slide.notes}
                    </p>
                  )}
                </div>
                <div className="page-num">{pageNum}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
