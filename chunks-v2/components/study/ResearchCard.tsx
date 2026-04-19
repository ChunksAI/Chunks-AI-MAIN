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

function SourceChip({ text }: { text: string }) {
  // Try to extract a URL from the source text (e.g. from "Source (year) — https://…")
  const urlMatch = text.match(/https?:\/\/[^\s)]+/);
  if (urlMatch) {
    const label = text.replace(urlMatch[0], '').replace(/\s*—\s*$/, '').trim() || text;
    return (
      <a
        href={urlMatch[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="rc-source-chip rc-source-chip--link"
        title={text}
      >
        🔗 {label}
      </a>
    );
  }
  return (
    <span className="rc-source-chip" title={text}>
      📄 {text}
    </span>
  );
}

// ─── ResearchCard ─────────────────────────────────────────────────────────────

export interface ResearchCardProps {
  structured: Record<string, unknown>;
}

function ResearchCard({ structured }: ResearchCardProps) {
  const summary               = str(structured.summary);
  const findings              = toList(structured.key_findings);
  const sources               = toList(structured.sources);
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
                <SourceChip key={i} text={s} />
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
