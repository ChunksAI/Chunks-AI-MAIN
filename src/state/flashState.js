/**
 * src/state/flashState.js — Flashcard state
 *
 * Owns all flashcard screen logic:
 *  • Deck state (_fcDeck, _fcIndex, _fcStats, _fcCardRatings)
 *  • Card rendering and skeleton
 *  • Deck list sidebar rendering
 *  • wsMakeFlashcard — workspace "Make Flashcard" button
 *  • _fcGenerateFromBar — flashcard screen generator bar
 *
 * Persistence is delegated to lib/flashcardDb.js (Task 33).
 *
 * Task 17 — extracted from monolith:
 *   wsMakeFlashcard / _fcRenderCard / _fcNext etc → monolith lines ~8451–8770
 *   FC persistence block → index.html lines ~5293–5654
 *   _fc* state vars → index.html lines ~2998–3003
 * Task 33 — Persistence extracted to lib/flashcardDb.js
 */

import { API_BASE } from '../lib/api.js';
import {
  FC_LS_KEY,
  FC_SESSIONS_LS_KEY,
  fcRatingToSRS,
  fcSaveDeck,
  fcLoadDecks,
  fcLoadCards,
  fcSaveSession,
  fcGetLastSession,
} from '../lib/flashcardDb.js';

// ── Deck state ─────────────────────────────────────────────────────────────

export let _fcDeck          = [];
export let _fcDeckTopic     = '';
export let _fcCurrentDeckId = null;
export let _fcIndex         = 0;
export let _fcStats         = { easy: 0, ok: 0, hard: 0, skipped: 0 };
export let _fcCardRatings   = [];

// ── Storage keys ───────────────────────────────────────────────────────────
// Re-exported from lib/flashcardDb.js for any module that imported them here.
export { FC_LS_KEY, FC_SESSIONS_LS_KEY };

// ── Card rendering ─────────────────────────────────────────────────────────

export function _fcRenderCard() {
  if (!_fcDeck.length) return;
  const card  = _fcDeck[_fcIndex];
  const total = _fcDeck.length;

  const wrap = document.getElementById('flashCard');
  if (wrap) wrap.classList.remove('flipped');
  // Reset navigation.js cardFlipped tracker
  if (typeof window !== 'undefined') window.cardFlipped = false;

  const qEl = document.getElementById('flash-question');
  if (qEl) qEl.textContent = card.front || card.question || '';

  const aEl      = document.getElementById('flash-answer');
  const backText = card.back || card.answer || '';
  if (aEl) {
    aEl.innerHTML = (typeof sanitize === 'function' ? sanitize : s => s)(
      backText.replace(/\$([^$]+)\$/g,
        '<code style="font-family:var(--font-mono);font-size:12px;background:var(--surface-3);border:1px solid var(--border-xs);padding:1px 5px;border-radius:4px;color:var(--teal);">$1</code>')
    );
  }

  const countText = `${_fcIndex + 1} / ${total}`;
  const countEl = document.getElementById('flash-count-label');
  const fillEl  = document.getElementById('flash-progress-fill');
  const mobileCount = document.getElementById('flash-mobile-count');
  if (countEl) countEl.textContent = countText;
  if (fillEl)  fillEl.style.width  = `${((_fcIndex + 1) / total) * 100}%`;
  if (mobileCount) mobileCount.textContent = countText;

  const titleEl = document.getElementById('flash-deck-title');
  if (titleEl && _fcDeckTopic) titleEl.textContent = _fcDeckTopic;

  const hint = document.getElementById('flipHint');
  if (hint) { hint.textContent = 'Click the card or press Space to reveal the answer'; hint.style.opacity = '1'; }

  document.querySelectorAll('.flash-btn.hard, .flash-btn.ok, .flash-btn.easy').forEach(btn => {
    btn.disabled           = true;
    btn.style.opacity      = '0.38';
    btn.style.pointerEvents = 'none';
  });

  _fcUpdateStats();
}

