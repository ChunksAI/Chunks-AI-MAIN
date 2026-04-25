'use client';

import { useState, useCallback, useEffect } from 'react';
import { openRecoveryWindow, closeRecoveryWindow } from '@/lib/recoveryAnalytics';
import { getStorageKey, loadModel as _loadModel, saveModel as _saveModel, emptyModel } from '@/lib/tutorStorage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConceptStatus = 'failing' | 'reviewing' | 'recovering' | 'regressed';

export interface GapEntry {
  concept: string;
  status: ConceptStatus;
  failedAt: string;
  lastSeenAt: string;
  passCount: number;
}

export interface QuizHistoryEntry {
  topic: string;
  score: number;
  wrongAnswers: string[];
  timestamp: string;
}

export interface StudentModel {
  mastered: string[];
  gaps: GapEntry[];
  quizHistory: QuizHistoryEntry[];
}

// ─── Ranking helpers ──────────────────────────────────────────────────────────

const STATUS_URGENCY: Record<ConceptStatus, number> = {
  failing: 4,
  regressed: 3,
  reviewing: 2,
  recovering: 1,
};

/**
 * Returns a trimmed view of the model:
 * - gaps: top 8 by urgency (status weight desc, then most-recently-failed desc)
 * - mastered: 10 most recently mastered concepts (last-in = most recent)
 * - quizHistory: unchanged (consumers may slice as needed)
 */
function trimModel(model: StudentModel): StudentModel {
  const sortedGaps = [...model.gaps].sort((a, b) => {
    const urgencyDiff = STATUS_URGENCY[b.status] - STATUS_URGENCY[a.status];
    if (urgencyDiff !== 0) return urgencyDiff;
    return new Date(b.failedAt).getTime() - new Date(a.failedAt).getTime();
  });

  return {
    mastered: model.mastered.slice(-10),
    gaps: sortedGaps.slice(0, 8),
    quizHistory: model.quizHistory,
  };
}

// ─── Profile builder (standalone, no React) ──────────────────────────────────

/**
 * Reads the student knowledge model from localStorage and formats it into a
 * prompt-injection string that can be attached to every AI chat request.
 *
 * Format:
 *   [STUDENT PROFILE]
 *   Gaps: concept (failing), concept (reviewing)
 *   Mastered: X, Y, Z
 *   Low quiz scores: topic (40%)
 *
 * Safe to call outside React (e.g. inside useCallback / event handlers).
 *
 * @deprecated Prefer importing `buildStudentProfile` from `@/lib/tutorStorage`
 * and passing `userId` + `bookId` explicitly for proper per-user/per-book scoping.
 * This overload is kept for backwards compatibility; it reads from the global key.
 */
export { buildStudentProfile } from '@/lib/tutorStorage';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseTutorBrainResult {
  /** Trimmed view of the model ready for display or prompt injection. */
  model: StudentModel;
  tbRecordGap: (topic: string) => void;
  tbRecordStudying: (topic: string, advance?: boolean) => void;
  tbRecordSocraticPass: (topic: string) => void;
  tbRecordQuizResult: (topic: string, score: number, wrongAnswers: string[]) => void;
  tbRecordMastery: (topic: string) => void;
  tbCheckRegression: () => void;
  tbGetModel: () => StudentModel;
}

/**
 * @param userId  - The authenticated user's ID, or undefined/null for guests.
 * @param bookId  - The current book's ID, or undefined/null when no book is loaded.
 *
 * Both are used to scope the localStorage key so that models never bleed across
 * users, books, or guest sessions.
 */
