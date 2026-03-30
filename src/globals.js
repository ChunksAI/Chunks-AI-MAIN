// @ts-nocheck
/**
 * src/globals.js — Centralized HTML-binding registry
 *
 * This is the ONLY file that registers functions/objects on window.*.
 * Every HTML onclick/onchange/oninput handler calls through these globals.
 * All JS-to-JS communication uses proper ES imports instead.
 *
 * Grouped by layer: third-party → lib → utils → state → screens → components.
 *
 * NOTE: Some modules (attachments.js, chunksDb.js, patches.js) further wrap
 * window.* functions at load time.  Those runtime patches happen AFTER this
 * file executes, so the final value on window may differ from the import.
 */

// ── Third-party libraries ───────────────────────────────────────────────────
import * as supabaseJs from '@supabase/supabase-js';
import katex           from 'katex';
import DOMPurify       from 'dompurify';

window.supabase  = supabaseJs;
window.katex     = katex;
window.DOMPurify = DOMPurify;

// ── Lib · API ────────────────────────────────────────────────────────────────
import { API_BASE, _getAuthHeader } from './lib/api.js';

window.API_BASE       = API_BASE;
window._getAuthHeader = _getAuthHeader;

// ── Lib · Supabase client ────────────────────────────────────────────────────
import { getSupabaseClient } from './lib/supabase.js';

window._getChunksSb = getSupabaseClient;

// ── Lib · IndexedDB ──────────────────────────────────────────────────────────
import { ChunksDB }    from './lib/chunksDb.js';
import { FlashcardDB } from './lib/flashcardDb.js';

window.ChunksDB    = ChunksDB;
window.FlashcardDB = FlashcardDB;

// ── Lib · Auth ───────────────────────────────────────────────────────────────
import {
  _currentUser, _applyUserProfile, _initAuth, chunksSignOut,
} from './lib/auth.js';

// _currentUser is a live ES-module binding (reassigned by auth.js internally),
// so we expose a getter so `window._currentUser` always reads the latest value.
// Property mutation (e.g. `window._currentUser.id = …`) still works because
// the getter returns the same object reference that auth.js holds.
Object.defineProperty(window, '_currentUser', {
  get: () => _currentUser,
  configurable: true,
});

window._applyUserProfile = _applyUserProfile;
window._initAuth         = _initAuth;
window.chunksSignOut     = chunksSignOut;

// ── Lib · SyncManager ────────────────────────────────────────────────────────
import { SyncManager } from './lib/syncManager.js';

window.SyncManager = SyncManager;

// ── Lib · Guest limits ───────────────────────────────────────────────────────
import {
  isGuest, checkLimit, recordUsage, showLoginWall,
  enforceExamConstraints, renderUsageBar, guestGate,
} from './lib/guestLimits.js';

window.isGuestMode            = isGuest;
window.guestCheckLimit        = checkLimit;
window.guestRecordUsage       = recordUsage;
window.showGuestLoginWall     = showLoginWall;
window.enforceExamConstraints = enforceExamConstraints;
window.renderGuestUsageBar    = renderUsageBar;
window.guestGate              = guestGate;

// ── Lib · Book progress ──────────────────────────────────────────────────────
import {
  trackBookOpen, trackBookPage, getBookProgress, getAllBookProgress,
} from './lib/bookProgress.js';

window._bookProgress = { trackBookOpen, trackBookPage, getBookProgress, getAllBookProgress };

// ── Utils · Storage ──────────────────────────────────────────────────────────
import {
  lsGet, lsSet, lsRemove, ssGet, ssSet, ssRemove,
  getSetting, setSetting, KEYS,
} from './utils/storage.js';

window._lsGet       = lsGet;
window._lsSet       = lsSet;
window._lsRemove    = lsRemove;
window._ssGet       = ssGet;
window._ssSet       = ssSet;
window._ssRemove    = ssRemove;
window.getSetting   = getSetting;
window.setSetting   = setSetting;
window.STORAGE_KEYS = KEYS;

// ── Utils · Render ───────────────────────────────────────────────────────────
import {
  renderMath, sanitize, homeMarkdown, wsRender, spExplainMarkdown,
} from './utils/render.js';

