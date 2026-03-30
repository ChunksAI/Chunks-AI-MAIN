// @ts-nocheck
/**
 * src/state/flash/chatBridge.js — Workspace/chat integration
 */

import { $el } from '../domHelpers.js';
import { fc } from './state.js';
import { _fcDismissTutor, _fcStartDeck } from './session.js';
import { _fcCloseCompleteModal } from './completion.js';
import { _fcGenerateFromBar } from './generation.js';
import { _fcInitAccent } from './accent.js';
import { _fcRenderDeckList } from './decks.js';
import { showScreen } from '../navigation/index.js';
import { API_BASE, _getAuthHeader } from '../../lib/api.js';
import { FlashcardDB } from '../../lib/flashcardDb.js';
import { showToast } from '../../components/Toast.js';
import { ws } from '../workspace/state.js';
import {
  wsAppendUser, wsAppendThinking, wsRemoveThinking,
  wsAppendError, wsScrollBottom,
} from '../workspace/chat.js';

// ── Workspace make flashcard ────────────────────────────────────────────────

export async function wsMakeFlashcard(btn, msgId, topic) {
  const cleanTopic = (topic || '').trim() || 'Flashcard Set';

  if (!msgId) return;
  const msgEl = document.getElementById(msgId);
  if (!msgEl) return;
  const actsEl = msgEl.querySelector('.msg-acts');
  if (!actsEl) return;

  // Disable button and show loading state
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-flex;gap:3px;align-items:center;vertical-align:middle">
      <span class="ws-typing-dot"></span><span class="ws-typing-dot"></span><span class="ws-typing-dot"></span>
    </span>&nbsp;Generating…`;
  }

  try {
    const res = await fetch(`${API_BASE}/generate-flashcards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} },
      body: JSON.stringify({ topic: cleanTopic, count: 10 }),
    });
    const data = await res.json();

    if (!res.ok || !data.success || !data.flashcards?.length) {
      throw new Error(data.error || 'No flashcards returned');
    }

    const cards = data.flashcards.map(c => ({
      front: c.front || c.question || '',
      back:  c.back  || c.answer   || '',
      ...(c.hint ? { hint: c.hint } : {}),
    }));

    const deck   = await FlashcardDB.fcSaveDeck(cleanTopic, cards);
    const deckId = deck.id || deck.name;
    const count  = cards.length;

    // Also persist to per-document `flashcards` table for cross-session recall
    const documentId = ws.userDocId || (ws.bookId !== '__user_doc__' ? ws.bookId : null);
    if (documentId) {
      FlashcardDB.fcSaveFlashcards(cards, documentId, ws.currentPage || 0).catch(e =>
        console.warn('[wsMakeFlashcard] fcSaveFlashcards failed:', e.message)
      );
    }

    // Escape for safe inline attribute use
    const safeId    = String(deckId).replace(/'/g, '\\\'');
    const safeTopic = cleanTopic.replace(/'/g, '\\\'').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Build the result card
    const resultEl = document.createElement('div');
    resultEl.className = 'ws-gen-result-card';
    resultEl.style.cssText = 'margin-top:10px;padding:12px 14px;background:var(--surface-2);border:1px solid var(--violet-border);border-radius:var(--r-md);';
    resultEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="padding:6px;background:var(--violet-muted);border-radius:var(--r-sm);flex-shrink:0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
        </div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text-1);">Flashcard Set</div>
          <div style="font-size:11px;color:var(--text-4);">${count} card${count !== 1 ? 's' : ''} &middot; ${safeTopic}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button onclick="wsOpenFlashcardDeck('${safeId}', '${safeTopic}')"
          style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:7px 12px;background:var(--violet);border:none;border-radius:var(--r-sm);color:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--font-body);transition:opacity 0.15s;"
          onmouseenter="this.style.opacity='0.85'" onmouseleave="this.style.opacity='1'">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m5 12 14 0"/><path d="m12 5 7 7-7 7"/></svg>
          Open Flashcards
        </button>
        <button onclick="wsStartFlashcardPractice('${safeId}', '${safeTopic}')"
          style="display:flex;align-items:center;gap:5px;padding:7px 12px;background:var(--surface-3);border:1px solid var(--border-sm);border-radius:var(--r-sm);color:var(--text-2);font-size:11px;cursor:pointer;font-family:var(--font-body);transition:background 0.15s;"
          onmouseenter="this.style.background='var(--surface-hover)'" onmouseleave="this.style.background='var(--surface-3)'">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Practice
        </button>
      </div>`;

    // Remove Make Flashcard button and insert result card after the actions row
    if (btn) btn.remove();
    actsEl.insertAdjacentElement('afterend', resultEl);

    showToast?.('✦', `${count} cards created — "${cleanTopic}"`, 'var(--gold)');

  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg> Make Flashcard`;
    }
    showToast?.('⚠', err.message || 'Generation failed', 'var(--red)');
    console.error('[wsMakeFlashcard]', err);
  }
}

// ── Generate flashcards inline in chat (no existing msgId required) ──────────

