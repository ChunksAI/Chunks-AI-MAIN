/**
 * src/state/flash/session.js — Study session: start, render, flip, advance, sound
 */

import { $el, setText, show, hide, toggleClass, removeClass } from '../domHelpers.js';
import { fc } from './state.js';
import { _fcShowView } from './helpers.js';
import { _fcHardBoostActive } from './streak.js';
import { _fcBindKeyboard } from './keyboard.js';
import { _fcFinishSession } from './completion.js';
import { _aiParams } from './generation.js';

// ── Start a study session ───────────────────────────────────────────────────

export async function _fcStartDeck(deck, hardOnly) {
  if (!deck) return;

  const cards = await window.FlashcardDB.fcLoadCards(deck);
  if (!cards.length) {
    window._showToast?.('!', 'This deck has no cards.', 'var(--text-3)');
    return;
  }

  let studyCards = hardOnly
    ? cards.filter((_, i) => fc.ratings[i]?.rating === 'hard')
    : [...cards];

  if (hardOnly && !studyCards.length) {
    window._showToast?.('✓', 'No hard cards to review!', 'var(--teal)');
    return;
  }

  // Shuffle cards every session — Fisher-Yates
  for (let i = studyCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [studyCards[i], studyCards[j]] = [studyCards[j], studyCards[i]];
  }

  fc.deck            = studyCards;
  fc.index           = 0;
  fc.flipped         = false;
  fc.hardOnly        = !!hardOnly;
  fc.stats           = { easy: 0, ok: 0, hard: 0, skipped: 0 };
  fc.ratings         = [];
  fc.currentDeckMeta = { id: deck.id, name: deck.name };

  _fcShowView('study');
  _fcRenderCard();

  const nameEl = $el('fc-deck-name-label');
  setText(nameEl, deck.name);

  _fcBindKeyboard();
}

// ── Card rendering ──────────────────────────────────────────────────────────

export function _fcRenderCard() {
  const card = fc.deck[fc.index];
  if (!card) return;

  fc.flipped = false;
  const cardEl = $el('fc-card');
  if (cardEl) removeClass(cardEl, 'fc-card--flipped');

  // Always hide tutor panel when moving to a new card
  const tutorPanel = $el('fc-tutor-panel');
  if (tutorPanel) {
    hide(tutorPanel);
    const tutorText    = $el('fc-tutor-text');
    const tutorLoading = $el('fc-tutor-loading');
    setText(tutorText, '');
    show(tutorLoading);
  }
  if (window._fcTutorAbort) {
    window._fcTutorAbort.abort();
    window._fcTutorAbort = null;
  }

  const q = $el('fc-card-question');
  const a = $el('fc-card-answer');
  setText(q, card.front || card.question || '');
  setText(a, card.back  || card.answer   || '');

  const total   = fc.deck.length;
  const current = fc.index + 1;
  const pct     = (current / total) * 100;

  const labelEl = $el('fc-card-label');
  const fillEl  = $el('fc-progress-fill');
  const statsEl = $el('fc-progress-stats');
  setText(labelEl, `Card ${current} of ${total}`);
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (statsEl) {
    const { easy, ok, hard } = fc.stats;
    const rated = easy + ok + hard;
    setText(statsEl, rated ? `${easy} easy · ${ok} ok · ${hard} hard` : '');
  }

  const hint    = $el('fc-pre-flip-hint');
  const ratings = $el('fc-rating-row');
  show(hint);
  hide(ratings);
}

// ── Flip ────────────────────────────────────────────────────────────────────

export function _fcFlip() {
  fc.flipped = !fc.flipped;

  _fcSound.flip();

  const cardEl = $el('fc-card');
  toggleClass(cardEl, 'fc-card--flipped', fc.flipped);

  const hint    = $el('fc-pre-flip-hint');
  const ratings = $el('fc-rating-row');
  if (hint)    hint.style.display    = fc.flipped ? 'none' : '';
  if (ratings) ratings.style.display = fc.flipped ? ''     : 'none';
}

// ── Sound engine (Web Audio API) ────────────────────────────────────────────