window._renderMath         = renderMath;
window.sanitize            = sanitize;
window.homeMarkdown        = homeMarkdown;
window.wsRender            = wsRender;
window._spExplainMarkdown  = spExplainMarkdown;

// ── Utils · Focus trap ───────────────────────────────────────────────────────
import { trapFocus } from './utils/focusTrap.js';

window.trapFocus = trapFocus;

// ── State · Navigation ───────────────────────────────────────────────────────
import {
  showScreen, drawerNav, mobileNav,
  toggleSidebar, handleLogoClick,
  openMobileDrawer, closeMobileDrawer,
} from './state/navigation/index.js';

window.showScreen        = showScreen;
window.drawerNav         = drawerNav;
window.mobileNav         = mobileNav;
window.toggleSidebar     = toggleSidebar;
window.handleLogoClick   = handleLogoClick;
window.openMobileDrawer  = openMobileDrawer;
window.closeMobileDrawer = closeMobileDrawer;

// ── State · Workspace ────────────────────────────────────────────────────────
import {
  ws, wsBookMeta, selectBook, selectUserDoc,
  wsPrevPage, wsNextPage, wsGoToPage, wsJumpToPage,
  wsZoomIn, wsZoomOut, wsFitWidth, togglePdfOutline,
  wsShowToast, wsSetInput, wsAutoResize, wsScrollBottom,
  wsClearChat, wsAppendUser, wsAppendThinking, wsRemoveThinking,
  wsAppendAI, wsAppendError, wsCopyMsg, _wsRegenerate,
  wsToggleWebSearch, wsToggleThinking, wsToggleThinkMenu,
  filterLibrary, filterLibSection,
  wsToggleAttachMenu, wsAttachTrigger, wsHandleAttach,
  homeToggleAttachMenu, homeAttachTrigger, homeHandleAttach,
  _wsRenderPage, _wsUpdateOutlineActive, _loadPdfJs,
  wsPromptYouTube, wsCloseYouTube, wsIngestYouTube,
  wsToggleVoiceInput, wsReadAloud, wsStopReading,
  wsListenPdf, wsStopListenPdf, wsListenPdfSetRate,
} from './state/workspace/index.js';

window.ws                  = ws;
window.wsBookMeta          = wsBookMeta;
window.selectBook          = selectBook;
window.selectUserDoc       = selectUserDoc;

// _wsBookId is a reactive getter/setter backed by ws.bookId
Object.defineProperty(window, '_wsBookId', {
  get: () => ws.bookId,
  set: v  => { ws.bookId = v; },
  configurable: true,
});

window.wsPrevPage          = wsPrevPage;
window.wsNextPage          = wsNextPage;
window.wsGoToPage          = wsGoToPage;
window.wsJumpToPage        = wsJumpToPage;
window.wsZoomIn            = wsZoomIn;
window.wsZoomOut           = wsZoomOut;
window.wsFitWidth          = wsFitWidth;
window.togglePdfOutline    = togglePdfOutline;
window.wsShowToast         = wsShowToast;
window.wsSetInput          = wsSetInput;
window.wsAutoResize        = wsAutoResize;
window.wsScrollBottom      = wsScrollBottom;
window.wsClearChat         = wsClearChat;
window.wsAppendUser        = wsAppendUser;
window.wsAppendThinking    = wsAppendThinking;
window.wsRemoveThinking    = wsRemoveThinking;
window.wsAppendAI          = wsAppendAI;
window.wsAppendError       = wsAppendError;
window.wsCopyMsg           = wsCopyMsg;
window._wsRegenerate       = _wsRegenerate;
window.wsToggleWebSearch   = wsToggleWebSearch;
window.wsToggleThinking    = wsToggleThinking;
window.wsToggleThinkMenu   = wsToggleThinkMenu;
window.filterLibrary       = filterLibrary;
window.filterLibSection    = filterLibSection;
window.wsToggleAttachMenu  = wsToggleAttachMenu;
window.wsAttachTrigger     = wsAttachTrigger;
window.wsHandleAttach      = wsHandleAttach;
window.homeToggleAttachMenu= homeToggleAttachMenu;
window.homeAttachTrigger   = homeAttachTrigger;
window.homeHandleAttach    = homeHandleAttach;
window._wsRenderPage          = _wsRenderPage;
window._wsUpdateOutlineActive = _wsUpdateOutlineActive;
window._loadPdfJs             = _loadPdfJs;
window.wsPromptYouTube        = wsPromptYouTube;
window.wsCloseYouTube         = wsCloseYouTube;
window.wsIngestYouTube        = wsIngestYouTube;
window.wsToggleVoiceInput     = wsToggleVoiceInput;
window.wsReadAloud            = wsReadAloud;
window.wsStopReading          = wsStopReading;
window.wsListenPdf            = wsListenPdf;
window.wsStopListenPdf        = wsStopListenPdf;
window.wsListenPdfSetRate     = wsListenPdfSetRate;

