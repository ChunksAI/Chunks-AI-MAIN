// @ts-nocheck
/**
 * src/state/home/homeMessagesRealtime.js — Supabase Realtime for home chat
 *
 * Subscribes to the `messages` table for the current user's active home
 * session.  Applies incremental DOM updates when rows are inserted or
 * deleted — no page refresh required.
 *
 * Public API:
 *   subscribeToHomeMessages(supabaseId)  — start listening for changes
 *   unsubscribeHomeMessages()            — stop listening (session change / sign-out)
 */

import { getSupabaseClient } from '../../lib/supabase.js';
import { homeMarkdown }       from '../../utils/render.js';

// ── Module state ──────────────────────────────────────────────────────────────

/** Active Supabase Realtime channel — null when not subscribed */
let _channel = null;

/** The session UUID we are currently subscribed to */
let _subscribedSessionId = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the current user id or null */
function _uid() {
  return window._currentUser?.id || null;
}

/**
 * Build a stable string used as the `data-rt-home-msg-id` attribute value.
 * Converts the DB row id (uuid string) to a plain string for DOM attribute use.
 */
function _normalizeId(id) {
  return String(id);
}

// ── Shared DOM constants ──────────────────────────────────────────────────────

const _AI_AVATAR = `<div class="hc-ai-avatar"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="#c8a84b" stroke-width="7" opacity="0.95"/><ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="#a855f7" stroke-width="7" transform="rotate(60 50 50)" opacity="0.85"/><ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="#c8a84b" stroke-width="7" transform="rotate(120 50 50)" opacity="0.75"/><circle cx="50" cy="50" r="6" fill="#e8ac2e"/></svg></div>`;

// ── INSERT handler ────────────────────────────────────────────────────────────

/**
 * _handleInsert — called when a new row arrives from the Realtime stream.
 *
 * Deduplication strategy:
 *   1. If an element with data-rt-home-msg-id equal to row.id already exists,
 *      this event is a duplicate (e.g. a fast reconnect replay) — skip it.
 *   2. If an untagged element with the same role + content exists as the
 *      most-recently-appended untagged element, it was optimistically rendered
 *      by the local send path.  Tag it with the DB id so it won't be
 *      duplicated on future events, but don't create a new element.
 *   3. Otherwise this is a cross-device message — create and append.
 *
 * @param {{ id: string, role: string, content: string, created_at: string, session_id: string, user_id: string }} row
 */
