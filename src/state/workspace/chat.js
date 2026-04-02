
// @ts-nocheck
/**
 * src/state/workspace/chat.js — Chat helpers, messages, sendm
 */

import { ws } from './state.js';
import { wsGoToPage } from './pdf.js';
import { API_BASE, _getAuthHeader } from '../../lib/api.js';
import { guestGate, recordUsage, renderUsageBar, isGuest, showLoginWall } from '../../lib/guestLimits.js';
import { showToast }   from '../../components/Toast.js';
import { $el, setHtml, addClass, removeClass, toggleClass } from '../domHelpers.js';
import { handleCommand, syncContextFromWorkspace, updateContext } from '../commandEngine.js';
import { createThinkingAccordion, parseThinkingSteps, inferThinkingTags } from '../../components/ThinkingAccordion.js';
import { typewriteResponse, extractThinkBlock } from '../../utils/typewriter.js';

// ── Send / Stop button icons ──────────────────────────────────────────────
const _SEND_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
const _STOP_SVG = `<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" rx="2" ry="2" fill="currentColor"/></svg>`;

// ── AbortController for active requests ──────────────────────────────────
let _wsAbortController = null;

/** Swap the workspace send button between send ↔ stop states. */
function _wsSetGenerating(on) {
  const btn = $el('ws-chat-send');
  if (!btn) return;
  if (on) {
    btn.innerHTML = _STOP_SVG;
    btn.classList.add('chat-send--stop');
    btn.disabled = false;
  } else {
    btn.innerHTML = _SEND_SVG;
    btn.classList.remove('chat-send--stop');
    btn.disabled = false;
  }
}

/** Abort the active workspace AI request and restore the send button. */
export function wsStopGeneration() {
  if (_wsAbortController) {
    _wsAbortController.abort();
    _wsAbortController = null;
  }
}

// ── Toast (delegated to Toast.js — Task 20) ───────────────────────────────

export function wsShowToast(icon, text, color) {
  showToast(icon, text, color);
}

// ── Chat helpers ──────────────────────────────────────────────────────────

