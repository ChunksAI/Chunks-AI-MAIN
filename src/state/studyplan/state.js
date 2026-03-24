/**
 * src/state/studyplan/state.js — Shared mutable state + constants
 */

export const sp = {
  activeTab: 'upload',
  activeDepth: 'intro',
  pdfText: '',
  pdfFileName: '',
  pdfPageCount: 0,
  currentPlan: null,
  allPlans: {},          // { planId: { plan, mastery, savedAt, topic } }
  activePlanId: null,    // currently loaded plan id
  mastery: {},
  genTimer: null,
  explainFocusRelease: null,
  drawerConcept: null,
  fcDeck: [],
  fcIndex: 0,
  fcFlipped: false,
  fcStats: { easy: 0, ok: 0, hard: 0 },
  pqQuestions: [],
  pqIndex: 0,
  pqScore: 0,
  pqGrading: false,
  examQuestions: [],
  examIndex: 0,
  examAnswers: [],
  examTimerSec: 300,
  examTimerHandle: null,
  examStarted: false,
  explainAbortCtrl: null,
  examDate: null,        // ISO date string 'YYYY-MM-DD' or null
  srsSchedule: {},       // { conceptIdx: { nextReview: timestamp, interval: days, ease: float } }
};

export const SRS_MIN_INTERVAL = 1;
export const SRS_EASE_DEFAULT = 2.5;
export const SP_WEIGHTS = { explain: 10, flash: 20, pq: 35, exam: 35 };
