/**
 * lib/constants.ts — Named constants used across the application.
 *
 * Import these instead of writing magic numbers or magic strings in
 * component/context files.  Keeping them here makes future tuning
 * (e.g. token budget changes, duration tweaks) a one-line change.
 */

// ─── Chat / AI ────────────────────────────────────────────────────────────────

/** Maximum number of message history turns sent to the backend on each request. */
export const MAX_HISTORY_ITEMS = 10;

/**
 * Maximum characters of document context sent with each /ask request.
 * Slides are ranked by keyword relevance and included until this limit is hit.
 */
export const MAX_DOC_CONTEXT_CHARS = 6_000;

// ─── UI timing ────────────────────────────────────────────────────────────────

/** Duration (ms) for auto-dismissing toasts. */
export const TOAST_DURATION_MS = 3_000;

// ─── Generation defaults ──────────────────────────────────────────────────────

/** Default number of flashcards generated per deck. */
export const DEFAULT_FLASHCARD_COUNT = 10;

/** Default number of quiz questions generated per session. */
export const DEFAULT_QUIZ_COUNT = 10;

// ─── Scoring ──────────────────────────────────────────────────────────────────

/** Minimum score (0–100) required to "pass" a quiz and unlock the exam CTA. */
export const PASS_THRESHOLD = 75;

// ─── Session persistence ──────────────────────────────────────────────────────

/** TTL in days for persisted study sessions in localStorage. */
export const SESSION_TTL_DAYS = 7;

/** Maximum number of recent sessions stored in the sidebar. */
export const MAX_RECENTS = 5;

/** localStorage key for sidebar collapsed state. */
export const SIDEBAR_COMPACT_KEY = 'chunks_v2_sidebar_collapsed';

/** localStorage key prefix for persisted study session snapshots. */
export const SESSION_STORAGE_KEY = 'chunks_v2_session';

// ─── SRS / Flashcards ─────────────────────────────────────────────────────────

/** localStorage key for the SRS (spaced-repetition) card data store. */
export const SRS_STORAGE_KEY = 'chunks_v2_srs';
