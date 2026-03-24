/**
 * src/state/studyplan/index.js — Barrel re-export + window bridges
 *
 * Replaces the monolithic src/state/studyPlanState.js.
 * Sub-modules:
 *   state.js            — shared mutable state object + constants
 *   mastery.js          — mastery tracking
 *   input.js            — tab switching, PDF upload, validation
 *   generation.js       — plan generation + overlay
 *   rendering.js        — plan rendering, node building, stats, views
 *   explain.js          — AI explain drawer + stream
 *   flashcards.js       — mini flashcard engine
 *   panel.js            — live panel/donut update
 *   practiceQuestions.js — practice Q's engine
 *   exam.js             — mini exam engine
 *   init.js             — spInitScreen
 *   planLibrary.js      — multi-plan management
 *   calendar.js         — exam date + daily schedule + adaptive reorder
 *   visualTutor.js      — visual tutor bridge
 *   patches.js          — patched overrides
 *   srs.js              — spaced repetition + confidence
 *   notifications.js    — notifications + reminders
 *   workspaceBridge.js  — study plan → workspace chat
 */

import { $el } from '../domHelpers.js';

// ── Re-exports ────────────────────────────────────────────────────────────────

export { sp, SRS_MIN_INTERVAL, SRS_EASE_DEFAULT, SP_WEIGHTS } from './state.js';
export {
  spMasteryGet, spMasteryScore, spMasteryRecord,
  spMasteryUpdateNode, spMasteryMarkChipsDone, spMasteryUnlockNext,
} from './mastery.js';
export {
  spSwitchTab, spSetDepth, spUpdateNotesCount,
  spShowValidationError, spHideValidationError, spValidateInputs,
  spDragOver, spDragLeave, spDrop, spClearUpload, spHandleFileSelect,
} from './input.js';
export { spShowOverlay, spHideOverlay, _aiParams, spHandleGenerate } from './generation.js';
export {
  spRenderPlan, spBuildNode, spUpdateStats, spUpdateDetailPanel,
  spShowEmpty, spShowPlan, spSavePlanToSidebar, spRenderRecentPlansSidebar, animateBars,
} from './rendering.js';
export { spOpenExplainDrawer, spCloseExplainDrawer, _spStreamExplain, spDrawerTab } from './explain.js';
export {
  spFcGenerate, spFcShowDeck, spFcRenderCard, spFcFlip,
  spFcRate, spFcShowComplete, spFcRestart,
} from './flashcards.js';
export { spUpdatePanel, spGetUpNextItems } from './panel.js';
export {
  spPqGenerate, spPqShowCurrent, spPqSubmit,
  spPqNext, spPqShowComplete, spPqRestart,
} from './practiceQuestions.js';
export {
  spExamGenerate, spExamStart, _spExamUpdateTimerDisplay,
  spExamShowCurrent, spExamAnswer, spExamFinish, spExamRestart,
} from './exam.js';
export { spInitScreen } from './init.js';
export {
  _spGenPlanId, spSaveCurrentPlanToLibrary, spLoadAllPlans,
  spShowPlansMenu, spFilterPlansMenu, spHidePlansMenu,
  spSwitchToPlan, spDeletePlan,
} from './planLibrary.js';
export {
  spShowExamDatePicker, spSetExamDate, _spCheckAndExpireExamDate,
  spClearExamDate, spUpdateExamDateUI, spUpdateDailySchedule,
  spCheckAdaptiveReorder,
} from './calendar.js';
export { spOpenVisualTutor } from './visualTutor.js';
export { spSavePlanToSidebarAndLibrary, spRenderPlanPatched, spExamFinishPatched } from './patches.js';
export {
  spSrsUpdate, spSrsLoad, spSrsGetDueToday, spUpdateSrsPanel,
  spExportIcal, spConfidenceGet, spConfidenceBadge,
} from './srs.js';
export { spUpdateReminderUI, spToggleReminder, spUpdateReminderTime } from './notifications.js';
export { spOpenInWorkspace } from './workspaceBridge.js';

// ── Imports for event handlers below ──────────────────────────────────────────

import { spHidePlansMenu } from './planLibrary.js';
import { spOpenVisualTutor } from './visualTutor.js';
import { spOpenInWorkspace } from './workspaceBridge.js';

// Close plans modal when clicking the backdrop overlay
document.addEventListener('click', e => {
  const overlay = $el('sp-plans-modal-overlay');
  if (overlay && overlay.style.display !== 'none' && e.target === overlay) {
    spHidePlansMenu();
  }
}, true);

// ── Task 4: "Study this in Chat" shortcut on node cards ───────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-concept-chat]');
  if (!btn) return;
  e.stopPropagation();
  const title  = btn.dataset.conceptChat;
  const prompt = `Explain "${title}"`;

  if (typeof showScreen === 'function') showScreen('workspace');
  setTimeout(() => {
    const inp = $el('ws-chat-input');
    if (!inp) return;
    inp.value = prompt;
    if (typeof wsAutoResize === 'function') wsAutoResize(inp);
    inp.focus();
    setTimeout(() => {
      if (typeof window.wsChatSend === 'function') window.wsChatSend();
    }, 350);
  }, 250);
});

// Handle Visual Tutor tab click via data-action delegation
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action="spOpenVisualTutor"]');
  if (el) spOpenVisualTutor();
});

// ── Task 4: "Study in Chat" button delegation ─────────────────────────────
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action="spOpenInWorkspace"]');
  if (el) spOpenInWorkspace();
});
