'use client';

import { useEffect, useState } from 'react';
import { useExam } from '@/contexts/ExamContext';
import { useExamTimer } from '@/hooks/useExamTimer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Stable list of concept colors (cycles if there are more concepts)
const CONCEPT_COLORS = [
  'var(--accent)',
  'var(--accent2)',
  'var(--blue)',
  '#9C27B0',
  '#FF9800',
];

function conceptColor(idx: number): string {
  return CONCEPT_COLORS[idx % CONCEPT_COLORS.length];
}

// ─── Submit confirmation ───────────────────────────────────────────────────────

function SubmitConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          padding: '2rem',
          maxWidth: 400,
          width: '90%',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Submit exam?</h3>
        <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Once submitted, you cannot change your answers. Make sure you&apos;ve reviewed
          flagged questions before proceeding.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border2)',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Keep reviewing
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--accent)',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ExamRunner ───────────────────────────────────────────────────────────────

export default function ExamRunner() {
  const { state, handleSubmitExam, handleAnswer, handleFlag, handleNavigate } = useExam();
  const { questions, answers, flagged, currentIndex, config } = state;

  const [showConfirm, setShowConfirm] = useState(false);

  const { timeRemaining, start } = useExamTimer(config.timeLimit, handleSubmitExam);

  // Start timer on mount
  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync timer into context for result calculation
  const { dispatch } = useExam();
  useEffect(() => {
    dispatch({ type: 'TICK' });
    // We let the hook manage the actual countdown; TICK is used only to keep
    // state.timeRemaining current for the result calculation at submit time.
    // The actual displayed value comes from the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining]);

  if (questions.length === 0) return null;

  const current = questions[currentIndex];
  const totalAnswered = Object.keys(answers).length;
  const canSubmit = totalAnswered >= Math.ceil(questions.length * 0.8);

  // Group question indices by concept label
  const conceptGroups: { label: string; indices: number[] }[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const group = conceptGroups.find((g) => g.label === q.conceptLabel);
    if (group) {
      group.indices.push(i);
    } else {
      conceptGroups.push({ label: q.conceptLabel, indices: [i] });
    }
  }

  const isLow = timeRemaining < 5 * 60;
  const isPulsing = timeRemaining < 2 * 60;

  const currentConceptIdx = conceptGroups.findIndex((g) =>
    g.indices.includes(currentIndex),
  );

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100vh',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* ── Left navigator panel ── */}
      <div
        style={{
          width: 200,
          minWidth: 200,
          background: 'var(--bg2)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Title */}
        <div style={{ padding: '16px 14px 10px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)' }}>
          Exam
        </div>

        {/* Timer */}
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
            fontFeatureSettings: '"tnum"',
            fontSize: 20,
            fontWeight: 700,
            color: isLow ? 'var(--danger)' : 'var(--text)',
            animation: isPulsing ? 'pulse 1s ease-in-out infinite' : 'none',
          }}
        >
          {formatTime(timeRemaining)}
        </div>

        {/* Question navigator — grouped by concept */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
          {conceptGroups.map((group, gIdx) => (
            <div key={group.label} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: conceptColor(gIdx),
                  marginBottom: 6,
                  lineHeight: 1.3,
                  padding: '0 2px',
                }}
              >
                {group.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {group.indices.map((qi) => {
                  const isAnswered = qi in answers;
                  const isFlagged = flagged.has(qi);
                  const isCurrent = qi === currentIndex;
                  const isDangerFlagged = isFlagged && !isAnswered && isLow;

                  let bg = 'white';
                  let borderColor = 'var(--border2)';
                  let color = 'var(--text)';

                  if (isDangerFlagged) {
                    bg = 'var(--danger-light)'; borderColor = 'var(--danger)'; color = 'var(--danger)';
                  } else if (isFlagged) {
                    bg = '#FFF3CD'; borderColor = '#E6A817'; color = '#9A6A00';
                  } else if (isAnswered) {
                    bg = 'var(--accent-light)'; borderColor = 'var(--accent)'; color = 'var(--accent)';
                  }

                  return (
                    <button
                      key={qi}
                      onClick={() => handleNavigate(qi)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: `2px solid ${isCurrent ? 'var(--text)' : borderColor}`,
                        background: isCurrent ? 'var(--text)' : bg,
                        color: isCurrent ? 'white' : color,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'var(--transition)',
                      }}
                    >
                      {qi + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit button */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
          {!canSubmit && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, textAlign: 'center' }}>
              Answer {Math.ceil(questions.length * 0.8) - totalAnswered} more to submit
            </div>
          )}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!canSubmit}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: canSubmit ? 'var(--accent)' : 'var(--border2)',
              color: canSubmit ? 'white' : 'var(--text3)',
              fontWeight: 600,
              fontSize: 13,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            Submit Exam
          </button>
        </div>
      </div>

      {/* ── Main question area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem 3rem' }}>

          {/* Concept label chip */}
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: conceptColor(currentConceptIdx),
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: conceptColor(currentConceptIdx),
              }}
            >
              {current.conceptLabel}
            </span>
          </div>

          {/* Question number */}
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
            Question {currentIndex + 1} of {questions.length}
          </div>

          {/* Question text */}
          <p style={{ fontSize: 16, lineHeight: 1.7, fontWeight: 500, marginBottom: 28, maxWidth: 680 }}>
            {current.question}
          </p>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}>
            {Object.entries(current.options).map(([key, text]) => {
              const selected = answers[currentIndex] === key;
              return (
                <button
                  key={key}
                  onClick={() => handleAnswer(currentIndex, key)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    padding: '14px 18px',
                    minHeight: 48,
                    borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${selected ? 'var(--accent)' : 'var(--border2)'}`,
                    background: selected ? 'var(--accent)' : 'transparent',
                    color: selected ? 'white' : 'var(--text)',
                    textAlign: 'left',
                    fontSize: 14,
                    lineHeight: 1.5,
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    width: '100%',
                  }}
                >
                  <span style={{ fontWeight: 700, minWidth: 20 }}>{key}.</span>
                  <span>{text}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom nav row */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '14px 3rem',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button
            onClick={() => handleNavigate(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            style={{
              padding: '9px 18px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border2)',
              background: 'transparent',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
              opacity: currentIndex === 0 ? 0.4 : 1,
              fontSize: 14,
            }}
          >
            ← Previous
          </button>

          <button
            onClick={() => handleFlag(currentIndex)}
            style={{
              padding: '9px 18px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${flagged.has(currentIndex) ? '#E6A817' : 'var(--border2)'}`,
              background: flagged.has(currentIndex) ? '#FFF3CD' : 'transparent',
              color: flagged.has(currentIndex) ? '#9A6A00' : 'var(--text2)',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {flagged.has(currentIndex) ? '⚑ Flagged' : '⚐ Flag for review'}
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => handleNavigate(Math.min(questions.length - 1, currentIndex + 1))}
            disabled={currentIndex === questions.length - 1}
            style={{
              padding: '9px 18px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border2)',
              background: 'transparent',
              cursor: currentIndex === questions.length - 1 ? 'not-allowed' : 'pointer',
              opacity: currentIndex === questions.length - 1 ? 0.4 : 1,
              fontSize: 14,
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Submit confirmation overlay */}
      {showConfirm && (
        <SubmitConfirm
          onConfirm={() => { setShowConfirm(false); handleSubmitExam(); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
