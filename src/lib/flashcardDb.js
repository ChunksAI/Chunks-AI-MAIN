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
 *   flashcards  — per-document     { id, user_id, document_id, page, question, answer, created_at }
 *
 * localStorage keys (fallback when not logged in):
 *   chunks_fc_decks_v1        — array of deck objects (with embedded cards)
 *   chunks_fc_sessions_v1     — array of session objects
 *   chunks_fc_flashcards_v1   — array of per-document flashcard objects
 *
 * Exports:
 *   FC_LS_KEY, FC_SESSIONS_LS_KEY, FC_DOC_FLASHCARDS_LS_KEY  — storage key constants
 *   fcSaveDeck(topic, cards)           — create & persist a new deck
 *   fcSaveDeckLocal(deck)              — localStorage-only save
 *   fcPatchLocalDeckId(name, id)       — back-fill Supabase id into ls
 *   fcLoadDecks()                      — merge Supabase + localStorage
 *   fcLoadCards(deck)                  — load cards for a given deck
 *   fcSaveSession(state)               — persist end-of-session summary
 *   fcSaveSessionLocal(session)        — localStorage-only session save
 *   fcGetLastSession(deckId, name)     — retrieve most recent session
 *   fcRatingToSRS(rating, prev)        — SM-2-style SRS calculation
 *   fcSaveFlashcards(cards, docId, pg) — save per-document flashcards (deduped)
 *   fcLoadFlashcards(docId, page?)     — load per-document flashcards
 *
 * Window bridge:
 *   window.FlashcardDB — full public API
 */

import { ChunksDB } from './chunksDb.js';
import { getSupabaseClient } from './supabase.js';
import { isIdbKey, idbGet, idbSet } from './idbStorage.js';
import { _currentUser } from './auth.js';

// ── Storage keys ─────────────────────────────────────────────────────────────

export const FC_LS_KEY          = 'chunks_fc_decks_v1';
export const FC_SESSIONS_LS_KEY = 'chunks_fc_sessions_v1';
/** localStorage key for per-document flashcards (offline fallback) */
export const FC_DOC_FLASHCARDS_LS_KEY = 'chunks_fc_flashcards_v1';

// ── Internal localStorage helpers ────────────────────────────────────────────
// These exist so the module works even before ChunksDB is fully initialised.
// Large-data keys are routed to IndexedDB via idbStorage.

function _lsGet(key, fallback = null) {
  if (isIdbKey(key)) return idbGet(key, fallback);
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch (_) { return fallback; }
}

