

// @ts-nocheck
/**
 * src/screens/WorkspaceScreen.js — Task 26
 *
 * Owns:
 *   • #screen-workspace HTML injection (replaces data-workspace-screen placeholder)
 *   • Drag-to-resize splitter (resizer IIFE)
 *   • wsMobileView() — mobile chat/PDF toggle
 *   • SmartNotesPanel + StickyStrip Preact islands (mounted after HTML inject)
 *
 * Bridges set on window.*:
 *   wsMobileView
 *
 * All other workspace logic (selectBook, wsChatSend, wsPrevPage, wsNextPage,
 * wsZoomIn, wsZoomOut, wsJumpToPage, togglePdfOutline, wsHandleAttach, etc.)
 * is already owned by src/state/workspace/ (Task 16).
 */

import { mountSmartNotesPanel, mountStickyStrip } from '../components/SmartNotesPanel.jsx';
import { mountCanvasPanel } from '../components/CanvasPanel.jsx';
import { wsFitWidth } from '../state/workspace/pdf.js';

// ── HTML template ─────────────────────────────────────────────────────────────

const WORKSPACE_HTML = /* html */`
<div class="screen" id="screen-workspace">

  <!-- Mobile workspace topbar (hidden on desktop) -->
  <div class="mobile-ws-topbar" style="display:none;">
    <button type="button" class="mwt-back" data-action="goHome" aria-label="Back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <div class="mwt-title-block">
      <div class="mwt-title" id="mwt-book-name">Study Workspace</div>
      <div class="mwt-subtitle" id="mwt-book-sub">Select a book to begin</div>
    </div>
    <!-- Chat / PDF toggle pill -->
    <div class="mwt-view-toggle">
      <button type="button" class="mwt-vtab active" id="mwt-tab-chat" data-action="wsMobileView" data-view="chat" aria-label="Chat view">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>Chat</span>
      </button>
      <button type="button" class="mwt-vtab" id="mwt-tab-pdf" data-action="wsMobileView" data-view="pdf" aria-label="PDF view">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        <span>PDF</span>
      </button>
    </div>
    <button type="button" class="mwt-library" data-action="openLibraryModal" aria-label="Open library">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
    </button>
  </div>
  <aside class="sidebar" data-sidebar-screen="workspace"></aside>

  <!-- PDF Panel -->
  <section class="pdf-panel">
    <div class="pdf-bar">
      <!-- Title strip: book info, sits left outside the floating pill -->
      <div class="pdf-title-strip">
        <button class="pdf-tb-btn" title="Toggle contents" data-action="togglePdfOutline">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div class="pdf-book-icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg></div>
        <span class="pdf-book-name" id="ws-book-name">No book loaded</span>
        <span class="pdf-chapter" id="ws-book-author"></span>
        <button class="ws-close-book-btn" id="ws-close-book-btn" aria-label="Close currently open document" onclick="closeBook()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <!-- Floating glass pill toolbar (centered) -->
      <div class="pdf-bar-pill" id="ws-pdf-toolbar">

        <!-- Page navigation -->
        <button class="pdf-tb-btn" id="btn-prev-page" data-action="wsPrevPage" title="Previous page">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div class="pdf-tb-page-wrap">
          <span class="page-badge" id="ws-page-badge" title="Click to jump to page" data-action="wsJumpToPage" style="cursor:pointer;">1 / 1</span>
          <div class="pdf-page-progress"><div class="pdf-page-progress-fill" id="ws-page-progress"></div></div>
        </div>
        <button class="pdf-tb-btn" id="btn-next-page" data-action="wsNextPage" title="Next page">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>

        <div class="pdf-tb-sep"></div>

        <!-- Zoom controls -->
        <button class="pdf-tb-btn" id="btn-zoom-out" data-action="wsZoomOut" title="Zoom out">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
        </button>
        <span id="ws-zoom-badge" class="pdf-tb-zoom-label">100%</span>
        <button class="pdf-tb-btn" id="btn-zoom-in" data-action="wsZoomIn" title="Zoom in">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
        </button>

        <div class="pdf-tb-sep"></div>

        <!-- Library -->
        <button class="pdf-tb-btn" id="ws-open-lib-btn" data-action="openLibraryModal" title="Library">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        </button>

        <!-- Listen — accent pill button -->
        <button class="pdf-tb-listen ws-listen-btn" id="ws-listen-btn" aria-pressed="false"
          title="Listen to current page" onclick="wsListenPdf()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
          <span>Listen</span>
        </button>

      </div>
    </div>

    <div class="pdf-body">
      <nav class="pdf-outline-panel" id="ws-outline-panel" style="display:none">
        <!-- Book cover thumbnail -->
        <div id="ws-outline-cover" style="display:none;padding:12px 12px 0;">
          <img id="ws-outline-cover-img"
            style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:6px;display:block;border:1px solid var(--border-xs);"
            src="" alt=""
            onerror="this.parentElement.style.display='none'">
        </div>
        <div class="outline-head">Contents</div>
        <div id="ws-outline-items">
          <div style="padding:20px 16px;font-size:11px;color:var(--text-4);font-style:italic;line-height:1.6;">Open a book to see contents</div>
        </div>
      </nav>

      <div class="pdf-view" id="ws-pdf-view">

        <!-- Empty state — shown when no book loaded -->
        <div id="ws-default-content" style="position:absolute;inset:0;overflow-y:auto;background:var(--surface-2);z-index:2;padding:28px 24px 24px;">
          <!-- Header row -->
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-family:var(--font-head);font-size:17px;font-weight:700;color:var(--text-1);margin-bottom:4px;">Your Documents</div>
              <div style="font-size:12px;color:var(--text-3);">Continue where you left off</div>
            </div>
            <div class="ws-doc-header-actions">
              <button data-action="wsUploadPdf" class="ws-upload-pdf-btn" title="Upload a PDF">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>Upload PDF</span>
              </button>
              <button data-action="openLibraryModal" class="ws-browse-lib-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                <span>Browse Library</span>
              </button>
            </div>
          </div>
          <!-- Document cards grid -->
          <div id="ws-doc-cards-grid" class="ws-doc-cards-grid">
            <!-- populated by _renderWsDocCards() -->
          </div>
        </div>

        <!-- Loading state — skeleton while PDF fetches/renders -->
        <div id="ws-pdf-loading" style="display:none;flex-direction:column;height:100%;position:absolute;inset:0;background:var(--surface-2);overflow:hidden;">
          <!-- Book cover + title skeleton strip -->
          <div style="display:flex;align-items:center;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--border);">
            <div class="skeleton-line" style="width:36px;height:50px;border-radius:6px;flex-shrink:0;"></div>
            <div style="display:flex;flex-direction:column;gap:7px;flex:1;">
              <div class="skeleton-line" style="height:12px;width:55%;animation-delay:0.1s;"></div>
              <div class="skeleton-line" style="height:10px;width:35%;animation-delay:0.2s;"></div>
            </div>
          </div>
          <!-- Page skeleton rows -->
          <div style="flex:1;padding:20px;display:flex;flex-direction:column;gap:10px;overflow:hidden;">
            <div class="skeleton-line" style="height:14px;width:90%;animation-delay:0.05s;"></div>
            <div class="skeleton-line" style="height:12px;width:100%;animation-delay:0.1s;"></div>
            <div class="skeleton-line" style="height:12px;width:78%;animation-delay:0.15s;"></div>
            <div class="skeleton-line" style="height:12px;width:95%;animation-delay:0.2s;"></div>
            <div class="skeleton-line" style="height:12px;width:60%;animation-delay:0.25s;"></div>
            <div style="height:16px;"></div>
            <div class="skeleton-line" style="height:12px;width:88%;animation-delay:0.3s;"></div>
            <div class="skeleton-line" style="height:12px;width:100%;animation-delay:0.35s;"></div>
            <div class="skeleton-line" style="height:12px;width:72%;animation-delay:0.4s;"></div>
            <div style="height:16px;"></div>
            <div class="skeleton-line" style="height:12px;width:95%;animation-delay:0.45s;"></div>
            <div class="skeleton-line" style="height:12px;width:83%;animation-delay:0.5s;"></div>
            <div class="skeleton-line" style="height:12px;width:100%;animation-delay:0.55s;"></div>
            <div class="skeleton-line" style="height:12px;width:50%;animation-delay:0.6s;"></div>
          </div>
          <!-- Progress label at bottom -->
          <div style="padding:10px 20px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;">
            <div class="sp-spinner" style="flex-shrink:0;"></div>
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
              <div style="font-size:12px;color:var(--text-2);" id="ws-loading-text">Loading PDF…</div>
              <div style="font-size:11px;color:var(--text-4);" id="ws-loading-progress"></div>
            </div>
          </div>
        </div>

        <!-- PDF.js canvas scroll container -->
        <div id="ws-pdf-canvas-wrap" style="display:none;flex:1;min-height:0;width:100%;overflow-y:auto;padding:20px;box-sizing:border-box;background:var(--surface-2);flex-direction:column;align-items:center;gap:12px;">
        </div>

      </div>

      <!-- Sticky strip — 36px column on the right edge of the PDF panel -->
      <div id="ws-sticky-strip" class="sticky-strip-mount"></div>

    </div>

    <!-- Mobile PDF toolbar — shown on mobile when pdf-panel is active -->
    <div class="mobile-pdf-nav">
      <button class="mpn-btn" data-action="wsPrevPage" aria-label="Previous page">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <span class="mpn-page" id="mpn-page-label">1 / 1</span>
      <button class="mpn-btn" data-action="wsNextPage" aria-label="Next page">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
      <button class="mpn-btn" data-action="wsZoomOut" aria-label="Zoom out">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
      </button>
      <button class="mpn-btn" data-action="wsZoomIn" aria-label="Zoom in">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
      </button>
      <button class="mpn-listen ws-listen-btn" id="mpn-listen-btn" aria-pressed="false"
        title="Listen to current page" onclick="wsListenPdf()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
        <span>Listen</span>
      </button>
    </div>
  </section>
  <div class="ws-resizer" id="ws-resizer"></div>

  <!-- Chat Panel -->
  <section class="chat-panel">
    <!-- Top bar: doc info left · actions right -->
    <div class="chat-bar">
      <div class="chat-bar-doc">
        <div class="chat-bar-doc-icon" id="ws-context-tag">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="chat-bar-doc-text">
          <span class="chat-bar-title" id="ws-chat-title">Study Assistant</span>
          <span class="chat-bar-subtitle" id="ws-chat-subtitle"></span>
        </div>
      </div>
      <div class="chat-bar-actions">
        <span class="session-timer" id="ws-session-timer" title="Session duration"></span>
        <button class="icon-btn" aria-label="New chat" title="New chat" data-action="wsClearChat">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>
        </button>
      </div>
    </div>

    <!-- Panel tabs: Chat | Workspace | Notes | Canvas  +  page counter right -->
    <div class="ws-panel-tabs">
      <button class="ws-ptab ws-ptab-active" id="ws-tab-chat" onclick="wsShowPanel('chat')">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Chat
      </button>
      <button class="ws-ptab" id="ws-tab-workspace" onclick="wsShowPanel('workspace')">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Workspace
        <span class="ws-ptab-badge" id="ws-workspace-badge" style="display:none;"></span>
      </button>
      <button class="ws-ptab" id="ws-tab-notes" onclick="wsShowPanel('notes')">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Notes
      </button>
      <button class="ws-ptab" id="ws-tab-canvas" onclick="wsShowPanel('canvas')">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
        Canvas
      </button>
      <div class="ws-tabs-spacer"></div>
      <span class="ws-page-label" id="ws-chat-page-label"></span>
    </div>

    <!-- Chat content (shown by default) -->
    <div id="ws-chat-content" style="display:flex;">

    <div class="messages" id="ws-messages">
      <div id="ws-welcome-state" style="display:flex;flex-direction:column;height:100%;overflow-y:auto;padding:20px 16px;">
        <!-- Hero heading — visible only in no-doc (full-width) mode via CSS -->
        <div class="ws-nodoc-hero">
          <div class="ws-nodoc-hero-eyebrow">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="13" height="13">
              <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/>
              <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/>
              <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/>
              <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
            </svg>
            AI Study Assistant
          </div>
          <h1>Study smarter,<br>not <em>harder</em></h1>
          <p>Ask questions, explore your textbooks, and generate study tools — all in one place.</p>
        </div>
        <!-- Quick Actions header -->
        <div style="font-family:var(--font-head);font-size:14px;font-weight:700;color:var(--text-1);margin-bottom:14px;">Quick Actions</div>
        <!-- 2×3 action grid -->
        <div class="ws-quick-actions-grid">
          <div class="ws-quick-action-card" data-action="wsClearChat" role="button" tabindex="0" aria-label="New Chat">
            <div class="ws-qa-icon" style="background:rgba(139,124,248,0.12);color:#8b7cf8;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <span class="ws-qa-label">New Chat</span>
          </div>
          <div class="ws-quick-action-card" data-action="showScreen" data-screen="flash" role="button" tabindex="0" aria-label="Flashcards">
            <div class="ws-qa-icon" style="background:rgba(232,172,46,0.12);color:var(--gold);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
            </div>
            <span class="ws-qa-label">Flashcards</span>
          </div>
          <div class="ws-quick-action-card" data-action="showScreen" data-screen="exam" role="button" tabindex="0" aria-label="New Exam">
            <div class="ws-qa-icon" style="background:rgba(139,92,246,0.12);color:#a78bfa;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <span class="ws-qa-label">New Exam</span>
          </div>
          <div class="ws-quick-action-card" data-action="showScreen" data-screen="studyplan" role="button" tabindex="0" aria-label="Study Plan">
            <div class="ws-qa-icon" style="background:rgba(16,185,129,0.12);color:#34d399;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <span class="ws-qa-label">Study Plan</span>
          </div>
          <div class="ws-quick-action-card" data-action="showScreen" data-screen="research" role="button" tabindex="0" aria-label="Research">
            <div class="ws-qa-icon" style="background:rgba(59,130,246,0.12);color:#60a5fa;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 12h6m-3-3v6"/><path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/><path d="M21 7H3l1.5 11A2 2 0 0 0 6.48 20h11.04a2 2 0 0 0 1.98-2L21 7z"/></svg>
            </div>
            <span class="ws-qa-label">Research</span>
          </div>
          <div class="ws-quick-action-card" data-action="openLibraryModal" role="button" tabindex="0" aria-label="Browse Library">
            <div class="ws-qa-icon" style="background:rgba(232,172,46,0.08);color:var(--gold);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            </div>
            <span class="ws-qa-label">Browse Library</span>
          </div>
        </div>
        <!-- Session timer stat card -->
        <div class="ws-stat-card" id="ws-stat-timer-card" style="display:none;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span id="ws-stat-timer-text" style="font-size:12px;color:var(--text-2);">Studying today</span>
        </div>
        <!-- Suggested prompts shown when no document is loaded -->
        <div id="ws-no-book-prompts" style="margin-top:14px;">
          <div style="font-family:var(--font-head);font-size:12.5px;font-weight:600;color:var(--text-3);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;">Try asking</div>
          <div style="display:flex;flex-direction:column;gap:5px;">
            <button class="ws-prompt-chip" onclick="wsSetInput('Explain electrochemistry simply')">Explain electrochemistry simply</button>
            <button class="ws-prompt-chip" onclick="wsSetInput('Create a study plan')">Create a study plan</button>
            <button class="ws-prompt-chip" onclick="wsSetInput('Quiz me on this topic')">Quiz me on this topic</button>
            <button class="ws-prompt-chip" onclick="wsSetInput('What are the key concepts in this topic?')">What are the key concepts in this topic?</button>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-input-wrap">
      <input type="file" id="ws-attach-image" accept="image/*" style="display:none;" onchange="wsHandleAttach(this,'image')">
      <input type="file" id="ws-attach-pdf" accept="application/pdf" style="display:none;" onchange="wsHandleAttach(this,'pdf')">

      <!-- Card-style input container -->
      <div class="chat-input-card">

        <!-- Action chips row -->
        <div class="chat-action-chips" id="ws-smart-suggestions">
          <button class="chat-action-chip" onclick="wsSetInput('Explain electrochemistry simply')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg>
            Explain simply
          </button>
          <button class="chat-action-chip" onclick="wsSetInput('Create a study plan')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            Study plan
          </button>
          <button class="chat-action-chip" onclick="wsSetInput('Quiz me on this topic')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Quiz me
          </button>
          <button class="chat-action-chip" onclick="wsSetInput('What are the key concepts in this topic?')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h10M4 17h7"/></svg>
            Key concepts
          </button>
          <button class="chat-action-chip" onclick="wsSetInput('Summarize the French Revolution')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/></svg>
            Summarize
          </button>
          <button class="chat-action-chip" onclick="wsSetInput('Create a mind map for cell division')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/></svg>
            Mind map
          </button>
        </div>

        <!-- Attachment preview (shown below chips when an image/file is attached) -->
        <div id="ws-attach-preview" class="attach-preview" style="display:none;"></div>

        <!-- Textarea row -->
        <div class="chat-textarea-row">
          <textarea id="ws-chat-input" class="chat-input-field" placeholder="Ask anything…" rows="1" style="resize:none;max-height:120px;overflow-y:auto;font-family:var(--font-body);font-size:13px;color:var(--text-1);background:transparent;border:none;outline:none;flex:1;line-height:1.5;"></textarea>
          <button class="chat-send" id="ws-chat-send" data-action="wsChatSend"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
        </div>

        <!-- Footer row -->
        <div class="chat-input-footer">
          <div class="chat-footer-left">
            <!-- Attach button -->
            <div class="chat-plus-wrap">
              <button class="chat-footer-btn" id="ws-plus-btn" onclick="wsToggleAttachMenu(event)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                Attach
              </button>
              <div class="attach-menu home-rich-menu" id="ws-attach-menu">
                <div class="attach-menu-section-label">Attach</div>
                <div class="attach-menu-item" onclick="wsAttachTrigger('image')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span>Image</span>
                </div>
                <div class="attach-menu-item" onclick="wsAttachTrigger('pdf')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span>PDF</span>
                </div>
                <div class="attach-menu-item" onclick="wsPromptYouTube();wsToggleAttachMenu(event)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>
                  <span>YouTube</span>
                </div>
                <div class="attach-menu-divider"></div>
                <div class="attach-menu-section-label">AI Mode</div>
                <div class="attach-menu-item attach-menu-toggle" id="ws-toggle-websearch" onclick="wsToggleWebSearch()">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  <span>Web Search</span>
                  <div class="attach-menu-check" id="ws-websearch-check"></div>
                </div>
              </div>
            </div>
            <!-- Voice button -->
            <button class="chat-footer-btn mic-btn" id="ws-mic-btn" title="Voice input" aria-label="Voice input" onclick="wsToggleVoiceInput()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
              Voice
            </button>
          </div>
          <div class="chat-footer-right">
            <!-- Think dropdown -->
            <div class="chat-think-wrap" id="ws-think-wrap">
              <button class="chat-footer-btn chat-think-btn" id="ws-toggle-think" onclick="wsToggleThinkMenu(event)" title="Thinking mode">
                <span class="chat-think-dot"></span>
                <span id="ws-think-label">Think</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="think-menu" id="ws-think-menu">
                <div class="think-menu-item" id="ws-think-opt-think" onclick="wsToggleThinking('think')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg>
                  <span>Think</span>
                  <div class="attach-menu-check" id="ws-think-check"></div>
                </div>
                <div class="think-menu-item" id="ws-think-opt-deep" onclick="wsToggleThinking('deep')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  <span>Deep Think</span>
                  <div class="attach-menu-check" id="ws-deep-check"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    </div><!-- /ws-chat-content -->

    <!-- Workspace panel (hidden by default) — stores AI-generated outputs -->
    <div id="ws-workspace-panel" style="display:none;flex-direction:column;flex:1;overflow:hidden;">
      <div class="wsp-header">
        <div class="wsp-header-text">
          <div class="wsp-title">Saved Items</div>
          <div class="wsp-subtitle">AI-generated content from your chats</div>
        </div>
      </div>
      <div class="wsp-list" id="ws-workspace-list">
        <!-- Items rendered by _wsRenderWorkspacePanel() -->
      </div>
    </div>

    <!-- Notes panel (hidden by default) — Smart Notes Panel (Preact island) -->
    <div id="ws-notes-panel" style="display:none;flex-direction:column;">
      <!-- SmartNotesPanel Preact island is mounted here by WorkspaceScreen._initNotes() -->
    </div>

    <!-- Canvas panel (hidden by default) -->
    <div id="ws-canvas-panel" style="display:none;flex-direction:column;">
    </div>

  </section>
</div>
`;

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mountWorkspaceScreen() {
  const placeholder = document.querySelector('[data-workspace-screen]');
  if (!placeholder) {
    console.warn('[WorkspaceScreen] placeholder [data-workspace-screen] not found');
    return;
  }
  placeholder.outerHTML = WORKSPACE_HTML;

  // Wire up Workspace save/delete/save-handler to window so onclick handlers can call them
  window.wsSaveToWorkspace        = wsSaveToWorkspace;
  window.wsDeleteWorkspaceItem    = _wsDeleteWorkspaceItem;
  window._wsHandleSaveToWorkspace = _wsHandleSaveToWorkspace;

  // Refresh smart suggestions after mount
  setTimeout(refreshSmartSuggestions, 300);
  setTimeout(_initSessionTimer, 0);
  setTimeout(_initNotes, 0);
  setTimeout(_initEmptyStateObserver, 0);
  // Initialize workspace badge count
  setTimeout(() => _wsUpdateWorkspaceBadge(wsLoadWorkspaceItems().length), 0);
  // Mount Preact islands
  setTimeout(() => {
    mountSmartNotesPanel(document.getElementById('ws-notes-panel'));
    mountStickyStrip(document.getElementById('ws-sticky-strip'));
    mountCanvasPanel(document.getElementById('ws-canvas-panel'));
  }, 0);
}

