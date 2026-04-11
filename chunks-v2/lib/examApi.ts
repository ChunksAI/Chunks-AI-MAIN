/**
 * lib/examApi.ts — Exam-mode API functions
 *
 * Step 1: extractConceptsFromSlides — client-side concept extraction (no API call).
 *         Groups slides by their title field so each unique title becomes one concept.
 *         Capped at maxConcepts by even downsampling.
 *
 * Step 2: generateConceptQuestions → POST /generate-quiz (per concept)
 *
 * generateConceptQuestions goes through the same apiPost() helper used by studyApi.ts.
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

// ─── Client-side concept extraction — no API needed ───────────────────────────
//
// Groups slides by their title field so each unique heading becomes one concept.
// Capped at maxConcepts (default 10) via even downsampling so we don't spam the
// quiz endpoint with 50+ separate calls on large documents.

export function extractConceptsFromSlides(
  slides: SlideItem[],
  maxConcepts = 10,
): ConceptChunk[] {
  if (slides.length === 0) return [];

  // Group slide numbers by title (deduplicate same-title slides)
  const titleMap = new Map<string, number[]>();
  slides.forEach((slide, i) => {
    const key = (slide.title?.trim()) || `Slide ${i + 1}`;
    if (!titleMap.has(key)) titleMap.set(key, []);
    titleMap.get(key)!.push(slide.slide_number ?? i + 1);
  });

  // Build ConceptChunk for each unique title
  const allConcepts: ConceptChunk[] = [];
  let idx = 0;
  for (const [title, refs] of titleMap) {
    const relatedContent = slides
      .filter((s, i) => refs.includes(s.slide_number ?? i + 1))
      .flatMap((s) => s.content);
    const summary = relatedContent.slice(0, 2).join(' ');

    allConcepts.push({
      id: `concept-${idx}`,
      concept: title,
      summary,
      questionCount: 2,
      slideRefs: refs,
    });
    idx++;
  }

  // Evenly downsample to maxConcepts so large docs don't create too many API calls
  if (allConcepts.length <= maxConcepts) return allConcepts;
  const step = allConcepts.length / maxConcepts;
  return Array.from({ length: maxConcepts }, (_, i) =>
    allConcepts[Math.min(Math.round(i * step), allConcepts.length - 1)],
  );
}

// ─── Generate questions scoped to one concept ─────────────────────────────────

const MIN_CONTEXT_SLIDES = 3;

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
  let slidesToUse = filteredSlides.length > 0 ? filteredSlides : params.slides;

  // Pad to MIN_CONTEXT_SLIDES so /generate-quiz has enough context for good questions
  if (slidesToUse !== params.slides && slidesToUse.length < MIN_CONTEXT_SLIDES) {
    const existing = new Set(slidesToUse.map((s) => s.slide_number ?? -1));
    const extras = params.slides.filter((s) => !existing.has(s.slide_number ?? -1));
    slidesToUse = [...slidesToUse, ...extras].slice(0, MIN_CONTEXT_SLIDES);
  }

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
