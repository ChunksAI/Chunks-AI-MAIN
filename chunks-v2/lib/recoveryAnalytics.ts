/**
 * lib/recoveryAnalytics.ts — Recovery Rate Analytics Pipeline
 *
 * Measures the success rate of the AI's PAEV-guided interventions:
 *   1. A concept is marked 'failing' via tbRecordGap.
 *   2. The student studies it (PAEV/Socratic intervention) via tbRecordStudying
 *      when the gap status is 'failing' → this opens a RecoveryAttempt window.
 *   3. The student takes a quiz on that concept via tbRecordQuizResult
 *      → this closes the window and records whether they recovered (score > 70).
 *
 * Recovery Rate = recovered windows / total closed windows (0–1).
 *
 * All state is persisted to localStorage under 'chunks_recovery_analytics'.
 * Pure functions only — no React imports.  React consumers use useRecoveryRate.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecoveryAttempt {
  /** The concept being tracked. */
  concept: string;
  /** ISO timestamp of when tbRecordGap first marked this concept 'failing'. */
  failedAt: string;
  /** ISO timestamp of when the PAEV-guided study session started (window opens). */
  studiedAt: string;
  /** ISO timestamp of when the quiz was taken. null = window still open. */
  quizTakenAt: string | null;
  /** Raw quiz score 0–100. null when pending. */
  quizScore: number | null;
  /** true if score > RECOVERY_THRESHOLD, false if not, null when pending. */
  recovered: boolean | null;
}

export interface RecoveryStats {
  /** Number of completed attempts (quiz has been taken). */
  total: number;
  /** Number of completed attempts where the student recovered (score > threshold). */
  recovered: number;
  /** Recovery rate in the range 0–1. Returns 0 when total === 0. */
  rate: number;
  /** Percentage representation of rate (0–100, rounded). */
  ratePct: number;
  /** Number of open windows (intervention started but no quiz taken yet). */
  pending: number;
  /** Full attempt log (open + closed), most-recent first. */
  attempts: RecoveryAttempt[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'chunks_recovery_analytics';

/**
 * Minimum quiz score to count as "recovered".
 * Matches the threshold in useTutorBrain (score > 70 → 'recovering').
 */
export const RECOVERY_SCORE_THRESHOLD = 70;

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadAttempts(): RecoveryAttempt[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecoveryAttempt[];
  } catch {
    return [];
  }
}

function saveAttempts(attempts: RecoveryAttempt[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
    // Notify useRecoveryRate consumers that data changed
    window.dispatchEvent(new CustomEvent('chunks:recovery-changed'));
  } catch {
    // Best-effort — ignore storage quota errors
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Opens a recovery tracking window for a concept that has just transitioned
 * from 'failing' into active study (PAEV or Socratic intervention).
 *
 * Should be called from tbRecordStudying when the concept's current status
 * in the StudentModel is 'failing'.
 *
 * Idempotent: if a window is already open for this concept, this is a no-op
 * so that repeated tbRecordStudying calls don't create duplicate entries.
 */
export function openRecoveryWindow(concept: string, failedAt: string): void {
  const attempts = loadAttempts();
  const alreadyOpen = attempts.some((a) => a.concept === concept && a.quizTakenAt === null);
  if (alreadyOpen) return;
  attempts.unshift({
    concept,
    failedAt,
    studiedAt: new Date().toISOString(),
    quizTakenAt: null,
    quizScore: null,
    recovered: null,
  });
  saveAttempts(attempts);
}

/**
 * Closes the most-recent open recovery window for a concept by recording the
 * quiz result.  Called from tbRecordQuizResult.
 *
 * No-op when there is no open window for the concept (e.g. a quiz taken without
 * a prior PAEV intervention).
 */
export function closeRecoveryWindow(concept: string, score: number): void {
  const attempts = loadAttempts();
  let changed = false;
  let closedOne = false;

  const updated = attempts.map((a) => {
    // Only close the first (most-recent) open window per concept
    if (a.concept !== concept || a.quizTakenAt !== null || closedOne) return a;
    closedOne = true;
    changed = true;
    return {
      ...a,
      quizTakenAt: new Date().toISOString(),
      quizScore: score,
      recovered: score > RECOVERY_SCORE_THRESHOLD,
    };
  });

  if (changed) saveAttempts(updated);
}

/**
 * Computes aggregate recovery statistics from all recorded attempts.
 */
export function computeRecoveryStats(): RecoveryStats {
  const attempts = loadAttempts();
  const completed = attempts.filter((a) => a.quizTakenAt !== null);
  const recoveredCount = completed.filter((a) => a.recovered === true).length;
  const pendingCount = attempts.filter((a) => a.quizTakenAt === null).length;
  const rate = completed.length > 0 ? recoveredCount / completed.length : 0;
  return {
    total: completed.length,
    recovered: recoveredCount,
    rate,
    ratePct: Math.round(rate * 100),
    pending: pendingCount,
    attempts,
  };
}

/**
 * Returns only the currently open (pending) recovery windows.
 * Useful for displaying "in-progress interventions".
 */
export function getOpenRecoveryWindows(): RecoveryAttempt[] {
  return loadAttempts().filter((a) => a.quizTakenAt === null);
}

/**
 * Clears all recovery analytics data from localStorage.
 * Intended for testing or user-triggered data resets only.
 */
export function clearRecoveryAnalytics(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('chunks:recovery-changed'));
}