// ── Smart suggestions ─────────────────────────────────────────────────────────

/**
 * Static action chips are defined in the HTML template.
 * This function is kept for backward compatibility but no longer
 * overwrites the chips row.
 */
export function refreshSmartSuggestions() {
  // Static chips are always visible in the card-style input; nothing to rebuild.
}

function _escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Panel tab toggle (Chat ↔ Notes ↔ Canvas) ─────────────────────────────────

/**
 * Toggle between the "Chat", "Notes", and "Canvas" panels in the right-hand section.
 * Called from the tab buttons' onclick handlers.
 */
export function wsShowPanel(tab) {
  const chatContent      = document.getElementById('ws-chat-content');
  const workspacePanel   = document.getElementById('ws-workspace-panel');
  const notesPanel       = document.getElementById('ws-notes-panel');
  const canvasPanel      = document.getElementById('ws-canvas-panel');
  const tabChat          = document.getElementById('ws-tab-chat');
  const tabWorkspace     = document.getElementById('ws-tab-workspace');
  const tabNotes         = document.getElementById('ws-tab-notes');
  const tabCanvas        = document.getElementById('ws-tab-canvas');
  if (!chatContent || !notesPanel || !canvasPanel) return;

  // Hide all panels and deactivate all tabs
  chatContent.style.display      = 'none';
  if (workspacePanel) workspacePanel.style.display = 'none';
  notesPanel.style.display       = 'none';
  canvasPanel.style.display      = 'none';
  tabChat?.classList.remove('ws-ptab-active');
  tabWorkspace?.classList.remove('ws-ptab-active');
  tabNotes?.classList.remove('ws-ptab-active');
  tabCanvas?.classList.remove('ws-ptab-active');

  if (tab === 'workspace') {
    if (workspacePanel) {
      workspacePanel.style.display = 'flex';
      _wsRenderWorkspacePanel();
    }
    tabWorkspace?.classList.add('ws-ptab-active');
  } else if (tab === 'notes') {
    notesPanel.style.display = 'flex';
    tabNotes?.classList.add('ws-ptab-active');
    // Focus the contenteditable notes area (SmartNotesPanel)
    setTimeout(() => {
      const editable = notesPanel.querySelector('.snp-notes-area');
      editable?.focus();
    }, 0);
  } else if (tab === 'canvas') {
    canvasPanel.style.display = 'flex';
    tabCanvas?.classList.add('ws-ptab-active');
  } else {
    chatContent.style.display = 'flex';
    tabChat?.classList.add('ws-ptab-active');
    // Remove animation class once it completes so it doesn't replay on re-show
    const onEnd = () => {
      chatContent.classList.remove('ws-panel-fade-in');
      chatContent.removeEventListener('animationend', onEnd);
    };
    chatContent.addEventListener('animationend', onEnd);
  }
}

