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
import { getAccessToken } from './supabaseClient';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.chunks.online').replace(/\/$/, '');

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
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
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: { ...authHeaders },
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

  return res.json() as Promise<T>;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function sendMessage(params: SendMessageRequest): Promise<SendMessageResponse> {
  return apiPost<SendMessageResponse>('/ask', {
    question: params.question,
    complexity: params.complexity ?? 3,
    mode: params.mode ?? 'study',
    thinking: params.thinking ?? null,
    history: params.history ?? [],
    selected_text: params.selected_text ?? '',
    doc_context: params.doc_context ?? '',
    user_memory: params.user_memory ?? '',
    ...(params.bookId ? { bookId: params.bookId } : {}),
  });
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
): Promise<SendMessageResponse> {
  const authHeaders = await getAuthHeaders();

  const res = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      question: params.question,
      complexity: params.complexity ?? 3,
      mode: params.mode ?? 'study',
      thinking: params.thinking ?? null,
      history: params.history ?? [],
      selected_text: params.selected_text ?? '',
      doc_context: params.doc_context ?? '',
      user_memory: params.user_memory ?? '',
      bookId: params.bookId ?? '',
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
              const parsed = JSON.parse(data) as { text?: string; delta?: string };
              const text = parsed.text ?? parsed.delta ?? data;
              fullText += text;
              onChunk(text);
            } catch {
              // Plain text chunk, not JSON
              fullText += data;
              onChunk(data);
            }
          } else if (line.trim() && !line.startsWith(':')) {
            // Plain streaming (not SSE format)
            fullText += line;
            onChunk(line);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { success: true, answer: fullText, mode: params.mode ?? 'study' };
  }

  // ── Fallback: full JSON response ──────────────────────────────────────────
  const data = (await res.json()) as SendMessageResponse;
  onChunk(data.answer ?? '');
  return data;
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
  return apiPost<GenerateQuizResponse>('/generate-quiz', {
    slides: params.slides,
    count: params.count ?? 10,
    difficulty: params.difficulty ?? 'medium',
    mode: params.mode ?? 'standard',
    question_type: params.question_type ?? 'mcq',
    existingQuestions: params.existingQuestions ?? [],
  });
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
  const res = await fetch(`${API_BASE}/books/${bookId}/pdf`, {
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

export async function uploadDocument(file: File): Promise<UploadDocumentResponse> {
  const authHeaders = await getAuthHeaders();
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE}/upload-document`, {
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
