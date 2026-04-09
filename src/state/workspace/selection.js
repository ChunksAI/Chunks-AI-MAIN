// @ts-nocheck
/**
 * src/state/workspace/selection.js — Contextual AI toolbar for PDF text selection
 *
 * When the user selects text inside the PDF text layer, a floating popup
 * appears near the selection with three AI actions:
 *   • Explain  — asks for a clear explanation of the selected text
 *   • Quiz me  — asks the AI to generate a quiz question about the selection
 *   • Add note — pre-fills the chat input so the user can review before sending
 *
 * Clicking an action:
 *   1. Stores the selection as ws.selectedText
 *   2. Sets the chat input to the action prompt
 *   3. Clears the DOM selection and hides the popup
 *   4. Focuses the chat input (user reviews before sending)
 */

import { ws } from './state.js';
import { wsSetInput, wsChatSend } from './chat.js';
import { $el } from '../domHelpers.js';

/** Maximum characters of selected text included in the action prompt. */
const MAX_SELECTION_LENGTH = 200;

let _wsSelectionPopup = null;

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
    _wsHideSelectionPopup();
    return;
  }

  // Only activate when selection is inside the PDF viewer
  const anchor = sel.anchorNode;
  const pdfWrap = $el('ws-pdf-canvas-wrap');
  if (!pdfWrap || !pdfWrap.contains(anchor)) {
    _wsHideSelectionPopup();
    return;
  }

  // Position the popup just above the start of the selection
  const range = sel.getRangeAt(0);
  const rect  = range.getBoundingClientRect();
  if (!rect.width && !rect.height) { _wsHideSelectionPopup(); return; }

  _wsShowSelectionPopup(rect);
}

// ── Event listeners ──────────────────────────────────────────────────────

document.addEventListener('mouseup',         _wsOnSelectionChange);
document.addEventListener('selectionchange', _wsOnSelectionChange);

// Hide when clicking outside
document.addEventListener('mousedown', e => {
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