// ── Workspace panel — Save / Load / Render ────────────────────────────────────

const _WS_SAVED_KEY = 'chunks-workspace-saved-items';

const _WS_TYPE_META = {
  flashcards: { label: 'Flashcards', color: 'var(--violet)', bg: 'var(--violet-muted)', icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>` },
  summary:    { label: 'Summary',    color: '#34d399',       bg: 'rgba(52,211,153,0.12)', icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/></svg>` },
  notes:      { label: 'Notes',      color: '#60a5fa',       bg: 'rgba(96,165,250,0.12)', icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>` },
};

/**
 * Persist a new item to the Workspace saved-items list.
 * @param {'flashcards'|'summary'|'notes'} type
 * @param {{ title: string, deckId?: string, topic?: string, count?: number, content?: string }} data
 */
export function wsSaveToWorkspace(type, data) {
  let items = [];
  try { items = JSON.parse(localStorage.getItem(_WS_SAVED_KEY) || '[]'); } catch (e) {
    console.warn('[Workspace] Failed to parse saved items:', e);
  }
  const id = `wsitem-${Date.now()}`;
  items.unshift({ id, type, data, savedAt: new Date().toISOString() });
  // Cap at 50 items
  if (items.length > 50) items = items.slice(0, 50);
  try { localStorage.setItem(_WS_SAVED_KEY, JSON.stringify(items)); } catch (e) {
    console.warn('[Workspace] Failed to save item (storage may be full):', e);
  }
  _wsUpdateWorkspaceBadge(items.length);
  return id;
}

export function wsLoadWorkspaceItems() {
  try { return JSON.parse(localStorage.getItem(_WS_SAVED_KEY) || '[]'); } catch (e) {
    console.warn('[Workspace] Failed to load saved items:', e);
    return [];
  }
}

/**
 * Named handler for the "Save to Workspace" button on flashcard result cards.
 * Reads the deck data from the button's data-* attributes to avoid embedding
 * user content inside onclick attribute strings.
 */
export function _wsHandleSaveToWorkspace(btn) {
  const deckId = btn.dataset.deckId || '';
  const topic  = btn.dataset.topic  || '';
  const count  = Number(btn.dataset.count) || 0;
  wsSaveToWorkspace('flashcards', { title: topic, deckId, topic, count });
  btn.textContent = '✓ Saved';
  btn.disabled = true;
}

function _wsUpdateWorkspaceBadge(count) {
  const badge = document.getElementById('ws-workspace-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function _wsItemDateLabel(isoStr) {
  if (!isoStr) return '';
  const parsed = new Date(isoStr);
  if (isNaN(parsed.getTime())) return '';
  const diff = Date.now() - parsed.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function _wsReopenItemInChat(item) {
  // Smooth fade-out of workspace panel, then fade-in of chat
  const wsp = document.getElementById('ws-workspace-panel');
  if (wsp) {
    wsp.classList.add('ws-panel-fade-out');
    setTimeout(() => {
      wsShowPanel('chat');
      const chatContent = document.getElementById('ws-chat-content');
      if (chatContent) chatContent.classList.add('ws-panel-fade-in');
      _dispatchReopenItem(item);
    }, 150);
  } else {
    wsShowPanel('chat');
    _dispatchReopenItem(item);
  }
}

function _dispatchReopenItem(item) {
  if (item.type === 'flashcards' && item.data.deckId) {
    if (typeof window.wsLoadDeckInChat === 'function') {
      window.wsLoadDeckInChat(item.data.deckId, item.data.topic || item.data.title);
    }
  } else if (item.data.content && typeof window.wsSetInput === 'function') {
    window.wsSetInput(item.data.content.slice(0, 200));
  }
}

function _wsDeleteWorkspaceItem(id) {
  let items = wsLoadWorkspaceItems().filter(i => i.id !== id);
  try { localStorage.setItem(_WS_SAVED_KEY, JSON.stringify(items)); } catch (e) {
    console.warn('[Workspace] Failed to delete item:', e);
  }
  _wsUpdateWorkspaceBadge(items.length);
  _wsRenderWorkspacePanel();
}

function _wsRenderWorkspacePanel() {
  const list = document.getElementById('ws-workspace-list');
  if (!list) return;
  const items = wsLoadWorkspaceItems();

  if (items.length === 0) {
    list.innerHTML = `
      <div class="wsp-empty">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" stroke-width="1.2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        <div class="wsp-empty-title">Nothing saved yet</div>
        <div class="wsp-empty-sub">Use the <strong>Save to Workspace</strong> button on any AI response to store it here.</div>
      </div>`;
    return;
  }

  list.innerHTML = '';
  items.forEach(item => {
    const meta           = _WS_TYPE_META[item.type] || _WS_TYPE_META.notes;
    const title          = _escHtml(item.data.title || item.data.topic || 'Untitled');
    const dateLabel      = _wsItemDateLabel(item.savedAt);
    const flashcardCount = item.type === 'flashcards' && item.data.count
      ? `<span class="wsp-item-extra">${item.data.count} cards</span>` : '';

    const card = document.createElement('div');
    card.className = 'wsp-item';
    card.innerHTML = `
      <div class="wsp-item-icon" style="background:${meta.bg};color:${meta.color};">${meta.icon}</div>
      <div class="wsp-item-body">
        <div class="wsp-item-title" title="${title}">${title}</div>
        <div class="wsp-item-meta">
          <span class="wsp-item-type" style="color:${meta.color};">${meta.label}</span>
          ${flashcardCount}
          ${dateLabel ? `<span class="wsp-item-date">${_escHtml(dateLabel)}</span>` : ''}
        </div>
      </div>
      <div class="wsp-item-actions">
        <button class="wsp-item-open" title="Open in Chat">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m5 12 14 0"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
        <button class="wsp-item-delete" title="Remove">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    card.querySelector('.wsp-item-open').addEventListener('click', (e) => {
      e.stopPropagation();
      _wsReopenItemInChat(item);
    });
    card.querySelector('.wsp-item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      _wsDeleteWorkspaceItem(item.id);
    });
    card.addEventListener('click', () => _wsReopenItemInChat(item));
    list.appendChild(card);
  });

  _wsUpdateWorkspaceBadge(items.length);
}

