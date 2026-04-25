/**
 * tutorStorage.ts — shared localStorage helpers for the student knowledge model.
 *
 * All reads and writes are scoped to a (userId, bookId) pair so that models
 * never bleed across users, books, or guest sessions.
 *
 * Key format:
 *   authenticated : "chunks_student_model:<userId>:<bookId>"
 *   guest         : "chunks_student_model:guest:<bookId>"
 *   unknown book  : "chunks_student_model:<userId>:" (degrades gracefully)
 */

import type { StudentModel } from '@/hooks/useTutorBrain';

const BASE_KEY = 'chunks_student_model';

// ─── Key generation ───────────────────────────────────────────────────────────

/**
 * Returns a scoped localStorage key for the given user + book.
 * If userId is absent or the user is a guest, the user segment is "guest".
 * If bookId is absent the book segment is an empty string (still better than
 * the old global key, and the backend call will also lack a bookId).
 */
export function getStorageKey(userId: string | undefined | null, bookId: string | undefined | null): string {
  const userSegment = userId && userId !== 'guest' ? userId : 'guest';
  const bookSegment = bookId ?? '';
  return `${BASE_KEY}:${userSegment}:${bookSegment}`;
}

// ─── Empty model factory ──────────────────────────────────────────────────────

export function emptyModel(): StudentModel {
  return { mastered: [], gaps: [], quizHistory: [] };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isValidModel(parsed: unknown): parsed is StudentModel {
  return (
    parsed !== null &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as StudentModel).mastered) &&
    Array.isArray((parsed as StudentModel).gaps) &&
    Array.isArray((parsed as StudentModel).quizHistory)
  );
}

// ─── Read / write ─────────────────────────────────────────────────────────────

export function loadModel(storageKey: string): StudentModel {
  if (typeof window === 'undefined') return emptyModel();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return emptyModel();
    const parsed = JSON.parse(raw) as unknown;
    return isValidModel(parsed) ? parsed : emptyModel();
  } catch {
    return emptyModel();
  }
}

export function saveModel(storageKey: string, model: StudentModel): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(model));
  } catch {
    // Ignore quota errors — persistence is best-effort
  }
}

// ─── Profile builder ──────────────────────────────────────────────────────────

/**
 * Reads the student knowledge model for the given user + book and formats it
 * into a prompt-injection string that can be attached to every AI chat request.
 *
 * Format:
 *   [STUDENT PROFILE]
 *   Gaps: concept (failing), concept (reviewing)
 *   Mastered: X, Y, Z
 *   Low quiz scores: topic (40%)
 */
export function buildStudentProfile(userId: string | undefined | null, bookId: string | undefined | null): string {
  const key = getStorageKey(userId, bookId);
  const raw = loadModel(key);

  // Trim: top-8 gaps by urgency, last-10 mastered, all quizHistory
  const STATUS_URGENCY: Record<string, number> = {
    failing: 4,
    regressed: 3,
    reviewing: 2,
    recovering: 1,
  };

  const sortedGaps = [...raw.gaps].sort((a, b) => {
    const urgencyDiff = (STATUS_URGENCY[b.status] ?? 0) - (STATUS_URGENCY[a.status] ?? 0);
    if (urgencyDiff !== 0) return urgencyDiff;
    return new Date(b.failedAt).getTime() - new Date(a.failedAt).getTime();
  });

  const gaps = sortedGaps.slice(0, 8);
  const mastered = raw.mastered.slice(-10);

  const gapsPart = gaps.length > 0 ? gaps.map((g) => `${g.concept} (${g.status})`).join(', ') : 'none';
  const masteredPart = mastered.length > 0 ? mastered.join(', ') : 'none';

  const latestByTopic = new Map<string, number>();
  for (const entry of raw.quizHistory) {
    latestByTopic.set(entry.topic, entry.score);
  }
  const lowScores = [...latestByTopic.entries()]
    .filter(([, score]) => score < 80)
    .map(([topic, score]) => `${topic} (${score}%)`)
    .join(', ');
  const lowScoresPart = lowScores || 'none';

  return `[STUDENT PROFILE]\nGaps: ${gapsPart}\nMastered: ${masteredPart}\nLow quiz scores: ${lowScoresPart}`;
}