export function wsSetInput(text) {
  const inp = $el('ws-chat-input');
  if (!inp) return;
  inp.value = text; inp.focus(); wsAutoResize(inp);
}
export function wsAutoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
export function wsScrollBottom() {
  const msgs = $el('ws-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}
export function wsClearChat() {
  ws.chatHistory = [];
  const msgs = $el('ws-messages');
  if (msgs) setHtml(msgs, `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-4);text-align:center;padding:24px;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <div style="font-size:12px;color:var(--text-4);">Ask a question to start the conversation</div>
    </div>`);
  if (ws.bookId && typeof _saveWsSession === 'function') _saveWsSession(ws.bookId, []);
  wsShowToast('🗑', 'Chat cleared', 'var(--border-md)');
}

export function wsAppendUser(text, selectedText) {
  const msgs = $el('ws-messages');
  // Remove the welcome state when the first real message is appended
  const welcome = document.getElementById('ws-welcome-state');
  if (welcome) welcome.remove();
  const d = document.createElement('div');
  d.className = 'msg msg-user';
  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const quoteHtml = selectedText
    ? `<div style="margin-bottom:7px;padding:7px 10px;border-left:2px solid var(--gold);background:var(--gold-muted);border-radius:0 6px 6px 0;font-size:11px;color:var(--text-3);line-height:1.5;font-style:italic;">"${selectedText.slice(0,160).replace(/&/g,'&amp;').replace(/</g,'&lt;')}${selectedText.length>160?'…':''}"</div>`
    : '';
  d.innerHTML = `<div class="bubble-user">${quoteHtml}${escaped}</div>`;
  msgs.appendChild(d); wsScrollBottom();
}

export function _wsAvatarSvg() {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="13" height="13">
    <ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="#c8a84b" stroke-width="7" opacity="0.95"/>
    <ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="#a855f7" stroke-width="7" transform="rotate(60 50 50)" opacity="0.85"/>
    <ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="#c8a84b" stroke-width="7" transform="rotate(120 50 50)" opacity="0.75"/>
    <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
  </svg>`;
}

/** Handle for the currently-mounted ThinkingAccordion (if any). */
let _wsThinkingHandle = null;
let _wsThinkingWrap   = null;
let _wsThinkStart     = 0;

export function wsAppendThinking(hasImage = false) {
  const msgs = $el('ws-messages');
  // Remove any leftover accordion from a prior request
  wsRemoveThinking();

  _wsThinkStart = Date.now();
  _wsThinkingWrap = document.createElement('div');
  _wsThinkingWrap.className = 'msg msg-ai';
  _wsThinkingWrap.id = 'ws-thinking-msg';

  if (ws.thinking === 'off') {
    if (hasImage) {
      // Animated "Analyzing image..." text indicator for image messages
      const span = document.createElement('span');
      span.className = 'ws-analyzing-text';
      span.textContent = 'Analyzing image.';
      let dots = 1;
      const timer = setInterval(() => {
        dots = (dots % 3) + 1;
        span.textContent = 'Analyzing image' + '.'.repeat(dots);
      }, 500);
      _wsThinkingWrap._labelTimer = timer;
      _wsThinkingWrap.innerHTML = '';
      const row = document.createElement('div');
      row.className = 'ai-row';
      const body = document.createElement('div');
      body.className = 'ai-body';
      body.style.padding = '4px 0';
      body.appendChild(span);
      row.appendChild(body);
      _wsThinkingWrap.appendChild(row);
    } else {
      // Simple blinking dot indicator for text-only messages
      _wsThinkingWrap.innerHTML = `<div class="ai-row"><div class="ai-body" style="padding:4px 0;"><span class="ws-typing-dot"></span></div></div>`;
    }
    msgs.appendChild(_wsThinkingWrap);
  } else {
    const container = document.createElement('div');
    container.style.cssText = 'width:100%;';
    _wsThinkingWrap.appendChild(container);
    msgs.appendChild(_wsThinkingWrap);

    // Mount ThinkingAccordion in streaming mode (empty steps, live timer)
    _wsThinkingHandle = createThinkingAccordion(container, {
      steps: [],
      elapsed: 0,
      tags: [],
      isStreaming: true,
    });
  }

  wsScrollBottom();
}

export function wsRemoveThinking() {
  if (_wsThinkingHandle) {
    _wsThinkingHandle.unmount();
    _wsThinkingHandle = null;
  }
  if (_wsThinkingWrap) {
    if (_wsThinkingWrap._labelTimer) clearInterval(_wsThinkingWrap._labelTimer);
    _wsThinkingWrap.remove();
    _wsThinkingWrap = null;
  }
  // Fallback: remove by id in case something else created it
  const el = $el('ws-thinking-msg');
  if (el) { if (el._labelTimer) clearInterval(el._labelTimer); el.remove(); }
}

/**
 * Finalize the ThinkingAccordion with actual thinking content, then detach
 * the handle so it stays in the DOM as a collapsed summary.
 */
function _wsFinalizeThinking(thinkingContent) {
  if (!_wsThinkingWrap) return;
  const elapsed = Math.round((Date.now() - _wsThinkStart) / 1000);

  // Unmount the streaming accordion
  if (_wsThinkingHandle) {
    _wsThinkingHandle.unmount();
    _wsThinkingHandle = null;
  }

  // Build steps from real thinking content
  const steps = thinkingContent ? parseThinkingSteps(thinkingContent) : [];

  // If the model produced no thinking content, remove the placeholder silently
  if (steps.length === 0) {
    _wsThinkingWrap.remove();
    _wsThinkingWrap = null;
    return;
  }

  const tags = inferThinkingTags(steps, thinkingContent || '');

  // Create a fresh container and mount the accordion with real steps
  const container = document.createElement('div');
  container.style.cssText = 'width:100%;';
  _wsThinkingWrap.innerHTML = '';
  _wsThinkingWrap.appendChild(container);
  _wsThinkingWrap.removeAttribute('id'); // no longer the "thinking" placeholder

  createThinkingAccordion(container, { steps, elapsed, tags });
  _wsThinkingWrap = null;
  wsScrollBottom();
}

// ── Flashcard result card HTML ─────────────────────────────────────────────────

/**
 * Returns the inner HTML for a persisted flashcard result card.
 * Used by _wsRenderMessageFromBlocks when restoring a session that included
 * a "Make Flashcard" or "Generate Flashcards" action.
 */
export function _wsFlashcardResultHtml(deckId, topic, count) {
  const safeId    = String(deckId).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  const safeTopic = (topic || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = Number(count) || 0;
  return `<div class="ws-gen-result-card" style="margin-top:10px;padding:12px 14px;background:var(--surface-2);border:1px solid var(--violet-border);border-radius:var(--r-md);">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="padding:6px;background:var(--violet-muted);border-radius:var(--r-sm);flex-shrink:0;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text-1);">Flashcard Set</div>
        <div style="font-size:11px;color:var(--text-4);">${n} card${n !== 1 ? 's' : ''} &middot; ${safeTopic}</div>
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <button onclick="wsOpenFlashcardDeck('${safeId}', '${safeTopic}')"
        style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:7px 12px;background:var(--violet);border:none;border-radius:var(--r-sm);color:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--font-body);transition:opacity 0.15s;"
        onmouseenter="this.style.opacity='0.85'" onmouseleave="this.style.opacity='1'">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m5 12 14 0"/><path d="m12 5 7 7-7 7"/></svg>
        Open Flashcards
      </button>
      <button onclick="wsStartFlashcardPractice('${safeId}', '${safeTopic}')"
        style="display:flex;align-items:center;gap:5px;padding:7px 12px;background:var(--surface-3);border:1px solid var(--border-sm);border-radius:var(--r-sm);color:var(--text-2);font-size:11px;cursor:pointer;font-family:var(--font-body);transition:background 0.15s;"
        onmouseenter="this.style.background='var(--surface-hover)'" onmouseleave="this.style.background='var(--surface-3)'">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Practice
      </button>
    </div>
  </div>`;
}

// ── Structured message blocks ─────────────────────────────────────────────────

/**
 * Build a structured blocks array from AI response data.
 * The blocks array is stored alongside `content` in chatHistory so that
 * the full UI (text, sources, action buttons) can be re-created on reload
 * without relying on stored HTML.
 *
 * @param {string}   answer      - Raw AI answer text
 * @param {Array}    sources     - Source objects [{ page, text }, ...]
 * @param {string}   question    - The user question (needed for button handlers)
 * @param {string}   searchMode  - 'hybrid' | 'keyword' | null
 * @returns {Array}  Structured blocks
 */
export function _wsBuildBlocks(answer, sources, question, searchMode) {
  const blocks = [
    { type: 'text', value: answer },
  ];
  if (sources && sources.length > 0) {
    blocks.push({
      type:  'sources',
      items: sources.map(s => ({ page: s.page, text: (s.text || '').trim().slice(0, 55) })),
    });
  }
  blocks.push({
    type:              'actions',
    question:          question          || '',
    searchMode:        searchMode        || null,
    primarySourcePage: sources && sources.length > 0 ? sources[0].page : null,
  });
  return blocks;
}

/**
 * Render a complete AI message element from structured blocks.
 * Produces identical UI to the first-render path and is used when restoring
 * messages from history (reload / cross-device sync).
 *
 * @param {string} msgId     - Unique DOM id for the message element
 * @param {Array}  blocks    - Structured blocks from _wsBuildBlocks
 * @param {string} [bookName] - Book name shown in source citations
 * @returns {HTMLDivElement}
 */
export function _wsRenderMessageFromBlocks(msgId, blocks, bookName) {
  const d = document.createElement('div');
  d.className = 'msg msg-ai';
  d.id = msgId;

  let textHtml    = '';
  let sourcesHtml = '';
  let actionsBlock  = null;
  let flashcardBlock = null;

  for (const block of blocks) {
    if (block.type === 'text') {
      const rendered = typeof wsRender === 'function'
        ? wsRender(block.value)
        : (block.value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      textHtml = `<div class="ai-text">${rendered}</div>`;

    } else if (block.type === 'sources' && block.items?.length) {
      const bn = (bookName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const items = block.items.map(s => {
        const preview = (s.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
        return `
          <div class="source-item" onclick="wsGoToPage(${s.page})" title="Jump to page ${s.page}" style="cursor:pointer;">
            <div class="source-icon">📘</div>
            <div style="flex:1;min-width:0;">
              <div class="source-name">${bn}</div>
              <div class="source-meta">${preview}…</div>
            </div>
            <span class="source-page">p. ${s.page}</span>
          </div>`;
      }).join('');
      sourcesHtml = `
        <div class="sources-head" style="margin-top:12px;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
          Sources
        </div>
        <div class="source-list">${items}</div>`;

    } else if (block.type === 'actions') {
      actionsBlock = block;

    } else if (block.type === 'flashcard') {
      flashcardBlock = block;
    }
  }

  // Pure flashcard message (generated via wsGenerateFlashcardsInChat) — no text/actions.
  if (flashcardBlock && !textHtml && !sourcesHtml && !actionsBlock) {
    d.innerHTML = `
      <div class="ai-row">
        <div class="ai-body">
          ${_wsFlashcardResultHtml(flashcardBlock.deckId, flashcardBlock.topic, flashcardBlock.count)}
        </div>
      </div>`;
    return d;
  }

  const q          = actionsBlock?.question          || '';
  const searchMode = actionsBlock?.searchMode        || null;
  const primPage   = actionsBlock?.primarySourcePage || null;
  const safeQ      = q.replace(/`/g, "'").replace(/\n/g, ' ').slice(0, 120);

  const isHybrid = searchMode === 'hybrid';
  const searchModeBadge = searchMode ? `
    <span title="${isHybrid ? 'Semantic search active: 70% vector similarity + 30% keyword (TF-IDF)' : 'Keyword search only — semantic embeddings not available'}"
      style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-family:var(--font-mono);padding:2px 7px;border-radius:var(--r-pill);border:1px solid ${isHybrid ? 'var(--gold-border)' : 'var(--border-sm)'};color:${isHybrid ? 'var(--gold)' : 'var(--text-4)'};background:${isHybrid ? 'var(--gold-muted)' : 'var(--surface-2)'};cursor:default;user-select:none;">
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      ${isHybrid ? 'semantic' : 'keyword'}
    </span>` : '';

  const jumpToPageHtml = primPage ? `
    <button class="msg-act ws-jump-page-btn" onclick="wsGoToPage(${primPage})" title="Navigate to the most relevant page in the PDF">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      Go to Page ${primPage}
    </button>` : '';

  // If a flashcard was already generated for this message, replace the Make Flashcard
  // button with the persistent result card so the UI looks identical after reload.
  const makeFlashcardBtn = flashcardBlock ? '' : `
          <button class="msg-act" onclick="wsMakeFlashcard(this, '${msgId}', \`${safeQ}\`)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg> Make Flashcard
          </button>`;
  const flashcardHtml = flashcardBlock
    ? _wsFlashcardResultHtml(flashcardBlock.deckId, flashcardBlock.topic, flashcardBlock.count)
    : '';

  d.innerHTML = `
    <div class="ai-row">
      <div class="ai-body">
        ${textHtml}
        ${sourcesHtml}
        <div class="msg-acts" style="margin-top:10px;">
          <button class="msg-act" onclick="wsCopyMsg(this, '${msgId}')">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy
          </button>
          ${makeFlashcardBtn}
          <button class="msg-act" onclick="_wsRegenerate('${msgId}', \`${safeQ}\`)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.67"/></svg> Regenerate
          </button>
          <button class="msg-act ws-read-aloud-btn" aria-pressed="false" onclick="wsReadAloud(document.querySelector('#${msgId} .ai-text')?.innerText||'','${msgId}')">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg> Read
          </button>
          ${jumpToPageHtml}
          ${searchModeBadge}
        </div>
        ${flashcardHtml}
      </div>
    </div>`;
  return d;
}

