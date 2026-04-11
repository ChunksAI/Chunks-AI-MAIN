'use client';

/**
 * contexts/ExamContext.tsx — full exam session state
 *
 * Completely separate from StudyContext. Handles concept extraction,
 * per-concept question generation, timer ticking, answer tracking,
 * flagging, and result calculation.
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { ConceptChunk, ExamQuestion, ExamResult, ExamConfig } from '@/types/exam';
import { extractConceptsFromSlides, generateConceptQuestions } from '@/lib/examApi';
import { PASS_THRESHOLD } from '@/lib/constants';

// ─── State ────────────────────────────────────────────────────────────────────

export interface ExamState {
  phase: 'setup' | 'running' | 'results';
  config: ExamConfig;
  concepts: ConceptChunk[];
  questions: ExamQuestion[];
  answers: Record<number, string>;
  flagged: Set<number>;
  currentIndex: number;
  timeRemaining: number;
  loading: boolean;
  error: string | null;
  result: ExamResult | null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type ExamAction =
  | { type: 'SET_CONFIG'; payload: Partial<ExamConfig> }
  | { type: 'SET_CONCEPTS'; payload: ConceptChunk[] }
  | { type: 'ADD_CONCEPT'; payload: ConceptChunk }
  | { type: 'SET_QUESTIONS'; payload: ExamQuestion[] }
  | { type: 'START_EXAM' }
  | { type: 'ANSWER_QUESTION'; payload: { index: number; key: string } }
  | { type: 'FLAG_QUESTION'; payload: number }
  | { type: 'SET_CURRENT'; payload: number }
  | { type: 'TICK' }
  | { type: 'SUBMIT_EXAM'; payload: ExamResult }
  | { type: 'RESET_EXAM' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ExamConfig = {
  questionCount: 25,
  timeLimit: 60 * 60, // 60 minutes in seconds
  difficulty: 'mixed',
  source: 'topic',
  topic: '',
};

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: ExamState = {
  phase: 'setup',
  config: DEFAULT_CONFIG,
  concepts: [],
  questions: [],
  answers: {},
  flagged: new Set(),
  currentIndex: 0,
  timeRemaining: DEFAULT_CONFIG.timeLimit,
  loading: false,
  error: null,
  result: null,
};

// ─── Reducer ─────────────────────────────────────────────────────────────────

function examReducer(state: ExamState, action: ExamAction): ExamState {
  switch (action.type) {
    case 'SET_CONFIG':
      return {
        ...state,
        config: { ...state.config, ...action.payload },
        // Keep timeRemaining in sync if timeLimit changed
        ...(action.payload.timeLimit !== undefined
          ? { timeRemaining: action.payload.timeLimit }
          : {}),
      };

    case 'SET_CONCEPTS':
      return { ...state, concepts: action.payload };

    case 'ADD_CONCEPT':
      return { ...state, concepts: [...state.concepts, action.payload] };

    case 'SET_QUESTIONS':
      return { ...state, questions: action.payload };

    case 'START_EXAM':
      return {
        ...state,
        phase: 'running',
        loading: false,
        error: null,
        answers: {},
        flagged: new Set(),
        currentIndex: 0,
        timeRemaining: state.config.timeLimit,
      };

    case 'ANSWER_QUESTION':
      return {
        ...state,
        answers: { ...state.answers, [action.payload.index]: action.payload.key },
      };

    case 'FLAG_QUESTION': {
      const flagged = new Set(state.flagged);
      if (flagged.has(action.payload)) {
        flagged.delete(action.payload);
      } else {
        flagged.add(action.payload);
      }
      return { ...state, flagged };
    }

    case 'SET_CURRENT':
      return { ...state, currentIndex: action.payload };

    case 'TICK':
      return {
        ...state,
        timeRemaining: Math.max(0, state.timeRemaining - 1),
      };

    case 'SUBMIT_EXAM':
      return {
        ...state,
        phase: 'results',
        result: action.payload,
        loading: false,
      };

    case 'RESET_EXAM':
      return {
        ...INITIAL_STATE,
        config: state.config, // keep the last config for "Retake"
        timeRemaining: state.config.timeLimit,
      };

    case 'SET_LOADING':
      return { ...state, loading: action.payload, error: null };

    case 'SET_ERROR':
      return { ...state, loading: false, error: action.payload };

    default:
      return state;
  }
}

// ─── Context value ────────────────────────────────────────────────────────────

interface ExamContextValue {
  state: ExamState;
  dispatch: Dispatch<ExamAction>;
  handleStartExam: (slides: { slide_number?: number; title: string; content: string[]; notes?: string }[]) => Promise<void>;
  handleSubmitExam: () => void;
  handleAnswer: (index: number, key: string) => void;
  handleFlag: (index: number) => void;
  handleNavigate: (index: number) => void;
}

const ExamContext = createContext<ExamContextValue | null>(null);

// ─── Result calculation ───────────────────────────────────────────────────────

function calcResult(
  questions: ExamQuestion[],
  answers: Record<number, string>,
  concepts: ConceptChunk[],
  timeUsed: number,
): ExamResult {
  const conceptMap = new Map<string, { concept: string; total: number; correct: number }>();

  for (const c of concepts) {
    conceptMap.set(c.id, { concept: c.concept, total: 0, correct: 0 });
  }

  let correct = 0;
  questions.forEach((q, idx) => {
    const entry = conceptMap.get(q.conceptId);
    const isCorrect = answers[idx] === q.answer;
    if (isCorrect) correct++;
    if (entry) {
      entry.total++;
      if (isCorrect) entry.correct++;
    }
  });

  const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

  const conceptBreakdown = Array.from(conceptMap.values())
    .filter((c) => c.total > 0)
    .map((c) => ({
      concept: c.concept,
      total: c.total,
      correct: c.correct,
      score: c.total > 0 ? Math.round((c.correct / c.total) * 100) : 0,
    }))
    .sort((a, b) => a.score - b.score);

  const weakConcepts = conceptBreakdown
    .filter((c) => c.score < 60)
    .map((c) => c.concept);

  return {
    score,
    passed: score >= PASS_THRESHOLD,
    passThreshold: PASS_THRESHOLD,
    totalQuestions: questions.length,
    correctAnswers: correct,
    timeUsed,
    conceptBreakdown,
    weakConcepts,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ExamProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(examReducer, INITIAL_STATE);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Track when the exam started for timeUsed calculation
  const startTimeRef = useRef<number>(0);

  // ── handleAnswer ────────────────────────────────────────────────────────────
  const handleAnswer = useCallback((index: number, key: string) => {
    dispatch({ type: 'ANSWER_QUESTION', payload: { index, key } });
  }, []);

  // ── handleFlag ──────────────────────────────────────────────────────────────
  const handleFlag = useCallback((index: number) => {
    dispatch({ type: 'FLAG_QUESTION', payload: index });
  }, []);

  // ── handleNavigate ───────────────────────────────────────────────────────────
  const handleNavigate = useCallback((index: number) => {
    dispatch({ type: 'SET_CURRENT', payload: index });
  }, []);

  // ── handleSubmitExam ────────────────────────────────────────────────────────
  const handleSubmitExam = useCallback(() => {
    const { questions, answers, concepts, config } = stateRef.current;
    const timeUsed = config.timeLimit - stateRef.current.timeRemaining;
    const result = calcResult(questions, answers, concepts, timeUsed);
    dispatch({ type: 'SUBMIT_EXAM', payload: result });
  }, []);

  // ── handleStartExam ─────────────────────────────────────────────────────────
  const handleStartExam = useCallback(async (
    slides: { slide_number?: number; title: string; content: string[]; notes?: string }[],
  ) => {
    const { config } = stateRef.current;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_CONCEPTS', payload: [] });
    dispatch({ type: 'SET_QUESTIONS', payload: [] });

    try {
      // Step 1 — extract concept chunks client-side from slide titles (no API call)
      const concepts = extractConceptsFromSlides(
        slides,
        Math.ceil(config.questionCount / 3),
      );

      dispatch({ type: 'SET_CONCEPTS', payload: concepts });

      if (concepts.length === 0) {
        dispatch({ type: 'SET_ERROR', payload: 'Could not extract concepts from the document. Please try a different source.' });
        return;
      }

      // Step 2 — generate questions per concept sequentially to avoid rate limits
      const effectiveDifficulty =
        config.difficulty === 'mixed'
          ? (['easy', 'medium', 'hard'] as const)[Math.floor(Math.random() * 3)]
          : config.difficulty;

      const questionsPerConcept = Math.max(1, Math.ceil(config.questionCount / concepts.length));
      const allQuestions: ExamQuestion[] = [];

      for (const concept of concepts) {
        const { questions } = await generateConceptQuestions({
          concept: concept.concept,
          summary: concept.summary,
          slides,
          slideRefs: concept.slideRefs,
          count: questionsPerConcept,
          difficulty: effectiveDifficulty,
        });

        // Tag each question with the concept info it came from
        const tagged = questions.map((q, i) => ({
          ...q,
          id: q.id || `${concept.id}-q${i}`,
          conceptId: concept.id,
          conceptLabel: concept.concept,
        }));

        allQuestions.push(...tagged);
      }

      // Trim to exact questionCount requested
      const finalQuestions = allQuestions.slice(0, config.questionCount);

      dispatch({ type: 'SET_QUESTIONS', payload: finalQuestions });

      startTimeRef.current = Date.now();
      dispatch({ type: 'START_EXAM' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate exam. Please try again.';
      dispatch({ type: 'SET_ERROR', payload: message });
    }
  }, []);

  const value: ExamContextValue = {
    state,
    dispatch,
    handleStartExam,
    handleSubmitExam,
    handleAnswer,
    handleFlag,
    handleNavigate,
  };

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useExam(): ExamContextValue {
  const ctx = useContext(ExamContext);
  if (!ctx) throw new Error('useExam must be used within ExamProvider');
  return ctx;
}
