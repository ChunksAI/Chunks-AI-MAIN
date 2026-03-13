/**
 * src/state/studyPlanState.js — Study Plan screen state
 *
 * Single source of truth for every mutable variable owned by the Study Plan
 * screen: input tabs, PDF extraction, the generated plan, mastery tracking,
 * the explain drawer, the mini flashcard deck, practice-questions engine,
 * and the mini exam engine.
 *
 * All variables are exposed on `window.*` so the monolith's study-plan
 * functions continue to work as bare-name reads/writes in non-strict
 * <script> blocks without any modification.
 *
 * Exports
 * ───────
 *   SP_WEIGHTS   Mastery-score weights per activity (read-only)
 *
 * Task 18 — extracted from monolith:
 *   _spActiveTab / _spActiveDepth / _spPdfText … → line 11443
 *   _spMastery + SP_WEIGHTS                       → lines 11454–11455
 *   _spGenTimer                                   → line 11771
 *   _explainAbortCtrl                             → line 12219
 *   _spExplainFocusRelease                        → line 12264
 *   _spDrawerConcept / _spFcDeck …                → lines 12328–12332
 *   _spPqQuestions …                              → lines 12678–12681
 *   _spExamQuestions …                            → lines 12844–12849
 */

// ── Mastery weights (exported constant) ───────────────────────────────────

/**
 * Contribution of each activity to the per-concept mastery percentage.
 * explain(10) + flash(20) + pq(35) + exam(35) = 100
 */
export const SP_WEIGHTS = Object.freeze({ explain: 10, flash: 20, pq: 35, exam: 35 });

// ── Initialise window globals ──────────────────────────────────────────────

// ── Input / generation state ───────────────────────────────────────────────

/** Active input tab: 'upload' | 'topic' | 'notes' */
window._spActiveTab = 'upload';

/** Depth selection on the topic tab: 'intro' | 'standard' | 'deep' */
window._spActiveDepth = 'intro';

/** Raw text extracted from the uploaded PDF. */
window._spPdfText = '';

/** Display name of the uploaded PDF file. */
window._spPdfFileName = '';

/** Page count of the uploaded PDF. */
window._spPdfPageCount = 0;

/** Last successfully generated study-plan JSON object (or null). */
window._spCurrentPlan = null;

// ── Mastery state ──────────────────────────────────────────────────────────

/**
 * Per-concept mastery scores.
 * Shape: { [conceptIdx: number]: { explain: number, flash: number, pq: number, exam: number } }
 */
window._spMastery = {};

/** Expose the weights constant so legacy inline code can read SP_WEIGHTS. */
window.SP_WEIGHTS = SP_WEIGHTS;

// ── Generation overlay ─────────────────────────────────────────────────────

/** setTimeout handle for the generation-progress animation ticker. */
window._spGenTimer = null;

// ── Explain drawer ─────────────────────────────────────────────────────────

/** AbortController for the currently-streaming explain response. */
window._explainAbortCtrl = null;

/** trapFocus release function for the explain drawer. */
window._spExplainFocusRelease = null;

// ── Drawer mini-flashcard deck ─────────────────────────────────────────────

/** The concept object currently open in the explain drawer. */
window._spDrawerConcept = null;

/** Mini flashcard deck generated for the current concept. */
window._spFcDeck = [];

/** 0-based index into _spFcDeck. */
window._spFcIndex = 0;

/** Whether the current mini flashcard is showing its back face. */
window._spFcFlipped = false;

/** Session ratings tally for the mini flashcard deck. */
window._spFcStats = { easy: 0, ok: 0, hard: 0 };

// ── Practice-questions engine ──────────────────────────────────────────────

/** Array of generated practice question objects. */
window._spPqQuestions = [];

/** 0-based index of the current practice question. */
window._spPqIndex = 0;

/** Running correct-answer count for the PQ session. */
window._spPqScore = 0;

/** True while an AI grading request is in flight. */
window._spPqGrading = false;

// ── Mini-exam engine ───────────────────────────────────────────────────────

/** Array of generated exam question objects. */
window._spExamQuestions = [];

/** 0-based index of the current exam question. */
window._spExamIndex = 0;

/** Collected answer strings, one per question. */
window._spExamAnswers = [];

/** Countdown timer value in seconds (default 5 minutes). */
window._spExamTimerSec = 300;

/** setInterval handle for the exam countdown ticker. */
window._spExamTimerHandle = null;

/** True once the exam has been started. */
window._spExamStarted = false;