export function _fcUpdateStats() {
  const easy    = document.getElementById('stat-easy');
  const ok      = document.getElementById('stat-ok');
  const hard    = document.getElementById('stat-hard');
  const skipped = document.getElementById('stat-skipped');
  if (easy)    easy.textContent    = _fcStats.easy    || 0;
  if (ok)      ok.textContent      = _fcStats.ok      || 0;
  if (hard)    hard.textContent    = _fcStats.hard    || 0;
  if (skipped) skipped.textContent = _fcStats.skipped || 0;
}

// ── Navigation & rating ────────────────────────────────────────────────────

export function _fcNext(rating) {
  if (!_fcDeck.length) return;
  const card           = _fcDeck[_fcIndex];
  const resolvedRating = (['easy','ok','hard'].includes(rating)) ? rating : 'skipped';

  _fcCardRatings.push({ front: card.front || card.question || '', card_id: card.id || null, rating: resolvedRating });

  if (resolvedRating !== 'skipped') {
    _fcStats[resolvedRating] = (_fcStats[resolvedRating] || 0) + 1;
  } else {
    _fcStats.skipped = (_fcStats.skipped || 0) + 1;
  }
  _fcIndex++;

  if (_fcIndex >= _fcDeck.length) { _fcShowCompleteModal(); return; }
  _fcRenderCard();
}

export function _fcShowCompleteModal() {
  const total = _fcDeck.length;
  const easy  = _fcStats.easy  || 0;
  const ok    = _fcStats.ok    || 0;
  const hard  = _fcStats.hard  || 0;

  document.getElementById('fc-modal-easy').textContent  = easy;
  document.getElementById('fc-modal-ok').textContent    = ok;
  document.getElementById('fc-modal-hard').textContent  = hard;
  document.getElementById('fc-complete-subtitle').textContent =
    `You reviewed all ${total} card${total !== 1 ? 's' : ''} in "${_fcDeckTopic || 'this deck'}".`;

  document.getElementById('fc-complete-modal').style.display = 'flex';
  fcSaveSession({
    deckId:      _fcCurrentDeckId,
    deckName:    _fcDeckTopic,
    stats:       _fcStats,
    cardRatings: _fcCardRatings,
    deck:        _fcDeck,
  }).catch(e => console.warn('[FC] Session save failed:', e));
}

export function _fcRestartDeck() {
  document.getElementById('fc-complete-modal').style.display = 'none';
  _fcIndex       = 0;
  _fcStats       = { easy: 0, ok: 0, hard: 0, skipped: 0 };
  _fcCardRatings = [];
  _fcUpdateStats();
  _fcRenderCard();
}

