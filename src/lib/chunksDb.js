// @ts-nocheck
/**
 * src/lib/chunksDb.js — Task 31 + Phase 2 cross-device sync
 *
 * ChunksDB — Shared Sync Layer
 * Central helper for all Supabase read/write operations.
 * Every feature (flashcards, exams, research, study plans)
 * uses these helpers instead of talking to Supabase directly.
 *
 * RULES:
 * - Always scoped to the current auth.uid() via RLS
 * - Falls back gracefully to localStorage when not logged in
 * - Never throws — always returns { data, error }
 *
 * Bridges set on window.*:
 *   ChunksDB  — the full public API object
 *
 * Phase 2 additions (cross-device sync):
 *   chat.*      — home chat session persistence  (table: chat_sessions)
 *   settings.*  — user preferences sync          (table: user_settings)
 *   streak.*    — flashcard streak + XP           (table: streak_state)
 *   ws.*        — workspace reading position      (table: ws_state)
 *   pullAll()   — login merge: Supabase wins on updated_at
 */

import { getSupabaseClient } from './supabase.js';
import { lsGet as _lsGet, lsSet as _lsSet, lsRemove as _lsRemove } from '../utils/storage.js';
import { idbKeys as _idbKeys } from './idbStorage.js';
import { _currentUser, _applyUserProfile } from './auth.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Get current user id (null if not logged in) */
function _uid() {
  return _currentUser?.id || null;
}

/** Get Supabase client (null if unavailable) */
async function _sb() {
  try { return await getSupabaseClient(); } catch (e) { return null; }
}

/** Is the user logged in with a real account? */
function isLoggedIn() {
  return !!_uid();
}

// ── Core CRUD ─────────────────────────────────────────────────────────────────

/**
 * Fetch rows from a table for the current user.
 * @param {string} table  - Supabase table name
 * @param {Object} opts   - { select, eq, order, limit }
 * @returns {{ data, error }}
 */
async function get(table, opts = {}) {
  const sb = await _sb();
  if (!sb || !isLoggedIn()) return { data: null, error: 'not_logged_in' };
  try {
    let q = sb.from(table).select(opts.select || '*');
    // Always filter by user_id (belt + suspenders on top of RLS)
    q = q.eq('user_id', _uid());
    if (opts.eq) {
      Object.entries(opts.eq).forEach(([col, val]) => { q = q.eq(col, val); });
    }
    if (opts.order) {
      q = q.order(opts.order.col, { ascending: opts.order.asc ?? false });
    }
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    return { data, error };
  } catch (e) {
    console.warn('[ChunksDB] get error:', table, e.message);
    return { data: null, error: e.message };
  }
}

/**
 * Insert or update a row (upsert).
 * Automatically injects user_id.
 * @param {string} table
 * @param {Object|Object[]} rows  - single row or array
 * @param {string} onConflict    - conflict column(s), default 'id'
 * @returns {{ data, error }}
 */
async function upsert(table, rows, onConflict = 'id') {
  const sb = await _sb();
  if (!sb || !isLoggedIn()) return { data: null, error: 'not_logged_in' };
  try {
    const uid = _uid();
    const payload = Array.isArray(rows)
      ? rows.map(r => ({ ...r, user_id: uid }))
      : { ...rows, user_id: uid };
    const { data, error } = await sb
      .from(table)
      .upsert(payload, { onConflict, ignoreDuplicates: false });
    if (error) console.warn('[ChunksDB] upsert error:', table, error.message);
    return { data, error };
  } catch (e) {
    console.warn('[ChunksDB] upsert error:', table, e.message);
    return { data: null, error: e.message };
  }
}

/**
 * Insert a new row (no conflict handling).
 * Automatically injects user_id.
 * Returns the inserted row with its generated id.
 * @param {string} table
 * @param {Object} row
 * @returns {{ data, error }}
 */
async function insert(table, row) {
  const sb = await _sb();
  if (!sb || !isLoggedIn()) return { data: null, error: 'not_logged_in' };
  try {
    const uid = _uid();
    const { data, error } = await sb
      .from(table)
      .insert({ ...row, user_id: uid })
      .select()
      .single();
    if (error) console.warn('[ChunksDB] insert error:', table, error.message);
    return { data, error };
  } catch (e) {
    console.warn('[ChunksDB] insert error:', table, e.message);
    return { data: null, error: e.message };
  }
}

/**
 * Delete a row by id (must belong to current user — RLS enforces).
 * @param {string} table
 * @param {string} id   - uuid
 * @returns {{ error }}
 */
async function remove(table, id) {
  const sb = await _sb();
  if (!sb || !isLoggedIn()) return { error: 'not_logged_in' };
  try {
    const { error } = await sb
      .from(table)
      .delete()
      .eq('id', id)
      .eq('user_id', _uid()); // extra safety on top of RLS
    if (error) console.warn('[ChunksDB] delete error:', table, error.message);
    return { error };
  } catch (e) {
    console.warn('[ChunksDB] delete error:', table, e.message);
    return { error: e.message };
  }
}

/**
 * Update specific columns on a row by id.
 * @param {string} table
 * @param {string} id
 * @param {Object} updates  - columns to update
 * @returns {{ data, error }}
 */
async function update(table, id, updates) {
  const sb = await _sb();
  if (!sb || !isLoggedIn()) return { data: null, error: 'not_logged_in' };
  try {
    const { data, error } = await sb
      .from(table)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', _uid())
      .select()
      .single();
    if (error) console.warn('[ChunksDB] update error:', table, error.message);
    return { data, error };
  } catch (e) {
    console.warn('[ChunksDB] update error:', table, e.message);
    return { data: null, error: e.message };
  }
}

// ── localStorage delegates ────────────────────────────────────────────────────
// Thin wrappers so callers don't need to import storage.js separately.

function lsGet(key, fallback = null) { return _lsGet(key, fallback); }
function lsSet(key, value)           { return _lsSet(key, value); }
function lsRemove(key)               { return _lsRemove(key); }

