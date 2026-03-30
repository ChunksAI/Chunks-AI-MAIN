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
  _fcDecksCache,
  _fcLibraryCache,
  _fcMasteryMap,
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
  wsGenerateFlashcardsInChat,
  wsOpenFlashcardDeck,
  wsStartFlashcardPractice,
  wsLoadDocumentFlashcards,
  wsBackToWorkspace,
  _fcCheckNavFrom,
  _fcStudyInChat,
  _fcReviewHardInChat,
  _fcInit,
} from './chatBridge.js';

// ── Init ────────────────────────────────────────────────────────────────────

import { _fcInit } from './chatBridge.js';


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _fcInit);
} else {
  _fcInit();
}

console.log('[flashState] state engine ready ✦');
