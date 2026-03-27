/**
 * src/state/workspace/index.js — Barrel re-exports + window bridges
 *
 * Re-exports every public symbol from the workspace sub-modules and
 * wires up legacy `window.*` bridges exactly as the original monolith did.
 */

// ── Re-exports ────────────────────────────────────────────────────────────

export { ws, wsBookMeta, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX, _wsBookOutlines } from './state.js';

export {
  _wsUpdateBadge, wsPrevPage, wsNextPage, wsGoToPage, wsJumpToPage,
  wsZoomIn, wsZoomOut, _wsRescale, _loadPdfJs, _wsRenderPage,
} from './pdf.js';

export { selectBook, _wsShowWelcome } from './books.js';

export { selectUserDoc } from './userDocs.js';

export {
  togglePdfOutline, _wsBuildOutline, _wsSetActiveOutlineItem, _wsUpdateOutlineActive,
} from './outline.js';

export { filterLibrary, filterLibSection } from './library.js';

export {
  wsShowToast, wsSetInput, wsAutoResize, wsScrollBottom, wsClearChat,
  wsAppendUser, _wsAvatarSvg, wsAppendThinking, wsRemoveThinking,
  wsAppendAI, wsAppendError, wsCopyMsg, _wsFollowups, _wsRegenerate,
  wsToggleWebSearch, wsToggleThinking, wsChatSend, _wsAsk,
} from './chat.js';

export { _wsCreateAskBtn, _wsHideAskBtn, _wsOnSelectionChange } from './selection.js';

export {
  _closeAllAttachMenus, _buildThumb, _readFile,
  wsToggleAttachMenu, wsAttachTrigger, wsHandleAttach, _wsRenderPreview,
  homeToggleAttachMenu, homeAttachTrigger, homeHandleAttach, _homeRenderPreview,
} from './attachments.js';

export { wsPromptYouTube, wsCloseYouTube, wsIngestYouTube } from './youtube.js';

export {
  wsToggleVoiceInput, wsReadAloud, wsStopReading,
  wsVoiceSupported, wsTtsSupported,
} from './voice.js';