function _handleInsert(row) {
  const chatHist = document.getElementById('home-chat-history');
  if (!chatHist) return;

  const rtId = _normalizeId(row.id);

  // 1. Already tagged — duplicate event, skip.
  if (chatHist.querySelector(`[data-rt-home-msg-id="${rtId}"]`)) return;

  // 2. Find a matching untagged element (optimistic local render).
  const untaggedSelector = row.role === 'user' ? '.hc-user:not([data-rt-home-msg-id])' : '.hc-ai:not([data-rt-home-msg-id]):not(#hc-thinking)';
  const candidates = Array.from(chatHist.querySelectorAll(untaggedSelector));
  // Check from the end — the most-recently added untagged element is most likely the match.
  for (let i = candidates.length - 1; i >= 0; i--) {
    const el = candidates[i];
    const elText = (row.role === 'user' ? el.textContent : el.querySelector('.hc-ai-body')?.textContent) || '';
    if (elText.trim() === (row.content || '').trim()) {
      el.setAttribute('data-rt-home-msg-id', rtId);
      console.log('[HomeMessagesRealtime] labelled optimistic element for msg', rtId);
      return;
    }
  }

  // 3. Cross-device message — append to DOM and update homeHistory.
  console.log('[HomeMessagesRealtime] inserting cross-device message', rtId, 'role:', row.role);

  let el;
  if (row.role === 'user') {
    el = document.createElement('div');
    el.className = 'hc-user';
    el.textContent = row.content || '';
  } else {
    el = document.createElement('div');
    el.className = 'hc-ai';
    const rendered = typeof homeMarkdown === 'function'
      ? homeMarkdown(row.content || '')
      : (row.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    el.innerHTML = `${_AI_AVATAR}<div class="hc-ai-body">${rendered}</div>`;
  }

  el.setAttribute('data-rt-home-msg-id', rtId);
  chatHist.appendChild(el);

  // Keep homeHistory in sync
  if (window.homeHistory) {
    window.homeHistory = [...window.homeHistory, { role: row.role, content: row.content }];
  }

  // Ensure chat layout is visible (may arrive before first local send)
  const bar        = document.getElementById('home-input-bar');
  const landing    = document.getElementById('home-landing');
  const hero       = document.querySelector('.home-hero');
  const scrollArea = document.getElementById('home-scroll-area');
  if (landing)    landing.style.display = 'none';
  if (hero)       hero.style.display = 'none';
  if (bar)        bar.style.display = 'flex';
  if (scrollArea) scrollArea.style.justifyContent = 'flex-start';

  // Scroll to bottom
  if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
}

// ── DELETE handler ────────────────────────────────────────────────────────────

/**
 * _handleDelete — called when a row is removed from the Realtime stream.
 *
 * Removes the corresponding DOM element immediately.  If homeHistory becomes
 * empty as a result, resets the home screen back to the landing state.
 *
 * @param {{ id: string }} row — partial row from payload.old (id only is reliable)
 */
function _handleDelete(row) {
  if (!row?.id) return;

  const rtId = _normalizeId(row.id);
  const el   = document.querySelector(`[data-rt-home-msg-id="${rtId}"]`);
  if (el) {
    // Determine which role this element represented so homeHistory stays in sync.
    const role = el.classList.contains('hc-user') ? 'user' : 'assistant';
    el.remove();

    // Remove the matching entry from homeHistory.  Messages carry their role
    // but not their DB id, so we scan from the end and remove the first match.
    if (window.homeHistory?.length) {
      const idx = [...window.homeHistory].reverse().findIndex(m => m.role === role);
      if (idx !== -1) {
        const spliceAt = window.homeHistory.length - 1 - idx;
        window.homeHistory = [
          ...window.homeHistory.slice(0, spliceAt),
          ...window.homeHistory.slice(spliceAt + 1),
        ];
      }
    }
  }

  console.log('[HomeMessagesRealtime] deleted message', rtId);

  // If no messages remain in the chat area, show landing
  const chatHist = document.getElementById('home-chat-history');
  if (!chatHist) return;
  const remaining = chatHist.querySelectorAll('.hc-user, .hc-ai:not(#hc-thinking)');
  if (remaining.length === 0) {
    const landing    = document.getElementById('home-landing');
    const hero       = document.querySelector('.home-hero');
    const bar        = document.getElementById('home-input-bar');
    const scrollArea = document.getElementById('home-scroll-area');
    if (landing)    landing.style.display = '';
    if (hero)       hero.style.display = '';
    if (bar)        bar.style.display = 'none';
    if (scrollArea) scrollArea.style.justifyContent = '';
    chatHist.innerHTML = '';
    window.homeHistory    = [];
    window._homeSessionId = null;
    localStorage.removeItem('chunks_active_home_session');
    localStorage.removeItem('chunks_active_home_supabase_id');
  }
}

// ── Realtime event router ─────────────────────────────────────────────────────

/**
 * _handleRealtimeUpdate — dispatch INSERT / DELETE events.
 *
 * Guards against events from other users or sessions before mutating the DOM.
 *
 * @param {Object} payload — Supabase Realtime change payload
 */
function _handleRealtimeUpdate(payload) {
  const userId    = _uid();
  const sessionId = _subscribedSessionId;

  if (payload.eventType === 'INSERT') {
    const row = payload.new;
    if (userId    && row.user_id    !== userId)    return;
    if (sessionId && row.session_id !== sessionId) return;
    _handleInsert(row);
  }

  if (payload.eventType === 'DELETE') {
    // payload.old may be partial depending on replica identity; id is usually present.
    _handleDelete(payload.old);
  }
}

// ── Subscription lifecycle ────────────────────────────────────────────────────

/**
 * subscribeToHomeMessages — subscribe to `messages` table changes for the
 * given session UUID.  Any previous subscription is cleaned up first.
 *
 * @param {string} supabaseId — UUID of the current home-chat session
 */
export async function subscribeToHomeMessages(supabaseId) {
  await unsubscribeHomeMessages();

  const sb = await getSupabaseClient();
  if (!sb) {
    console.warn('[HomeMessagesRealtime] Supabase client unavailable — realtime disabled');
    return;
  }

  if (!_uid()) {
    console.info('[HomeMessagesRealtime] Guest mode — skipping realtime subscription');
    return;
  }

  _subscribedSessionId = supabaseId;

  _channel = sb
    .channel('home-messages-realtime')
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'messages',
        filter: `session_id=eq.${supabaseId}`,
      },
      (payload) => { _handleRealtimeUpdate(payload); }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.info('[HomeMessagesRealtime] Subscribed to messages for session:', supabaseId);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[HomeMessagesRealtime] Subscription error:', status);
      }
    });
}

/**
 * unsubscribeHomeMessages — remove the active Realtime channel.
 * Safe to call when no subscription is active.
 */
export async function unsubscribeHomeMessages() {
  if (!_channel) return;

  const sb = await getSupabaseClient();
  if (sb) {
    try {
      await sb.removeChannel(_channel);
    } catch (e) {
      console.warn('[HomeMessagesRealtime] removeChannel error:', e.message);
    }
  }

  _channel             = null;
  _subscribedSessionId = null;
  console.info('[HomeMessagesRealtime] Unsubscribed');
}