// Forward-reference stub — flash/index.js overwrites this with the real impl
window.wsMakeFlashcard = async function(btn, msgId, question) {
  console.warn('[ws] wsMakeFlashcard called before flashState loaded');
};

// Forward-reference stubs for new navigation functions
window.wsOpenFlashcardDeck = async function(deckId, topic) {
  console.warn('[ws] wsOpenFlashcardDeck called before flashState loaded');
};
window.wsStartFlashcardPractice = async function(deckId, topic) {
  console.warn('[ws] wsStartFlashcardPractice called before flashState loaded');
};
window.wsBackToWorkspace = function() {
  console.warn('[ws] wsBackToWorkspace called before flashState loaded');
};

// ── State · Flashcards ───────────────────────────────────────────────────────
import {
  FC_ACCENTS,
  _fcOpenAccentPicker, _fcSelectAccent, _fcInitAccent, _fcCheckNewAccentUnlock,
  _fcRecordStudyDay, _fcRenderStreak, _fcGetFreeze, _fcGetStreak, _fcFlameSvg,
  _fcGetXp, _fcXpMultiplier, _fcIsLegend, _fcAwardLegendBadge,
  _fcHardBoostActive, _fcStreakMilestones,
  _fcSound, _fcNext, _fcFlip, _fcStartDeck, _fcDismissTutor,
  _fcDeleteDeck, _fcRenderDeckList,
  _fcOpenPdfUpload, _fcGenerateFromBar, _aiParams,
  _fcRestartDeck, _fcStudyHardOnly, _fcCreateNew, _fcExitStudy, _fcCloseCompleteModal,
  _fcOpenEditCard, _fcCloseEditCard, _fcSaveEditCard,
  wsMakeFlashcard as _wsMakeFlashcardReal,
  wsOpenFlashcardDeck as _wsOpenFlashcardDeckReal,
  wsStartFlashcardPractice as _wsStartFlashcardPracticeReal,
  wsBackToWorkspace as _wsBackToWorkspaceReal,
  _fcCheckNavFrom,
  _fcStudyInChat, _fcReviewHardInChat,
} from './state/flash/index.js';

// Accent
window.FC_ACCENTS              = FC_ACCENTS;
window._fcOpenAccentPicker     = _fcOpenAccentPicker;
window._fcSelectAccent         = _fcSelectAccent;
window._fcInitAccent           = _fcInitAccent;
window._fcCheckNewAccentUnlock = _fcCheckNewAccentUnlock;

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

// Chat bridges — real implementation from flash (replaces forward-reference stub)
window.wsMakeFlashcard          = _wsMakeFlashcardReal;
window.wsOpenFlashcardDeck      = _wsOpenFlashcardDeckReal;
window.wsStartFlashcardPractice = _wsStartFlashcardPracticeReal;
window.wsBackToWorkspace        = _wsBackToWorkspaceReal;
window._fcCheckNavFrom          = _fcCheckNavFrom;
window._fcStudyInChat      = _fcStudyInChat;
window._fcReviewHardInChat = _fcReviewHardInChat;

