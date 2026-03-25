/**
 * globals.d.ts — Auto-generated ambient declarations for Chunks AI.
 *
 * This file tells TypeScript about CSS module imports, the many
 * properties attached to `window.*`, and the bare globals that are
 * referenced without the `window.` prefix throughout the codebase.
 *
 * All runtime values are typed as `any` because they are set
 * imperatively at various points during app bootstrap.
 *
 * Keep in sync with the canonical property list when globals change.
 */

/* ------------------------------------------------------------------ */
/*  CSS module imports                                                 */
/* ------------------------------------------------------------------ */

declare module '*.css' {
  const styles: Record<string, string>;
  export default styles;
}

/* ------------------------------------------------------------------ */
/*  Window interface extension                                        */
/* ------------------------------------------------------------------ */

interface Window {
  /* ---- Third-party libraries ---- */
  DOMPurify: any;
  katex: any;
  pdfjsLib: any;
  supabase: any;

  /* ---- Backend / environment ---- */
  API_BASE: any;
  CHUNKS_BACKEND_URL: any;

  /* ---- Database helpers ---- */
  ChunksDB: any;
  FlashcardDB: any;

  /* ---- Constants & config ---- */
  FC_ACCENTS: any;
  RS: any;
  STORAGE_KEYS: any;
  SyncManager: any;

  /* ---- Auth & user profile ---- */
  _applyUserProfile: any;
  _getAuthHeader: any;
  _getChunksSb: any;
  _initAuth: any;
  chunksSignOut: any;
  isGuestMode: any;
  openAuthModal: any;

  /* ---- Local / session storage helpers ---- */
  _lsGet: any;
  _lsRemove: any;
  _lsSet: any;
  _ssGet: any;
  _ssRemove: any;
  _ssSet: any;
  getSetting: any;
  setSetting: any;

  /* ---- Guest mode ---- */
  guestCheckLimit: any;
  guestGate: any;
  guestRecordUsage: any;
  renderGuestUsageBar: any;
  showGuestLoginWall: any;

  /* ---- Theme / appearance ---- */
  _updateThemeBtn: any;
  applyAccentColor: any;
  applyAppearance: any;
  toggleTheme: any;

  /* ---- Notifications & toasts ---- */
  _chunksNotifications: any;
  _showToast: any;
  showSimpleNotif: any;
  showStorageError: any;
  dismissStorageError: any;

  /* ---- Recent items ---- */
  _activeExamRecentId: any;
  _activeRecentId: any;
  _recentItems: any;
  _hydrateRecentFromRemote: any;
  _renderAllRecent: any;
  _setActiveRecent: any;
  recentAdd: any;

  /* ---- Navigation / screens ---- */
  showScreen: any;
  drawerNav: any;
  mobileNav: any;
  handleLogoClick: any;
  openMobileDrawer: any;
  closeMobileDrawer: any;

  /* ---- Sidebar ---- */
  buildSidebar: any;
  mountSidebars: any;
  toggleSidebar: any;
  toggleProfileDropdown: any;

  /* ---- Settings panel ---- */
  openSettings: any;
  closeSettings: any;
  settingsChangePassword: any;
  settingsDeleteAccount: any;
  settingsDropdown: any;
  settingsFontSize: any;
  settingsNav: any;
  settingsPlayVoice: any;
  settingsSelect: any;
  settingsSelectAccent: any;
  settingsSelectStudyMode: any;
  settingsSelectVoice: any;
  settingsToggleChanged: any;
  dataToggleImprove: any;
  dataToggleSaveHistory: any;

  /* ---- Modals / dialogs ---- */
  closeConfirmModal: any;
  showConfirmModal: any;
  _closeSharedConfirm: any;
  _showSharedConfirm: any;
  openUpgradeModal: any;
  openBugReport: any;
  openHelpCenter: any;
  openShortcuts: any;
  trapFocus: any;

  /* ---- Help / terms / privacy ---- */
  _closeHelp: any;
  _closeTerms: any;
  pdAction: any;
  pdOpenHelp: any;
  pdOpenTerms: any;
  pdToggleHelp: any;

  /* ---- Incognito chat ---- */
  openIncognitoChat: any;
  closeIncognitoChat: any;
  incognitoSendMessage: any;