// ── Auth state listener ───────────────────────────────────────────────────────
// _currentUser is imported as a live binding from auth.js.
// _applyUserProfile (also from auth.js) already sets _currentUser.id from the
// Supabase session, so no monkey-patching is needed.

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — CROSS-DEVICE SYNC
// Four feature namespaces: chat · settings · streak · ws
// Each follows the same pattern:
//   1. If not logged in → fall back to localStorage silently
//   2. If logged in     → call the Supabase RPC or table directly
//   3. Never throw      → always return { data, error } or void
// ══════════════════════════════════════════════════════════════════════════════

// ── Shared RPC helper ─────────────────────────────────────────────────────────
// Calls a Postgres function via supabase.rpc() and normalises the response.

async function _rpc(fn, params = {}) {
  const sb = await _sb();
  if (!sb || !isLoggedIn()) return { data: null, error: 'not_logged_in' };
  try {
    const { data, error } = await sb.rpc(fn, params);
    if (error) console.warn(`[ChunksDB] rpc ${fn} error:`, error.message);
    return { data, error };
  } catch (e) {
    console.warn(`[ChunksDB] rpc ${fn} threw:`, e.message);
    return { data: null, error: e.message };
  }
}

// ── Conflict resolution helper ────────────────────────────────────────────────
// Returns true if the remote timestamp is newer than (or equal to) local.
// "last-write-wins on updated_at" — Supabase wins if newer, local wins if not.

function _remoteIsNewer(remoteIso, localIso) {
  if (!remoteIso) return false;
  if (!localIso)  return true;
  return new Date(remoteIso) >= new Date(localIso);
}

/** Fire a conflict event so SyncManager can detect remote overwrites */
function _notifyConflict(table) {
  try {
    window.dispatchEvent(new CustomEvent('chunksdb:conflict', { detail: { table } }));
  } catch (_) {}
}

// ══════════════════════════════════════════════════════════════════════════════
// chat — Home screen chat session persistence
// Table: chat_sessions  (created in migration 002)
// ══════════════════════════════════════════════════════════════════════════════

