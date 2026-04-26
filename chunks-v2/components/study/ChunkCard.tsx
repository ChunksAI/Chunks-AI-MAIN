'use client';

/**
 * components/study/ChunkCard.tsx
 *
 * Rich structured renderer for chunk and master mode AI responses.
 *
 * Chunk mode fields:  overview · key_concepts · step_by_step · example
 * Master mode fields: core_explanation · mechanism · analysis · connections · key_insight
 *
 * Renders:
 *  - A collapsible overview / core-explanation section
 *  - A key-concepts tag cloud (chunk) or distinct sections (master)
 *  - A numbered step-by-step list (chunk) or mechanism/analysis/connections (master)
 *  - A highlighted example / key-insight block
 */

import React, { memo, useState } from 'react';

// ─── Type helpers ─────────────────────────────────────────────────────────────

type StructuredData = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  return JSON.stringify(v);
}

function toList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(str).filter(Boolean);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="cc-section-header">
      <span className="cc-section-icon">{icon}</span>
      <span className="cc-section-label">{label}</span>
    </div>
  );
}

function CollapsibleSection({
  icon,
  label,
  defaultOpen = true,
  children,
}: {
  icon: string;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="cc-section">
      <button
        className="cc-section-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <SectionHeader icon={icon} label={label} />
        <span className="cc-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="cc-section-body">{children}</div>}
    </div>
  );
}

// ─── Chunk mode renderer ──────────────────────────────────────────────────────

function ChunkModeCard({ data }: { data: StructuredData }) {
  const overview      = str(data.overview);
  const concepts      = toList(data.key_concepts);
  const steps         = toList(data.step_by_step);
  const example       = str(data.example);
  const checkQuestion = str(data.check_question);

  return (
    <div className="cc-card">
      <div className="cc-card-header">
        <span className="cc-mode-badge cc-mode-chunk">📖 Chunk</span>
      </div>

      {overview && (
        <CollapsibleSection icon="🗺" label="Overview">
          <p className="cc-overview-text">{overview}</p>
        </CollapsibleSection>
      )}

      {concepts.length > 0 && (
        <div className="cc-section">
          <SectionHeader icon="🏷" label="Key Concepts" />
          <div className="cc-section-body">
            <div className="cc-concepts">
              {concepts.map((c, i) => (
                <span key={i} className="cc-concept-tag">{c}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {steps.length > 0 && (
        <div className="cc-section">
          <SectionHeader icon="🪜" label="Step by Step" />
          <div className="cc-section-body">
            <ol className="cc-steps">
              {steps.map((step, i) => (
                <li key={i} className="cc-step-item">
                  <span className="cc-step-num">{i + 1}</span>
                  <span className="cc-step-text">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {example && (
        <div className="cc-section">
          <SectionHeader icon="✨" label="Example" />
          <div className="cc-section-body">
            <div className="cc-example-block">{example}</div>
          </div>
        </div>
      )}

      {checkQuestion && (
        <div className="cc-section">
          <SectionHeader icon="🤔" label="Check Your Understanding" />
          <div className="cc-section-body">
            <div className="cc-check-question">{checkQuestion}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Master mode renderer ─────────────────────────────────────────────────────

function MasterModeCard({ data }: { data: StructuredData }) {
  const coreExplanation = str(data.core_explanation);
  const mechanism       = str(data.mechanism);
  const analysis        = str(data.analysis);
  const connections     = str(data.connections);
  const keyInsight      = str(data.key_insight);

  return (
    <div className="cc-card">
      <div className="cc-card-header">
        <span className="cc-mode-badge cc-mode-master">🧠 Master</span>
      </div>

      {coreExplanation && (
        <CollapsibleSection icon="📐" label="Core Explanation">
          <p className="cc-overview-text">{coreExplanation}</p>
        </CollapsibleSection>
      )}

      {mechanism && (
        <div className="cc-section">
          <SectionHeader icon="⚙️" label="Mechanism" />
          <div className="cc-section-body">
            <p className="cc-body-text">{mechanism}</p>
          </div>
        </div>
      )}

      {analysis && (
        <div className="cc-section">
          <SectionHeader icon="🔍" label="Analysis" />
          <div className="cc-section-body">
            <p className="cc-body-text">{analysis}</p>
          </div>
        </div>
      )}

      {connections && (
        <div className="cc-section">
          <SectionHeader icon="🔗" label="Connections" />
          <div className="cc-section-body">
            <p className="cc-body-text">{connections}</p>
          </div>
        </div>
      )}

      {keyInsight && (
        <div className="cc-section">
          <SectionHeader icon="💡" label="Key Insight" />
          <div className="cc-section-body">
            <div className="cc-insight-block">{keyInsight}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ChunkCard ────────────────────────────────────────────────────────────────

export interface ChunkCardProps {
  structured: Record<string, unknown>;
}

function ChunkCard({ structured }: ChunkCardProps) {
  const isMasterMode = 'core_explanation' in structured;
  return isMasterMode
    ? <MasterModeCard data={structured} />
    : <ChunkModeCard data={structured} />;
}

export default memo(ChunkCard);
