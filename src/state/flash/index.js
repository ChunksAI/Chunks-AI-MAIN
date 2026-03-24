/**
 * src/state/flash/index.js — Barrel re-exports + window bridges
 *
 * Single entry-point for the flash module. Imports every domain file,
 * re-exports all public symbols, and wires up window.* bridges exactly
 * matching the original flashState.js.
 */

// ── Re-exports ──────────────────────────────────────────────────────────────

export { fc, ACCENT_KEY, STREAK_KEY, FREEZE_KEY, XP_KEY, MASTERY_KEY, LEGEND_KEY } from './state.js';

export { _fcShowView, _fcSetGenBusy, _fcShowError } from './helpers.js';

export {
  FC_ACCENTS,
  _fcGetSavedAccent,
  _fcApplyAccent,
  _fcGetUnlockedAccents,
  _fcCheckNewAccentUnlock,
  _fcOpenAccentPicker,
  _fcSelectAccent,
  _fcInitAccent,
} from './accent.js';

export {
  _fcGetXp,
  _fcSaveXp,
  _fcXpMultiplier,
  _fcCalcSessionXp,
  _fcAwardXp,
  _fcGetFreeze,
  _fcSaveFreeze,
  _fcCheckFreezeEarn,
  _fcTryUseFreeze,
  _fcGetStreak,
  _fcSaveStreak,
  _fcTodayStr,
  _fcYesterdayStr,
  _fcRecordStudyDay,
  _fcNextMilestone,
  _fcStreakMilestones,
  _fcFlameSvg,
  _fcRenderStreak,
  _fcShowStreakMilestone,
  _fcIsLegend,
  _fcAwardLegendBadge,
  _fcHardBoostActive,
} from './streak.js';

export {
  _fcLoadLibraryDecks,
  _fcGetMasteryStore,
  _fcSaveMastery,
  _fcLoadMasteryMap,
  _fcRenderDeckList,
  _fcDeckCardHTML,
  _fcDeleteDeck,
} from './decks.js';

export {
  _fcOpenPdfUpload,
  _fcProcessUploadedFile,
  _fcParseUploadedCards,
  _aiParams,
  _fcGenerateFromBar,
} from './generation.js';

export {
  _fcStartDeck,
  _fcRenderCard,
  _fcFlip,
  _fcSound,
  _fcNext,
  _fcAdvance,
  _fcDismissTutor,
  _fcShowTutor,
} from './session.js';

export {
  _fcFinishSession,
  _fcRestartDeck,
  _fcStudyHardOnly,
  _fcCreateNew,
  _fcCloseCompleteModal,
  _fcExitStudy,
} from './completion.js';

export {
  _fcKeyHandler,
  _fcBindKeyboard,
  _fcRemoveKeyboard,
} from './keyboard.js';

export {
  _fcOpenEditCard,
  _fcCloseEditCard,
  _fcSaveEditCard,
} from './editing.js';

export {
  wsMakeFlashcard,
  _fcStudyInChat,
  _fcReviewHardInChat,
  _fcInit,
} from './chatBridge.js';

// ── Window bridges ──────────────────────────────────────────────────────────
// Exactly matches the original flashState.js window.* assignments.

import {
  FC_ACCENTS,
  _fcOpenAccentPicker,
  _fcSelectAccent,
  _fcInitAccent,
  _fcCheckNewAccentUnlock,
} from './accent.js';

import {
  _fcRecordStudyDay,
  _fcRenderStreak,
  _fcGetFreeze,
  _fcGetStreak,
  _fcFlameSvg,
  _fcGetXp,
  _fcXpMultiplier,
  _fcIsLegend,
  _fcAwardLegendBadge,
  _fcHardBoostActive,
  _fcStreakMilestones,
} from './streak.js';

import { _fcDeleteDeck, _fcRenderDeckList } from './decks.js';
import { _fcOpenPdfUpload, _fcGenerateFromBar, _aiParams } from './generation.js';
import { _fcSound, _fcNext, _fcFlip, _fcStartDeck, _fcDismissTutor } from './session.js';
import {
  _fcRestartDeck,
  _fcStudyHardOnly,
  _fcCreateNew,
  _fcExitStudy,
  _fcCloseCompleteModal,
} from './completion.js';
import { _fcOpenEditCard, _fcCloseEditCard, _fcSaveEditCard } from './editing.js';
import { wsMakeFlashcard, _fcStudyInChat, _fcReviewHardInChat, _fcInit } from './chatBridge.js';

// Accent
window._fcOpenAccentPicker     = _fcOpenAccentPicker;
window._fcSelectAccent         = _fcSelectAccent;
window._fcInitAccent           = _fcInitAccent;
window._fcCheckNewAccentUnlock = _fcCheckNewAccentUnlock;
window.FC_ACCENTS              = FC_ACCENTS;

// Streak
window._fcRecordStudyDay   = _fcRecordStudyDay;
window._fcRenderStreak     = _fcRenderStreak;
window._fcGetFreeze        = _fcGetFreeze;
window._fcGetStreak        = _fcGetStreak;
window._fcFlameSvg         = _fcFlameSvg;
window._fcGetXp            = _fcGetXp;
window._fcXpMultiplier     = _fcXpMultiplier;
window._fcIsLegend         = _fcIsLegend;
window._fcAwardLegendBadge = _fcAwardLegendBadge;
window._fcHardBoostActive  = _fcHardBoostActive;
window._fcStreakMilestones = _fcStreakMilestones;

// Session + Sound
window._fcSound        = _fcSound;
window._fcNext         = _fcNext;
window._fcFlip         = _fcFlip;
window._fcStartDeck    = _fcStartDeck;
window._fcDismissTutor = _fcDismissTutor;

// Decks
window._fcDeleteDeck     = _fcDeleteDeck;
window._fcRenderDeckList = _fcRenderDeckList;

// Generation
window._fcOpenPdfUpload   = _fcOpenPdfUpload;
window._fcGenerateFromBar = _fcGenerateFromBar;
window._aiParams          = _aiParams;

// Completion
window._fcRestartDeck        = _fcRestartDeck;
window._fcStudyHardOnly      = _fcStudyHardOnly;
window._fcCreateNew          = _fcCreateNew;
window._fcExitStudy          = _fcExitStudy;
window._fcCloseCompleteModal = _fcCloseCompleteModal;

// Editing
window._fcOpenEditCard  = _fcOpenEditCard;
window._fcCloseEditCard = _fcCloseEditCard;
window._fcSaveEditCard  = _fcSaveEditCard;

// Chat bridges
window.wsMakeFlashcard     = wsMakeFlashcard;
window._fcStudyInChat      = _fcStudyInChat;
window._fcReviewHardInChat = _fcReviewHardInChat;

// ── Init ────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _fcInit);
} else {
  _fcInit();
}

console.log('[flashState] state engine ready ✦');
