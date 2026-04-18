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

// ─── Viewer action — emitted by the backend when the AI references a video ───

export type ViewerAction =
  | { type: 'seek_youtube'; video_id: string; timestamp_seconds: number }
  | { type: 'switch_to_research'; url: string };

// ─── Request Types ────────────────────────────────────────────────────────────

export interface SendMessageRequest {
  question: string;
  complexity?: number;
  mode?: string;
  history?: MessageHistoryItem[];
  selected_text?: string;
  doc_context?: string;
  user_memory?: string;
  bookId?: string;
  student_profile?: string;
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
  bookId?: string;
}

export interface GenerateStudyMaterialsRequest {
  slides: SlideItem[];
  type: 'notes' | 'reviewer' | 'flashcards' | 'summary' | 'quiz' | 'all';
  bookId?: string;
}

// ─── Response Types ───────────────────────────────────────────────────────────

export interface SendMessageResponse {
  success: boolean;
  answer: string;
  mode: string;
  /** Topic extracted by the backend for Socratic/weak-area tracking. */
  topic?: string;
  cached?: boolean;
  memory_recall?: string;
  performance_bars?: Array<{ label: string; pct: number; color: string }>;
  requestId?: string;
  /** Parsed structured data returned by chunk / master / research modes. */
  structured?: Record<string, unknown> | null;
  /**
   * Optional viewer action emitted when the AI references a video timestamp
   * while the viewer_context route is active.  The frontend should seek the
   * embedded player to the specified position when this field is present.
   */
  viewer_action?: ViewerAction | null;
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