  /* ---- Home / chat ---- */
  _homeMountLatestSession: any;
  _homeSessionId: any;
  homeAppendAI: any;
  homeAppendError: any;
  homeAppendThinking: any;
  homeAppendUser: any;
  homeAttachTrigger: any;
  homeAutoResize: any;
  homeHandleAttach: any;
  homeHandlePdfUpload: any;
  homeHideLanding: any;
  homeHistory: any;
  homeMarkdown: any;
  homeRemoveThinking: any;
  homeScrollBottom: any;
  homeSendMessage: any;
  homeSetInput: any;
  homeSetMode: any;
  homeToggleAttachMenu: any;
  homeToggleThinking: any;
  homeToggleWebSearch: any;

  /* ---- AI parameters ---- */
  _aiParams: any;
  _getStudyMode: any;
  _isAutoFlashEnabled: any;
  _isFollowupsEnabled: any;

  /* ---- Session / save ---- */
  _save: any;
  _saveSession: any;

  /* ---- Math rendering ---- */
  _renderMath: any;

  /* ---- Outline ---- */
  _renderOutline: any;

  /* ---- Debug ---- */
  _renderDebugLimits: any;

  /* ---- PDF helpers ---- */
  _loadPdfJs: any;
  _uploadedPdfFile: any;
  _uploadedPdfName: any;
  clearPdfCache: any;
  togglePdfOutline: any;

  /* ---- Library ---- */
  _libInjectProgress: any;
  openLibraryModal: any;
  closeLibraryModal: any;
  filterLibrary: any;
  filterLibraryPage: any;
  filterLibPageSection: any;
  filterLibSection: any;
  libDeleteDoc: any;
  libDragLeave: any;
  libDragOver: any;
  libDrop: any;
  libModalDeleteDoc: any;
  libModalDragLeave: any;
  libModalDragOver: any;
  libModalDrop: any;
  libModalTriggerUpload: any;
  libRenderMyDocs: any;
  libTriggerUpload: any;
  selectBook: any;
  selectUserDoc: any;

  /* ---- Cache ---- */
  _updateCacheSizeLabel: any;
  clearAllHistory: any;

  /* ---- Workspace ---- */
  _wsChatHistory: any;
  _wsRegenerate: any;
  _wsRenderPage: any;
  _wsUpdateOutlineActive: any;
  wsAppendAI: any;
  wsAppendError: any;
  wsAppendThinking: any;
  wsAppendUser: any;
  wsAttachTrigger: any;
  wsAutoResize: any;
  wsBookMeta: any;
  wsChatSend: any;
  wsClearChat: any;
  wsCopyMsg: any;
  wsGoToPage: any;
  wsHandleAttach: any;
  wsJumpToPage: any;
  wsMakeFlashcard: any;
  wsMobileView: any;
  wsNextPage: any;
  wsPrevPage: any;
  wsRemoveThinking: any;
  wsRender: any;
  wsScrollBottom: any;
  wsSetInput: any;
  wsShowToast: any;
  wsToggleAttachMenu: any;
  wsToggleThinking: any;
  wsToggleWebSearch: any;
  wsZoomIn: any;
  wsZoomOut: any;

  /* ---- Visual tutor ---- */
  _vtAsk: any;
  _vtClear: any;
  _vtOpenForConcept: any;
  _vtRestoreSession: any;

  /* ---- Research ---- */
  _researchBackToSetup: any;

  /* ---- Flashcards ---- */
  _fcAwardLegendBadge: any;
  _fcCheckNewAccentUnlock: any;
  _fcCloseCompleteModal: any;
  _fcCloseEditCard: any;
  _fcCreateNew: any;
  _fcDeleteDeck: any;
  _fcDismissTutor: any;
  _fcExitStudy: any;
  _fcFlameSvg: any;
  _fcFlip: any;
  _fcGenerateFromBar: any;
  _fcGetFreeze: any;
  _fcGetStreak: any;
  _fcGetXp: any;
  _fcHardBoostActive: any;
  _fcInitAccent: any;
  _fcIsLegend: any;
  _fcNext: any;
  _fcOpenAccentPicker: any;
  _fcOpenEditCard: any;
  _fcOpenPdfUpload: any;
  _fcRecordStudyDay: any;
  _fcRenderDeckList: any;
  _fcRenderStreak: any;
  _fcRestartDeck: any;
  _fcReviewHardInChat: any;
  _fcSaveEditCard: any;
  _fcSelectAccent: any;
  _fcSound: any;
  _fcStartDeck: any;
  _fcStreakMilestones: any;
  _fcStudyHardOnly: any;
  _fcStudyInChat: any;
  _fcXpMultiplier: any;

