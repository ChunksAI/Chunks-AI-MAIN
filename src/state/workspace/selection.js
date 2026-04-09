// @ts-nocheck
/**
 * src/state/workspace/selection.js — Contextual AI toolbar for PDF text selection
 *
 * When the user selects text inside the PDF text layer, a floating glassmorphism
 * toolbar appears near the selection with three AI actions:
 *   • Explain  — asks for a clear explanation of the selected text
 *   • Simplify — asks for a simplified version in plain language
 *   • Quiz     — asks the AI to generate a quiz question about the selection
 *
 * Clicking an action:
 *   1. Stores the selection as ws.selectedText
 *   2. Sets the chat input to the action prompt
 *   3. Clears the DOM selection and hides the toolbar
 *   4. Focuses the chat input (user reviews before sending)
 */

import { ws } from './state.js';
import { wsSetInput, wsChatSend } from './chat.js';
import { $el } from '../domHelpers.js';

/** Maximum characters of selected text included in the action prompt. */
const MAX_SELECTION_LENGTH = 200;

let _wsContextBar = null;
let _wsSelectionPopup = null;

// ── Contextual bar actions ────────────────────────────────────────────────

const _ACTIONS = [
  {
    label: 'Explain',
    icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    prompt: (text) => `Explain this: "${text}"`,
  },
  {
    label: 'Simplify',
    icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="4 7 4 4 20 4"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
    prompt: (text) => `Simplify this in plain language: "${text}"`,
  },
  {
    label: 'Quiz',
    icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg>`,
    prompt: (text) => `Create a quiz question about: "${text}"`,
  },
];

// ── Create the contextual bar (once) ─────────────────────────────────────

export function _wsCreateAskBtn() {
  if (_wsContextBar) return;

  _wsContextBar = document.createElement('div');
  _wsContextBar.id = 'ws-ctx-bar';

  // Prevent mousedown from clearing the selection before we read it
  _wsContextBar.addEventListener('mousedown', e => e.preventDefault());

  _ACTIONS.forEach(action => {
    const btn = document.createElement('button');
    btn.className = 'ws-ctx-action';
    btn.innerHTML = `${action.icon}<span>${action.label}</span>`;
    btn.title = action.label;
    btn.addEventListener('click', () => {
      const sel = window.getSelection();
      const text = (sel ? sel.toString() : '').trim() || ws.selectedText;
      if (!text) { _wsHideAskBtn(); return; }

      ws.selectedText = text;

      // Pre-fill the chat input with the action prompt
      wsSetInput(action.prompt(text.slice(0, MAX_SELECTION_LENGTH)));

      // Clear DOM selection and hide bar
      sel?.removeAllRanges();
      _wsHideAskBtn();

      // Auto-send to AI immediately (no extra click needed)
      wsChatSend();
    });
    _wsContextBar.appendChild(btn);
  });

  document.body.appendChild(_wsContextBar);
}

export function _wsHideAskBtn() {
  if (_wsContextBar) _wsContextBar.style.display = 'none';
  // Restore placeholder if nothing was typed
  const inp = $el('ws-chat-input');
  if (inp && !inp.value.trim()) inp.placeholder = 'Ask a follow-up about Chapter 3…';
}

// ── Selection popup (Explain / Quiz me / Add note) ────────────────────────

function _wsCreateSelectionPopup() {
  if (_wsSelectionPopup) return;

  _wsSelectionPopup = document.createElement('div');
  _wsSelectionPopup.id = 'ws-selection-popup';
  _wsSelectionPopup.className = 'ws-selection-popup hidden';

  // Prevent mousedown from collapsing selection before we read it
  _wsSelectionPopup.addEventListener('mousedown', e => e.preventDefault());

  const buttons = [
    { label: 'Explain',  type: 'explain' },
    { label: 'Quiz me',  type: 'quiz'    },
    { label: 'Add note', type: 'note'    },
  ];

  buttons.forEach(({ label, type }) => {
    const btn = document.createElement('button');
    btn.className = 'ws-sel-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => wsSelectionAction(type));
    _wsSelectionPopup.appendChild(btn);
  });

  document.body.appendChild(_wsSelectionPopup);
}

export function wsSelectionAction(type) {
  // Auto-expand the panel if it is collapsed
  const panel = document.getElementById('ws-chat-panel');
  if (panel && panel.classList.contains('ws-panel-collapsed')) {
    if (typeof window.wsTogglePanelCollapse === 'function') {
      window.wsTogglePanelCollapse();
    }
  }

  const sel  = window.getSelection();
  const text = (sel ? sel.toString() : '').trim();
  if (!text) { _wsHideSelectionPopup(); return; }

  if (type === 'explain') {
    wsSetInput(`Explain this: "${text}"`);
    wsChatSend();
  } else if (type === 'quiz') {
    wsSetInput(`Quiz me on this: "${text}"`);
    wsChatSend();
  } else if (type === 'note') {
    wsSetInput(`Add to notes: "${text}"`);
    const inp = document.getElementById('ws-chat-input');
    if (inp) inp.focus();
  }

  sel?.removeAllRanges();
  _wsHideSelectionPopup();
}

function _wsHideSelectionPopup() {
  if (_wsSelectionPopup) _wsSelectionPopup.classList.add('hidden');
}

function _wsShowSelectionPopup(rect) {
  _wsCreateSelectionPopup();
  _wsSelectionPopup.classList.remove('hidden');
  _wsSelectionPopup.style.top  = `${rect.top - 44}px`;
  _wsSelectionPopup.style.left = `${rect.left}px`;
}

export function _wsOnSelectionChange() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) {
    _wsHideAskBtn();
    _wsHideSelectionPopup();
    return;
  }

  // Only activate when selection is inside the PDF viewer
  const anchor = sel.anchorNode;
  const pdfWrap = $el('ws-pdf-canvas-wrap');
  if (!pdfWrap || !pdfWrap.contains(anchor)) {
    _wsHideAskBtn();
    _wsHideSelectionPopup();
    return;
  }

  _wsCreateAskBtn();

  // Position the bar just above the centre of the selection
  const range = sel.getRangeAt(0);
  const rect  = range.getBoundingClientRect();
  if (!rect.width && !rect.height) { _wsHideAskBtn(); _wsHideSelectionPopup(); return; }

  // Make bar briefly visible to measure its actual rendered width
  _wsContextBar.style.cssText = 'display:flex;visibility:hidden;position:fixed;top:-999px;left:-999px;';
  const barW = _wsContextBar.getBoundingClientRect().width || 210;
  const barH = 34;

  let top  = rect.top  - barH - 10;
  let left = rect.left + rect.width / 2 - barW / 2;

  // Keep within viewport
  left = Math.max(8, Math.min(left, window.innerWidth - barW - 8));
  if (top < 8) top = rect.bottom + 10;

  _wsContextBar.style.cssText = `
    display:flex;
    position:fixed;
    top:${top}px;
    left:${left}px;
    visibility:visible;
    z-index:10050;
  `;

  // Also show the selection popup
  _wsShowSelectionPopup(rect);
}

// ── Event listeners ──────────────────────────────────────────────────────

document.addEventListener('mouseup',         _wsOnSelectionChange);
document.addEventListener('selectionchange', _wsOnSelectionChange);

// Hide when clicking outside
document.addEventListener('mousedown', e => {
  if (_wsContextBar && e.target !== _wsContextBar && !_wsContextBar.contains(e.target)) {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { _wsHideAskBtn(); _wsHideSelectionPopup(); }
    }, 50);
  }
  if (_wsSelectionPopup && e.target !== _wsSelectionPopup && !_wsSelectionPopup.contains(e.target)) {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) _wsHideSelectionPopup();
    }, 50);
  }
});

// Restore placeholder when user starts typing
document.addEventListener('DOMContentLoaded', () => {
  $el('ws-chat-input')?.addEventListener('input', () => {
    if ($el('ws-chat-input').value.trim()) {
      $el('ws-chat-input').placeholder = 'Ask a follow-up about Chapter 3…';
    }
  });
});
