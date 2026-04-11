/**
 * lib/supabaseClient.ts — Supabase singleton for Chunks(v.2)
 *
 * Credentials come from NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 * env vars. If those are absent (e.g. during local dev without an .env.local),
 * the client falls back to fetching /api/config from the backend — matching the
 * pattern used by the old system (src/lib/supabase.js).
 *
 * The singleton is stored in module memory so createClient() is only called once
 * per browser session, regardless of how many components call getSupabaseClient().
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.chunks.online').replace(/\/$/, '');

export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (_client) return _client;

  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fall back to backend config endpoint (matches old system)
  if (!supabaseUrl || !supabaseAnonKey) {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      if (res.ok) {
        const cfg = (await res.json()) as { supabaseUrl?: string; supabaseAnonKey?: string };
        supabaseUrl = cfg.supabaseUrl;
        supabaseAnonKey = cfg.supabaseAnonKey;
      }
    } catch {
      // Network error — will throw below with a clear message
    }
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase credentials unavailable. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
    );
  }

  _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

/** Returns the current user's JWT access token, or null if not signed in. */
export async function getAccessToken(): Promise<string | null> {
  try {
    const sb = await getSupabaseClient();
    const {
      data: { session },
    } = await sb.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}
