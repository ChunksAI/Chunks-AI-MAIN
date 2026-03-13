/**
 * src/main.js — Chunks AI entry point
 *
 * This file is the single JS root that Vite resolves from index.html.
 *
 * Current state (Task 1): empty — serves as a verified import root.
 *
 * Growth path:
 *   Task 3+  → import './styles/tokens.css'  (and other CSS files)
 *   Task 10+ → import { askQuestion } from './lib/api.js'
 *   Task 15+ → import { initNavigation } from './state/navigation.js'
 *   Task 25+ → import { mountHomeScreen } from './screens/HomeScreen.js'
 */

// ── Styles (added task-by-task) ────────────────────────────────────────────
import './styles/tokens.css';             // Task 3 ✓
import './styles/base.css';              // Task 4 ✓
import './styles/layout.css';            // Task 5 ✓
import './styles/sidebar.css';           // Task 6 ✓
import './styles/modals.css';            // Task 7 ✓
import './styles/screens/home.css';      // Task 8 ✓
import './styles/screens/workspace.css'; // Task 8 ✓
import './styles/screens/flash.css';     // Task 8 ✓
import './styles/screens/library.css';   // Task 8 ✓
import './styles/screens/research.css';  // Task 8 ✓
import './styles/screens/exam.css';      // Task 8 ✓
import './styles/screens/studyplan.css'; // Task 8 ✓
import './styles/responsive.css';        // Task 9 ✓ — must stay last

// ── Lib (added task-by-task) ───────────────────────────────────────────────
import { API_BASE }          from './lib/api.js';       // Task 10 ✓ — also sets window.API_BASE
import { getSupabaseClient } from './lib/supabase.js';  // Task 11 ✓ — also sets window._getChunksSb
import { ChunksDB }          from './lib/chunksDb.js';  // Task 31 ✓ — also sets window.ChunksDB
import './lib/auth.js';                                  // Task 32
import './lib/events.js';                                // Task 34 ✓ — global data-action delegation ✓ — sets window.{chunksSignIn,chunksSignOut,_initAuth,_refreshUserPlan,_applyUserProfile,_applyPlanUI,_getSessionEmail,_ensureUserInDb,_startPresence,_checkAdminAccess,openAdminPanel}
import './lib/flashcardDb.js';                           // Task 33 ✓ — sets window.{_fcSaveDeck,_fcLoadDecks,_fcLoadCards,_fcRenderDeckList,_fcLoadDeckIntoStudy,_fcSaveSession,_fcGetLastSession,_fcInitScreen,…}
import './utils/render.js';                             // Task 12 ✓ — sets window.{sanitize,wsRender,homeMarkdown,_renderMath,_spExplainMarkdown}
import './utils/storage.js';                            // Task 13 ✓ — sets window.{_historySavingEnabled,_saveSession,_loadSession,_saveWsSession,_loadWsSession,_getStudyMode,…}
import './utils/focusTrap.js';                          // Task 14 ✓ — sets window.trapFocus
import './state/navigation.js';                         // Task 15 ✓ — sets window.{showScreen,toggleSidebar,handleLogoClick,animateOrbits}
import './state/workspaceState.js';                     // Task 16 ✓ — sets window.{wsBookMeta,_wsPdfDoc,_wsBookId,_wsChatHistory,…}
import './state/flashState.js';                         // Task 17 ✓ — sets window.{cardFlipped,_fcDeck,_fcIndex,_fcStats,…}
import './state/studyPlanState.js';                     // Task 18 ✓ — sets window.{_spCurrentPlan,_spMastery,_spFcDeck,_spPqQuestions,…}

