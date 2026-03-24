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

// ── Import all for window bridge setup ────────────────────────────────────────

import { sp } from './state.js';
import {
  spMasteryGet, spMasteryScore, spMasteryRecord,
  spMasteryUpdateNode, spMasteryUnlockNext,
} from './mastery.js';
import {
  spSwitchTab, spSetDepth, spUpdateNotesCount,
  spShowValidationError, spHideValidationError, spValidateInputs,
  spDragOver, spDragLeave, spDrop, spClearUpload, spHandleFileSelect,
} from './input.js';
import { spShowOverlay, spHideOverlay, spHandleGenerate } from './generation.js';
import {
  spRenderPlan, spBuildNode, spUpdateStats, spUpdateDetailPanel,
  spShowEmpty, spShowPlan, spSavePlanToSidebar, spRenderRecentPlansSidebar, animateBars,
} from './rendering.js';
import { spOpenExplainDrawer, spCloseExplainDrawer, spDrawerTab } from './explain.js';
import {
  spFcGenerate, spFcShowDeck, spFcRenderCard, spFcFlip,
  spFcRate, spFcShowComplete, spFcRestart,
} from './flashcards.js';
import { spUpdatePanel, spGetUpNextItems } from './panel.js';
import {
  spPqGenerate, spPqShowCurrent, spPqSubmit,
  spPqNext, spPqShowComplete, spPqRestart,
} from './practiceQuestions.js';
import {
  spExamGenerate, spExamStart, spExamShowCurrent,
  spExamAnswer, spExamFinish, spExamRestart,
} from './exam.js';
import { spInitScreen } from './init.js';
import {
  spSaveCurrentPlanToLibrary, spLoadAllPlans,
  spShowPlansMenu, spFilterPlansMenu, spHidePlansMenu,
  spSwitchToPlan, spDeletePlan,
} from './planLibrary.js';
import {
  spShowExamDatePicker, spSetExamDate, spClearExamDate,
  spUpdateExamDateUI, spUpdateDailySchedule, spCheckAdaptiveReorder,
} from './calendar.js';
import { spOpenVisualTutor } from './visualTutor.js';
import { spSavePlanToSidebarAndLibrary, spRenderPlanPatched, spExamFinishPatched } from './patches.js';
import {
  spSrsUpdate, spSrsLoad, spSrsGetDueToday, spUpdateSrsPanel,
  spExportIcal, spConfidenceGet, spConfidenceBadge,
} from './srs.js';
import { spUpdateReminderUI, spToggleReminder, spUpdateReminderTime } from './notifications.js';
import { spOpenInWorkspace } from './workspaceBridge.js';

// ── Legacy global bridges ─────────────────────────────────────────────────

const _SP_FNS = {
  spSwitchTab, spSetDepth, spUpdateNotesCount, spShowValidationError, spHideValidationError,
  spValidateInputs, spDragOver, spDragLeave, spDrop, spClearUpload, spHandleFileSelect,
  spShowOverlay, spHideOverlay, spHandleGenerate,
  spRenderPlan, spBuildNode, spUpdateStats, spUpdateDetailPanel, spUpdatePanel, spGetUpNextItems,
  spShowEmpty, spShowPlan, spSavePlanToSidebar, spRenderRecentPlansSidebar, animateBars,
  spMasteryGet, spMasteryScore, spMasteryRecord, spMasteryUpdateNode, spMasteryUnlockNext,
  spOpenExplainDrawer, spCloseExplainDrawer, spDrawerTab,
  spFcGenerate, spFcShowDeck, spFcRenderCard, spFcFlip, spFcRate, spFcShowComplete, spFcRestart,
  spPqGenerate, spPqShowCurrent, spPqSubmit, spPqNext, spPqShowComplete, spPqRestart,
  spExamGenerate, spExamStart, spExamShowCurrent, spExamAnswer, spExamFinish, spExamRestart,
  spInitScreen,
};
Object.assign(window, _SP_FNS);

// Mutable state bridges
[
  ['_spCurrentPlan',    () => sp.currentPlan,    v => { sp.currentPlan = v; }],
  ['_spActivePlanId',   () => sp.activePlanId,   v => { sp.activePlanId = v; }],
  ['_spDrawerConcept',  () => sp.drawerConcept,  v => { sp.drawerConcept = v; }],
  ['_spMastery',        () => sp.mastery,        v => { sp.mastery = v; }],
  ['_spFcDeck',         () => sp.fcDeck,         v => { sp.fcDeck = v; }],
  ['_spPqQuestions',    () => sp.pqQuestions,     v => { sp.pqQuestions = v; }],
  ['_spExamQuestions',  () => sp.examQuestions,   v => { sp.examQuestions = v; }],
].forEach(([k, get, set]) => Object.defineProperty(window, k, { get, set, configurable: true }));