// ── State · Study Plan ───────────────────────────────────────────────────────
import {
  sp,
  spSwitchTab, spSetDepth, spUpdateNotesCount,
  spShowValidationError, spHideValidationError, spValidateInputs,
  spDragOver, spDragLeave, spDrop, spClearUpload, spHandleFileSelect,
  spShowOverlay, spHideOverlay, spHandleGenerate,
  spRenderPlan, spBuildNode, spUpdateStats, spUpdateDetailPanel,
  spShowEmpty, spShowPlan, spSavePlanToSidebar, spRenderRecentPlansSidebar, animateBars,
  spMasteryGet, spMasteryScore, spMasteryRecord, spMasteryUpdateNode, spMasteryUnlockNext,
  spOpenExplainDrawer, spCloseExplainDrawer, spDrawerTab,
  spFcGenerate, spFcShowDeck, spFcRenderCard, spFcFlip,
  spFcRate, spFcShowComplete, spFcRestart,
  spUpdatePanel, spGetUpNextItems,
  spPqGenerate, spPqShowCurrent, spPqSubmit, spPqNext, spPqShowComplete, spPqRestart,
  spExamGenerate, spExamStart, spExamShowCurrent, spExamAnswer, spExamFinish, spExamRestart,
  spInitScreen,
  spShowPlansMenu, spHidePlansMenu, spFilterPlansMenu,
  spSwitchToPlan, spDeletePlan, spSaveCurrentPlanToLibrary, spLoadAllPlans,
  spShowExamDatePicker, spSetExamDate, spClearExamDate,
  spUpdateExamDateUI, spUpdateDailySchedule, spCheckAdaptiveReorder,
  spToggleReminder, spUpdateReminderTime, spUpdateReminderUI,
  spOpenVisualTutor, spOpenInWorkspace,
  spSavePlanToSidebarAndLibrary, spRenderPlanPatched, spExamFinishPatched,
  spSrsUpdate, spSrsLoad, spSrsGetDueToday, spUpdateSrsPanel,
  spExportIcal, spConfidenceGet, spConfidenceBadge,
  _spCheckAndExpireExamDate,
} from './state/studyplan/index.js';

// Reactive state bridges (backed by the sp state object)
[
  ['_spCurrentPlan',    () => sp.currentPlan,    v => { sp.currentPlan = v; }],
  ['_spActivePlanId',   () => sp.activePlanId,   v => { sp.activePlanId = v; }],
  ['_spDrawerConcept',  () => sp.drawerConcept,  v => { sp.drawerConcept = v; }],
  ['_spMastery',        () => sp.mastery,        v => { sp.mastery = v; }],
  ['_spFcDeck',         () => sp.fcDeck,         v => { sp.fcDeck = v; }],
  ['_spPqQuestions',    () => sp.pqQuestions,     v => { sp.pqQuestions = v; }],
  ['_spExamQuestions',  () => sp.examQuestions,   v => { sp.examQuestions = v; }],
].forEach(([k, get, set]) => Object.defineProperty(window, k, { get, set, configurable: true }));

// Input + validation
window.spSwitchTab           = spSwitchTab;
window.spSetDepth            = spSetDepth;
window.spUpdateNotesCount    = spUpdateNotesCount;
window.spShowValidationError = spShowValidationError;
window.spHideValidationError = spHideValidationError;
window.spValidateInputs      = spValidateInputs;
window.spDragOver            = spDragOver;
window.spDragLeave           = spDragLeave;
window.spDrop                = spDrop;
window.spClearUpload         = spClearUpload;
window.spHandleFileSelect    = spHandleFileSelect;

// Generation + overlay
window.spShowOverlay    = spShowOverlay;
window.spHideOverlay    = spHideOverlay;
window.spHandleGenerate = spHandleGenerate;

// Rendering + plan management
window.spBuildNode              = spBuildNode;
window.spUpdateStats            = spUpdateStats;
window.spUpdateDetailPanel      = spUpdateDetailPanel;
window.spShowEmpty              = spShowEmpty;
window.spShowPlan               = spShowPlan;
window.spRenderRecentPlansSidebar = spRenderRecentPlansSidebar;
window.animateBars              = animateBars;

// Mastery
window.spMasteryGet        = spMasteryGet;
window.spMasteryScore      = spMasteryScore;
window.spMasteryRecord     = spMasteryRecord;
window.spMasteryUpdateNode = spMasteryUpdateNode;
window.spMasteryUnlockNext = spMasteryUnlockNext;

