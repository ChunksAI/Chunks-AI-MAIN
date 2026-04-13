'use client';

/**
 * useTutorSync — database persistence layer for the student knowledge model.
 *
 * Responsibilities:
 *  1. On mount: load the model from the server and merge with localStorage.
 *  2. Debounce-save to /tutor/save-model on every 'chunks:model-changed' event.
 *  3. Run tbCheckRegression() on mount to promote stale mastered concepts to "regressed".
 *  4. Return the list of newly-regressed concept names so the caller can surface alerts.
 *
 * Only one instance of this hook should exist at a time (call it from the
 * study page or StudyContext — not from individual leaf components).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { loadTutorModel, saveTutorModel, type TutorStudentModel } from '@/lib/studyApi';
import {
  type GapEntry,
  type StudentModel,
  type ConceptStatus,
} from '@/hooks/useTutorBrain';

// Re-export so callers only need one import
export type { TutorStudentModel };

// ─── Merge helpers ────────────────────────────────────────────────────────────

/**
 * Merges the server model into the local model.
 *
 * Strategy:
 *  - mastered: union of both lists (deduplicated)
 *  - gaps: merge by concept; prefer the entry with the more recent lastSeenAt
 *  - quizHistory: union, deduplicated by (topic + timestamp)
 */
function mergeModels(local: StudentModel, server: TutorStudentModel): StudentModel {
  // ── mastered ──
  const masteredSet = new Set([...local.mastered, ...server.mastered]);

  // ── gaps ──
  const gapMap = new Map<string, GapEntry>();
  for (const g of local.gaps) {
    gapMap.set(g.concept, g);
  }
  for (const sg of server.gaps) {
    const existing = gapMap.get(sg.concept);
    if (!existing) {
      gapMap.set(sg.concept, sg as GapEntry);
    } else {
      // Keep whichever entry is more recent
      if (new Date(sg.lastSeenAt) > new Date(existing.lastSeenAt)) {
        gapMap.set(sg.concept, sg as GapEntry);
      }
    }
  }

  // ── quizHistory ──
  const seenKeys = new Set<string>();
  const mergedHistory = [...local.quizHistory, ...server.quizHistory].filter((h) => {
    const key = `${h.topic}::${h.timestamp}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  return {
    mastered: [...masteredSet],
    gaps: [...gapMap.values()],
    quizHistory: mergedHistory,
  };
}

// ─── Raw localStorage accessors (duplicated from useTutorBrain to avoid coupling) ──

const STORAGE_KEY = 'chunks_student_model';

function readLocalModel(): StudentModel {
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

function writeLocalModel(model: StudentModel): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
    // Avoid infinite loop: don't re-dispatch 'chunks:model-changed' here
  } catch {
    // ignore quota errors
  }
}

// ─── Regression check (standalone, reads/writes localStorage directly) ────────

/**
 * Scans mastered concepts whose last quiz entry is older than 14 days and
 * demotes them to "regressed" in localStorage.
 * Returns the list of concept names that were newly regressed.
 */
function checkRegressionLocal(): string[] {
  const current = readLocalModel();
  const now = Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

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

  if (regressedConcepts.length === 0) return [];

  const nowIso = new Date().toISOString();
  const newGapEntries: GapEntry[] = regressedConcepts.map((concept) => ({
    concept,
    status: 'regressed' as ConceptStatus,
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

  writeLocalModel(next);
  // Notify hook instances that model changed
  window.dispatchEvent(new CustomEvent('chunks:model-changed'));
  return regressedConcepts;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseTutorSyncResult {
  /** Concept names that regressed on this page load (cleared after first render). */
  regressions: string[];
  /** Whether the initial server load has completed (or been skipped for guests). */
  syncReady: boolean;
}

const SAVE_DEBOUNCE_MS = 2_000;

export function useTutorSync(): UseTutorSyncResult {
  const { user } = useAuth();
  const [regressions, setRegressions] = useState<string[]>([]);
  const [syncReady, setSyncReady] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMounted = useRef(false);

  // ── On mount: regression check + server load ────────────────────────────────
  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;

    // 1. Run regression check against localStorage
    const regressed = checkRegressionLocal();
    if (regressed.length > 0) setRegressions(regressed);

    // 2. If authenticated, fetch server model and merge
    if (!user || user.isGuest) {
      setSyncReady(true);
      return;
    }

    (async () => {
      try {
        const serverModel = await loadTutorModel(user.id);
        if (serverModel) {
          const local = readLocalModel();
          const merged = mergeModels(local, serverModel);
          writeLocalModel(merged);
          window.dispatchEvent(new CustomEvent('chunks:model-changed'));
        }
      } catch {
        // Server unavailable — continue with localStorage only
      } finally {
        setSyncReady(true);
      }
    })();
  }, [user]);

  // ── Debounced save on every model change ─────────────────────────────────────
  const scheduleSave = useCallback(() => {
    if (!user || user.isGuest) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const model = readLocalModel();
      saveTutorModel(user.id, model).catch(() => {
        // Silently ignore — localStorage is the source of truth
      });
    }, SAVE_DEBOUNCE_MS);
  }, [user]);

  useEffect(() => {
    window.addEventListener('chunks:model-changed', scheduleSave);
    return () => {
      window.removeEventListener('chunks:model-changed', scheduleSave);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [scheduleSave]);

  return { regressions, syncReady };
}
