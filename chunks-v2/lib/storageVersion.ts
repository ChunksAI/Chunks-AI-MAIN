/**
 * lib/storageVersion.ts — Storage versioning and migration utility.
 *
 * Each persisted session snapshot carries a `version` number.  When the
 * snapshot schema changes in a future deploy this module lets us write
 * migration transforms so existing data is safely upgraded rather than
 * silently breaking at runtime.
 *
 * Rules:
 *   1. Bump CURRENT_VERSION whenever the snapshot shape changes.
 *   2. Add a migration function in `migrations` for the new version.
 *   3. Never remove a migration — they chain forward.
 */

import type { WeakArea, PerformanceEntry, AnyNote, ChatMessage, WorkspaceSection, QuizResult, RecentItem } from '@/types';

// ─── Current version ──────────────────────────────────────────────────────────

/** Increment this whenever the SessionSnapshot schema changes. */
export const CURRENT_STORAGE_VERSION = 1;

// ─── Snapshot shape (matches the one used by StudyContext.tsx) ─────────────────

export interface VersionedSnapshot {
  version: number;
  messages: ChatMessage[];
  workspaceSections: WorkspaceSection[];
  quizResults: QuizResult[];
  weakAreas: WeakArea[];
  performanceHistory: PerformanceEntry[];
  notes: AnyNote[];
  topic: string;
  docTitle: string;
  bookId: string | null;
  recents: RecentItem[];
  expiresAt: number;
}

// ─── Migration registry ───────────────────────────────────────────────────────

/**
 * Keyed by *target* version.  Each function receives the raw parsed object
 * and returns the migrated object.  Migrations are applied in ascending
 * order so v0 → v1 → v2 etc.
 *
 * Currently no migrations are needed because v1 is the first version.
 * When v2 is introduced add:
 *   migrations[2] = (snap) => { ...; snap.version = 2; return snap; };
 */
const migrations: Record<number, (snap: Record<string, unknown>) => Record<string, unknown>> = {
  // Example for future use:
  // 2: (snap) => { snap.newField = 'default'; snap.version = 2; return snap; },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate and migrate a parsed snapshot from localStorage.
 *
 * Returns a valid `VersionedSnapshot` or `null` when the data is
 * irrecoverably corrupt / from an unknown future version.
 */
export function migrateSnapshotIfNeeded(raw: unknown): VersionedSnapshot | null {
  if (raw === null || typeof raw !== 'object') return null;

  const snap = raw as Record<string, unknown>;

  // ── No version field → legacy pre-versioning data ──────────────────────
  if (typeof snap['version'] !== 'number') {
    // Treat legacy snapshots as v0 and attempt to upgrade to v1.
    // v1 just adds the version tag + new optional fields with defaults.
    snap['version'] = 0;
  }

  let currentVer = snap['version'] as number;

  // Future versions we can't downgrade from
  if (currentVer > CURRENT_STORAGE_VERSION) return null;

  // Apply each migration step in order
  while (currentVer < CURRENT_STORAGE_VERSION) {
    const nextVer = currentVer + 1;
    const migrate = migrations[nextVer];
    if (migrate) {
      try {
        const migrated = migrate(snap);
        Object.assign(snap, migrated);
      } catch {
        return null;
      }
    }
    // Even without a registered migration, bump the version
    snap['version'] = nextVer;
    currentVer = nextVer;
  }

  // ── Ensure required fields exist with safe defaults ─────────────────────
  return {
    version: CURRENT_STORAGE_VERSION,
    messages: Array.isArray(snap['messages']) ? (snap['messages'] as ChatMessage[]) : [],
    workspaceSections: Array.isArray(snap['workspaceSections'])
      ? (snap['workspaceSections'] as WorkspaceSection[])
      : [],
    quizResults: Array.isArray(snap['quizResults']) ? (snap['quizResults'] as QuizResult[]) : [],
    weakAreas: Array.isArray(snap['weakAreas']) ? (snap['weakAreas'] as WeakArea[]) : [],
    performanceHistory: Array.isArray(snap['performanceHistory'])
      ? (snap['performanceHistory'] as PerformanceEntry[])
      : [],
    notes: Array.isArray(snap['notes']) ? (snap['notes'] as AnyNote[]) : [],
    topic: typeof snap['topic'] === 'string' ? (snap['topic'] as string) : '',
    docTitle: typeof snap['docTitle'] === 'string' ? (snap['docTitle'] as string) : '',
    bookId: typeof snap['bookId'] === 'string' ? (snap['bookId'] as string) : null,
    recents: Array.isArray(snap['recents']) ? (snap['recents'] as RecentItem[]) : [],
    expiresAt: typeof snap['expiresAt'] === 'number' ? (snap['expiresAt'] as number) : 0,
  };
}