// Explain drawer
window.spOpenExplainDrawer  = spOpenExplainDrawer;
window.spCloseExplainDrawer = spCloseExplainDrawer;
window.spDrawerTab          = spDrawerTab;

// Mini flashcards
window.spFcGenerate    = spFcGenerate;
window.spFcShowDeck    = spFcShowDeck;
window.spFcRenderCard  = spFcRenderCard;
window.spFcFlip        = spFcFlip;
window.spFcRate        = spFcRate;
window.spFcShowComplete= spFcShowComplete;
window.spFcRestart     = spFcRestart;

// Panel
window.spUpdatePanel    = spUpdatePanel;
window.spGetUpNextItems = spGetUpNextItems;

// Practice questions
window.spPqGenerate    = spPqGenerate;
window.spPqShowCurrent = spPqShowCurrent;
window.spPqSubmit      = spPqSubmit;
window.spPqNext        = spPqNext;
window.spPqShowComplete= spPqShowComplete;
window.spPqRestart     = spPqRestart;

// Mini exam
window.spExamGenerate    = spExamGenerate;
window.spExamStart       = spExamStart;
window.spExamShowCurrent = spExamShowCurrent;
window.spExamAnswer      = spExamAnswer;
window.spExamRestart     = spExamRestart;

// Init
window.spInitScreen = spInitScreen;

// Plan library
window.spShowPlansMenu            = spShowPlansMenu;
window.spHidePlansMenu            = spHidePlansMenu;
window.spFilterPlansMenu          = spFilterPlansMenu;
window.spSwitchToPlan             = spSwitchToPlan;
window.spDeletePlan               = spDeletePlan;
window.spSaveCurrentPlanToLibrary = spSaveCurrentPlanToLibrary;
window.spLoadAllPlans             = spLoadAllPlans;

// Calendar + exam date
window.spShowExamDatePicker   = spShowExamDatePicker;
window.spSetExamDate          = spSetExamDate;
window.spClearExamDate        = spClearExamDate;
window.spUpdateExamDateUI     = spUpdateExamDateUI;
window.spUpdateDailySchedule  = spUpdateDailySchedule;
window.spCheckAdaptiveReorder = spCheckAdaptiveReorder;
window._spCheckAndExpireExamDate = _spCheckAndExpireExamDate;

// Reminders
window.spToggleReminder    = spToggleReminder;
window.spUpdateReminderTime= spUpdateReminderTime;
window.spUpdateReminderUI  = spUpdateReminderUI;

// Visual tutor + workspace bridges
window.spOpenVisualTutor = spOpenVisualTutor;
window.spOpenInWorkspace = spOpenInWorkspace;

// Patched overrides — these REPLACE the original functions on window
window.spRenderPlan        = spRenderPlanPatched;          // override
window.spExamFinish        = spExamFinishPatched;          // override
window.spSavePlanToSidebar = spSavePlanToSidebarAndLibrary; // override

// SRS + confidence
window.spSrsUpdate       = spSrsUpdate;
window.spSrsLoad         = spSrsLoad;
window.spSrsGetDueToday  = spSrsGetDueToday;
window.spUpdateSrsPanel  = spUpdateSrsPanel;
window.spExportIcal      = spExportIcal;
window.spConfidenceGet   = spConfidenceGet;
window.spConfidenceBadge = spConfidenceBadge;

// ── Screens · Home ───────────────────────────────────────────────────────────
import {
  homeSetMode, homeSetInput, homeHandlePdfUpload, homeAutoResize,
  homeAppendUser, homeAppendThinking, homeRemoveThinking,
  homeAppendAI, homeAppendError,
  homeScrollBottom, homeHideLanding, homeSendMessage,
  homeToggleWebSearch, homeToggleThinking,
  openIncognitoChat, closeIncognitoChat, incognitoSendMessage,
  _renderHomeActivities,
} from './screens/HomeScreen.js';

