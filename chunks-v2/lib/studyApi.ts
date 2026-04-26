/**
 * lib/studyApi.ts — Chunks(v.2) API client
 *
 * Single source of truth for every fetch() call to the Chunks backend.
 * All API calls go through apiPost() / uploadDocument() which attach auth
 * headers, handle rate-limit (429) and other errors uniformly, and parse JSON.
 *
 * Backend base URL is read from NEXT_PUBLIC_API_URL (defaults to production).
 */

import {
  ApiError,
  type SendMessageRequest,
  type SendMessageResponse,
  type GenerateFlashcardsRequest,
  type GenerateFlashcardsResponse,
  type GenerateQuizRequest,
  type GenerateQuizResponse,
  type GenerateStudyMaterialsRequest,
  type GenerateStudyMaterialsResponse,
  type SlideItem,
  type UploadDocumentResponse,
  type ViewerAction,
  type ViewerStatePayload,
  type ListenPageRequest,
} from '@/types/api';
import { getAccessToken, getSupabaseClient } from './supabaseClient';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.chunks.online').replace(/\/$/, '');

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * fetchWithAuth — wraps fetch() with a single-retry 401 handler.
 *
 * On a 401 response:
 *   1. Attempt to refresh the Supabase session.
 *   2. If refresh succeeds, retry the original request once with the new token.
 *   3. If the retry also returns 401, or if the refresh itself fails, sign the
 *      user out and redirect to /login?reason=session_expired.
 *
 * On a 403 response: the request is NOT retried — the 403 Response is returned
 * immediately so the caller / UI can handle the authorisation error directly.
 *
 * All other non-2xx responses are returned as-is for the caller to inspect.
 */

/** Generate a UUID v4 request ID, matching the hex/hyphen format the backend expects. */
function makeReqId(): string {
  return crypto.randomUUID();
}

async function fetchWithAuth(url: string, options: RequestInit): Promise<Response> {
  const res = await fetch(url, options);

  // 403 — forbidden, do not retry
  if (res.status === 403) return res;

  if (res.status !== 401) return res;

  // ── First 401: try to refresh the session ────────────────────────────────
  try {
    const sb = await getSupabaseClient();

    // If there is no existing session the user is a guest — there is nothing
    // to refresh.  Return the raw 401 so the caller can handle it gracefully
    // without triggering a login redirect (which would incorrectly kick guests
    // out of the app mid-session).
    const {
      data: { session: existingSession },
    } = await sb.auth.getSession();
    if (!existingSession) return res;

    const { error: refreshError } = await sb.auth.refreshSession();

    if (refreshError) {
      // Refresh failed — sign out and redirect
      await sb.auth.signOut();
      if (typeof window !== 'undefined') {
        window.location.href = '/login?reason=session_expired';
      }
      throw new ApiError('Session expired', 401);
    }

    // Refresh succeeded — grab the new token and retry once
    const {
      data: { session },
    } = await sb.auth.getSession();
    const newToken = session?.access_token;

    const retryOptions: RequestInit = {
      ...options,
      headers: {
        ...(options.headers as Record<string, string> | undefined),
        ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
      },
    };
    const retryRes = await fetch(url, retryOptions);

    // Second 401 — refresh token is itself expired or revoked
    if (retryRes.status === 401) {
      await sb.auth.signOut();
      if (typeof window !== 'undefined') {
        window.location.href = '/login?reason=session_expired';
      }
      throw new ApiError('Session expired', 401);
    }

    return retryRes;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Unexpected error during refresh — propagate original response
    return res;
  }
}

async function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const reqId = makeReqId();
  const authHeaders = await getAuthHeaders();
  const res = await fetchWithAuth(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': reqId, ...authHeaders },
    body: JSON.stringify(body),
    signal,
  });

  if (res.status === 429) {
    throw new ApiError('Rate limit reached. Please wait a moment before trying again.', 429);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const err = (await res.json()) as { detail?: string; message?: string };
      message = err.detail ?? err.message ?? message;
    } catch {
      // ignore JSON parse errors
    }
    console.error('[req:%s] API error on POST %s: %s', reqId, path, message);
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const reqId = makeReqId();
  const authHeaders = await getAuthHeaders();
  const res = await fetchWithAuth(`${API_BASE}${path}`, {
    method: 'GET',
    headers: { 'X-Request-Id': reqId, ...authHeaders },
    signal,
  });

  if (res.status === 429) {
    throw new ApiError('Rate limit reached. Please wait a moment before trying again.', 429);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const err = (await res.json()) as { detail?: string; message?: string };
      message = err.detail ?? err.message ?? message;
    } catch {
      // ignore JSON parse errors
    }
    console.error('[req:%s] API error on GET %s: %s', reqId, path, message);
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget signal to the backend to stop an in-flight /ask SSE stream.
 * Never throws — caller should not await or handle errors.
 */