// ── Empty state observer & document cards ─────────────────────────────────────

// Chip HTML sets for book vs. no-book state
const _CHIPS_NO_BOOK = `
  <button class="chat-action-chip" onclick="wsSetInput('Explain electrochemistry simply')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg>Explain simply</button>
  <button class="chat-action-chip" onclick="wsSetInput('Create a study plan')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>Study plan</button>
  <button class="chat-action-chip" onclick="wsSetInput('Quiz me on this topic')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Quiz me</button>
  <button class="chat-action-chip" onclick="wsSetInput('What are the key concepts in this topic?')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h10M4 17h7"/></svg>Key concepts</button>
  <button class="chat-action-chip" onclick="wsSetInput('Summarize the French Revolution')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/></svg>Summarize</button>
  <button class="chat-action-chip" onclick="wsSetInput('Create a mind map for cell division')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/></svg>Mind map</button>`;

const _CHIPS_WITH_BOOK = `
  <button class="chat-action-chip" onclick="wsSetInput('Summarize the current page')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/></svg>Summarize</button>
  <button class="chat-action-chip" onclick="wsGenerateFlashcardsInChat()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2l4.5 7.5H7.5z"/><path d="M12 22l-4.5-7.5h9z"/></svg>Flashcards</button>
  <button class="chat-action-chip" onclick="wsSetInput('Quiz me on this chapter')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2l4.5 7.5H7.5z"/><path d="M12 22l-4.5-7.5h9z"/></svg>Quiz me</button>
  <button class="chat-action-chip" onclick="wsSetInput('Explain this equation in detail')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h10M4 17h7"/></svg>Equation</button>
  <button class="chat-action-chip" onclick="wsSetInput('What are the key points of this chapter?')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Key points</button>
  <button class="chat-action-chip" onclick="wsSetInput('Create a mind map for this chapter')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/></svg>Mind map</button>`;