window.homeSetMode        = homeSetMode;
window.homeSetInput       = homeSetInput;
window.homeHandlePdfUpload= homeHandlePdfUpload;
window.homeAutoResize     = homeAutoResize;
window.homeAppendUser     = homeAppendUser;
window.homeAppendThinking = homeAppendThinking;
window.homeRemoveThinking = homeRemoveThinking;
window.homeAppendAI       = homeAppendAI;
window.homeAppendError    = homeAppendError;
window.homeScrollBottom   = homeScrollBottom;
window.homeHideLanding    = homeHideLanding;
window.homeSendMessage    = homeSendMessage;
window.homeToggleWebSearch= homeToggleWebSearch;
window.homeToggleThinking = homeToggleThinking;
window._renderHomeActivities = _renderHomeActivities;

// Incognito chat
window.openIncognitoChat    = openIncognitoChat;
window.closeIncognitoChat   = closeIncognitoChat;
window.incognitoSendMessage = incognitoSendMessage;

// homeHistory / _homeSessionId are live mutable bindings — exposed as
// getter/setters so cross-module code can read/write them via window.
// The actual defineProperty calls live in HomeScreen.js because only that
// module owns the `let homeHistory` / `let _homeSessionId` variables.
// They are set at HomeScreen.js load time, so by the time globals.js
// runs they are already on window.  We do NOT duplicate them here.

// ── Screens · Workspace ──────────────────────────────────────────────────────
import { wsMobileView, refreshSmartSuggestions } from './screens/WorkspaceScreen.js';

window.wsMobileView            = wsMobileView;
window.refreshSmartSuggestions = refreshSmartSuggestions;

// ── Screens · Library ────────────────────────────────────────────────────────
import {
  filterLibraryPage, filterLibPageSection,
  libTriggerUpload, libDragOver, libDragLeave, libDrop,
  libDeleteDoc, _libInjectProgress, libRenderMyDocs,
} from './screens/LibraryScreen.js';

window.filterLibraryPage   = filterLibraryPage;
window.filterLibPageSection = filterLibPageSection;
window.libTriggerUpload    = libTriggerUpload;
window.libDragOver         = libDragOver;
window.libDragLeave        = libDragLeave;
window.libDrop             = libDrop;
window.libDeleteDoc        = libDeleteDoc;
window._libInjectProgress  = _libInjectProgress;
window.libRenderMyDocs     = libRenderMyDocs;

// ── Screens · VisualTutor ────────────────────────────────────────────────────
// _vtClear, _vtOpenForConcept, _vtRestoreSession are registered directly in
// VisualTutorScreen.js as IIFE closures over private module state.
// They cannot be imported/re-exported.

// ── Components · Toast ───────────────────────────────────────────────────────
import { showToast } from './components/Toast.js';

window._showToast  = showToast;
window.wsShowToast = showToast;

// ── Components · Storage Error Banner ────────────────────────────────────────
import { showStorageError, dismissStorageError } from './components/StorageErrorBanner.js';

window.showStorageError    = showStorageError;
window.dismissStorageError = dismissStorageError;

// ── Components · Confirm Modal ───────────────────────────────────────────────
import {
  showConfirmModal, closeConfirmModal, showSimpleNotif,
} from './components/ConfirmModal.js';

window._showSharedConfirm  = showConfirmModal;
window._closeSharedConfirm = closeConfirmModal;
window.showConfirmModal    = showConfirmModal;
window.closeConfirmModal   = closeConfirmModal;
window.showSimpleNotif     = showSimpleNotif;

// ── Components · Sidebar ─────────────────────────────────────────────────────
import {
  mountSidebars, buildSidebar, setActivePlan, _renderRecentPlansAllSidebars,
} from './components/Sidebar.js';

window.mountSidebars = mountSidebars;
window.buildSidebar  = buildSidebar;
window.setActivePlan = setActivePlan;
window._renderRecentPlansAllSidebars = _renderRecentPlansAllSidebars;

// ── Components · Profile Dropdown ────────────────────────────────────────────
import {
  toggleProfileDropdown, pdOpenHelp, pdToggleHelp,
  pdAction, _closeHelp, _closeTerms, pdOpenTerms,
  openUpgradeModal, closeUpgradeModal, handleUpgradeClick,
} from './components/ProfileDropdown.js';

