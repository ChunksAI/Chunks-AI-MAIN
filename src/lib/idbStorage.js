/**
 * src/lib/idbStorage.js — IndexedDB persistence layer
 *
 * Replaces localStorage for large, mutable data (chat sessions, flashcard
 * decks/sessions/mastery, study plans) using the `idb` library.
 *
 * Design
 * ──────
 * • Write-through in-memory cache: synchronous reads, async writes.
 * • Before init() completes, reads fall back to localStorage so modules
 *   that evaluate at import time still find their data.
 * • On first run, existing localStorage values are migrated into IndexedDB
 *   and then removed from localStorage.
 * • A single "kv" object store is used — same key/value semantics as
 *   localStorage, but without the ~5 MB size limit.
 *
 * Exports
 * ──────
 *  isIdbKey(key)          — true if `key` belongs in IndexedDB
 *  idbGet(key, fallback)  — synchronous read (cache or localStorage fallback)
 *  idbSet(key, value)     — write to cache + async persist to IndexedDB
 *  idbRemove(key)         — remove from cache + async remove from IndexedDB
 *  idbKeys(prefix)        — list all keys matching a prefix (synchronous)
 *  init()                 — open DB, migrate from localStorage, populate cache
 */

import { openDB } from 'idb';
import { isQuotaError, showStorageError } from '../components/StorageErrorBanner.js';

// ── Database constants ────────────────────────────────────────────────────────

const DB_NAME    = 'chunks-ai';
const DB_VERSION = 1;
const STORE      = 'kv';

// ── IndexedDB migration registry ──────────────────────────────────────────────
// Each entry maps a *target* version to a function that upgrades the database
// FROM the previous version.  The upgrade callback steps through all needed
// migrations when the stored DB version is behind DB_VERSION.
//
// How to add a migration:
//  1. Bump DB_VERSION by 1.
//  2. Add a new entry here keyed by the new version number.
//  3. The function receives (db, transaction) — use them to create/alter
//     object stores or transform existing data.

/** @type {Record<number, (db: IDBDatabase, tx: IDBTransaction) => void>} */
const IDB_MIGRATIONS = {
  // ── v0 → v1: create the key-value store ────────────────────────────────
  1: (db) => {
    if (!db.objectStoreNames.contains(STORE)) {
      db.createObjectStore(STORE);
    }
  },
};

// ── In-memory write-through cache ─────────────────────────────────────────────

/** @type {Map<string, *>} */
const _cache = new Map();

/** @type {import('idb').IDBPDatabase | null} */
let _db = null;

/** true once init() has finished and the cache is fully populated */
let _ready = false;

/** Keys written before _db was open — flushed at end of init() */
const _dirty = new Set();

/** Keys deleted before _db was open — flushed at end of init() */
const _pendingDeletes = new Set();

// ── Key classification ────────────────────────────────────────────────────────
// Only keys listed here are stored in IndexedDB.  Everything else stays in
// localStorage (small settings, flags, scalar values).

/** Exact keys that belong in IndexedDB */
const IDB_EXACT_KEYS = new Set([
  'chunks_fc_decks_v1',        // flashcard decks with embedded cards
  'chunks_fc_sessions_v1',     // flashcard study session history
  'chunks_fc_mastery_v1',      // per-deck mastery scores
  'sp_all_plans',              // full study-plan library
  'sp_active_plan',            // currently-loaded plan (concepts array)
  'sp_active_mastery',         // mastery progress for active plan
  'chunks_deleted_sessions',   // chat session tombstone list
]);

/** Key prefixes — any key starting with one of these goes to IndexedDB */
const IDB_PREFIXES = [
  'chunks_session_',           // individual chat sessions
  'sp_srs_',                   // SRS schedules (one per plan)
];

/**
 * Returns true if `key` should be stored in IndexedDB rather than localStorage.
 * @param {string} key
 * @returns {boolean}
 */
