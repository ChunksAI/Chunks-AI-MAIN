/**
 * src/state/studyplan/flashcards.js — Mini flashcard engine (sp-specific)
 */

import { sp } from './state.js';
import { $el, hide, show, setText, setHtml, addClass, removeClass } from '../domHelpers.js';
import { API_BASE } from '../../lib/api.js';
import { spMasteryRecord } from './mastery.js';

export async function spFcGenerate() {
  setHtml($el('sp-fc-loading'), '<div class="sp-explain-spinner"></div><div style="font-size:12px;">Generating flashcards…</div>');
  $el('sp-fc-loading').style.display   = 'flex';
  hide($el('sp-fc-deck'));
  hide($el('sp-fc-complete'));
  try {
    const concept = sp.drawerConcept;
    const res = await fetch(API_BASE + '/generate-flashcards', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...await window._getAuthHeader?.() ?? {} },
      body: JSON.stringify({ topic: concept.title + (concept.description ? ': ' + concept.description : ''), bookId: null, count: 8 }),
    });
    if (res.status === 429) { const _d = await res.json().catch(()=>({})); if (_d.guest_limited && window.isGuestMode?.() && typeof window.showGuestLoginWall === 'function') { window.showGuestLoginWall(_d.feature||'workspace'); return; } throw new Error('Server busy'); }
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();
    if (!data.success || !data.flashcards?.length) throw new Error(data.error || 'No cards');
    sp.fcDeck = data.flashcards; sp.fcIndex = 0; sp.fcStats = { easy: 0, ok: 0, hard: 0 }; sp.fcFlipped = false;
    spFcShowDeck();
  } catch (err) {
    setHtml($el('sp-fc-loading'), `<div style="color:var(--red);font-size:12px;text-align:center;padding:20px;">Failed to generate cards.<br><button onclick="spFcGenerate()" style="margin-top:10px;padding:6px 14px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:11px;cursor:pointer;font-family:var(--font-body);">Try again</button></div>`);
    console.error('FC generate error:', err);
  }
}

export function spFcShowDeck() {
  hide($el('sp-fc-loading'));
  hide($el('sp-fc-complete'));
  $el('sp-fc-deck').style.display = 'flex';
  spFcRenderCard();
}

export function spFcRenderCard() {
  const card = sp.fcDeck[sp.fcIndex];
  if (!card) return;
  sp.fcFlipped = false;
  removeClass($el('sp-fc-card'), 'flipped');
  hide($el('sp-fc-ratings'));
  setText($el('sp-fc-front-text'), card.front || card.question || card.term || '');
  setText($el('sp-fc-back-text'), card.back  || card.answer   || card.definition || '');
  const pct = (sp.fcIndex / sp.fcDeck.length) * 100;
  $el('sp-fc-progress-bar').style.width = pct + '%';
  setText($el('sp-fc-counter'), (sp.fcIndex + 1) + ' / ' + sp.fcDeck.length);
}

export function spFcFlip() {
  if (sp.fcFlipped) return;
  sp.fcFlipped = true;
  addClass($el('sp-fc-card'), 'flipped');
  $el('sp-fc-ratings').style.display = 'flex';
}

export function spFcRate(rating) {
  sp.fcStats[rating] = (sp.fcStats[rating] || 0) + 1;
  sp.fcIndex++;
  if (sp.fcIndex >= sp.fcDeck.length) spFcShowComplete(); else spFcRenderCard();
}

export function spFcShowComplete() {
  hide($el('sp-fc-deck'));
  $el('sp-fc-complete').style.display = 'flex';
  const total = sp.fcDeck.length;
  setHtml($el('sp-fc-result-text'),
    `You reviewed all <strong style="color:var(--text-1);">${total}</strong> cards.<br>` +
    `<span style="color:var(--green);">Easy: ${sp.fcStats.easy}</span> &nbsp;·&nbsp; ` +
    `<span style="color:var(--gold);">OK: ${sp.fcStats.ok}</span> &nbsp;·&nbsp; ` +
    `<span style="color:var(--red);">Hard: ${sp.fcStats.hard}</span>`);
  const fcScore = total > 0 ? Math.round(((sp.fcStats.easy * 100) + (sp.fcStats.ok * 70) + (sp.fcStats.hard * 40)) / total) : 0;
  spMasteryRecord('flash', fcScore);
}

export function spFcRestart() {
  sp.fcIndex = 0; sp.fcStats = { easy: 0, ok: 0, hard: 0 }; sp.fcFlipped = false;
  spFcShowDeck();
}
