/**
 * lib/researchApi.ts — Research-mode API helpers.
 *
 * Provides two search strategies:
 *   1. searchContent() — calls the backend /ask endpoint with mode:'research'
 *      which performs semantic search across the loaded book library and/or
 *      the web (when the web filter is active).
 *   2. searchMyDocuments() — pure client-side keyword search across the slides
 *      the user has uploaded in the current session.
 */

import { getAccessToken } from './supabaseClient';
import { ApiError } from '@/types/api';
import type { SlideItem } from '@/types/api';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.chunks.online').replace(/\/$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResultSource = 'document' | 'library' | 'web';

export interface ResearchResult {
  id: string;
  source: ResultSource;
  sourceLabel: string;
  title: string;
  excerpt: string;
  relevanceScore: number; // 0–100
  bookId?: string;
  slideNumber?: number;
}

export type ResearchFilter = 'all' | 'my-documents' | 'library' | 'web';

// ─── Backend search ───────────────────────────────────────────────────────────

interface AskResearchResponse {
  success: boolean;
  answer: string;
  sources?: Array<{
    title?: string;
    excerpt?: string;
    source?: string;
    relevance?: number;
    bookId?: string;
  }>;
}

/**
 * Calls the /ask endpoint in research mode.
 * Falls back to parsing the free-text answer into result cards when the
 * backend does not return a structured `sources` array.
 */
export async function searchContent(
  query: string,
  filters: ResearchFilter[],
  signal?: AbortSignal,
): Promise<ResearchResult[]> {
  const token = await getAccessToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      question: query,
      mode: 'research',
      web_search: filters.includes('web'),
      complexity: 5,
      history: [],
      doc_context: '',
    }),
    signal,
  });

  if (res.status === 429) {
    throw new ApiError('Rate limit reached. Please wait a moment.', 429);
  }
  if (!res.ok) {
    let message = `Search failed (${res.status})`;
    try {
      const err = (await res.json()) as { detail?: string; message?: string };
      message = err.detail ?? err.message ?? message;
    } catch { /* ignore */ }
    throw new ApiError(message, res.status);
  }

  const data = (await res.json()) as AskResearchResponse;

  // If the backend returned structured sources, convert them
  if (data.sources && data.sources.length > 0) {
    return data.sources.map((s, i) => ({
      id: `result-${i}`,
      source: guessSource(s.source ?? ''),
      sourceLabel: s.source ?? 'Library',
      title: s.title ?? `Result ${i + 1}`,
      excerpt: s.excerpt ?? '',
      relevanceScore: Math.round((s.relevance ?? 0.8) * 100),
      bookId: s.bookId,
    }));
  }

  // Fallback: wrap the AI answer as a single result card
  return [
    {
      id: 'result-0',
      source: 'library' as ResultSource,
      sourceLabel: 'AI Answer',
      title: query,
      excerpt: data.answer ?? '',
      relevanceScore: 85,
    },
  ];
}

function guessSource(label: string): ResultSource {
  const l = label.toLowerCase();
  if (l.includes('web') || l.includes('http') || l.includes('www')) return 'web';
  if (l.includes('my') || l.includes('upload') || l.includes('doc')) return 'document';
  return 'library';
}

// ─── Client-side document search ─────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','have','has','had','do','does','did',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Performs client-side keyword search across the user's uploaded slides.
 * Returns results ranked by keyword overlap, descending.
 */
export function searchMyDocuments(
  query: string,
  slides: SlideItem[],
  docTitle: string,
): ResearchResult[] {
  if (slides.length === 0) return [];

  const keywords = tokenize(query);
  if (keywords.length === 0) return [];

  const scored = slides.map((slide, index) => {
    const text = [slide.title, ...slide.content, slide.notes ?? ''].join(' ').toLowerCase();
    const score = keywords.reduce((sum, kw) => {
      let count = 0;
      let pos = text.indexOf(kw);
      while (pos !== -1) { count++; pos = text.indexOf(kw, pos + 1); }
      return sum + count;
    }, 0);
    const excerpt = slide.content.join(' ').slice(0, 200);
    return { slide, score, index, excerpt };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((s, i) => ({
      id: `doc-${i}`,
      source: 'document' as ResultSource,
      sourceLabel: docTitle || 'My Document',
      title: s.slide.title || `Page ${s.slide.slide_number ?? s.index + 1}`,
      excerpt: s.excerpt,
      relevanceScore: Math.min(100, Math.round((s.score / keywords.length) * 50)),
      slideNumber: s.slide.slide_number ?? s.index + 1,
    }));
}
