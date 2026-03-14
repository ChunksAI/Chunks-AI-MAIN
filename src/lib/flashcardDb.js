/**
 * src/lib/flashcardDb.js — Task 33
 *
 * FlashcardDB — Flashcard Persistence Layer
 * All read/write operations for flashcard decks, cards, sessions,
 * and SRS progress. Uses ChunksDB (Supabase + localStorage) as its
 * backing store so flashState.js stays focused on UI/state concerns.
 *
 * Tables (Supabase):
 *   fc_decks    — one row per deck  { id, name, card_count }
 *   fc_cards    — one row per card  { id, deck_id, front, back }
 *   fc_sessions — one row per study session (local-only for now)
 *   fc_progress — SRS tracking     { card_id, deck_id, ease_factor, … }
 *
 * localStorage keys (fallback when not logged in):
 *   chunks_fc_decks_v1    — array of deck objects (with embedded cards)
 *   chunks_fc_sessions_v1 — array of session objects
 *
 * Exports:
 *   FC_LS_KEY, FC_SESSIONS_LS_KEY  — storage key constants
 *   fcSaveDeck(topic, cards)       — create & persist a new deck
 *   fcSaveDeckLocal(deck)          — localStorage-only save
 *   fcPatchLocalDeckId(name, id)   — back-fill Supabase id into ls
 *   fcLoadDecks()                  — merge Supabase + localStorage
 *   fcLoadCards(deck)              — load cards for a given deck
 *   fcSaveSession(state)           — persist end-of-session summary
 *   fcSaveSessionLocal(session)    — localStorage-only session save
 *   fcGetLastSession(deckId, name) — retrieve most recent session
 *   fcRatingToSRS(rating, prev)    — SM-2-style SRS calculation
 *
 * Window bridge:
 *   window.FlashcardDB — full public API
 */

import { ChunksDB } from './chunksDb.js';

// ── Storage keys ─────────────────────────────────────────────────────────────

export const FC_LS_KEY          = 'chunks_fc_decks_v1';
export const FC_SESSIONS_LS_KEY = 'chunks_fc_sessions_v1';

// ── Internal localStorage helpers ────────────────────────────────────────────
// These exist so the module works even before ChunksDB is fully initialised.

function _lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch (_) { return fallback; }
}

function _lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

// Prefer ChunksDB wrappers (they share the same implementation) but fall back
// gracefully during early module initialisation.
function lsGet(key, fallback = null) {
  return (window.ChunksDB?.lsGet ?? _lsGet)(key, fallback);
}

function lsSet(key, value) {
  return (window.ChunksDB?.lsSet ?? _lsSet)(key, value);
}

// ── SRS calculation ───────────────────────────────────────────────────────────

/**
 * SM-2-inspired spaced repetition calculation.
 * @param {'easy'|'ok'|'hard'} rating
 * @param {Object} prev — previous SRS fields (ease_factor, repetitions, interval_days)
 * @returns {Object} updated SRS fields
 */
export function fcRatingToSRS(rating, prev = {}) {
  const ease  = prev.ease_factor   ?? 2.5;
  const reps  = prev.repetitions   ?? 0;
  const inter = prev.interval_days ?? 1;
  const now   = new Date().toISOString();

  if (rating === 'easy') return {
    ease_factor:   Math.min(ease + 0.15, 3.0),
    interval_days: Math.max(Math.round(inter * 2), 2),
    repetitions:   reps + 1,
    last_reviewed: now,
    next_review:   new Date(Date.now() + Math.max(Math.round(inter * 2), 2) * 86400000).toISOString(),
  };

  if (rating === 'ok') return {
    ease_factor:   ease,
    interval_days: Math.max(Math.round(inter * 1.5), 1),
    repetitions:   reps + 1,
    last_reviewed: now,
    next_review:   new Date(Date.now() + Math.max(Math.round(inter * 1.5), 1) * 86400000).toISOString(),
  };

  // hard
  return {
    ease_factor:   Math.max(ease - 0.2, 1.3),
    interval_days: 1,
    repetitions:   reps + 1,
    last_reviewed: now,
    next_review:   new Date(Date.now() + 86400000).toISOString(),
  };
}