export function _fcCreateNew() {
  document.getElementById('fc-complete-modal').style.display = 'none';
  const input = document.getElementById('fc-gen-input');
  if (input) { input.value = ''; input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}

// ── Skeleton ───────────────────────────────────────────────────────────────

export function _fcShowSkeleton(topic) {
  const front = document.getElementById('flash-face-front');
  const back  = document.getElementById('flash-face-back');
  const card  = document.getElementById('flashCard');
  const hint  = document.getElementById('flipHint');
  if (front) front.innerHTML = `
    <span class="flash-tag">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      Generating…
    </span>
    <div style="display:flex;flex-direction:column;gap:10px;width:100%;margin-top:12px;">
      <div class="skeleton-line" style="height:13px;width:85%;animation-delay:0s;"></div>
      <div class="skeleton-line" style="height:13px;width:65%;animation-delay:0.1s;"></div>
      <div class="skeleton-line" style="height:13px;width:75%;animation-delay:0.2s;"></div>
    </div>
    <div style="margin-top:auto;font-size:11px;color:var(--text-4);">Building deck for "${topic}"…</div>`;
  if (back) back.innerHTML = `
    <span class="flash-tag" style="color:var(--gold);background:var(--gold-muted);border-color:var(--gold-border);">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
      Answer
    </span>
    <div style="display:flex;flex-direction:column;gap:10px;width:100%;margin-top:12px;">
      <div class="skeleton-line" style="height:13px;width:90%;animation-delay:0.05s;"></div>
      <div class="skeleton-line" style="height:13px;width:70%;animation-delay:0.15s;"></div>
    </div>`;
  if (card) { card.style.pointerEvents = 'none'; card.classList.remove('flipped'); }
  if (hint) hint.style.opacity = '0';
}

export function _fcClearSkeleton() {
  const front = document.getElementById('flash-face-front');
  const back  = document.getElementById('flash-face-back');
  if (front) front.innerHTML = `
    <span class="flash-tag" id="flash-tag-front">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      <span id="flash-tag-text">Question</span>
    </span>
    <p class="flash-q" id="flash-question"></p>
    <div class="flash-source" id="flash-source-front" style="opacity:0;"></div>`;
  if (back) back.innerHTML = `
    <span class="flash-tag" style="color:var(--gold);background:var(--gold-muted);border-color:var(--gold-border);">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
      Answer
    </span>
    <div class="flash-a" id="flash-answer">—</div>`;
  const card = document.getElementById('flashCard');
  if (card) card.style.pointerEvents = '';
  const hint = document.getElementById('flipHint');
  if (hint) hint.style.opacity = '1';
}

// ── SRS calculation → lib/flashcardDb.js (Task 33) ────────────────────────
// Re-export for any legacy callers that imported _fcRatingToSRS from here.
export { fcRatingToSRS as _fcRatingToSRS };

// ── Persistence → lib/flashcardDb.js (Task 33) ────────────────────────────

// Persistence functions removed — all moved to lib/flashcardDb.js (Task 33).
// Re-export underscore-prefixed aliases so any external callers keep working.
export {
  fcSaveDeck        as _fcSaveDeck,
  fcLoadDecks       as _fcLoadDecks,
  fcLoadCards       as _fcLoadCards,
  fcSaveSession     as _fcSaveSession,
  fcGetLastSession  as _fcGetLastSession,
};

// ── Deck list sidebar ──────────────────────────────────────────────────────

export function _fcTimeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export async function _fcRenderDeckList() {
  const list  = document.getElementById('fc-saved-decks-list');
  const count = document.getElementById('fc-deck-count');
  if (!list) return;

  list.innerHTML = '<div class="recent-empty" style="font-size:11px;color:var(--text-4);padding:6px 8px;">Loading…</div>';
  const decks = await fcLoadDecks();
  if (count) count.textContent = decks.length ? `${decks.length}` : '';

  if (!decks.length) { list.innerHTML = '<div class="recent-empty">No saved decks yet</div>'; return; }

  const lastSessions = await Promise.all(decks.map(d => fcGetLastSession(d.id, d.name).catch(() => null)));

  list.innerHTML = '';
  decks.forEach((deck, i) => {
    const last = lastSessions[i];
    let scorePill = '';
    if (last && last.total > 0) {
      const pct   = Math.round(((last.easy + last.ok) / last.total) * 100);
      const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--red)';
      const ago   = _fcTimeAgo(last.studied_at);
      scorePill   = `<span style="font-size:9px;padding:1px 6px;border-radius:var(--r-pill);background:${color}22;color:${color};border:1px solid ${color}44;flex-shrink:0;">${pct}%</span>`;
      scorePill  += `<span style="font-size:9px;color:var(--text-4);flex-shrink:0;">${ago}</span>`;
    }
    const item = document.createElement('div');
    item.className = 'recent-item';
    item.style.cssText = 'cursor:pointer;display:flex;flex-direction:column;gap:3px;padding:6px 8px;border-radius:8px;transition:background 0.1s;';
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;color:var(--violet);"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${deck.name || 'Untitled'}</span>
        <span style="font-size:10px;color:var(--text-4);flex-shrink:0;">${deck.card_count || '?'}</span>
      </div>
      ${scorePill ? `<div style="display:flex;align-items:center;gap:5px;padding-left:19px;">${scorePill}</div>` : ''}`;
    item.onclick      = () => _fcLoadDeckIntoStudy(deck);
    item.onmouseenter = () => item.style.background = 'var(--surface-2)';
    item.onmouseleave = () => item.style.background = '';
    list.appendChild(item);
  });
}

export async function _fcLoadDeckIntoStudy(deck) {
  const cards = await fcLoadCards(deck);
  if (!cards.length) { if (typeof wsShowToast === 'function') wsShowToast('⚠', 'No cards found in this deck', '#f87171'); return; }
  _fcDeck          = cards.map(c => ({ id: c.id || null, front: c.front || c.question || '', back: c.back || c.answer || '' }));
  _fcCurrentDeckId = deck.id || null;
  _fcDeckTopic     = deck.name;
  _fcIndex         = 0;
  _fcStats         = { easy: 0, ok: 0, hard: 0, skipped: 0 };
  _fcCardRatings   = [];
  _fcUpdateStats();
  _fcRenderCard();
  if (typeof wsShowToast === 'function') wsShowToast('🃏', `Loaded "${deck.name}"`, 'var(--violet-border)');
}

export async function _fcInitScreen() {
  await _fcRenderDeckList();
}

// ── wsMakeFlashcard ────────────────────────────────────────────────────────

export async function wsMakeFlashcard(btn, msgId, question) {
  if (btn.classList.contains('loading')) return;
  btn.classList.add('loading');
  btn.innerHTML = `<div class="hc-thinking" style="display:inline-flex;gap:3px;"><span></span><span></span><span></span></div> Generating…`;

  const topic = (question || document.getElementById(msgId)?.querySelector('.ai-text')?.innerText?.slice(0, 120) || 'this topic').trim();

  try {
    const res = await fetch(`${API_BASE}/generate-flashcards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, bookId: window._wsBookId || 'atkins', count: 10 }),
    });
    const data = await res.json();
    if (!data.success || !data.flashcards?.length) throw new Error(data.error || 'No cards returned');

    _fcDeck          = data.flashcards;
    _fcDeckTopic     = topic;
    _fcCurrentDeckId = null;
    _fcIndex         = 0;
    _fcStats         = { easy: 0, ok: 0, hard: 0, skipped: 0 };
    _fcCardRatings   = [];
    _fcClearSkeleton();
    _fcRenderCard();

    if (typeof wsShowToast === 'function') wsShowToast('🃏', `${data.flashcards.length} flashcards generated!`, 'var(--gold-border)');
    setTimeout(() => { if (typeof showScreen === 'function') showScreen('flash'); }, 600);

    const savedDeck = await fcSaveDeck(topic, data.flashcards);
    _fcCurrentDeckId = savedDeck.id || null;
    await _fcRenderDeckList();

  } catch (e) {
    if (typeof wsShowToast === 'function') wsShowToast('⚠', 'Could not generate flashcards', '#f87171');
    console.error(e);
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg> Make Flashcard`;
  }
}

// ── Generate from flashcard screen bar ────────────────────────────────────

export async function _fcGenerateFromBar() {
  const input = document.getElementById('fc-gen-input') || document.querySelector('.gen-input');
  const topic = input?.value?.trim();
  if (!topic) return;
  const btn = document.getElementById('gen-btn') || document.querySelector('.gen-btn');
  if (btn) { btn.textContent = 'Generating…'; btn.disabled = true; }

  _fcShowSkeleton(topic);

  try {
    const res = await fetch(`${API_BASE}/generate-flashcards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, bookId: window._wsBookId || null, count: 10 }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    if (!data.success || !data.flashcards?.length) throw new Error(data.error || 'No cards returned');

    _fcDeck          = data.flashcards;
    _fcDeckTopic     = topic;
    _fcCurrentDeckId = null;
    _fcIndex         = 0;
    _fcStats         = { easy: 0, ok: 0, hard: 0, skipped: 0 };
    _fcCardRatings   = [];
    _fcClearSkeleton();
    _fcUpdateStats();
    _fcRenderCard();
    if (input) input.value = '';
    if (typeof wsShowToast === 'function') wsShowToast('🃏', `${data.flashcards.length} cards generated!`, 'var(--gold-border)');

    const savedDeck = await fcSaveDeck(topic, data.flashcards);
    _fcCurrentDeckId = savedDeck.id || null;
    await _fcRenderDeckList();

  } catch (e) {
    console.error('Flashcard generation error:', e);
    _fcClearSkeleton();
    const front = document.getElementById('flash-face-front');
    if (front) front.innerHTML = `
      <span class="flash-tag" id="flash-tag-front">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <span id="flash-tag-text">Question</span>
      </span>
      <p class="flash-q" id="flash-question">Generation failed. Try again.</p>
      <div class="flash-source" id="flash-source-front" style="opacity:0;"></div>`;
    if (typeof wsShowToast === 'function') wsShowToast('⚠', `Generation failed: ${e.message}`, '#f87171');
  } finally {
    if (btn) { btn.textContent = 'Generate with AI'; btn.disabled = false; }
  }
}