// ── Components (added task-by-task) ───────────────────────────────────────
import { mountAllSidebars } from './components/Sidebar.js'; // Task 19 ✓ / Task 36 ✓ — static copies removed, now mounted dynamically
import './components/Toast.js';                         // Task 20 ✓ — sets window.{showToast,wsShowToast,_showToast}
import './components/ConfirmModal.js';                  // Task 21 ✓ — sets window.{showConfirmModal,closeConfirmModal,_showSharedConfirm,_closeSharedConfirm}
import './components/ProfileDropdown.js';               // Task 22 ✓ — sets window.{toggleProfileDropdown,pdAction,pdOpenHelp,pdToggleHelp,pdOpenTerms,…}
import './components/LibraryModal.js';                  // Task 23 ✓ — sets window.{openLibraryModal,closeLibraryModal,filterLibrary,filterLibSection}
import './components/SettingsModal.js';                 // Task 24 ✓ — sets window.{openSettings,closeSettings,settingsFontSize,settingsNav,settingsDropdown,settingsSelect,settingsSelectAccent,settingsSelectVoice,settingsPlayVoice,settingsToggleChanged,settingsSelectDefaultBook,settingsSelectStudyMode,applyAccentColor,dataToggleSaveHistory,dataToggleImprove,clearAllHistory,clearPdfCache}

// ── Screens (added task-by-task) ───────────────────────────────────────────
import './screens/HomeScreen.js';                        // Task 25 ✓ — sets window.{goHome,newChat,recentAdd,_setActiveRecent,_deleteRecent,_renderAllRecent,homeSetMode,homeSetInput,homeHandlePdfUpload,homeAutoResize,homeScrollBottom,homeHideLanding,homeSendMessage,homeToggleAttachMenu,homeAttachTrigger,homeHandleAttach,homeAppendUser,homeAppendAI,homeAppendError}
import './screens/WorkspaceScreen.js';                   // Task 26 ✓ — sets window.{selectBook,togglePdfOutline,wsPrevPage,wsNextPage,wsGoToPage,wsJumpToPage,wsZoomIn,wsZoomOut,wsCopyMsg,wsMakeFlashcard,wsSetInput,wsAutoResize,wsScrollBottom,wsClearChat,wsAppendUser,wsAppendAI,wsAppendError,wsChatSend,wsToggleAttachMenu,wsAttachTrigger,wsHandleAttach,wsMobileView}
import './screens/FlashScreen.js';                       // Task 27 ✓ — sets window.{_fcRenderCard,_fcUpdateStats,_fcNext,_fcShowCompleteModal,_fcRestartDeck,_fcCreateNew,_fcShowSkeleton,_fcClearSkeleton,_fcGenerateFromBar,_fcSaveDeck,_fcLoadDecks,_fcLoadCards,_fcRenderDeckList,_fcLoadDeckIntoStudy,_fcSaveSession,_fcGetLastSession,_fcInitScreen,wsMakeFlashcard}
import './screens/ResearchScreen.js';                    // Task 28 ✓
import './screens/ExamScreen.js';                        // Task 29 ✓
import './screens/StudyPlanScreen.js';                   // Task 30 ✓ — sets window.{spMasteryGet,spMasteryScore,spMasteryRecord,spMasteryUpdateNode,spMasteryMarkChipsDone,spMasteryUnlockNext,spSwitchTab,spSetDepth,spUpdateNotesCount,spShowValidationError,spHideValidationError,spValidateInputs,spDragOver,spDragLeave,spDrop,spClearUpload,spHandleFileSelect,spShowOverlay,spHideOverlay,spHandleGenerate,spRenderPlan,spBuildNode,spUpdateStats,spUpdateDetailPanel,spShowEmpty,spShowPlan,spSavePlanToSidebar,spRenderRecentPlansSidebar,spAnimateBars,animateBars,spUpdatePanel,spOpenExplainDrawer,spCloseExplainDrawer,spDrawerTab,spFcGenerate,spFcShowDeck,spFcRenderCard,spFcFlip,spFcRate,spFcShowComplete,spFcRestart,spPqGenerate,spPqShowCurrent,spPqSubmit,spPqNext,spPqShowComplete,spPqRestart,spExamGenerate,spExamStart,spExamShowCurrent,spExamAnswer,spExamFinish,spExamRestart,spInitScreen}

// ── App bootstrap (Task 25+) ───────────────────────────────────────────────
// import { boot } from './app.js';
// boot();

// ── Task 36 — mount all sidebars (replaces 6 static HTML copies) ──────────────
// ES modules are deferred — DOM is fully parsed by the time this runs.
// Call immediately; also guard with DOMContentLoaded in case of edge cases.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountAllSidebars());
} else {
  mountAllSidebars();
}

console.log('[Chunks AI] main.js loaded — Task 36 complete ✦');