export function cancelAsk(requestId: string): void {
  void fetch(`${API_BASE}/ask/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Fetch the token buffer for a completed SSE stream.
 * Returns the buffered tokens when the stream finished within the last 5 minutes,
 * or null when the stream_id is unknown, still in-progress, or the TTL has expired.
 * This is a best-effort recovery call — never throws.
 */
export async function getStreamBuffer(
  streamId: string,
  signal?: AbortSignal,
): Promise<{ complete: boolean; tokens: string[] } | null> {
  try {
    return await apiGet<{ complete: boolean; tokens: string[] }>(
      `/api/stream/${streamId}`,
      signal,
    );
  } catch {
    return null;
  }
}

export async function sendMessage(params: SendMessageRequest): Promise<SendMessageResponse> {
  return apiPost<SendMessageResponse>('/ask', {
    question: params.question,
    complexity: params.complexity ?? 3,
    mode: params.mode ?? 'study',
    history: params.history ?? [],
    selected_text: params.selected_text ?? '',
    doc_context: params.doc_context ?? '',
    user_memory: params.user_memory ?? '',
    ...(params.student_profile ? { student_profile: params.student_profile } : {}),
    ...(params.bookId ? { bookId: params.bookId } : {}),
    ...(params.viewer_state != null ? { viewer_state: params.viewer_state } : {}),
  });
}

// ─── Image message ────────────────────────────────────────────────────────────

export interface SendImageMessageParams {
  /** Base64-encoded image data (no data URL prefix). */
  image_b64: string;
  /** MIME type e.g. "image/jpeg" */
  image_type: string;
  /** User's question about the image. */
  question: string;
  /** Complexity level 1-10 (default 5). */
  complexity?: number;
}

export interface SendImageMessageResponse {
  success: boolean;
  answer: string;
  model?: string;
}

/**
 * Send a user's image (base64) plus question to the /ask-image vision endpoint.
 * Uses Gemini 2.5 Flash by default (server-side model selection).
 */
export async function sendImageMessage(
  params: SendImageMessageParams,
): Promise<SendImageMessageResponse> {
  return apiPost<SendImageMessageResponse>('/ask-image', {
    image_b64: params.image_b64,
    image_type: params.image_type,
    question: params.question,
    complexity: params.complexity ?? 5,
  });
}

// ─── Structured-mode formatter ───────────────────────────────────────────────

/**
 * Convert a structured JSON object (returned by chunk / master / research modes)
 * into a human-readable Markdown string so it can be rendered by MarkdownRenderer
 * instead of being shown as raw JSON in the chat bubble.
 */
function formatStructuredResponse(structured: Record<string, unknown>): string {
  const lines: string[] = [];

  const str = (v: unknown): string => {
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (v == null) return '';
    return JSON.stringify(v);
  };
  const listItems = (v: unknown, ordered = false): string => {
    if (!Array.isArray(v) || v.length === 0) return '';
    return v.map((item, i) => (ordered ? `${i + 1}. ${str(item)}` : `- ${str(item)}`)).join('\n');
  };

  // chunk mode
  if ('overview' in structured) {
    if (structured.overview) lines.push(`## Overview\n${str(structured.overview)}`);
    const kc = listItems(structured.key_concepts);
    if (kc) lines.push(`## Key Concepts\n${kc}`);
    const ss = listItems(structured.step_by_step, true);
    if (ss) lines.push(`## Step by Step\n${ss}`);
    if (structured.example) lines.push(`## Example\n${str(structured.example)}`);
    return lines.join('\n\n');
  }

  // master mode
  if ('core_explanation' in structured) {
    if (structured.core_explanation) lines.push(`## Core Explanation\n${str(structured.core_explanation)}`);
    if (structured.mechanism) lines.push(`## Mechanism\n${str(structured.mechanism)}`);
    if (structured.analysis) lines.push(`## Analysis\n${str(structured.analysis)}`);
    if (structured.connections) lines.push(`## Connections\n${str(structured.connections)}`);
    if (structured.key_insight) lines.push(`## Key Insight\n${str(structured.key_insight)}`);
    return lines.join('\n\n');
  }

  // research mode
  if ('summary' in structured) {
    if (structured.summary) lines.push(`## Summary\n${str(structured.summary)}`);
    const kf = listItems(structured.key_findings);
    if (kf) lines.push(`## Key Findings\n${kf}`);
    // Sources may be objects {title, url, year, authors, note} or plain strings.
    const srcArr = Array.isArray(structured.sources) ? structured.sources : [];
    const srcLines = srcArr.map((s: unknown): string => {
      if (typeof s === 'string') return `- ${s}`;
      if (s && typeof s === 'object') {
        const src = s as { title?: string; url?: string; year?: string; authors?: string; note?: string };
        const label = [src.title, src.year ? `(${src.year})` : ''].filter(Boolean).join(' ');
        const note = src.note ? ` — ${src.note}` : '';
        if (src.url) return `- [${label || src.url}](${src.url})${note}`;
        return `- ${label}${note}`;
      }
      return `- ${str(s)}`;
    }).filter(Boolean);
    if (srcLines.length) lines.push(`## Sources\n${srcLines.join('\n')}`);
    if (structured.simplified_explanation) lines.push(`## Simplified Explanation\n${str(structured.simplified_explanation)}`);
    return lines.join('\n\n');
  }

  // Generic fallback: render each key as a section
  for (const [key, value] of Object.entries(structured)) {
    const heading = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (Array.isArray(value)) {
      const items = listItems(value);
      if (items) lines.push(`## ${heading}\n${items}`);
    } else if (value) {
      lines.push(`## ${heading}\n${str(value)}`);
    }
  }
  return lines.join('\n\n');
}

