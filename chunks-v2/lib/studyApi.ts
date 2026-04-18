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

/** Generate a short 6-character alphanumeric request ID for tracing. */
function makeReqId(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function fetchWithAuth(url: string, options: RequestInit): Promise<Response> {
  const res = await fetch(url, options);

  // 403 — forbidden, do not retry
  if (res.status === 403) return res;

  if (res.status !== 401) return res;

  // ── First 401: try to refresh the session ────────────────────────────────
  try {
    const sb = await getSupabaseClient();
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
    const src = listItems(structured.sources);
    if (src) lines.push(`## Sources\n${src}`);
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
      stream: true,
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

    try {
      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Handle SSE format: lines starting with "data: "
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break outer; // exit both loops
            try {
              const parsed = JSON.parse(data) as SseChunk & { error?: string };
              // Check for a server-sent error before treating the chunk as content
              if (parsed.error) {
                throw new ApiError(parsed.error, 502);
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
      reader.releaseLock();
      // Cancel any pending RAF and flush remaining buffered text immediately.
      if (rafId !== null) cancelFlush(rafId);
      if (pendingChunks) onChunk(pendingChunks);
    }

    if (!fullText.trim()) {
      throw new ApiError('No response received from AI. Please retry.', 502);
    }
    return { success: true, answer: fullText, mode: params.mode ?? 'study', requestId: reqId };
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
    console.error('[req:%s] sendMessageStream error:', reqId, err);
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

export async function loadTutorModel(userId: string): Promise<TutorStudentModel | null> {
  const res = await apiGet<LoadTutorModelResponse>(
    `/tutor/load-model?user_id=${encodeURIComponent(userId)}`,
  );
  return res.student_model;
}

export async function saveTutorModel(
  userId: string,
  studentModel: TutorStudentModel,
): Promise<void> {
  await apiPost<unknown>('/tutor/save-model', {
    user_id: userId,
    student_model: studentModel,
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
