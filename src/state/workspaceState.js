/**
 * src/state/workspaceState.js — Workspace state
 *
 * Single source of truth for all mutable workspace variables: the PDF viewer,
 * chat session, outline, toast timer, and attachment lists.
 *
 * Why window.*?
 * ─────────────
 * Until Phase 5 (Task 26) the workspace functions still live in monolith
 * <script> tags that reference these as bare names (_wsPdfDoc, _wsBookId …).
 * In non-strict mode, bare-name reads and writes on an undeclared identifier
 * resolve to / create window properties — so exposing the state via window
 * lets the existing code keep working without any changes to the monolith.
 *
 * Exports
 * ───────
 *   WS_BOOK_META      Book-id → { name, author } lookup table (read-only)
 *   ZOOM              { STEP, MIN, MAX }  PDF zoom constants (read-only)
 *
 * All mutable state is exposed only via window.* (see bottom of file) so
 * the monolith can read and write it as bare names.
 *
 * Task 16 — extracted from monolith:
 *   wsBookMeta           → line 2135
 *   ZOOM_STEP/MIN/MAX    → line 2151
 *   _wsPdfDoc …          → lines 2146–2150
 *   _pdfjsLib            → line 2202
 *   _wsBookId …          → lines 2236–2239
 *   _wsOutlineFlat       → line 2607
 *   _wsToastTimer        → line 3588
 *   _wsAttachments       → line 4181
 *   _homeAttachments     → line 4182
 */

import { lsGet } from '../utils/storage.js';

// ── Book catalogue ─────────────────────────────────────────────────────────

/**
 * Maps every supported book-id to its display name and author.
 * Import this wherever book metadata is needed instead of referencing the
 * window global.
 */
export const WS_BOOK_META = {
  zumdahl:  { name: 'General Chemistry',              author: 'Zumdahl & Zumdahl' },
  atkins:   { name: 'Physical Chemistry',             author: 'Atkins & de Paula' },
  klein:    { name: 'Organic Chemistry',              author: 'David Klein' },
  harris:   { name: 'Quantitative Chemical Analysis', author: 'Daniel C. Harris' },
  berg:     { name: 'Biochemistry',                   author: 'Berg, Tymoczko & Stryer' },
  netter:   { name: 'Atlas of Human Anatomy',         author: 'Frank H. Netter' },
  anaphy2e: { name: 'Anatomy & Physiology',           author: 'Patton & Thibodeau' },
};

// ── Zoom constants ─────────────────────────────────────────────────────────

/** PDF viewer zoom increment / bounds */
export const ZOOM = { STEP: 0.2, MIN: 0.6, MAX: 3.0 };

// ── PDF viewer state ───────────────────────────────────────────────────────

/**
 * All variables below are mutable.  They are declared here for documentation
 * and initialised as window.* so the monolith's <script> functions can
 * read/write them as bare names without modification.
 *
 * @type {import('pdfjs-dist').PDFDocumentProxy|null}  _wsPdfDoc
 * @type {number}  _wsScale         Current render scale (fit-to-width on load)
 * @type {number}  _wsCurrentPage   1-indexed current page
 * @type {number}  _wsTotalPages    Total page count for the loaded PDF
 * @type {Array}   _wsPageContainers DOM container elements, one per page
 * @type {any}     _pdfjsLib        Lazily-loaded PDF.js library reference
 */

// ── Chat session state ─────────────────────────────────────────────────────

/**
 * @type {string}   _wsBookId           Currently selected book id
 * @type {Array}    _wsChatHistory      Accumulated message history for the AI
 * @type {boolean}  _newChatIsIncognito Set true via Ctrl+Shift+I before newChat()
 * @type {boolean}  _wsTyping           True while an AI response is streaming
 */

// ── Outline state ──────────────────────────────────────────────────────────

/**
 * @type {Array<{title:string, page:number, level:number, el:Element}>}
 *   _wsOutlineFlat  Flat list of outline entries, used for scroll-sync
 */

// ── Toast state ────────────────────────────────────────────────────────────

/** @type {ReturnType<typeof setTimeout>|null}  _wsToastTimer */

// ── Attachment state ───────────────────────────────────────────────────────

/**
 * @type {Array<{type:string, file:File, dataUrl:string, name:string}>}
 *   _wsAttachments    Pending attachments in the workspace chat input
 *   _homeAttachments  Pending attachments in the home chat input
 */

// ── Initialise window globals ──────────────────────────────────────────────
//
// These assignments replace the bare `let` declarations that were scattered
// across the monolith.  The monolith's functions continue to work unchanged
// because bare-name access in non-strict <script> tags resolves to window.*.

// PDF viewer
window._wsPdfDoc        = null;
window._wsScale         = 1.0;
window._wsCurrentPage   = 1;
window._wsTotalPages    = 0;
window._wsPageContainers = [];
window._pdfjsLib        = null;

// Zoom constants — also kept as window properties for any legacy inline use
window.ZOOM_STEP = ZOOM.STEP;
window.ZOOM_MIN  = ZOOM.MIN;
window.ZOOM_MAX  = ZOOM.MAX;

// Chat
window._wsBookId           = lsGet('chunks_default_book') || 'atkins';
window._wsChatHistory      = [];
window._newChatIsIncognito = false;
window._wsTyping           = false;

// Outline
window._wsOutlineFlat = [];

// Toast
window._wsToastTimer = null;

// Attachments
window._wsAttachments   = [];
window._homeAttachments = [];

// Book meta — expose the const so monolith code using wsBookMeta keeps working
window.wsBookMeta = WS_BOOK_META;
