// ─── Shared ───────────────────────────────────────────────────────────────────

export interface SlideItem {
  title: string;
  slide_number?: number;
  content: string[];
  notes?: string;
}

export interface MessageHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Request Types ────────────────────────────────────────────────────────────

export interface SendMessageRequest {
  question: string;
  complexity?: number;
  mode?: string;
  thinking?: string | null;
  history?: MessageHistoryItem[];
  selected_text?: string;
  doc_context?: string;
  user_memory?: string;
  bookId?: string;
}

export interface GenerateFlashcardsRequest {
  topic: string;
  count?: number;
  bookId?: string;
}

export interface GenerateQuizRequest {
  slides: SlideItem[];
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  mode?: string;
  question_type?: string;
  existingQuestions?: string[];
}

export interface GenerateStudyMaterialsRequest {
  slides: SlideItem[];
  type: 'notes' | 'reviewer' | 'flashcards' | 'summary' | 'quiz' | 'all';
}

// ─── Response Types ───────────────────────────────────────────────────────────

export interface SendMessageResponse {
  success: boolean;
  answer: string;
  mode: string;
  cached?: boolean;
  memory_recall?: string;
  performance_bars?: Array<{ label: string; pct: number; color: string }>;
}

export interface Flashcard {
  front: string;
  back: string;
  hint?: string;
}

export interface GenerateFlashcardsResponse {
  success: boolean;
  flashcards: Flashcard[];
  count: number;
  topic: string;
}

export interface QuizQuestion {
  number: number | string;
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation: string;
}

export interface GenerateQuizResponse {
  success: boolean;
  questions: QuizQuestion[];
  count: number;
  difficulty: string;
}

export interface GenerateStudyMaterialsResponse {
  success: boolean;
  materials: Record<string, string>;
}

export interface UploadDocumentResponse {
  success: boolean;
  slides: SlideItem[];
  total_slides: number;
  filename: string;
  bookId?: string;
}

/** Typed API error — carries the HTTP status code. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