  /* ---- Exams ---- */
  _examGetWeakContext: any;
  _examShow: any;
  _examSourceLabel: any;
  _examSourceText: any;
  _examToggleScanMode: any;
  enforceExamConstraints: any;

  /* ---- Study-plan (sp*) ---- */
  _renderRecentPlansSidebar: any;
  _spCheckAndExpireExamDate: any;
  _spExplainMarkdown: any;
  animateBars: any;
  setActivePlan: any;
  spBuildNode: any;
  spCheckAdaptiveReorder: any;
  spClearExamDate: any;
  spClearUpload: any;
  spCloseExplainDrawer: any;
  spConfidenceBadge: any;
  spConfidenceGet: any;
  spDeletePlan: any;
  spDrawerTab: any;
  spDrop: any;
  spExamAnswer: any;
  spExamFinish: any;
  spExamGenerate: any;
  spExamRestart: any;
  spExamShowCurrent: any;
  spExamStart: any;
  spExportIcal: any;
  spFcFlip: any;
  spFcGenerate: any;
  spFcRate: any;
  spFcRenderCard: any;
  spFcRestart: any;
  spFcShowComplete: any;
  spFcShowDeck: any;
  spFilterPlansMenu: any;
  spGetUpNextItems: any;
  spHandleFileSelect: any;
  spHandleGenerate: any;
  spHideOverlay: any;
  spHidePlansMenu: any;
  spInitScreen: any;
  spLoadAllPlans: any;
  spMasteryGet: any;
  spMasteryRecord: any;
  spMasteryScore: any;
  spMasteryUnlockNext: any;
  spMasteryUpdateNode: any;
  spOpenExplainDrawer: any;
  spOpenInWorkspace: any;
  spOpenVisualTutor: any;
  spPqGenerate: any;
  spPqNext: any;
  spPqRestart: any;
  spPqShowComplete: any;
  spPqShowCurrent: any;
  spPqSubmit: any;
  spRenderPlan: any;
  spRenderRecentPlansSidebar: any;
  spSaveCurrentPlanToLibrary: any;
  spSavePlanToSidebar: any;
  spSetDepth: any;
  spSetExamDate: any;
  spShowEmpty: any;
  spShowExamDatePicker: any;
  spShowOverlay: any;
  spShowPlan: any;
  spShowPlansMenu: any;
  spSrsGetDueToday: any;
  spSrsLoad: any;
  spSrsUpdate: any;
  spSwitchTab: any;
  spSwitchToPlan: any;
  spToggleReminder: any;
  spUpdateDailySchedule: any;
  spUpdateDetailPanel: any;
  spUpdateExamDateUI: any;
  spUpdateNotesCount: any;
  spUpdatePanel: any;
  spUpdateReminderTime: any;
  spUpdateReminderUI: any;
  spUpdateSrsPanel: any;
  spUpdateStats: any;
  spValidateInputs: any;

}

/* ------------------------------------------------------------------ */
/*  Bare global variables (used without `window.` prefix)             */
/* ------------------------------------------------------------------ */

declare var _activeExamRecentId: any;
declare var _activeRecentId: any;
declare var _examShow: any;
declare var _getStudyMode: any;
declare var _isAutoFlashEnabled: any;
declare var _isFollowupsEnabled: any;
declare var _loadPdfJs: any;
declare var _mountSession: any;
declare var _recentItems: any;
declare var _saveWsSession: any;
declare var _setActiveRecent: any;
declare var _spExplainMarkdown: any;
declare var closeLibraryModal: any;
declare var docMeta: any;
declare var homeSetInput: any;
declare var selectUserDoc: any;
declare var showScreen: any;
declare var trapFocus: any;
declare var wsAutoResize: any;
declare var wsRender: any;
declare var wsShowToast: any;