function _lsSet(key, value) {
  if (isIdbKey(key)) { idbSet(key, value); return; }
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

// Prefer ChunksDB wrappers (they share the same implementation) but fall back
// gracefully during early module initialisation.
function lsGet(key, fallback = null) {
  return (ChunksDB?.lsGet ?? _lsGet)(key, fallback);
}

function lsSet(key, value) {
  return (ChunksDB?.lsSet ?? _lsSet)(key, value);
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

  if (ChunksDB?.isLoggedIn()) {
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

  if (ChunksDB?.isLoggedIn()) {
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
  if (deck.id) {
    try {
      const sb = await getSupabaseClient();
      if (sb) {
        // Query directly — bypasses ChunksDB user_id filter so library cards work too
        const { data, error } = await sb
          .from('fc_cards')
          .select('*')
          .eq('deck_id', deck.id);
        if (!error && data?.length) {
          // Cache back into localStorage for offline use
          const decks   = lsGet(FC_LS_KEY, []);
          const patched = decks.map(d => d.id === deck.id ? { ...d, cards: data } : d);
          lsSet(FC_LS_KEY, patched);
          return data;
        }
      }
    } catch (e) {
      console.warn('[FlashcardDB] fcLoadCards error:', e.message);
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

  if (ChunksDB?.isLoggedIn() && deckId) {
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

  if (ChunksDB?.isLoggedIn() && deckId) {
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

// ── Per-document flashcard persistence ───────────────────────────────────────

/**
 * Persist per-document flashcard rows to localStorage only.
 * Appends to the existing array (capped at 500 entries).
 * @param {Array} rows — normalised flashcard rows
 */
function _fcSaveFlashcardsLocal(rows) {
  const existing = lsGet(FC_DOC_FLASHCARDS_LS_KEY, []);
  lsSet(FC_DOC_FLASHCARDS_LS_KEY, [...existing, ...rows].slice(0, 500));
}

/**
 * Save flashcards per user and per document to the Supabase `flashcards` table.
 *
 * Duplicate prevention: any card whose `question` already exists for the same
 * `user_id + document_id` is silently skipped.
 *
 * Falls back to localStorage when the user is not logged in so flashcards are
 * never lost for guests or offline users.
 *
 * @param {Array<{question?: string, front?: string, answer?: string, back?: string}>} cards
 * @param {string} documentId - book id or user-doc id (ws.bookId / ws.userDocId)
 * @param {number} [page=0]   - current page number
 * @returns {Promise<{saved: number, skipped: number, error: string|null}>}
 */
export async function fcSaveFlashcards(cards, documentId, page = 0) {
  // ── Input validation ──────────────────────────────────────────────────────
  if (!Array.isArray(cards) || !cards.length) {
    return { saved: 0, skipped: 0, error: 'No cards provided' };
  }
  if (!documentId) {
    return { saved: 0, skipped: 0, error: 'documentId is required' };
  }

  // Normalise and drop cards with empty question or answer
  const valid = cards
    .map(c => ({
      question: (c.question || c.front  || '').trim(),
      answer:   (c.answer   || c.back   || '').trim(),
    }))
    .filter(c => c.question && c.answer);

  if (!valid.length) {
    return { saved: 0, skipped: 0, error: 'No valid cards (missing question or answer)' };
  }

  // ── Logged-in path: Supabase ──────────────────────────────────────────────
  if (ChunksDB?.isLoggedIn()) {
    try {
      const sb  = await getSupabaseClient();
      if (!sb) throw new Error('Supabase client unavailable');

      const uid = _currentUser?.id;
      if (!uid) throw new Error('User id unavailable');

      // Fetch existing questions for this user + document to detect duplicates
      const { data: existing, error: fetchErr } = await sb
        .from('flashcards')
        .select('question')
        .eq('user_id', uid)
        .eq('document_id', documentId);

      if (fetchErr) throw fetchErr;

      const existingQs = new Set(
        (existing || []).map(c => (c.question || '').trim().toLowerCase())
      );

      const newCards = valid.filter(
        c => !existingQs.has(c.question.toLowerCase())
      );
      const skipped = valid.length - newCards.length;

      if (!newCards.length) {
        console.info('[FlashcardDB] fcSaveFlashcards: all cards already exist, skipping');
        return { saved: 0, skipped, error: null };
      }

      const rows = newCards.map(c => ({
        user_id:     uid,
        document_id: documentId,
        page:        page || 0,
        question:    c.question,
        answer:      c.answer,
      }));

      const { error: insertErr } = await sb.from('flashcards').insert(rows);
      if (insertErr) throw insertErr;

      // Mirror to localStorage for offline access
      const localRows = rows.map(r => ({
        ...r,
        id:         crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
        created_at: new Date().toISOString(),
      }));
      _fcSaveFlashcardsLocal(localRows);

      console.log(`[FlashcardDB] fcSaveFlashcards: saved ${rows.length}, skipped ${skipped}`);
      return { saved: rows.length, skipped, error: null };

    } catch (e) {
      console.warn('[FlashcardDB] fcSaveFlashcards error:', e.message);
      return { saved: 0, skipped: 0, error: e.message };
    }
  }

  // ── Guest / offline path: localStorage only ───────────────────────────────
  const existing = lsGet(FC_DOC_FLASHCARDS_LS_KEY, []);
  const existingQs = new Set(
    existing
      .filter(c => c.document_id === documentId)
      .map(c => (c.question || '').trim().toLowerCase())
  );

  const newCards = valid.filter(c => !existingQs.has(c.question.toLowerCase()));
  const skipped  = valid.length - newCards.length;

  if (newCards.length) {
    const rows = newCards.map(c => ({
      id:          crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2),
      document_id: documentId,
      page:        page || 0,
      question:    c.question,
      answer:      c.answer,
      created_at:  new Date().toISOString(),
    }));
    _fcSaveFlashcardsLocal(rows);
  }

  return { saved: newCards.length, skipped, error: null };
}

/**
 * Load flashcards for a given document from Supabase (if logged in) or
 * localStorage.  Optionally filter by page number.
 *
 * @param {string}  documentId - book id or user-doc id
 * @param {number}  [page]     - if provided, only return cards for this page
 * @returns {Promise<Array<{id, document_id, page, question, answer, created_at}>>}
 */
export async function fcLoadFlashcards(documentId, page) {
  if (!documentId) return [];

  if (ChunksDB?.isLoggedIn()) {
    try {
      const sb = await getSupabaseClient();
      if (sb) {
        const uid = _currentUser?.id;
        if (!uid) throw new Error('User id unavailable');

        let q = sb
          .from('flashcards')
          .select('*')
          .eq('user_id', uid)
          .eq('document_id', documentId)
          .order('created_at', { ascending: true });

        if (page !== undefined && page !== null) {
          q = q.eq('page', page);
        }

        const { data, error } = await q;
        if (!error) return data || [];
      }
    } catch (e) {
      console.warn('[FlashcardDB] fcLoadFlashcards error:', e.message);
    }
  }

  // Fallback: filter localStorage entries for this document (and optional page)
  const all = lsGet(FC_DOC_FLASHCARDS_LS_KEY, []);
  return all.filter(c => {
    if (c.document_id !== documentId) return false;
    if (page !== undefined && page !== null && c.page !== page) return false;
    return true;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export const FlashcardDB = {
  FC_LS_KEY,
  FC_SESSIONS_LS_KEY,
  FC_DOC_FLASHCARDS_LS_KEY,
  fcRatingToSRS,
  fcSaveDeck,
  fcSaveDeckLocal,
  fcPatchLocalDeckId,
  fcLoadDecks,
  fcLoadCards,
  fcSaveSession,
  fcSaveSessionLocal,
  fcGetLastSession,
  fcSaveFlashcards,
  fcLoadFlashcards,
};

console.log('[FlashcardDB] Persistence layer ready ✦');
