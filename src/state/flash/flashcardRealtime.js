// @ts-nocheck
/**
 * src/state/flash/flashcardRealtime.js — Supabase Realtime flashcard sync
 *
 * Subscribes to the `flashcards` table via Supabase Realtime and applies
 * incremental cache updates whenever rows are inserted, deleted, or updated.
 * Always filters by the current user_id and the subscribed document_id so
 * there is never any mixing of cards across users or documents.
 *
 * Public API:
 *   subscribeToFlashcardRealtime(documentId)  — start listening for changes
 *   unsubscribeFlashcardRealtime()            — stop listening (call on unmount / doc change)
 *   getFlashcardsCache()                      — current in-memory array (sorted by created_at)
 *   isFlashcardRealtimeActive(documentId)     — true when subscribed to this specific document
 */

import { getSupabaseClient } from '../../lib/supabase.js';
import { FlashcardDB } from '../../lib/flashcardDb.js';

// ── Module state ─────────────────────────────────────────────────────────────

/** Active Supabase Realtime channel — null when not subscribed */
let _channel = null;

/** The document id we are currently subscribed to */
let _subscribedDocId = null;

/** In-memory cache of flashcard rows for the subscribed document */
let _cache = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the current user id or null */
function _uid() {
  return window._currentUser?.id || null;
}

/** Sort helper — ascending by created_at */
function _byCreatedAt(a, b) {
  if (a.created_at < b.created_at) return -1;
  if (a.created_at > b.created_at) return  1;
  return 0;
}

// ── Cache mutation helpers ────────────────────────────────────────────────────

/**
 * _cacheInsert — add a row to the cache, deduplicating by id.
 * Maintains ascending created_at order.
 */
function _cacheInsert(row) {
  if (_cache.some(c => c.id === row.id)) return; // dedup
  _cache.push(row);
  _cache.sort(_byCreatedAt);
}

/**
 * _cacheDelete — remove a row from the cache by id.
 */
function _cacheDelete(id) {
  _cache = _cache.filter(c => c.id !== id);
}

/**
 * _cacheUpdate — replace an existing row in the cache.
 * Falls back to insert if the row is not found.
 */
function _cacheUpdate(row) {
  const idx = _cache.findIndex(c => c.id === row.id);
  if (idx === -1) {
    _cacheInsert(row);
  } else {
    _cache[idx] = row;
    _cache.sort(_byCreatedAt);
  }
}

// ── Realtime event router ─────────────────────────────────────────────────────

/**
 * handleRealtimeEvent — dispatch INSERT / DELETE / UPDATE events.
 *
 * Guards against events for other users or documents before mutating the cache.
 *
 * @param {Object} payload  — Supabase Realtime change payload
 */
function handleRealtimeEvent(payload) {
  const userId     = _uid();
  const documentId = _subscribedDocId;

  if (payload.eventType === 'INSERT') {
    const row = payload.new;
    // Only process events that belong to the current user + document
    if (userId     && row.user_id     !== userId)     return;
    if (documentId && row.document_id !== documentId) return;
    _cacheInsert(row);
  }

  if (payload.eventType === 'DELETE') {
    const id = payload.old?.id;
    if (id !== undefined && id !== null) _cacheDelete(id);
  }

  if (payload.eventType === 'UPDATE') {
    const row = payload.new;
    if (userId     && row.user_id     !== userId)     return;
    if (documentId && row.document_id !== documentId) return;
    _cacheUpdate(row);
  }
}

// ── Subscription lifecycle ────────────────────────────────────────────────────

/**
 * subscribeToFlashcardRealtime — subscribe to `flashcards` table changes for
 * the given document.  Any previously active subscription is cleaned up first.
 * Performs an initial full load to populate the cache before going live.
 *
 * @param {string} documentId  — current book / user-doc identifier
 */
export async function subscribeToFlashcardRealtime(documentId) {
  // Clean up any existing subscription before creating a new one
  await unsubscribeFlashcardRealtime();

  if (!documentId) return;

  const sb = await getSupabaseClient();
  if (!sb) {
    console.warn('[FlashcardRealtime] Supabase client unavailable — realtime disabled');
    return;
  }

  // Guests have no user_id — skip subscription
  if (!_uid()) {
    console.info('[FlashcardRealtime] Guest mode — skipping realtime subscription');
    return;
  }

  _subscribedDocId = documentId;

  // Initial load — populate the cache with all existing cards for this document
  try {
    const rows = await FlashcardDB.fcLoadFlashcards(documentId);
    _cache = rows ? [...rows].sort(_byCreatedAt) : [];
  } catch (e) {
    console.warn('[FlashcardRealtime] Initial load error:', e.message);
    _cache = [];
  }

  _channel = sb
    .channel('realtime-flashcards')
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'flashcards',
      },
      (payload) => {
        handleRealtimeEvent(payload);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.info('[FlashcardRealtime] Subscribed to flashcards table for doc:', documentId);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[FlashcardRealtime] Subscription error:', status);
      }
    });
}

/**
 * unsubscribeFlashcardRealtime — remove the active Supabase Realtime channel
 * and clear the in-memory cache.
 * Safe to call when no subscription is active.
 */
export async function unsubscribeFlashcardRealtime() {
  if (!_channel) return;

  const sb = await getSupabaseClient();
  if (sb) {
    try {
      await sb.removeChannel(_channel);
    } catch (e) {
      console.warn('[FlashcardRealtime] removeChannel error:', e.message);
    }
  }

  _channel         = null;
  _subscribedDocId = null;
  _cache           = [];
  console.info('[FlashcardRealtime] Unsubscribed');
}

// ── Cache accessors ───────────────────────────────────────────────────────────

/**
 * getFlashcardsCache — return a copy of the current in-memory flashcard array.
 * Always sorted ascending by created_at.
 *
 * @returns {Array<{id, user_id, document_id, page, question, answer, created_at}>}
 */
export function getFlashcardsCache() {
  return [..._cache];
}

/**
 * isFlashcardRealtimeActive — returns true when the realtime subscription is
 * live for the specified documentId.
 *
 * @param {string} documentId
 * @returns {boolean}
 */
export function isFlashcardRealtimeActive(documentId) {
  return _channel !== null && _subscribedDocId === documentId;
}
