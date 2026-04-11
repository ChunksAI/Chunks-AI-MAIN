'use client';

/**
 * components/review/ReviewSession.tsx — Full-screen review session shell.
 *
 * Renders the top bar (exit + topic name + step counter), the progress bar,
 * and routes to the appropriate step component (ReviewExplain, ReviewFlashcards,
 * ReviewQuiz, ReviewResult).
 */

import { useRouter } from 'next/navigation';
import { useStudy } from '@/contexts/StudyContext';
import { useReviewSession } from '@/hooks/useReviewSession';
import type { ReviewStep } from '@/contexts/StudyContext';
import ReviewExplain from './ReviewExplain';
import ReviewFlashcards from './ReviewFlashcards';
import ReviewQuiz from './ReviewQuiz';
import ReviewResult from './ReviewResult';

const TOTAL_STEPS = 4;

export default function ReviewSession() {
  const router = useRouter();
  const { dispatch } = useStudy();
  const { session, stepNumber } = useReviewSession();

  if (!session) return null;

  const handleExit = () => {
    dispatch({ type: 'END_REVIEW_SESSION' });
    router.push('/study?tab=reviewer');
  };

  const stepComponents: Record<ReviewStep, React.ReactNode> = {
    explain: <ReviewExplain />,
    flashcards: <ReviewFlashcards />,
    quiz: <ReviewQuiz />,
    result: <ReviewResult />,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleExit}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text2)',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 'var(--radius)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'none';
          }}
        >
          ← Exit
        </button>

        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text1)',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '40%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {session.topic}
        </div>

        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 500 }}>
          Step {stepNumber} of {TOTAL_STEPS}
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div
        style={{
          height: 4,
          background: 'var(--surface2)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: '100%',
            background: 'var(--accent2)',
            width: `${session.progress}%`,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* ── Step content ── */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '32px 24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 720,
            animation: 'fadeUp 0.3s ease',
          }}
        >
          {stepComponents[session.step]}
        </div>
      </div>
    </div>
  );
}
