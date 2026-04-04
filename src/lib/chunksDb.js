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

/** Test whether a string is a valid UUID (used in several places). */
const _isUUID = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

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
   * @param {{ bookId?: string, title?: string }} [meta]
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

    // Queue this session id for upload in case _uid() isn't ready yet
    const _pending = _lsGet('chunks_pending_upload_sessions', []);
    if (!_pending.includes(sessionId)) {
      _lsSet('chunks_pending_upload_sessions', [..._pending, sessionId]);
    }

    // Guard: _uid() must be non-null for the RPC — if not ready yet,
    // the pending queue (_uploadLocalChatSessions on next pullAll) will catch it
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
      });
    } finally {
      _appendInflight.delete(dedupKey);
    }
  },

  /**
   * Save (or overwrite) an entire session — use for initial save or bulk import
   * from localStorage on login.
   *
   * Post-migration: chat_sessions is metadata-only (no messages JSONB column).
   * Messages are written to the per-row `messages` table.
   *
   * @param {{ id, messages, bookId?, title?, updatedAt? }} session
   */
  async saveFull(session) {
    if (!isLoggedIn()) {
      _lsSet('chunks_session_' + session.id, session);
      _lsSet('chunks_active_home_session', session.id);
      return { data: null, error: null };
    }
    // Normalize every message so stored JSON has consistent created_at / type fields
    const normalizedMsgs = (session.messages || session.history || []).map(_normalizeMessage);

    // Upsert session metadata (no messages column)
    const metaResult = await upsert('chat_sessions', {
      id:         session.id,
      book_id:    session.bookId   || null,
      title:      session.title    || null,
      updated_at: session.updatedAt || new Date().toISOString(),
    }, 'id');

    // Write messages to the per-row messages table (skip if title-only update)
    if (normalizedMsgs.length) {
      const sb = await _sb();
      if (sb) {
        // Batch insert normalized messages
        const BATCH = 200;
        const msgRows = normalizedMsgs.map(m => ({
          user_id:    _uid(),
          role:       m.role,
          content:    m.content,
          session_id: session.id,
          book_id:    session.bookId || null,
          created_at: m.created_at || new Date().toISOString(),
        }));

        // Insert messages — append-only strategy (no delete-then-reinsert).
        // Uses ON CONFLICT DO NOTHING semantics via unique server-side UUIDs.
        for (let i = 0; i < msgRows.length; i += BATCH) {
          const { error } = await sb.from('messages').insert(msgRows.slice(i, i + BATCH));
          if (error) {
            console.warn('[ChunksDB] saveFull messages batch error:', error.message);
            break;
          }
        }
      }
    }

    return metaResult;
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
   * Fetch the chat history for a specific book/document from Supabase.
   *
   * Post-migration: reads from the per-row `messages` table instead of
   * the JSONB column on chat_sessions.
   *
   * @param {string} bookId  - book/document identifier (maps to `book_id` column)
   * @returns {{ data: Array<{role,content,created_at,type}>, error }}
   *   data — messages ordered by created_at ascending; empty array when none found.
   */
  async getSessionByBook(bookId) {
    // Guests and unauthenticated users have no Supabase session — return empty.
    if (!isLoggedIn()) return { data: [], error: null };

    const { data, error } = await messages.fetchMessages({ bookId });

    if (error || !data?.length) return { data: [], error: error || null };

    // Deduplicate: earlier code inserted the full history on every save, which
    // created multiple copies of older messages in the table.  Keep only the
    // first occurrence of each (role, content) pair in chronological order so
    // the restored history reflects the true conversation sequence.
    const seen = new Set();
    const deduped = data.filter(m => {
      const key = JSON.stringify([m.role, m.content]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log('[ChunksDB] getSessionByBook — loaded chats for book', bookId, ':',
      data.length, 'rows →', deduped.length, 'unique messages');
    return { data: deduped, error: null };
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
      select: 'id,user_id,book_id,title,created_at,updated_at',
      order: { col: 'updated_at', asc: false },
      limit: 200,
    });

    if (error || !remoteSessions?.length) return { data: null, error };

    // Write each remote session into localStorage so the page restore path
    // picks it up. Only overwrite if remote is newer than what's already local.
    let newestId       = null;   // UUID of the most recently updated remote session
    let newestTime     = 0;

    // Load tombstone list once outside the loop (performance)
    const _pullTombs = (() => {
      try { return new Set(_lsGet('chunks_deleted_sessions', [])); }
      catch(_) { return new Set(); }
    })();

    for (const remote of remoteSessions) {
      if (!remote.id) continue;

      // Tombstone check — deleted sessions are identified by UUID
      if (_pullTombs.has(remote.id)) {
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
          history:    localRaw?.history || [],  // preserve existing local history cache
          bookId:     remote.book_id  || null,
          title:      remote.title    || null,
          updatedAt:  remote.updated_at,
        });
        // Bug #5 fix: only fire conflict when local had content that got overwritten.
        const hadLocalContent = (localRaw?.history?.length || 0) > 0;
        const remoteIsMeaningfullyNewer = remoteTime > localTime + 1000; // >1s gap
        if (hadLocalContent && remoteIsMeaningfullyNewer) {
          _notifyConflict('chat_sessions');
        }
      }

      // Track the most recently updated session across all remote rows
      if (remoteTime > newestTime) {
        newestTime = remoteTime;
        newestId   = remote.id;
      }
    }

    // Update the active session pointer to the newest remote session
    // when there is no current active session or remote is strictly newer.
    const currentActive = localStorage.getItem('chunks_active_home_session');
    const currentLocalSession = currentActive ? _lsGet('chunks_session_' + currentActive) : null;
    const currentLocalTime = currentLocalSession?.updatedAt
      ? new Date(currentLocalSession.updatedAt).getTime() : 0;
    const remoteIsStrictlyNewer = newestTime > currentLocalTime + 5000; // >5s newer

    if (newestId && (!currentActive || remoteIsStrictlyNewer)) {
      localStorage.setItem('chunks_active_home_session', newestId);
    }

    console.log(`[ChunksDB] chat.pullAndApply — ${remoteSessions.length} sessions downloaded`);

    // Rebuild _recentItems from remote sessions
    try {
      window._hydrateRecentFromRemote?.(remoteSessions);
    } catch (e) {
      console.warn('[ChunksDB] _hydrateRecentFromRemote error:', e.message);
    }

    // Notify HomeScreen directly via CustomEvent
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
   * 4. DELETE the Supabase row + associated messages with retry
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

    // Delete messages from the messages table for this session
    await messages.deleteMessages({ sessionId });

    // DELETE the Supabase chat_sessions row with retry
    return _deleteWithRetry(sessionId);
  },

  /**
   * Delete ALL chat sessions for the current user from Supabase.
   * Used by "Delete all chat history" so the deletion persists across page
   * refreshes and other devices (otherwise pullAndApply re-downloads them).
   *
   * @returns {{ error }}
   */
  async deleteAllSessions() {
    if (!isLoggedIn()) return { error: null };

    const sb = await _sb();
    if (!sb) return { error: 'no_client' };

    try {
      // Delete all messages first
      await sb.from('messages').delete().eq('user_id', _uid());
      // Then delete all sessions
      const { error } = await sb
        .from('chat_sessions')
        .delete()
        .eq('user_id', _uid());
      if (error) console.warn('[ChunksDB] deleteAllSessions error:', error.message);
      return { error };
    } catch (e) {
      console.warn('[ChunksDB] deleteAllSessions threw:', e.message);
      return { error: e.message };
    }
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

  // Verify session before attempting uploads — prevents 403 when the JWT
  // is expired or the auth state hasn't fully initialised yet.
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) {
      console.warn('[ChunksDB] _uploadInChunks — no valid session, skipping');
      return false;
    }
  } catch (e) {
    console.warn('[ChunksDB] _uploadInChunks — session check failed:', e.message);
    return false;
  }

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

    // Step 3: streak, ws, chat, studyPlan, recentItems, and messages migration
    // can now run in parallel safely.
    await Promise.allSettled([
      _withTimeout(streak.pullAndApply(),                     30000, 'streak.pullAndApply'),
      _withTimeout(ws.pullAndApply(),                         30000, 'ws.pullAndApply'),
      _withTimeout(chat.pullAndApply(),                       30000, 'chat.pullAndApply'),
      _withTimeout(studyPlan.pullAndApply(),                  30000, 'studyPlan.pullAndApply'),
      _withTimeout(recentItems.pullAndApply(),                30000, 'recentItems.pullAndApply'),
      _withTimeout(messages.migrateFromLocalStorage(),        30000, 'messages.migrate'),
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
 * Collect all chunks_session_* keys from IndexedDB and localStorage.
 * Returns a deduplicated array of key strings.
 */
function _collectSessionKeys() {
  const keys = _idbKeys('chunks_session_');
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith('chunks_session_') && !keys.includes(k)) keys.push(k);
  }
  return keys;
}