const chat = {

  /**
   * Append a single message turn to an existing or new session.
   * Preferred over saveFull for real-time appends — sends only the new turn.
   *
   * @param {string} sessionId  - UUID (generate client-side with crypto.randomUUID)
   * @param {{ role: string, content: string, ts: number }} message
   * @param {{ bookId?: string, title?: string }} [meta]
   */
  async appendMessage(sessionId, message, meta = {}) {
    // Always write to localStorage first — this is the source of truth
    // for the current device and the upload fallback if Supabase is unreachable.
    const key = 'chunks_session_' + sessionId;
    const session = _lsGet(key, { id: sessionId, history: [], ...meta });
    session.history = [...(session.history || []), message];
    session.updatedAt = new Date().toISOString();
    if (meta.bookId) session.bookId = meta.bookId;
    if (meta.title)  session.title  = meta.title;
    _lsSet(key, session);
    _lsSet('chunks_active_home_session', sessionId);

    // Queue this session id for upload in case _uid() isn't ready yet
    const _pending = _lsGet('chunks_pending_upload_sessions', []);
    if (!_pending.includes(sessionId)) {
      _lsSet('chunks_pending_upload_sessions', [..._pending, sessionId]);
    }

    // Guard: _uid() must be non-null for the RPC — if not ready yet,
    // the pending queue (_uploadLocalChatSessions on next pullAll) will catch it
    if (!isLoggedIn() || !_uid()) return { data: null, error: null };

    return _rpc('append_chat_message', {
      p_session_id: sessionId,
      p_user_id:    _uid(),
      p_message:    message,
      p_book_id:    meta.bookId  || null,
      p_title:      meta.title   || null,
      p_local_id:   meta.localId || null,
    });
  },

  /**
   * Save (or overwrite) an entire session — use for initial save or bulk import
   * from localStorage on login.
   *
   * @param {{ id, messages, bookId?, title?, updatedAt? }} session
   */
  async saveFull(session) {
    if (!isLoggedIn()) {
      _lsSet('chunks_session_' + session.id, session);
      _lsSet('chunks_active_home_session', session.id);
      return { data: null, error: null };
    }
    const messages = session.messages || session.history || [];
    // Title-only update — don't overwrite existing messages in Supabase
    if (messages.length === 0 && session.title) {
      try {
        const sb = await getSupabaseClient();
        if (sb) {
          return sb.from('chat_sessions')
            .update({ title: session.title, updated_at: session.updatedAt || new Date().toISOString() })
            .eq('id', session.id);
        }
      } catch(e) { console.warn('[chunksDb] title-only update failed:', e.message); }
      return { data: null, error: null };
    }
    return upsert('chat_sessions', {
      id:         session.id,
      local_id:   session.localId  || null,
      book_id:    session.bookId   || null,
      title:      session.title    || null,
      messages,
      updated_at: session.updatedAt || new Date().toISOString(),
    }, 'id');
  },

  /**
   * Fetch all sessions for the current user, newest first.
   * Falls back to scanning localStorage keys on the same device.
   *
   * @param {number} [limit=50]
   * @returns {{ data: Array, error }}
   */
  async getSessions(limit = 50) {
    if (!isLoggedIn()) {
      // Collect all chunks_session_* keys from IndexedDB / localStorage
      const sessions = [];
      try {
        const keys = _idbKeys('chunks_session_');
        for (const k of keys) {
          const s = _lsGet(k);
          if (s) sessions.push(s);
        }
      } catch (_) {}
      sessions.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      return { data: sessions.slice(0, limit), error: null };
    }
    return get('chat_sessions', {
      order: { col: 'updated_at', asc: false },
      limit,
    });
  },

  /**
   * Pull sessions from Supabase and write them to localStorage so the
   * existing restore path (which reads from localStorage) finds them.
   * Called on every login — safe to run on a device that already has data
   * (existing local sessions are not overwritten if they are newer).
   *
   * @returns {{ data: Array|null, error }}
   */
  async pullAndApply() {
    if (!isLoggedIn()) return { data: null, error: 'not_logged_in' };

    const { data: remoteSessions, error } = await get('chat_sessions', {
      order: { col: 'updated_at', asc: false },
      limit: 200,   // raised from 50 — user had 101 sessions, previous limit left half invisible
    });

    if (error || !remoteSessions?.length) return { data: null, error };

    // Write each remote session into localStorage so the page restore path
    // picks it up. Only overwrite if remote is newer than what's already local.
    let newestId       = null;   // local_id (r+timestamp) of the most recently updated remote session
    let newestTime     = 0;
    let newestLocalId  = null;   // cached alongside newestId for the active-session update below

    // Load tombstone list once outside the loop (performance)
    const _pullTombs = (() => {
      try { return new Set(_lsGet('chunks_deleted_sessions', [])); }
      catch(_) { return new Set(); }
    })();

    for (const remote of remoteSessions) {
      if (!remote.id) continue;

      // Tombstone check — three ways a deleted session can be identified:
      //   1. remote.id (UUID) is directly in the tombstone
      //   2. remote.local_id (r+timestamp) is in the tombstone
      //   3. remote.local_id is null but we can reconstruct the synthetic r+timestamp
      //      that was generated when the session was first downloaded on this device
      //      (local_id = 'r' + Date(updated_at).getTime() — same formula as _hydrateRecentFromRemote)
      const syntheticLocalId = remote.local_id || ('r' + new Date(remote.updated_at || 0).getTime());
      if (
        _pullTombs.has(remote.id) ||
        (remote.local_id && _pullTombs.has(remote.local_id)) ||
        _pullTombs.has(syntheticLocalId)
      ) {
        // Self-heal: row is tombstoned locally but still exists in Supabase — delete it now.
        remove('chat_sessions', remote.id).catch(() => {});
        continue;
      }

      const localKey = 'chunks_session_' + remote.id;
      const localRaw = _lsGet(localKey);
      const localTime  = localRaw?.updatedAt    ? new Date(localRaw.updatedAt).getTime()    : 0;
      const remoteTime = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;

      // Remote wins if newer or if no local copy exists
      if (remoteTime >= localTime) {
        _lsSet(localKey, {
          id:         remote.id,        // UUID — used as Supabase key
          supabaseId: remote.id,        // explicit so uploader never regenerates it
          html:       localRaw?.html || '',
          history:    remote.messages || [],
          bookId:     remote.book_id  || null,
          title:      remote.title    || null,
          updatedAt:  remote.updated_at,
        });
        // Also write under the r+timestamp localId key so the sidebar
        // and active-session restore can find it on this device
        if (remote.local_id) {
          _lsSet('chunks_session_' + remote.local_id, {
            id:         remote.local_id,
            supabaseId: remote.id,
            html:       localRaw?.html || '',
            history:    remote.messages || [],
            bookId:     remote.book_id  || null,
            title:      remote.title    || null,
            updatedAt:  remote.updated_at,
          });
        }
        // Bug #5 fix: only fire conflict when local had content that got overwritten.
        const hadLocalContent = (localRaw?.history?.length || localRaw?.messages?.length || 0) > 0;
        const remoteIsMeaningfullyNewer = remoteTime > localTime + 1000; // >1s gap
        if (hadLocalContent && remoteIsMeaningfullyNewer) {
          _notifyConflict('chat_sessions');
        }
      }

      // Track the most recently updated session across all remote rows
      if (remoteTime > newestTime) {
        newestTime    = remoteTime;
        newestId      = remote.id;
        newestLocalId = remote.local_id || remote.id; // UUID as fallback — never null
      }
    }

    // ── Bug #6 fix: update the active session pointer correctly ──────────────
    // The old code had two problems:
    //
    // 1. Inside the per-session loop it checked `currentActive === remote.id`
    //    which compared an r+timestamp local key against a UUID — always false —
    //    so the active pointer was only updated on a completely fresh device.
    //
    // 2. The outer guard `!currentActive` meant an existing device never had its
    //    active session updated, even when the other device had newer messages.
    //
    // Fix: after the loop we know newestTime (the most recent remote session).
    // Read the locally-active session's own updatedAt and compare directly.
    // Switch to the remote session only when it is strictly newer (>5s gap to
    // avoid thrashing when two devices save within the same sync window).
    const currentActive = localStorage.getItem('chunks_active_home_session');
    const currentLocalSession = currentActive ? _lsGet('chunks_session_' + currentActive) : null;
    const currentLocalTime = currentLocalSession?.updatedAt
      ? new Date(currentLocalSession.updatedAt).getTime() : 0;
    const remoteIsStrictlyNewer = newestTime > currentLocalTime + 5000; // >5s newer

    if (newestLocalId && (!currentActive || remoteIsStrictlyNewer)) {
      localStorage.setItem('chunks_active_home_session', newestLocalId);
    }

    console.log(`[ChunksDB] chat.pullAndApply — ${remoteSessions.length} sessions downloaded`);

    // ── Bug #1 fix: rebuild _recentItems from remote sessions ────────────────
    // _recentItems is an in-memory array in app.html's closure.  After a fresh
    // login on a new device it is empty, so _saveSession can never find a uuid
    // for the restored session — causing every subsequent write to skip Supabase.
    // _hydrateRecentFromRemote merges remote sessions in without triggering the
    // side-effects of recentAdd (no _homeSessionId mutation, no active highlight).
    try {
      window._hydrateRecentFromRemote?.(remoteSessions);
    } catch (e) {
      console.warn('[ChunksDB] _hydrateRecentFromRemote error:', e.message);
    }

    // Notify HomeScreen directly via CustomEvent — more reliable than window fn lookup
    try {
      window.dispatchEvent(new CustomEvent('chunks:sessions-ready', {
        detail: { count: remoteSessions.length }
      }));
    } catch (_) {}
    return { data: remoteSessions, error: null };
  },

  /**
   * Delete a session by id — permanent across all devices.
   *
   * 1. Remove from localStorage immediately (instant UI)
   * 2. Add UUID to local tombstone (blocks re-upload this session)
   * 3. Persist UUID to Supabase via user_settings.notifications.deleted_sessions
   *    → survives fresh logins on any device forever
   * 4. DELETE the Supabase row with retry
   */
  async deleteSession(sessionId) {
    _lsRemove('chunks_session_' + sessionId);

    try {
      const tombs = _lsGet('chunks_deleted_sessions', []);
      if (!tombs.includes(sessionId)) {
        tombs.push(sessionId);
        _lsSet('chunks_deleted_sessions', tombs.slice(-200));
      }
    } catch (_) {}

    if (!isLoggedIn()) return { error: null };

    // Persist tombstone to Supabase so ALL devices + future logins skip this session
    _persistServerTombstone(sessionId);

    // DELETE the Supabase row with retry
    return _deleteWithRetry(sessionId);
  },
};