// ─── SSE text extraction helper ───────────────────────────────────────────────

type SseChunk = {
  text?: string;
  delta?: string | { content?: string; text?: string };
  content?: string;
  answer?: string;
  choices?: Array<{ delta?: { content?: string } }>;
};

/**
 * Extract the text fragment from a parsed SSE JSON chunk.
 * Handles multiple streaming formats:
 *   - Simple `{ text }` or `{ answer }` / `{ content }` (custom backends)
 *   - OpenAI chat.completion.chunk: `{ choices[0].delta.content }`
 *   - Anthropic text_delta: `{ delta: { type, text } }`
 *   - String `delta` field
 * Falls back to the raw `data` string when no known field is found.
 */
function extractStreamText(parsed: SseChunk, fallback: string): string {
  if (typeof parsed.text === 'string') return parsed.text;
  if (parsed.choices?.[0]?.delta?.content != null) return parsed.choices[0].delta.content;
  if (parsed.delta != null) {
    if (typeof parsed.delta === 'string') return parsed.delta;
    return parsed.delta.content ?? parsed.delta.text ?? fallback;
  }
  return parsed.content ?? parsed.answer ?? fallback;
}

/**
 * Stream a chat response from the backend.
 * Calls `onChunk` for each text fragment as it arrives.
 * Falls back to a single full-response call when the backend does not support streaming.
 */