// ── Deck persistence ─────────────────────────────────────────────────────────

/**
 * Save a deck to localStorage and (if logged in) to Supabase.
 * Returns the deck object with its final id.
 * @param {string} topic
 * @param {Array}  cards
 * @returns {Promise<Object>} deck
 */
export async function fcSaveDeck(topic, cards) {
  const deck = {
    id:         crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
    name:       topic,
    card_count: cards.length,
    cards,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  fcSaveDeckLocal(deck);

  if (window.ChunksDB?.isLoggedIn()) {
    const { data: deckRow, error: deckErr } = await ChunksDB.insert('fc_decks', {
      name: deck.name, card_count: deck.card_count,
    });

    if (deckErr || !deckRow) {
      console.warn('[FlashcardDB] Deck insert failed, localStorage copy retained', deckErr);
    } else {
      deck.id = deckRow.id;
      fcPatchLocalDeckId(deck.name, deckRow.id);

      const cardRows = cards.map(c => ({
        deck_id: deckRow.id,
        front:   c.question || c.front || '',
        back:    c.answer   || c.back  || '',
      }));
      await Promise.all(cardRows.map(r => ChunksDB.insert('fc_cards', r)));
      console.log('[FlashcardDB] Deck saved to Supabase:', deckRow.id);
    }
  }

  return deck;
}

/**
 * Persist a deck to localStorage only (upserts by name).
 * @param {Object} deck
 */
export function fcSaveDeckLocal(deck) {
  const decks    = lsGet(FC_LS_KEY, []);
  const filtered = decks.filter(d => d.name !== deck.name);
  filtered.unshift(deck);
  lsSet(FC_LS_KEY, filtered.slice(0, 30));
}

/**
 * Back-fill the Supabase-generated id into the localStorage copy.
 * @param {string} name       — deck name used as the lookup key
 * @param {string} supabaseId — uuid returned by Supabase insert
 */
export function fcPatchLocalDeckId(name, supabaseId) {
  const decks   = lsGet(FC_LS_KEY, []);
  const patched = decks.map(d => d.name === name ? { ...d, id: supabaseId } : d);
  lsSet(FC_LS_KEY, patched);
}

// ── Deck loading ──────────────────────────────────────────────────────────────

/**
 * Load all decks: Supabase (if logged in) merged with localStorage.
 * @returns {Promise<Array>}
 */
export async function fcLoadDecks() {
  const localDecks = lsGet(FC_LS_KEY, []);

  if (window.ChunksDB?.isLoggedIn()) {
    try {
      const { data, error } = await ChunksDB.get('fc_decks', {
        order: { col: 'created_at', asc: false },
        limit: 30,
      });

      if (!error && data?.length) {
        const sbNames  = new Set(data.map(d => d.name));
        const localOnly = localDecks.filter(d => !sbNames.has(d.name));
        const merged   = [...data, ...localOnly];
        lsSet(FC_LS_KEY, merged.slice(0, 30));
        return merged;
      }
    } catch (e) {
      console.warn('[FlashcardDB] Supabase deck load error:', e.message);
    }
  }

  return localDecks;
}

/**
 * Load cards for a given deck — prefers Supabase, falls back to embedded cards.
 * @param {Object} deck
 * @returns {Promise<Array>}
 */
export async function fcLoadCards(deck) {
  if (window.ChunksDB?.isLoggedIn() && deck.id) {
    const { data, error } = await ChunksDB.get('fc_cards', { eq: { deck_id: deck.id } });
    if (!error && data?.length) {
      // Cache cards back into localStorage
      const decks   = lsGet(FC_LS_KEY, []);
      const patched = decks.map(d => d.id === deck.id ? { ...d, cards: data } : d);
      lsSet(FC_LS_KEY, patched);
      return data;
    }
  }
  return deck.cards || [];
}

// ── Session persistence ───────────────────────────────────────────────────────

/**
 * Save a study session summary.
 * Persists locally and (if logged in + deckId present) upserts SRS progress.
 *
 * @param {Object} state — { deckId, deckName, stats, cardRatings, deck }
 *   stats:       { easy, ok, hard, skipped }
 *   cardRatings: [{ card_id, rating }]
 */
export async function fcSaveSession({ deckId, deckName, stats, cardRatings, deck }) {
  const session = {
    id:        crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
    deck_id:   deckId   || null,
    deck_name: deckName || 'Untitled',
    easy:      stats?.easy    || 0,
    ok:        stats?.ok      || 0,
    hard:      stats?.hard    || 0,
    skipped:   stats?.skipped || 0,
    total:     deck?.length   || 0,
    studied_at: new Date().toISOString(),
  };

  fcSaveSessionLocal(session);

  if (window.ChunksDB?.isLoggedIn() && deckId) {
    const ratableCards = (cardRatings || []).filter(r => r.card_id && r.rating !== 'skipped');
    if (ratableCards.length) {
      try {
        await Promise.all(ratableCards.map(r =>
          ChunksDB.upsert('fc_progress', {
            card_id: r.card_id,
            deck_id: deckId,
            ...fcRatingToSRS(r.rating),
          }, 'user_id,card_id')
        ));
        console.log(`[FlashcardDB] Progress upserted for ${ratableCards.length} cards`);
      } catch (e) {
        console.warn('[FlashcardDB] Progress upsert error:', e.message);
      }
    }
  }

  return session;
}

/**
 * Persist a session to localStorage only.
 * @param {Object} session
 */
export function fcSaveSessionLocal(session) {
  const sessions = lsGet(FC_SESSIONS_LS_KEY, []);
  const filtered = sessions.filter(
    s => s.deck_id !== session.deck_id && s.deck_name !== session.deck_name
  );
  filtered.unshift(session);
  lsSet(FC_SESSIONS_LS_KEY, filtered.slice(0, 100));
}

// ── Session retrieval ─────────────────────────────────────────────────────────

/**
 * Get the most recent session for a given deck.
 * Checks localStorage first, then synthesises from Supabase fc_progress.
 * @param {string|null} deckId
 * @param {string}      deckName
 * @returns {Promise<Object|null>}
 */
export async function fcGetLastSession(deckId, deckName) {
  const sessions = lsGet(FC_SESSIONS_LS_KEY, []);
  const local    = sessions.find(s => s.deck_id === deckId || s.deck_name === deckName);
  if (local) return local;

  if (window.ChunksDB?.isLoggedIn() && deckId) {
    try {
      const { data, error } = await ChunksDB.get('fc_progress', {
        eq:    { deck_id: deckId },
        limit: 100,
      });
      if (!error && data?.length) {
        const total  = data.length;
        const easy   = data.filter(c => c.ease_factor >= 2.5 && c.repetitions > 0).length;
        const hard   = data.filter(c => c.ease_factor <  2.5 && c.repetitions > 0).length;
        const latest = data.reduce(
          (a, b) => (a.last_reviewed || '') > (b.last_reviewed || '') ? a : b,
          data[0]
        );
        return {
          deck_id:   deckId,
          deck_name: deckName,
          easy, ok: 0, hard, skipped: 0, total,
          studied_at: latest.last_reviewed || null,
        };
      }
    } catch (_) {}
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const FlashcardDB = {
  FC_LS_KEY,
  FC_SESSIONS_LS_KEY,
  fcRatingToSRS,
  fcSaveDeck,
  fcSaveDeckLocal,
  fcPatchLocalDeckId,
  fcLoadDecks,
  fcLoadCards,
  fcSaveSession,
  fcSaveSessionLocal,
  fcGetLastSession,
};

// ── Window bridge ─────────────────────────────────────────────────────────────

window.FlashcardDB = FlashcardDB;

console.log('[FlashcardDB] Persistence layer ready ✦');