/**
 * Update the chat panel UI to reflect whether a book is currently loaded.
 * - No book: general study assistant mode (general prompts, updated title & placeholder)
 * - Book loaded: book-aware mode (chapter-specific chips & placeholder)
 */
function _updateChatPanelForBookState(hasBook) {
  const inp         = document.getElementById('ws-chat-input');
  const chips       = document.getElementById('ws-smart-suggestions');
  const noBookSect  = document.getElementById('ws-no-book-prompts');
  const titleEl     = document.getElementById('ws-chat-title');

  if (inp) inp.placeholder = hasBook ? 'Ask anything about this chapter\u2026' : 'Ask anything\u2026';
  if (chips) chips.innerHTML = hasBook ? _CHIPS_WITH_BOOK : _CHIPS_NO_BOOK;
  if (noBookSect) noBookSect.style.display = hasBook ? 'none' : '';
  if (titleEl && !hasBook) titleEl.textContent = 'Study Assistant';
}

/**
 * Watch ws-default-content visibility to toggle:
 *  - chat panel state (general assistant vs. book-aware) when no book is loaded
 *  - document cards rendered when the empty state becomes visible
 */
function _initEmptyStateObserver() {
  const defaultContent = document.getElementById('ws-default-content');
  if (!defaultContent) return;

  function _onVisibilityChange() {
    const noBook = defaultContent.style.display !== 'none';
    _updateChatPanelForBookState(!noBook);
    if (noBook) _renderWsDocCards();
  }

  // Initial state
  _onVisibilityChange();

  // Watch for books.js toggling the display property
  const observer = new MutationObserver(_onVisibilityChange);
  observer.observe(defaultContent, { attributes: true, attributeFilter: ['style'] });
}

