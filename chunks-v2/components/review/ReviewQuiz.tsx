'use client';

/**
 * components/review/ReviewQuiz.tsx — Step 3 of the review session.
 *
 * Reads the most recently generated quiz for the session topic from
 * workspaceSections and presents an adaptive MCQ experience.  A local
 * streak counter adjusts the displayed difficulty label (cosmetic only —
 * question content does not change).  When the last question is answered
 * the score is computed and passed to handleCompleteReviewQuiz which
 * automatically advances to the result step.
 */

import { useState } from 'react';
import { useStudy } from '@/contexts/StudyContext';
import { useReviewSession } from '@/hooks/useReviewSession';
import type { QuizQuestion } from '@/types/api';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function QuizSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        padding: 32,
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {[60, 100, 90, 95, 85, 90].map((w, i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? 12 : 44,
            width: `${w}%`,
            borderRadius: i === 0 ? 6 : 'var(--radius)',
            backgroundImage:
              'linear-gradient(90deg, var(--surface2) 25%, var(--surface) 50%, var(--surface2) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s ease infinite',
          }}
        />
      ))}
    </div>
  );
}

// ─── Difficulty chip ──────────────────────────────────────────────────────────

interface DifficultyChipProps {
  text: string;
  color: string;
}

function DifficultyChip({ text, color }: DifficultyChipProps) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color,
        background: `${color}18`,
        borderRadius: 20,
        padding: '3px 10px',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        border: `1px solid ${color}40`,
      }}
    >
      {text}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReviewQuiz() {
  const { state } = useStudy();
  const { session, handleCompleteReviewQuiz } = useReviewSession();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [streak, setStreak] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);

  if (!session) return null;

  // ── Find the most recent quiz for this topic ───────────────────────────────
  const quizSection = state.workspaceSections.find((s) => s.title === 'Quizzes');
  const quizCard = quizSection?.cards
    .filter((c) => c.title.toLowerCase().includes(session.topic.toLowerCase()))
    .at(-1);

  const questions: QuizQuestion[] = quizCard?.questions ?? [];

  // ── Loading / error states ─────────────────────────────────────────────────
  if (!session.quizReady) return <QuizSkeleton />;

  if (session.quizReady && questions.length === 0) {
    return (
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: 32,
          boxShadow: 'var(--shadow-md)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
          Could not load quiz
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
          No questions were generated for "{session.topic}".
        </div>
        <button
          onClick={() => {
            const total = 0;
            handleCompleteReviewQuiz(0, 0, total);
          }}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius)',
            height: 44,
            padding: '0 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Skip to Results →
        </button>
      </div>
    );
  }

  const question = questions[currentIndex];
  const optionKeys = Object.keys(question.options).sort();
  const selectedAnswer = answers[currentIndex];
  const isAnswered = selectedAnswer !== undefined;

  // ── Adaptive difficulty label ──────────────────────────────────────────────
  const difficultyConfig =
    streak >= 2
      ? { text: 'Advanced', color: 'var(--danger)' }
      : streak <= -2
        ? { text: 'Review level', color: 'var(--accent2)' }
        : { text: 'Standard', color: 'var(--accent)' };

  const handleAnswer = (optionKey: string) => {
    if (isAnswered) return;

    const isCorrect = optionKey === question.answer;
    const newAnswers = { ...answers, [currentIndex]: optionKey };
    setAnswers(newAnswers);
    setLastCorrect(isCorrect);
    setShowResult(true);
    setStreak((s) => (isCorrect ? s + 1 : s - 1));
  };

  const handleNext = () => {
    setShowResult(false);
    setLastCorrect(null);

    const isLast = currentIndex === questions.length - 1;
    if (isLast) {
      // Calculate final score
      const allAnswers = { ...answers };
      const correctCount = questions.filter((q, i) => allAnswers[i] === q.answer).length;
      const score = Math.round((correctCount / questions.length) * 100);
      handleCompleteReviewQuiz(score, correctCount, questions.length);
      return;
    }

    setCurrentIndex((i) => i + 1);
  };

  const progress = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header row: question counter + difficulty */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 500 }}>
          Q {currentIndex + 1} of {questions.length}
        </span>
        <DifficultyChip text={difficultyConfig.text} color={difficultyConfig.color} />
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 4,
          background: 'var(--surface2)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--accent)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Question card */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 24px',
          boxShadow: 'var(--shadow-md)',
          animation: 'fadeUp 0.25s ease',
        }}
      >
        <div
          style={{
            fontSize: 16,
            lineHeight: 1.7,
            fontWeight: 500,
            color: 'var(--text1)',
            marginBottom: 24,
          }}
        >
          {question.question}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {optionKeys.map((key) => {
            const isSelected = selectedAnswer === key;
            const isCorrectOption = key === question.answer;
            let bg = 'var(--surface2)';
            let border = '1px solid var(--border)';
            let color = 'var(--text1)';

            if (showResult && isSelected && isCorrectOption) {
              bg = 'var(--accent2-light)';
              border = '1px solid var(--accent2)';
              color = 'var(--accent2)';
            } else if (showResult && isSelected && !isCorrectOption) {
              bg = 'var(--danger-light)';
              border = '1px solid var(--danger)';
              color = 'var(--danger)';
            } else if (showResult && isCorrectOption) {
              bg = 'var(--accent2-light)';
              border = '1px solid var(--accent2)';
              color = 'var(--accent2)';
            } else if (isSelected) {
              bg = 'var(--accent-light)';
              border = '1px solid var(--accent)';
              color = 'var(--accent)';
            }

            return (
              <button
                key={key}
                onClick={() => handleAnswer(key)}
                disabled={isAnswered}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  width: '100%',
                  minHeight: 48,
                  padding: '12px 16px',
                  background: bg,
                  border,
                  borderRadius: 'var(--radius)',
                  cursor: isAnswered ? 'default' : 'pointer',
                  textAlign: 'left',
                  fontSize: 14,
                  lineHeight: 1.5,
                  color,
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                <span
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: isSelected ? color : 'var(--surface)',
                    border: `1px solid ${isSelected ? color : 'var(--border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: isSelected ? '#fff' : 'var(--text3)',
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {key}
                </span>
                {question.options[key]}
              </button>
            );
          })}
        </div>

        {/* Explanation + next button — shown after answering */}
        {showResult && (
          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 'var(--radius)',
              background: lastCorrect ? 'var(--accent2-light)' : 'var(--danger-light)',
              animation: 'fadeUp 0.2s ease',
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: lastCorrect ? 'var(--accent2)' : 'var(--danger)',
                marginBottom: 6,
              }}
            >
              {lastCorrect ? '✅ Correct!' : '❌ Incorrect'}
            </div>
            {question.explanation && (
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                {question.explanation}
              </div>
            )}
            <button
              onClick={handleNext}
              style={{
                marginTop: 14,
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius)',
                height: 40,
                padding: '0 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {currentIndex === questions.length - 1 ? 'Finish quiz →' : 'Next question →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