export async function wsGenerateFlashcardsInChat(topic) {
  if (ws.typing) return;

  const effectiveTopic = (topic && topic.trim()) || ws.bookId || 'current chapter';
  const displayMsg = (topic && topic.trim())
    ? `Generate flashcards on "${topic.trim()}"`
    : 'Generate flashcards for this chapter';

  wsAppendUser(displayMsg);
  ws.typing = true;
  wsAppendThinking();

  try {
    const res = await fetch(`${API_BASE}/generate-flashcards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} },
      body: JSON.stringify({ topic: effectiveTopic, bookId: ws.bookId || null, count: 10 }),
    });
    const data = await res.json();
    wsRemoveThinking();

    if (!res.ok || !data.success || !data.flashcards?.length) {
      throw new Error(data.error || 'No flashcards returned');
    }

    const cards = data.flashcards.map(c => ({
      front: c.front || c.question || '',
      back:  c.back  || c.answer   || '',
      ...(c.hint ? { hint: c.hint } : {}),
    }));

    const deck   = await FlashcardDB.fcSaveDeck(effectiveTopic, cards);
    const deckId = deck.id || deck.name;
    const count  = cards.length;

    // Also persist to per-document `flashcards` table for cross-session recall
    const documentId = ws.userDocId || (ws.bookId !== '__user_doc__' ? ws.bookId : null);
    if (documentId) {
      FlashcardDB.fcSaveFlashcards(cards, documentId, ws.currentPage || 0).catch(e =>
        console.warn('[wsGenerateFlashcardsInChat] fcSaveFlashcards failed:', e.message)
      );
    }

    const safeId    = String(deckId).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeTopic = effectiveTopic.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const msgs = $el('ws-messages');
    const d = document.createElement('div');
    d.className = 'msg msg-ai';
    d.innerHTML = `
      <div class="ai-row">
        <div class="ai-body">
          <div class="ws-gen-result-card" style="padding:12px 14px;background:var(--surface-2);border:1px solid var(--violet-border);border-radius:var(--r-md);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <div style="padding:6px;background:var(--violet-muted);border-radius:var(--r-sm);flex-shrink:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
              </div>
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--text-1);">Flashcard Set Created</div>
                <div style="font-size:11px;color:var(--text-4);">${count} card${count !== 1 ? 's' : ''} &middot; ${safeTopic}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button onclick="wsOpenFlashcardDeck('${safeId}', '${safeTopic}')"
                style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:7px 12px;background:var(--violet);border:none;border-radius:var(--r-sm);color:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--font-body);transition:opacity 0.15s;"
                onmouseenter="this.style.opacity='0.85'" onmouseleave="this.style.opacity='1'">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m5 12 14 0"/><path d="m12 5 7 7-7 7"/></svg>
                Open Flashcards
              </button>
              <button onclick="wsStartFlashcardPractice('${safeId}', '${safeTopic}')"
                style="display:flex;align-items:center;gap:5px;padding:7px 12px;background:var(--surface-3);border:1px solid var(--border-sm);border-radius:var(--r-sm);color:var(--text-2);font-size:11px;cursor:pointer;font-family:var(--font-body);transition:background 0.15s;"
                onmouseenter="this.style.background='var(--surface-hover)'" onmouseleave="this.style.background='var(--surface-3)'">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Practice
              </button>
            </div>
          </div>
        </div>
      </div>`;
    if (msgs) { msgs.appendChild(d); wsScrollBottom(); }
    showToast?.('✦', `${count} cards created — "${effectiveTopic}"`, 'var(--gold)');
  } catch (err) {
    wsRemoveThinking();
    wsAppendError(err.message || 'Failed to generate flashcards');
    console.error('[wsGenerateFlashcardsInChat]', err);
  } finally {
    ws.typing = false;
    const sendBtn = $el('ws-chat-send');
    if (sendBtn) sendBtn.disabled = false;
  }
}

// ── Open a specific flashcard deck from chat ─────────────────────────────────

export async function wsOpenFlashcardDeck(deckId, topic) {
  try {
    sessionStorage.setItem('chunks_nav_from', 'workspace');
    if (topic) sessionStorage.setItem('chunks_nav_topic', topic);
  } catch (_) {}

  showScreen('flash');

  setTimeout(async () => {
    _fcCheckNavFrom();
    await _fcRenderDeckList();
    // Scroll to top so the user sees their deck
    const home = $el('fc-home');
    if (home) home.scrollTop = 0;
  }, 200);
}

// ── Start flashcard practice session from chat ───────────────────────────────

export async function wsStartFlashcardPractice(deckId, topic) {
  try {
    sessionStorage.setItem('chunks_nav_from', 'workspace');
    if (topic) sessionStorage.setItem('chunks_nav_topic', topic);
  } catch (_) {}

  showScreen('flash');

  setTimeout(async () => {
    _fcCheckNavFrom();
    try {
      const decks = await FlashcardDB.fcLoadDecks();
      const deck  = decks.find(d => String(d.id) === String(deckId) || d.name === deckId);
      if (deck) {
        _fcStartDeck(deck);
      } else {
        await _fcRenderDeckList();
      }
    } catch (e) {
      await _fcRenderDeckList();
    }
  }, 200);
}

// ── Load per-document flashcards for the current workspace document ──────────

/**
 * Load all flashcards saved for the document currently open in the workspace.
 * Always fetches fresh data from Supabase (scoped to the current user) so
 * there is no risk of mixing flashcards across users or serving stale cache.
 *
 * @returns {Promise<Array<{id, document_id, page, question, answer, created_at}>>}
 */
export async function wsLoadDocumentFlashcards() {
  const documentId = ws.userDocId || (ws.bookId && ws.bookId !== '__user_doc__' ? ws.bookId : null);
  if (!documentId) return [];
  return FlashcardDB.fcLoadFlashcards(documentId);
}

// ── Back to Workspace ────────────────────────────────────────────────────────

export function wsBackToWorkspace() {
  try {
    sessionStorage.removeItem('chunks_nav_from');
    sessionStorage.removeItem('chunks_nav_topic');
  } catch (_) {}

  const backBtn = document.getElementById('fc-back-to-ws');
  if (backBtn) backBtn.style.display = 'none';
  const examBackBtn = document.getElementById('exam-back-to-ws');
  if (examBackBtn) examBackBtn.style.display = 'none';

  showScreen('workspace');
}

// ── Check nav context and show/hide back button ──────────────────────────────

export function _fcCheckNavFrom() {
  try {
    const navFrom  = sessionStorage.getItem('chunks_nav_from');
    const navTopic = sessionStorage.getItem('chunks_nav_topic');

    // Flash screen back button
    const flashBack = document.getElementById('fc-back-to-ws');
    if (flashBack) {
      if (navFrom === 'workspace') {
        flashBack.style.display = '';
        const label = flashBack.querySelector('.fc-back-label');
        if (label) {
          label.textContent = navTopic ? `← Back · ${navTopic}` : '← Back to Workspace';
        }
      } else {
        flashBack.style.display = 'none';
      }
    }

    // Exam screen back button
    const examBack = document.getElementById('exam-back-to-ws');
    if (examBack) {
      if (navFrom === 'workspace') {
        examBack.style.display = '';
        const label = examBack.querySelector('.exam-back-label');
        if (label) {
          label.textContent = navTopic ? `← Back · ${navTopic}` : '← Back to Workspace';
        }
      } else {
        examBack.style.display = 'none';
      }
    }
  } catch (_) {}
}

// ── Study in Chat (from AI Tutor panel) ─────────────────────────────────────

export function _fcStudyInChat() {
  const question = $el('fc-card-question')?.textContent?.trim()
    || fc.deck[fc.index]?.front
    || fc.deck[fc.index]?.question
    || '';
  const answer = $el('fc-card-answer')?.textContent?.trim()
    || fc.deck[fc.index]?.back
    || fc.deck[fc.index]?.answer
    || '';

  _fcDismissTutor();

  if (!question) return;
  const prompt = `I got this flashcard wrong. Can you explain it in depth?\n\nQuestion: ${question}\nAnswer: ${answer}`;

  if (showScreen) showScreen('workspace');
  setTimeout(() => {
    const inp = $el('ws-chat-input');
    if (!inp) return;
    inp.value = prompt;
    if (typeof wsAutoResize === 'function') wsAutoResize(inp);
    inp.focus();
    setTimeout(() => { if (typeof window.wsChatSend === 'function') window.wsChatSend(); }, 350);
  }, 250);
}

// ── Review Hard in Chat (from session complete modal) ───────────────────────

export function _fcReviewHardInChat() {
  _fcCloseCompleteModal();

  const hardCards = fc.ratings
    .filter(r => r.rating === 'hard')
    .map(r => {
      const card = fc.deck.find(c => c.id === r.card_id) || fc.deck[fc.ratings.indexOf(r)];
      return card?.front || card?.question || null;
    })
    .filter(Boolean)
    .slice(0, 5);

  const deckName = fc.currentDeckMeta?.name || 'my flashcard deck';

  let prompt;
  if (hardCards.length === 0) {
    prompt = `Can you give me a quick review of the key concepts from "${deckName}"?`;
  } else if (hardCards.length === 1) {
    prompt = `I struggled with this flashcard from "${deckName}". Can you explain it clearly?\n\n• ${hardCards[0]}`;
  } else {
    const list = hardCards.map(q => `• ${q}`).join('\n');
    prompt = `I struggled with these ${hardCards.length} flashcards from "${deckName}". Can you explain each one clearly?\n\n${list}`;
  }

  if (showScreen) showScreen('workspace');
  setTimeout(() => {
    const inp = $el('ws-chat-input');
    if (!inp) return;
    inp.value = prompt;
    if (typeof wsAutoResize === 'function') wsAutoResize(inp);
    inp.focus();
    setTimeout(() => { if (typeof window.wsChatSend === 'function') window.wsChatSend(); }, 350);
  }, 250);
}

// ── Init ────────────────────────────────────────────────────────────────────

export function _fcInit() {
  _fcInitAccent();
  _fcRenderDeckList();
  _fcCheckNavFrom();
}
