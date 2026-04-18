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
 *
 * Chat state (messages, chatLoading, chatError, lastUserMessage, chatMode)
 * lives in ChatContext.  Quiz state (activeQuiz, quizResults, weakAreas, etc.)
 * lives in QuizContext.  Notes/todo state lives in NotesContext.  StudyProvider
 * consumes all three and merges them into the value it exposes so all existing
 * useStudy() consumers are backward-compatible without any changes.
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
  TodoItem,
  AnyNote,
  RecentItem,
} from '@/types';
import { useChatContext, type ChatState, type ChatAction } from '@/contexts/ChatContext';
import { useQuizContext, type QuizState, type QuizAction, calcWeakAreas } from '@/contexts/QuizContext';
import { useNotesContext, type NotesState, type NotesAction } from '@/contexts/NotesContext';
import { useViewerContext, buildViewerState } from '@/contexts/ViewerContext';
import { sendMessage, sendMessageStream, cancelAsk, generateFlashcards, generateQuiz, uploadDocument, topicToSlides, checkPaevStatus, getStreamBuffer } from '@/lib/studyApi';
import { useStudySession } from '@/hooks/useStudySession';
import type { MessageHistoryItem, SlideItem } from '@/types/api';
import {
  MAX_HISTORY_ITEMS,
  MAX_DOC_CONTEXT_CHARS,
  TOAST_DURATION_MS,
  DEFAULT_FLASHCARD_COUNT,
  DEFAULT_QUIZ_COUNT,
  SESSION_TTL_DAYS,
  MAX_RECENTS,
  SESSION_STORAGE_KEY,
} from '@/lib/constants';
import { CURRENT_STORAGE_VERSION, migrateSnapshotIfNeeded, type VersionedSnapshot } from '@/lib/storageVersion';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip HTML tags from a string using DOMParser (browser) for accuracy. */
function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  try {
    return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  } catch {
    // Fallback: remove tag-like sequences
    return html.replace(/<[^>]*>/g, '');
  }
}

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

  // Chat fields (messages, chatLoading, chatError, lastUserMessage, chatMode)
  // are owned by ChatContext.  Quiz fields (activeQuiz, quizResults, weakAreas,
  // performanceHistory, studyInsights) are owned by QuizContext.  Notes/todos
  // are owned by NotesContext.  All three are merged into the value exposed by
  // useStudy() so that existing consumers remain backward-compatible.

  workspaceSections: WorkspaceSection[];
  workspaceLoading: boolean;
  workspaceError: string | null;

  activeTab: TabId;
  toast: string | null;
  showMemoryBar: boolean;
  recents: RecentItem[];

  /** Active personalised review session, null when none is running. */
  reviewSession: ReviewSessionState | null;
}

// ─── Review session types ─────────────────────────────────────────────────────

export type ReviewStep = 'explain' | 'flashcards' | 'quiz' | 'result';

export interface ReviewSessionState {
  active: boolean;
  topic: string;
  step: ReviewStep;
  /** Overall progress 0–100 for the progress bar. */
  progress: number;
  /** Final quiz score 0–100. */
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  /** Unix timestamp when the session started (Date.now()). */
  startedAt: number;
  /** AI-generated explanation markdown text, empty while loading. */
  explanationText: string;
  flashcardsReady: boolean;
  quizReady: boolean;
}

// ─── Restore session payload ──────────────────────────────────────────────────

export interface RestoreSessionPayload {
  messages: ChatMessage[];
  workspaceSections: WorkspaceSection[];
  quizResults: QuizResult[];
  weakAreas: WeakArea[];
  performanceHistory: PerformanceEntry[];
  notes: AnyNote[];
  topic: string;
  docTitle: string;
  bookId: string | null;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type StudyAction =
  | { type: 'SET_WORKSPACE_LOADING'; payload: boolean }
  | { type: 'WORKSPACE_ERROR'; payload: string }
  | { type: 'CLEAR_WORKSPACE_ERROR' }
  | { type: 'ADD_WORKSPACE_CARD'; payload: { sectionTitle: string; card: WorkspaceCard } }
  | { type: 'UPDATE_WORKSPACE_CARD'; payload: { cardId: string; updates: Partial<WorkspaceCard> } }
  /**
   * QUIZ_COMPLETED remains in StudyAction so the study reducer can update the
   * workspace card score. The quiz-state update (quizResults, weakAreas, etc.)
   * is handled by QuizContext's QUIZ_COMPLETED case via quizDispatch.
   */
  | { type: 'QUIZ_COMPLETED'; payload: QuizResult }
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
  | { type: 'ADD_RECENT'; payload: RecentItem }
  | { type: 'SET_BOOK_ID'; payload: string | null }
  | { type: 'SET_BOOK'; payload: { bookId: string; docTitle: string; pdfUrl: string } }
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'SET_RECENTS'; payload: RecentItem[] }
  | { type: 'RESET_SESSION' }
  | { type: 'START_REVIEW_SESSION'; payload: { topic: string } }
  | { type: 'SET_REVIEW_STEP'; payload: ReviewStep }
  | { type: 'UPDATE_REVIEW_PROGRESS'; payload: number }
  | { type: 'SET_REVIEW_EXPLANATION'; payload: string }
  | { type: 'SET_REVIEW_FLASHCARDS_READY' }
  | { type: 'SET_REVIEW_QUIZ_READY' }
  | { type: 'RESET_REVIEW_QUIZ_READY' }
  | { type: 'COMPLETE_REVIEW_QUIZ'; payload: { score: number; correct: number; total: number } }
  | { type: 'END_REVIEW_SESSION' }
  | { type: 'RESTORE_SESSION'; payload: RestoreSessionPayload };

// ─── Reducer ─────────────────────────────────────────────────────────────────

