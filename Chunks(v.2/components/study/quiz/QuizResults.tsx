import type { QuizResult } from '@/types';

interface QuizResultsProps {
  result: QuizResult;
  onRetry?: () => void;
  onReview?: () => void;
  onClose?: () => void;
}

/**
 * QuizResults — shown after quiz completion.
 * Displays score, correct/total count, a motivational message, and CTAs.
 */
export default function QuizResults({ result, onRetry, onReview, onClose }: QuizResultsProps) {
  const { score, correctAnswers, totalQuestions } = result;

  const color =
    score >= 80 ? 'var(--accent2)' : score >= 50 ? 'var(--accent)' : 'var(--danger)';

  const message =
    score >= 80
      ? "🏆 Excellent! You've mastered this topic."
      : score >= 50
        ? '📈 Good progress! A bit more practice will help.'
        : '📚 Keep going — review your flashcards to reinforce this.';

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
        {onRetry && (
          <button className="ws-add-btn" onClick={onRetry}>
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
