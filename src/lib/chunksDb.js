/**
 * src/lib/chunksDb.js — ChunksDB sync layer
 *
 * Extracted from the monolith (Task 31).
 * Provides Supabase CRUD helpers + localStorage fallback helpers.
 * All methods are automatically scoped to the current user's id.
 *
 * Usage (module):
 *   import { ChunksDB } from './lib/chunksDb.js';
 *   const { data } = await ChunksDB.get('fc_decks');
 *
 * Usage (legacy global — still works after extraction):
 *   ChunksDB.get('fc_decks');   // window.ChunksDB is set below
 */

/* ── Get current user id (null if not logged in) ── */
function _uid() {
  return window._currentUser?.id || null;
}

/* ── Get Supabase client (null if unavailable) ── */
async function _sb() {
  try { return await window._getChunksSb(); } catch(e) { return null; }
}

/* ── Is the user logged in with a real account? ── */
function isLoggedIn() {
  return !!_uid();
}

/* ────────────────────────────────────────────────
   CORE CRUD — used by all features
──────────────────────────────────────────────── */

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
  } catch(e) {
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
  } catch(e) {
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
  } catch(e) {
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
  } catch(e) {
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
  } catch(e) {
    console.warn('[ChunksDB] update error:', table, e.message);
    return { data: null, error: e.message };
  }
}

/* ────────────────────────────────────────────────
   LOCAL STORAGE FALLBACK HELPERS
   Used by features when user is not logged in.
──────────────────────────────────────────────── */

function lsGet(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch(e) { return fallback; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch(e) { console.warn('[ChunksDB] localStorage write failed:', key); }
}

function lsRemove(key) {
  try { localStorage.removeItem(key); } catch(e) {}
}

// NOTE: _currentUser.id patching was moved to src/lib/auth.js (Task 32)

/* ────────────────────────────────────────────────
   PUBLIC API
──────────────────────────────────────────────── */

export const ChunksDB = {
  get,
  insert,
  upsert,
  update,
  remove,
  isLoggedIn,
  lsGet,
  lsSet,
  lsRemove,
};

// Backward-compat: monolith code still calls ChunksDB.get(...) as a global
window.ChunksDB = ChunksDB;

console.log('[ChunksDB] Sync layer ready');