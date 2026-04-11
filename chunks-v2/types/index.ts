import type { Flashcard, QuizQuestion } from './api';
export type { ConceptChunk, ExamQuestion, ExamResult, ExamConfig } from './exam';

// ─── Navigation ──────────────────────────────────────────────────────────────

export type NavItem = {
  id: string;
  label: string;
  icon: string; // SVG path data or component key
  badge?: { text: string; variant: 'ai' | 'pro' };
};

export type RecentItem = {
  id: string;
  title: string;
  color: string;
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export type TabId = 'chat' | 'workspace' | 'reviewer' | 'notes';

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type MessageRole = 'ai' | 'user';

export type PerformanceBar = {
  label: string;
  pct: number;
  color: string;
};

export type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  memoryRecall?: string;
  performanceBars?: PerformanceBar[];
  actions?: { label: string; actionKey: string }[];
};

// ─── Workspace ────────────────────────────────────────────────────────────────

export type CardType = 'flashcards' | 'quiz' | 'summary' | 'mindmap';

export type WorkspaceCard = {
  id: string;
  type: CardType;
  title: string;
  meta: string;
  stats?: { label: string; danger?: boolean }[];
  // Real API data (present when generated from backend)
  flashcards?: Flashcard[];
  questions?: QuizQuestion[];
  score?: number;     // last quiz score 0-100
  attempts?: number;  // number of times quiz was taken
};

export type WorkspaceSection = {
  title: string;
  cards: WorkspaceCard[];
};

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export type Quiz = {
  id: string;
  title: string;
  questions: QuizQuestion[];
  difficulty: string;
};

export type QuizAnswer = {
  questionIndex: number;
  selectedAnswer: string;
  isCorrect: boolean;
};

export type QuizResult = {
  quizId: string;
  quizTitle: string;
  score: number;           // 0-100
  totalQuestions: number;
  correctAnswers: number;
  answers: QuizAnswer[];
  completedAt: string;     // ISO date string
  topic: string;
};

// ─── Memory / Performance ─────────────────────────────────────────────────────

export type WeakArea = {
  topic: string;
  score: number;           // average score 0-100
  attempts: number;
  lastAttemptAt: string;   // ISO date string
};

export type PerformanceEntry = {
  date: string;            // ISO date string
  topic: string;
  score: number;           // 0-100
  type: 'quiz' | 'flashcard' | 'chat';
};

// ─── Notes ───────────────────────────────────────────────────────────────────

export type NoteItem = {
  id: string;
  type: 'note';
  title: string;
  content: string;
  createdAt: string;  // ISO date string
  updatedAt: string;  // ISO date string
};

export type TodoItem = {
  id: string;
  type: 'todo';
  title: string;
  createdAt: string;  // ISO date string
  items: Array<{
    id: string;
    text: string;
    checked: boolean;
  }>;
};

export type AnyNote = NoteItem | TodoItem;

// ─── Reviewer (legacy display types) ─────────────────────────────────────────

export type TopicChip = {
  label: string;
  variant: 'success' | 'danger' | 'warning' | 'info';
};

/** @deprecated Use WeakArea from context instead */
export type WeakTopic = {
  icon: string;
  name: string;
  score: string;
  pct: number;
  iconBg: string;
};