function studyReducer(state: StudyState, action: StudyAction): StudyState {
  switch (action.type) {
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
    case 'QUIZ_COMPLETED': {
      // Only update the workspace card score — quiz state (quizResults, weakAreas,
      // performanceHistory, activeQuiz) is handled by QuizContext via quizDispatch.
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
      return { ...state, workspaceSections: sections };
    }

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

    case 'ADD_RECENT': {
      const filtered = state.recents.filter((r) => r.title !== action.payload.title);
      return { ...state, recents: [action.payload, ...filtered].slice(0, 5) };
    }

    case 'SET_BOOK_ID':
      return { ...state, bookId: action.payload };

    case 'SET_BOOK':
      return {
        ...state,
        bookId: action.payload.bookId,
        docTitle: action.payload.docTitle,
        pdfBlobUrl: action.payload.pdfUrl,
        slides: [],
        uploadLoading: false,
        uploadError: null,
      };

    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };

    case 'SET_RECENTS':
      return { ...state, recents: action.payload };

    case 'RESET_SESSION':
      return {
        ...INITIAL_STATE,
        sessionId: `session-${Date.now()}`,
        // Preserve recents so the sidebar history doesn't disappear
        recents: state.recents,
      };

    case 'START_REVIEW_SESSION':
      return {
        ...state,
        reviewSession: {
          active: true,
          topic: action.payload.topic,
          step: 'explain',
          progress: 0,
          score: 0,
          totalQuestions: 0,
          correctAnswers: 0,
          startedAt: Date.now(),
          explanationText: '',
          flashcardsReady: false,
          quizReady: false,
        },
      };

    case 'SET_REVIEW_STEP': {
      if (!state.reviewSession) return state;
      const stepProgress: Record<ReviewStep, number> = {
        explain: 10,
        flashcards: 40,
        quiz: 70,
        result: 100,
      };
      return {
        ...state,
        reviewSession: {
          ...state.reviewSession,
          step: action.payload,
          progress: stepProgress[action.payload],
        },
      };
    }

    case 'UPDATE_REVIEW_PROGRESS':
      if (!state.reviewSession) return state;
      return {
        ...state,
        reviewSession: { ...state.reviewSession, progress: action.payload },
      };

    case 'SET_REVIEW_EXPLANATION':
      if (!state.reviewSession) return state;
      return {
        ...state,
        reviewSession: { ...state.reviewSession, explanationText: action.payload },
      };

    case 'SET_REVIEW_FLASHCARDS_READY':
      if (!state.reviewSession) return state;
      return {
        ...state,
        reviewSession: { ...state.reviewSession, flashcardsReady: true },
      };

    case 'SET_REVIEW_QUIZ_READY':
      if (!state.reviewSession) return state;
      return {
        ...state,
        reviewSession: { ...state.reviewSession, quizReady: true },
      };

    case 'RESET_REVIEW_QUIZ_READY':
      if (!state.reviewSession) return state;
      return {
        ...state,
        reviewSession: { ...state.reviewSession, quizReady: false },
      };

    case 'COMPLETE_REVIEW_QUIZ':
      if (!state.reviewSession) return state;
      return {
        ...state,
        reviewSession: {
          ...state.reviewSession,
          score: action.payload.score,
          correctAnswers: action.payload.correct,
          totalQuestions: action.payload.total,
        },
      };

    case 'END_REVIEW_SESSION':
      return { ...state, reviewSession: null };

    case 'RESTORE_SESSION':
      // Note: messages are restored via chatDispatch({ type: 'RESTORE_MESSAGES' }),
      // quiz state via quizDispatch({ type: 'RESTORE_QUIZ' }), and notes via
      // notesDispatch({ type: 'RESTORE_NOTES' }) in StudyProvider's mergedDispatch.
      return {
        ...state,
        workspaceSections: action.payload.workspaceSections,
        topic: action.payload.topic,
        docTitle: action.payload.docTitle,
        bookId: action.payload.bookId,
      };

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
  workspaceSections: [],
  workspaceLoading: false,
  workspaceError: null,
  activeTab: 'chat',
  toast: null,
  showMemoryBar: true,
  recents: [],
  reviewSession: null,
};

// ─── Context value ────────────────────────────────────────────────────────────

/**
 * The state exposed through useStudy() merges the study-only slice with the
 * chat, quiz, and notes slices from their respective contexts so that all
 * existing consumers remain backward-compatible (they can still read
 * state.messages, state.activeQuiz, state.notes, etc. without any changes).
 */
type MergedStudyState = StudyState & ChatState & QuizState & NotesState;

interface StudyContextValue {
  state: MergedStudyState;
  /**
   * Merged dispatch: routes chat actions to ChatContext, quiz actions to
   * QuizContext, notes actions to NotesContext, and study actions to
   * StudyContext.  RESTORE_SESSION is a special case — it dispatches to all
   * four, automatically restoring each slice from the snapshot.
   */
  dispatch: Dispatch<StudyAction | ChatAction | QuizAction | NotesAction>;
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
  handleCreateNote: () => void;
  handleCreateTodo: (title: string, items: string[]) => void;
  handleResetSession: () => void;
  handleStop: () => void;
  showToast: (message: string) => void;
  handleStartReviewSession: (topic?: string) => Promise<void>;
  handleAdvanceReviewStep: () => void;
  handleEndReviewSession: () => void;
  handleCompleteReviewQuiz: (score: number, correct: number, total: number) => void;
  /** Restore the slides and PDF blob URL for a previously-uploaded document. */
  handleRestoreDocument: (docTitle: string) => Promise<void>;
}

const StudyContext = createContext<StudyContextValue | null>(null);

// ─── Session-storage helpers (slides persistence) ─────────────────────────────

const SLIDES_STORAGE_KEY = 'chunks_v2_slides';

interface PersistedSlides {
  slides: SlideItem[];
  docTitle: string;
  bookId: string | null;
}

/** Safe per-document localStorage key for slides. Uses encodeURIComponent to avoid collisions. */
function slidesStorageKey(docTitle: string): string {
  return `chunks_v2_slides_doc_${encodeURIComponent(docTitle)}`;
}

function persistSlidesToStorage(data: PersistedSlides): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify(data);
    // Write to per-doc key so each document's slides survive independently
    localStorage.setItem(slidesStorageKey(data.docTitle), payload);
    // Also keep the legacy single-slot key in sync for backward compat
    localStorage.setItem(SLIDES_STORAGE_KEY, payload);
  } catch {
    // ignore — storage may be unavailable or quota exceeded
  }
}

function loadSlidesFromStorage(docTitle?: string): PersistedSlides | null {
  if (typeof window === 'undefined') return null;
  try {
    // Try per-doc key first (most accurate when multiple docs are uploaded)
    if (docTitle) {
      const perDocRaw = localStorage.getItem(slidesStorageKey(docTitle));
      if (perDocRaw) {
        const perDocParsed = JSON.parse(perDocRaw) as unknown;
        if (
          perDocParsed !== null &&
          typeof perDocParsed === 'object' &&
          Array.isArray((perDocParsed as PersistedSlides).slides) &&
          typeof (perDocParsed as PersistedSlides).docTitle === 'string'
        ) {
          return perDocParsed as PersistedSlides;
        }
      }
    }
    // Fall back to legacy single-slot key
    const raw = localStorage.getItem(SLIDES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as PersistedSlides).slides) &&
      typeof (parsed as PersistedSlides).docTitle === 'string'
    ) {
      // If a specific docTitle was requested, only return if it matches
      if (docTitle && (parsed as PersistedSlides).docTitle !== docTitle) return null;
      return parsed as PersistedSlides;
    }
    return null;
  } catch {
    return null;
  }
}

