/**
 * src/state/flash/chatBridge.js — Workspace/chat integration
 */

import { $el } from '../domHelpers.js';
import { fc } from './state.js';
import { _fcDismissTutor } from './session.js';
import { _fcCloseCompleteModal } from './completion.js';
import { _fcGenerateFromBar } from './generation.js';
import { _fcInitAccent } from './accent.js';
import { _fcRenderDeckList } from './decks.js';

// ── Workspace make flashcard ────────────────────────────────────────────────

export async function wsMakeFlashcard(el) {
  const topic = el?.dataset?.topic || '';
  if (!topic) return;
  if (window.showScreen) window.showScreen('flash');
  const input = $el('fc-topic-input');
  if (input) {
    input.value = topic;
    setTimeout(() => _fcGenerateFromBar(), 200);
  }
}

// ── Study in Chat (from AI Tutor panel) ─────────────────────────────────────

export function _fcStudyInChat() {
  const question = $el('fc-card-question')?.textContent?.trim()
    || fc.deck[fc.index]?.front
    || fc.deck[fc.index]?.question
    || '';
  const answer = $el('fc-card-answer')?.textContent?.trim()
    || fc.deck[fc.index]?.back
    || fc.deck[fc.index]?.answer
    || '';

  _fcDismissTutor();

  if (!question) return;
  const prompt = `I got this flashcard wrong. Can you explain it in depth?\n\nQuestion: ${question}\nAnswer: ${answer}`;

  if (typeof showScreen === 'function') showScreen('workspace');
  setTimeout(() => {
    const inp = $el('ws-chat-input');
    if (!inp) return;
    inp.value = prompt;
    if (typeof wsAutoResize === 'function') wsAutoResize(inp);
    inp.focus();
    setTimeout(() => { if (typeof window.wsChatSend === 'function') window.wsChatSend(); }, 350);
  }, 250);
}

// ── Review Hard in Chat (from session complete modal) ───────────────────────

export function _fcReviewHardInChat() {
  _fcCloseCompleteModal();

  const hardCards = fc.ratings
    .filter(r => r.rating === 'hard')
    .map(r => {
      const card = fc.deck.find(c => c.id === r.card_id) || fc.deck[fc.ratings.indexOf(r)];
      return card?.front || card?.question || null;
    })
    .filter(Boolean)
    .slice(0, 5);

  const deckName = fc.currentDeckMeta?.name || 'my flashcard deck';

  let prompt;
  if (hardCards.length === 0) {
    prompt = `Can you give me a quick review of the key concepts from "${deckName}"?`;
  } else if (hardCards.length === 1) {
    prompt = `I struggled with this flashcard from "${deckName}". Can you explain it clearly?\n\n• ${hardCards[0]}`;
  } else {
    const list = hardCards.map(q => `• ${q}`).join('\n');
    prompt = `I struggled with these ${hardCards.length} flashcards from "${deckName}". Can you explain each one clearly?\n\n${list}`;
  }

  if (typeof showScreen === 'function') showScreen('workspace');
  setTimeout(() => {
    const inp = $el('ws-chat-input');
    if (!inp) return;
    inp.value = prompt;
    if (typeof wsAutoResize === 'function') wsAutoResize(inp);
    inp.focus();
    setTimeout(() => { if (typeof window.wsChatSend === 'function') window.wsChatSend(); }, 350);
  }, 250);
}

// ── Init ────────────────────────────────────────────────────────────────────

export function _fcInit() {
  _fcInitAccent();
  _fcRenderDeckList();
}
