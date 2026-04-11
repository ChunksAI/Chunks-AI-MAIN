'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useExam } from '@/contexts/ExamContext';
import { useStudy } from '@/contexts/StudyContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Score Circle (SVG donut) ─────────────────────────────────────────────────

function ScoreCircle({ score, passed }: { score: number; passed: boolean }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = passed ? 'var(--accent2)' : 'var(--danger)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        {/* Background track */}
        <circle cx={70} cy={70} r={radius} fill="none" stroke="var(--border2)" strokeWidth={12} />
        {/* Score arc */}
        <circle
          cx={70}
          cy={70}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        {/* Center text */}
        <text x={70} y={66} textAnchor="middle" fontSize={28} fontWeight={700} fill={color}>
          {score}%
        </text>
        <text x={70} y={84} textAnchor="middle" fontSize={11} fill="var(--text3)">
          score
        </text>
      </svg>

      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '0.1em', color }}>
        {passed ? 'PASSED' : 'FAILED'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)' }}>
        Pass mark: {75}%
      </div>
    </div>
  );
}

// ─── Wrong answer accordion ───────────────────────────────────────────────────

function WrongAnswersAccordion() {
  const { state } = useExam();
  const { questions, answers } = state;
  const [openConcept, setOpenConcept] = useState<string | null>(null);

  // Group wrong answers by concept
  const wrongByConcept = new Map<string, { question: string; selected: string; correct: string; explanation: string; selectedText: string; correctText: string }[]>();

  questions.forEach((q, i) => {
    const selected = answers[i];
    if (selected && selected !== q.answer) {
      const entry = {
        question: q.question,
        selected,
        correct: q.answer,
        explanation: q.explanation,
        selectedText: q.options[selected] ?? selected,
        correctText: q.options[q.answer] ?? q.answer,
      };
      const arr = wrongByConcept.get(q.conceptLabel) ?? [];
      arr.push(entry);
      wrongByConcept.set(q.conceptLabel, arr);
    }
  });

  if (wrongByConcept.size === 0) {
    return (
      <div style={{ color: 'var(--accent2)', fontSize: 14, padding: '1rem 0' }}>
        🎉 No wrong answers — perfect score on all reviewed questions!
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from(wrongByConcept.entries()).map(([concept, items]) => {
        const isOpen = openConcept === concept;
        return (
          <div key={concept} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <button
              onClick={() => setOpenConcept(isOpen ? null : concept)}
              style={{
                width: '100%',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
                textAlign: 'left',
              }}
            >
              <span>{concept} — {items.length} wrong</span>
              <span>{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {items.map((item, idx) => (
                  <div key={idx} style={{ paddingTop: 16, borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
                    <p style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>{item.question}</p>
                    <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-light)', borderRadius: 6, padding: '8px 12px', marginBottom: 6 }}>
                      ✗ Your answer: <strong>{item.selected}. {item.selectedText}</strong>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--accent2)', background: 'var(--accent2-light)', borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
                      ✓ Correct answer: <strong>{item.correct}. {item.correctText}</strong>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{item.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── ExamResults ──────────────────────────────────────────────────────────────

export default function ExamResults() {
  const { state, dispatch } = useExam();
  const { handleStartReview } = useStudy();
  const router = useRouter();

  const { result } = state;

  if (!result) return null;

  const { score, passed, totalQuestions, correctAnswers, timeUsed, conceptBreakdown, weakConcepts } = result;

  return (
    <div style={{ padding: '2rem', maxWidth: 760, margin: '0 auto' }}>

      {/* ── Score circle + pass/fail ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
        <ScoreCircle score={score} passed={passed} />
      </div>

      {/* ── Stats row ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 36,
        }}
      >
        {[
          { label: 'Total Questions', value: String(totalQuestions) },
          { label: 'Correct', value: String(correctAnswers) },
          { label: 'Wrong', value: String(totalQuestions - correctAnswers) },
          { label: 'Time Used', value: formatTime(timeUsed) },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px 16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Concept breakdown table ── */}
      <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Concept Breakdown</h3>
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          marginBottom: 36,
        }}
      >
        {[...conceptBreakdown].sort((a, b) => a.score - b.score).map((c, idx) => (
          <div
            key={c.concept}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '12px 16px',
              borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
              background: 'var(--surface)',
              borderLeft: c.score < 60 ? '4px solid var(--danger)' : '4px solid transparent',
            }}
          >
            <div style={{ flex: '0 0 180px', fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>
              {c.concept}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: 'var(--border2)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${c.score}%`,
                    borderRadius: 4,
                    background: c.score >= 70 ? 'var(--accent2)' : c.score >= 50 ? 'var(--accent)' : 'var(--danger)',
                    transition: 'width 0.8s ease',
                  }}
                />
              </div>
            </div>
            <div
              style={{
                flex: '0 0 50px',
                textAlign: 'right',
                fontSize: 13,
                fontWeight: 700,
                color: c.score < 60 ? 'var(--danger)' : 'var(--text)',
              }}
            >
              {c.score}%
            </div>
          </div>
        ))}
      </div>

      {/* ── Wrong answers accordion ── */}
      <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Wrong Answers Review</h3>
      <div style={{ marginBottom: 40 }}>
        <WrongAnswersAccordion />
      </div>

      {/* ── CTAs ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {weakConcepts.length > 0 && (
          <button
            onClick={() => {
              handleStartReview(weakConcepts[0]);
              router.push('/study');
            }}
            style={{
              padding: '12px 20px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border2)',
              background: 'transparent',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            📖 Review weak concepts
          </button>
        )}

        <button
          onClick={() => dispatch({ type: 'RESET_EXAM' })}
          style={{
            padding: '12px 20px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border2)',
            background: 'transparent',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          🔄 Retake Exam
        </button>

        <button
          onClick={() => {
            dispatch({ type: 'RESET_EXAM' });
            dispatch({ type: 'SET_CONFIG', payload: { questionCount: 25, timeLimit: 3600, difficulty: 'mixed' } });
          }}
          style={{
            padding: '12px 20px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--accent)',
            color: 'white',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          ⚙️ New Exam
        </button>
      </div>
    </div>
  );
}
