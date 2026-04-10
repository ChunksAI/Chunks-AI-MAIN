'use client';

/**
 * contexts/StudyContext.tsx — central study session state
 *
 * Uses useReducer for synchronous state transitions and stable dispatch.
 * Async actions (sendMessage, generateFlashcards, generateQuiz, etc.) are
 * exposed as callback functions alongside dispatch so components can trigger
 * them without managing their own loading / error state.
 *
 * stateRef pattern: all async callbacks read state through a ref so they
 * never become stale without needing to be in dependency arrays.
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type Dispatch,
} from 'react';
import type {
  TabId,
  ChatMessage,
  WorkspaceSection,
  WorkspaceCard,
  Quiz,
  QuizAnswer,
  QuizResult,
  WeakArea,
  PerformanceEntry,
  NoteItem,
  RecentItem,
} from '@/types';
import { sendMessage, generateFlashcards, generateQuiz, uploadDocument } from '@/lib/studyApi';
import { useStudySession } from '@/hooks/useStudySession';
import type { MessageHistoryItem, SlideItem } from '@/types/api';

// ─── State shape ─────────────────────────────────────────────────────────────

export interface StudyState {
  sessionId: string;
  topic: string;

  // Uploaded document / selected library book
  slides: SlideItem[];
  docTitle: string;
  bookId: string | null;
  pdfBlobUrl: string | null;
  uploadLoading: boolean;
  uploadError: string | null;

  messages: ChatMessage[];
  chatLoading: boolean;
  chatError: string | null;

  workspaceSections: WorkspaceSection[];
  workspaceLoading: boolean;
  workspaceError: string | null;

  activeQuiz: Quiz | null;
  activeQuizAnswers: string[];
  quizResults: QuizResult[];

  weakAreas: WeakArea[];
  performanceHistory: PerformanceEntry[];
  studyInsights: string | null;

  activeTab: TabId;
  toast: string | null;
  showMemoryBar: boolean;
  notes: NoteItem[];
  recents: RecentItem[];
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type StudyAction =
  | { type: 'SEND_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_CHAT_LOADING'; payload: boolean }
  | { type: 'RECEIVE_MESSAGE'; payload: ChatMessage }
  | { type: 'MESSAGE_ERROR'; payload: string }
  | { type: 'CLEAR_CHAT_ERROR' }
  | { type: 'SET_WORKSPACE_LOADING'; payload: boolean }
  | { type: 'WORKSPACE_ERROR'; payload: string }
  | { type: 'CLEAR_WORKSPACE_ERROR' }
  | { type: 'ADD_WORKSPACE_CARD'; payload: { sectionTitle: string; card: WorkspaceCard } }
  | { type: 'UPDATE_WORKSPACE_CARD'; payload: { cardId: string; updates: Partial<WorkspaceCard> } }
  | { type: 'START_QUIZ'; payload: Quiz }
  | { type: 'ANSWER_QUESTION'; payload: { questionIndex: number; answer: string } }
  | { type: 'QUIZ_COMPLETED'; payload: QuizResult }
  | { type: 'CLOSE_QUIZ' }
  | { type: 'START_REVIEW' }
  | { type: 'SET_ACTIVE_TAB'; payload: TabId }
  | { type: 'SHOW_TOAST'; payload: string }
  | { type: 'CLEAR_TOAST' }
  | { type: 'DISMISS_MEMORY_BAR' }
  | { type: 'SHOW_MEMORY_BAR' }
  | { type: 'SET_TOPIC'; payload: string }
  | { type: 'SET_SLIDES'; payload: { slides: SlideItem[]; docTitle: string; bookId?: string | null } }
  | { type: 'SET_PDF_BLOB_URL'; payload: string | null }
  | { type: 'SET_UPLOAD_LOADING'; payload: boolean }
  | { type: 'UPLOAD_ERROR'; payload: string }
  | { type: 'CLEAR_UPLOAD_ERROR' }
  | { type: 'ADD_NOTE'; payload: NoteItem }
  | { type: 'UPDATE_NOTE'; payload: { id: string; title?: string; body?: string } }
  | { type: 'ADD_RECENT'; payload: RecentItem }
  | { type: 'SET_BOOK_ID'; payload: string | null }
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'SET_RECENTS'; payload: RecentItem[] };

// ─── Weak-area calculation ───────────────────────────────────────────────────

function calcWeakAreas(results: QuizResult[]): WeakArea[] {
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

// ─── Reducer ─────────────────────────────────────────────────────────────────

function studyReducer(state: StudyState, action: StudyAction): StudyState {
  switch (action.type) {
    case 'SEND_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        chatLoading: true,
        chatError: null,
      };

    case 'SET_CHAT_LOADING':
      return { ...state, chatLoading: action.payload };

    case 'RECEIVE_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        chatLoading: false,
        chatError: null,
      };

    case 'MESSAGE_ERROR':
      return { ...state, chatLoading: false, chatError: action.payload };

    case 'CLEAR_CHAT_ERROR':
      return { ...state, chatError: null };

    case 'SET_WORKSPACE_LOADING':
      return { ...state, workspaceLoading: action.payload };

    case 'WORKSPACE_ERROR':
      return { ...state, workspaceLoading: false, workspaceError: action.payload };

    case 'CLEAR_WORKSPACE_ERROR':
      return { ...state, workspaceError: null };

    case 'ADD_WORKSPACE_CARD': {
      const { sectionTitle, card } = action.payload;
      let found = false;
      const sections = state.workspaceSections.map((s) => {
        if (s.title !== sectionTitle) return s;
        found = true;
        if (s.cards.some((c) => c.id === card.id)) return s;
        return { ...s, cards: [...s.cards, card] };
      });
      if (!found) sections.push({ title: sectionTitle, cards: [card] });
      return { ...state, workspaceSections: sections, workspaceLoading: false };
    }

    case 'UPDATE_WORKSPACE_CARD': {
      const sections = state.workspaceSections.map((s) => ({
        ...s,
        cards: s.cards.map((c) =>
          c.id === action.payload.cardId ? { ...c, ...action.payload.updates } : c,
        ),
      }));
      return { ...state, workspaceSections: sections };
    }

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
      // Update the workspace card to reflect latest score
      const sections = state.workspaceSections.map((s) => ({
        ...s,
        cards: s.cards.map((c) => {
          if (c.id !== action.payload.quizId) return c;
          const danger = action.payload.score < 70;
          return {
            ...c,
            score: action.payload.score,
            attempts: (c.attempts ?? 0) + 1,
            stats: [
              { label: `Last score: ${action.payload.score}%` },
              ...(danger ? [{ label: 'Weak area', danger: true }] : []),
            ],
          };
        }),
      }));
      return {
        ...state,
        activeQuiz: null,
        activeQuizAnswers: [],
        quizResults: newResults,
        weakAreas: newWeakAreas,
        performanceHistory: [...state.performanceHistory, entry],
        workspaceSections: sections,
      };
    }

    case 'CLOSE_QUIZ':
      return { ...state, activeQuiz: null, activeQuizAnswers: [] };

    case 'START_REVIEW':
      return { ...state, activeTab: 'chat' };

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'SHOW_TOAST':
      return { ...state, toast: action.payload };

    case 'CLEAR_TOAST':
      return { ...state, toast: null };

    case 'DISMISS_MEMORY_BAR':
      return { ...state, showMemoryBar: false };

    case 'SHOW_MEMORY_BAR':
      return { ...state, showMemoryBar: true };
    case 'SET_TOPIC':
      return { ...state, topic: action.payload };

    case 'SET_SLIDES':
      return {
        ...state,
        slides: action.payload.slides,
        docTitle: action.payload.docTitle,
        bookId: action.payload.bookId ?? null,
        uploadLoading: false,
        uploadError: null,
      };

    case 'SET_PDF_BLOB_URL':
      return { ...state, pdfBlobUrl: action.payload };

    case 'SET_UPLOAD_LOADING':
      return { ...state, uploadLoading: action.payload, uploadError: null };

    case 'UPLOAD_ERROR':
      return { ...state, uploadLoading: false, uploadError: action.payload };

    case 'CLEAR_UPLOAD_ERROR':
      return { ...state, uploadError: null };

    case 'ADD_NOTE':
      return { ...state, notes: [...state.notes, action.payload] };

    case 'UPDATE_NOTE': {
      const now = new Date().toISOString();
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id !== action.payload.id
            ? n
            : {
                ...n,
                ...(action.payload.title !== undefined ? { title: action.payload.title } : {}),
                ...(action.payload.body !== undefined ? { body: action.payload.body } : {}),
                updatedAt: now,
              },
        ),
      };
    }

    case 'ADD_RECENT': {
      const filtered = state.recents.filter((r) => r.title !== action.payload.title);
      return { ...state, recents: [action.payload, ...filtered].slice(0, 5) };
    }

    case 'SET_BOOK_ID':
      return { ...state, bookId: action.payload };

    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };

    case 'SET_RECENTS':
      return { ...state, recents: action.payload };

    default:
      return state;
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: StudyState = {
  sessionId: '',
  topic: '',
  slides: [],
  docTitle: '',
  bookId: null,
  pdfBlobUrl: null,
  uploadLoading: false,
  uploadError: null,
  messages: [],
  chatLoading: false,
  chatError: null,
  workspaceSections: [],
  workspaceLoading: false,
  workspaceError: null,
  activeQuiz: null,
  activeQuizAnswers: [],
  quizResults: [],
  weakAreas: [],
  performanceHistory: [],
  studyInsights: null,
  activeTab: 'chat',
  toast: null,
  showMemoryBar: true,
  notes: [],
  recents: [],
};

// ─── Context value ────────────────────────────────────────────────────────────

interface StudyContextValue {
  state: StudyState;
  dispatch: Dispatch<StudyAction>;
  handleSendMessage: (
    text: string,
    opts?: { selectedText?: string; docContext?: string },
  ) => Promise<void>;
  handleGenerateFlashcards: (topic: string, count?: number) => Promise<void>;
  handleGenerateQuiz: (
    topic: string,
    count?: number,
    difficulty?: 'easy' | 'medium' | 'hard',
  ) => Promise<void>;
  handleStartQuiz: (quizId: string) => void;
  handleCompleteQuiz: () => void;
  handleStartReview: (weakAreaTopic?: string) => void;
  handleUploadDocument: (file: File) => Promise<void>;
  handleAddNote: () => void;
  showToast: (message: string) => void;
}

const StudyContext = createContext<StudyContextValue | null>(null);

// ─── Recents helpers ─────────────────────────────────────────────────────────

const RECENTS_KEY = 'chunks_v2_recents';
const RECENT_COLORS = ['#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#E91E63'];

function pickColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash * 31) + title.charCodeAt(i)) >>> 0;
  }
  return RECENT_COLORS[hash % RECENT_COLORS.length];
}

function loadRecentsFromStorage(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
}

// ─── Message ID counter ───────────────────────────────────────────────────────

let _msgCounter = 100;
function nextMsgId() {
  return `msg-${++_msgCounter}`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StudyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(studyReducer, INITIAL_STATE);

  // Keep a ref so stable callbacks can always read current state
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Initialise browser-only state after mount (avoids SSR/client mismatch) ─
  useEffect(() => {
    dispatch({ type: 'SET_SESSION_ID', payload: `session-${Date.now()}` });
    dispatch({ type: 'SET_RECENTS', payload: loadRecentsFromStorage() });
  }, []);

  const { saveSession } = useStudySession();

  // Track in-flight chat request so it can be cancelled on re-send
  const abortRef = useRef<AbortController | null>(null);

  // Track current blob URL so we can revoke it before creating a new one
  const blobUrlRef = useRef<string | null>(null);

  // ── Ref for handleSendMessage so handleStartReview can call it stably ──────
  const sendMessageRef = useRef<
    (text: string, opts?: { selectedText?: string; docContext?: string }) => Promise<void>
  >(() => Promise.resolve());

  // ── Auto-clear toast ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2800);
    return () => clearTimeout(t);
  }, [state.toast]);

  // ── Persist session when meaningful state changes ─────────────────────────
  useEffect(() => {
    if (state.messages.length === 0 && state.workspaceSections.length === 0) return;
    saveSession({
      topic: state.topic,
      lastAction: state.messages[state.messages.length - 1]?.role ?? null,
      quizScore: state.quizResults[state.quizResults.length - 1]?.score ?? null,
    });
  }, [
    state.topic,
    state.messages.length,
    state.workspaceSections.length,
    state.quizResults.length,
    saveSession,
  ]);

  // ── Persist recents to localStorage ──────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(state.recents));
    } catch {
      // ignore — storage may be unavailable
    }
  }, [state.recents]);

  // ── Revoke blob URL on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  // ── showToast ─────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string) => {
    dispatch({ type: 'SHOW_TOAST', payload: message });
  }, []);

  // ── sendMessage ───────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (text: string, opts: { selectedText?: string; docContext?: string } = {}) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const userMsg: ChatMessage = { id: nextMsgId(), role: 'user', text };
      dispatch({ type: 'SEND_MESSAGE', payload: userMsg });

      // Build history from current messages (last 10), stripping HTML tags
      const history: MessageHistoryItem[] = stateRef.current.messages.slice(-10).map((m) => ({
        role: (m.role === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.text.replace(/<[^>]+>/g, ''),
      }));

      // Auto-populate doc_context from uploaded slides when not explicitly provided
      const { slides } = stateRef.current;
      const autoDocContext =
        slides.length > 0
          ? slides
              .map((s) => [s.title, ...s.content].join('\n'))
              .join('\n\n')
              .slice(0, 4000)
          : '';

      try {
        const res = await sendMessage({
          question: text,
          history,
          selected_text: opts.selectedText ?? '',
          doc_context: opts.docContext ?? autoDocContext,
          mode: 'study',
          bookId: stateRef.current.bookId ?? undefined,
        });

        const aiMsg: ChatMessage = {
          id: nextMsgId(),
          role: 'ai',
          text: res.answer,
          memoryRecall: res.memory_recall ?? undefined,
          performanceBars: res.performance_bars ?? [],
          actions: [
            { label: '🃏 Generate flashcards', actionKey: 'flashcards' },
            { label: '🎯 Quiz me on this', actionKey: 'quiz' },
          ],
        };
        dispatch({ type: 'RECEIVE_MESSAGE', payload: aiMsg });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const message =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        dispatch({ type: 'MESSAGE_ERROR', payload: message });
      }
    },
    [], // stable — reads state through stateRef
  );

  // Keep ref in sync so handleStartReview can always use the latest version
  useEffect(() => {
    sendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  // ── generateFlashcards ────────────────────────────────────────────────────
  const handleGenerateFlashcards = useCallback(async (topic: string, count = 10) => {
    dispatch({ type: 'SET_WORKSPACE_LOADING', payload: true });
    dispatch({ type: 'SHOW_TOAST', payload: '🃏 Generating flashcards…' });

    try {
      const res = await generateFlashcards({
        topic,
        count,
        bookId: stateRef.current.bookId ?? undefined,
      });
      const cardId = `fc-${Date.now()}`;
      const card: WorkspaceCard = {
        id: cardId,
        type: 'flashcards',
        title: `${topic} — Flashcards`,
        meta: `${res.flashcards.length} cards · AI-generated`,
        stats: [{ label: `${res.flashcards.length} cards` }],
        flashcards: res.flashcards,
      };
      dispatch({ type: 'ADD_WORKSPACE_CARD', payload: { sectionTitle: 'Flashcard Decks', card } });
      dispatch({ type: 'SET_TOPIC', payload: topic });
      dispatch({
        type: 'ADD_RECENT',
        payload: { id: cardId, title: topic, color: pickColor(topic) },
      });
      dispatch({
        type: 'SHOW_TOAST',
        payload: `🃏 ${res.flashcards.length} flashcards added to Workspace!`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate flashcards.';
      dispatch({ type: 'WORKSPACE_ERROR', payload: message });
      dispatch({ type: 'SHOW_TOAST', payload: `❌ ${message}` });
    }
  }, []);

  // ── generateQuiz ──────────────────────────────────────────────────────────
  const handleGenerateQuiz = useCallback(
    async (topic: string, count = 10, difficulty: 'easy' | 'medium' | 'hard' = 'medium') => {
      // When no document is uploaded there are no slides to send to /generate-quiz.
      // Fall back to /ask so the AI generates the quiz as a chat response instead.
      if (stateRef.current.slides.length === 0) {
        dispatch({ type: 'SET_ACTIVE_TAB', payload: 'chat' });
        void sendMessageRef.current(
          `Generate a ${count}-question ${difficulty} multiple choice quiz on "${topic}".`,
        );
        return;
      }

      dispatch({ type: 'SET_WORKSPACE_LOADING', payload: true });
      dispatch({ type: 'SHOW_TOAST', payload: '🎯 Generating quiz…' });

      try {
        const slides = stateRef.current.slides;
        const res = await generateQuiz({ slides, count, difficulty });
        const cardId = `quiz-${Date.now()}`;
        const card: WorkspaceCard = {
          id: cardId,
          type: 'quiz',
          title: `${topic} — Quiz`,
          meta: `${res.questions.length} questions · ${difficulty}`,
          stats: [{ label: '—' }],
          questions: res.questions,
        };
        dispatch({ type: 'ADD_WORKSPACE_CARD', payload: { sectionTitle: 'Quizzes', card } });
        dispatch({ type: 'SET_TOPIC', payload: topic });
        dispatch({
          type: 'ADD_RECENT',
          payload: { id: cardId, title: topic, color: pickColor(topic) },
        });
        dispatch({
          type: 'SHOW_TOAST',
          payload: `🎯 ${res.questions.length}-question quiz added to Workspace!`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate quiz.';
        dispatch({ type: 'WORKSPACE_ERROR', payload: message });
        dispatch({ type: 'SHOW_TOAST', payload: `❌ ${message}` });
      }
    },
    [],
  );

  // ── uploadDocument ────────────────────────────────────────────────────────
  const handleUploadDocument = useCallback(async (file: File) => {
    // Reject non-PDF files before touching blob URLs or the network
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      dispatch({ type: 'UPLOAD_ERROR', payload: 'Only PDF files are supported.' });
      dispatch({ type: 'SHOW_TOAST', payload: '❌ Only PDF files are supported.' });
      return;
    }

    // Revoke the previous blob URL to free browser memory
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    // Create a blob URL immediately so ContentPanel can show the real PDF
    const blobUrl = URL.createObjectURL(file);
    blobUrlRef.current = blobUrl;
    dispatch({ type: 'SET_PDF_BLOB_URL', payload: blobUrl });

    dispatch({ type: 'SET_UPLOAD_LOADING', payload: true });
    dispatch({ type: 'SHOW_TOAST', payload: '📄 Uploading document…' });

    try {
      const res = await uploadDocument(file);
      const docTitle = res.filename.replace(/\.[^.]+$/, ''); // strip extension
      dispatch({ type: 'SET_SLIDES', payload: { slides: res.slides, docTitle } });
      dispatch({ type: 'SET_TOPIC', payload: docTitle });
      dispatch({
        type: 'ADD_RECENT',
        payload: { id: `doc-${Date.now()}`, title: docTitle, color: pickColor(docTitle) },
      });
      dispatch({
        type: 'SHOW_TOAST',
        payload: `✅ "${docTitle}" loaded — ${res.total_slides} pages ready`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      dispatch({ type: 'UPLOAD_ERROR', payload: message });
      dispatch({ type: 'SHOW_TOAST', payload: `❌ ${message}` });
    }
  }, []);

  // ── startQuiz ─────────────────────────────────────────────────────────────
  const handleStartQuiz = useCallback((quizId: string) => {
    const { workspaceSections } = stateRef.current;
    for (const section of workspaceSections) {
      for (const card of section.cards) {
        if (card.id === quizId && card.questions) {
          const quiz: Quiz = {
            id: card.id,
            title: card.title,
            questions: card.questions,
            difficulty: card.meta.split('·')[1]?.trim() ?? 'medium',
          };
          dispatch({ type: 'START_QUIZ', payload: quiz });
          return;
        }
      }
    }
  }, []);

  // ── completeQuiz ──────────────────────────────────────────────────────────
  const handleCompleteQuiz = useCallback(() => {
    const { activeQuiz, activeQuizAnswers, topic } = stateRef.current;
    if (!activeQuiz) return;

    const answers: QuizAnswer[] = activeQuiz.questions.map((q, i) => {
      const selected = activeQuizAnswers[i] ?? '';
      return {
        questionIndex: i,
        selectedAnswer: selected,
        isCorrect: selected === q.answer,
      };
    });

    const correct = answers.filter((a) => a.isCorrect).length;
    const score = Math.round((correct / activeQuiz.questions.length) * 100);

    const result: QuizResult = {
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      score,
      totalQuestions: activeQuiz.questions.length,
      correctAnswers: correct,
      answers,
      completedAt: new Date().toISOString(),
      topic: topic || activeQuiz.title,
    };

    dispatch({ type: 'QUIZ_COMPLETED', payload: result });

    // Score-based recovery toast (matches studySession.js logic from old system)
    if (score < 50) {
      dispatch({ type: 'SHOW_TOAST', payload: '📚 Score < 50% — review flashcards first!' });
    } else if (score < 80) {
      dispatch({
        type: 'SHOW_TOAST',
        payload: `📊 Score: ${score}% — try again to improve!`,
      });
    } else {
      dispatch({
        type: 'SHOW_TOAST',
        payload: `🏆 Score: ${score}% — great job! You're ready for the exam!`,
      });
    }
  }, []);

  // ── startReview ───────────────────────────────────────────────────────────
  const handleStartReview = useCallback((weakAreaTopic?: string) => {
    dispatch({ type: 'START_REVIEW' });
    if (weakAreaTopic) {
      // Fire after tab switch animation to avoid racing the state update
      setTimeout(() => {
        void sendMessageRef.current(
          `Help me review "${weakAreaTopic}". I scored poorly on this topic and need to understand it better.`,
        );
      }, 100);
    }
  }, []);

  // ── addNote ───────────────────────────────────────────────────────────────
  const handleAddNote = useCallback(() => {
    const now = new Date().toISOString();
    const note: NoteItem = {
      id: `note-${Date.now()}`,
      title: 'New Note',
      body: '',
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: 'ADD_NOTE', payload: note });
  }, []);

  const value: StudyContextValue = {
    state,
    dispatch,
    handleSendMessage,
    handleGenerateFlashcards,
    handleGenerateQuiz,
    handleStartQuiz,
    handleCompleteQuiz,
    handleStartReview,
    handleUploadDocument,
    handleAddNote,
    showToast,
  };

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStudy(): StudyContextValue {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error('useStudy must be used within StudyProvider');
  return ctx;
}