export async function sendMessageStream(
  params: SendMessageRequest,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  onRequestId?: (id: string) => void,
  onStreamId?: (id: string) => void,
  onMeta?: (meta: { topic?: string }) => void,
  onReset?: () => void,
): Promise<SendMessageResponse> {
  const authHeaders = await getAuthHeaders();
  const reqId = makeReqId();
  onRequestId?.(reqId);

  try {
  const res = await fetchWithAuth(`${API_BASE}/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': reqId,
      ...authHeaders,
    },
    body: JSON.stringify({
      question: params.question,
      complexity: params.complexity ?? 3,
      mode: params.mode ?? 'study',
      history: params.history ?? [],
      selected_text: params.selected_text ?? '',
      doc_context: params.doc_context ?? '',
      user_memory: params.user_memory ?? '',
      bookId: params.bookId ?? '',
      ...(params.student_profile ? { student_profile: params.student_profile } : {}),
      ...(params.viewer_state != null ? { viewer_state: params.viewer_state } : {}),
      stream: params.mode === 'snap' || params.mode === 'master',
    }),
    signal,
  });

  if (res.status === 429) {
    throw new ApiError('Rate limit reached. Please wait a moment before trying again.', 429);
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const err = (await res.json()) as { detail?: string; message?: string };
      message = err.detail ?? err.message ?? message;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(message, res.status);
  }

  const contentType = res.headers.get('content-type') ?? '';

  // ── Streaming path (SSE or plain chunked text) ────────────────────────────
  if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
    const reader = res.body?.getReader();
    if (!reader) throw new ApiError('No response body', 500);

    const decoder = new TextDecoder();
    let fullText = '';
    let streamViewerAction: ViewerAction | undefined;
    let streamTopic: string | undefined;
    let streamTruncated = false;

    // RAF-based chunk batching: accumulate tokens and flush at most once per
    // animation frame so React re-renders at display rate instead of once per token.
    const scheduleFlush =
      typeof requestAnimationFrame !== 'undefined'
        ? requestAnimationFrame
        : (fn: () => void) => setTimeout(fn, 16) as unknown as number;
    const cancelFlush =
      typeof cancelAnimationFrame !== 'undefined'
        ? cancelAnimationFrame
        : clearTimeout;

    let pendingChunks = '';
    let rafId: number | null = null;

    const flushChunks = () => {
      if (pendingChunks) {
        onChunk(pendingChunks);
        pendingChunks = '';
      }
      rafId = null;
    };

    const bufferChunk = (text: string) => {
      pendingChunks += text;
      if (rafId === null) {
        rafId = scheduleFlush(flushChunks);
      }
    };

    // Inactivity timeout: reset on every received chunk; if no chunk arrives
    // within the window, cancel the reader and surface a timeout error.
    // Prevents the chat from locking up when the server hangs mid-stream.
    const INACTIVITY_TIMEOUT_MS = 90_000;
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    let streamTimedOut = false;
    const resetInactivityTimer = () => {
      if (inactivityTimer !== null) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        streamTimedOut = true;
        reader.cancel();
      }, INACTIVITY_TIMEOUT_MS);
    };
    resetInactivityTimer();

    try {
      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        resetInactivityTimer();

        const chunk = decoder.decode(value, { stream: true });

        // Handle SSE format: lines starting with "data: "
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break outer; // exit both loops
            try {
              const parsed = JSON.parse(data) as SseChunk & { error?: string; meta?: { viewer_action?: ViewerAction; topic?: string; reset?: boolean; truncated?: boolean }; stream_id?: string };
              // Check for a server-sent error before treating the chunk as content
              if (parsed.error) {
                throw new ApiError(parsed.error, 502);
              }
              // Capture stream_id emitted as the first SSE event for recovery.
              if (parsed.stream_id) {
                onStreamId?.(parsed.stream_id);
                continue;
              }
              // Capture metadata event (e.g. viewer_action, topic, reset, truncated) — no text content
              if (parsed.meta) {
                if (parsed.meta.reset === true) {
                  fullText = '';
                  pendingChunks = '';
                  if (rafId !== null) { cancelFlush(rafId); rafId = null; }
                  onReset?.();
                }
                if (parsed.meta.viewer_action) {
                  streamViewerAction = parsed.meta.viewer_action;
                }
                if (parsed.meta.topic) {
                  streamTopic = parsed.meta.topic;
                  onMeta?.({ topic: streamTopic });
                }
                if (parsed.meta.truncated === true) {
                  streamTruncated = true;
                }
                continue;
              }
              const text = extractStreamText(parsed, data);
              fullText += text;
              bufferChunk(text);
            } catch (e) {
              if (e instanceof ApiError) throw e; // propagate server-sent errors
              // Plain text chunk, not JSON
              fullText += data;
              bufferChunk(data);
            }
          } else if (line.trim() && !line.startsWith(':')) {
            // Plain streaming (not SSE format)
            fullText += line;
            bufferChunk(line);
          }
        }
      }
    } finally {
      if (inactivityTimer !== null) clearTimeout(inactivityTimer);
      reader.releaseLock();
      // Cancel any pending RAF and flush remaining buffered text immediately.
      if (rafId !== null) cancelFlush(rafId);
      if (pendingChunks) onChunk(pendingChunks);
    }

    if (streamTimedOut) {
      throw new ApiError('Connection timed out. Please check your network and try again.', 504);
    }

    if (!fullText.trim()) {
      throw new ApiError('No response received from AI. Please retry.', 502);
    }
    return {
      success: true,
      answer: fullText,
      mode: params.mode ?? 'study',
      requestId: reqId,
      ...(streamTopic ? { topic: streamTopic } : {}),
      ...(streamViewerAction ? { viewer_action: streamViewerAction } : {}),
      ...(streamTruncated ? { truncated: true } : {}),
    };
  }

  // ── Fallback: full JSON response ──────────────────────────────────────────
  const data = (await res.json()) as SendMessageResponse & { text?: string };
  let answerText = data.answer ?? data.text ?? '';

  // For structured modes (chunk/master/research) the backend returns the raw JSON
  // string as `answer` and the parsed object as `structured`. Convert the parsed
  // object to readable Markdown so it is never displayed as raw JSON.
  if (data.structured && typeof data.structured === 'object') {
    const formatted = formatStructuredResponse(data.structured);
    if (formatted.trim()) {
      answerText = formatted;
    }
  }

  if (!answerText.trim()) {
    // The backend returned a 2xx but with no usable answer — surface this as an
    // error so the catch block in handleSendMessage can remove the empty bubble
    // and show a proper error bar instead of the silent "No response received."
    throw new ApiError('No response received from AI. Please retry.', 502);
  }
  onChunk(answerText);
  return { ...data, answer: answerText, requestId: reqId };
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[req:%s] sendMessageStream error:', reqId, err);
    }
    throw err;
  }
}

// ─── Flashcards ───────────────────────────────────────────────────────────────

export async function generateFlashcards(
  params: GenerateFlashcardsRequest,
): Promise<GenerateFlashcardsResponse> {
  return apiPost<GenerateFlashcardsResponse>('/generate-flashcards', {
    topic: params.topic,
    count: params.count ?? 10,
    ...(params.bookId ? { bookId: params.bookId } : {}),
  });
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export async function generateQuiz(params: GenerateQuizRequest): Promise<GenerateQuizResponse> {
  const attempt = () => apiPost<GenerateQuizResponse>('/generate-quiz', {
    slides: params.slides,
    count: params.count ?? 10,
    difficulty: params.difficulty ?? 'medium',
    mode: params.mode ?? 'standard',
    question_type: params.question_type ?? 'mcq',
    existingQuestions: params.existingQuestions ?? [],
    ...(params.bookId ? { bookId: params.bookId } : {}),
  });
  try {
    return await attempt();
  } catch (err) {
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
      throw err; // Don't retry client errors (400, 401, 403, 429)
    }
    // Network error or 5xx — wait 1.5s and retry once
    await new Promise<void>((r) => setTimeout(r, 1500));
    return attempt();
  }
}

/**
 * Converts a plain topic string into the slides array format the /generate-quiz
 * endpoint expects. Use when you don't have a real uploaded document.
 */
export function topicToSlides(topic: string): SlideItem[] {
  return [{ title: topic, slide_number: 1, content: [topic], notes: '' }];
}

// ─── Study materials ──────────────────────────────────────────────────────────

export async function generateStudyMaterials(
  params: GenerateStudyMaterialsRequest,
): Promise<GenerateStudyMaterialsResponse> {
  return apiPost<GenerateStudyMaterialsResponse>('/generate-study-materials', params);
}

// ─── Library ──────────────────────────────────────────────────────────────────

export interface LibraryBookRaw {
  id: string;
  name: string;
  author?: string;
  available?: boolean;
}

export interface LibraryResponse {
  books: LibraryBookRaw[];
}

export async function fetchLibrary(): Promise<LibraryResponse> {
  return apiGet<LibraryResponse>('/get-library');
}

export async function loadBook(bookId: string): Promise<void> {
  await apiPost<unknown>('/load-book', { bookId });
}

/**
 * Fetches the PDF for a given book and returns a blob URL that can be used
 * in an <iframe> or <embed> without cross-origin issues.
 * The caller is responsible for revoking the URL via URL.revokeObjectURL().
 */
export async function fetchBookPdf(bookId: string): Promise<string> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchWithAuth(`${API_BASE}/books/${bookId}/pdf`, {
    method: 'GET',
    headers: authHeaders,
  });

  if (!res.ok) {
    throw new ApiError(`Could not load PDF for book "${bookId}" (${res.status})`, res.status);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ─── Document upload ──────────────────────────────────────────────────────────

// ─── Tutor Brain ──────────────────────────────────────────────────────────────

export interface TutorStudentModel {
  mastered: string[];
  gaps: Array<{
    concept: string;
    status: string;
    failedAt: string;
    lastSeenAt: string;
    passCount: number;
  }>;
  quizHistory: Array<{
    topic: string;
    score: number;
    wrongAnswers: string[];
    timestamp: string;
  }>;
}

export interface LoadTutorModelResponse {
  student_model: TutorStudentModel | null;
}

export async function loadTutorModel(userId: string, bookId?: string): Promise<TutorStudentModel | null> {
  const params = new URLSearchParams({ user_id: userId });
  if (bookId) params.set('book_id', bookId);
  const res = await apiGet<LoadTutorModelResponse>(`/tutor/load-model?${params.toString()}`);
  return res.student_model;
}

export async function saveTutorModel(
  userId: string,
  studentModel: TutorStudentModel,
  bookId?: string,
): Promise<void> {
  await apiPost<unknown>('/tutor/save-model', {
    user_id: userId,
    student_model: studentModel,
    ...(bookId ? { book_id: bookId } : {}),
  });
}

export interface AnalyzeGapsQuizResult {
  topic: string;
  score: number;
  wrongAnswers: string[];
}

export interface DetectedGap {
  concept: string;
  status: string;
  score: number;
  chain?: string[];
  chain_completeness?: number;
  prereq_locations?: Record<string, unknown>;
}

export interface AnalyzeGapsResponse {
  detected_gaps: DetectedGap[];
  prereq_warnings: Array<{ concept: string; chain_completeness: number }>;
  student_profile_block: string;
}

export async function analyzeGaps(
  bookId: string,
  quizResults: AnalyzeGapsQuizResult[],
  knownConcepts: string[],
): Promise<AnalyzeGapsResponse> {
  return apiPost<AnalyzeGapsResponse>('/tutor/analyze-gaps', {
    book_id: bookId,
    quiz_results: quizResults,
    known_concepts: knownConcepts,
  });
}

export interface EvaluateSocraticResponse {
  correct: boolean;
  feedback: string;
}

export async function evaluateSocraticAnswer(
  question: string,
  studentAnswer: string,
  topic: string,
): Promise<EvaluateSocraticResponse> {
  return apiPost<EvaluateSocraticResponse>('/tutor/evaluate-socratic', {
    question,
    student_answer: studentAnswer,
    topic,
  });
}

// ─── Document upload ──────────────────────────────────────────────────────────

export async function uploadDocument(file: File): Promise<UploadDocumentResponse> {
  const authHeaders = await getAuthHeaders();
  const form = new FormData();
  form.append('file', file);

  const res = await fetchWithAuth(`${API_BASE}/upload-document`, {
    method: 'POST',
    headers: authHeaders, // no Content-Type — browser sets multipart boundary
    body: form,
  });

  if (res.status === 429) {
    throw new ApiError('Rate limit reached. Please wait a moment before trying again.', 429);
  }

  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const err = (await res.json()) as { detail?: string; message?: string };
      message = err.detail ?? err.message ?? message;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<UploadDocumentResponse>;
}

// ─── Next topic recommendation ────────────────────────────────────────────────

export interface NextTopicGap {
  concept: string;
  status: string;
}

export interface NextTopicResponse {
  concept_name: string;
  chapter: number;
  page: number;
  reason: string;
}

/**
 * Asks the backend to recommend the next concept to study based on the PAEV
 * graph and the student's current gap list.
 *
 * Returns null if the book has no PAEV index built yet, no gap candidates are
 * ready, or the request fails for any reason — callers should fail silently.
 */
export async function fetchNextTopic(
  bookId: string,
  studentGaps: NextTopicGap[],
  currentPage = 0,
): Promise<NextTopicResponse | null> {
  try {
    return await apiPost<NextTopicResponse>('/tutor/next-topic', {
      book_id: bookId,
      current_page: currentPage,
      student_gaps: studentGaps,
    });
  } catch {
    return null;
  }
}

// ─── PAEV readiness check ──────────────────────────────────────────────────

/**
 * Polls whether the PAEV index has finished building for a user-uploaded
 * document.  Returns true when ready, false otherwise (including on error).
 */
export async function checkPaevStatus(bookId: string): Promise<boolean> {
  try {
    const res = await apiGet<{ ready: boolean }>(`/tutor/paev-status?book_id=${encodeURIComponent(bookId)}`);
    return res.ready === true;
  } catch {
    return false;
  }
}

// ─── Viewer session ───────────────────────────────────────────────────────────

// ViewerStatePayload is imported from @/types/api

/**
 * Fire-and-forget: persist the student's current viewer state on the server
 * so that /ask calls can be context-aware even when the frontend omits
 * viewer_state from the request body.
 *
 * Never throws — failures are silently swallowed to avoid blocking the UI.
 */
export function setViewerState(viewerState: ViewerStatePayload): void {
  void (async () => {
    try {
      await apiPost<unknown>('/api/viewer/set-state', { viewer_state: viewerState });
    } catch {
      // fire-and-forget: ignore errors
    }
  })();
}

/**
 * Read back the viewer state the server has stored for the current user.
 * Returns null when no state is stored or on any error.
 */
export async function getViewerState(): Promise<ViewerStatePayload | null> {
  try {
    const res = await apiGet<{ success: boolean; viewer_state: ViewerStatePayload | null }>(
      '/api/viewer/get-state',
    );
    return res.viewer_state ?? null;
  } catch {
    return null;
  }
}

// ─── YouTube ingestion ────────────────────────────────────────────────────────

export interface YouTubeIngestResponse {
  success: boolean;
  video_id: string;
  title: string;
  duration_seconds: number;
  slides: SlideItem[];
  transcript_full: string;
  total_slides: number;
  cached?: boolean;
}

/**
 * Ingest a YouTube video by URL using a two-step approach:
 *   1. GET /api/youtube/transcript fetches the transcript via the Next.js
 *      server-side proxy (InnerTube API, no browser CORS exposure).
 *   2. POST /api/youtube/process sends the pre-fetched entries to the backend
 *      for chunking and persistent caching (Redis + Supabase).
 *
 * Using the server proxy avoids CORS failures that can occur when browsers
 * make direct cross-origin requests to YouTube on certain networks or regions.
 *
 * Returns structured slide/transcript data that can be used as AI context.
 */
export async function ingestYouTube(url: string): Promise<YouTubeIngestResponse> {
  const proxyRes = await fetch(`/api/youtube/transcript?url=${encodeURIComponent(url)}`);
  if (!proxyRes.ok) {
    let message = `Failed to fetch transcript (${proxyRes.status})`;
    try {
      const err = (await proxyRes.json()) as { error?: string };
      message = err.error ?? message;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(message, proxyRes.status);
  }
  const { videoId, title, entries, sig } = await proxyRes.json() as {
    videoId: string;
    title: string;
    entries: { text: string; start: number; duration: number }[];
    sig?: string;
  };
  return apiPost<YouTubeIngestResponse>('/api/youtube/process', {
    video_id: videoId,
    title,
    entries,
    sig,
  });
}

// ─── Research ingestion ───────────────────────────────────────────────────────

export interface ResearchIngestResponse {
  paper_id: string;
  type: string;
  title?: string;
  authors?: string[];
  year?: number;
  abstract?: string;
  source_url?: string;
  journal?: string;
  doi?: string;
  pages?: string;
}

/**
 * Ingest a research paper by arXiv ID, DOI, or URL.
 * Returns structured metadata (title, authors, year, abstract).
 */
export async function ingestResearch(url: string): Promise<ResearchIngestResponse> {
  return apiPost<ResearchIngestResponse>('/api/research/ingest', { url });
}

// ─── Professor Listen Mode ────────────────────────────────────────────────────

/**
 * Request audio narration for the current PDF page.
 *
 * POSTs to /api/listen/page. On success the backend returns raw audio/mpeg
 * bytes. On error it returns a JSON { success: false, error: string }.
 *
 * Returns a Blob (audio/mpeg) on success, or throws ApiError on failure.
 */
export async function listenToPage(params: ListenPageRequest): Promise<Blob> {
  const reqId = makeReqId();
  const authHeaders = await getAuthHeaders();

  const res = await fetchWithAuth(`${API_BASE}/api/listen/page`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': reqId,
      ...authHeaders,
    },
    body: JSON.stringify(params),
  });

  if (res.status === 429) {
    throw new ApiError('Rate limit reached. Please wait a moment before trying again.', 429);
  }

  if (!res.ok) {
    // The backend returns JSON errors for non-2xx responses.
    let message = `Listen request failed (${res.status})`;
    try {
      const err = (await res.json()) as { error?: string; detail?: string };
      message = err.error ?? err.detail ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, res.status);
  }

  return res.blob();
}
