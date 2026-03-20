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

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Get current user id (null if not logged in) */
function _uid() {
  return window._currentUser?.id || null;
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
// Patches window._currentUser.id from the Supabase session so _uid() works.
// Must run after supabase.js and after auth.js sets up _applyUserProfile.

(function _patchAuth() {
  // Extend _applyUserProfile to also store the user's UUID
  // (called automatically after login by _initAuth in auth.js / Task 32)
  const _origApplyUserProfile = window._applyUserProfile;
  window._applyUserProfile = function (session) {
    if (_origApplyUserProfile) _origApplyUserProfile(session);
    if (session?.user && window._currentUser) {
      window._currentUser.id = session.user.id;
    }
  };

  // Also patch _initAuth's session restore path
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
      try {
        const sb = await getSupabaseClient();
        if (!sb) return;
        const { data: { session } } = await sb.auth.getSession();
        if (session?.user && window._currentUser) {
          window._currentUser.id = session.user.id;
        }
      } catch (e) {}
    }, 1200); // runs after _initAuth (1000ms delay)
  });
})();

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
    return upsert('chat_sessions', {
      id:         session.id,
      local_id:   session.localId  || null,
      book_id:    session.bookId   || null,
      title:      session.title    || null,
      messages:   session.messages || session.history || [],
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
      // Collect all chunks_session_* keys from localStorage
      const sessions = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('chunks_session_')) {
            const s = _lsGet(k);
            if (s) sessions.push(s);
          }
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
      limit: 50,
    });

    if (error || !remoteSessions?.length) return { data: null, error };

    // Write each remote session into localStorage so the page restore path
    // picks it up. Only overwrite if remote is newer than what's already local.
    let newestId   = null;
    let newestTime = 0;

    for (const remote of remoteSessions) {
      if (!remote.id) continue;

      const localKey = 'chunks_session_' + remote.id;
      const localRaw = _lsGet(localKey);
      const localTime = localRaw?.updatedAt ? new Date(localRaw.updatedAt).getTime() : 0;
      const remoteTime = remote.updated_at  ? new Date(remote.updated_at).getTime()  : 0;

      // Remote wins if newer or if no local copy exists
      if (remoteTime >= localTime) {
        _lsSet(localKey, {
          id:        remote.id,        // UUID — used as Supabase key
          html:      localRaw?.html || '',
          history:   remote.messages || [],
          bookId:    remote.book_id  || null,
          title:     remote.title    || null,
          updatedAt: remote.updated_at,
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
          // Point active session at the familiar r+timestamp key
          // so existing restore path works without changes
          const currentActive = localStorage.getItem('chunks_active_home_session');
          if (!currentActive || currentActive === remote.id) {
            localStorage.setItem('chunks_active_home_session', remote.local_id);
          }
        }
        _notifyConflict('chat_sessions');
      }

      // Track the most recently updated session to set as active
      if (remoteTime > newestTime) {
        newestTime = remoteTime;
        newestId   = remote.id;
      }
    }

    // Set the most recent session as the active one if nothing is set locally
    const currentActive = localStorage.getItem('chunks_active_home_session');
    if (newestId && !currentActive) {
      localStorage.setItem('chunks_active_home_session', newestId);
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
   * Delete a session by id.
   * @param {string} sessionId
   */
  async deleteSession(sessionId) {
    _lsRemove('chunks_session_' + sessionId);
    if (!isLoggedIn()) return { error: null };
    return remove('chat_sessions', sessionId);
  },
};

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

    // Compare updated_at vs last local write
    const localUpdatedAt = _lsGet('chunks_settings_updated_at');
    if (!_remoteIsNewer(row.updated_at, localUpdatedAt)) {
      // Local is newer — push local up to Supabase instead
      await settings.pushLocalToRemote();
      return { data: row, error: null };
    }

    // Remote is newer — apply all columns to localStorage
    _notifyConflict('user_settings');
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
      _notifyConflict('streak_state');
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
    _lsSet('chunks_default_book',   bookId);

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
        _notifyConflict('ws_state');
        _lsSet('chunks_active_ws_book', row.active_book_id);
        _lsSet('chunks_default_book',   row.active_book_id);
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
async function pullAll() {
  if (!isLoggedIn()) return;
  console.log('[ChunksDB] pullAll — merging cross-device state…');
  try {
    await Promise.allSettled([
      settings.pullAndApply(),
      streak.pullAndApply(),
      ws.pullAndApply(),
      // Chat: upload any local-only sessions, then download remote ones
      _uploadLocalChatSessions(),
      chat.pullAndApply(),
    ]);
    console.log('[ChunksDB] pullAll — done ✦');
  } catch (e) {
    console.warn('[ChunksDB] pullAll error:', e.message);
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
    // Collect all session keys from localStorage
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('chunks_session_')) keys.push(k);
    }
    // Also include any that were queued while logged out / uid not yet ready
    const pending = _lsGet('chunks_pending_upload_sessions', []);
    pending.forEach(id => {
      const k = 'chunks_session_' + id;
      if (!keys.includes(k)) keys.push(k);
    });

    for (const k of keys) {
      const s = _lsGet(k);
      if (!s) continue;
      // Use supabaseId (UUID) if available; skip r+timestamp IDs — Postgres rejects them
      const supaId = s.supabaseId || s.id;
      if (!supaId) continue;
      if (/^r[0-9]+$/.test(supaId)) continue;
      await upsert('chat_sessions', {
        id:         supaId,
        book_id:    s.bookId   || null,
        title:      s.title    || null,
        messages:   s.history  || s.messages || [],
        updated_at: s.updatedAt || new Date().toISOString(),
      }, 'id');
    }

    // Clear the pending queue now that everything is uploaded
    _lsRemove('chunks_pending_upload_sessions');
    console.log(`[ChunksDB] _uploadLocalChatSessions — ${keys.length} sessions uploaded`);
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
  pullAll,
};

// ── Window bridge ─────────────────────────────────────────────────────────────
// Keeps window.ChunksDB?.isLoggedIn() / window.ChunksDB?.lsGet() guards working
// in flashState.js and any other modules that defensively check window.ChunksDB.
// Phase 2 namespaces are also exposed so non-module scripts can call them.

window.ChunksDB = ChunksDB;

console.log('[ChunksDB] Sync layer ready ✦  (Phase 2: chat · settings · streak · ws)');
