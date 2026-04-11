'use client';

/**
 * hooks/useReviewSession.ts — Derived state and side-effect orchestration
 * for the Personalised Review Session Engine.
 *
 * Reads review session state from StudyContext, triggers flashcard/quiz
 * generation when entering the respective steps, and exposes derived values
 * (step number, elapsed time) so components stay thin.
 */

import { useEffect } from 'react';
import { useStudy } from '@/contexts/StudyContext';
import type { ReviewStep } from '@/contexts/StudyContext';

export interface UseReviewSessionReturn {
  session: ReturnType<typeof useStudy>['state']['reviewSession'];
  /** 1-based step number for display (e.g. "Step 2 of 4"). */
  stepNumber: number;
  /** Seconds elapsed since session start. */
  timeElapsed: number;
  handleAdvanceReviewStep: () => void;
  handleEndReviewSession: () => void;
  handleCompleteReviewQuiz: (score: number, correct: number, total: number) => void;
  handleStartReviewSession: (topic?: string) => Promise<void>;
}

export function useReviewSession(): UseReviewSessionReturn {
  const {
    state,
    dispatch,
    handleAdvanceReviewStep,
    handleEndReviewSession,
    handleCompleteReviewQuiz,
    handleGenerateFlashcards,
    handleGenerateQuiz,
    handleStartReviewSession,
  } = useStudy();

  const session = state.reviewSession;

  // ── Derived values ────────────────────────────────────────────────────────

  const stepNumberMap: Record<ReviewStep, number> = {
    explain: 1,
    flashcards: 2,
    quiz: 3,
    result: 4,
  };

  const stepNumber = session ? stepNumberMap[session.step] : 0;

  // Elapsed time is computed at render — no extra state needed.
  const timeElapsed = session ? Math.floor((Date.now() - session.startedAt) / 1000) : 0;

  // ── Generate flashcards when entering the flashcards step ─────────────────
  useEffect(() => {
    if (session?.step === 'flashcards' && !session.flashcardsReady) {
      void handleGenerateFlashcards(session.topic, 8).then(() => {
        dispatch({ type: 'SET_REVIEW_FLASHCARDS_READY' });
      });
    }
    // Only retrigger when the step or readiness flag changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.step, session?.flashcardsReady]);

  // ── Generate quiz when entering the quiz step ────────────────────────────
  useEffect(() => {
    if (session?.step === 'quiz' && !session.quizReady) {
      void handleGenerateQuiz(session.topic, 5, 'medium').then(() => {
        dispatch({ type: 'SET_REVIEW_QUIZ_READY' });
      });
    }
    // Only retrigger when the step or readiness flag changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.step, session?.quizReady]);

  return {
    session,
    stepNumber,
    timeElapsed,
    handleAdvanceReviewStep,
    handleEndReviewSession,
    handleCompleteReviewQuiz,
    handleStartReviewSession,
  };
}