export function isIdbKey(key) {
  if (IDB_EXACT_KEYS.has(key)) return true;
  for (let i = 0; i < IDB_PREFIXES.length; i++) {
    if (key.startsWith(IDB_PREFIXES[i])) return true;
  }
  return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Synchronous read — returns the JS value from the in-memory cache.
 * Before init() completes, falls back to localStorage (which still has the
 * data on the first run, or from a previous session if migration has already
 * happened and the browser re-opened quickly).
 *
 * @template T
 * @param {string} key
 * @param {T}      [fallback=null]
 * @returns {T}
 */
export function idbGet(key, fallback = null) {
  if (_cache.has(key)) return _cache.get(key);
  if (!_ready) {
    // Pre-init fallback: read from localStorage
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }
  return fallback;
}

/**
 * Write `value` to the in-memory cache and persist asynchronously to IndexedDB.
 * If the database isn't open yet the write is queued and flushed when init()
 * finishes.
 *
 * @param {string} key
 * @param {*}      value  — must be a structured-cloneable JS value
 */
export function idbSet(key, value) {
  _cache.set(key, value);
  if (_db) {
    _db.put(STORE, value, key).catch(e => {
      console.warn('[idbStorage] write error:', key, e);
      if (isQuotaError(e)) showStorageError('quota');
    });
  } else {
    _dirty.add(key);
    _pendingDeletes.delete(key);
  }
}

/**
 * Remove a key from the in-memory cache and from IndexedDB.
 *
 * @param {string} key
 */
export function idbRemove(key) {
  _cache.delete(key);
  if (_db) {
    _db.delete(STORE, key).catch(e =>
      console.warn('[idbStorage] remove error:', key, e));
  } else {
    _dirty.delete(key);
    _pendingDeletes.add(key);
  }
}

/**
 * Return all keys whose name starts with `prefix` (synchronous).
 * Before init() this also scans localStorage as a fallback.
 *
 * @param {string} [prefix='']
 * @returns {string[]}
 */
export function idbKeys(prefix = '') {
  if (_ready) {
    const out = [];
    for (const k of _cache.keys()) {
      if (k.startsWith(prefix)) out.push(k);
    }
    return out;
  }
  // Pre-init: merge localStorage scan with any pre-init cache writes
  const set = new Set();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) set.add(k);
    }
  } catch (_) {}
  for (const k of _cache.keys()) {
    if (k.startsWith(prefix)) set.add(k);
  }
  return [...set];
}

// ── Initialisation ────────────────────────────────────────────────────────────

/** @type {Promise<void> | null} */
let _initPromise = null;

/**
 * Open the IndexedDB database, populate the in-memory cache, and migrate
 * any matching localStorage entries.  Safe to call multiple times — returns
 * the same promise on subsequent calls.
 *
 * @returns {Promise<void>}
 */
export function init() {
  if (_initPromise) return _initPromise;
  _initPromise = _doInit();
  return _initPromise;
}

async function _doInit() {
  try {
    _db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        for (let v = oldVersion + 1; v <= DB_VERSION; v++) {
          const migrateFn = IDB_MIGRATIONS[v];
          if (migrateFn) migrateFn(db, tx);
        }
      },
    });

    // 1. Load existing IndexedDB data into the cache (skip keys already
    //    set by pre-init writes so we never overwrite a fresher value).
    const readTx = _db.transaction(STORE, 'readonly');
    let cursor = await readTx.store.openCursor();
    while (cursor) {
      if (!_cache.has(cursor.key)) {
        _cache.set(cursor.key, cursor.value);
      }
      cursor = await cursor.continue();
    }

    // 2. Migrate matching localStorage entries into IndexedDB.
    const keysToMigrate = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isIdbKey(k)) keysToMigrate.push(k);
    }

    if (keysToMigrate.length > 0) {
      const migrateTx = _db.transaction(STORE, 'readwrite');
      for (const key of keysToMigrate) {
        if (!_cache.has(key)) {
          try {
            const raw = localStorage.getItem(key);
            if (raw !== null) {
              const val = JSON.parse(raw);
              _cache.set(key, val);
              migrateTx.store.put(val, key);
            }
          } catch (_) { /* skip unparseable entries */ }
        }
        // Remove from localStorage — IndexedDB is now the source of truth.
        try { localStorage.removeItem(key); } catch (_) {}
      }
      await migrateTx.done;
    }

    // 3. Flush any writes/deletes that occurred before the DB was open.
    if (_dirty.size > 0 || _pendingDeletes.size > 0) {
      const flushTx = _db.transaction(STORE, 'readwrite');
      for (const key of _dirty) {
        if (_cache.has(key)) {
          flushTx.store.put(_cache.get(key), key);
        }
      }
      for (const key of _pendingDeletes) {
        flushTx.store.delete(key);
      }
      await flushTx.done;
      _dirty.clear();
      _pendingDeletes.clear();
    }

    _ready = true;
    console.info(
      `[idbStorage] ready — ${_cache.size} keys loaded, ` +
      `${keysToMigrate.length} migrated from localStorage`,
    );
  } catch (e) {
    // If IndexedDB is unavailable (e.g. private browsing in some browsers),
    // the rest of the app continues using the localStorage fallback path
    // built into idbGet (since _ready stays false).
    console.warn('[idbStorage] init failed, using localStorage fallback:', e);
    // Quota errors (even during migration) mean the device is out of space.
    // Non-quota failures (private browsing, corrupt DB, etc.) are migration issues.
    if (isQuotaError(e)) {
      showStorageError('out-of-space');
    } else {
      showStorageError('migration');
    }
  }
}
