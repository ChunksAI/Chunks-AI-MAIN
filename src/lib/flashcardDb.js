/**
 * src/lib/flashcardDb.js — Flashcard persistence layer
 *
 * Extracted from the monolith (Task 33).
 * Handles saving/loading flashcard decks, cards, and study sessions —
 * using Supabase when logged in, falling back to localStorage always.
 *
 * Depends on:
 *   window.ChunksDB      (lib/chunksDb.js  — Task 31)
 *   window._getChunksSb  (lib/supabase.js  — Task 11)
 *   window._fcDeck, window._fcStats, etc. (state/flashState.js — Task 17)
 *
 * Usage (module):
 *   import { _fcSaveDeck, _fcLoadDecks, _fcSaveSession } from './lib/flashcardDb.js';
 *
 * Usage (legacy global — still works):
 *   _fcSaveDeck(topic, cards);   // window.* aliases set below
 */

/* ────────────────────────────────────────────────
   CONSTANTS
──────────────────────────────────────────────── */

export const FC_LS_KEY          = 'chunks_fc_decks_v1';
export const FC_SESSIONS_LS_KEY = 'chunks_fc_sessions_v1';

/* ────────────────────────────────────────────────
   DECK — SAVE
──────────────────────────────────────────────── */

/** Save a newly-generated deck to localStorage + Supabase (if logged in) */
export async function _fcSaveDeck(topic, cards) {
  const deck = {
    id:         crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
    name:       topic,
    card_count: cards.length,
    cards:      cards,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // ALWAYS write to localStorage immediately — instant cache, works offline
  _fcSaveDeckLocal(deck);

  // Then attempt Supabase if logged in
  if (window.ChunksDB.isLoggedIn()) {
    const { data: deckRow, error: deckErr } = await window.ChunksDB.insert('fc_decks', {
      name:       deck.name,
      card_count: deck.card_count,
    });
    if (deckErr || !deckRow) {
      console.warn('[FC] Deck insert failed, localStorage copy retained', deckErr);
    } else {
      window._fcCurrentDeckId = deckRow.id;
      // Patch the localStorage copy with the real Supabase id
      _fcPatchLocalDeckId(deck.name, deckRow.id);
      const cardRows = cards.map(c => ({
        deck_id: deckRow.id,
        front:   c.question || c.front || '',
        back:    c.answer   || c.back  || '',
      }));
      await Promise.all(cardRows.map(r => window.ChunksDB.insert('fc_cards', r)));
      console.log('[FC] Deck saved to Supabase:', deckRow.id);
    }
  }

  await _fcRenderDeckList();
}

/** Write deck to localStorage only (always called, even when saving to Supabase) */
export function _fcSaveDeckLocal(deck) {
  const decks    = window.ChunksDB.lsGet(FC_LS_KEY, []);
  const filtered = decks.filter(d => d.name !== deck.name);
  filtered.unshift(deck);
  window.ChunksDB.lsSet(FC_LS_KEY, filtered.slice(0, 30));
}

/** Patch the local deck entry with its real Supabase uuid once we get it back */
export function _fcPatchLocalDeckId(name, supabaseId) {
  const decks   = window.ChunksDB.lsGet(FC_LS_KEY, []);
  const patched = decks.map(d => d.name === name ? { ...d, id: supabaseId } : d);
  window.ChunksDB.lsSet(FC_LS_KEY, patched);
}

/* ────────────────────────────────────────────────
   DECK — LOAD
──────────────────────────────────────────────── */

/**
 * Load all decks — merge Supabase + localStorage, dedupe by name.
 * Supabase is source of truth; local-only decks (offline / pre-login) are appended.
 * Write-back caches Supabase result to localStorage for instant next-render.
 */
export async function _fcLoadDecks() {
  const localDecks = window.ChunksDB.lsGet(FC_LS_KEY, []);

  if (window.ChunksDB.isLoggedIn()) {
    try {
      const { data, error } = await window.ChunksDB.get('fc_decks', {
        order: { col: 'created_at', asc: false },
        limit: 30,
      });
      if (!error && data?.length) {
        const sbNames  = new Set(data.map(d => d.name));
        const localOnly = localDecks.filter(d => !sbNames.has(d.name));
        const merged   = [...data, ...localOnly];
        // Write-back: cache so next render is instant
        window.ChunksDB.lsSet(FC_LS_KEY, merged.slice(0, 30));
        return merged;
      }
    } catch(e) {
      console.warn('[FC] Supabase deck load error:', e.message);
    }
    // Supabase failed — fall back to localStorage so refresh never blanks
    return localDecks;
  }

  return localDecks;
}

/** Load cards for a specific deck (Supabase → localStorage fallback) */
export async function _fcLoadCards(deck) {
  if (window.ChunksDB.isLoggedIn()) {
    const deckId = deck.id;
    const { data, error } = await window.ChunksDB.get('fc_cards', { eq: { deck_id: deckId } });
    if (!error && data?.length) {
      // Write-back: cache cards onto deck in localStorage
      const decks   = window.ChunksDB.lsGet(FC_LS_KEY, []);
      const patched = decks.map(d => d.id === deckId ? { ...d, cards: data } : d);
      window.ChunksDB.lsSet(FC_LS_KEY, patched);
      return data;
    }
  }
  return deck.cards || [];
}

/* ────────────────────────────────────────────────
   DECK LIST UI
──────────────────────────────────────────────── */

/** Render the saved-decks list in the flashcard sidebar */
export async function _fcRenderDeckList() {
  const list  = document.getElementById('fc-saved-decks-list');
  const count = document.getElementById('fc-deck-count');
  if (!list) return;

  list.innerHTML = '<div class="recent-empty" style="font-size:11px;color:var(--text-4);padding:6px 8px;">Loading…</div>';
  const decks = await _fcLoadDecks();
  if (count) count.textContent = decks.length ? `${decks.length}` : '';

  if (!decks.length) {
    list.innerHTML = '<div class="recent-empty">No saved decks yet</div>';
    return;
  }

  // Load last session for each deck in parallel
  const lastSessions = await Promise.all(
    decks.map(d => _fcGetLastSession(d.id, d.name).catch(() => null))
  );

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
    item.onmouseenter = () => { item.style.background = 'var(--surface-2)'; };
    item.onmouseleave = () => { item.style.background = ''; };
    list.appendChild(item);
  });
}