/**
 * Upload any chat sessions stored only in localStorage to Supabase.
 * Runs once on login. Skips sessions that are already in Supabase
 * (the upsert on conflict(id) is idempotent).
 *
 * Post-migration: uploads session metadata to chat_sessions and message
 * content to the per-row messages table. No local_id or JSONB messages.
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
    const messageBatch  = [];  // messages to insert into the messages table

    // Load tombstone list once before the loop
    const _tombs = new Set(_lsGet('chunks_deleted_sessions', []));

    for (const k of keys) {
      const s = _lsGet(k);
      if (!s) continue;

      // Skip sessions that were explicitly deleted by the user.
      if (_tombs.has(s.id) || (s.supabaseId && _tombs.has(s.supabaseId))) continue;

      // Resolve the supabaseId for this session.
      if (!s.supabaseId || /^r[0-9]+$/.test(s.supabaseId)) {
        if (_isUUID(s.id)) {
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

      const localMsgs = s.history || s.messages || [];
      if (!localMsgs.length) continue;

      // Session metadata (no messages JSONB, no local_id)
      uploadBatch.push({
        id:         s.supabaseId,
        user_id:    _uid(),
        book_id:    s.bookId   || null,
        title:      s.title    || null,
        updated_at: s.updatedAt || new Date().toISOString(),
      });

      // Collect messages for the per-row messages table
      for (const msg of localMsgs) {
        if (!msg.role || !msg.content) continue;
        messageBatch.push({
          user_id:    _uid(),
          role:       msg.role,
          content:    msg.content,
          session_id: s.supabaseId,
          book_id:    s.bookId || null,
          created_at: msg.created_at || new Date().toISOString(),
        });
      }
    }

    // Deduplicate by supabaseId — keep first occurrence
    const _seenIds = new Map();
    const dedupedBatch = [];
    for (const row of uploadBatch) {
      if (!_seenIds.has(row.id)) {
        _seenIds.set(row.id, dedupedBatch.length);
        dedupedBatch.push(row);
      }
    }

    // ── Delta filter ─────────────────────────────────────────────────────────
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
      if (ok) {
        _setLastUploadTs(Date.now());
        // Upload messages to the messages table in batches
        if (messageBatch.length) {
          const sb = await _sb();
          if (sb) {
            const MSG_BATCH = 200;
            for (let i = 0; i < messageBatch.length; i += MSG_BATCH) {
              const { error } = await sb.from('messages').insert(messageBatch.slice(i, i + MSG_BATCH));
              if (error) console.warn('[ChunksDB] message upload batch error:', error.message);
            }
            console.log(`[ChunksDB] uploaded ${messageBatch.length} messages to messages table`);
          }
        }
      }
    } else {
      console.log('[ChunksDB] _uploadLocalChatSessions — no new sessions since last sync');
    }

    // Hydrate _recentItems with any sessions that just got a fresh UUID
    if (newlyAssigned.length) {
      try {
        window._hydrateRecentFromRemote?.(newlyAssigned.map(n => ({
          id:         n.uuid,
          title:      n.title    || null,
          book_id:    n.bookId   || null,
          updated_at: n.updatedAt || new Date().toISOString(),
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


// ══════════════════════════════════════════════════════════════════════════════
// messages — per-row AI chat messages (authoritative message store)
// Table: messages  (created in migration 013)
// All message reads/writes go through this namespace. The chat_sessions
// table is metadata-only (title, book_id, timestamps).
// ══════════════════════════════════════════════════════════════════════════════

const messages = {

  /**
   * Insert a single message row into the `messages` table.
   * No-ops gracefully when the user is not logged in (guest mode).
   *
   * @param {{ role: 'user'|'assistant', content: string, sessionId?: string, bookId?: string }} msg
   * @returns {{ data, error }}
   */
  async insertMessage(msg) {
    if (!isLoggedIn()) return { data: null, error: null };
    const sb = await _sb();
    if (!sb) return { data: null, error: 'no_client' };
    try {
      const { data, error } = await sb.from('messages').insert({
        user_id:    _uid(),
        role:       msg.role,
        content:    msg.content,
        session_id: msg.sessionId ?? null,
        book_id:    msg.bookId    ?? null,
      });
      if (error) console.warn('[ChunksDB] messages.insertMessage error:', error.message);
      return { data, error };
    } catch (e) {
      console.warn('[ChunksDB] messages.insertMessage exception:', e.message);
      return { data: null, error: e.message };
    }
  },

  /**
   * Fetch all messages for the current user, ordered oldest-first.
   * Optionally filtered by sessionId or bookId.
   *
   * @param {{ sessionId?: string, bookId?: string, limit?: number }} [opts]
   * @returns {{ data: Array|null, error }}
   */
  async fetchMessages(opts = {}) {
    if (!isLoggedIn()) return { data: null, error: null };
    const sb = await _sb();
    if (!sb) return { data: null, error: 'no_client' };
    try {
      let q = sb
        .from('messages')
        .select('*')
        .eq('user_id', _uid())
        .order('created_at', { ascending: true });
      if (opts.sessionId) q = q.eq('session_id', opts.sessionId);
      if (opts.bookId)    q = q.eq('book_id',    opts.bookId);
      if (opts.limit)     q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) console.warn('[ChunksDB] messages.fetchMessages error:', error.message);
      return { data, error };
    } catch (e) {
      console.warn('[ChunksDB] messages.fetchMessages exception:', e.message);
      return { data: null, error: e.message };
    }
  },

  /**
   * Delete all messages for the current user.
   * Optionally scope the delete to a specific sessionId or bookId.
   *
   * @param {{ sessionId?: string, bookId?: string }} [opts]
   * @returns {{ data, error }}
   */
  async deleteMessages(opts = {}) {
    if (!isLoggedIn()) return { data: null, error: null };
    const sb = await _sb();
    if (!sb) return { data: null, error: 'no_client' };
    try {
      let q = sb.from('messages').delete().eq('user_id', _uid());
      if (opts.sessionId) q = q.eq('session_id', opts.sessionId);
      if (opts.bookId)    q = q.eq('book_id',    opts.bookId);
      const { data, error } = await q;
      if (error) console.warn('[ChunksDB] messages.deleteMessages error:', error.message);
      return { data, error };
    } catch (e) {
      console.warn('[ChunksDB] messages.deleteMessages exception:', e.message);
      return { data: null, error: e.message };
    }
  },

  /**
   * Load messages for a session, preferring Supabase over localStorage.
   * Returns { data, source } where source is 'supabase' or 'local'.
   * When source is 'local', data is null — the caller should fall back to
   * its own localStorage read.
   *
   * @param {string} sessionId — UUID of the session (supabaseId)
   * @returns {Promise<{ data: Array|null, source: 'supabase'|'local' }>}
   */
  async loadSession(sessionId) {
    if (!isLoggedIn() || !sessionId) return { data: null, source: 'local' };
    const { data, error } = await this.fetchMessages({ sessionId });
    if (!error && data?.length) {
      // Deduplicate in case older code inserted the full history on every save.
      const seen = new Set();
      const deduped = data.filter(m => {
        const key = JSON.stringify([m.role, m.content]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      console.log(`[ChunksDB] messages.loadSession — ${data.length} rows → ${deduped.length} unique msgs from Supabase for ${sessionId}`);
      // Cache into local IDB so subsequent clicks are instant
      const _localKey = 'chunks_session_' + sessionId;
      const _existing = _lsGet(_localKey) || {};
      _lsSet(_localKey, { ..._existing, history: deduped, supabaseId: sessionId });
      return { data: deduped, source: 'supabase' };
    }
    console.log(`[ChunksDB] messages.loadSession — fallback to localStorage for ${sessionId}`);
    return { data: null, source: 'local' };
  },

  /**
   * Migrate all local session chat history into the `messages` table.
   * Runs at most once per user account (idempotent flag in localStorage).
   * Skips silently when not logged in, already migrated, or table already
   * has rows.  Does NOT clear localStorage — that is left to Phase 3.
   *
   * @returns {Promise<{ migrated: boolean, count?: number, reason?: string }>}
   */
  async migrateFromLocalStorage() {
    if (!isLoggedIn()) return { migrated: false, reason: 'not_logged_in' };

    const flagKey = 'chunks_messages_migrated_' + _uid();
    if (_lsGet(flagKey)) return { migrated: false, reason: 'already_done' };

    const sb = await _sb();
    if (!sb) return { migrated: false, reason: 'no_client' };

    // If the table already has rows for this user, skip bulk insert
    const { data: probe } = await this.fetchMessages({ limit: 1 });
    if (probe?.length) {
      console.log('[ChunksDB] messages.migrate — table already has data, skipping');
      _lsSet(flagKey, true);
      return { migrated: false, reason: 'already_has_data' };
    }

    // Collect all session keys from IDB + localStorage
    const keys = _collectSessionKeys();

    if (!keys.length) {
      console.log('[ChunksDB] messages.migrate — no local sessions found');
      _lsSet(flagKey, true);
      return { migrated: false, reason: 'no_local_sessions' };
    }

    const rows = [];

    for (const k of keys) {
      let s;
      try { s = _lsGet(k); } catch (_) { continue; }
      if (!s) continue;

      const sessionUUID = s.supabaseId && _isUUID(s.supabaseId) ? s.supabaseId : null;
      const msgs = s.history || s.messages || [];

      for (const msg of msgs) {
        if (!msg.role || !msg.content) continue;
        const createdAt = msg.created_at
          || (msg.ts ? new Date(msg.ts).toISOString() : null);
        rows.push({
          user_id:    _uid(),
          role:       msg.role,
          content:    msg.content,
          session_id: sessionUUID,
          ...(createdAt ? { created_at: createdAt } : {}),
        });
      }
    }

    if (!rows.length) {
      console.log('[ChunksDB] messages.migrate — no messages to migrate');
      _lsSet(flagKey, true);
      return { migrated: false, reason: 'no_messages' };
    }

    // Batch insert in chunks of 200 to avoid request payload limits
    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await sb.from('messages').insert(rows.slice(i, i + BATCH));
      if (error) {
        console.warn('[ChunksDB] messages.migrate — batch insert error:', error.message);
        return { migrated: false, reason: error.message };
      }
      inserted += Math.min(BATCH, rows.length - i);
    }

    console.log(`[ChunksDB] messages.migrate — migrated ${inserted} messages from localStorage to Supabase`);
    _lsSet(flagKey, true);

    // Phase 3 cleanup: remove chunks_session_* keys from IDB + localStorage now
    // that the data is safely in Supabase.  pullAndApply() may re-populate them
    // from chat_sessions on the same login, but reads will use the messages table
    // going forward so those copies are just cache and can be re-deleted next time.
    const keysToDelete = _collectSessionKeys();
    for (const k of keysToDelete) {
      try { _lsRemove(k); } catch (_) {}
    }
    if (keysToDelete.length) {
      console.log(`[ChunksDB] messages.migrate — cleaned up ${keysToDelete.length} local session key(s)`);
    }

    return { migrated: true, count: inserted };
  },
};

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
      const { data, error } = await sb
        .from('recent_items')
        .select('*')
        .eq('user_id', _uid())
        .single();

      if (error || !data) return { data: null, error: error || null };

      const localUpdatedAt = _lsGet('chunks_recent_items_updated_at');

      if (!_remoteIsNewer(data.updated_at, localUpdatedAt)) {
        // Local is newer — push local up to Supabase
        await recentItems.patch();
        return { data, error: null };
      }

      // Remote is newer — apply to localStorage
      try {
        const remoteExam = Array.isArray(data.exam_recent) ? data.exam_recent : [];
        const remoteSp   = Array.isArray(data.sp_recent_plans) ? data.sp_recent_plans : [];

        if (remoteExam.length) {
          _lsSet('exam_recent', remoteExam);
          console.log(`[ChunksDB] recentItems — restored ${remoteExam.length} exam entries`);
        }
        if (remoteSp.length) {
          _lsSet('sp_recent_plans', remoteSp);
          // Trigger re-render of study plan sidebar if the function is available
          try { window._renderRecentPlansAllSidebars?.(); } catch (_) {}
          console.log(`[ChunksDB] recentItems — restored ${remoteSp.length} study plan entries`);
        }
      } catch (parseErr) {
        console.warn('[ChunksDB] recentItems — parse error:', parseErr.message);
      }

      _lsSet('chunks_recent_items_updated_at', data.updated_at);
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
  lsGet, lsSet, lsRemove,

  // Phase 2: cross-device sync namespaces
  chat,
  settings,
  streak,
  ws,
  studyPlan,
  recentItems,
  pullAll,

  // Phase 3: per-row messages table (real-time architecture)
  messages,
};

console.log('[ChunksDB] Sync layer ready ✦  (Phase 2: chat · settings · streak · ws · studyPlan · recentItems · messages)');