export function useTutorBrain(userId?: string | null, bookId?: string | null): UseTutorBrainResult {
  const storageKey = getStorageKey(userId, bookId);

  const [model, setModel] = useState<StudentModel>(emptyModel());

  // Load from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    setModel(_loadModel(storageKey));
  // Re-load when the scoped key changes (e.g. user signs in or book changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback((next: StudentModel) => {
    setModel(next);
    _saveModel(storageKey, next);
    // Notify any listeners (e.g. useTutorSync) that the model has changed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chunks:model-changed'));
    }
  }, [storageKey]);

  /**
   * Adds a concept to gaps with status "failing".
   * If the concept already exists in gaps, does nothing.
   */
  const tbRecordGap = useCallback(
    (topic: string) => {
      const current = _loadModel(storageKey);
      const exists = current.gaps.some((g) => g.concept === topic);
      if (exists) return;
      const now = new Date().toISOString();
      const next: StudentModel = {
        ...current,
        gaps: [
          ...current.gaps,
          { concept: topic, status: 'failing', failedAt: now, lastSeenAt: now, passCount: 0 },
        ],
      };
      persist(next);
    },
    [storageKey, persist],
  );

  /**
   * Advances a concept through the gap lifecycle when the student is actively studying it.
   * - failing → reviewing (always)
   * - reviewing → recovering (only when `advance` is true)
   * - any other status → update lastSeenAt only
   *
   * `advance` defaults to false so that passive study (e.g. struggle-phrase detection)
   * does not promote a concept from reviewing to recovering without deliberate intent.
   *
   * If the concept is not currently in gaps, this is a no-op.
   */
  const tbRecordStudying = useCallback(
    (topic: string, advance: boolean = false) => {
      const current = _loadModel(storageKey);
      // If concept is not tracked in gaps at all, do nothing (prevents phantom entries)
      const gap = current.gaps.find((g) => g.concept === topic);
      if (!gap) return;

      // Open a recovery analytics window when the student starts studying a
      // failing concept — this marks the start of an AI intervention so we can
      // later measure whether the quiz attempt after this study session succeeds.
      if (gap.status === 'failing') {
        openRecoveryWindow(topic, gap.failedAt);
      }

      const now = new Date().toISOString();
      const next: StudentModel = {
        ...current,
        gaps: current.gaps.map((g) => {
          if (g.concept !== topic) return g;
          if (g.status === 'failing') {
            return { ...g, status: 'reviewing' as ConceptStatus, lastSeenAt: now };
          }
          if (g.status === 'reviewing' && advance) {
            return { ...g, status: 'recovering' as ConceptStatus, lastSeenAt: now };
          }
          // For any other status (or reviewing without advance), just update lastSeenAt
          return { ...g, lastSeenAt: now };
        }),
      };
      persist(next);
    },
    [storageKey, persist],
  );

  /**
   * Records a quiz result and updates the gap lifecycle:
   * - score > 70 → status = "recovering", increment passCount
   * - score > 80 and passCount >= 2, OR score > 90 → mastered (remove from gaps)
   */
  const tbRecordMastery = useCallback(
    (topic: string) => {
      const current = _loadModel(storageKey);
      const next: StudentModel = {
        ...current,
        mastered: current.mastered.includes(topic)
          ? current.mastered
          : [...current.mastered, topic],
        gaps: current.gaps.filter((g) => g.concept !== topic),
      };
      persist(next);
    },
    [storageKey, persist],
  );

  const tbRecordQuizResult = useCallback(
    (topic: string, score: number, wrongAnswers: string[]) => {
      const current = _loadModel(storageKey);
      const now = new Date().toISOString();

      // Push to quiz history
      const updatedHistory: QuizHistoryEntry[] = [
        ...current.quizHistory,
        { topic, score, wrongAnswers, timestamp: now },
      ];

      // Update gap entry if present
      let updatedGaps = current.gaps.map((g) => {
        if (g.concept !== topic) return g;
        if (score > 70) {
          return {
            ...g,
            status: 'recovering' as ConceptStatus,
            lastSeenAt: now,
            passCount: g.passCount + 1,
          };
        }
        return { ...g, lastSeenAt: now };
      });

      let updatedMastered = current.mastered;

      // Determine if mastery threshold reached
      const gap = updatedGaps.find((g) => g.concept === topic);
      const shouldMaster =
        (score > 80 && gap !== undefined && gap.passCount >= 2) || score > 90;

      if (shouldMaster) {
        updatedMastered = current.mastered.includes(topic)
          ? current.mastered
          : [...current.mastered, topic];
        updatedGaps = updatedGaps.filter((g) => g.concept !== topic);
      }

      persist({ mastered: updatedMastered, gaps: updatedGaps, quizHistory: updatedHistory });

      // Close the recovery analytics window for this concept if one is open.
      // This records whether the post-intervention quiz attempt was successful
      // and allows computeRecoveryStats() to measure the AI's intervention rate.
      closeRecoveryWindow(topic, score);
    },
    [storageKey, persist],
  );

  /**
   * Records a successful Socratic answer and advances the concept through the
   * gap lifecycle:
   *   failing   → reviewing
   *   reviewing → recovering
   *   recovering (2nd pass) → mastered
   */
  const tbRecordSocraticPass = useCallback(
    (topic: string) => {
      const current = _loadModel(storageKey);
      const now = new Date().toISOString();
      const next: StudentModel = {
        ...current,
        gaps: current.gaps.map((g) => {
          if (g.concept !== topic) return g;
          if (g.status === 'recovering') {
            // Count passes while in 'recovering'; mastery handled below
            return { ...g, lastSeenAt: now, passCount: g.passCount + 1 };
          }
          if (g.status === 'reviewing') {
            // Transition to recovering; reset passCount so two consecutive
            // recovering-passes are required before mastery
            return { ...g, status: 'recovering' as ConceptStatus, lastSeenAt: now, passCount: 0 };
          }
          if (g.status === 'failing') {
            return { ...g, status: 'reviewing' as ConceptStatus, lastSeenAt: now, passCount: 0 };
          }
          return { ...g, lastSeenAt: now };
        }),
      };
      // Check mastery after incrementing passCount
      const updatedGap = next.gaps.find((g) => g.concept === topic);
      if (updatedGap && updatedGap.status === 'recovering' && updatedGap.passCount >= 2) {
        tbRecordMastery(topic);
        return;
      }
      persist(next);
    },
    [storageKey, persist, tbRecordMastery],
  );

  /**
   * Scans mastered concepts and moves anything last seen more than 14 days ago
   * back into gaps with status "regressed".
   */
  const tbCheckRegression = useCallback(() => {
    const current = _loadModel(storageKey);
    const now = Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

    // Find mastered concepts that have a last-seen record in quiz history older than 14 days
    const regressedConcepts: string[] = [];

    current.mastered.forEach((concept) => {
      const entries = current.quizHistory
        .filter((h) => h.topic === concept)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const lastSeen = entries[0]?.timestamp;
      if (lastSeen && now - new Date(lastSeen).getTime() > fourteenDaysMs) {
        regressedConcepts.push(concept);
      }
    });

    if (regressedConcepts.length === 0) return;

    const nowIso = new Date().toISOString();
    const newGapEntries: GapEntry[] = regressedConcepts.map((concept) => ({
      concept,
      status: 'regressed',
      failedAt: nowIso,
      lastSeenAt: nowIso,
      passCount: 0,
    }));

    const next: StudentModel = {
      ...current,
      mastered: current.mastered.filter((m) => !regressedConcepts.includes(m)),
      gaps: [
        ...current.gaps.filter((g) => !regressedConcepts.includes(g.concept)),
        ...newGapEntries,
      ],
    };
    persist(next);
  }, [storageKey, persist]);

  /**
   * Returns a trimmed view of the model:
   * 8 most urgent gaps + 10 most recently mastered concepts.
   */
  const tbGetModel = useCallback((): StudentModel => {
    return trimModel(_loadModel(storageKey));
  }, [storageKey]);

  return {
    model: trimModel(model),
    tbRecordGap,
    tbRecordStudying,
    tbRecordSocraticPass,
    tbRecordQuizResult,
    tbRecordMastery,
    tbCheckRegression,
    tbGetModel,
  };
}
