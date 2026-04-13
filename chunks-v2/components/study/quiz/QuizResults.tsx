'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStudy } from '@/contexts/StudyContext';
import { useTutorBrain } from '@/hooks/useTutorBrain';
import type { QuizResult } from '@/types';
import { PASS_THRESHOLD } from '@/lib/constants';
import { analyzeGaps } from '@/lib/studyApi';

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
  const { tbRecordQuizResult, tbRecordMastery, tbGetModel } = useTutorBrain();

  // Record quiz result once when this component mounts (= quiz just finished)
  useEffect(() => {
    tbRecordQuizResult(topic, score, wrongAnswers ?? []);
    if (score >= 80) {
      tbRecordMastery(topic);
    }

    // Send quiz results to backend PAEV analysis if a book is loaded
    const bookId = state.bookId;
    if (bookId) {
      const model = tbGetModel();
      analyzeGaps(
        bookId,
        [{ topic, score, wrongAnswers: wrongAnswers ?? [] }],
        model.mastered,
      ).then((res) => {
        // Merge any PAEV-detected gaps back into the local model
        for (const gap of res.detected_gaps) {
          if (gap.status === 'failing' || gap.status === 'reviewing') {
            // tbRecordGap only if not already tracked — use tbRecordQuizResult
            // with the PAEV-enriched status info
          }
        }
      }).catch(() => {
        // Backend PAEV analysis is best-effort; ignore failures
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
