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

// ── Legacy global bridges ─────────────────────────────────────────────────

import { ws, wsBookMeta }    from './state.js';
import { wsPrevPage, wsNextPage, wsGoToPage, wsJumpToPage,
         wsZoomIn, wsZoomOut, _loadPdfJs, _wsRenderPage } from './pdf.js';
import { selectBook }        from './books.js';
import { selectUserDoc }     from './userDocs.js';
import { togglePdfOutline, _wsUpdateOutlineActive } from './outline.js';
import { filterLibrary, filterLibSection } from './library.js';
import {
  wsShowToast, wsSetInput, wsAutoResize, wsScrollBottom, wsClearChat,
  wsAppendUser, wsAppendThinking, wsRemoveThinking,
  wsAppendAI, wsAppendError, wsCopyMsg, _wsRegenerate,
  wsToggleWebSearch, wsToggleThinking,
} from './chat.js';
import {
  wsToggleAttachMenu, wsAttachTrigger, wsHandleAttach,
  homeToggleAttachMenu, homeAttachTrigger, homeHandleAttach,
} from './attachments.js';

window.wsBookMeta          = wsBookMeta;
window.selectBook          = selectBook;
// Live getter so index.html's recentAdd() always reads the current value
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
window.wsToggleWebSearch   = wsToggleWebSearch;
window.wsToggleThinking    = wsToggleThinking;
window.wsZoomOut           = wsZoomOut;
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
window.wsMakeFlashcard     = async function(btn, msgId, question) {
  // wsMakeFlashcard is defined in flashState.js (Task 17) — this is a forward-reference stub
  // that will be replaced when that module loads. The actual implementation references
  // _fcDeck/_fcIndex etc which live there.
  console.warn('[ws] wsMakeFlashcard called before flashState loaded');
};
window._wsRegenerate       = _wsRegenerate;
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
window._loadPdfJs             = _loadPdfJs;   // used by studyPlanState.js PDF extraction
window.selectUserDoc          = selectUserDoc;
