
// @ts-nocheck
/**
 * src/screens/WorkspaceScreen.js — Task 26
 *
 * Owns:
 *   • #screen-workspace HTML injection (replaces data-workspace-screen placeholder)
 *   • Drag-to-resize splitter (resizer IIFE)
 *   • wsMobileView() — mobile chat/PDF toggle
 *
 * Bridges set on window.*:
 *   wsMobileView
 *
 * All other workspace logic (selectBook, wsChatSend, wsPrevPage, wsNextPage,
 * wsZoomIn, wsZoomOut, wsJumpToPage, togglePdfOutline, wsHandleAttach, etc.)
 * is already owned by src/state/workspace/ (Task 16).
 */

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
      <nav class="pdf-outline-panel" id="ws-outline-panel">
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
        <div id="ws-default-content" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:40px;background:var(--surface-2);z-index:2;">
          <div style="width:56px;height:56px;border-radius:16px;background:var(--gold-muted);border:1px solid var(--gold-border);display:flex;align-items:center;justify-content:center;">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
          </div>
          <div>
            <div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--text-1);margin-bottom:6px;">No book loaded</div>
            <div style="font-size:13px;max-width:220px;line-height:1.65;color:var(--text-3);">Open the Library to pick a textbook and it'll appear here.</div>
          </div>
          <button data-action="openLibraryModal" style="padding:9px 22px;border-radius:var(--r-pill);background:var(--gold);border:none;color:#090900;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-body);">Browse Library</button>
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

    </div>
  </section>
  <div class="ws-resizer" id="ws-resizer"></div>

  <!-- Chat Panel -->
  <section class="chat-panel">
    <div class="chat-bar">
      <span class="context-tag" id="ws-context-tag">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        No book
      </span>
      <span class="chat-bar-title" id="ws-chat-title">Select a book to start studying</span>
      <button class="icon-btn" aria-label="New chat" title="New chat" data-action="wsClearChat"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
    </div>

    <div class="messages" id="ws-messages">
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;text-align:center;padding:40px;">
        <div style="width:56px;height:56px;border-radius:16px;background:var(--violet-muted);border:1px solid var(--violet-border);display:flex;align-items:center;justify-content:center;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="1.5" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div>
          <div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--text-1);margin-bottom:6px;">Ask anything</div>
          <div style="font-size:13px;color:var(--text-3);line-height:1.65;max-width:220px;">Select a book and type a question to start studying with AI.</div>
        </div>
      </div>
    </div>

    <div class="chat-input-wrap">
      <div id="ws-attach-preview" class="attach-preview" style="display:none;"></div>
      <div class="chat-input-inner">
        <div class="chat-plus-wrap">
          <button class="chat-plus" id="ws-plus-btn" onclick="wsToggleAttachMenu(event)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
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
            <div class="attach-menu-item attach-menu-toggle" id="ws-toggle-think" onclick="wsToggleThinking('think')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg>
              <span>Think</span>
              <div class="attach-menu-check" id="ws-think-check"></div>
            </div>
            <div class="attach-menu-item attach-menu-toggle" id="ws-toggle-deep" onclick="wsToggleThinking('deep')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span>Deep Think</span>
              <div class="attach-menu-check" id="ws-deep-check"></div>
            </div>
          </div>
        </div>
        <input type="file" id="ws-attach-image" accept="image/*" style="display:none;" onchange="wsHandleAttach(this,'image')">
        <input type="file" id="ws-attach-pdf" accept="application/pdf" style="display:none;" onchange="wsHandleAttach(this,'pdf')">
        <textarea id="ws-chat-input" class="chat-input-field" placeholder="Ask a follow-up about Chapter 3…" rows="1" style="resize:none;max-height:120px;overflow-y:auto;font-family:var(--font-body);font-size:13px;color:var(--text-1);background:transparent;border:none;outline:none;flex:1;line-height:1.5;"></textarea>
        <button class="chat-send mic-btn" id="ws-mic-btn" title="Voice input" aria-label="Voice input" onclick="wsToggleVoiceInput()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg></button>
        <button class="chat-send" id="ws-chat-send" data-action="wsChatSend"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
      </div>
      <div class="input-hints">
        <div class="input-hints" id="ws-smart-suggestions">
          <button class="hint-tag" onclick="wsSetInput('Summarize the current page')">Summarize page</button>
          <button class="hint-tag" onclick="wsSetInput('Generate flashcards on this topic')">Generate flashcards</button>
          <button class="hint-tag" onclick="wsSetInput('Explain this equation in detail')">Explain this equation</button>
        </div>
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
  // Refresh smart suggestions after mount
  setTimeout(refreshSmartSuggestions, 300);
}

// ── Smart suggestions ─────────────────────────────────────────────────────────

/**
 * Rebuild the #ws-smart-suggestions bar with dynamic context-aware hints.
 * Falls back to static hints if CommandEngine isn't ready yet.
 */
export function refreshSmartSuggestions() {
  const bar = document.getElementById('ws-smart-suggestions');
  if (!bar) return;
  try {
    const engine = window.CommandEngine;
    if (!engine) return;
    engine.syncContextFromWorkspace?.();
    const suggestions = engine.getSmartSuggestions?.({ screen: 'workspace' });
    if (!suggestions || !suggestions.length) return;
    bar.innerHTML = suggestions.map(s =>
      `<button class="hint-tag" onclick="${s.action}">${s.icon ? s.icon + ' ' : ''}${_escHtml(s.text)}</button>`
    ).join('');
  } catch (_) {}
}

function _escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