function clearSlidesFromStorage(docTitle?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SLIDES_STORAGE_KEY);
    if (docTitle) localStorage.removeItem(slidesStorageKey(docTitle));
  } catch {
    // ignore
  }
}

// ─── IndexedDB helpers (PDF file persistence across refreshes) ───────────────

const IDB_DB_NAME = 'chunks_v2';
const IDB_STORE_NAME = 'files';
const IDB_PDF_KEY = 'chunks_v2_pdf_file';

/** Safe per-document IDB key for PDF files. Uses encodeURIComponent to avoid collisions. */
function pdfIdbKey(docTitle: string): string {
  return `chunks_v2_pdf_doc_${encodeURIComponent(docTitle)}`;
}

function openPdfDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePdfToIdb(file: File, docTitle?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openPdfDb();
    const keys: string[] = [IDB_PDF_KEY];
    // Also store under a per-doc key so multiple documents can be retrieved
    if (docTitle) keys.push(pdfIdbKey(docTitle));
    await Promise.all(
      keys.map(
        (key) =>
          new Promise<void>((resolve, reject) => {
            const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
            const req = tx.objectStore(IDB_STORE_NAME).put(file, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          }),
      ),
    );
  } catch {
    // ignore — IndexedDB may be unavailable (private browsing, storage quota)
  }
}

async function loadPdfFromIdb(docTitle?: string): Promise<File | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await openPdfDb();
    // Try per-doc key first when a docTitle is provided
    const keys = docTitle ? [pdfIdbKey(docTitle), IDB_PDF_KEY] : [IDB_PDF_KEY];
    for (const key of keys) {
      const file = await new Promise<File | null>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readonly');
        const req = tx.objectStore(IDB_STORE_NAME).get(key);
        req.onsuccess = () => {
          const result = req.result as unknown;
          resolve(result instanceof File ? result : null);
        };
        req.onerror = () => reject(req.error);
      });
      if (file) return file;
    }
    return null;
  } catch {
    return null;
  }
}

async function clearPdfFromIdb(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openPdfDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const req = tx.objectStore(IDB_STORE_NAME).delete(IDB_PDF_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

// ─── My Documents helpers (Library "My Documents" section) ───────────────────

export const MY_DOCS_STORAGE_KEY = 'chunks_v2_my_docs';

export interface MyDocMeta {
  docTitle: string;
  filename: string;
  uploadedAt: string;
}

function loadMyDocsFromStorage(): MyDocMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MY_DOCS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as MyDocMeta[];
    return [];
  } catch {
    return [];
  }
}

function appendMyDocToStorage(meta: MyDocMeta): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadMyDocsFromStorage();
    // Deduplicate by filename — move the latest upload to the front
    const deduped = existing.filter((d) => d.filename !== meta.filename);
    localStorage.setItem(MY_DOCS_STORAGE_KEY, JSON.stringify([meta, ...deduped]));
  } catch {
    // ignore — storage may be unavailable or quota exceeded
  }
}

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

// ─── Session snapshot persistence (localStorage, 7-day TTL) ──────────────────

function saveSessionSnapshot(sessionId: string, state: MergedStudyState): void {
  if (typeof window === 'undefined' || !sessionId) return;
  try {
    const snapshot: VersionedSnapshot = {
      version: CURRENT_STORAGE_VERSION,
      messages: state.messages.slice(-20),
      workspaceSections: state.workspaceSections,
      quizResults: state.quizResults,
      weakAreas: state.weakAreas,
      performanceHistory: state.performanceHistory,
      notes: state.notes,
      topic: state.topic,
      docTitle: state.docTitle,
      bookId: state.bookId,
      recents: state.recents,
      expiresAt: Date.now() + SESSION_TTL_DAYS * 86_400_000,
    };
    localStorage.setItem(`${SESSION_STORAGE_KEY}_${sessionId}`, JSON.stringify(snapshot));
  } catch {
    // Ignore quota errors — persistence is best-effort
  }
}

function loadLatestSessionSnapshot(): VersionedSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const prefix = `${SESSION_STORAGE_KEY}_`;
    let latest: VersionedSnapshot | null = null;
    const keysToDelete: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as unknown;
      const snap = migrateSnapshotIfNeeded(parsed);
      if (!snap) {
        // Corrupt or from a future version — remove it
        keysToDelete.push(key);
        continue;
      }
      if (snap.expiresAt < Date.now()) {
        keysToDelete.push(key);
        continue;
      }
      if (!latest || snap.expiresAt > latest.expiresAt) {
        latest = snap;
      }
    }

    // Prune expired / corrupt entries
    keysToDelete.forEach((k) => localStorage.removeItem(k));
    return latest;
  } catch {
    return null;
  }
}

function clearSessionSnapshot(sessionId: string): void {
  if (typeof window === 'undefined' || !sessionId) return;
  try {
    localStorage.removeItem(`${SESSION_STORAGE_KEY}_${sessionId}`);
  } catch {
    // ignore
  }
}

/**
 * Find the most-recently-used session snapshot whose `topic` or `docTitle`
 * matches the given title string. Used by sidebar / library to restore a
 * specific past session when the user clicks a recent item.
 * Returns null when no matching, non-expired snapshot exists.
 */
export function loadSnapshotByTitle(title: string): VersionedSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const prefix = `${SESSION_STORAGE_KEY}_`;
    let best: VersionedSnapshot | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const snap = migrateSnapshotIfNeeded(JSON.parse(raw) as unknown);
      if (!snap || snap.expiresAt < Date.now()) continue;
      if (snap.topic !== title && snap.docTitle !== title) continue;
      if (!best || snap.expiresAt > best.expiresAt) best = snap;
    }
    return best;
  } catch {
    return null;
  }
}

// ─── Smart doc_context extractor ─────────────────────────────────────────────

/**
 * Extracts the most relevant slide content for a given question.
 * Tokenises the question into keywords, scores each slide by keyword-overlap,
 * and packs the top-scoring slides into MAX_DOC_CONTEXT_CHARS.
 */
