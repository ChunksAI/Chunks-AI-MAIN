/**
 * src/state/workspace/selection.js — "Ask AI" floating button for PDF text selection
 *
 * When the user selects text inside the PDF text layer, a small floating
 * button appears near the selection. Clicking it:
 *   1. Stores the selection as ws.selectedText (sent with the next /ask call)
 *   2. Focuses the chat input with a prompt placeholder
 *   3. Clears the DOM selection
 *
 * The button is created once and repositioned on each selection.
 */

import { ws } from './state.js';
import { wsShowToast } from './chat.js';
import { $el } from '../domHelpers.js';

let _wsAskBtn = null;

export function _wsCreateAskBtn() {
  if (_wsAskBtn) return;
  _wsAskBtn = document.createElement('button');
  _wsAskBtn.id = 'ws-ask-ai-btn';
  _wsAskBtn.innerHTML = `
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    Ask AI`;
  _wsAskBtn.addEventListener('mousedown', e => {
    e.preventDefault(); // prevent killing the selection before we read it
  });
  _wsAskBtn.addEventListener('click', () => {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text) { _wsHideAskBtn(); return; }

    // Store it — _wsAsk will pick this up on the next send
    ws.selectedText = text;

    // Show a quoted preview in the chat input as a visual cue
    const inp = $el('ws-chat-input');
    if (inp && !inp.value.trim()) {
      inp.placeholder = `Ask about: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`;
    }

    // Show a non-intrusive toast so the user knows the context was captured
    wsShowToast('✦', 'Selection captured — type your question', 'var(--gold-border)');

    // Focus chat
    inp?.focus();

    // Dismiss selection highlight + button
    sel?.removeAllRanges();
    _wsHideAskBtn();
  });
  document.body.appendChild(_wsAskBtn);
}

export function _wsHideAskBtn() {
  if (_wsAskBtn) _wsAskBtn.style.display = 'none';
  // Also clear placeholder if no text was typed
  const inp = $el('ws-chat-input');
  if (inp && !inp.value.trim()) inp.placeholder = 'Ask a follow-up about Chapter 3…';
}

export function _wsOnSelectionChange() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) {
    _wsHideAskBtn();
    return;
  }

  // Only activate when selection is inside the PDF viewer
  const anchor = sel.anchorNode;
  const pdfWrap = $el('ws-pdf-canvas-wrap');
  if (!pdfWrap || !pdfWrap.contains(anchor)) {
    _wsHideAskBtn();
    return;
  }

  _wsCreateAskBtn();

  // Position the button just above the end of the selection
  const range = sel.getRangeAt(0);
  const rect  = range.getBoundingClientRect();
  if (!rect.width && !rect.height) { _wsHideAskBtn(); return; }

  const btnW = 90, btnH = 30;
  let top  = rect.top  + window.scrollY - btnH - 8;
  let left = rect.left + window.scrollX + (rect.width / 2) - (btnW / 2);

  // Keep within viewport
  left = Math.max(8, Math.min(left, window.innerWidth - btnW - 8));
  if (top < 8) top = rect.bottom + window.scrollY + 8;

  _wsAskBtn.style.cssText = `
    display:flex;align-items:center;gap:5px;
    position:fixed;
    top:${rect.top  - btnH - 8}px;
    left:${rect.left + (rect.width / 2) - (btnW / 2)}px;
    width:${btnW}px;height:${btnH}px;
    padding:0 10px;
    background:var(--gold);color:#1a1200;
    border:none;border-radius:var(--r-pill);
    font-family:var(--font-body);font-size:12px;font-weight:600;
    cursor:pointer;z-index:10050;
    box-shadow:0 4px 16px rgba(0,0,0,0.5);
    white-space:nowrap;
  `;
}

// Listen for selection changes inside the PDF
document.addEventListener('mouseup',         _wsOnSelectionChange);
document.addEventListener('selectionchange', _wsOnSelectionChange);

// When the user clears their selection by clicking elsewhere, hide the button
document.addEventListener('mousedown', e => {
  if (_wsAskBtn && e.target !== _wsAskBtn && !_wsAskBtn.contains(e.target)) {
    // Give the selection a tick to update before deciding to hide
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) _wsHideAskBtn();
    }, 50);
  }
});

// Also clear captured selection if user manually types in chat (they changed their mind)
document.addEventListener('DOMContentLoaded', () => {
  $el('ws-chat-input')?.addEventListener('input', () => {
    if ($el('ws-chat-input').value.trim()) {
      // User is typing — keep the captured selection but restore placeholder
      $el('ws-chat-input').placeholder = 'Ask a follow-up about Chapter 3…';
    }
  });
});
