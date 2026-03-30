// @ts-nocheck
/**
 * src/lib/offlineQueue.js — In-memory write queue for offline resilience
 *
 * When the browser is offline, API writes are enqueued in memory.
 * On reconnect (online event), the queue is replayed with exponential
 * backoff.  Duplicate writes are prevented by keying on a unique
 * operation identifier.
 *
 * The queue is intentionally **in-memory only** — it does not survive
 * page refresh.  This matches the core principle that Supabase is the
 * single source of truth; if a write was never confirmed, it should not
 * silently replay after an arbitrary delay.
 *
 * Usage:
 *   import { enqueueWrite, flushQueue } from './offlineQueue.js';
 *
 *   // Inside your API call catch block:
 *   if (!navigator.onLine) {
 *     enqueueWrite('chat-save-abc123', () => ChunksDB.chat.saveFull(session));
 *   }
 */

import { log, logWarn, logError } from './logger.js';

// ── Queue state ──────────────────────────────────────────────────────────────

/** @type {Map<string, { fn: () => Promise<*>, retries: number, addedAt: number }>} */
const _queue = new Map();

let _flushing = false;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Enqueue a write operation for later replay.
 * Deduplicated by `key` — if a write with the same key is already queued,
 * it is replaced (last-write-wins).
 *
 * @param {string}              key - Unique identifier for deduplication
 * @param {() => Promise<*>}    fn  - The async write to execute
 */
export function enqueueWrite(key, fn) {
  _queue.set(key, { fn, retries: 0, addedAt: Date.now() });
  log('offline', `Queued write: ${key}`, { queueSize: _queue.size });
}

/**
 * Flush all queued writes.  Each write is retried up to 3 times with
 * exponential backoff (1s, 2s, 4s).  Successfully completed writes are
 * removed from the queue.
 */
export async function flushQueue() {
  if (_flushing || _queue.size === 0) return;
  _flushing = true;
  log('offline', `Flushing ${_queue.size} queued writes`);

  for (const [key, entry] of [..._queue.entries()]) {
    try {
      await entry.fn();
      _queue.delete(key);
      log('offline', `Flushed write: ${key}`);
    } catch (e) {
      entry.retries++;
      if (entry.retries >= 3) {
        logError('offline', `Write permanently failed after 3 retries: ${key}`, { error: e?.message });
        _queue.delete(key);
      } else {
        logWarn('offline', `Write retry ${entry.retries}/3: ${key}`);
        // Wait with exponential backoff before next attempt
        await new Promise(r => setTimeout(r, Math.pow(2, entry.retries) * 1000));
      }
    }
  }

  _flushing = false;
}

/**
 * Returns the current queue size (for diagnostics / UI).
 * @returns {number}
 */
export function queueSize() {
  return _queue.size;
}

// ── Auto-flush on reconnect ──────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    log('offline', 'Network restored — flushing offline queue');
    flushQueue();
  });
}
