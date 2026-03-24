/**
 * src/state/studyplan/workspaceBridge.js — Study Plan → Workspace Chat integration
 */

import { sp } from './state.js';
import { $el } from '../domHelpers.js';
import { spCloseExplainDrawer } from './explain.js';
import { spOpenVisualTutor } from './visualTutor.js';

export function spOpenInWorkspace() {
  if (!sp.drawerConcept) return;

  const title = sp.drawerConcept.title || '';
  const desc  = sp.drawerConcept.description
    ? ' — ' + sp.drawerConcept.description.slice(0, 100)
    : '';
  const prompt = `Explain "${title}"${desc}`;

  spCloseExplainDrawer();

  if (typeof showScreen === 'function') showScreen('workspace');

  setTimeout(() => {
    const inp = $el('ws-chat-input');
    if (!inp) return;
    inp.value = prompt;
    if (typeof wsAutoResize === 'function') wsAutoResize(inp);
    inp.focus();

    setTimeout(() => {
      if (typeof window.wsChatSend === 'function') window.wsChatSend();
    }, 350);
  }, 250);
}

// ── Task 4: "Study this in Chat" shortcut on node cards ───────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-concept-chat]');
  if (!btn) return;
  e.stopPropagation();
  const title  = btn.dataset.conceptChat;
  const prompt = `Explain "${title}"`;

  if (typeof showScreen === 'function') showScreen('workspace');
  setTimeout(() => {
    const inp = $el('ws-chat-input');
    if (!inp) return;
    inp.value = prompt;
    if (typeof wsAutoResize === 'function') wsAutoResize(inp);
    inp.focus();
    setTimeout(() => {
      if (typeof window.wsChatSend === 'function') window.wsChatSend();
    }, 350);
  }, 250);
});

// Handle Visual Tutor tab click via data-action delegation
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action="spOpenVisualTutor"]');
  if (el) spOpenVisualTutor();
});

// ── Task 4: "Study in Chat" button delegation ─────────────────────────────
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action="spOpenInWorkspace"]');
  if (el) spOpenInWorkspace();
});
