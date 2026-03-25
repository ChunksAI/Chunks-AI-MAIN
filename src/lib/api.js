// @ts-nocheck
/**
 * src/lib/api.js — Chunks AI API client
 *
 * Single source of truth for every fetch() call to the Railway backend.
 * All callers import the named functions below; no raw fetch() to API_BASE
 * should remain in screen or component modules after Phase 2.
 *
 * Task 10 — extracted from monolith.
 * Replaces the inline API_BASE constant + ad-hoc fetch() calls scattered
 * across every script block.
 */

// ── Base URL ───────────────────────────────────────────────────────────────
// Override at deploy time by setting window.CHUNKS_BACKEND_URL before this
// module is imported (e.g. via a tiny inline <script> in index.html).
export const API_BASE = (
  window.CHUNKS_BACKEND_URL || 'https://api.chunks.online'
).replace(/\/$/, '');

// Window bridge removed — now handled by src/globals.js

// ── Auth header helper ─────────────────────────────────────────────────────

/**
 * _getAuthHeader — return { Authorization: 'Bearer <token>' } if a valid
 * Supabase session exists, or {} if the user is not signed in.
 *
 * Reads the session from the Supabase client (getSupabaseClient) so the
 * token is always fresh — Supabase auto-refreshes expiring tokens and this
 * call picks up the new one without any extra work from callers.
 *
 * Never throws: auth failures degrade gracefully to an unauthenticated
 * request rather than breaking the UI.
 *
 * Exported so that state modules with direct fetch() calls can also attach
 * the token without duplicating this logic.
 */
export async function _getAuthHeader() {
  try {
    const { getSupabaseClient } = await import('./supabase.js');
    const sb = await getSupabaseClient?.();
    if (!sb) return {};
    const { data: { session } } = await sb.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch (_) { /* silent — auth is best-effort */ }
  return {};
}