const _SUBJECT_COLORS = ['#e8ac2e','#8b7cf8','#60a5fa','#34d399','#f87171','#fb923c'];

function _timeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Render the document grid in ws-default-content */
function _renderWsDocCards() {
  const grid = document.getElementById('ws-doc-cards-grid');
  if (!grid) return;

  // Get workspace items from recent list
  const allItems = Array.isArray(window._getRecentItems?.()) ? window._getRecentItems() : [];
  const wsItems  = allItems.filter(r => r.source === 'workspace' && r.bookId);

  if (wsItems.length === 0) {
    grid.innerHTML = `
      <div class="ws-docs-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" stroke-width="1.2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-top:10px;">No documents yet</div>
        <div style="font-size:12px;color:var(--text-4);margin-top:4px;max-width:200px;text-align:center;line-height:1.6;">Browse the Library to add your first textbook</div>
        <button data-action="openLibraryModal" style="margin-top:14px;padding:8px 20px;border-radius:var(--r-pill);background:var(--gold);border:none;color:#090900;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body);">Browse Library</button>
      </div>`;
    return;
  }

  // Deduplicate by bookId (keep most recent per book)
  const seen = new Set();
  const unique = wsItems.filter(item => {
    if (seen.has(item.bookId)) return false;
    seen.add(item.bookId);
    return true;
  }).slice(0, 8); // max 8 cards

  grid.innerHTML = '';
  unique.forEach((item, idx) => {
    const meta       = window.wsBookMeta?.[item.bookId];
    const title      = (typeof meta === 'object' ? meta?.name : meta?.split?.('/')?.[0]) || item.label || item.bookId;
    const accent     = _SUBJECT_COLORS[idx % _SUBJECT_COLORS.length];
    const safeTitle  = _escHtml(title);
    const timeLabel  = _timeAgo(item.updatedAt);

    const card = document.createElement('div');
    card.className = 'ws-doc-card';
    card.style.cssText = `--ws-card-accent:${accent};`;
    card.innerHTML = `
      <div class="ws-doc-card-inner">
        <div class="ws-doc-card-title" title="${safeTitle}">${safeTitle}</div>
        ${timeLabel ? `<div class="ws-doc-card-meta">Last opened: ${_escHtml(timeLabel)}</div>` : ''}
        <button class="ws-doc-card-open">Open</button>
      </div>`;

    card.addEventListener('click', () => {
      if (typeof selectBook === 'function') selectBook(item.bookId);
      else window._clickRecent?.(item);
    });
    grid.appendChild(card);
  });
}

