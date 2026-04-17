'use client';

import { useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LogEvent = {
  layer: string;
  message: string;
  status: 'pending' | 'done' | 'skipped';
};

type Props = {
  /** Ordered list of orchestrator steps to display. */
  logEvents: LogEvent[];
  /**
   * When true the component collapses to a small "✓ Analyzed context" pill.
   * Set this as soon as the LLM starts streaming actual response text.
   */
  streamStarted?: boolean;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<LogEvent['status'], string> = {
  done:    '✓',
  pending: '⟳',
  skipped: '–',
};

const STATUS_COLOR: Record<LogEvent['status'], string> = {
  done:    'var(--accent2)',
  pending: 'var(--accent)',
  skipped: 'var(--text3)',
};

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * OrchestratorLog — animated, expandable execution trace shown above the AI
 * response while the backend's orchestrator is running.
 *
 * States:
 *   1. Collapsed (default) — single summary line with pulsing dot
 *   2. Expanded — full console-style step list (user clicks chevron)
 *   3. Pill (streamStarted=true) — compact "✓ Analyzed context" badge shown
 *      once LLM text starts streaming, to get out of the way of the answer
 */
export default function OrchestratorLog({ logEvents, streamStarted }: Props) {
  const [expanded, setExpanded] = useState(false);

  // ── Phase 3: pill after streaming starts ─────────────────────────────────────
  if (streamStarted) {
    return (
      <div
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            5,
          padding:        '3px 10px',
          borderRadius:   999,
          background:     'var(--accent2-light)',
          color:          'var(--accent2)',
          fontSize:       12,
          fontWeight:     500,
          marginBottom:   8,
          width:          'fit-content',
          fontFamily:     "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        }}
      >
        <span>✓</span>
        <span>Analyzed context</span>
      </div>
    );
  }

  if (!logEvents.length) return null;

  // Latest pending step for the collapsed summary line
  const activeEvent =
    logEvents.filter((e) => e.status === 'pending').at(-1) ?? logEvents.at(-1)!;

  const hasPending = logEvents.some((e) => e.status === 'pending');

  return (
    <>
      {/* Inject pulse keyframe once, harmlessly idempotent in the DOM */}
      <style>{`
        @keyframes _orch-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.25; }
        }
      `}</style>

      <div
        style={{
          fontFamily:   "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize:     12,
          border:       '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          background:   'var(--surface)',
          marginBottom: 10,
          overflow:     'hidden',
        }}
      >
        {/* ── Collapsed summary row ──────────────────────────────────────────── */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded((v) => !v)}
          onKeyDown={(e) => e.key === 'Enter' && setExpanded((v) => !v)}
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        8,
            padding:    '7px 10px',
            cursor:     'pointer',
            color:      'var(--text2)',
            userSelect: 'none',
          }}
        >
          {hasPending && (
            <span
              aria-hidden="true"
              style={{
                width:       6,
                height:      6,
                borderRadius: '50%',
                background:  'var(--accent)',
                display:     'inline-block',
                flexShrink:  0,
                animation:   '_orch-pulse 1.2s ease-in-out infinite',
              }}
            />
          )}

          <span style={{ flex: 1, color: 'var(--text2)' }}>
            <span style={{ color: 'var(--text3)' }}>Orchestrator: </span>
            {activeEvent.message}
          </span>

          {/* Chevron toggle */}
          <span
            aria-hidden="true"
            style={{
              color:      'var(--text3)',
              fontSize:   10,
              transform:  expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform var(--transition)',
              lineHeight: 1,
            }}
          >
            ▾
          </span>
        </div>

        {/* ── Expanded execution trace ───────────────────────────────────────── */}
        {expanded && (
          <div
            style={{
              borderTop:     '1px solid var(--border)',
              padding:       '8px 12px',
              display:       'flex',
              flexDirection: 'column',
              gap:           4,
            }}
          >
            <div style={{ color: 'var(--text3)', fontSize: 11, marginBottom: 4 }}>
              ▾ System execution trace
            </div>

            {logEvents.map((ev, i) => (
              <div
                key={i}
                style={{
                  display:    'flex',
                  alignItems: 'flex-start',
                  gap:        8,
                  color:      ev.status === 'skipped' ? 'var(--text3)' : 'var(--text2)',
                  opacity:    ev.status === 'skipped' ? 0.55 : 1,
                }}
              >
                {/* Status badge */}
                <span
                  style={{
                    color:      STATUS_COLOR[ev.status],
                    width:      14,
                    flexShrink: 0,
                    fontWeight: ev.status === 'pending' ? 700 : 400,
                    animation:
                      ev.status === 'pending'
                        ? '_orch-pulse 1.2s ease-in-out infinite'
                        : undefined,
                  }}
                >
                  {STATUS_ICON[ev.status]}
                </span>

                {/* Layer label + message */}
                <span>
                  <span style={{ color: 'var(--text3)' }}>{ev.layer}:</span>
                  {' '}
                  {ev.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