export function wsAppendAI(answer, sources, question, searchMode) {
  const msgs     = $el('ws-messages');
  const bookName = $el('ws-book-name')?.textContent || '';
  const msgId    = 'ws-msg-' + Date.now();

  const blocks = _wsBuildBlocks(answer, sources, question, searchMode);
  const d      = _wsRenderMessageFromBlocks(msgId, blocks, bookName);

  // Append transient UI (follow-ups, auto-flash) that is not persisted in blocks
  const followups    = (typeof _isFollowupsEnabled === 'function' && _isFollowupsEnabled()) ? _wsFollowups(answer, question) : [];
  const followupHtml = followups.length ? `
    <div class="followups" style="margin-top:10px;">
      <div class="followup-head">Follow-up questions</div>
      <div class="followup-list">
        ${followups.map(q => `
          <div class="followup-item" onclick="wsSetInput('${q.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')">
            ${q.replace(/&/g,'&amp;').replace(/</g,'&lt;')}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
          </div>`).join('')}
      </div>
    </div>` : '';

  const autoFlashHtml = (typeof _isAutoFlashEnabled === 'function' && _isAutoFlashEnabled()) ? `
    <div style="margin-top:8px;padding:8px 10px;background:var(--violet-muted);border:1px solid var(--violet-border);border-radius:var(--r-md);display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <span style="font-size:11px;color:var(--text-2);">💡 Save this as a flashcard?</span>
      <button onclick="wsMakeFlashcard(this,'${msgId}',\`${(question||'').replace(/`/g,"'").replace(/\n/g,' ').slice(0,120)}\`)" style="font-size:11px;padding:4px 10px;border-radius:var(--r-pill);background:var(--violet-muted);border:1px solid var(--violet-border);color:var(--violet);cursor:pointer;font-family:var(--font-body);">Save flashcard</button>
    </div>` : '';

  if (followupHtml || autoFlashHtml) {
    const aiBody = d.querySelector('.ai-body');
    if (aiBody) aiBody.insertAdjacentHTML('beforeend', followupHtml + autoFlashHtml);
  }

  msgs.appendChild(d); wsScrollBottom();
  return d;
}

