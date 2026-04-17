'use client';

import { useState, useCallback, useEffect } from 'react';

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

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'chunks_student_model';

function loadModel(): StudentModel {
  if (typeof window === 'undefined') return { mastered: [], gaps: [], quizHistory: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mastered: [], gaps: [], quizHistory: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as StudentModel).mastered) &&
      Array.isArray((parsed as StudentModel).gaps) &&
      Array.isArray((parsed as StudentModel).quizHistory)
    ) {
      return parsed as StudentModel;
    }
    return { mastered: [], gaps: [], quizHistory: [] };
  } catch {
    return { mastered: [], gaps: [], quizHistory: [] };
  }
}

function saveModel(model: StudentModel): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
    // Notify any listeners (e.g. useTutorSync) that the model has changed
    window.dispatchEvent(new CustomEvent('chunks:model-changed'));
  } catch {
    // Ignore quota errors — persistence is best-effort
  }
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
 */
export function buildStudentProfile(): string {
  const m = trimModel(loadModel());

  const gapsPart =
    m.gaps.length > 0
      ? m.gaps.map((g) => `${g.concept} (${g.status})`).join(', ')
      : 'none';

  const masteredPart = m.mastered.length > 0 ? m.mastered.join(', ') : 'none';

  // Collect most-recent score per topic from quiz history; show only those < 80%
  const latestByTopic = new Map<string, number>();
  for (const entry of m.quizHistory) {
    // Iterating forward means later entries overwrite earlier ones → most recent wins
    latestByTopic.set(entry.topic, entry.score);
  }
  const lowScores = [...latestByTopic.entries()]
    .filter(([, score]) => score < 80)
    .map(([topic, score]) => `${topic} (${score}%)`)
    .join(', ');
  const lowScoresPart = lowScores || 'none';

  return `[STUDENT PROFILE]\nGaps: ${gapsPart}\nMastered: ${masteredPart}\nLow quiz scores: ${lowScoresPart}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseTutorBrainResult {
  /** Trimmed view of the model ready for display or prompt injection. */
  model: StudentModel;
  tbRecordGap: (topic: string) => void;
  tbRecordStudying: (topic: string) => void;
  tbRecordSocraticPass: (topic: string) => void;
  tbRecordQuizResult: (topic: string, score: number, wrongAnswers: string[]) => void;
  tbRecordMastery: (topic: string) => void;
  tbCheckRegression: () => void;
  tbGetModel: () => StudentModel;
}

export function useTutorBrain(): UseTutorBrainResult {
  const [model, setModel] = useState<StudentModel>({ mastered: [], gaps: [], quizHistory: [] });

  // Load from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    setModel(loadModel());
  }, []);

  const persist = useCallback((next: StudentModel) => {
    setModel(next);
    saveModel(next);
  }, []);

  /**
   * Adds a concept to gaps with status "failing".
   * If the concept already exists in gaps, does nothing.
   */
  const tbRecordGap = useCallback(
    (topic: string) => {
      const current = loadModel();
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
    [persist],
  );

  /**
   * Advances a concept from "failing" to "reviewing".
   * Only transitions if current status is "failing".
   */
  const tbRecordStudying = useCallback(
    (topic: string) => {
      const current = loadModel();
      const now = new Date().toISOString();
      const next: StudentModel = {
        ...current,
        gaps: current.gaps.map((g) =>
          g.concept === topic && g.status === 'failing'
            ? { ...g, status: 'reviewing' as ConceptStatus, lastSeenAt: now }
            : g,
        ),
      };
      persist(next);
    },
    [persist],
  );

  /**
   * Records a quiz result and updates the gap lifecycle:
   * - score > 70 → status = "recovering", increment passCount
   * - score > 80 and passCount >= 2, OR score > 90 → mastered (remove from gaps)
   */
  const tbRecordMastery = useCallback(
    (topic: string) => {
      const current = loadModel();
      const next: StudentModel = {
        ...current,
        mastered: current.mastered.includes(topic)
          ? current.mastered
          : [...current.mastered, topic],
        gaps: current.gaps.filter((g) => g.concept !== topic),
      };
      persist(next);
    },
    [persist],
  );

  const tbRecordQuizResult = useCallback(
    (topic: string, score: number, wrongAnswers: string[]) => {
      const current = loadModel();
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
    },
    [persist],
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
      const current = loadModel();
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
    [persist, tbRecordMastery],
  );

  /**
   * Scans mastered concepts and moves anything last seen more than 14 days ago
   * back into gaps with status "regressed".
   */
  const tbCheckRegression = useCallback(() => {
    const current = loadModel();
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
  }, [persist]);

  /**
   * Returns a trimmed view of the model:
   * 8 most urgent gaps + 10 most recently mastered concepts.
   */
  const tbGetModel = useCallback((): StudentModel => {
    return trimModel(loadModel());
  }, []);

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