export const _fcSound = (() => {
  let _ctx = null;
  let _muted = false;

  function _getCtx() {
    if (!_ctx) {
      try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e) { return null; }
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  function _play(type, freq, duration, volume = 0.3, freqEnd = null, delay = 0) {
    if (_muted) return;
    const ctx = _getCtx();
    if (!ctx) return;

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + delay + duration);

    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  }

  return {
    easy() {
      _play('sine', 523, 0.12, 0.25);
      _play('sine', 784, 0.18, 0.3,  880, 0.1);
      _play('sine', 1047, 0.22, 0.28, null, 0.22);
    },
    ok() {
      _play('sine', 440, 0.15, 0.2, 466, 0);
    },
    hard() {
      _play('triangle', 180, 0.18, 0.15, 140, 0);
      _play('sine',     220, 0.12, 0.12, null, 0.05);
    },
    combo() {
      _play('sine', 523,  0.1,  0.2, null, 0);
      _play('sine', 659,  0.1,  0.2, null, 0.08);
      _play('sine', 784,  0.1,  0.2, null, 0.16);
      _play('sine', 1047, 0.18, 0.3, null, 0.24);
    },
    complete() {
      _play('sine', 523,  0.12, 0.25, null, 0);
      _play('sine', 659,  0.12, 0.25, null, 0.1);
      _play('sine', 784,  0.12, 0.25, null, 0.2);
      _play('sine', 1047, 0.12, 0.25, null, 0.3);
      _play('sine', 1319, 0.3,  0.5,  null, 0.42);
    },
    flip() {
      _play('sine', 800, 0.04, 0.06, 600, 0);
    },
    mute()    { _muted = true;  },
    unmute()  { _muted = false; },
    toggle()  { _muted = !_muted; return _muted; },
    isMuted() { return _muted; },
  };
})();

// ── Advance / Next ──────────────────────────────────────────────────────────

export function _fcNext(rating) {
  if (!fc.flipped && rating !== 'skipped') {
    _fcFlip();
    return;
  }

  const card = fc.deck[fc.index];
  fc.ratings.push({ card_id: card?.id || null, rating });
  if (rating !== 'skipped') fc.stats[rating] = (fc.stats[rating] || 0) + 1;

  if (rating === 'easy')      _fcSound.easy();
  else if (rating === 'ok')   _fcSound.ok();
  else if (rating === 'hard') {
    _fcSound.hard();
    if (_fcHardBoostActive() && card) {
      fc.deck.push({ ...card, _boostedReview: true });
    }
  }

  const rated = (fc.stats.easy || 0) + (fc.stats.ok || 0) + (fc.stats.hard || 0);
  if (rated > 0 && rated % 5 === 0 && rating !== 'skipped') {
    setTimeout(() => _fcSound.combo(), 180);
  }

  if (rating === 'hard' && card) {
    _fcShowTutor(card);
    return;
  }

  _fcAdvance();
}

export function _fcAdvance() {
  fc.index++;
  if (fc.index >= fc.deck.length) {
    _fcFinishSession();
  } else {
    _fcRenderCard();
  }
}

// ── AI Tutor ────────────────────────────────────────────────────────────────

export function _fcDismissTutor() {
  const panel = $el('fc-tutor-panel');
  if (panel) {
    hide(panel);
    removeClass(panel, 'fc-tutor-visible');
  }
  if (window._fcTutorAbort) {
    window._fcTutorAbort.abort();
    window._fcTutorAbort = null;
  }
  _fcAdvance();
}

export async function _fcShowTutor(card) {
  const panel   = $el('fc-tutor-panel');
  const loading = $el('fc-tutor-loading');
  const text    = $el('fc-tutor-text');
  if (!panel || !loading || !text) { _fcAdvance(); return; }

  show(panel);
  show(loading);
  hide(text);
  setText(text, '');

  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);

  if (window._fcTutorAbort) window._fcTutorAbort.abort();
  window._fcTutorAbort = new AbortController();

  try {
    const prompt = `A student just marked this flashcard as HARD (they struggled with it).

Question: ${card.front || card.question || ''}
Correct Answer: ${card.back || card.answer || ''}

Give a brief, helpful explanation in 2-3 sentences:
1. Why the answer is correct (the key concept to remember)
2. What students commonly confuse or get wrong about this
3. One quick memory trick or mnemonic if possible

Be warm, encouraging, and concise. No bullet points — write naturally like a tutor talking to a student.`;

    const res = await fetch(`${window.API_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await window._getAuthHeader?.() ?? {} },
      signal: window._fcTutorAbort.signal,
      body: JSON.stringify({
        question:   prompt,
        mode:       'study',
        task_type:  'flashcard_tutor',
        ...(() => { const p = _aiParams(5); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(),
        bookId:     'none',
      }),
    });

    const data = await res.json();
    const explanation = data.answer || data.response || '';

    if (explanation) {
      hide(loading);
      show(text);
      setText(text, '');
      const words = explanation.split(' ');
      let i = 0;
      const typeInterval = setInterval(() => {
        if (i >= words.length) { clearInterval(typeInterval); return; }
        text.textContent += (i > 0 ? ' ' : '') + words[i];
        i++;
      }, 40);
    } else {
      _fcDismissTutor();
    }

  } catch (err) {
    if (err.name === 'AbortError') return;
    console.warn('[flashState] tutor error:', err.message);
    const panel = $el('fc-tutor-panel');
    hide(panel);
    _fcAdvance();
  }
}