// ── Server-side tombstone helpers ────────────────────────────────────────────
// Stores deleted session UUIDs in user_settings.notifications.deleted_sessions
// so deletes survive fresh logins and are visible on all devices.

/**
 * Add a session UUID to the server-side tombstone list.
 * Uses the existing patch_user_settings RPC — no migration required.
 * Fire-and-forget (non-blocking).
 */
async function _persistServerTombstone(sessionId) {
  try {
    const sb = await _sb();
    if (!sb || !isLoggedIn()) return;
    // Read current deleted_sessions from user_settings
    const { data } = await sb
      .from('user_settings')
      .select('notifications')
      .eq('user_id', _uid())
      .single();
    const existing = data?.notifications?.deleted_sessions || [];
    if (existing.includes(sessionId)) return; // already tombstoned
    const updated = [...existing, sessionId].slice(-200); // cap at 200
    await sb.from('user_settings')
      .update({ notifications: { ...(data?.notifications || {}), deleted_sessions: updated } })
      .eq('user_id', _uid());
    console.log('[ChunksDB] server tombstone saved for', sessionId);
  } catch (e) {
    console.warn('[ChunksDB] server tombstone failed:', e.message);
  }
}

/**
 * Delete a chat_sessions row from Supabase with up to 3 retries.
 * Logs result clearly so failures are never silent.
 */
