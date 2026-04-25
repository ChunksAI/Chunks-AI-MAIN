'use client';

/**
 * useTutorSync — database persistence layer for the student knowledge model.
 *
 * Responsibilities:
 *  1. On scope change (user or bookId): load the model from the server and
 *     merge with localStorage for the new scoped key.
 *  2. Debounce-save to /tutor/save-model on every 'chunks:model-changed' event.
 *  3. Run regression check on each scope load to promote stale mastered
 *     concepts to "regressed".
 *  4. Return the list of newly-regressed concept names so the caller can
 *     surface alerts.
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
import { getStorageKey, loadModel as _loadModel, saveModel as _saveModel } from '@/lib/tutorStorage';

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

// ─── Regression check (standalone, reads/writes localStorage directly) ────────

/**
 * Scans mastered concepts whose last quiz entry is older than 14 days and
 * demotes them to "regressed" in localStorage.
 * Returns the list of concept names that were newly regressed.
 */
function checkRegressionLocal(storageKey: string): string[] {
  const current = _loadModel(storageKey);
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

  _saveModel(storageKey, next);
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

export function useTutorSync(bookId?: string): UseTutorSyncResult {
  const { user } = useAuth();
  const [regressions, setRegressions] = useState<string[]>([]);
  const [syncReady, setSyncReady] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute the scoped key using the same helper as useTutorBrain
  const userId = user?.isGuest ? undefined : user?.id;
  const storageKey = getStorageKey(userId, bookId);

  // Tracks the last scope we successfully initiated a load for.
  // Replaces the old boolean `hasMounted` guard: unlike a boolean, this lets
  // us re-run the load when the user or book changes after the initial mount.
  const lastLoadedScopeRef = useRef<string | null>(null);

  // A stable string that changes whenever user or bookId changes.
  const scopeKey = `${userId ?? 'guest'}:${bookId ?? ''}`;

  // ── On scope change: regression check + server load ─────────────────────────
  useEffect(() => {
    // Skip if we already loaded for this exact user+book combination.
    // This prevents double-firing in React Strict Mode without blocking
    // subsequent scope changes.
    if (lastLoadedScopeRef.current === scopeKey) return;
    lastLoadedScopeRef.current = scopeKey;

    // Reset sync state for the new scope so consumers know loading is in progress
    setSyncReady(false);
    setRegressions([]);

    // Capture the storageKey for this scope — used inside the async block so
    // a stale response from a previous book never overwrites the new scope.
    const scopedStorageKey = storageKey;
    const scopedBookId = bookId;
    const scopedUser = user;

    // 1. Run regression check — prefer Web Worker (non-blocking); fall back to
    //    synchronous execution on SSR or browsers that don't support Worker.
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      const worker = new Worker(
        new URL('../workers/regressionWorker.ts', import.meta.url),
        { type: 'module' },
      );
      const current = _loadModel(scopedStorageKey);
      worker.postMessage({ mastered: current.mastered, quizHistory: current.quizHistory });
      worker.onmessage = (e: MessageEvent<{ regressed: string[] }>) => {
        const { regressed } = e.data;
        worker.terminate();
        // Only apply if we are still on the same scope (guard against stale worker)
        if (lastLoadedScopeRef.current !== scopeKey) return;
        if (regressed.length > 0) {
          const model = _loadModel(scopedStorageKey);
          const nowIso = new Date().toISOString();
          const next: StudentModel = {
            ...model,
            mastered: model.mastered.filter((m) => !regressed.includes(m)),
            gaps: [
              ...model.gaps.filter((g) => !regressed.includes(g.concept)),
              ...regressed.map((concept) => ({
                concept,
                status: 'regressed' as ConceptStatus,
                failedAt: nowIso,
                lastSeenAt: nowIso,
                passCount: 0,
              })),
            ],
          };
          _saveModel(scopedStorageKey, next);
          window.dispatchEvent(new CustomEvent('chunks:model-changed'));
          setRegressions(regressed);
        }
      };
      worker.onerror = () => worker.terminate(); // fail silently
    } else {
      // Synchronous fallback: SSR or browsers without Web Worker support
      const regressed = checkRegressionLocal(scopedStorageKey);
      if (regressed.length > 0) setRegressions(regressed);
    }

    // 2. If authenticated, fetch server model and merge
    if (!scopedUser || scopedUser.isGuest) {
      setSyncReady(true);
      return;
    }

    (async () => {
      try {
        const serverModel = await loadTutorModel(scopedUser.id, scopedBookId);
        // Guard: discard the response if the user has switched scope since we
        // initiated this fetch (e.g. rapidly switched books)
        if (lastLoadedScopeRef.current !== scopeKey) return;
        if (serverModel) {
          const local = _loadModel(scopedStorageKey);
          const merged = mergeModels(local, serverModel);
          _saveModel(scopedStorageKey, merged);
          window.dispatchEvent(new CustomEvent('chunks:model-changed'));
        }
      } catch {
        // Server unavailable — continue with localStorage only
      } finally {
        // Only mark ready if we are still on this scope
        if (lastLoadedScopeRef.current === scopeKey) {
          setSyncReady(true);
        }
      }
    })();
  // scopeKey already encodes user+bookId; storageKey is derived from the same
  // inputs, so listing both is not redundant — but scopeKey is the trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  // ── Debounced save on every model change ─────────────────────────────────────
  const scheduleSave = useCallback(() => {
    if (!user || user.isGuest) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const model = _loadModel(storageKey);
      saveTutorModel(user.id, model, bookId).catch(() => {
        // Silently ignore — localStorage is the source of truth
      });
    }, SAVE_DEBOUNCE_MS);
  }, [user, bookId, storageKey]);

  useEffect(() => {
    window.addEventListener('chunks:model-changed', scheduleSave);
    return () => {
      window.removeEventListener('chunks:model-changed', scheduleSave);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [scheduleSave]);

  return { regressions, syncReady };
}
