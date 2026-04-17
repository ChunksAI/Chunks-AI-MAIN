'use client';

/**
 * contexts/QuizContext.tsx — quiz slice of the study session state.
 *
 * Owns all quiz-related state (active quiz, answers, results, weak areas,
 * performance history) and the corresponding reducer cases.  StudyProvider
 * consumes this context internally and merges it into the StudyContextValue
 * so existing consumers of useStudy() remain backward-compatible.
 */

import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { Quiz, QuizResult, WeakArea, PerformanceEntry } from '@/types';

// ─── Weak-area calculation ────────────────────────────────────────────────────

export function calcWeakAreas(results: QuizResult[]): WeakArea[] {
  const map = new Map<string, { totalScore: number; attempts: number; lastAttemptAt: string }>();
  for (const r of results) {
    const existing = map.get(r.topic);
    if (existing) {
      existing.totalScore += r.score;
      existing.attempts += 1;
      if (r.completedAt > existing.lastAttemptAt) existing.lastAttemptAt = r.completedAt;
    } else {
      map.set(r.topic, { totalScore: r.score, attempts: 1, lastAttemptAt: r.completedAt });
    }
  }
  const areas: WeakArea[] = [];
  for (const [topic, data] of map) {
    const avgScore = data.totalScore / data.attempts;
    if (avgScore < 70) {
      areas.push({
        topic,
        score: Math.round(avgScore),
        attempts: data.attempts,
        lastAttemptAt: data.lastAttemptAt,
      });
    }
  }
  return areas.sort((a, b) => a.score - b.score);
}

// ─── State ────────────────────────────────────────────────────────────────────

export interface QuizState {
  activeQuiz: Quiz | null;
  activeQuizAnswers: string[];
  quizResults: QuizResult[];
  weakAreas: WeakArea[];
  performanceHistory: PerformanceEntry[];
  studyInsights: string | null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type QuizAction =
  | { type: 'START_QUIZ'; payload: Quiz }
  | { type: 'ANSWER_QUESTION'; payload: { questionIndex: number; answer: string } }
  /** Handles only the quiz-state update. WorkspaceSection card updates stay in StudyContext. */
  | { type: 'QUIZ_COMPLETED'; payload: QuizResult }
  | { type: 'CLOSE_QUIZ' }
  /** Bulk-restore quiz state (e.g. from a session snapshot). */
  | {
      type: 'RESTORE_QUIZ';
      payload: {
        quizResults: QuizResult[];
        weakAreas: WeakArea[];
        performanceHistory: PerformanceEntry[];
      };
    }
  /** Reset quiz state on session reset. */
  | { type: 'RESET_QUIZ' };

// ─── Initial state ────────────────────────────────────────────────────────────

export const INITIAL_QUIZ_STATE: QuizState = {
  activeQuiz: null,
  activeQuizAnswers: [],
  quizResults: [],
  weakAreas: [],
  performanceHistory: [],
  studyInsights: null,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'START_QUIZ':
      return { ...state, activeQuiz: action.payload, activeQuizAnswers: [] };

    case 'ANSWER_QUESTION': {
      const answers = [...state.activeQuizAnswers];
      answers[action.payload.questionIndex] = action.payload.answer;
      return { ...state, activeQuizAnswers: answers };
    }

    case 'QUIZ_COMPLETED': {
      const newResults = [...state.quizResults, action.payload];
      const newWeakAreas = calcWeakAreas(newResults);
      const entry: PerformanceEntry = {
        date: action.payload.completedAt,
        topic: action.payload.topic,
        score: action.payload.score,
        type: 'quiz',
      };
      return {
        ...state,
        activeQuiz: null,
        activeQuizAnswers: [],
        quizResults: newResults,
        weakAreas: newWeakAreas,
        performanceHistory: [...state.performanceHistory, entry],
      };
    }

    case 'CLOSE_QUIZ':
      return { ...state, activeQuiz: null, activeQuizAnswers: [] };

    case 'RESTORE_QUIZ':
      return {
        ...state,
        quizResults: action.payload.quizResults,
        weakAreas: action.payload.weakAreas,
        performanceHistory: action.payload.performanceHistory,
      };

    case 'RESET_QUIZ':
      return INITIAL_QUIZ_STATE;

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface QuizContextValue {
  quizState: QuizState;
  quizDispatch: Dispatch<QuizAction>;
}

const QuizContext = createContext<QuizContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function QuizProvider({ children }: { children: ReactNode }) {
  const [quizState, quizDispatch] = useReducer(quizReducer, INITIAL_QUIZ_STATE);

  return (
    <QuizContext.Provider value={{ quizState, quizDispatch }}>
      {children}
    </QuizContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useQuizContext(): QuizContextValue {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error('useQuizContext must be used within QuizProvider');
  return ctx;
}