/** Human-readable relative time helper */
export function _fcTimeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 2)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** Load a saved deck into the study view */
export async function _fcLoadDeckIntoStudy(deck) {
  const cards = await _fcLoadCards(deck);
  if (!cards.length) {
    window.wsShowToast?.('⚠', 'No cards found in this deck', '#f87171');
    return;
  }
  // Normalize to front/back; preserve card DB id for per-card session rating
  window._fcDeck = cards.map(c => ({
    id:    c.id    || null,
    front: c.front || c.question || '',
    back:  c.back  || c.answer   || '',
  }));
  window._fcCurrentDeckId = deck.id || null;
  window._fcDeckTopic     = deck.name;
  window._fcIndex         = 0;
  window._fcStats         = { easy: 0, ok: 0, hard: 0, skipped: 0 };
  window._fcCardRatings   = [];
  window._fcUpdateStats?.();
  window._fcRenderCard?.();
  window.wsShowToast?.('🃏', `Loaded "${deck.name}"`, 'var(--violet-border)');
}

/* ────────────────────────────────────────────────
   SESSIONS — SRS + SAVE
──────────────────────────────────────────────── */

/**
 * SM-2 simplified rating → SRS factor mapping:
 *   easy → ease up,   interval doubles
 *   ok   → ease same, interval × 1.5
 *   hard → ease down, interval resets to 1
 *   skip → no change
 */
export function _fcRatingToSRS(rating, prev = {}) {
  const ease  = prev.ease_factor   ?? 2.5;
  const reps  = prev.repetitions   ?? 0;
  const inter = prev.interval_days ?? 1;

  if (rating === 'easy') return {
    ease_factor:   Math.min(ease + 0.15, 3.0),
    interval_days: Math.max(Math.round(inter * 2), 2),
    repetitions:   reps + 1,
    last_reviewed: new Date().toISOString(),
    next_review:   new Date(Date.now() + Math.max(Math.round(inter * 2), 2) * 86400000).toISOString(),
  };
  if (rating === 'ok') return {
    ease_factor:   ease,
    interval_days: Math.max(Math.round(inter * 1.5), 1),
    repetitions:   reps + 1,
    last_reviewed: new Date().toISOString(),
    next_review:   new Date(Date.now() + Math.max(Math.round(inter * 1.5), 1) * 86400000).toISOString(),
  };
  // hard
  return {
    ease_factor:   Math.max(ease - 0.2, 1.3),
    interval_days: 1,
    repetitions:   reps + 1,
    last_reviewed: new Date().toISOString(),
    next_review:   new Date(Date.now() + 86400000).toISOString(),
  };
}

/**
 * Save a completed study session:
 *  - Upserts per-card SRS progress into fc_progress (Supabase, if logged in)
 *  - Saves session aggregate to localStorage for the sidebar score pill
 */
