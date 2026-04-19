'use client';

/**
 * components/study/ResearchCard.tsx
 *
 * Rich structured renderer for research mode AI responses.
 *
 * Fields: summary · key_findings · sources · simplified_explanation
 *
 * Renders:
 *  - A confidence indicator derived from source count
 *  - A summary paragraph
 *  - Key findings as individual claim cards
 *  - Source citations as inline chips
 *  - A "plain English" simplified explanation block
 */

import React, { memo } from 'react';

// ─── Type helpers ─────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  return JSON.stringify(v);
}

function toList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(str).filter(Boolean);
}

type SourceObj = {
  title?: string;
  url?: string;
  year?: string;
  authors?: string;
  note?: string;
};

/** Normalise a sources array that may contain strings or objects into SourceObj[]. */
function toSources(v: unknown): SourceObj[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s): SourceObj => {
      if (typeof s === 'string') {
        const m = s.match(/https?:\/\/[^\s)]+/);
        return m
          ? { title: s.replace(m[0], '').replace(/\s*—\s*$/, '').trim() || m[0], url: m[0] }
          : { title: s };
      }
      if (s && typeof s === 'object') return s as SourceObj;
      return { title: String(s) };
    })
    .filter((s) => s.title || s.url);
}

// ─── Confidence indicator ─────────────────────────────────────────────────────

type ConfidenceLevel = 'limited' | 'moderate' | 'strong';

function getConfidence(sourceCount: number): ConfidenceLevel {
  if (sourceCount >= 3) return 'strong';
  if (sourceCount >= 1) return 'moderate';
  return 'limited';
}

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  strong:   '● Strong Evidence',
  moderate: '◑ Moderate Evidence',
  limited:  '○ Limited Evidence',
};

const CONFIDENCE_CLASSES: Record<ConfidenceLevel, string> = {
  strong:   'rc-confidence rc-confidence--strong',
  moderate: 'rc-confidence rc-confidence--moderate',
  limited:  'rc-confidence rc-confidence--limited',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="rc-section-header">
      <span className="rc-section-icon">{icon}</span>
      <span className="rc-section-label">{label}</span>
    </div>
  );
}

function FindingCard({ text, index }: { text: string; index: number }) {
  return (
    <div className="rc-finding-card">
      <span className="rc-finding-index">{index + 1}</span>
      <span className="rc-finding-text">{text}</span>
    </div>
  );
}

function SourceChip({ src }: { src: SourceObj }) {
  const label = [src.title, src.year ? `(${src.year})` : ''].filter(Boolean).join(' ');
  if (src.url) {
    return (
      <a
        href={src.url}
        target="_blank"
        rel="noopener noreferrer"
        className="rc-source-chip rc-source-chip--link"
        title={[label, src.note].filter(Boolean).join(' — ')}
      >
        🔗 {label || src.url}
      </a>
    );
  }
  return (
    <span className="rc-source-chip" title={src.note ?? label}>
      📄 {label}
    </span>
  );
}

// ─── ResearchCard ─────────────────────────────────────────────────────────────

export interface ResearchCardProps {
  structured: Record<string, unknown>;
  /** Live web citations from the backend's Perplexity Sonar pass (optional). */
  webCitations?: Array<{ url: string; title?: string }>;
}

function ResearchCard({ structured, webCitations }: ResearchCardProps) {
  const summary               = str(structured.summary);
  const findings              = toList(structured.key_findings);
  const structuredSources     = toSources(structured.sources);

  // Merge web citations (from Perplexity Sonar) as additional sources, deduping by URL.
  const seenUrls = new Set(structuredSources.map((s) => s.url).filter(Boolean));
  const extraSources: SourceObj[] = (webCitations ?? [])
    .filter((c) => c.url && !seenUrls.has(c.url))
    .map((c) => ({ title: c.title || c.url, url: c.url }));
  const sources = [...structuredSources, ...extraSources];

  const simplifiedExplanation = str(structured.simplified_explanation);

  const confidence      = getConfidence(sources.length);
  const confidenceLabel = CONFIDENCE_LABELS[confidence];
  const confidenceClass = CONFIDENCE_CLASSES[confidence];

  return (
    <div className="rc-card">
      <div className="rc-card-header">
        <span className="rc-mode-badge">🔬 Research</span>
        <span className={confidenceClass}>{confidenceLabel}</span>
      </div>

      {summary && (
        <div className="rc-section">
          <SectionHeader icon="📋" label="Summary" />
          <div className="rc-section-body">
            <p className="rc-summary-text">{summary}</p>
          </div>
        </div>
      )}

      {findings.length > 0 && (
        <div className="rc-section">
          <SectionHeader icon="📌" label="Key Findings" />
          <div className="rc-section-body">
            <div className="rc-findings">
              {findings.map((f, i) => (
                <FindingCard key={i} text={f} index={i} />
              ))}
            </div>
          </div>
        </div>
      )}

      {sources.length > 0 && (
        <div className="rc-section">
          <SectionHeader icon="📚" label="Sources" />
          <div className="rc-section-body">
            <div className="rc-sources">
              {sources.map((s, i) => (
                <SourceChip key={i} src={s} />
              ))}
            </div>
          </div>
        </div>
      )}

      {simplifiedExplanation && (
        <div className="rc-section">
          <SectionHeader icon="💬" label="In Plain English" />
          <div className="rc-section-body">
            <div className="rc-simplified-block">{simplifiedExplanation}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ResearchCard);
