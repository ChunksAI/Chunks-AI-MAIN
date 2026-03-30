// @ts-nocheck
/**
 * src/state/workspace/chatRealtime.js — Supabase Realtime chat sync
 *
 * Subscribes to the `chats` table via Supabase Realtime and applies
 * incremental UI updates whenever messages are inserted, deleted, or updated.
 *
 * Public API:
 *   subscribeToChatRealtime(documentId)  — start listening for changes
 *   unsubscribeChatRealtime()            — stop listening (call on unmount / doc change)
 *   addMessageToUI(message)              — insert a new message row into the chat panel
 *   removeMessageFromUI(id)              — remove a message row by its DB id
 *   updateMessageInUI(message)           — replace the content of an existing message
 */

import { getSupabaseClient } from '../../lib/supabase.js';
import { ws } from './state.js';
import { wsScrollBottom } from './chat.js';
import { $el } from '../domHelpers.js';

// ── Module state ─────────────────────────────────────────────────────────────

/** Active Supabase Realtime channel — null when not subscribed */
let _channel = null;

/** The document id we are currently subscribed to */
let _subscribedDocId = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the current user id or null */
function _uid() {
  return window._currentUser?.id || null;
}

/**
 * Build a stable DOM attribute value used to identify a realtime-sourced
 * message element.  Messages rendered by wsAppendUser / wsAppendAI do NOT
 * carry this attribute; only messages whose origin is a realtime INSERT do.
 */
function _rtAttr(id) {
  return String(id);
}

// ── UI update functions ───────────────────────────────────────────────────────

/**
 * addMessageToUI — append a new message from the `chats` table to the panel.
 *
 * Deduplicates: if a <div> with data-rt-msg-id equal to message.id already
 * exists we skip the insert (prevents double-render when the local send path
 * also calls wsAppendUser / wsAppendAI and Realtime fires shortly after).
 *
 * @param {{ id: string|number, role: string, content: string, created_at: string }} message
 */
export function addMessageToUI(message) {
  const msgs = $el('ws-messages');
  if (!msgs) return;

  // Deduplication guard
  if (msgs.querySelector(`[data-rt-msg-id="${_rtAttr(message.id)}"]`)) return;

  const d = document.createElement('div');
  d.setAttribute('data-rt-msg-id', _rtAttr(message.id));

  if (message.role === 'user') {
    d.className = 'msg msg-user';
    const escaped = (message.content || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;');
    d.innerHTML = `<div class="bubble-user">${escaped}</div>`;
  } else {
    d.className = 'msg msg-ai';
    const rendered = typeof wsRender === 'function'
      ? wsRender(message.content || '')
      : (message.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    d.innerHTML = `
      <div class="ai-row">
        <div class="ai-body">
          <div class="ai-text">${rendered}</div>
        </div>
      </div>`;
  }

  // Remove the empty-state placeholder if still present
  const placeholder = msgs.querySelector('[data-ws-empty]');
  if (placeholder) placeholder.remove();

  msgs.appendChild(d);
  wsScrollBottom();
}

/**
 * removeMessageFromUI — remove the DOM element for a given message id.
 *
 * @param {string|number} id  — the `id` field from the deleted `chats` row
 */
export function removeMessageFromUI(id) {
  const el = document.querySelector(`[data-rt-msg-id="${_rtAttr(id)}"]`);
  if (el) el.remove();
}

/**
 * updateMessageInUI — replace the rendered content of an existing message.
 *
 * @param {{ id: string|number, role: string, content: string }} message
 */
export function updateMessageInUI(message) {
  const el = document.querySelector(`[data-rt-msg-id="${_rtAttr(message.id)}"]`);
  if (!el) return;

  if (message.role === 'user') {
    const bubble = el.querySelector('.bubble-user');
    if (bubble) {
      bubble.innerHTML = (message.content || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;');
    }
  } else {
    const textEl = el.querySelector('.ai-text');
    if (textEl) {
      textEl.innerHTML = typeof wsRender === 'function'
        ? wsRender(message.content || '')
        : (message.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    }
  }
}

// ── Realtime event router ─────────────────────────────────────────────────────

/**
 * handleRealtimeUpdate — dispatch INSERT / DELETE / UPDATE events.
 *
 * Guards against events for other users or documents before mutating the UI.
 *
 * @param {Object} payload  — Supabase Realtime change payload
 */
function handleRealtimeUpdate(payload) {
  const userId     = _uid();
  const documentId = _subscribedDocId;

  if (payload.eventType === 'INSERT') {
    const row = payload.new;
    // Only process events that belong to the current user + document
    if (userId  && row.user_id     !== userId)     return;
    if (documentId && row.document_id !== documentId) return;
    addMessageToUI(row);
  }

  if (payload.eventType === 'DELETE') {
    // payload.old may be partial depending on replica identity settings;
    // fall back gracefully when id is missing.
    const id = payload.old?.id;
    if (id !== undefined && id !== null) removeMessageFromUI(id);
  }

  if (payload.eventType === 'UPDATE') {
    const row = payload.new;
    if (userId  && row.user_id     !== userId)     return;
    if (documentId && row.document_id !== documentId) return;
    updateMessageInUI(row);
  }
}

// ── Subscription lifecycle ────────────────────────────────────────────────────

/**
 * subscribeToChatRealtime — subscribe to `chats` table changes for the given
 * document.  Any previously active subscription is cleaned up first.
 *
 * @param {string} documentId  — current book / user-doc identifier
 */
export async function subscribeToChatRealtime(documentId) {
  // Clean up any existing subscription before creating a new one
  await unsubscribeChatRealtime();

  const sb = await getSupabaseClient();
  if (!sb) {
    console.warn('[ChatRealtime] Supabase client unavailable — realtime disabled');
    return;
  }

  // Guests have no user_id — skip subscription
  if (!_uid()) {
    console.info('[ChatRealtime] Guest mode — skipping realtime subscription');
    return;
  }

  _subscribedDocId = documentId;

  _channel = sb
    .channel('realtime-chats')
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'chats',
      },
      (payload) => {
        handleRealtimeUpdate(payload);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.info('[ChatRealtime] Subscribed to chats table for doc:', documentId);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[ChatRealtime] Subscription error:', status);
      }
    });
}

/**
 * unsubscribeChatRealtime — remove the active Supabase Realtime channel.
 * Safe to call when no subscription is active.
 */
export async function unsubscribeChatRealtime() {
  if (!_channel) return;

  const sb = await getSupabaseClient();
  if (sb) {
    try {
      await sb.removeChannel(_channel);
    } catch (e) {
      console.warn('[ChatRealtime] removeChannel error:', e.message);
    }
  }

  _channel         = null;
  _subscribedDocId = null;
  console.info('[ChatRealtime] Unsubscribed');
}