// ── Session timer ─────────────────────────────────────────────────────────────

const _TIMER_KEY = 'chunks-ai-session-start';

function _initSessionTimer() {
  const timerEl    = document.getElementById('ws-session-timer');
  const statCard   = document.getElementById('ws-stat-timer-card');
  const statText   = document.getElementById('ws-stat-timer-text');

  // Persist start time across within-tab navigation (sessionStorage resets per browser session)
  let startTime = parseInt(sessionStorage.getItem(_TIMER_KEY) || '0', 10);
  if (!startTime) {
    startTime = Date.now();
    sessionStorage.setItem(_TIMER_KEY, String(startTime));
  }

  const _update = () => {
    // Stop updating if timer element left the DOM
    if (timerEl && !document.contains(timerEl)) { clearInterval(_timerId); return; }
    const mins = Math.floor((Date.now() - startTime) / 60000);
    let label = '';
    if (mins >= 1 && mins < 60) {
      label = `studying for ${mins}min`;
    } else if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      label = `studying for ${h}h${m > 0 ? ` ${m}m` : ''}`;
    }
    if (timerEl) timerEl.textContent = label;

    // Also update the Quick Actions stat card
    if (statCard && statText) {
      if (mins >= 1) {
        statText.textContent = `Studying for ${mins < 60 ? mins + 'min' : Math.floor(mins/60) + 'h' + (mins%60 > 0 ? ' ' + mins%60 + 'm' : '')} today`;
        statCard.style.display = 'flex';
      }
    }
  };

  _update();
  const _timerId = setInterval(_update, 60000);
}

