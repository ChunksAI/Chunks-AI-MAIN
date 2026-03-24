/**
 * src/lib/schemaMigrations.js — Schema versioning & migration for localStorage
 *
 * Tracks a numeric schema version in localStorage and applies incremental
 * migration functions when the stored version is behind the current one.
 *
 * How to add a migration
 * ──────────────────────
 *  1. Bump LS_SCHEMA_VERSION by 1.
 *  2. Add an entry in LS_MIGRATIONS keyed by the new version number.
 *     The function receives no arguments and should read/write localStorage
 *     directly.  Keep migrations idempotent when practical.
 *  3. Build & test — existing users will run all pending steps automatically
 *     the next time the app loads.
 *
 * Usage: import { runLocalStorageMigrations } from './schemaMigrations.js';
 *        runLocalStorageMigrations();  // call once at app startup
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const LS_SCHEMA_KEY = 'chunks_ls_schema_version';

/** Current schema version for localStorage data. Bump when adding a migration. */
export const LS_SCHEMA_VERSION = 1;

// ── Migration registry ────────────────────────────────────────────────────────

/**
 * Registry of localStorage migrations.
 * Each entry maps a *target* version to a function that migrates data
 * FROM the previous version.  Migrations run in order: 0→1, 1→2, …
 *
 * @type {Record<number, () => void>}
 */
const LS_MIGRATIONS = {
  // ── v0 → v1 ────────────────────────────────────────────────────────────────
  // Baseline — marks existing data as version 1.  No data transforms needed.
  1: () => { /* initial version — no transform */ },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Read the stored schema version (0 if never set).
 * @returns {number}
 */
function _getStoredVersion() {
  try {
    const raw = localStorage.getItem(LS_SCHEMA_KEY);
    return raw !== null ? Number(raw) : 0;
  } catch (_) { return 0; }
}

/**
 * Persist the schema version to localStorage.
 * @param {number} v
 */
function _setStoredVersion(v) {
  try { localStorage.setItem(LS_SCHEMA_KEY, String(v)); } catch (_) {}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run any pending localStorage schema migrations.
 * Safe to call multiple times — no-ops if already at the current version.
 */
export function runLocalStorageMigrations() {
  let stored = _getStoredVersion();
  if (stored >= LS_SCHEMA_VERSION) return;

  console.info(
    `[schemaMigrations] localStorage schema v${stored} → v${LS_SCHEMA_VERSION}`,
  );

  while (stored < LS_SCHEMA_VERSION) {
    const next = stored + 1;
    const fn = LS_MIGRATIONS[next];
    if (fn) {
      try {
        fn();
        console.info(`[schemaMigrations] applied localStorage migration v${next}`);
      } catch (e) {
        console.warn(`[schemaMigrations] migration v${next} failed:`, e);
        break; // stop on failure — don't skip migrations
      }
    }
    stored = next;
  }

  _setStoredVersion(stored);
}
