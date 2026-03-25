/**
 * src/utils/storageQuota.js — Proactive storage-quota checks
 *
 * Uses the Storage API (`navigator.storage.estimate()`) to warn the user
 * *before* a write fails, rather than surfacing an error only after data
 * loss has already occurred.
 *
 * Exports
 * ───────
 *  checkStorageQuota(bytesNeeded?)  — async; shows a banner when storage is low
 *  resetQuotaWarning()              — clear the session-level "already warned" flag
 */

import { showStorageError } from '../components/StorageErrorBanner.js';

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Warn when free space drops below 50 MB */
const WARN_REMAINING_BYTES = 50 * 1024 * 1024;

/** …or when overall usage exceeds 90 % of the quota */
const WARN_USAGE_PCT = 90;

// ── Throttle / de-duplicate ───────────────────────────────────────────────────

/** Don't re-estimate more often than every 30 s */
const THROTTLE_MS = 30_000;

let _lastCheckTs = 0;

/** Once we've shown the banner in this page session, don't repeat */
let _warned = false;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Proactively check device storage and show a "near-quota" warning banner
 * if space is running low.
 *
 * The check is throttled (at most once every 30 s) and the banner is shown
 * at most once per page session to avoid spamming the user.
 *
 * @param {number} [bytesNeeded=0] - Optional hint: how many bytes the
 *   upcoming write requires.  When provided the function also checks
 *   whether the write is likely to exceed remaining space.
 * @returns {Promise<{ok: boolean, usage: number, quota: number, remaining: number, pctUsed: number} | null>}
 *   `null` when the API is unavailable or the check was throttled.
 */
export async function checkStorageQuota(bytesNeeded = 0) {
  if (_warned) return null;                       // already warned this session
  const now = Date.now();
  if (now - _lastCheckTs < THROTTLE_MS) return null;
  _lastCheckTs = now;

  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;

  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const remaining = quota - usage;
    const pctUsed   = quota > 0 ? (usage / quota) * 100 : 0;

    const willExceed = bytesNeeded > 0 && bytesNeeded > remaining;
    const isLow      = remaining < WARN_REMAINING_BYTES || pctUsed >= WARN_USAGE_PCT;

    if (isLow || willExceed) {
      _warned = true;
      showStorageError('near-quota');
    }

    return { ok: !willExceed && !isLow, usage, quota, remaining, pctUsed };
  } catch (_) {
    return null;                                  // API failure — degrade silently
  }
}

/**
 * Reset the "already warned" flag so a future `checkStorageQuota()` call can
 * show the banner again.  Useful after the user frees space (e.g. clears old
 * sessions or documents).
 */
export function resetQuotaWarning() {
  _warned = false;
  _lastCheckTs = 0;
}
