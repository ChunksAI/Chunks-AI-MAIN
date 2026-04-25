'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStudy } from '@/contexts/StudyContext';
import { useTutorBrain } from '@/hooks/useTutorBrain';
import type { QuizResult } from '@/types';
import { PASS_THRESHOLD } from '@/lib/constants';
import { analyzeGaps, fetchNextTopic } from '@/lib/studyApi';
import type { NextTopicResponse } from '@/lib/studyApi';
import { useAuth } from '@/contexts/AuthContext';

interface QuizResultsProps {
  result: QuizResult;
  onRetry?: () => void;
  onReview?: () => void;
  onClose?: () => void;
}

/**
 * QuizResults — shown after quiz completion.
 * Score-based CTAs:
 *   < 50%  → 📚 Review Flashcards (highlights related deck with pulsing border)
 *   50–79% → 🔄 Retry Quiz
 *   ≥ 80%  → 🎓 Take Exam (navigates to /exam)
 */
export default function QuizResults({ result, onRetry, onReview, onClose }: QuizResultsProps) {
  const { score, correctAnswers, totalQuestions, topic, wrongAnswers } = result;
  const router = useRouter();
  const { state, dispatch } = useStudy();
  const { user } = useAuth();
  const { tbRecordQuizResult, tbRecordMastery, tbRecordGap, tbGetModel } = useTutorBrain(
    user?.isGuest ? undefined : user?.id,
    state.bookId ?? undefined,
  );
  const [nextTopic, setNextTopic] = useState<NextTopicResponse | null>(null);

  // Record quiz result once when this component mounts (= quiz just finished)
  useEffect(() => {
    tbRecordQuizResult(topic, score, wrongAnswers ?? []);
    if (score >= 80) {
      tbRecordMastery(topic);
    }

    const bookId = state.bookId;

    // Send quiz results to backend PAEV analysis if a book is loaded
    if (bookId) {
      const model = tbGetModel();
      const gaps = model.gaps.map((g) => ({ concept: g.concept, status: g.status }));

      // Both calls run in parallel; failures are silent
      Promise.all([
        analyzeGaps(
          bookId,
          [{ topic, score, wrongAnswers: wrongAnswers ?? [] }],
          model.mastered,
        ).catch(() => null),
        fetchNextTopic(bookId, gaps).catch(() => null),
      ]).then(([gapRes, nextRes]) => {
        // Merge any PAEV-detected gaps back into the local model
        if (gapRes) {
          for (const gap of gapRes.detected_gaps) {
            if (
              (gap.status === 'failing' || gap.status === 'reviewing') &&
              !model.gaps.find((existing) => existing.concept === gap.concept)
            ) {
              tbRecordGap(gap.concept);
            }
          }
        }

        if (nextRes?.concept_name) setNextTopic(nextRes);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const color =
    score >= PASS_THRESHOLD ? 'var(--accent2)' : score >= 50 ? 'var(--accent)' : 'var(--danger)';

  const message =
    score >= PASS_THRESHOLD
      ? "🏆 Excellent! You've mastered this topic."
      : score >= 50
        ? '📈 Good progress! A bit more practice will help.'
        : '📚 Keep going — review your flashcards to reinforce this.';

  const handleReviewFlashcards = () => {
    // Switch to workspace tab and show the flashcard decks with a visual highlight
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'workspace' });
    onClose?.();
  };

  const handleTakeExam = () => {
    // Navigate to exam page with the topic pre-filled as a URL param
    const params = new URLSearchParams();
    if (topic) params.set('topic', topic);
    router.push(`/exam?${params.toString()}`);
  };

  return (
    <div className="quiz-results">
      <div className="results-score" style={{ color }}>
        {score}%
      </div>
      <div className="results-detail">
        {correctAnswers} / {totalQuestions} correct
      </div>
      <p className="results-message">{message}</p>

      {/* ── What to study next banner ── */}
      {nextTopic && (
        <div
          style={{
            borderLeft: '3px solid var(--accent)',
            background: 'var(--surface2)',
            borderRadius: '6px',
            padding: '10px 14px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
            <strong>Up next:</strong> {nextTopic.concept_name} — {nextTopic.reason}
          </span>
          <button
            onClick={() => setNextTopic(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text3)',
              fontSize: '16px',
              lineHeight: 1,
              flexShrink: 0,
              padding: '0 2px',
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="results-actions">
        {/* Score < 50%: Review Flashcards */}
        {score < 50 && (
          <button
            className="ws-add-btn"
            onClick={handleReviewFlashcards}
            style={{ borderColor: 'var(--accent2)', color: 'var(--accent2)' }}
          >
            📚 Review Flashcards
          </button>
        )}

        {/* Score 50–79%: Retry Quiz */}
        {score >= 50 && score < PASS_THRESHOLD && onRetry && (
          <button className="ws-add-btn" onClick={onRetry}>
            🔄 Retry Quiz
          </button>
        )}

        {/* Score ≥ 80%: Take Exam */}
        {score >= PASS_THRESHOLD && (
          <button
            className="ws-add-btn"
            style={{ background: 'var(--accent2)', color: '#fff' }}
            onClick={handleTakeExam}
          >
            🎓 Take Exam
          </button>
        )}

        {/* Secondary CTA */}
        {onRetry && score < 50 && (
          <button className="panel-btn" onClick={onRetry}>
            🔄 Retry Quiz
          </button>
        )}
        {onReview && (
          <button className="panel-btn" onClick={onReview}>
            📖 Review Topic
          </button>
        )}
        {onClose && (
          <button className="icon-btn" onClick={onClose}>
            Back to Workspace
          </button>
        )}
      </div>
    </div>
  );
}
