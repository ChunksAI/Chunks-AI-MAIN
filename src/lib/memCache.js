// @ts-nocheck
/**
 * src/lib/memCache.js — In-memory cache replacing localStorage for Supabase-synced data
 *
 * Provides a simple key → value store that lives only in memory.
 * Data is populated from Supabase on login (via pullAndApply) and is
 * intentionally **not** persisted to disk — Supabase is the single
 * source of truth for all data stored here.
 *
 * On page refresh the cache starts empty; pullAll() repopulates it.
 * This eliminates stale reads, cross-user data leaks, and duplicate
 * data between localStorage and Supabase.
 *
 * Usage:
 *   import { memGet, memSet, memRemove } from './memCache.js';
 *   memSet('exam_recent', [...]);
 *   const recent = memGet('exam_recent', []);
 */

/** @type {Map<string, *>} */
const _store = new Map();

/**
 * Retrieve a value from the in-memory cache.
 *
 * @template T
 * @param {string} key
 * @param {T}      [fallback=null]
 * @returns {T}
 */
export function memGet(key, fallback = null) {
  if (_store.has(key)) return _store.get(key);
  return fallback;
}

/**
 * Store a value in the in-memory cache.
 *
 * @param {string} key
 * @param {*}      value
 */
export function memSet(key, value) {
  _store.set(key, value);
}

/**
 * Remove a key from the in-memory cache.
 *
 * @param {string} key
 */
export function memRemove(key) {
  _store.delete(key);
}

/**
 * Remove all keys that start with a given prefix.
 *
 * @param {string} prefix
 */
export function memRemovePrefix(prefix) {
  for (const key of [..._store.keys()]) {
    if (key.startsWith(prefix)) _store.delete(key);
  }
}

/**
 * Clear the entire in-memory cache.
 * Called on sign-out to prevent data leaking to the next user.
 */
export function memClear() {
  _store.clear();
}

/**
 * Return all keys currently in the cache (useful for pushLocalToRemote
 * patterns that iterate over workspace position keys).
 *
 * @param {string} [prefix]  — optional filter
 * @returns {string[]}
 */
export function memKeys(prefix) {
  const all = [..._store.keys()];
  return prefix ? all.filter(k => k.startsWith(prefix)) : all;
}

// ── window bridge ─────────────────────────────────────────────────────────────
// Allows app.html inline scripts and legacy code to access the cache
// without ES module imports.

if (typeof window !== 'undefined') {
  window._memGet    = memGet;
  window._memSet    = memSet;
  window._memRemove = memRemove;
  window._memClear  = memClear;
  window._memKeys   = memKeys;
}
