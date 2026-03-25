/**
 * src/lib/supabase.js — Supabase client singleton
 *
 * Owns the single SupabaseClient instance for the entire app.
 * All other modules (auth.js, chunksDb.js, flashcardDb.js) call
 * getSupabaseClient() — they never call createClient() themselves.
 *
 * Credentials are fetched from the backend GET /api/config on each page load
 * and kept **in module memory only** — never persisted to localStorage or
 * sessionStorage.  This avoids leaking the Supabase project URL / anon key
 * into client-side storage where extensions or XSS could harvest them.
 *
 * Task 11 — extracted from monolith (plan+presence block, lines ~5280–5365).
 * Replaces the inline _waitForSupabase() + _getChunksSb() globals.
 *
 * NOTE: window._getChunksSb is aliased below so the inline script blocks
 * that haven't been migrated to imports yet continue to work.
 */

import { API_BASE } from './api.js';
import * as supabaseJs from '@supabase/supabase-js';

// ── Safe storage fallback ──────────────────────────────────────────────────
// Edge / Safari Tracking Prevention can block localStorage access from CDN
// scripts. We try localStorage → sessionStorage → in-memory as fallbacks
// so the Supabase session always has somewhere to persist.
const _memStore = {};
const _safeStorage = (() => {
  // Test if localStorage is available and not blocked
  try {
    const t = '__chunks_test__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return localStorage;                          // ✅ localStorage works
  } catch (_) {}

  // Fall back to sessionStorage
  try {
    const t = '__chunks_test__';
    sessionStorage.setItem(t, '1');
    sessionStorage.removeItem(t);
    console.warn('[supabase] localStorage blocked — using sessionStorage');
    return sessionStorage;                        // ✅ sessionStorage works
  } catch (_) {}

  // Last resort — in-memory storage (session lost on page close)
  console.warn('[supabase] sessionStorage blocked — using in-memory storage');
  return {
    getItem:    key       => _memStore[key] ?? null,
    setItem:    (key, val) => { _memStore[key] = String(val); },
    removeItem: key       => { delete _memStore[key]; },
  };
})();

// ── Resolve the Supabase library ────────────────────────────────────────────
// Prefer the npm-bundled import; fall back to the CDN-loaded global on window
// (index.html loads supabase.min.js asynchronously) with an 8 s timeout.
function _waitForSupabase() {
  if (supabaseJs?.createClient) return Promise.resolve(supabaseJs);
  return new Promise(resolve => {
    if (window.supabase) return resolve(window.supabase);
    let waited = 0;
    const t = setInterval(() => {
      waited += 100;
      if (window.supabase)        { clearInterval(t); resolve(window.supabase); }
      else if (waited >= 8000)    { clearInterval(t); resolve(null); }
    }, 100);
  });
}

// ── Singleton state ────────────────────────────────────────────────────────
let _client   = null;   // the SupabaseClient instance once initialised
let _initProm = null;   // in-flight init promise (prevents double-init races)

/**
 * getSupabaseClient() — returns the shared SupabaseClient, initialising it on
 * first call.  Returns null if credentials cannot be found or the CDN failed
 * to load within the timeout.
 *
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient | null>}
 */
export async function getSupabaseClient() {
  if (_client)   return _client;
  if (_initProm) return _initProm;   // reuse in-flight init

  _initProm = (async () => {
    const lib = await _waitForSupabase();
    if (!lib) {
      console.warn('[supabase] CDN script not ready after 8 s');
      return null;
    }

    // ── Clean up legacy localStorage keys ──────────────────────────────
    // Previous versions cached Supabase credentials in localStorage.
    // Remove them so they no longer linger in client-side storage.
    try { _safeStorage.removeItem('chunks_sb_url'); }  catch (_) {}
    try { _safeStorage.removeItem('chunks_sb_anon'); } catch (_) {}

    let url = '', anon = '';

    // Fetch /api/config from backend — the only source of credentials.
    // NOTE: no AbortSignal here — it cannot be cloned via postMessage (used by
    // PDF.js worker) and causes console warnings on every PDF load.
    const backends = [API_BASE];
    for (const base of backends) {
      try {
        const fetchP   = fetch(`${base}/api/config`).then(r => r.json());
        const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000));
        const config   = await Promise.race([fetchP, timeoutP]);
        if (config?.supabaseUrl && config?.supabaseAnonKey) {
          url  = config.supabaseUrl;
          anon = config.supabaseAnonKey;
          break;
        }
      } catch (e) {
        console.warn('[supabase] Config fetch failed from', base, e.message);
      }
    }

    if (!url || !anon) {
      console.warn('[supabase] No credentials available — running unauthenticated');
      return null;
    }

    _client = lib.createClient(url, anon, {
      auth: {
        persistSession:   true,
        autoRefreshToken: true,
        storage:          _safeStorage,           // ← safe fallback storage
        // Unique key — prevents GoTrueClient collision with other Supabase
        // instances on the same domain (e.g. admin.html).
        storageKey: 'chunks-ai-auth',
      },
    });

    console.log('[supabase] Client ready:', url);
    return _client;
  })();

  return _initProm;
}

// ── Legacy global bridge ───────────────────────────────────────────────────
// Inline script blocks that haven't been migrated to imports yet call
// _getChunksSb().  This alias keeps them working without change.
window._getChunksSb = getSupabaseClient;
