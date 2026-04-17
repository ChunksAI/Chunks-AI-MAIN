'use client';

import { useState, useEffect, useCallback } from 'react';
import { generateQuiz, topicToSlides } from '@/lib/studyApi';
import { useTutorBrain } from '@/hooks/useTutorBrain';
import type { QuizQuestion } from '@/types/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Topic / document title used to generate topic-relevant questions. */
  topic: string;
  /** Called when the quiz is completed or skipped. */
  onComplete: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DIAGNOSTIC_COUNT = 5;

function scoreForAnswers(questions: QuizQuestion[], answers: Record<number, string>): number {
  const correct = questions.filter((q, i) => answers[i] === q.answer).length;
  return Math.round((correct / questions.length) * 100);
}

// ─── Component ─────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'error' | 'quiz' | 'results';

/**
 * DiagnosticQuiz — a modal overlay that:
 * 1. Fetches 5 topic-specific questions from /generate-quiz.
 * 2. Walks the student through each question.
 * 3. Seeds `useTutorBrain` with gaps/mastery based on results.
 * 4. Calls `onComplete` to dismiss itself.
 *
 * Rendered as a full-viewport overlay so the chat interface is blocked until
 * the quiz is done (or skipped).
 */
export default function DiagnosticQuiz({ topic, onComplete }: Props) {
  const { tbRecordGap, tbRecordMastery, tbRecordQuizResult } = useTutorBrain();

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);

  // ── Fetch questions on mount ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const slides = topicToSlides(topic);
    generateQuiz({ slides, count: DIAGNOSTIC_COUNT, difficulty: 'medium', mode: 'diagnostic' })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.questions.length > 0) {
          setQuestions(res.questions.slice(0, DIAGNOSTIC_COUNT));
          setPhase('quiz');
        } else {
          setPhase('error');
        }
      })
      .catch(() => {
        if (!cancelled) setPhase('error');
      });
    return () => { cancelled = true; };
  }, [topic]);

  // ── Quiz interaction ──────────────────────────────────────────────────────────

  const currentQuestion = questions[currentIndex];
  const selectedAnswer = answers[currentIndex] ?? '';
  const isLast = currentIndex === questions.length - 1;

  const handleSelect = (key: string) => {
    if (revealed) return;
    setAnswers((prev) => ({ ...prev, [currentIndex]: key }));
  };

  const handleReveal = () => {
    if (!selectedAnswer) return;
    setRevealed(true);
  };

  const handleNext = useCallback(() => {
    setRevealed(false);
    if (isLast) {
      // Compute results and seed the student model
      const finalScore = scoreForAnswers(questions, answers);
      setScore(finalScore);

      // Per-question gap/mastery recording
      questions.forEach((q, i) => {
        const correct = answers[i] === q.answer;
        // Use a truncated question snippet as the concept identifier for the student model
        const conceptId = q.question.slice(0, 60).trim();
        if (correct) {
          tbRecordMastery(conceptId);
        } else {
          tbRecordGap(conceptId);
        }
      });

      // Overall quiz result on the topic
      const wrongAnswers = questions
        .filter((q, i) => answers[i] !== q.answer)
        .map((q) => q.question);
      tbRecordQuizResult(topic, finalScore, wrongAnswers);

      setPhase('results');
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [isLast, questions, answers, tbRecordMastery, tbRecordGap, tbRecordQuizResult, topic]);

  // ── Styles ────────────────────────────────────────────────────────────────────

  const overlay: React.CSSProperties = {
    position:       'fixed',
    inset:          0,
    zIndex:         9999,
    background:     'rgba(0,0,0,0.55)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '16px',
  };

  const card: React.CSSProperties = {
    background:   'var(--surface)',
    border:       '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow:    'var(--shadow-lg)',
    width:        '100%',
    maxWidth:     480,
    padding:      '28px 28px 24px',
    display:      'flex',
    flexDirection:'column',
    gap:          16,
  };

  const progressBar: React.CSSProperties = {
    height:       4,
    borderRadius: 999,
    background:   'var(--bg3)',
    overflow:     'hidden',
  };

  const progressFill: React.CSSProperties = {
    height:     '100%',
    borderRadius: 999,
    background:  'var(--accent)',
    width:       `${Math.round(((currentIndex + 1) / questions.length) * 100)}%`,
    transition:  'width var(--transition)',
  };

  const questionText: React.CSSProperties = {
    fontSize:   15,
    fontWeight: 500,
    color:      'var(--text)',
    lineHeight: 1.5,
  };

  const optionBase: React.CSSProperties = {
    display:      'flex',
    alignItems:   'center',
    gap:          10,
    padding:      '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border:       '1px solid var(--border)',
    background:   'var(--surface)',
    cursor:       'pointer',
    textAlign:    'left',
    width:        '100%',
    fontSize:     13.5,
    color:        'var(--text)',
    transition:   'background var(--transition), border-color var(--transition)',
  };

  function optionStyle(key: string): React.CSSProperties {
    if (!revealed) {
      return {
        ...optionBase,
        background:  selectedAnswer === key ? 'var(--accent-light)' : 'var(--surface)',
        borderColor: selectedAnswer === key ? 'var(--accent)' : 'var(--border)',
        fontWeight:  selectedAnswer === key ? 600 : 400,
      };
    }
    const isCorrect = key === currentQuestion.answer;
    const isWrong   = key === selectedAnswer && key !== currentQuestion.answer;
    if (isCorrect) {
      return { ...optionBase, background: 'var(--accent2-light)', borderColor: 'var(--accent2)', fontWeight: 600, cursor: 'default' };
    }
    if (isWrong) {
      return { ...optionBase, background: 'var(--danger-light)', borderColor: 'var(--danger)', cursor: 'default' };
    }
    return { ...optionBase, opacity: 0.45, cursor: 'default' };
  }

  const primaryBtn: React.CSSProperties = {
    padding:        '9px 20px',
    borderRadius:   'var(--radius-sm)',
    background:     'var(--accent)',
    color:          '#fff',
    fontWeight:     600,
    fontSize:       13,
    border:         'none',
    cursor:         'pointer',
    alignSelf:      'flex-end',
    transition:     'opacity var(--transition)',
  };

  const skipLink: React.CSSProperties = {
    fontSize:   12,
    color:      'var(--text3)',
    background: 'none',
    border:     'none',
    cursor:     'pointer',
    textDecoration: 'underline',
    alignSelf:  'center',
    padding:    0,
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  // Loading state
  if (phase === 'loading') {
    return (
      <div style={overlay}>
        <div style={card}>
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text2)', fontSize: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>🧠</div>
            <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>Preparing diagnostic…</div>
            <div>Generating 5 quick questions on <strong>{topic}</strong></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state — allow the user to skip
  if (phase === 'error') {
    return (
      <div style={overlay}>
        <div style={card}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>Couldn't load diagnostic</div>
            <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
              We couldn't fetch questions right now. You can skip the diagnostic and chat normally.
            </div>
            <button style={{ ...primaryBtn, alignSelf: 'center' }} onClick={onComplete}>
              Continue to chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Results screen
  if (phase === 'results') {
    const correct = questions.filter((q, i) => answers[i] === q.answer).length;
    return (
      <div style={overlay}>
        <div style={card}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>
              {score >= 80 ? '🎉' : score >= 50 ? '📚' : '🔁'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {score}%
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
              {correct} of {questions.length} correct
            </div>
          </div>

          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            {score >= 80
              ? <>Your knowledge of <strong>{topic}</strong> looks solid. The AI tutor will tailor explanations accordingly.</>
              : score >= 50
              ? <>Some gaps detected in <strong>{topic}</strong>. The AI tutor will focus on those areas.</>
              : <>Your knowledge model has been seeded for <strong>{topic}</strong>. The AI tutor will start from the foundations.</>
            }
          </div>

          <button style={{ ...primaryBtn, alignSelf: 'center', marginTop: 4 }} onClick={onComplete}>
            Start studying →
          </button>
        </div>
      </div>
    );
  }

  // Quiz screen
  return (
    <div style={overlay}>
      <div style={card}>
        {/* Header */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Diagnostic · {currentIndex + 1} of {questions.length}
            </span>
            <button style={skipLink} onClick={onComplete}>Skip</button>
          </div>
          <div style={progressBar}>
            <div style={progressFill} />
          </div>
        </div>

        {/* Question */}
        <div style={questionText}>{currentQuestion.question}</div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(currentQuestion.options).map(([key, value]) => (
            <button
              key={key}
              style={optionStyle(key)}
              onClick={() => handleSelect(key)}
            >
              <span style={{
                width: 22, height: 22, borderRadius: '50%', border: '1.5px solid currentColor',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
                color: selectedAnswer === key && !revealed ? 'var(--accent)' : 'var(--text3)',
              }}>
                {key}
              </span>
              <span>{value}</span>
            </button>
          ))}
        </div>

        {/* Explanation (after reveal) */}
        {revealed && currentQuestion.explanation && (
          <div style={{
            background: 'var(--bg2)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            fontSize: 13,
            color: 'var(--text2)',
            lineHeight: 1.6,
            borderLeft: `3px solid ${selectedAnswer === currentQuestion.answer ? 'var(--accent2)' : 'var(--accent)'}`,
          }}>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>
              {selectedAnswer === currentQuestion.answer ? '✓ Correct! ' : `✗ Answer: ${currentQuestion.answer}. `}
            </span>
            {currentQuestion.explanation}
          </div>
        )}

        {/* Action button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {!revealed ? (
            <button
              style={{ ...primaryBtn, opacity: selectedAnswer ? 1 : 0.45, cursor: selectedAnswer ? 'pointer' : 'default' }}
              onClick={handleReveal}
              disabled={!selectedAnswer}
            >
              Check answer
            </button>
          ) : (
            <button style={primaryBtn} onClick={handleNext}>
              {isLast ? 'See results →' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