// ── Notes persistence ─────────────────────────────────────────────────────────
// Notes are now managed by the SmartNotesPanel Preact island (SmartNotesPanel.jsx).
// This function is kept as a no-op for backward compatibility.

function _initNotes() {
  // SmartNotesPanel Preact island is mounted in mountWorkspaceScreen()
  // and handles all notes state / localStorage persistence itself.
}

// ── Mobile view toggle (Chat ↔ PDF) ──────────────────────────────────────────

export function wsMobileView(view) {
  const ws       = document.getElementById('screen-workspace');
  const pdfPanel = document.querySelector('#screen-workspace .pdf-panel');
  const tabChat  = document.getElementById('mwt-tab-chat');
  const tabPdf   = document.getElementById('mwt-tab-pdf');
  if (!ws || !pdfPanel) return;

  if (view === 'pdf') {
    ws.classList.add('ws-pdf-mode');
    pdfPanel.classList.add('mobile-visible');
    tabChat?.classList.remove('active');
    tabPdf?.classList.add('active');
    // Re-fit PDF to the now-visible container width (layout settles after rAF)
    requestAnimationFrame(() => wsFitWidth());
  } else {
    ws.classList.remove('ws-pdf-mode');
    pdfPanel.classList.remove('mobile-visible');
    tabChat?.classList.add('active');
    tabPdf?.classList.remove('active');
  }
}

// ── Drag-to-resize splitter ───────────────────────────────────────────────────

function _initResizer() {
  const resizer  = document.getElementById('ws-resizer');
  const pdfPanel = document.querySelector('.pdf-panel');
  const wsScreen = document.getElementById('screen-workspace');
  if (!resizer || !pdfPanel) return;

  let dragging = false, startX = 0, startW = 0;

  resizer.addEventListener('mousedown', e => {
    dragging = true;
    startX = e.clientX;
    startW = pdfPanel.getBoundingClientRect().width;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const container = wsScreen.getBoundingClientRect();
    const sidebar   = wsScreen.querySelector('.sidebar')?.getBoundingClientRect();
    const sideW     = sidebar ? sidebar.width : 244;
    const available = container.width - sideW - 4; // 4 = resizer width
    const delta     = e.clientX - startX;
    const newW      = Math.min(Math.max(startW + delta, available * 0.25), available * 0.75);
    pdfPanel.style.flex = `0 0 ${newW}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

// ── Auto-mount (synchronous — same pattern as HomeScreen.js) ──────────────────
// Runs at module eval time so #screen-workspace exists before navigation.js
// _restoreScreen() IIFE looks for it.
mountWorkspaceScreen();
_initResizer();

// Window bridge for wsMobileView is in globals.js.

console.log('[WorkspaceScreen] module loaded ✦');
