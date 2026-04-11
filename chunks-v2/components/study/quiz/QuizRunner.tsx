'use client';

import { useState } from 'react';
import { useStudy } from '@/contexts/StudyContext';
import type { Quiz } from '@/types';

interface QuizRunnerProps {
  quiz: Quiz;
  answers: string[];
}

/**
 * QuizRunner — renders the active quiz one question at a time.
 * Reads answers from StudyContext and dispatches ANSWER_QUESTION / QUIZ_COMPLETED.
 */
export default function QuizRunner({ quiz, answers }: QuizRunnerProps) {
  const { dispatch, handleCompleteQuiz } = useStudy();
  const [currentIndex, setCurrentIndex] = useState(0);

  const current = quiz.questions[currentIndex];
  const selectedAnswer = answers[currentIndex] ?? '';
  const isLast = currentIndex === quiz.questions.length - 1;
  const progress = Math.round(((currentIndex + 1) / quiz.questions.length) * 100);

  const handleSelect = (option: string) => {
    dispatch({ type: 'ANSWER_QUESTION', payload: { questionIndex: currentIndex, answer: option } });
  };

  const handleNext = () => {
    if (!selectedAnswer) return;
    if (isLast) {
      handleCompleteQuiz();
      return;
    }
    setCurrentIndex((i) => i + 1);
  };

  const handleClose = () => {
    dispatch({ type: 'CLOSE_QUIZ' });
  };

  return (
    <div className="quiz-runner">
      {/* ── Header ── */}
      <div className="quiz-runner-header">
        <div className="quiz-runner-title">{quiz.title}</div>
        <div className="quiz-runner-progress-text">
          {currentIndex + 1} / {quiz.questions.length}
        </div>
        <button className="icon-btn" onClick={handleClose} aria-label="Close quiz">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Progress bar ── */}
      <div className="quiz-progress-bar">
        <div className="quiz-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* ── Question ── */}
      <div className="quiz-body">
        <div className="quiz-question">{current.question}</div>

        <div className="quiz-options">
          {Object.entries(current.options).map(([key, value]) => (
            <button
              key={key}
              className={`quiz-option${selectedAnswer === key ? ' selected' : ''}`}
              onClick={() => handleSelect(key)}
            >
              <span className="option-key">{key}</span>
              <span className="option-text">{value}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="quiz-runner-footer">
        <button className="ws-add-btn" onClick={handleNext} disabled={!selectedAnswer}>
          {isLast ? 'Finish Quiz →' : 'Next Question →'}
        </button>
      </div>
    </div>
  );
}