export async function _fcSaveSession() {
  const total   = window._fcDeck?.length ?? 0;
  const easy    = window._fcStats?.easy    || 0;
  const ok      = window._fcStats?.ok      || 0;
  const hard    = window._fcStats?.hard    || 0;
  const skipped = window._fcStats?.skipped || 0;

  const session = {
    id:         crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
    deck_id:    window._fcCurrentDeckId || null,
    deck_name:  window._fcDeckTopic     || 'Untitled',
    easy, ok, hard, skipped, total,
    studied_at: new Date().toISOString(),
  };

  // Always save aggregate locally — sidebar pill reads this
  _fcSaveSessionLocal(session);

  // Upsert per-card SRS data (only for cards with a Supabase id)
  if (window.ChunksDB.isLoggedIn() && window._fcCurrentDeckId) {
    const ratableCards = (window._fcCardRatings || []).filter(r => r.card_id && r.rating !== 'skipped');
    if (ratableCards.length) {
      try {
        await Promise.all(ratableCards.map(r => {
          const srs = _fcRatingToSRS(r.rating);
          return window.ChunksDB.upsert('fc_progress', {
            card_id: r.card_id,
            deck_id: window._fcCurrentDeckId,
            ...srs,
          }, 'user_id,card_id');
        }));
        console.log(`[FC] Progress upserted for ${ratableCards.length} cards`);
      } catch(e) {
        console.warn('[FC] Progress upsert error:', e.message);
      }
    }
  }

  // Refresh sidebar score pill
  _fcRenderDeckList().catch(() => {});
}

/** Write session aggregate to localStorage */
export function _fcSaveSessionLocal(session) {
  const sessions = window.ChunksDB.lsGet(FC_SESSIONS_LS_KEY, []);
  // Always keep only the latest entry per deck
  const filtered = sessions.filter(s =>
    s.deck_id !== session.deck_id && s.deck_name !== session.deck_name
  );
  filtered.unshift(session);
  window.ChunksDB.lsSet(FC_SESSIONS_LS_KEY, filtered.slice(0, 100));
}

/**
 * Get the most recent session for a deck (used by sidebar score pill).
 * Reads localStorage first (fast, offline). Falls back to fc_progress
 * for cross-device sync if logged in.
 */
export async function _fcGetLastSession(deckId, deckName) {
  // 1. localStorage first
  const sessions = window.ChunksDB.lsGet(FC_SESSIONS_LS_KEY, []);
  const local    = sessions.find(s => s.deck_id === deckId || s.deck_name === deckName);
  if (local) return local;

  // 2. Cross-device fallback: derive score from fc_progress rows
  if (window.ChunksDB.isLoggedIn() && deckId) {
    try {
      const { data, error } = await window.ChunksDB.get('fc_progress', {
        eq:    { deck_id: deckId },
        limit: 100,
      });
      if (!error && data?.length) {
        const total  = data.length;
        const easy   = data.filter(c => c.ease_factor >= 2.5 && c.repetitions > 0).length;
        const hard   = data.filter(c => c.ease_factor <  2.5 && c.repetitions > 0).length;
        const latest = data.reduce((a, b) =>
          (a.last_reviewed || '') > (b.last_reviewed || '') ? a : b, data[0]);
        return {
          deck_id:    deckId,
          deck_name:  deckName,
          easy, ok: 0, hard, skipped: 0, total,
          studied_at: latest.last_reviewed || null,
        };
      }
    } catch(e) { /* silent */ }
  }
  return null;
}

/* ────────────────────────────────────────────────
   SCREEN INIT
──────────────────────────────────────────────── */

export async function _fcInitScreen() {
  await _fcRenderDeckList();
}

/* ────────────────────────────────────────────────
   DOM BOOTSTRAP
   Re-render deck list when auth state changes or
   if the flash screen is the active landing screen.
──────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // If flash is the landing screen, render from localStorage immediately
  // then re-fetch from Supabase once auth is ready
  if (sessionStorage.getItem('chunks_active_screen') === 'flash') {
    _fcRenderDeckList().catch(() => {});
    setTimeout(_fcInitScreen, 1400);
  }

  // Hook Supabase auth changes → refresh deck list after sign-in
  const _waitForSb = setInterval(async () => {
    const sb = await window._getChunksSb().catch(() => null);
    if (!sb) return;
    clearInterval(_waitForSb);
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setTimeout(() => _fcRenderDeckList().catch(() => {}), 800);
      }
    });
  }, 200);
});

/* ────────────────────────────────────────────────
   WINDOW GLOBALS (backward compat)
──────────────────────────────────────────────── */

window._fcSaveDeck           = _fcSaveDeck;
window._fcSaveDeckLocal      = _fcSaveDeckLocal;
window._fcPatchLocalDeckId   = _fcPatchLocalDeckId;
window._fcLoadDecks          = _fcLoadDecks;
window._fcLoadCards          = _fcLoadCards;
window._fcRenderDeckList     = _fcRenderDeckList;
window._fcTimeAgo            = _fcTimeAgo;
window._fcLoadDeckIntoStudy  = _fcLoadDeckIntoStudy;
window._fcRatingToSRS        = _fcRatingToSRS;
window._fcSaveSession        = _fcSaveSession;
window._fcSaveSessionLocal   = _fcSaveSessionLocal;
window._fcGetLastSession     = _fcGetLastSession;
window._fcInitScreen         = _fcInitScreen;

console.log('[FlashcardDb] Persistence layer ready');
