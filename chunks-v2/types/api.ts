// ─── Shared ───────────────────────────────────────────────────────────────────

export interface SlideItem {
  title: string;
  slide_number?: number;
  content: string[];
  notes?: string;
  /** Timestamp in seconds (YouTube slides only). */
  timestamp_seconds?: number;
}

export interface MessageHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Viewer action — emitted by the backend when the AI references a video ───

export type ViewerAction =
  | { type: 'open_youtube'; video_id: string; start_seconds?: number }
  | { type: 'seek_youtube'; video_id: string; timestamp_seconds: number }
  | { type: 'switch_to_research'; url: string };

// ─── Viewer state payload — sent in every /ask request ───────────────────────

/**
 * The viewer_state dict shape expected by the backend /ask schema.
 * @see backend/routes/schemas.py AskRequest.viewer_state
 */
export interface ViewerStatePayload {
  type: 'youtube' | 'pdf' | 'research' | 'none';
  video_id?: string;
  current_timestamp_seconds?: number;
  visible_segment?: string;
  pdf_page?: number;
  pdf_visible_text?: string;
  research_url?: string;
}

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
  viewer_state?: ViewerStatePayload | null;
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
   * Live web citations returned by the research mode web-search pass.
   * Each entry is a {url, title} object from Perplexity Sonar.
   */
  web_citations?: Array<{ url: string; title?: string }>;
  /**
   * Optional viewer action emitted when the AI references a video timestamp
   * while the viewer_context route is active.  The frontend should seek the
   * embedded player to the specified position when this field is present.
   */
  viewer_action?: ViewerAction | null;
  /** Model identifier used by the backend to fulfil the request. */
  model_used?: string;
  /** Alias for model_used — used in test mocks and some legacy response shapes. */
  model?: string;
  /** Token count consumed by the request (informational). */
  tokens_used?: number;
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
