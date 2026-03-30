// @ts-nocheck
/**
 * src/lib/logger.js — Structured logging system
 *
 * Provides a unified logging API that:
 *  • In dev: writes to console with colour-coded tags
 *  • In prod: buffers structured log entries (JSON) for optional
 *    batch-POST to an analytics endpoint
 *  • Tracks slow queries (>3 s) and failed requests automatically
 *
 * Usage:
 *   import { log, logWarn, logError, trackSlow } from './logger.js';
 *   log('auth', 'session restored', { userId });
 *   logWarn('sync', 'retry #2', { delay: 2400 });
 *   logError('api', 'request failed', { status: 500, url });
 *   const end = trackSlow('chat', 'ask'); ... end();   // warns if >3 s
 */

const _IS_PROD = typeof import.meta !== 'undefined'
  && /** @type {*} */ (import.meta).env?.PROD;

// ── In-memory log buffer (prod) ──────────────────────────────────────────────
/** @type {Array<{ts:string, level:string, tag:string, msg:string, data?:*}>} */
const _buffer = [];
const _MAX_BUFFER = 200;

/** Flush buffer to console (or a future /api/log endpoint). */
function _flush() {
  if (!_buffer.length) return;
  // In the future, POST _buffer to an analytics endpoint here.
  // For now, batch-write to console in prod as structured JSON.
  if (_IS_PROD) {
    // eslint-disable-next-line no-console
    console.log('[Chunks:logs]', JSON.stringify(_buffer));
  }
  _buffer.length = 0;
}

// Auto-flush every 30 s (non-blocking)
let _flushTimer = null;
if (typeof window !== 'undefined') {
  _flushTimer = setInterval(_flush, 30_000);
  // Flush on page unload
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') _flush();
  });
}

// ── Core log function ────────────────────────────────────────────────────────

/**
 * @param {'info'|'warn'|'error'} level
 * @param {string}  tag   - e.g. 'auth', 'sync', 'api', 'chat'
 * @param {string}  msg
 * @param {*}       [data]
 */
function _log(level, tag, msg, data) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    tag,
    msg,
    ...(data !== undefined ? { data } : {}),
  };

  if (!_IS_PROD) {
    // Dev: rich console output
    const styles = {
      info:  'color:#60a5fa',
      warn:  'color:#fbbf24',
      error: 'color:#f87171',
    };
    const fn = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    // eslint-disable-next-line no-console
    console[fn](`%c[${tag}]`, styles[level] || '', msg, data !== undefined ? data : '');
  }

  // Always buffer
  _buffer.push(entry);
  if (_buffer.length > _MAX_BUFFER) _buffer.shift();
}

// ── Public helpers ───────────────────────────────────────────────────────────

/** Info-level log */
export function log(tag, msg, data) { _log('info', tag, msg, data); }

/** Warning-level log */
export function logWarn(tag, msg, data) { _log('warn', tag, msg, data); }

/** Error-level log */
export function logError(tag, msg, data) { _log('error', tag, msg, data); }

/**
 * Track a potentially slow operation.  Returns a function to call when done.
 * If the operation takes >threshold ms, a warning is logged automatically.
 *
 * @param {string} tag
 * @param {string} label
 * @param {number} [thresholdMs=3000]
 * @returns {() => number} end — returns elapsed ms
 */
export function trackSlow(tag, label, thresholdMs = 3000) {
  const start = performance.now();
  return () => {
    const elapsed = Math.round(performance.now() - start);
    if (elapsed > thresholdMs) {
      _log('warn', tag, `Slow operation: ${label} took ${elapsed}ms`, { elapsed, threshold: thresholdMs });
    }
    return elapsed;
  };
}
