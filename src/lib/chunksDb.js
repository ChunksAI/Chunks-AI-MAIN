/**
 * src/lib/chunksDb.js — Task 31
 *
 * ChunksDB — Shared Sync Layer
 * Central helper for all Supabase read/write operations.
 * Every feature (flashcards, exams, research, study plans)
 * uses these helpers instead of talking to Supabase directly.
 *
 * RULES:
 * - Always scoped to the current auth.uid() via RLS
 * - Falls back gracefully to localStorage when not logged in
 * - Never throws — always returns { data, error }
 *
 * Bridges set on window.*:
 *   ChunksDB  — the full public API object
 */

import { getSupabaseClient } from './supabase.js';
import { lsGet as _lsGet, lsSet as _lsSet, lsRemove as _lsRemove } from '../utils/storage.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Get current user id (null if not logged in) */
function _uid() {
  return window._currentUser?.id || null;
}

/** Get Supabase client (null if unavailable) */
async function _sb() {
  try { return await getSupabaseClient(); } catch (e) { return null; }
}

/** Is the user logged in with a real account? */
function isLoggedIn() {
  return !!_uid();
}

// ── Core CRUD ─────────────────────────────────────────────────────────────────

/**
 * Fetch rows from a table for the current user.
 * @param {string} table  - Supabase table name
 * @param {Object} opts   - { select, eq, order, limit }
 * @returns {{ data, error }}
 */
async function get(table, opts = {}) {
  const sb = await _sb();
  if (!sb || !isLoggedIn()) return { data: null, error: 'not_logged_in' };
  try {
    let q = sb.from(table).select(opts.select || '*');
    // Always filter by user_id (belt + suspenders on top of RLS)
    q = q.eq('user_id', _uid());
    if (opts.eq) {
      Object.entries(opts.eq).forEach(([col, val]) => { q = q.eq(col, val); });
    }
    if (opts.order) {
      q = q.order(opts.order.col, { ascending: opts.order.asc ?? false });
    }
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    return { data, error };
  } catch (e) {
    console.warn('[ChunksDB] get error:', table, e.message);
    return { data: null, error: e.message };
  }
}

/**
 * Insert or update a row (upsert).
 * Automatically injects user_id.
 * @param {string} table
 * @param {Object|Object[]} rows  - single row or array
 * @param {string} onConflict    - conflict column(s), default 'id'
 * @returns {{ data, error }}
 */
async function upsert(table, rows, onConflict = 'id') {
  const sb = await _sb();
  if (!sb || !isLoggedIn()) return { data: null, error: 'not_logged_in' };
  try {
    const uid = _uid();
    const payload = Array.isArray(rows)
      ? rows.map(r => ({ ...r, user_id: uid }))
      : { ...rows, user_id: uid };
    const { data, error } = await sb
      .from(table)
      .upsert(payload, { onConflict, ignoreDuplicates: false });
    if (error) console.warn('[ChunksDB] upsert error:', table, error.message);
    return { data, error };
  } catch (e) {
    console.warn('[ChunksDB] upsert error:', table, e.message);
    return { data: null, error: e.message };
  }
}

/**
 * Insert a new row (no conflict handling).
 * Automatically injects user_id.
 * Returns the inserted row with its generated id.
 * @param {string} table
 * @param {Object} row
 * @returns {{ data, error }}
 */
async function insert(table, row) {
  const sb = await _sb();
  if (!sb || !isLoggedIn()) return { data: null, error: 'not_logged_in' };
  try {
    const uid = _uid();
    const { data, error } = await sb
      .from(table)
      .insert({ ...row, user_id: uid })
      .select()
      .single();
    if (error) console.warn('[ChunksDB] insert error:', table, error.message);
    return { data, error };
  } catch (e) {
    console.warn('[ChunksDB] insert error:', table, e.message);
    return { data: null, error: e.message };
  }
}

/**
 * Delete a row by id (must belong to current user — RLS enforces).
 * @param {string} table
 * @param {string} id   - uuid
 * @returns {{ error }}
 */
async function remove(table, id) {
  const sb = await _sb();
  if (!sb || !isLoggedIn()) return { error: 'not_logged_in' };
  try {
    const { error } = await sb
      .from(table)
      .delete()
      .eq('id', id)
      .eq('user_id', _uid()); // extra safety on top of RLS
    if (error) console.warn('[ChunksDB] delete error:', table, error.message);
    return { error };
  } catch (e) {
    console.warn('[ChunksDB] delete error:', table, e.message);
    return { error: e.message };
  }
}

/**
 * Update specific columns on a row by id.
 * @param {string} table
 * @param {string} id
 * @param {Object} updates  - columns to update
 * @returns {{ data, error }}
 */
async function update(table, id, updates) {
  const sb = await _sb();
  if (!sb || !isLoggedIn()) return { data: null, error: 'not_logged_in' };
  try {
    const { data, error } = await sb
      .from(table)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', _uid())
      .select()
      .single();
    if (error) console.warn('[ChunksDB] update error:', table, error.message);
    return { data, error };
  } catch (e) {
    console.warn('[ChunksDB] update error:', table, e.message);
    return { data: null, error: e.message };
  }
}

// ── localStorage delegates ────────────────────────────────────────────────────
// Thin wrappers so callers don't need to import storage.js separately.

function lsGet(key, fallback = null) { return _lsGet(key, fallback); }
function lsSet(key, value)           { return _lsSet(key, value); }
function lsRemove(key)               { return _lsRemove(key); }

// ── Auth state listener ───────────────────────────────────────────────────────
// Patches window._currentUser.id from the Supabase session so _uid() works.
// Must run after supabase.js and after auth.js sets up _applyUserProfile.

(function _patchAuth() {
  // Extend _applyUserProfile to also store the user's UUID
  // (called automatically after login by _initAuth in auth.js / Task 32)
  const _origApplyUserProfile = window._applyUserProfile;
  window._applyUserProfile = function (session) {
    if (_origApplyUserProfile) _origApplyUserProfile(session);
    if (session?.user && window._currentUser) {
      window._currentUser.id = session.user.id;
    }
  };

  // Also patch _initAuth's session restore path
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
      try {
        const sb = await getSupabaseClient();
        if (!sb) return;
        const { data: { session } } = await sb.auth.getSession();
        if (session?.user && window._currentUser) {
          window._currentUser.id = session.user.id;
        }
      } catch (e) {}
    }, 1200); // runs after _initAuth (1000ms delay)
  });
})();

// ── Public API ────────────────────────────────────────────────────────────────

export const ChunksDB = {
  get, insert, upsert, update, remove,
  isLoggedIn,
  lsGet, lsSet, lsRemove,
};

// ── Window bridge ─────────────────────────────────────────────────────────────
// Keeps window.ChunksDB?.isLoggedIn() / window.ChunksDB?.lsGet() guards working
// in flashState.js and any other modules that defensively check window.ChunksDB.

window.ChunksDB = ChunksDB;

console.log('[ChunksDB] Sync layer ready ✦');
