/**
 * src/state/flash/editing.js — Card editing
 */

import { $el, setText, hide } from '../domHelpers.js';
import { fc } from './state.js';

let _fcEditSide = 'front';

export function _fcOpenEditCard(side) {
  _fcEditSide = side;
  const card = fc.deck[fc.index];
  if (!card) return;

  const overlay  = $el('fc-edit-overlay');
  const textarea = $el('fc-edit-textarea');
  const label    = $el('fc-edit-label');
  if (!overlay || !textarea) return;

  const text = side === 'front'
    ? (card.front || card.question || '')
    : (card.back  || card.answer   || '');

  setText(label, side === 'front' ? 'Edit question' : 'Edit answer');
  textarea.value = text;
  overlay.style.display = 'flex';
  setTimeout(() => textarea.focus(), 50);
}

export function _fcCloseEditCard() {
  const overlay = $el('fc-edit-overlay');
  hide(overlay);
}

export async function _fcSaveEditCard() {
  const textarea = $el('fc-edit-textarea');
  if (!textarea) return;

  const newText = textarea.value.trim();
  if (!newText) return;

  const card = fc.deck[fc.index];
  if (!card) return;

  if (_fcEditSide === 'front') {
    card.front    = newText;
    card.question = newText;
    const q = $el('fc-card-question');
    setText(q, newText);
  } else {
    card.back   = newText;
    card.answer = newText;
    const a = $el('fc-card-answer');
    setText(a, newText);
  }

  try {
    const lsKey = window.FlashcardDB?.FC_LS_KEY;
    if (lsKey) {
      const decks = JSON.parse(localStorage.getItem(lsKey) || '[]');
      const deckIdx = decks.findIndex(d => d.id === fc.currentDeckMeta?.id);
      if (deckIdx >= 0 && decks[deckIdx].cards) {
        const cardIdx = decks[deckIdx].cards.findIndex(
          c => (c.front || c.question) === (_fcEditSide === 'front'
            ? (card.front || card.question)
            : '') || c.id === card.id
        );
        if (cardIdx >= 0) {
          decks[deckIdx].cards[cardIdx] = { ...decks[deckIdx].cards[cardIdx], ...card };
        }
        localStorage.setItem(lsKey, JSON.stringify(decks));
      }
    }
  } catch (e) {}

  if (card.id) {
    try {
      const sb = await window._getChunksSb?.();
      if (sb) {
        await sb.from('fc_cards').update({
          front: card.front || card.question || '',
          back:  card.back  || card.answer   || '',
        }).eq('id', card.id);
      }
    } catch (e) {
      console.warn('[flashState] card update error:', e.message);
    }
  }

  _fcCloseEditCard();
  window._showToast?.('✓', 'Card updated', 'var(--teal)');
}
