/**
 * lib/examApi.ts — Exam-mode API functions
 *
 * Step 1: extractConcepts  → POST /extract-concepts
 * Step 2: generateConceptQuestions → POST /generate-quiz (per concept)
 *
 * Both go through the same apiPost() helper used by studyApi.ts.
 */

import type { SlideItem } from '@/types/api';
import type { ConceptChunk, ExamQuestion } from '@/types/exam';
import { ApiError } from '@/types/api';
import { getAccessToken } from './supabaseClient';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.chunks.online').replace(/\/$/, '');

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
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

// ─── Extract concept chunks from slides ───────────────────────────────────────

export async function extractConcepts(params: {
  slides: SlideItem[];
  maxConcepts?: number;
}): Promise<{ concepts: ConceptChunk[] }> {
  return apiPost<{ concepts: ConceptChunk[] }>('/extract-concepts', {
    slides: params.slides,
    max_concepts: params.maxConcepts ?? 10,
  });
}

// ─── Generate questions scoped to one concept ─────────────────────────────────

export async function generateConceptQuestions(params: {
  concept: string;
  summary: string;
  slides: SlideItem[];
  slideRefs: number[];
  count: number;
  difficulty: 'easy' | 'medium' | 'hard';
}): Promise<{ questions: ExamQuestion[] }> {
  // Filter slides to only those referenced by this concept
  const filteredSlides: SlideItem[] = params.slides.filter((s) =>
    params.slideRefs.includes(s.slide_number ?? 0),
  );
  // Fall back to all slides if the refs didn't match (e.g. numbering mismatch)
  const slidesToUse = filteredSlides.length > 0 ? filteredSlides : params.slides;

  // Prepend concept context as a synthetic first slide so the model stays focused
  const conceptSlide: SlideItem = {
    title: `Concept: ${params.concept}`,
    slide_number: 0,
    content: [params.summary],
    notes: '',
  };

  return apiPost<{ questions: ExamQuestion[] }>('/generate-quiz', {
    slides: [conceptSlide, ...slidesToUse],
    count: params.count,
    difficulty: params.difficulty,
    mode: 'exam',
    question_type: 'mcq',
    existingQuestions: [],
  });
}
