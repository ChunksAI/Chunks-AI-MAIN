/**
 * src/main.js — Chunks AI entry point
 *
 * Single JS root resolved by Vite from index.html.
 * All CSS, lib, utils, state, screens, and components are imported here
 * in dependency order. Vite/Rollup splits this into 5 hashed chunks:
 *   lib · utils · state · components · screens
 * (see vite.config.js Task 37 for chunk strategy)
 */

// ── Styles (added task-by-task) ────────────────────────────────────────────
import './styles/tokens.css';             // Task 3 ✓
import './styles/base.css';              // Task 4 ✓
import './styles/layout.css';            // Task 5 ✓
import './styles/sidebar.css';           // Task 6 ✓
import './styles/modals.css';            // Task 7 ✓
import './styles/modals/shortcuts.css';  // Task 35 ✓ — shortcuts modal
import './styles/modals/help.css';       // Task 35 ✓ — help centre modal
import './styles/modals/bugreport.css';  // Task 35 ✓ — bug report modal
import './styles/screens/home.css';      // Task 8 ✓
import './styles/screens/workspace.css'; // Task 8 ✓
import './styles/screens/flash.css';     // Task 8 ✓
import './styles/screens/library.css';   // Task 8 ✓
import './styles/screens/research.css';  // Task 8 ✓
import './styles/screens/exam.css';      // Task 8 ✓
import './styles/screens/studyplan.css'; // Task 8 ✓
import './styles/screens/studyplan-drawer.css'; // Task 35 ✓ — SP explain drawer
import './styles/screens/studyplan-exam.css';   // Task 35 ✓ — SP exam options
import './styles/responsive.css';        // Task 9 ✓ — must stay last

// ── Lib (added task-by-task) ───────────────────────────────────────────────
import { API_BASE }          from './lib/api.js';       // Task 10 ✓ — also sets window.API_BASE
import { getSupabaseClient } from './lib/supabase.js';  // Task 11 ✓ — also sets window._getChunksSb
import { ChunksDB }          from './lib/chunksDb.js';  // Task 31 ✓ — sets window.ChunksDB
import './lib/flashcardDb.js';                           // Task 33 ✓ — sets window.FlashcardDB
import './lib/auth.js';                                  // Task 32 ✓ — sets window._currentUser, chunksSignOut, _initAuth
import './utils/render.js';                             // Task 12 ✓ — sets window.{sanitize,wsRender,homeMarkdown,_renderMath,_spExplainMarkdown}
import './utils/storage.js';                            // Task 13 ✓ — sets window.{_lsGet,_lsSet,getSetting,setSetting,STORAGE_KEYS}
import './utils/focusTrap.js';                          // Task 14 ✓ — sets window.trapFocus

// ── State (added task-by-task) ─────────────────────────────────────────────
import './state/navigation.js';                         // Task 15 ✓ — sets window.showScreen, toggleSidebar, mobileNav, etc.
import './state/workspaceState.js';                     // Task 16 ✓ — sets window.selectBook, wsGoToPage, wsChatSend, etc.
import './state/flashState.js';
import './styles/screens/visual-tutor.css';                         // Task 17 ✓ — sets window.wsMakeFlashcard, _fcRenderCard, etc.
import './state/studyPlanState.js';                     // Task 18 ✓ — sets window.spHandleGenerate, spOpenExplainDrawer, etc.

// ── Screens (added task-by-task) ───────────────────────────────────────────
// Both screen modules MUST be imported before Sidebar.js. They mount
// synchronously at eval time so all #screen-* elements exist before
// navigation.js's _restoreScreen() IIFE and Sidebar's DOMContentLoaded scan.
import { mountHomeScreen }       from './screens/HomeScreen.js';       // Task 25 ✓
import { mountWorkspaceScreen }  from './screens/WorkspaceScreen.js';  // Task 26 ✓
import { mountFlashScreen }      from './screens/FlashScreen.js';      // Task 27 ✓
import { mountResearchScreen }   from './screens/ResearchScreen.js';   // Task 28 ✓
import { mountExamScreen }       from './screens/ExamScreen.js';       // Task 29 ✓
import { mountStudyPlanScreen }  from './screens/StudyPlanScreen.js';  // Task 30 ✓
import { mountVisualTutorScreen } from './screens/VisualTutorScreen.js'; // Visual Tutor ✓

// ── Components (added task-by-task) ───────────────────────────────────────
import './components/Sidebar.js';                       // Task 19 ✓ — mounts all 6 sidebar placeholders
import './components/Toast.js';                         // Task 20 ✓ — sets window._showToast, window.wsShowToast
import './components/ConfirmModal.js';                  // Task 21 ✓ — sets window.showConfirmModal, closeConfirmModal, showSimpleNotif
import './components/ProfileDropdown.js';               // Task 22 ✓ — sets window.toggleProfileDropdown, pdAction, pdOpenHelp, etc.
import './components/LibraryModal.js';                  // Task 23 ✓ — sets window.openLibraryModal, closeLibraryModal
import './components/SettingsModal.js';                 // Task 24 ✓ — sets window.openSettings, closeSettings, settingsNav, etc.

// ── App bootstrap ──────────────────────────────────────────────────────────
// HomeScreen self-mounts via its own readyState guard (same pattern as Sidebar).

console.log('[Chunks AI] main.js loaded ✦');