window.toggleProfileDropdown = toggleProfileDropdown;
window.pdAction              = pdAction;
window.pdOpenHelp            = pdOpenHelp;
window.pdToggleHelp          = pdToggleHelp;
window.pdOpenTerms           = pdOpenTerms;
window._closeHelp            = _closeHelp;
window._closeTerms           = _closeTerms;
window.openUpgradeModal      = openUpgradeModal;
window.closeUpgradeModal     = closeUpgradeModal;
window.handleUpgradeClick    = handleUpgradeClick;

// ── Components · Settings Modal ──────────────────────────────────────────────
import {
  openSettings, closeSettings, settingsNav, settingsFontSize,
  settingsDropdown, settingsSelect,
  applyAppearance, applyAccentColor, settingsSelectAccent,
  settingsSelectVoice, settingsPlayVoice,
  settingsToggleChanged, settingsSelectStudyMode,
  _getStudyMode, _isFollowupsEnabled, _isAutoFlashEnabled,
  dataToggleSaveHistory, dataToggleImprove,
  clearAllHistory, clearPdfCache,
  settingsChangePassword, settingsDeleteAccount,
  _updateThemeBtn, toggleTheme, _updateCacheSizeLabel,
} from './components/SettingsModal.js';

window.openSettings              = openSettings;
window.closeSettings             = closeSettings;
window.settingsNav               = settingsNav;
window.settingsFontSize          = settingsFontSize;
window.settingsDropdown          = settingsDropdown;
window.settingsSelect            = settingsSelect;
window.applyAccentColor          = applyAccentColor;
window.applyAppearance           = applyAppearance;
window.settingsSelectAccent      = settingsSelectAccent;
window.settingsSelectVoice       = settingsSelectVoice;
window.settingsPlayVoice         = settingsPlayVoice;
window.settingsToggleChanged     = settingsToggleChanged;
window.settingsSelectStudyMode   = settingsSelectStudyMode;
window._getStudyMode             = _getStudyMode;
window._isFollowupsEnabled       = _isFollowupsEnabled;
window._isAutoFlashEnabled       = _isAutoFlashEnabled;
window.dataToggleSaveHistory     = dataToggleSaveHistory;
window.dataToggleImprove         = dataToggleImprove;
window.clearAllHistory           = clearAllHistory;
window.clearPdfCache             = clearPdfCache;
window.settingsChangePassword    = settingsChangePassword;
window.settingsDeleteAccount     = settingsDeleteAccount;
window._updateThemeBtn           = _updateThemeBtn;
window.toggleTheme               = toggleTheme;
window._updateCacheSizeLabel     = _updateCacheSizeLabel;

// ── Components · Library Modal ───────────────────────────────────────────────
import {
  openLibraryModal, closeLibraryModal,
  libModalTriggerUpload, libModalDragOver, libModalDragLeave,
  libModalDrop, libModalDeleteDoc,
} from './components/LibraryModal.js';

window.openLibraryModal    = openLibraryModal;
window.closeLibraryModal   = closeLibraryModal;
window.libModalTriggerUpload = libModalTriggerUpload;
window.libModalDragOver    = libModalDragOver;
window.libModalDragLeave   = libModalDragLeave;
window.libModalDrop        = libModalDrop;
window.libModalDeleteDoc   = libModalDeleteDoc;

// ── Share ────────────────────────────────────────────────────────────────────
import { shareDeck, shareExamResults, shareStudyPlan } from './state/share.js';

window.shareDeck        = shareDeck;
window.shareExamResults = shareExamResults;
window.shareStudyPlan   = shareStudyPlan;

// ── Progress Tracker ─────────────────────────────────────────────────────────
import { ProgressTracker } from './lib/progressTracker.js';

window.ProgressTracker = ProgressTracker;

// ── Command Engine ───────────────────────────────────────────────────────────
import { CommandEngine } from './state/commandEngine.js';

window.CommandEngine = CommandEngine;

// ── Sidebar theme sync ───────────────────────────────────────────────────
// _syncThemeToggleBtns is a local function in Sidebar.js that registers
// itself on window.  It cannot be imported — the registration stays in
// Sidebar.js alongside the DOM code it depends on.
