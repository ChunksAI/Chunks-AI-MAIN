// @ts-nocheck
/**
 * src/lib/errorHandler.js — Global error boundary + API error classifier
 *
 * Installs window-level handlers for uncaught errors and unhandled rejections.
 * Provides classifyError() for structured API error handling, and
 * friendlyMessage() for user-facing strings.
 *
 * Usage:
 *   import { classifyError, friendlyMessage, installGlobalHandlers } from './errorHandler.js';
 *   installGlobalHandlers();
 *
 *   const kind = classifyError(res, body);  // 'network'|'validation'|'server'|…
 *   showToast('⚠', friendlyMessage(kind));
 */

import { logError } from './logger.js';

// ── Error classification ─────────────────────────────────────────────────────

/**
 * Classify an API error into a named category.
 *
 * @param {Response|null} res    - fetch Response (null if network failure)
 * @param {Object}        [body] - parsed JSON body (if available)
 * @returns {'network'|'validation'|'server'|'content_filter'|'rate_limit'|'auth'|'unknown'}
 */
export function classifyError(res, body) {
  if (!res || !navigator.onLine) return 'network';
  const status = res.status;
  if (status === 401 || status === 403) return 'auth';
  if (status === 400 || status === 422) {
    // Check for content moderation flags
    if (body?.content_filter || body?.flagged || body?.error?.includes?.('content')) {
      return 'content_filter';
    }
    return 'validation';
  }
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server';
  return 'unknown';
}

/**
 * Return a user-friendly error message for the given error kind.
 *
 * @param {'network'|'validation'|'server'|'content_filter'|'rate_limit'|'auth'|'unknown'} kind
 * @returns {string}
 */
export function friendlyMessage(kind) {
  switch (kind) {
    case 'network':        return 'Network error — check your connection and try again.';
    case 'validation':     return 'Invalid input — please check your message and try again.';
    case 'server':         return 'Server error — our servers are having trouble. Please try again shortly.';
    case 'content_filter': return 'Your message was flagged by our content filter. Please rephrase and try again.';
    case 'rate_limit':     return 'Too many requests — please wait a moment and try again.';
    case 'auth':           return 'Session expired — please sign in again.';
    default:               return 'Something went wrong. Please try again.';
  }
}

// ── Global error boundary ────────────────────────────────────────────────────

let _installed = false;

/**
 * Install global error handlers for uncaught exceptions and unhandled
 * promise rejections.  Safe to call multiple times (idempotent).
 */
export function installGlobalHandlers() {
  if (_installed) return;
  _installed = true;

  window.addEventListener('error', (event) => {
    logError('global', 'Uncaught error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logError('global', 'Unhandled rejection', {
      message: reason?.message || String(reason),
      stack: reason?.stack?.split('\n').slice(0, 3).join('\n'),
    });
  });
}