async function _deleteWithRetry(sessionId, attempt = 1) {
  const MAX = 3;
  const result = await remove('chat_sessions', sessionId);
  if (!result.error) {
    console.log('[ChunksDB] session deleted from Supabase:', sessionId);
    return result;
  }
  if (attempt < MAX) {
    const delay = 1000 * attempt;
    console.warn(`[ChunksDB] delete failed (attempt ${attempt}/${MAX}), retrying in ${delay}ms…`, result.error);
    await new Promise(r => setTimeout(r, delay));
    return _deleteWithRetry(sessionId, attempt + 1);
  }
  console.error('[ChunksDB] delete permanently failed after', MAX, 'attempts:', result.error);
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// settings — User preferences sync
// Table: user_settings  (created in migration 003)
// ══════════════════════════════════════════════════════════════════════════════

// Map from Supabase column names → localStorage key suffixes used in the app
const _SETTINGS_COL_TO_LS = {
  appearance:        'appearance',
  chat_font_size:    null,          // stored under 'chunks-chat-font-size' (special)
  accent:            'accent',
  language:          'language',
  spoken_language:   'spoken-language',
  voice:             'voice',
  separate_voice:    'separate-voice',
  safe_content:      'safe-content',
};

const settings = {

  /**
   * Patch one or more settings. Writes to localStorage immediately,
   * then syncs to Supabase in the background (fire-and-forget).
   *
   * @param {Object} patch  - e.g. { accent: 'Violet', chat_font_size: 'L' }
   */
  async patch(patch) {
    // Always write to localStorage for instant effect on this device
    for (const [col, val] of Object.entries(patch)) {
      if (col === 'chat_font_size') {
        _lsSet('chunks-chat-font-size', val);
      } else if (_SETTINGS_COL_TO_LS[col]) {
        try { localStorage.setItem('chunks_setting_' + _SETTINGS_COL_TO_LS[col], typeof val === 'string' ? val : JSON.stringify(val)); } catch (_) {}
      }
    }
    if (!isLoggedIn()) return { data: null, error: null };
    // Background sync — caller doesn't need to await
    return _rpc('patch_user_settings', {
      p_user_id: _uid(),
      p_patch:   patch,
    });
  },

  /**
   * Pull the full settings row from Supabase and apply to localStorage.
   * Called on login to propagate settings from another device.
   *
   * @returns {{ data: Object|null, error }}
   */
  async pullAndApply() {
    if (!isLoggedIn()) return { data: null, error: 'not_logged_in' };

    const { data, error } = await get('user_settings', {});
    if (error || !data || !data.length) return { data: null, error };

    const row = data[0];

    // ── ALWAYS restore server-side tombstones first ──────────────────────────
    // This must run regardless of whether local or remote settings are newer.
    // If tombstones are only restored when "remote is newer", a user who changed
    // any setting after deleting sessions will push local settings up and skip
    // reading deleted_sessions — making deleted sessions come back on every login.
    try {
      const serverDeleted = row.notifications?.deleted_sessions || [];
      if (serverDeleted.length) {
        const localTombs = _lsGet('chunks_deleted_sessions', []);
        const merged = [...new Set([...localTombs, ...serverDeleted])].slice(-200);
        _lsSet('chunks_deleted_sessions', merged);
        console.log(`[ChunksDB] restored ${serverDeleted.length} server-side tombstones`);
      }
    } catch (_) {}

    // Compare updated_at vs last local write
    const localUpdatedAt = _lsGet('chunks_settings_updated_at');
    if (!_remoteIsNewer(row.updated_at, localUpdatedAt)) {
      // Local is newer — push local up to Supabase instead
      await settings.pushLocalToRemote();
      return { data: row, error: null };
    }

    // Remote is newer — apply all columns to localStorage
    if (localUpdatedAt) _notifyConflict('user_settings');
    if (row.appearance)       try { localStorage.setItem('chunks_setting_appearance',       row.appearance); }        catch (_) {}
    if (row.chat_font_size)   _lsSet('chunks-chat-font-size', row.chat_font_size);
    if (row.accent)           try { localStorage.setItem('chunks_setting_accent',           row.accent); }            catch (_) {}
    if (row.language)         try { localStorage.setItem('chunks_setting_language',         row.language); }          catch (_) {}
    if (row.spoken_language)  try { localStorage.setItem('chunks_setting_spoken-language',  row.spoken_language); }   catch (_) {}
    if (row.voice)            try { localStorage.setItem('chunks_setting_voice',            row.voice); }             catch (_) {}
    if (row.separate_voice !== undefined) try { localStorage.setItem('chunks_setting_separate-voice', row.separate_voice ? '1' : '0'); } catch (_) {}
    if (row.safe_content    !== undefined) try { localStorage.setItem('chunks_setting_safe-content',  row.safe_content    ? '1' : '0'); } catch (_) {}

    _lsSet('chunks_settings_updated_at', row.updated_at);
    return { data: row, error: null };
  },

  /**
   * Read all settings from localStorage and push them up to Supabase.
   * Called when local is newer than remote, or on first login.
   */
  async pushLocalToRemote() {
    if (!isLoggedIn()) return;
    const patch = {};
    try {
      const app = localStorage.getItem('chunks_setting_appearance');      if (app)  patch.appearance      = app;
      const fs  = _lsGet('chunks-chat-font-size');                        if (fs)   patch.chat_font_size  = fs;
      const acc = localStorage.getItem('chunks_setting_accent');          if (acc)  patch.accent           = acc;
      const lng = localStorage.getItem('chunks_setting_language');        if (lng)  patch.language         = lng;
      const slg = localStorage.getItem('chunks_setting_spoken-language'); if (slg)  patch.spoken_language  = slg;
      const voc = localStorage.getItem('chunks_setting_voice');           if (voc)  patch.voice            = voc;
      const sv  = localStorage.getItem('chunks_setting_separate-voice');  if (sv !== null)  patch.separate_voice = sv === '1';
      const sc  = localStorage.getItem('chunks_setting_safe-content');    if (sc !== null)  patch.safe_content   = sc === '1';
    } catch (_) {}
    if (Object.keys(patch).length) {
      await _rpc('patch_user_settings', { p_user_id: _uid(), p_patch: patch });
    }
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// streak — Flashcard streak, XP, and freeze tokens
// Table: streak_state  (created in migration 004)
// ══════════════════════════════════════════════════════════════════════════════

const _STREAK_LS_KEY = 'fc_streak_data';

const streak = {

  /**
   * Record a completed study session and update the streak.
   * The server-side RPC handles increment / break / freeze-token logic.
   *
   * @param {{ xpEarned: number, milestones?: Array }} opts
   * @returns {{ data: Object|null, error }}  — updated streak state
   */
  async recordSession({ xpEarned = 0, milestones = null } = {}) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Always update localStorage immediately so the UI stays snappy
    const local = _lsGet(_STREAK_LS_KEY, {});
    local.lastStudyDate = today;
    _lsSet(_STREAK_LS_KEY, local);

    if (!isLoggedIn()) return { data: null, error: null };

    return _rpc('upsert_streak', {
      p_user_id:    _uid(),
      p_study_date: today,
      p_xp_earned:  xpEarned,
      p_milestones: milestones,
    });
  },

  /**
   * Pull streak state from Supabase and sync to localStorage.
   * Follows last-write-wins on updated_at.
   *
   * @returns {{ data: Object|null, error }}
   */
  async pullAndApply() {
    if (!isLoggedIn()) return { data: null, error: 'not_logged_in' };

    const { data, error } = await get('streak_state', {});
    if (error || !data || !data.length) return { data: null, error };

    const row = data[0];
    const local = _lsGet(_STREAK_LS_KEY, {});

    if (_remoteIsNewer(row.updated_at, local.updatedAt)) {
      // Remote wins — overwrite local
      // Bug #5 fix: only notify if local had meaningful data before being overwritten.
      if (local.updatedAt) _notifyConflict('streak_state');
      _lsSet(_STREAK_LS_KEY, {
        count:         row.streak_count,
        longest:       row.longest_streak,
        lastStudyDate: row.last_study_date,
        totalXP:       row.total_xp,
        freezeTokens:  row.freeze_tokens,
        activeTheme:   row.active_theme,
        milestones:    row.milestones,
        updatedAt:     row.updated_at,
      });
    } else if (local.count != null) {
      // Local wins — push up to Supabase
      await streak.pushLocalToRemote(local);
    }

    return { data: row, error: null };
  },

  /**
   * Push the local streak object up to Supabase (called when local is newer).
   * Uses a direct upsert rather than the RPC to avoid re-running game logic.
   *
   * @param {Object} [local]  - pass if already loaded; re-reads from LS if omitted
   */
  async pushLocalToRemote(local) {
    if (!isLoggedIn()) return;
    const s = local || _lsGet(_STREAK_LS_KEY, {});
    if (!s.count && !s.totalXP) return; // nothing worth pushing
    await upsert('streak_state', {
      user_id:        _uid(),
      streak_count:   s.count         || 0,
      longest_streak: s.longest       || 0,
      last_study_date:s.lastStudyDate || null,
      total_xp:       s.totalXP       || 0,
      freeze_tokens:  s.freezeTokens  || 0,
      active_theme:   s.activeTheme   || 'Default',
      milestones:     s.milestones    || [],
    }, 'user_id');
  },

  /**
   * Award a freeze token to the current user.
   */
  async awardFreezeToken() {
    // Update localStorage
    const local = _lsGet(_STREAK_LS_KEY, {});
    local.freezeTokens = (local.freezeTokens || 0) + 1;
    _lsSet(_STREAK_LS_KEY, local);
    if (!isLoggedIn()) return { data: null, error: null };
    return _rpc('award_freeze_token', { p_user_id: _uid() });
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// ws — Workspace reading position
// Table: ws_state  (created in migration 005)
// ══════════════════════════════════════════════════════════════════════════════

const ws = {

  /**
   * Save the current reading position for a book.
   * Debounce this on the caller side — don't call on every scroll pixel.
   *
   * @param {string} bookId
   * @param {{ page?: number, zoom?: number, scrollTop?: number }} pos
   */
  async savePosition(bookId, pos = {}) {
    // Write to localStorage
    if (pos.page  != null) _lsSet('chunks_ws_page_'  + bookId, pos.page);
    if (pos.zoom  != null) _lsSet('chunks_ws_zoom_'  + bookId, pos.zoom);
    _lsSet('chunks_active_ws_book', bookId);
    // Use raw setItem (not _lsSet) so readers using localStorage.getItem() receive
    // a plain string, not a JSON-stringified one (e.g. '"__user_doc__"').
    try { localStorage.setItem('chunks_default_book', bookId); } catch (e) {}

    if (!isLoggedIn()) return { data: null, error: null };

    return _rpc('upsert_book_position', {
      p_user_id:    _uid(),
      p_book_id:    bookId,
      p_page:       pos.page      ?? null,
      p_zoom:       pos.zoom      ?? null,
      p_scroll_top: pos.scrollTop ?? null,
    });
  },

  /**
   * Save panel visibility (sidebar open/closed, chat panel open/closed).
   * @param {{ sidebarOpen?: boolean, chatOpen?: boolean }} panels
   */
  async savePanels(panels = {}) {
    if (!isLoggedIn()) return { data: null, error: null };
    return _rpc('upsert_ws_panels', {
      p_user_id:      _uid(),
      p_sidebar_open: panels.sidebarOpen ?? null,
      p_chat_open:    panels.chatOpen    ?? null,
    });
  },

  /**
   * Pull workspace state from Supabase and apply to localStorage.
   * Called on login to restore reading position from another device.
   *
   * @returns {{ data: Object|null, error }}
   */
  async pullAndApply() {
    if (!isLoggedIn()) return { data: null, error: 'not_logged_in' };

    const { data, error } = await get('ws_state', {});
    if (error || !data || !data.length) return { data: null, error };

    const row = data[0];

    // Apply active book
    if (row.active_book_id) {
      const localBook  = _lsGet('chunks_active_ws_book');
      const localVisit = _lsGet('chunks_ws_last_visited');
      if (_remoteIsNewer(row.updated_at, localVisit)) {
        // Bug #5 fix: only notify if this device had a prior ws position recorded.
        if (localVisit) _notifyConflict('ws_state');
        _lsSet('chunks_active_ws_book', row.active_book_id);
        // Use raw setItem — see savePosition comment above.
        try { localStorage.setItem('chunks_default_book', row.active_book_id); } catch (e) {}
      }
    }

    // Apply per-book positions — only for books where remote is newer
    const positions = row.book_positions || {};
    for (const [bookId, pos] of Object.entries(positions)) {
      const localPageKey    = 'chunks_ws_page_' + bookId;
      const localZoomKey    = 'chunks_ws_zoom_' + bookId;
      const localVisitedAt  = _lsGet('chunks_ws_visited_' + bookId);

      if (_remoteIsNewer(pos.visited_at, localVisitedAt)) {
        if (pos.page != null) _lsSet(localPageKey, pos.page);
        if (pos.zoom != null) _lsSet(localZoomKey, pos.zoom);
        _lsSet('chunks_ws_visited_' + bookId, pos.visited_at);
      }
    }

    // Apply panel state
    if (row.updated_at) {
      _lsSet('chunks_ws_last_visited', row.updated_at);
    }

    return { data: row, error: null };
  },

  /**
   * Push local workspace state up to Supabase for all known books.
   * Called when local is newer than remote on login.
   */
  async pushLocalToRemote() {
    if (!isLoggedIn()) return;
    const activeBook = _lsGet('chunks_active_ws_book');
    if (!activeBook) return;

    // Build book_positions map from all chunks_ws_page_* keys
    const positions = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('chunks_ws_page_')) {
          const bookId = k.replace('chunks_ws_page_', '');
          positions[bookId] = {
            page:       _lsGet(k),
            zoom:       _lsGet('chunks_ws_zoom_' + bookId),
            visited_at: _lsGet('chunks_ws_visited_' + bookId) || new Date().toISOString(),
          };
        }
      }
    } catch (_) {}

    await upsert('ws_state', {
      user_id:        _uid(),
      active_book_id: activeBook,
      book_positions: positions,
    }, 'user_id');
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// studyPlan — Cross-device study plan + mastery persistence
// Table: study_plans  PK: (user_id, id)
// ══════════════════════════════════════════════════════════════════════════════

const studyPlan = {

  /**
   * Upsert one plan entry into Supabase.
   * Called by spMasteryRecord (on every mastery write) and
   * spSaveCurrentPlanToLibrary. localStorage is always written first
   * by the caller — this is purely additive.
   *
   * @param {string} id     - client plan id, e.g. "plan_1710000000000_abc12"
   * @param {{ plan, mastery, topic, examDate, savedAt }} entry
   */
  async save(id, entry) {
    if (!isLoggedIn()) return { data: null, error: null };
    return upsert('study_plans', {
      id,
      user_id:    _uid(),
      plan:       entry.plan    || {},
      mastery:    entry.mastery || {},
      topic:      entry.topic   || null,
      exam_date:  entry.examDate || null,
      saved_at:   entry.savedAt || Date.now(),
      is_deleted: false,
    }, 'user_id,id');
  },

  /**
   * Soft-delete a plan so the deletion propagates to other devices on next pull.
   * @param {string} id
   */
  async remove(id) {
    if (!isLoggedIn()) return { data: null, error: null };
    const sb = await _sb();
    if (!sb) return { data: null, error: 'no_client' };
    return sb.from('study_plans')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('user_id', _uid())
      .eq('id', id);
  },

  /**
   * Pull all plans from Supabase and merge into localStorage.
   * Called by pullAll() on login — runs before spInitScreen reads localStorage,
   * so the restore path always sees the latest remote data.
   *
   * Merge rule: remote wins on updated_at (same as chat / ws).
   * Soft-deleted rows propagate deletes to this device.
   *
   * @returns {{ data: Object|null, error }}
   */
  async pullAndApply() {
    if (!isLoggedIn()) return { data: null, error: 'not_logged_in' };

    const { data, error } = await get('study_plans', {
      order: { col: 'updated_at', asc: false },
      limit: 200,
    });
    if (error || !data?.length) return { data: null, error };

    let localPlans = _lsGet('sp_all_plans', {});

    let changed = false;
    for (const row of data) {
      if (row.is_deleted) {
        if (localPlans[row.id]) { delete localPlans[row.id]; changed = true; }
        continue;
      }
      const local    = localPlans[row.id];
      const localTs  = local?.savedAt || 0;
      const remoteTs = new Date(row.updated_at).getTime();
      if (remoteTs > localTs) {
        localPlans[row.id] = {
          plan:     row.plan,
          mastery:  row.mastery,
          topic:    row.topic,
          examDate: row.exam_date,
          savedAt:  row.saved_at || remoteTs,
        };
        changed = true;
      }
    }

    if (changed) {
      _lsSet('sp_all_plans', localPlans);
      // If the active plan was refreshed from remote, keep sp_active_plan +
      // sp_active_mastery in sync so spInitScreen reads the right data.
      const activeId = localStorage.getItem('sp_active_plan_id');
      if (activeId && localPlans[activeId]) {
        _lsSet('sp_active_plan',    localPlans[activeId].plan);
        _lsSet('sp_active_mastery', localPlans[activeId].mastery);
      }
    }

    return { data: localPlans, error: null };
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// pullAll — Login merge: run all four pull-and-apply in parallel
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Called once after a successful login or session restore.
 * Pulls all four tables from Supabase in parallel and merges with
 * local data using last-write-wins on updated_at.
 *
 * Also pushes any local data that is newer than remote back up,
 * so the first login on a new device after offline use doesn't lose data.
 *
 * @returns {Promise<void>}
 */
// Wraps a promise with a timeout so a single stalled Supabase request
// never hangs pullAll indefinitely. Resolves with { timedOut: true } on timeout
// so Promise.allSettled still sees a settled promise (not a rejection).
function _withTimeout(promise, ms, label) {
  const timer = new Promise(resolve =>
    setTimeout(() => {
      console.warn(`[ChunksDB] ${label} timed out after ${ms}ms`);
      resolve({ timedOut: true });
    }, ms)
  );
  return Promise.race([promise, timer]);
}

// ── Timestamp of the last successful upload ───────────────────────────────────
// Persisted to localStorage so returning users only upload sessions changed
// since their previous sync — skipping the full 189-session scan on every login.
const _LAST_UPLOAD_TS_KEY = 'chunks_last_upload_ts';

/** Retrieve the last successful upload timestamp (ms), or 0 if never synced. */
function _getLastUploadTs() {
  try { return parseInt(localStorage.getItem(_LAST_UPLOAD_TS_KEY) || '0', 10) || 0; }
  catch (_) { return 0; }
}

/** Persist the last successful upload timestamp. */
function _setLastUploadTs(ts) {
  try { localStorage.setItem(_LAST_UPLOAD_TS_KEY, String(ts)); } catch (_) {}
}

/**
 * Upload a pre-built batch array to Supabase in chunks of CHUNK_SIZE,
 * with a small yield between each chunk so the browser event loop stays
 * responsive and Supabase free-tier request limits are respected.
 *
 * @param {Object[]} rows    - fully-formed chat_sessions upsert payloads
 * @param {number}   chunkSz - rows per round-trip (default 20)
 * @returns {Promise<boolean>} true if all chunks succeeded
 */
const _UPLOAD_CHUNK_SIZE = 20;

async function _uploadInChunks(rows, chunkSz = _UPLOAD_CHUNK_SIZE) {
  const sb = await _sb();
  if (!sb || !rows.length) return true;

  let allOk = true;
  for (let i = 0; i < rows.length; i += chunkSz) {
    const chunk = rows.slice(i, i + chunkSz);
    const { error } = await sb
      .from('chat_sessions')
      .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
    if (error) {
      console.warn(`[ChunksDB] chunk upload error (rows ${i}–${i + chunk.length - 1}):`, error.message);
      allOk = false;
    }
    // Yield between chunks so the browser stays responsive and we avoid
    // hammering Supabase free-tier rate limits on large session sets.
    if (i + chunkSz < rows.length) await new Promise(r => setTimeout(r, 50));
  }
  return allOk;
}

// Tracks the timestamp of the last completed pullAll so rapid re-calls
// (from TOKEN_REFRESHED, visibilitychange, or online events) are suppressed.
let _lastPullAllTime = 0;
const PULLALL_COOLDOWN_MS = 60_000; // 60 seconds between full syncs

// Tracks whether this is the very first pullAll of the current browser session.
// First login gets a 60s upload timeout; subsequent syncs use 30s.
let _isFirstPullAll = true;

async function pullAll({ force = false } = {}) {
  if (!isLoggedIn()) return;

  // Cooldown guard: prevents overlapping pulls from TOKEN_REFRESHED / visibilitychange.
  // Pass { force: true } to bypass — used by loginSync on first load and manual retries.
  const now = Date.now();
  if (!force && now - _lastPullAllTime < PULLALL_COOLDOWN_MS) {
    console.log(`[ChunksDB] pullAll skipped — last sync was ${Math.round((now - _lastPullAllTime) / 1000)}s ago`);
    return;
  }
  _lastPullAllTime = now;

  // Raise the upload timeout to 60s on the very first pullAll (fresh login with
  // potentially hundreds of unsynced sessions). Subsequent syncs keep 30s since
  // the delta filter means only recently-changed sessions are uploaded.
  const uploadTimeoutMs = _isFirstPullAll ? 60_000 : 30_000;
  _isFirstPullAll = false;

  console.log('[ChunksDB] pullAll — merging cross-device state…');
  try {
    // Step 1: upload local-only sessions FIRST.
    await _withTimeout(_uploadLocalChatSessions(), uploadTimeoutMs, '_uploadLocalChatSessions');

    // Step 2: settings MUST complete before chat — it restores server-side tombstones
    // into localStorage so that chat.pullAndApply and _hydrateRecentFromRemote can
    // filter deleted sessions correctly. Running them in parallel caused a race where
    // _hydrateRecentFromRemote ran before tombstones arrived, putting deleted sessions
    // back in the sidebar on every login.
    await _withTimeout(settings.pullAndApply(), 30000, 'settings.pullAndApply');

    // Step 3: streak, ws, chat, and studyPlan can now run in parallel safely.
    await Promise.allSettled([
      _withTimeout(streak.pullAndApply(),      30000, 'streak.pullAndApply'),
      _withTimeout(ws.pullAndApply(),          30000, 'ws.pullAndApply'),
      _withTimeout(chat.pullAndApply(),        30000, 'chat.pullAndApply'),
      _withTimeout(studyPlan.pullAndApply(),   30000, 'studyPlan.pullAndApply'),
    ]);

    console.log('[ChunksDB] pullAll — done ✦');
  } catch (e) {
    // Reset the timestamp so the next loginSync retry isn't blocked by a failed pull
    _lastPullAllTime = 0;
    console.warn('[ChunksDB] pullAll error:', e.message);
    throw e; // re-throw so SyncManager can reset _chunksSyncFired
  }
}

/**
 * Upload any chat sessions stored only in localStorage to Supabase.
 * Runs once on login. Skips sessions that are already in Supabase
 * (the upsert on conflict(id) is idempotent).
 */
async function _uploadLocalChatSessions() {
  if (!isLoggedIn()) return;
  try {
    // Collect all session keys from IndexedDB / localStorage
    const keys = _idbKeys('chunks_session_');
    // Also include any that were queued while logged out / uid not yet ready
    const pending = _lsGet('chunks_pending_upload_sessions', []);
    pending.forEach(id => {
      const k = 'chunks_session_' + id;
      if (!keys.includes(k)) keys.push(k);
    });

    // Track newly-assigned UUIDs so we can hydrate _recentItems afterwards.
    const newlyAssigned = [];
    const uploadBatch   = [];  // collected payloads for a single batch upsert

    for (const k of keys) {
      const s = _lsGet(k);
      if (!s) continue;

      // Skip sessions that were explicitly deleted by the user.
      // Without this guard, a session with no supabaseId would get a fresh UUID
      // and be re-uploaded, making deletes appear to "come back" after sync.
      const _tombs = _lsGet('chunks_deleted_sessions', []);
      if (_tombs.includes(s.id) || (s.supabaseId && _tombs.includes(s.supabaseId))) continue;

      // Resolve the supabaseId for this session.
      // Priority: explicit supabaseId field → UUID-shaped s.id → generate new UUID.
      // A UUID-shaped s.id means this entry was written by pullAndApply (it IS the
      // Supabase row already) — never generate a new UUID for it or it will create
      // a duplicate row on every login ("50 UUIDs generated" in the console).
      const _isUUID = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!s.supabaseId || /^r[0-9]+$/.test(s.supabaseId)) {
        if (_isUUID(s.id)) {
          // s.id is already the UUID — use it directly, no new UUID needed
          s.supabaseId = s.id;
          _lsSet(k, s);
        } else {
          // Genuinely new local-only session — assign a fresh UUID
          s.supabaseId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
              });
          _lsSet(k, s);
          newlyAssigned.push({ id: s.id, uuid: s.supabaseId, title: s.title, bookId: s.bookId, updatedAt: s.updatedAt });
        }
      }

      const messages = s.history || s.messages || [];
      if (!messages.length) continue;

      uploadBatch.push({
        id:         s.supabaseId,
        user_id:    _uid(),
        local_id:   /^r[0-9]+$/.test(s.id) ? s.id : null,
        book_id:    s.bookId   || null,
        title:      s.title    || null,
        messages,
        updated_at: s.updatedAt || new Date().toISOString(),
      });
    }

    // Deduplicate by supabaseId — prefer the r+timestamp keyed entry over the UUID keyed entry.
    // Each session exists under TWO localStorage keys (r+timestamp AND UUID).
    // The UUID-keyed entry always has local_id=null (s.id is UUID, fails /^r[0-9]+$/ test).
    // The r+timestamp-keyed entry has local_id set correctly.
    // Without this preference, uploading the UUID entry first wipes local_id in Supabase
    // which breaks tombstone matching and cross-device restore for every session.
    const _seenIds = new Map(); // supabaseId → index in dedupedBatch
    const dedupedBatch = [];
    for (const row of uploadBatch) {
      if (_seenIds.has(row.id)) {
        // Replace the existing entry only if this one has local_id and the stored one doesn't
        const idx = _seenIds.get(row.id);
        if (row.local_id && !dedupedBatch[idx].local_id) {
          dedupedBatch[idx] = row;
        }
      } else {
        _seenIds.set(row.id, dedupedBatch.length);
        dedupedBatch.push(row);
      }
    }

    // ── Delta filter ─────────────────────────────────────────────────────────
    // Returning users: only upload sessions changed since the last successful
    // upload. This cuts the typical upload from 189 → low-single-digit rows,
    // keeping the 30s wall well out of reach on every login after the first.
    const lastUploadTs = _getLastUploadTs();
    const filteredBatch = lastUploadTs > 0
      ? dedupedBatch.filter(row => {
          const ts = row.updated_at ? new Date(row.updated_at).getTime() : 0;
          return ts > lastUploadTs;
        })
      : dedupedBatch; // first sync ever — upload everything

    if (filteredBatch.length) {
      console.log(`[ChunksDB] uploading ${filteredBatch.length}/${dedupedBatch.length} sessions (delta since ${new Date(lastUploadTs).toISOString()})`);
      const ok = await _uploadInChunks(filteredBatch, _UPLOAD_CHUNK_SIZE);
      if (ok) _setLastUploadTs(Date.now());
    } else {
      console.log('[ChunksDB] _uploadLocalChatSessions — no new sessions since last sync');
    }

    // Hydrate _recentItems with any sessions that just got a fresh UUID so that
    // subsequent _saveSession calls can route writes to Supabase correctly.
    if (newlyAssigned.length) {
      try {
        window._hydrateRecentFromRemote?.(newlyAssigned.map(n => ({
          id:         n.uuid,
          local_id:   n.id,
          title:      n.title    || null,
          book_id:    n.bookId   || null,
          updated_at: n.updatedAt || new Date().toISOString(),
          messages:   [],
        })));
      } catch (_) {}
    }

    // Clear the pending queue now that everything is uploaded
    _lsRemove('chunks_pending_upload_sessions');
    console.log(`[ChunksDB] _uploadLocalChatSessions — ${keys.length} candidates scanned, ${filteredBatch?.length ?? 0} uploaded in chunks of ${_UPLOAD_CHUNK_SIZE} (${newlyAssigned.length} UUIDs generated)`);
  } catch (e) {
    console.warn('[ChunksDB] _uploadLocalChatSessions error:', e.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const ChunksDB = {
  // Core CRUD
  get, insert, upsert, update, remove,
  isLoggedIn,
  lsGet, lsSet, lsRemove,

  // Phase 2: cross-device sync namespaces
  chat,
  settings,
  streak,
  ws,
  studyPlan,
  pullAll,
};

console.log('[ChunksDB] Sync layer ready ✦  (Phase 2: chat · settings · streak · ws · studyPlan)');