function buildSmartDocContext(question: string, slides: SlideItem[]): string {
  if (slides.length === 0) return '';

  // Tokenise: lower-case words, remove stop words, min 3 chars
  const STOP = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'is','are','was','were','be','been','have','has','had','do','does','did',
    'will','would','could','should','may','might','can','shall','this','that',
    'these','those','it','its','what','which','who','how','when','where','why',
  ]);
  const keywords = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));

  if (keywords.length === 0) {
    // No useful keywords — fall back to first N chars of all slides
    return slides
      .map((s) => [s.title, ...s.content].join('\n'))
      .join('\n\n')
      .slice(0, MAX_DOC_CONTEXT_CHARS);
  }

  // Score each slide by keyword overlap
  const scored = slides.map((slide) => {
    const text = [slide.title, ...slide.content, slide.notes ?? '']
      .join(' ')
      .toLowerCase();
    const score = keywords.reduce((sum, kw) => {
      // Count occurrences for stronger relevance signal
      let count = 0;
      let pos = text.indexOf(kw);
      while (pos !== -1) { count++; pos = text.indexOf(kw, pos + 1); }
      return sum + count;
    }, 0);
    return { slide, score };
  });

  // Sort descending and pack until budget is exhausted
  scored.sort((a, b) => b.score - a.score);
  const parts: string[] = [];
  let used = 0;
  for (const { slide } of scored) {
    const text = [slide.title, ...slide.content].join('\n');
    if (used + text.length > MAX_DOC_CONTEXT_CHARS) break;
    parts.push(text);
    used += text.length + 2; // +2 for the \n\n separator
  }

  return parts.join('\n\n');
}

// ─── Message ID generator ─────────────────────────────────────────────────────

/**
 * Generates a unique message ID using the current timestamp plus a
 * per-millisecond sequence counter.  This guarantees uniqueness even
 * when multiple messages are created in the same millisecond AND
 * after a session restore (restored messages carry old numeric IDs that
 * can no longer clash with timestamp-based ones).
 */
