/**
 * src/state/flash/completion.js — Session completion + modal actions
 */

import { $el, setText, show, hide, setDisplay } from '../domHelpers.js';
import { fc } from './state.js';
import { _fcShowView } from './helpers.js';
import {
  _fcRecordStudyDay,
  _fcAwardXp,
  _fcXpMultiplier,
  _fcGetXp,
  _fcHardBoostActive,
  _fcStreakMilestones,
} from './streak.js';
import { _fcSaveMastery, _fcDecksCache } from './decks.js';
import { _fcRenderDeckList } from './decks.js';
import { _fcRemoveKeyboard } from './keyboard.js';
import { _fcSound, _fcStartDeck } from './session.js';
import { FlashcardDB } from '../../lib/flashcardDb.js';
import { ChunksDB } from '../../lib/chunksDb.js';

// ── Session completion ──────────────────────────────────────────────────────

export async function _fcFinishSession() {
  _fcRecordStudyDay();

  const xpResult = _fcAwardXp(fc.stats);

  if (fc.currentDeckMeta?.id) {
    _fcSaveMastery(fc.currentDeckMeta.id, fc.stats, fc.deck.length);
  }

  _fcSound.complete();

  try {
    await FlashcardDB.fcSaveSession({
      deckId:      fc.currentDeckMeta?.id   || null,
      deckName:    fc.currentDeckMeta?.name || 'Untitled',
      stats:       fc.stats,
      cardRatings: fc.ratings,
      deck:        fc.deck,
    });
  } catch (e) {
    console.warn('[flashState] session save error:', e);
  }

  ChunksDB?.streak?.recordSession?.({
    xpEarned:   xpResult?.earned ?? 0,
    milestones: _fcStreakMilestones?.(),
  }).catch?.(() => {});

  const { easy, ok, hard, skipped } = fc.stats;
  const total = fc.deck.length;
  const score = total ? Math.min(100, Math.round(((easy + ok) / total) * 100)) : 0;

  [['easy', easy], ['ok', ok], ['hard', hard], ['skipped', skipped]].forEach(([k, v]) => {
    const el = $el(`fc-stat-${k}`);
    setText(el, v);
  });

  const emojiEl = $el('fc-complete-emoji');
  const titleEl = $el('fc-complete-title');
  const subEl   = $el('fc-complete-sub');
  if (score >= 80) {
    setText(emojiEl, '🏆');
    setText(titleEl, 'Outstanding!');
    setText(subEl,   `You nailed ${score}% of this deck — incredible work.`);
  } else if (score >= 50) {
    setText(emojiEl, '⚡');
    setText(titleEl, 'Good progress!');
    setText(subEl,   `${score}% solid — keep it up and you'll master it.`);
  } else {
    setText(emojiEl, '💪');
    setText(titleEl, 'Keep studying!');
    setText(subEl,   `${score}% — every pass through gets easier.`);
  }

  const xpEarnedEl = $el('fc-modal-xp-earned');
  const xpBonusEl  = $el('fc-modal-xp-bonus');
  const xpTotalEl  = $el('fc-modal-xp-total');
  const xpBlockEl  = $el('fc-modal-xp-block');
  setText(xpEarnedEl, `+${xpResult.earned} XP`);
  if (xpBonusEl) {
    if (xpResult.bonus > 0) {
      setText(xpBonusEl, `(${_fcXpMultiplier().label} · +${xpResult.bonus} bonus)`);
      show(xpBonusEl);
    } else {
      hide(xpBonusEl);
    }
  }
  const xpStore = _fcGetXp();
  setText(xpTotalEl, `${xpStore.total.toLocaleString()} total XP`);
  setDisplay(xpBlockEl, xpResult.earned > 0);

  const srsEl  = $el('fc-modal-srs-note');
  const srsMsg = $el('fc-srs-message');
  if (hard > 0 && srsEl && srsMsg) {
    show(srsEl);
    const boostNote = _fcHardBoostActive() ? ' (boosted — due sooner)' : '';
    setText(srsMsg, `${hard} hard card${hard !== 1 ? 's' : ''} will be prioritised in your next session${boostNote}.`);
  } else if (srsEl) {
    hide(srsEl);
  }

  const hardBtn = $el('fc-study-hard-btn');
  setDisplay(hardBtn, hard > 0);

  const reviewChatBtn = $el('fc-review-in-chat-btn');
  setDisplay(reviewChatBtn, hard > 0);

  _fcRemoveKeyboard();

  const modal = $el('fc-complete-modal');
  show(modal);
}

// ── Modal actions ───────────────────────────────────────────────────────────

export function _fcRestartDeck() {
  _fcCloseCompleteModal();
  const deck = _fcDecksCache?.find(d => d.id === fc.currentDeckMeta?.id);
  if (deck) _fcStartDeck(deck, false);
}

export function _fcStudyHardOnly() {
  _fcCloseCompleteModal();
  const deck = _fcDecksCache?.find(d => d.id === fc.currentDeckMeta?.id);
  if (deck) _fcStartDeck(deck, true);
}

export function _fcCreateNew() {
  _fcCloseCompleteModal();
  _fcExitStudy();
  setTimeout(() => $el('fc-topic-input')?.focus(), 100);
}

export function _fcCloseCompleteModal() {
  const modal = $el('fc-complete-modal');
  hide(modal);
}

export function _fcExitStudy() {
  _fcRemoveKeyboard();
  _fcCloseCompleteModal();
  _fcShowView('home');
  _fcRenderDeckList();
}
