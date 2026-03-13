/**
 * src/state/flashState.js — Flashcard screen state
 *
 * Single source of truth for every mutable variable owned by the flashcard
 * screen: the current deck, card index, session stats, and the flip flag.
 *
 * All variables are exposed on `window.*` so the monolith's flashcard
 * functions (`flipCard`, `_fcRenderCard`, `_fcLoadDeckIntoStudy`, rating
 * handlers, etc.) continue to work as bare-name reads/writes in non-strict
 * <script> blocks without any modification.
 *
 * Exports
 * ───────
 *   FLASH_STATS_DEFAULT   Fresh stats object shape { easy, ok, hard, skipped }
 *   resetFlashStats()     Reset window._fcStats to a clean copy
 *   resetFlashSession()   Full reset: deck + index + stats + ratings + flip
 *
 * Task 17 — extracted from monolith:
 *   cardFlipped    → line 1655  (inside the flipCard script block)
 *   _fcDeck …      → lines 3596–3601
 */

// ── Defaults ───────────────────────────────────────────────────────────────

/** Shape of a fresh per-session ratings tally. */
export const FLASH_STATS_DEFAULT = Object.freeze({
  easy: 0, ok: 0, hard: 0, skipped: 0,
});

// ── Helpers ────────────────────────────────────────────────────────────────

/** Reset only the stats counter, leaving the deck and index intact. */
export function resetFlashStats() {
  window._fcStats = { ...FLASH_STATS_DEFAULT };
}

/** Full reset — call when entering a fresh study session. */
export function resetFlashSession() {
  window._fcDeck          = [];
  window._fcDeckTopic     = '';
  window._fcCurrentDeckId = null;
  window._fcIndex         = 0;
  window._fcStats         = { ...FLASH_STATS_DEFAULT };
  window._fcCardRatings   = [];
  window.cardFlipped      = false;
}

// ── Initialise window globals ──────────────────────────────────────────────
//
// These assignments replace the bare `let` declarations that were scattered
// across two <script> blocks in the monolith.

/** Whether the current flashcard is showing its back face. */
window.cardFlipped = false;

/** The active deck: array of { front, back, card_id? } objects. */
window._fcDeck = [];

/** Topic string used when generating or saving the deck. */
window._fcDeckTopic = '';

/** Supabase deck row id for the active deck (null = local / unsaved). */
window._fcCurrentDeckId = null;

/** 0-based index into _fcDeck for the card currently on screen. */
window._fcIndex = 0;

/** Running totals for the current session. */
window._fcStats = { ...FLASH_STATS_DEFAULT };

/**
 * Per-card rating log for the current session.
 * Each entry: { front: string, card_id: string|null, rating: 'easy'|'ok'|'hard'|'skipped' }
 */
window._fcCardRatings = [];