let _msgSeq = 0;
let _msgLastTs = 0;
function nextMsgId(): string {
  const now = Date.now();
  if (now !== _msgLastTs) {
    _msgLastTs = now;
    _msgSeq = 0;
  }
  return `msg-${now}-${_msgSeq++}`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StudyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(studyReducer, INITIAL_STATE);

  // ── Chat slice from ChatContext ────────────────────────────────────────────
  const { chatState, chatDispatch } = useChatContext();

  // ── Quiz slice from QuizContext ────────────────────────────────────────────
  const { quizState, quizDispatch } = useQuizContext();

  // ── Notes slice from NotesContext ─────────────────────────────────────────
  const { notesState, notesDispatch } = useNotesContext();

  // ── Viewer dispatch from ViewerContext ────────────────────────────────────
  const { viewerState, viewerDispatch } = useViewerContext();

  // ── Merged dispatch — routes to the correct underlying dispatcher ──────────
  // • RESTORE_SESSION: dispatches to study + chat + quiz + notes dispatchers.
  // • QUIZ_COMPLETED: dispatches to BOTH quiz (state) and study (workspace).
  // • Chat action types: forwarded to chatDispatch.
  // • Quiz action types: forwarded to quizDispatch.
  // • Notes action types: forwarded to notesDispatch.
  // • Everything else: forwarded to the study reducer dispatch.
  const CHAT_ACTION_TYPES = new Set<string>([
    'SEND_MESSAGE', 'SET_LAST_USER_MESSAGE', 'SET_CHAT_LOADING',
    'RECEIVE_MESSAGE', 'START_AI_MESSAGE', 'APPEND_MESSAGE_CHUNK',
    'UPDATE_MESSAGE_META', 'REMOVE_MESSAGE', 'MESSAGE_ERROR', 'HANDLE_CHAT_ERROR',
    'CLEAR_CHAT_ERROR', 'SET_CHAT_MODE', 'RESTORE_MESSAGES', 'RESET_CHAT',
  ]);
  const QUIZ_ACTION_TYPES = new Set<string>([
    'START_QUIZ', 'ANSWER_QUESTION', 'CLOSE_QUIZ', 'RESTORE_QUIZ', 'RESET_QUIZ',
    // QUIZ_COMPLETED is NOT in this set — it is dual-dispatched below
  ]);
  const NOTES_ACTION_TYPES = new Set<string>([
    'ADD_NOTE', 'UPDATE_NOTE', 'DELETE_NOTE',
    'ADD_TODO', 'TOGGLE_TODO_ITEM', 'DELETE_TODO',
    'RESTORE_NOTES', 'RESET_NOTES',
  ]);

  const mergedDispatch = useCallback(
    (action: StudyAction | ChatAction | QuizAction | NotesAction) => {
      if (action.type === 'RESTORE_SESSION') {
        const a = action as StudyAction & { type: 'RESTORE_SESSION' };
        // Restore each slice independently
        dispatch(a);
        chatDispatch({ type: 'RESTORE_MESSAGES', payload: a.payload.messages });
        quizDispatch({
          type: 'RESTORE_QUIZ',
          payload: {
            quizResults: a.payload.quizResults,
            weakAreas: a.payload.weakAreas,
            performanceHistory: a.payload.performanceHistory,
          },
        });
        notesDispatch({ type: 'RESTORE_NOTES', payload: a.payload.notes });
      } else if (action.type === 'QUIZ_COMPLETED') {
        // Dual-dispatch: quiz context owns quiz state; study context owns workspace cards
        quizDispatch(action as QuizAction);
        dispatch(action as StudyAction);
      } else if (CHAT_ACTION_TYPES.has(action.type)) {
        chatDispatch(action as ChatAction);
      } else if (QUIZ_ACTION_TYPES.has(action.type)) {
        quizDispatch(action as QuizAction);
      } else if (NOTES_ACTION_TYPES.has(action.type)) {
        notesDispatch(action as NotesAction);
      } else {
        dispatch(action as StudyAction);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, chatDispatch, quizDispatch, notesDispatch, viewerDispatch],
  );

  // Keep a ref so stable callbacks can always read the latest merged state
  const mergedState: MergedStudyState = { ...state, ...chatState, ...quizState, ...notesState };
  const stateRef = useRef<MergedStudyState>(mergedState);
  useEffect(() => {
    stateRef.current = { ...state, ...chatState, ...quizState, ...notesState };
  }, [state, chatState, quizState, notesState]);

  // Keep a ref so stable callbacks can always read the latest viewer state
  const viewerStateRef = useRef(viewerState);
  useEffect(() => {
    viewerStateRef.current = viewerState;
  }, [viewerState]);

  // ── Initialise browser-only state after mount (avoids SSR/client mismatch) ─
  useEffect(() => {
    const newSessionId = `session-${Date.now()}`;
    dispatch({ type: 'SET_SESSION_ID', payload: newSessionId });
    dispatch({ type: 'SET_RECENTS', payload: loadRecentsFromStorage() });

    // Attempt to restore the last persisted session snapshot (messages,
    // workspace cards, quiz results, notes, etc.) so state survives a
    // page refresh and even a browser close/reopen.
    const snapshot = loadLatestSessionSnapshot();
    if (snapshot) {
      // Derive weakAreas from quizResults if the snapshot didn't store them
      // (legacy snapshots from before versioning may have empty arrays).
      const restoredWeakAreas =
        snapshot.weakAreas.length > 0
          ? snapshot.weakAreas
          : calcWeakAreas(snapshot.quizResults);

      // RESTORE_SESSION dispatched through mergedDispatch so it also restores
      // messages into ChatContext automatically.
      mergedDispatch({
        type: 'RESTORE_SESSION',
        payload: {
          messages: snapshot.messages,
          workspaceSections: snapshot.workspaceSections,
          quizResults: snapshot.quizResults,
          weakAreas: restoredWeakAreas,
          performanceHistory: snapshot.performanceHistory,
          notes: snapshot.notes,
          topic: snapshot.topic,
          docTitle: snapshot.docTitle,
          bookId: snapshot.bookId,
        },
      });
    }

    // Rehydrate slides from localStorage so the AI context survives both
    // a page refresh and a browser close.  Then attempt to restore the raw
    // PDF file from IndexedDB so the iframe shows the real PDF without a
    // re-upload.
    const restoredDocTitle = snapshot?.docTitle;
    const persisted = loadSlidesFromStorage(restoredDocTitle);
    if (persisted && persisted.slides.length > 0) {
      dispatch({
        type: 'SET_SLIDES',
        payload: { slides: persisted.slides, docTitle: persisted.docTitle, bookId: persisted.bookId },
      });

      // Try to restore the PDF blob URL from IndexedDB (survives page refresh)
      void loadPdfFromIdb(persisted.docTitle).then((file) => {
        if (file) {
          const url = URL.createObjectURL(file);
          blobUrlRef.current = url;
          dispatch({ type: 'SET_PDF_BLOB_URL', payload: url });
          dispatch({
            type: 'SHOW_TOAST',
            payload: `📄 "${persisted.docTitle}" restored`,
          });
        } else {
          dispatch({
            type: 'SHOW_TOAST',
            payload: `📄 "${persisted.docTitle}" restored — AI context ready (re-upload to view PDF)`,
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { saveSession } = useStudySession();

  // Track in-flight chat request so it can be cancelled on re-send
  const abortRef = useRef<AbortController | null>(null);

  // Track the X-Request-Id of the current in-flight /ask request for server-side cancel
  const currentRequestIdRef = useRef<string | null>(null);

  // Track the stream_id of the current SSE stream for best-effort recovery
  const streamIdRef = useRef<string | null>(null);

  // Track in-flight generation requests to prevent double-triggering
  const flashcardsInFlightRef = useRef(false);
  const quizInFlightRef = useRef(false);

  // Track in-flight generation abort controllers
  const flashcardsAbortRef = useRef<AbortController | null>(null);
  const quizAbortRef = useRef<AbortController | null>(null);

  // Track current blob URL so we can revoke it before creating a new one
  const blobUrlRef = useRef<string | null>(null);

  // Track PAEV polling interval so it can be cleared on unmount
  const paevPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Ref for handleSendMessage so handleStartReview can call it stably ──────
  const sendMessageRef = useRef<
    (text: string, opts?: { selectedText?: string; docContext?: string }) => Promise<void>
  >(() => Promise.resolve());

  // ── Auto-clear toast ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [state.toast]);

  // ── Persist session snapshot to localStorage (debounced 500ms) ───────────
  // NOTE: chatLoading is intentionally included so the snapshot is saved once
  // streaming ends (chatLoading: true → false). Without it, APPEND_MESSAGE_CHUNK
  // fills in the AI text without changing messages.length, so the snapshot saved
  // on START_AI_MESSAGE still has text:'' and refreshing shows "No response received".
  useEffect(() => {
    if (chatState.messages.length === 0 && state.workspaceSections.length === 0) return;
    // Only save on chatLoading→false (not →true), to avoid saving mid-stream
    if (chatState.chatLoading) return;
    const t = setTimeout(() => {
      saveSessionSnapshot(stateRef.current.sessionId, stateRef.current);
    }, 500);
    return () => clearTimeout(t);
  }, [
    chatState.messages.length,
    chatState.chatLoading,
    state.workspaceSections.length,
    quizState.quizResults.length,
    quizState.weakAreas.length,
    quizState.performanceHistory.length,
    notesState.notes.length,
    state.topic,
    state.docTitle,
    state.bookId,
  ]);

  // ── Persist session when meaningful state changes ─────────────────────────
  useEffect(() => {
    if (chatState.messages.length === 0 && state.workspaceSections.length === 0) return;
    saveSession({
      topic: state.topic,
      lastAction: chatState.messages[chatState.messages.length - 1]?.role ?? null,
      quizScore: quizState.quizResults[quizState.quizResults.length - 1]?.score ?? null,
    });
  }, [
    state.topic,
    chatState.messages.length,
    state.workspaceSections.length,
    quizState.quizResults.length,
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
      if (paevPollRef.current !== null) {
        clearInterval(paevPollRef.current);
      }
    };
  }, []);

  // ── showToast ─────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string) => {
    dispatch({ type: 'SHOW_TOAST', payload: message });
  }, []);

  // ── createNote ────────────────────────────────────────────────────────────
  const handleCreateNote = useCallback(() => {
    const now = new Date().toISOString();
    const note: NoteItem = {
      id: `note-${Date.now()}`,
      type: 'note',
      title: 'New Note',
      content: '',
      createdAt: now,
      updatedAt: now,
    };
    notesDispatch({ type: 'ADD_NOTE', payload: note });
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'notes' });
    dispatch({ type: 'SHOW_TOAST', payload: '📝 New note created!' });
  }, [notesDispatch]);

  // ── createTodo ────────────────────────────────────────────────────────────
  const handleCreateTodo = useCallback((title: string, items: string[]) => {
    const now = new Date().toISOString();
    const ts = Date.now();
    const todo: TodoItem = {
      id: `todo-${ts}`,
      type: 'todo',
      title,
      createdAt: now,
      items: items.map((text, i) => ({
        id: `item-${i}-${ts}`,
        text,
        checked: false,
      })),
    };
    notesDispatch({ type: 'ADD_TODO', payload: todo });
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'notes' });
    dispatch({ type: 'SHOW_TOAST', payload: '📋 To-do list added to Notes!' });
  }, [notesDispatch]);

  // ── sendMessage ───────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (text: string, opts: { selectedText?: string; docContext?: string } = {}) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      streamIdRef.current = null;

      const userMsg: ChatMessage = { id: nextMsgId(), role: 'user', text };
      chatDispatch({ type: 'SEND_MESSAGE', payload: userMsg });

      // Build history from current messages (last MAX_HISTORY_ITEMS), stripping HTML tags.
      // Filter out assistant messages that contain raw JSON (from chunk/master/research turns)
      // to prevent JSON bleed when the user switches back to snap mode.
      const history: MessageHistoryItem[] = stateRef.current.messages
        .slice(-MAX_HISTORY_ITEMS)
        .filter((m) => {
          if (m.role === 'ai') {
            const trimmed = m.text.trim();
            if (trimmed.startsWith('{')) {
              try { JSON.parse(trimmed); return false; } catch { /* not JSON, keep */ }
            }
          }
          return true;
        })
        .map((m) => ({
          role: (m.role === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: stripHtml(m.text),
        }));

      // Auto-populate doc_context from uploaded slides when not explicitly provided.
      const { slides } = stateRef.current;
      const autoDocContext =
        opts.docContext !== undefined
          ? opts.docContext
          : buildSmartDocContext(text, slides);

      const isGenerationRequest = /generate.*quiz|generate.*flashcard/i.test(text);
      const formattedQuestion = isGenerationRequest
        ? text
        : `${text}\n\n[Format requirement: Use markdown with ## headers for main sections, ### for subsections. Use $$ for display equations and $ for inline math. Use \\ce{} for chemical formulas. Give thorough explanations with worked examples. End conceptual answers with a > 💡 Key takeaway: blockquote.]`;

      // For snap mode, stream tokens into an empty bubble as they arrive.
      // For non-streaming modes (chunk/master/research), show a mode-specific
      // placeholder so the user sees meaningful feedback during the 5-15 s wait.
      const currentChatMode = stateRef.current.chatMode;
      const isStreamingMode = currentChatMode === 'snap';
      // 'snap' is intentionally omitted — it never reads this map (isStreamingMode === true).
      const placeholderText: Record<string, string> = {
        chunk:    '📖 Analyzing in depth…',
        master:   '🧠 Deep reasoning in progress…',
        research: '🔬 Researching…',
      };
      const aiMsgId = nextMsgId();
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        role: 'ai',
        text: isStreamingMode ? '' : (placeholderText[currentChatMode] ?? 'Thinking…'),
        isPlaceholder: !isStreamingMode,
        actions: isStreamingMode
          ? [
              { label: '🃏 Generate flashcards', actionKey: 'flashcards' },
              { label: '🎯 Quiz me on this', actionKey: 'quiz' },
            ]
          : [],
      };
      chatDispatch({ type: 'START_AI_MESSAGE', payload: aiMsg });

      try {
        const res = await sendMessageStream(
          {
            question: formattedQuestion,
            history,
            selected_text: opts.selectedText ?? '',
            doc_context: autoDocContext,
            mode: currentChatMode,
            bookId: stateRef.current.bookId ?? undefined,
            viewer_state: buildViewerState(viewerStateRef.current),
          },
          (chunk: string) => {
            if (isStreamingMode) {
              chatDispatch({ type: 'APPEND_MESSAGE_CHUNK', payload: { id: aiMsgId, chunk } });
            } else {
              // Non-streaming: single chunk contains the full answer — replace placeholder.
              chatDispatch({
                type: 'REPLACE_AI_MESSAGE',
                payload: {
                  id: aiMsgId,
                  text: chunk,
                  actions: [
                    { label: '🃏 Generate flashcards', actionKey: 'flashcards' },
                    { label: '🎯 Quiz me on this', actionKey: 'quiz' },
                  ],
                },
              });
            }
          },
          abortRef.current.signal,
          (reqId) => { currentRequestIdRef.current = reqId; },
          (sid) => { streamIdRef.current = sid; },
        );

        chatDispatch({ type: 'SET_CHAT_LOADING', payload: false });

        // Forward viewer_action to ViewerContext so the embedded player can seek
        if (res.viewer_action) {
          if (res.viewer_action.type === 'seek_youtube') {
            viewerDispatch({ type: 'SEEK_YOUTUBE', timestamp: res.viewer_action.timestamp_seconds });
          } else if (res.viewer_action.type === 'switch_to_research') {
            viewerDispatch({ type: 'OPEN_RESEARCH', url: res.viewer_action.url });
          }
        }

        // Update message with memory/performance metadata if present
        if (res.topic || res.memory_recall || (res.performance_bars && res.performance_bars.length > 0)) {
          chatDispatch({
            type: 'UPDATE_MESSAGE_META',
            payload: {
              id: aiMsgId,
              ...(res.topic ? { topic: res.topic } : {}),
              memoryRecall: res.memory_recall,
              performanceBars: res.performance_bars ?? [],
            },
          });
        }

        // Auto-create a todo list when the user's message looks like a checklist request
        const lowerText = text.toLowerCase();
        if (
          lowerText.includes('todo') ||
          lowerText.includes('study plan') ||
          lowerText.includes('checklist')
        ) {
          /** Strip markdown formatting characters from a line of text. */
          const stripMarkdown = (s: string): string =>
            s
              .replace(/\*\*(.*?)\*\*/g, '$1')   // **bold**
              .replace(/__(.*?)__/g, '$1')        // __bold__
              .replace(/\*(.*?)\*/g, '$1')        // *italic*
              .replace(/_(.*?)_/g, '$1')          // _italic_
              .replace(/`([^`]+)`/g, '$1')        // `code`
              .replace(/~~(.*?)~~/g, '$1')        // ~~strikethrough~~
              .trim();

          const listItems = res.answer
            .split('\n')
            .map((l) => l.trim())
            // Keep only lines that look like bullet/numbered/checkbox list items
            .filter((l) => /^[-•*]|^\d+\.|^\[[ x]\]/.test(l))
            // Strip list prefixes
            .map((l) =>
              l
                .replace(/^[-•*]\s*/, '')
                .replace(/^\d+\.\s*/, '')
                .replace(/^\[[ x]\]\s*/, '')
                .trim(),
            )
            // Remove markdown formatting so items display cleanly
            .map(stripMarkdown)
            // Drop separator lines (---, --, **, lines made of only dashes/asterisks/spaces)
            .filter((l) => !/^[-*\s]{1,}$/.test(l))
            // Drop page-citation lines (e.g. "📖 Page 6", "📖 Page 10–11")
            .filter((l) => !/^📖/.test(l) && !/^[\u{1F4D6}]/u.test(l))
            // Drop parenthetical metadata lines like "(Designed for a middle-school...)"
            .filter((l) => !/^\(/.test(l))
            // Drop flashcard detail lines — sub-content starting with "Front:" / "Back:"
            .filter((l) => !/^(Front|Back):/i.test(l))
            // Drop lines that are purely a page reference: "Page 6", "Pages 10-11"
            .filter((l) => !/^Pages?\s+\d/i.test(l))
            // Require at least 3 alphabetic characters of real content
            .filter((l) => l.replace(/[^a-zA-Z]/g, '').length >= 3)
            // Cap at 12 items so the list stays usable
            .slice(0, 12);

          /** Clean a raw document/topic title into a human-readable string. */
          const cleanTitle = (raw: string): string => {
            const cleaned = raw
              .replace(/\.[^.]+$/, '')   // strip file extension
              .replace(/[_-]+/g, ' ')    // underscores/hyphens → spaces
              .replace(/\s+/g, ' ')
              .trim();
            // Title-case each word
            return cleaned.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
          };

          if (listItems.length >= 3) {
            const rawTitle = stateRef.current.topic || stateRef.current.docTitle || 'Study Plan';
            handleCreateTodo(cleanTitle(rawTitle), listItems);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User clicked Stop — remove the empty/partial AI bubble
          chatDispatch({ type: 'REMOVE_MESSAGE', payload: aiMsgId });
          return;
        }
        // Best-effort stream recovery: if the backend completed the stream
        // before the client lost connection, the full token list will be in
        // Redis for up to 5 minutes.  Replay it instead of showing an error.
        const capturedStreamId = streamIdRef.current;
        if (capturedStreamId && isStreamingMode) {
          try {
            const buffer = await getStreamBuffer(capturedStreamId);
            if (buffer?.complete && buffer.tokens.length > 0) {
              const recoveredText = buffer.tokens.join('');
              chatDispatch({
                type: 'REPLACE_AI_MESSAGE',
                payload: {
                  id: aiMsgId,
                  text: recoveredText,
                  actions: [
                    { label: '🃏 Generate flashcards', actionKey: 'flashcards' },
                    { label: '🎯 Quiz me on this', actionKey: 'quiz' },
                  ],
                },
              });
              chatDispatch({ type: 'SET_CHAT_LOADING', payload: false });
              return;
            }
          } catch {
            // Recovery failed — fall through to normal error handling
          }
        }
        const message =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        chatDispatch({ type: 'HANDLE_CHAT_ERROR', payload: { messageId: aiMsgId, error: message, originalQuestion: text } });
      } finally {
        currentRequestIdRef.current = null;
        streamIdRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // stable — reads state through stateRef
  );

  // Keep ref in sync so handleStartReview can always use the latest version
  useEffect(() => {
    sendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  // ── generateFlashcards ────────────────────────────────────────────────────
  const handleGenerateFlashcards = useCallback(async (topic: string, count = DEFAULT_FLASHCARD_COUNT) => {
    if (flashcardsInFlightRef.current) return;
    flashcardsInFlightRef.current = true;

    flashcardsAbortRef.current?.abort();
    flashcardsAbortRef.current = new AbortController();

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
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Failed to generate flashcards.';
      dispatch({ type: 'WORKSPACE_ERROR', payload: message });
      dispatch({ type: 'SHOW_TOAST', payload: `❌ ${message}` });
    } finally {
      flashcardsInFlightRef.current = false;
    }
  }, []);

  // ── generateQuiz ──────────────────────────────────────────────────────────
  const handleGenerateQuiz = useCallback(
    async (topic: string, count = DEFAULT_QUIZ_COUNT, difficulty: 'easy' | 'medium' | 'hard' = 'medium') => {
      if (quizInFlightRef.current) return;
      quizInFlightRef.current = true;

      quizAbortRef.current?.abort();
      quizAbortRef.current = new AbortController();

      dispatch({ type: 'SET_WORKSPACE_LOADING', payload: true });
      dispatch({ type: 'SHOW_TOAST', payload: '🎯 Generating quiz…' });

      try {
        // Use real slides when available; fall back to a topic-seed when not
        // (e.g. during a personalised review session without an uploaded doc).
        const slides =
          stateRef.current.slides.length > 0
            ? stateRef.current.slides
            : topicToSlides(topic);
        const res = await generateQuiz({ slides, count, difficulty, bookId: stateRef.current.bookId ?? undefined });
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
        if (err instanceof Error && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Failed to generate quiz.';
        dispatch({ type: 'WORKSPACE_ERROR', payload: message });
        dispatch({ type: 'SHOW_TOAST', payload: `❌ ${message}` });
      } finally {
        quizInFlightRef.current = false;
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

    // Persist the raw File to IndexedDB so it survives a page refresh
    void savePdfToIdb(file);

    dispatch({ type: 'SET_UPLOAD_LOADING', payload: true });
    dispatch({ type: 'SHOW_TOAST', payload: '📄 Uploading document…' });

    try {
      const res = await uploadDocument(file);
      const docTitle = res.filename.replace(/\.[^.]+$/, ''); // strip extension
      dispatch({ type: 'SET_SLIDES', payload: { slides: res.slides, docTitle, bookId: res.bookId } });
      persistSlidesToStorage({ slides: res.slides, docTitle, bookId: res.bookId ?? null });
      appendMyDocToStorage({ docTitle, filename: res.filename, uploadedAt: new Date().toISOString() });
      // Re-save the PDF with the now-known docTitle so it can be looked up per-document
      void savePdfToIdb(file, docTitle);
      dispatch({ type: 'SET_TOPIC', payload: docTitle });
      dispatch({
        type: 'ADD_RECENT',
        payload: { id: `doc-${Date.now()}`, title: docTitle, color: pickColor(docTitle) },
      });
      dispatch({
        type: 'SHOW_TOAST',
        payload: `✅ "${docTitle}" loaded — ${res.total_slides} pages ready`,
      });

      // Poll /tutor/paev-status every 5 s until PAEV is ready for this upload.
      // Stop after 5 minutes (60 attempts × 5 s) so the interval doesn't run forever.
      if (res.bookId) {
        const uploadedBookId = res.bookId;
        let paevAttempts = 0;
        if (paevPollRef.current !== null) clearInterval(paevPollRef.current);
        paevPollRef.current = setInterval(async () => {
          paevAttempts += 1;
          if (paevAttempts > 60) {
            clearInterval(paevPollRef.current!);
            paevPollRef.current = null;
            return;
          }
          try {
            const ready = await checkPaevStatus(uploadedBookId);
            if (ready) {
              clearInterval(paevPollRef.current!);
              paevPollRef.current = null;
              dispatch({
                type: 'SHOW_TOAST',
                payload: '🧠 Your document is now fully indexed — your tutor just got smarter',
              });
            }
          } catch {
            // fail silently — polling will retry on next tick
          }
        }, 5000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      clearSlidesFromStorage();
      void clearPdfFromIdb();
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
          quizDispatch({ type: 'START_QUIZ', payload: quiz });
          return;
        }
      }
    }
  }, [quizDispatch]);

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

    const wrongAnswers = activeQuiz.questions
      .filter((_, i) => !answers[i]?.isCorrect)
      .map((q) => q.question);

    const result: QuizResult = {
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      score,
      totalQuestions: activeQuiz.questions.length,
      correctAnswers: correct,
      answers,
      completedAt: new Date().toISOString(),
      topic: topic || activeQuiz.title,
      wrongAnswers,
    };

    // mergedDispatch dual-routes QUIZ_COMPLETED: quiz state to QuizContext,
    // workspace card score update to StudyContext.
    mergedDispatch({ type: 'QUIZ_COMPLETED', payload: result });

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
  }, [mergedDispatch]);

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

  // ── startReviewSession ────────────────────────────────────────────────────
  const handleStartReviewSession = useCallback(async (topic?: string) => {
    // Resolve the target topic: explicit arg → weakest quiz topic → current topic → fallback
    const { weakAreas, topic: currentTopic } = stateRef.current;
    const weakestTopic =
      weakAreas.length > 0
        ? [...weakAreas].sort((a, b) => a.score - b.score)[0]?.topic ?? null
        : null;

    const resolvedTopic = topic ?? weakestTopic ?? (currentTopic || 'General Study');

    dispatch({ type: 'START_REVIEW_SESSION', payload: { topic: resolvedTopic } });
    chatDispatch({ type: 'SET_CHAT_LOADING', payload: true });

    try {
      const docContext = stateRef.current.slides
        .slice(0, 3)
        .map((s: { content: string[] }) => s.content.join(' '))
        .join('\n')
        .slice(0, MAX_DOC_CONTEXT_CHARS);

      const res = await sendMessage({
        question: `Give me a focused explanation of "${resolvedTopic}" covering the key concepts I need to understand. Use ## headers for sections, worked examples with $$ equations where relevant, and end with a > 💡 Key takeaway blockquote.`,
        history: [],
        selected_text: '',
        doc_context: docContext,
        mode: stateRef.current.chatMode,
        bookId: stateRef.current.bookId ?? undefined,
        viewer_state: buildViewerState(viewerStateRef.current),
      });

      dispatch({ type: 'SET_REVIEW_EXPLANATION', payload: res.answer });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load explanation.';
      dispatch({ type: 'SHOW_TOAST', payload: `❌ ${msg}` });
      dispatch({ type: 'END_REVIEW_SESSION' });
    } finally {
      chatDispatch({ type: 'SET_CHAT_LOADING', payload: false });
    }
  }, []);

  // ── advanceReviewStep ─────────────────────────────────────────────────────
  const handleAdvanceReviewStep = useCallback(() => {
    const { reviewSession } = stateRef.current;
    if (!reviewSession) return;

    const next: Record<ReviewStep, ReviewStep | 'done'> = {
      explain: 'flashcards',
      flashcards: 'quiz',
      quiz: 'result',
      result: 'done',
    };

    const nextStep = next[reviewSession.step as ReviewStep];
    if (nextStep === 'done') {
      dispatch({ type: 'END_REVIEW_SESSION' });
      return;
    }
    dispatch({ type: 'SET_REVIEW_STEP', payload: nextStep });
  }, []);

  // ── endReviewSession ──────────────────────────────────────────────────────
  const handleEndReviewSession = useCallback(() => {
    dispatch({ type: 'END_REVIEW_SESSION' });
  }, []);

  // ── completeReviewQuiz ────────────────────────────────────────────────────
  const handleCompleteReviewQuiz = useCallback(
    (score: number, correct: number, total: number) => {
      dispatch({ type: 'COMPLETE_REVIEW_QUIZ', payload: { score, correct, total } });
      dispatch({ type: 'SET_REVIEW_STEP', payload: 'result' });
    },
    [],
  );

  // ── stop ──────────────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    // Signal the backend to stop streaming before we cut the connection
    const currentReqId = currentRequestIdRef.current;
    if (currentReqId) {
      cancelAsk(currentReqId);
    }
    abortRef.current?.abort();
    dispatch({ type: 'SHOW_TOAST', payload: '⏹ Generation stopped.' });
  }, []);

  // ── resetSession ──────────────────────────────────────────────────────────
  const handleResetSession = useCallback(() => {    // Cancel any in-flight requests
    abortRef.current?.abort();
    flashcardsAbortRef.current?.abort();
    quizAbortRef.current?.abort();

    // Clear persisted data so the old session doesn't come back on next refresh
    clearSlidesFromStorage();
    clearSessionSnapshot(stateRef.current.sessionId);
    void clearPdfFromIdb();

    // Revoke any active blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    dispatch({ type: 'RESET_SESSION' });
    chatDispatch({ type: 'RESET_CHAT' });
    quizDispatch({ type: 'RESET_QUIZ' });
    notesDispatch({ type: 'RESET_NOTES' });
  }, [chatDispatch, quizDispatch, notesDispatch]);

  // ── handleRestoreDocument ────────────────────────────────────────────────────
  // Called when the user clicks a sidebar recent to switch to a different
  // document.  Reloads the per-doc slides from localStorage and the PDF blob
  // from IndexedDB so the ContentPanel shows the correct document.
  const handleRestoreDocument = useCallback(async (docTitle: string): Promise<void> => {
    if (!docTitle) return;

    // Load slides for this specific document
    const persisted = loadSlidesFromStorage(docTitle);
    if (persisted && persisted.slides.length > 0) {
      dispatch({
        type: 'SET_SLIDES',
        payload: { slides: persisted.slides, docTitle: persisted.docTitle, bookId: persisted.bookId },
      });
    }

    // Load PDF blob URL for this specific document
    const file = await loadPdfFromIdb(docTitle);
    // Revoke old blob URL to avoid memory leaks
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (file) {
      const url = URL.createObjectURL(file);
      blobUrlRef.current = url;
      dispatch({ type: 'SET_PDF_BLOB_URL', payload: url });
    } else {
      dispatch({ type: 'SET_PDF_BLOB_URL', payload: null });
    }
  }, []);

  const value: StudyContextValue = {
    // Merge study state + chat + quiz + notes so all existing useStudy() consumers
    // can still read state.messages, state.activeQuiz, state.notes, etc.
    state: { ...state, ...chatState, ...quizState, ...notesState },
    // mergedDispatch routes actions to the appropriate context dispatcher.
    dispatch: mergedDispatch,
    handleSendMessage,
    handleGenerateFlashcards,
    handleGenerateQuiz,
    handleStartQuiz,
    handleCompleteQuiz,
    handleStartReview,
    handleUploadDocument,
    handleCreateNote,
    handleCreateTodo,
    handleResetSession,
    handleRestoreDocument,
    handleStop,
    showToast,
    handleStartReviewSession,
    handleAdvanceReviewStep,
    handleEndReviewSession,
    handleCompleteReviewQuiz,
  };

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStudy(): StudyContextValue {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error('useStudy must be used within StudyProvider');
  return ctx;
}
