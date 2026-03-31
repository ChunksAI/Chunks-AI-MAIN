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
import { lsGet as _lsGet, lsSet as _lsSet, lsRemove as _lsRemove, memKeys as _memKeys, memClear } from '../utils/storage.js';
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

// Deduplication guard: tracks in-flight appendMessage RPC calls.
// Key format: "<sessionId>:<ts>:<content_prefix>" — prevents a concurrent or
// duplicate call for the exact same message from firing a second RPC before the
// first one resolves (e.g. rapid re-send, retry logic, or race conditions).
const _appendInflight = new Set();

/**
 * Normalize a message object before persisting.
 * Ensures every stored message has:
 *   • created_at — ISO-8601 timestamp (derived from ts when available)
 *   • type       — always 'chat'
 * Fields already present are never overwritten.
 */
function _normalizeMessage(message) {
  return {
    ...message,
    type:       message.type       || 'chat',
    created_at: message.created_at
                  || (message.ts ? new Date(message.ts).toISOString()
                                 : new Date().toISOString()),
  };
}

const chat = {

  /**
   * Append a single message turn to an existing or new session.
   * Preferred over saveFull for real-time appends — sends only the new turn.
   *
   * Safeguards:
   *   1. Normalizes the message to include `created_at`, `type`, and
   *      `document_id` (via p_book_id) before any write.
   *   2. Deduplicates concurrent RPC calls for the same session+message so
   *      the same turn is never inserted twice even if the caller fires twice.
   *
   * @param {string} sessionId  - UUID (generate client-side with crypto.randomUUID)
   * @param {{ role: string, content: string, ts?: number }} message
   * @param {{ bookId?: string, title?: string, localId?: string }} [meta]
   */
  async appendMessage(sessionId, message, meta = {}) {
    // Normalize before any write so localStorage and Supabase store identical shape
    const normalizedMessage = _normalizeMessage(message);

    // Always write to localStorage first — this is the source of truth
    // for the current device and the upload fallback if Supabase is unreachable.
    const key = 'chunks_session_' + sessionId;
    const session = _lsGet(key, { id: sessionId, history: [], ...meta });
    session.history = [...(session.history || []), normalizedMessage];
    session.updatedAt = new Date().toISOString();
    if (meta.bookId) session.bookId = meta.bookId;
    if (meta.title)  session.title  = meta.title;
    _lsSet(key, session);
    _lsSet('chunks_active_home_session', sessionId);

    // Guard: _uid() must be non-null for the RPC — if not ready yet, return
    if (!isLoggedIn() || !_uid()) return { data: null, error: null };

    // In-flight deduplication: suppress a second RPC for the same message while
    // the first one is still awaiting a response from Supabase.
    const dedupKey = `${sessionId}:${normalizedMessage.created_at}:${(normalizedMessage.content || '').slice(0, 40)}`;
    if (_appendInflight.has(dedupKey)) {
      console.warn('[ChunksDB] appendMessage: duplicate suppressed for session', sessionId);
      return { data: null, error: null };
    }
    _appendInflight.add(dedupKey);
    try {
      return await _rpc('append_chat_message', {
        p_session_id: sessionId,
        p_user_id:    _uid(),
        p_message:    normalizedMessage,
        p_book_id:    meta.bookId  || null,
        p_title:      meta.title   || null,
        p_local_id:   meta.localId || null,
      });
    } finally {
      _appendInflight.delete(dedupKey);
    }
  },

  /**
   * Save (or overwrite) an entire session — use for initial save or bulk import
   * from localStorage on login.
   *
   * @param {{ id, messages, bookId?, title?, updatedAt? }} session
   */
  async saveFull(session) {
    if (!isLoggedIn()) return { data: null, error: null };
    // Normalize every message so stored JSON has consistent created_at / type fields
    const messages = (session.messages || session.history || []).map(_normalizeMessage);
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
      return { data: [], error: null };
    }
    return get('chat_sessions', {
      order: { col: 'updated_at', asc: false },
      limit,
    });
  },

  /**
   * Fetch the chat history for a specific book/document from Supabase.
   *
   * Always queries Supabase directly — never reads localStorage — so the
   * result always reflects the authoritative database state.  Call this on
   * every page load and every document change to keep the chat panel current.
   *
   * @param {string} bookId  - book/document identifier (maps to `book_id` column)
   * @returns {{ data: Array<{role,content,created_at,type}>, error }}
   *   data — messages ordered by created_at ascending; empty array when none found.
   */
  async getSessionByBook(bookId) {
    // Guests and unauthenticated users have no Supabase session — return empty.
    if (!isLoggedIn()) return { data: [], error: null };

    const { data, error } = await get('chat_sessions', {
      eq:    { book_id: bookId },
      order: { col: 'updated_at', asc: false },
      limit: 1,
    });

    if (error || !data?.length) return { data: [], error: error || null };

    // Sort messages within the session chronologically (created_at ascending)
    // so the chat panel always renders in the correct send-order.
    const messages = (data[0].messages || []).slice().sort((a, b) => {
      if (!a.created_at) return -1;
      if (!b.created_at) return  1;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    console.log('[ChunksDB] getSessionByBook — loaded chats for book', bookId, ':', messages.length, 'messages');
    return { data: messages, error: null };
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
    const currentActive = _lsGet('chunks_active_home_session');
    const currentLocalSession = currentActive ? _lsGet('chunks_session_' + currentActive) : null;
    const currentLocalTime = currentLocalSession?.updatedAt
      ? new Date(currentLocalSession.updatedAt).getTime() : 0;
    const remoteIsStrictlyNewer = newestTime > currentLocalTime + 5000; // >5s newer

    if (newestLocalId && (!currentActive || remoteIsStrictlyNewer)) {
      _lsSet('chunks_active_home_session', newestLocalId);
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
    console.log('[ChunksDB] deleteSession — deleting chat id:', sessionId);
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
        _lsSet('chunks_setting_' + _SETTINGS_COL_TO_LS[col], typeof val === 'string' ? val : JSON.stringify(val));
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

    // Always restore server-side tombstones
    try {
      const serverDeleted = row.notifications?.deleted_sessions || [];
      if (serverDeleted.length) {
        const localTombs = _lsGet('chunks_deleted_sessions', []);
        const merged = [...new Set([...localTombs, ...serverDeleted])].slice(-200);
        _lsSet('chunks_deleted_sessions', merged);
        console.log(`[ChunksDB] restored ${serverDeleted.length} server-side tombstones`);
      }
    } catch (_) {}

    // Apply remote settings into the in-memory store
    if (row.appearance)       _lsSet('chunks_setting_appearance',       row.appearance);
    if (row.chat_font_size)   _lsSet('chunks-chat-font-size',           row.chat_font_size);
    if (row.accent)           _lsSet('chunks_setting_accent',           row.accent);
    if (row.language)         _lsSet('chunks_setting_language',         row.language);
    if (row.spoken_language)  _lsSet('chunks_setting_spoken-language',  row.spoken_language);
    if (row.voice)            _lsSet('chunks_setting_voice',            row.voice);
    if (row.separate_voice !== undefined) _lsSet('chunks_setting_separate-voice', row.separate_voice ? '1' : '0');
    if (row.safe_content    !== undefined) _lsSet('chunks_setting_safe-content',  row.safe_content    ? '1' : '0');

    return { data: row, error: null };
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
    // Remote always wins — populate in-memory cache from Supabase
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
    return { data: row, error: null };
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
    _lsSet('chunks_default_book', bookId);

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

    if (row.active_book_id) {
      _lsSet('chunks_active_ws_book', row.active_book_id);
      _lsSet('chunks_default_book', row.active_book_id);
    }

    const positions = row.book_positions || {};
    for (const [bookId, pos] of Object.entries(positions)) {
      if (pos.page != null) _lsSet('chunks_ws_page_' + bookId, pos.page);
      if (pos.zoom != null) _lsSet('chunks_ws_zoom_' + bookId, pos.zoom);
      _lsSet('chunks_ws_visited_' + bookId, pos.visited_at);
    }

    if (row.updated_at) _lsSet('chunks_ws_last_visited', row.updated_at);
    return { data: row, error: null };
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
      const activeId = _lsGet('sp_active_plan_id');
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

// Tracks the timestamp of the last completed pullAll so rapid re-calls
// (from TOKEN_REFRESHED, visibilitychange, or online events) are suppressed.
let _lastPullAllTime = 0;
const PULLALL_COOLDOWN_MS = 60_000; // 60 seconds between full syncs

// Tracks whether this is the very first pullAll of the current browser session.
let _isFirstPullAll = true;

async function pullAll({ force = false } = {}) {
  if (!isLoggedIn()) return;
  const now = Date.now();
  if (!force && now - _lastPullAllTime < PULLALL_COOLDOWN_MS) {
    console.log(`[ChunksDB] pullAll skipped — last sync was ${Math.round((now - _lastPullAllTime) / 1000)}s ago`);
    return;
  }
  _lastPullAllTime = now;
  _isFirstPullAll = false;
  console.log('[ChunksDB] pullAll — merging cross-device state…');
  try {
    // settings MUST complete before chat — restores server-side tombstones
    await _withTimeout(settings.pullAndApply(), 30000, 'settings.pullAndApply');
    // streak, ws, chat, studyPlan in parallel
    await Promise.allSettled([
      _withTimeout(streak.pullAndApply(),      30000, 'streak.pullAndApply'),
      _withTimeout(ws.pullAndApply(),          30000, 'ws.pullAndApply'),
      _withTimeout(chat.pullAndApply(),        30000, 'chat.pullAndApply'),
      _withTimeout(studyPlan.pullAndApply(),   30000, 'studyPlan.pullAndApply'),
      _withTimeout(recentItems.pullAndApply(), 30000, 'recentItems.pullAndApply'),
    ]);
    console.log('[ChunksDB] pullAll — done ✦');
  } catch (e) {
    _lastPullAllTime = 0;
    console.warn('[ChunksDB] pullAll error:', e.message);
    throw e;
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// recentItems — exam_recent + sp_recent_plans cross-device sync
// Table: recent_items  (created in migration 011)
// These are lightweight sidebar list arrays — tiny payloads, last-write-wins.
// ══════════════════════════════════════════════════════════════════════════════

const recentItems = {

  /**
   * Push local exam_recent and/or sp_recent_plans up to Supabase.
   * Call this whenever either list changes (fire-and-forget).
   *
   * @param {{ examRecent?: Array, spRecentPlans?: Array }} [opts]
   */
  async patch(opts = {}) {
    if (!isLoggedIn()) return { data: null, error: null };
    const examRecent    = opts.examRecent    ?? _lsGet('exam_recent',     []);
    const spRecentPlans = opts.spRecentPlans ?? _lsGet('sp_recent_plans', []);
    return _rpc('patch_recent_items', {
      p_user_id:          _uid(),
      p_exam_recent:      examRecent,
      p_sp_recent_plans:  spRecentPlans,
    });
  },

  /**
   * Pull exam_recent and sp_recent_plans from Supabase and merge into localStorage.
   * Remote wins if the row is newer than what's locally stored (last-write-wins on updated_at).
   * Called by pullAll() on login.
   *
   * @returns {{ data: Object|null, error }}
   */
  async pullAndApply() {
    if (!isLoggedIn()) return { data: null, error: 'not_logged_in' };
    const sb = await _sb();
    if (!sb) return { data: null, error: 'no_client' };
    try {
      const { data, error } = await sb.from('recent_items').select('*').eq('user_id', _uid()).single();
      if (error || !data) return { data: null, error: error || null };
      try {
        const remoteExam = Array.isArray(data.exam_recent) ? data.exam_recent : [];
        const remoteSp   = Array.isArray(data.sp_recent_plans) ? data.sp_recent_plans : [];
        if (remoteExam.length) {
          _lsSet('exam_recent', remoteExam);
          console.log(`[ChunksDB] recentItems — restored ${remoteExam.length} exam entries`);
        }
        if (remoteSp.length) {
          _lsSet('sp_recent_plans', remoteSp);
          try { window._renderRecentPlansAllSidebars?.(); } catch (_) {}
          console.log(`[ChunksDB] recentItems — restored ${remoteSp.length} study plan entries`);
        }
      } catch (parseErr) {
        console.warn('[ChunksDB] recentItems — parse error:', parseErr.message);
      }
      return { data, error: null };
    } catch (e) {
      console.warn('[ChunksDB] recentItems.pullAndApply error:', e.message);
      return { data: null, error: e.message };
    }
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export const ChunksDB = {
  // Core CRUD
  get, insert, upsert, update, remove,
  isLoggedIn,
  lsGet: _lsGet, lsSet: _lsSet, lsRemove: _lsRemove,

  // Phase 2: cross-device sync namespaces
  chat,
  settings,
  streak,
  ws,
  studyPlan,
  recentItems,
  pullAll,
};

console.log('[ChunksDB] Sync layer ready ✦  (Phase 2: chat · settings · streak · ws · studyPlan · recentItems)');