// ── Window bridges — all sp* functions used via onclick= or window.* calls ───
window.spSwitchTab          = spSwitchTab;
window.spSetDepth           = spSetDepth;
window.spUpdateNotesCount   = spUpdateNotesCount;
window.spDragOver           = spDragOver;
window.spDragLeave          = spDragLeave;
window.spDrop               = spDrop;
window.spClearUpload        = spClearUpload;
window.spHandleFileSelect   = spHandleFileSelect;
window.spShowValidationError= spShowValidationError;
window.spHideValidationError= spHideValidationError;
window.spValidateInputs     = spValidateInputs;
window.spShowOverlay        = spShowOverlay;
window.spHideOverlay        = spHideOverlay;
window.spHandleGenerate     = spHandleGenerate;
window.spRenderPlan         = spRenderPlan;
window.spBuildNode          = spBuildNode;
window.spUpdateStats        = spUpdateStats;
window.spUpdateDetailPanel  = spUpdateDetailPanel;
window.spShowEmpty          = spShowEmpty;
window.spShowPlan           = spShowPlan;
window.spSavePlanToSidebar  = spSavePlanToSidebar;
window.spRenderRecentPlansSidebar = spRenderRecentPlansSidebar;
window.animateBars          = animateBars;

window.spOpenExplainDrawer  = spOpenExplainDrawer;
window.spCloseExplainDrawer = spCloseExplainDrawer;
window.spDrawerTab          = spDrawerTab;
window.spFcGenerate         = spFcGenerate;
window.spFcShowDeck         = spFcShowDeck;
window.spFcRenderCard       = spFcRenderCard;
window.spFcFlip             = spFcFlip;
window.spFcRate             = spFcRate;
window.spFcShowComplete     = spFcShowComplete;
window.spFcRestart          = spFcRestart;
window.spUpdatePanel        = spUpdatePanel;
window.spGetUpNextItems     = spGetUpNextItems;
window.spPqGenerate         = spPqGenerate;
window.spPqShowCurrent      = spPqShowCurrent;
window.spPqSubmit           = spPqSubmit;
window.spPqNext             = spPqNext;
window.spPqShowComplete     = spPqShowComplete;
window.spPqRestart          = spPqRestart;
window.spExamGenerate       = spExamGenerate;
window.spExamStart          = spExamStart;
window.spExamShowCurrent    = spExamShowCurrent;
window.spExamAnswer         = spExamAnswer;
window.spExamFinish         = spExamFinish;
window.spExamRestart        = spExamRestart;
window.spInitScreen         = spInitScreen;

// ── New function window bridges (Fixes 1-5) ──────────────────────────────
window.spShowPlansMenu        = spShowPlansMenu;
window.spHidePlansMenu        = spHidePlansMenu;
window.spFilterPlansMenu      = spFilterPlansMenu;
window.spSwitchToPlan         = spSwitchToPlan;
window.spDeletePlan           = spDeletePlan;
window.spSaveCurrentPlanToLibrary = spSaveCurrentPlanToLibrary;
window.spLoadAllPlans         = spLoadAllPlans;
window.spShowExamDatePicker   = spShowExamDatePicker;
window.spSetExamDate          = spSetExamDate;
window.spClearExamDate        = spClearExamDate;
window.spToggleReminder       = spToggleReminder;
window.spUpdateReminderTime   = spUpdateReminderTime;
window.spUpdateReminderUI     = spUpdateReminderUI;
window.spUpdateExamDateUI     = spUpdateExamDateUI;
window.spUpdateDailySchedule  = spUpdateDailySchedule;
window.spCheckAdaptiveReorder = spCheckAdaptiveReorder;
window.spOpenVisualTutor      = spOpenVisualTutor;
window.spRenderPlan           = spRenderPlanPatched;   // override with patched version
window.spExamFinish           = spExamFinishPatched;   // override with patched version
window.spSavePlanToSidebar    = spSavePlanToSidebarAndLibrary; // override

window.spSrsUpdate            = spSrsUpdate;
window.spSrsLoad              = spSrsLoad;
window.spSrsGetDueToday       = spSrsGetDueToday;
window.spUpdateSrsPanel       = spUpdateSrsPanel;
window.spExportIcal           = spExportIcal;
window.spConfidenceGet        = spConfidenceGet;
window.spConfidenceBadge      = spConfidenceBadge;

window.spOpenInWorkspace      = spOpenInWorkspace;

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