// ── Auth state listener ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('chunks_active_screen') === 'flash') {
    _fcRenderDeckList().catch(() => {});
    setTimeout(_fcInitScreen, 1400);
  }

  const _waitForSb = setInterval(async () => {
    const sb = await (window._getChunksSb?.() ?? Promise.resolve(null));
    if (!sb) return;
    clearInterval(_waitForSb);
    sb.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setTimeout(() => _fcRenderDeckList().catch(() => {}), 800);
      }
    });
  }, 200);
});

// ── Legacy global bridges ─────────────────────────────────────────────────
window.wsMakeFlashcard    = wsMakeFlashcard;
window._fcRenderCard      = _fcRenderCard;
window._fcUpdateStats     = _fcUpdateStats;
window._fcNext            = _fcNext;
window._fcRestartDeck     = _fcRestartDeck;
window._fcCreateNew       = _fcCreateNew;
window._fcShowSkeleton    = _fcShowSkeleton;
window._fcClearSkeleton   = _fcClearSkeleton;
// _fcSaveDeck → delegates to FlashcardDB.fcSaveDeck (Task 33)
window._fcSaveDeck        = (topic, cards) => fcSaveDeck(topic, cards);
window._fcRenderDeckList  = _fcRenderDeckList;
window._fcLoadDeckIntoStudy = _fcLoadDeckIntoStudy;
window._fcInitScreen      = _fcInitScreen;
window._fcGenerateFromBar = _fcGenerateFromBar;
// _fcSaveSession — bridge that bundles current module state for flashcardDb
window._fcSaveSession     = () => fcSaveSession({
  deckId:      _fcCurrentDeckId,
  deckName:    _fcDeckTopic,
  stats:       _fcStats,
  cardRatings: _fcCardRatings,
  deck:        _fcDeck,
});

// Expose mutable state accessors for legacy inline scripts
// (inline script blocks read/write these directly on window)
Object.defineProperty(window, '_fcDeck',         { get: () => _fcDeck,         set: v => { _fcDeck = v; },         configurable: true });
Object.defineProperty(window, '_fcDeckTopic',     { get: () => _fcDeckTopic,     set: v => { _fcDeckTopic = v; },     configurable: true });
Object.defineProperty(window, '_fcCurrentDeckId', { get: () => _fcCurrentDeckId, set: v => { _fcCurrentDeckId = v; }, configurable: true });
Object.defineProperty(window, '_fcIndex',         { get: () => _fcIndex,         set: v => { _fcIndex = v; },         configurable: true });
Object.defineProperty(window, '_fcStats',         { get: () => _fcStats,         set: v => { _fcStats = v; },         configurable: true });
Object.defineProperty(window, '_fcCardRatings',   { get: () => _fcCardRatings,   set: v => { _fcCardRatings = v; },   configurable: true });