export function wsAppendError(msg) {
  const msgs = $el('ws-messages');
  const d = document.createElement('div');
  d.className = 'msg msg-ai';
  const escaped = msg.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  d.innerHTML = `<div class="ai-row"><div class="ai-body"><p class="ai-text" style="color:#f87171;">⚠ ${escaped}</p></div></div>`;
  msgs.appendChild(d); wsScrollBottom();
}

export function wsCopyMsg(btn, msgId) {
  const textEl = $el(msgId)?.querySelector('.ai-text');
  if (!textEl) return;
  navigator.clipboard?.writeText(textEl.innerText).then(() => {
    addClass(btn, 'copied');
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    setTimeout(() => {
      removeClass(btn, 'copied');
      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2000);
  }).catch(() => {
    showToast('⚠', 'Could not copy — check browser permissions', 'var(--red)');
  });
}

export function _wsFollowups(answer, question) {
  const a = (answer || '').toLowerCase();
  const q = (question || '').toLowerCase();
  if (a.includes('entropy')    || q.includes('entropy'))    return ['What happens to entropy during an adiabatic process?', 'Derive the entropy change for an ideal gas expansion'];
  if (a.includes('equilibrium')|| q.includes('equilibrium'))return ['How does temperature affect the equilibrium constant?', "What is Le Chatelier's principle?"];
  if (a.includes('kinetic')    || q.includes('kinetic') || a.includes('rate')) return ['What factors affect reaction rate?', 'Explain the Arrhenius equation'];
  if (a.includes('bond')       || q.includes('bond')  || a.includes('orbital')) return ['What is hybridization and how does it affect molecular shape?', 'Compare ionic vs covalent bonding'];
  if (a.includes('thermodynam')|| q.includes('thermodynam')) return ['How are enthalpy and internal energy related?', 'What does the second law of thermodynamics state?'];
  return ['Can you give a worked example?', 'How does this relate to real-world applications?'];
}

export async function _wsRegenerate(msgId, question) {
  $el(msgId)?.remove();
  if (ws.chatHistory.length && ws.chatHistory[ws.chatHistory.length - 1].role === 'assistant') ws.chatHistory.pop();
  await _wsAsk(question);
}

export function wsToggleWebSearch() {
  ws.webSearch = !ws.webSearch;
  toggleClass($el('ws-websearch-check'), 'on', ws.webSearch);
  toggleClass($el('ws-toggle-websearch'), 'active', ws.webSearch);
}

export function wsToggleThinkMenu(e) {
  e?.stopPropagation();
  const menu = $el('ws-think-menu');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  // Close all attach menus first
  document.querySelectorAll('.attach-menu').forEach(m => m.classList.remove('open'));
  if (!isOpen) addClass(menu, 'open');
}

export function wsToggleThinking(mode) {
  ws.thinking = ws.thinking === mode ? 'off' : mode;
  const isThink = ws.thinking === 'think';
  const isDeep  = ws.thinking === 'deep';
  const isAny   = isThink || isDeep;
  toggleClass($el('ws-think-check'), 'on', isThink);
  toggleClass($el('ws-deep-check'), 'on', isDeep);
  toggleClass($el('ws-toggle-think'), 'active', isAny);
  const label = $el('ws-think-label');
  if (label) label.textContent = isDeep ? 'Deep Think' : 'Think';
  // Close the think menu after selection
  removeClass($el('ws-think-menu'), 'open');
}

export async function wsChatSend() {
  if (ws.typing) { wsStopGeneration(); return; }
  const inp = $el('ws-chat-input');
  const question = inp.value.trim();
  if (!question) return;
  if (!guestGate('workspace')) return; // guest limit check

  // ── Command Engine: intercept navigation/action commands ─────────────────
  syncContextFromWorkspace();
  if (handleCommand(question, { screen: 'workspace' })) {
    inp.value = ''; wsAutoResize(inp); inp.focus();
    return;
  }
  // ── End command intercept ─────────────────────────────────────────────────

  inp.placeholder = 'Ask a follow-up about Chapter 3…';
  wsAppendUser(question, ws.selectedText);
  inp.value = ''; wsAutoResize(inp); inp.focus();
  ws.chatHistory.push({ role: 'user', content: question });
  recordUsage('workspace'); // track guest usage
  renderUsageBar('ws-chat-input-area', 'workspace');
  await _wsAsk(question);
}

/**
 * @param {string} question
 * @param {{ dataUrl: string, mimeType: string }|null} [imageAtt]
 *   When provided, the request is routed to /ask-image (vision endpoint)
 *   instead of /ask, and the image is sent as base64.
 */
export async function _wsAsk(question, imageAtt = null) {
  ws.typing = true;
  _wsAbortController = new AbortController();
  const { signal } = _wsAbortController;
  _wsSetGenerating(true);
  wsAppendThinking(!!imageAtt);
  const capturedSelection = ws.selectedText;
  ws.selectedText = '';  // clear so it doesn't bleed into follow-up questions
  try {
    const mode = typeof _getStudyMode === 'function' ? _getStudyMode() : 'study';
    const complexity = mode === 'concise' ? 3 : mode === 'detailed' ? 8 : 5;
    let res;

    if (imageAtt) {
      // ── Vision path: send image to /ask-image ─────────────────────────────
      const imgB64 = imageAtt.dataUrl.split(',')[1] || '';
      res = await fetch(`${API_BASE}/ask-image`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} },
        body: JSON.stringify({
          image_b64:  imgB64,
          image_type: imageAtt.mimeType || 'image/jpeg',
          question:   question || 'Describe this image.',
          complexity,
        }),
      });
      wsRemoveThinking(); // vision endpoint has no streaming thinking mode — remove indicator now
    } else {
      // ── Text path: send to /ask with optional retry on 429 ────────────────
      const body = { question, bookId: ws.bookId || 'none', mode, complexity, history: ws.chatHistory.slice(-10) };
      if (ws.webSearch)              body.web_search = true;
      if (ws.thinking === 'think')   body.thinking   = 'thinking';
      if (ws.thinking === 'deep')    body.thinking   = 'deep';
      if (capturedSelection) body.selected_text = capturedSelection;
      // User-uploaded doc: send extracted text as context instead of textbook index
      if (ws.userDocId && ws.userDocText) {
        body.doc_context = ws.userDocText.slice(0, 80000); // ~80k chars fits comfortably in context
        body.bookId = '__user_doc__';
      }
      // Retry on 429 with exponential backoff (up to 3 attempts)
      for (let _attempt = 0; _attempt <= 3; _attempt++) {
        res = await fetch(`${API_BASE}/ask`, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} },
          body: JSON.stringify(body),
        });
        if (res.status !== 429) break;
        const _d429 = await res.json().catch(() => ({}));
        if (_d429.guest_limited && isGuest?.() && typeof showLoginWall === 'function') {
          showLoginWall(_d429.feature || 'workspace');
          ws.chatHistory.pop();
          wsRemoveThinking();
          return;
        }
        if (_d429.plan_limited && _d429.upgrade_needed) {
          wsRemoveThinking();
          wsAppendError(_d429.error || 'You\'ve reached your plan limit. Upgrade for unlimited access!');
          ws.chatHistory.pop();
          if (typeof window.openUpgradeModal === 'function') window.openUpgradeModal();
          return;
        }
        if (_attempt < 3) {
          await new Promise(r => setTimeout(r, Math.pow(2, _attempt + 1) * 1000));
          continue;
        }
        wsRemoveThinking();
        wsAppendError('Server is busy — please wait a moment and try again.');
        ws.chatHistory.pop();
      }
      // When thinking mode is active, preserve the wrap so _wsFinalizeThinking
      // can repurpose it with real steps; otherwise clean up the streaming accordion.
      if (ws.thinking === 'off') {
        wsRemoveThinking();
      }
    }

    if (res.status === 429) {
      // already handled above
      if (ws.thinking !== 'off') wsRemoveThinking();
    } else if (!res.ok) {
      if (ws.thinking !== 'off') wsRemoveThinking();
      const err = await res.json().catch(() => ({}));
      wsAppendError(err.error || `Server error ${res.status}`);
      ws.chatHistory.pop();
    } else {
      const data   = await res.json();
      if (data.guest_limited && isGuest?.() && typeof showLoginWall === 'function') {
        showLoginWall(data.feature || 'workspace');
        ws.chatHistory.pop();
        if (ws.thinking !== 'off') wsRemoveThinking();
        return;
      }

      // ── Client-side <think> extraction (safety net if backend missed it) ──
      const { answer, thinkingContent: clientThinking } = extractThinkBlock(data.answer || '');
      const cleanAnswer     = answer || 'No response.';
      const thinkingContent = data.thinking_content || clientThinking || null;

      // ── ThinkingAccordion: finalize with real steps if thinking was active ──
      if (!imageAtt && ws.thinking !== 'off') {
        _wsFinalizeThinking(thinkingContent);
      }

      // ── Typewriter: render AI response word by word ──
      const aiEl = wsAppendAI('', data.sources || [], question, data.search_mode);
      const textEl = aiEl?.querySelector('.ai-text');
      if (textEl) {
        await typewriteResponse(textEl, cleanAnswer, {
          render: typeof wsRender === 'function' ? wsRender : undefined,
          onScroll: wsScrollBottom,
          isCancelled: () => signal.aborted,
        });
      }

      ws.chatHistory.push({
        role:    'assistant',
        content: cleanAnswer,
        blocks:  _wsBuildBlocks(cleanAnswer, data.sources || [], question, data.search_mode),
      });
      if (aiEl) aiEl.dataset.histIdx = String(ws.chatHistory.length - 1);
      if (typeof _saveWsSession === 'function') _saveWsSession(ws.bookId, ws.chatHistory);
      // Notify SmartNotesPanel so it can offer "Clip to notes"
      document.dispatchEvent(new CustomEvent('ws:ai-answer', {
        detail: { text: cleanAnswer.replace(/<[^>]*>/g, '').trim(), page: ws.currentPage || 1 },
      }));
      // Update context with the current topic and page for command engine
      updateContext({ topic: question.slice(0, 120), screen: 'workspace' });
      syncContextFromWorkspace();
    }
  } catch (e) {
    if (e?.name === 'AbortError') {
      wsRemoveThinking();
      // Keep whatever text has already been rendered — do not pop history here
    } else {
      wsRemoveThinking();
      wsAppendError('Could not reach the server. Check your connection.');
      ws.chatHistory.pop();
    }
  } finally {
    ws.typing = false;
    _wsAbortController = null;
    _wsSetGenerating(false);
  }
}

// ── Keyboard listener ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  $el('ws-chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.wsChatSend(); }
  });
  $el('ws-chat-input')?.addEventListener('input', function() { wsAutoResize(this); });
});
