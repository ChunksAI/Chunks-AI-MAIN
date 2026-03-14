/**
 * src/screens/HomeScreen.js — Task 25
 *
 * Owns:
 *   • #screen-home HTML injection (replaces data-home-screen placeholder)
 *   • Home chat state: homeMode, homeHistory, _homeSessionId, homeIsTyping
 *   • All home chat functions: homeSetMode, homeSetInput, homeHandlePdfUpload,
 *     homeAutoResize, homeAppendUser, homeAppendThinking, homeRemoveThinking,
 *     homeAppendAI, homeAppendError, homeScrollBottom, homeHideLanding,
 *     homeSendMessage
 *   • Hero random-phrase picker (runs post-inject)
 *   • DOMContentLoaded listeners for both input bars
 *
 * Bridges set on window.*:
 *   homeSetMode, homeSetInput, homeHandlePdfUpload, homeAutoResize,
 *   homeAppendUser, homeAppendThinking, homeRemoveThinking, homeAppendAI,
 *   homeAppendError, homeScrollBottom, homeHideLanding, homeSendMessage,
 *   homeHistory, _homeSessionId
 *
 * Cross-module references (resolved via window.*):
 *   API_BASE            ← lib/api.js          (window.API_BASE)
 *   homeMarkdown        ← utils/render.js      (window.homeMarkdown)
 *   sanitize            ← utils/render.js      (window.sanitize)
 *   wsShowToast         ← state/workspaceState.js (window.wsShowToast)
 *   recentAdd           ← large script block in index.html (window.recentAdd)
 *   _saveSession        ← large script block in index.html (window._saveSession)
 *   homeToggleAttachMenu← state/workspaceState.js (window.homeToggleAttachMenu)
 *   homeAttachTrigger   ← state/workspaceState.js (window.homeAttachTrigger)
 *   homeHandleAttach    ← state/workspaceState.js (window.homeHandleAttach)
 */

import { API_BASE } from '../lib/api.js';

// ── HTML template ─────────────────────────────────────────────────────────────

const HOME_HTML = /* html */`
<div class="screen active" id="screen-home">

  <aside class="sidebar" data-sidebar-screen="home"></aside>

  <main class="home-main">

    <!-- Mobile topbar: logo + avatar (hidden on desktop via CSS) -->
    <div class="mobile-home-topbar" style="display:none;">
      <div class="mht-logo-row">
        <svg width="26" height="26" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="mht-lg1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#e8ac2e"/><stop offset="100%" stop-color="#8b7cf8"/></linearGradient>
          </defs>
          <ellipse cx="50" cy="50" rx="40" ry="14" fill="none" stroke="url(#mht-lg1)" stroke-width="7" opacity="0.95"/>
          <ellipse cx="50" cy="50" rx="40" ry="14" fill="none" stroke="url(#mht-lg1)" stroke-width="7" transform="rotate(60 50 50)" opacity="0.88"/>
          <ellipse cx="50" cy="50" rx="40" ry="14" fill="none" stroke="url(#mht-lg1)" stroke-width="7" transform="rotate(120 50 50)" opacity="0.80"/>
          <circle cx="50" cy="50" r="7" fill="#e8ac2e"/>
        </svg>
        <span class="mht-logo-text">Chunks</span>
      </div>
      <div class="mht-right">
        <div class="mht-search-btn" title="Search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
        <div class="mht-avatar" onclick="toggleProfileDropdown(event)" title="Profile"></div>
      </div>
    </div>

    <div class="home-glow"></div>

    <!-- Scrollable content -->
    <div class="home-scroll-area" id="home-scroll-area">
      <div class="home-hero">
        <div class="eyebrow-pill">
          <svg class="eyebrow-dot" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="eg-gv" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#e8ac2e"/><stop offset="100%" stop-color="#8b7cf8"/></linearGradient>
              <linearGradient id="eg-vg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#8b7cf8"/><stop offset="100%" stop-color="#e8ac2e"/></linearGradient>
            </defs>
            <ellipse cx="50" cy="50" rx="40" ry="14" fill="none" stroke="url(#eg-gv)" stroke-width="7" opacity="0.95"/>
            <ellipse cx="50" cy="50" rx="40" ry="14" fill="none" stroke="url(#eg-vg)" stroke-width="7" transform="rotate(60 50 50)" opacity="0.88"/>
            <ellipse cx="50" cy="50" rx="40" ry="14" fill="none" stroke="url(#eg-gv)" stroke-width="7" transform="rotate(120 50 50)" opacity="0.80"/>
            <circle cx="50" cy="50" r="7" fill="#e8ac2e"/>
          </svg>
          AI Study Assistant
        </div>
        <h1 class="home-h1" id="home-hero-heading">Study smarter,<br>not <em>harder</em></h1>
        <p class="home-sub" id="home-hero-sub">Ask questions, explore your textbooks, and generate study tools — all in one place.</p>
      </div>

      <!-- ── CHAT HISTORY (hidden until first message) ── -->
      <div class="home-chat-history" id="home-chat-history"></div>

      <!-- ── LANDING (hidden once chat starts) ── -->
      <div id="home-landing">
        <!-- Ask box centered on landing -->
        <div class="ask-box" id="home-ask-box" style="margin-bottom:20px;">
          <div class="ask-plus-wrap">
            <button class="chat-plus" id="home-plus-btn" onclick="homeToggleAttachMenu(event)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
            <div class="attach-menu" id="home-attach-menu">
              <div class="attach-menu-item" onclick="homeAttachTrigger('image')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Image
              </div>
              <div class="attach-menu-item" onclick="homeAttachTrigger('pdf')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                PDF
              </div>
            </div>
          </div>
          <input type="file" id="home-attach-image" accept="image/*" style="display:none;" onchange="homeHandleAttach(this,'image')">
          <input type="file" id="home-attach-pdf-new" accept="application/pdf" style="display:none;" onchange="homeHandleAttach(this,'pdf')">
          <textarea id="home-ask-input" class="ask-textarea" placeholder="Ask anything…" rows="1"></textarea>
          <button class="ask-send" id="home-send-btn" data-action="homeSendMessage">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <div id="home-attach-preview" class="attach-preview" style="margin-bottom:8px;"></div>

        <div class="quick-grid">
          <div class="quick-card" data-action="openLibraryModal">
            <div class="qc-icon gold">📚</div>
            <div class="qc-title">Open Textbook</div>
            <div class="qc-desc">Browse your library and study alongside AI</div>
          </div>
          <div class="quick-card" data-action="showScreen" data-screen="flash">
            <div class="qc-icon violet">🃏</div>
            <div class="qc-title">Flashcards</div>
            <div class="qc-desc">Generate and review study cards from any chapter</div>
          </div>
          <div class="quick-card" onclick="document.getElementById('home-pdf-upload').click()">
            <div class="qc-icon teal">⬆️</div>
            <div class="qc-title">Upload PDF</div>
            <div class="qc-desc">Add your own notes or textbooks to chat with</div>
          </div>
        </div>
        <input type="file" id="home-pdf-upload" accept="application/pdf" style="display:none;" onchange="homeHandlePdfUpload(this)">
        <p class="prompts-label">Try asking</p>
        <div class="prompts-chips">
          <button class="prompt-chip" data-action="homeSetInput-text">Photosynthesis</button>
          <button class="prompt-chip" data-action="homeSetInput-text">Newton's Laws of Motion</button>
          <button class="prompt-chip" data-action="homeSetInput-text">Cell Division</button>
          <button class="prompt-chip" data-action="homeSetInput-text">The French Revolution</button>
          <button class="prompt-chip" data-action="homeSetInput-text">Supply and Demand</button>
          <button class="prompt-chip" data-action="homeSetInput-text">Pythagorean Theorem</button>
        </div>
      </div> <!-- end home-landing -->
    </div> <!-- end home-scroll-area -->

    <!-- Sticky bottom input bar — shown only after first message -->
    <div class="home-input-bar" id="home-input-bar" style="display:none;">
      <div id="home-attach-preview-bottom" class="attach-preview" style="margin-bottom:4px;"></div>
      <div class="ask-box" id="home-ask-box-bottom" style="max-width:860px;">
        <div class="ask-plus-wrap">
          <button class="chat-plus" id="home-plus-btn-bottom" onclick="homeToggleAttachMenu(event,'bottom')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
          <div class="attach-menu" id="home-attach-menu-bottom">
            <div class="attach-menu-item" onclick="homeAttachTrigger('image','bottom')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Image
            </div>
            <div class="attach-menu-item" onclick="homeAttachTrigger('pdf','bottom')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              PDF
            </div>
          </div>
        </div>
        <input type="file" id="home-attach-image-bottom" accept="image/*" style="display:none;" onchange="homeHandleAttach(this,'image','bottom')">
        <input type="file" id="home-attach-pdf-bottom" accept="application/pdf" style="display:none;" onchange="homeHandleAttach(this,'pdf','bottom')">
        <textarea id="home-ask-input-bottom" class="ask-textarea" placeholder="Ask anything…" rows="1"></textarea>
        <button class="ask-send" id="home-send-btn-bottom" data-action="homeSendMessage">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <div class="home-disclaimer">Chunks AI can make mistakes. Verify important information.</div>
    </div>

  </main>
</div>

<!-- ══ INCOGNITO CHAT MODAL ══════════════════════════════════
     Fully self-contained — zero localStorage writes.
     Opened via profile dropdown item or Ctrl+Shift+I.
════════════════════════════════════════════════════════════ -->
<div class="incognito-modal" id="incognito-modal" role="dialog" aria-modal="true" aria-labelledby="incognito-modal-title">
  <div class="incognito-panel">
    <div class="incognito-header">
      <div class="incognito-header-left">
        <div class="incognito-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div>
          <div class="incognito-title" id="incognito-modal-title">Incognito Chat</div>
          <div class="incognito-subtitle">This conversation won't be saved anywhere</div>
        </div>
      </div>
      <button class="incognito-close" onclick="closeIncognitoChat()" aria-label="Close incognito chat">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="incognito-notice">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      No history saved &nbsp;&middot;&nbsp; Cleared when closed &nbsp;&middot;&nbsp; Private session
    </div>
    <div class="incognito-messages" id="incognito-messages">
      <div class="incognito-empty" id="incognito-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <p>Ask anything &mdash; nothing will be saved</p>
      </div>
    </div>
    <div class="incognito-input-bar">
      <textarea id="incognito-input" class="incognito-textarea" placeholder="Ask anything privately&hellip;" rows="1"></textarea>
      <button class="incognito-send" id="incognito-send-btn" onclick="incognitoSendMessage()" aria-label="Send">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
    <div class="incognito-footer-note">Ctrl + Shift + I to toggle &nbsp;&middot;&nbsp; Esc to close</div>
  </div>
</div>
`;

// ── Random hero phrases ───────────────────────────────────────────────────────

const HERO_PHRASES = [
  { h: 'Study smarter,<br>not <em>harder</em>',         s: 'Ask questions, explore your textbooks, and generate study tools — all in one place.' },
  { h: 'Learn faster,<br>remember <em>longer</em>',     s: 'Your AI-powered study companion that turns difficult concepts into clear understanding.' },
  { h: 'Knowledge is<br>your <em>superpower</em>',      s: 'Ask anything, study everything — Chunks AI has your back every step of the way.' },
  { h: 'Stop cramming,<br>start <em>understanding</em>',s: 'Deep learning, not surface memorization. Let Chunks AI guide you to real mastery.' },
  { h: 'Every expert<br>was once a <em>beginner</em>',  s: 'Break down complex topics, one question at a time. Your journey starts here.' },
  { h: 'Your grades,<br>your <em>future</em>',          s: 'Study with purpose. Chunks AI helps you focus on what matters most.' },
  { h: 'Turn confusion<br>into <em>clarity</em>',       s: 'No question is too hard. Chunks AI breaks it down until it clicks.' },
  { h: 'Ace your exams,<br>own your <em>success</em>',  s: 'Flashcards, summaries, practice questions — everything you need, all in one place.' },
];

// ── State ─────────────────────────────────────────────────────────────────────

export let homeMode      = 'general';
export let homeHistory   = [];
export let _homeSessionId = null;
let homeIsTyping = false;

// ── Incognito chat state (lives only in memory — never written to storage) ────
let _incogHistory = [];
let _incogTyping  = false;
let _incogFocus   = null;

// ── Incognito chat functions ──────────────────────────────────────────────────

export function openIncognitoChat() {
  const modal = document.getElementById('incognito-modal');
  if (!modal) return;
  _incogHistory = [];
  const msgs = document.getElementById('incognito-messages');
  if (msgs) {
    msgs.innerHTML = `
      <div class="incognito-empty" id="incognito-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <p>Ask anything — nothing will be saved</p>
      </div>`;
  }
  const inp = document.getElementById('incognito-input');
  if (inp) { inp.value = ''; inp.style.height = '24px'; }
  modal.classList.add('active');
  if (typeof trapFocus === 'function') _incogFocus = trapFocus(modal);
  setTimeout(() => document.getElementById('incognito-input')?.focus(), 80);
}

export function closeIncognitoChat() {
  const modal = document.getElementById('incognito-modal');
  if (!modal) return;
  modal.classList.remove('active');
  if (_incogFocus) { _incogFocus(); _incogFocus = null; }
  _incogHistory = [];
}

function _incogAutoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function _incogScrollBottom() {
  const msgs = document.getElementById('incognito-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function _incogAvatarSvg() {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="13" height="13">
    <ellipse cx="50" cy="50" rx="38" ry="13" fill="none" stroke="#9b8fe8" stroke-width="9" opacity="0.95"/>
    <ellipse cx="50" cy="50" rx="38" ry="13" fill="none" stroke="#9b8fe8" stroke-width="9" transform="rotate(60 50 50)" opacity="0.75"/>
    <ellipse cx="50" cy="50" rx="38" ry="13" fill="none" stroke="#9b8fe8" stroke-width="9" transform="rotate(120 50 50)" opacity="0.55"/>
    <circle cx="50" cy="50" r="7" fill="#9b8fe8"/>
  </svg>`;
}

function _incogAppendUser(text) {
  document.getElementById('incognito-empty')?.remove();
  const msgs = document.getElementById('incognito-messages');
  const d = document.createElement('div');
  d.className = 'incognito-msg incognito-msg-user';
  d.textContent = text;
  msgs.appendChild(d);
  _incogScrollBottom();
}

function _incogAppendThinking() {
  const msgs = document.getElementById('incognito-messages');
  const d = document.createElement('div');
  d.className = 'incognito-msg incognito-msg-ai';
  d.id = 'incognito-thinking';
  d.innerHTML = `
    <div class="incognito-ai-row">
      <div class="incognito-ai-ava">${_incogAvatarSvg()}</div>
      <div class="hc-thinking"><span></span><span></span><span></span><span></span><span></span></div>
    </div>`;
  msgs.appendChild(d);
  _incogScrollBottom();
}

function _incogRemoveThinking() {
  document.getElementById('incognito-thinking')?.remove();
}

function _incogAppendAI(text) {
  const msgs = document.getElementById('incognito-messages');
  const d = document.createElement('div');
  d.className = 'incognito-msg incognito-msg-ai';
  d.innerHTML = `
    <div class="incognito-ai-row">
      <div class="incognito-ai-ava">${_incogAvatarSvg()}</div>
      <div class="incognito-ai-body">${window.homeMarkdown?.(text) ?? text.replace(/</g,'&lt;')}</div>
    </div>`;
  msgs.appendChild(d);
  _incogScrollBottom();
}

function _incogAppendError(msg) {
  const msgs = document.getElementById('incognito-messages');
  const d = document.createElement('div');
  d.className = 'incognito-msg incognito-msg-error';
  d.textContent = '\u26a0 ' + msg;
  msgs.appendChild(d);
  _incogScrollBottom();
}

export async function incognitoSendMessage() {
  if (_incogTyping) return;
  const inp = document.getElementById('incognito-input');
  const btn = document.getElementById('incognito-send-btn');
  const question = inp?.value?.trim();
  if (!question) return;

  inp.value = '';
  inp.style.height = '24px';
  _incogAppendUser(question);
  _incogHistory.push({ role: 'user', content: question });

  _incogTyping = true;
  if (btn) btn.disabled = true;
  _incogAppendThinking();

  try {
    const res = await fetch(`${API_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        bookId: '',
        mode: 'general',
        complexity: 5,
        history: _incogHistory.slice(-12),
      }),
    });
    _incogRemoveThinking();
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      _incogAppendError(err.error || `Error ${res.status}`);
      _incogHistory.pop();
    } else {
      const data   = await res.json();
      const answer = data.answer || 'No response.';
      _incogAppendAI(answer);
      _incogHistory.push({ role: 'assistant', content: answer });
    }
  } catch (e) {
    _incogRemoveThinking();
    _incogAppendError('Could not reach the server. Check your connection.');
    _incogHistory.pop();
  } finally {
    _incogTyping = false;
    if (btn) btn.disabled = false;
    setTimeout(() => inp?.focus(), 60);
  }
}

function _wireIncognitoListeners() {
  const inp = document.getElementById('incognito-input');
  if (!inp) return;
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); incognitoSendMessage(); }
  });
  inp.addEventListener('input', function() { _incogAutoResize(this); });
}

function _wireIncognitoBackdrop() {
  const modal = document.getElementById('incognito-modal');
  if (!modal) return;
  modal.addEventListener('click', e => { if (e.target === modal) closeIncognitoChat(); });
}

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mountHomeScreen() {
  const placeholder = document.querySelector('[data-home-screen]');
  if (!placeholder) {
    console.warn('[HomeScreen] placeholder [data-home-screen] not found');
    return;
  }
  placeholder.outerHTML = HOME_HTML;

  // Random hero phrase
  const pick = HERO_PHRASES[Math.floor(Math.random() * HERO_PHRASES.length)];
  const heading = document.getElementById('home-hero-heading');
  const sub     = document.getElementById('home-hero-sub');
  if (heading) heading.innerHTML  = pick.h;
  if (sub)     sub.textContent    = pick.s;

  // Wire incognito modal listeners immediately after DOM is injected
  _wireIncognitoListeners();
  _wireIncognitoBackdrop();
}

// ── Mode toggle ───────────────────────────────────────────────────────────────

export function homeSetMode(mode) {
  homeMode = mode;
  document.getElementById('book-chip')?.classList.toggle('active', mode === 'book');
  document.getElementById('general-chip')?.classList.toggle('active', mode === 'general');
}

// ── Fill input from prompt chip / quick card ──────────────────────────────────

export function homeSetInput(text) {
  const bar = document.getElementById('home-input-bar');
  const chatActive = bar && bar.style.display !== 'none';
  const inp = document.getElementById(chatActive ? 'home-ask-input-bottom' : 'home-ask-input');
  if (!inp) return;
  inp.value = text;
  inp.focus();
  homeAutoResize(inp);
}

// ── PDF quick-upload ──────────────────────────────────────────────────────────

export function homeHandlePdfUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const name = file.name.replace(/\.pdf$/i, '');
  window._uploadedPdfFile = file;
  window._uploadedPdfName = name;
  window.wsShowToast?.('📄', `"${name}" ready to chat`, '');
  homeSetInput(`Summarize "${name}" for me`);
  input.value = '';
}

// ── Auto-resize textarea ──────────────────────────────────────────────────────

export function homeAutoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  const box = el.closest('.ask-box');
  if (box) box.classList.toggle('is-multiline', el.scrollHeight > 30);
}

// ── Message bubble builders ───────────────────────────────────────────────────

export function homeAppendUser(text) {
  const el = document.createElement('div');
  el.className = 'hc-user';
  el.textContent = text;
  document.getElementById('home-chat-history').appendChild(el);
  homeScrollBottom();
}

export function homeAppendThinking() {
  const wrap = document.createElement('div');
  wrap.className = 'hc-ai';
  wrap.id = 'hc-thinking';
  wrap.innerHTML = `
    <div class="hc-ai-avatar" style="background:linear-gradient(135deg,#1a1508,#231538);border:1px solid rgba(200,168,75,0.3);overflow:visible;">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
        <ellipse cx="50" cy="50" rx="38" ry="13" fill="none" stroke="#c8a84b" stroke-width="9" opacity="0.95"/>
        <ellipse cx="50" cy="50" rx="38" ry="13" fill="none" stroke="#a855f7" stroke-width="9" transform="rotate(60 50 50)" opacity="0.85"/>
        <ellipse cx="50" cy="50" rx="38" ry="13" fill="none" stroke="#c8a84b" stroke-width="9" transform="rotate(120 50 50)" opacity="0.75"/>
        <circle cx="50" cy="50" r="7" fill="#e8ac2e"/>
      </svg>
    </div>
    <div class="hc-ai-body">
      <div style="display:flex;align-items:center;gap:9px;padding:2px 0;">
        <div class="hc-thinking"><span></span><span></span><span></span><span></span><span></span></div>
        <span id="home-thinking-label" style="font-size:11px;color:rgba(255,255,255,0.35);font-family:monospace;letter-spacing:0.04em;">Thinking…</span>
      </div>
    </div>`;
  document.getElementById('home-chat-history').appendChild(wrap);
  homeScrollBottom();
  const labels = ['Thinking…', 'Searching book…', 'Reading context…', 'Composing answer…'];
  let li = 0;
  wrap._labelTimer = setInterval(() => {
    const el = document.getElementById('home-thinking-label');
    if (el) { li = (li + 1) % labels.length; el.textContent = labels[li]; }
  }, 1800);
}

export function homeRemoveThinking() {
  const el = document.getElementById('hc-thinking');
  if (el) { clearInterval(el._labelTimer); el.remove(); }
}

export function homeAppendAI(text, sources) {
  const wrap = document.createElement('div');
  wrap.className = 'hc-ai';
  let sourceBadge = '';
  if (sources && sources.length > 0) {
    sourceBadge = `<div class="hc-source-badge">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
      📖 Page ${sources[0].page}
    </div>`;
  }
  wrap.innerHTML = `
    <div class="hc-ai-avatar">✦</div>
    <div class="hc-ai-body">${window.homeMarkdown(text)}${sourceBadge}</div>`;
  document.getElementById('home-chat-history').appendChild(wrap);
  homeScrollBottom();
}

export function homeAppendError(msg) {
  const el = document.createElement('div');
  el.className = 'hc-error';
  el.textContent = '⚠ ' + msg;
  document.getElementById('home-chat-history').appendChild(el);
  homeScrollBottom();
}

export function homeScrollBottom(instant = false) {
  const area = document.getElementById('home-scroll-area');
  if (!area) return;
  if (instant) {
    area.style.scrollBehavior = 'auto';
    area.scrollTop = area.scrollHeight;
    area.style.scrollBehavior = '';
  } else {
    area.scrollTop = area.scrollHeight;
  }
}

// ── Hide landing when first message sent ──────────────────────────────────────

export function homeHideLanding() {
  const landing    = document.getElementById('home-landing');
  const hero       = document.querySelector('.home-hero');
  const bar        = document.getElementById('home-input-bar');
  const scrollArea = document.getElementById('home-scroll-area');
  if (landing)    landing.style.display = 'none';
  if (hero)       hero.style.display = 'none';
  if (bar)        bar.style.display = 'flex';
  if (scrollArea) scrollArea.style.justifyContent = 'flex-start';
  setTimeout(() => {
    document.getElementById('home-ask-input-bottom')?.focus();
  }, 50);
}

// ── Main send ─────────────────────────────────────────────────────────────────

export async function homeSendMessage() {
  if (homeIsTyping) return;
  const bar = document.getElementById('home-input-bar');
  const chatActive = bar && bar.style.display !== 'none';
  const inp     = document.getElementById(chatActive ? 'home-ask-input-bottom' : 'home-ask-input');
  const sendBtn = document.getElementById(chatActive ? 'home-send-btn-bottom' : 'home-send-btn');

  const question = inp.value.trim();
  if (!question) return;

  // On the FIRST message of a session: create a recent entry which
  // also sets window._homeSessionId via recentAdd → _saveRecent.
  // We must call recentAdd BEFORE appending to homeHistory so the
  // session id is assigned before the first _saveSession call below.
  if (!_homeSessionId) {
    window.recentAdd?.(question, null, 'general');
    // recentAdd sets window._homeSessionId via the index.html closure;
    // read it back so this module's local var is in sync.
    if (window._homeSessionId) _homeSessionId = window._homeSessionId;
  }

  homeHideLanding();
  homeAppendUser(question);
  inp.value = '';
  inp.style.height = '24px';
  setTimeout(() => document.getElementById('home-ask-input-bottom')?.focus(), 60);

  homeHistory.push({ role: 'user', content: question });

  // Save immediately so refresh before AI responds still restores the chat.
  // _homeSessionId is now guaranteed to be set (created above if new).
  if (_homeSessionId) {
    window._saveSession?.(_homeSessionId, homeHistory);
    localStorage.setItem('chunks_active_home_session', _homeSessionId);
    window._renderAllRecent?.();
  }

  homeIsTyping = true;
  homeAppendThinking();
  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        bookId: '',
        mode: 'general',
        complexity: 5,
        history: homeHistory.slice(-12),
      }),
    });

    homeRemoveThinking();

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      homeAppendError(err.error || `Error ${res.status}`);
      homeHistory.pop();
    } else {
      const data   = await res.json();
      const answer = data.answer || 'No response.';
      homeAppendAI(answer, null);
      homeHistory.push({ role: 'assistant', content: answer });
      // Overwrite with full exchange (user + AI)
      if (_homeSessionId) {
        window._saveSession?.(_homeSessionId, homeHistory);
        localStorage.setItem('chunks_active_home_session', _homeSessionId);
        window._renderAllRecent?.();
      }
    }
  } catch (e) {
    homeRemoveThinking();
    homeAppendError('Could not reach the server. Check your connection.');
    homeHistory.pop();
  } finally {
    homeIsTyping = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

// ── Auto-mount (synchronous) ──────────────────────────────────────────────────
// mountHomeScreen() runs immediately at module evaluation time — before
// navigation.js's _restoreScreen() IIFE calls getElementById('screen-home').
// The placeholder <div data-home-screen> is already in the static HTML so the
// DOM is ready for this replacement even before DOMContentLoaded fires.
mountHomeScreen();

// ── Session restore (runs immediately after mount) ────────────────────────────
// Previously lived in a non-module <script> in index.html, which fired before
// type="module" scripts — so #screen-home didn't exist yet. Now it runs right
// here, after mountHomeScreen() has injected the DOM.
(function _restoreHomeSession() {
  if (sessionStorage.getItem('chunks_is_refresh') !== '1') return;

  const activeScreen   = sessionStorage.getItem('chunks_active_screen');
  const activeRecentId = localStorage.getItem('chunks_active_recent_id');

  // Workspace restore is handled by workspaceState.js — skip it here
  if (activeScreen === 'workspace' || (!activeScreen && localStorage.getItem('chunks_active_ws_book'))) {
    const bookId = localStorage.getItem('chunks_active_ws_book');
    if (bookId) {
      const _loadWsSession = window._loadWsSession;
      const wsSession = _loadWsSession?.(bookId);
      window.selectBook?.(bookId).then(() => {
        if (wsSession && wsSession.html) {
          setTimeout(() => {
            const msgs = document.getElementById('ws-messages');
            if (msgs) msgs.innerHTML = window.sanitize?.(wsSession.html) ?? wsSession.html;
            window._wsChatHistory = wsSession.history || [];
            if (activeRecentId) window._setActiveRecent?.(activeRecentId);
            setTimeout(() => {
              const m = document.getElementById('ws-messages');
              if (m) m.scrollTop = m.scrollHeight;
            }, 80);
          }, 600);
        }
      });
    }
    return;
  }

  // ── Restore home chat ──
  const savedId = localStorage.getItem('chunks_active_home_session');
  if (!savedId || (activeScreen && activeScreen !== 'home')) return;

  let session;
  try { session = JSON.parse(localStorage.getItem('chunks_session_' + savedId)); } catch (e) {}
  if (!session?.html) return;

  const landing    = document.getElementById('home-landing');
  const hero       = document.querySelector('.home-hero');
  const bar        = document.getElementById('home-input-bar');
  const scrollArea = document.getElementById('home-scroll-area');
  const chatHist   = document.getElementById('home-chat-history');
  if (landing)    landing.style.display = 'none';
  if (hero)       hero.style.display = 'none';
  if (bar)        bar.style.display = 'flex';
  if (scrollArea) scrollArea.style.justifyContent = 'flex-start';
  if (chatHist)   chatHist.innerHTML = window.sanitize?.(session.html) ?? session.html;
  homeHistory    = session.history || [];
  _homeSessionId = savedId;
  window._setActiveRecent?.(savedId);
  setTimeout(() => homeScrollBottom(true), 80);
})();

// ── Wire input listeners (after DOM is interactive) ───────────────────────────
function _wireHomeListeners() {
  // Top input
  document.getElementById('home-ask-input')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); homeSendMessage(); }
  });
  document.getElementById('home-ask-input')?.addEventListener('input', function () {
    homeAutoResize(this);
  });

  // Bottom input bar
  const bottomInput = document.getElementById('home-ask-input-bottom');
  if (bottomInput) {
    bottomInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); homeSendMessage(); }
    });
    bottomInput.addEventListener('input', function () { homeAutoResize(this); });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _wireHomeListeners);
} else {
  _wireHomeListeners();
}

// ── Window bridges (keep un-migrated inline scripts working) ──────────────────

window.homeSetMode        = homeSetMode;
window.homeSetInput       = homeSetInput;
window.homeHandlePdfUpload= homeHandlePdfUpload;
window.homeAutoResize     = homeAutoResize;
window.homeAppendUser     = homeAppendUser;
window.homeAppendThinking = homeAppendThinking;
window.homeRemoveThinking = homeRemoveThinking;
window.homeAppendAI       = homeAppendAI;
window.homeAppendError    = homeAppendError;
window.homeScrollBottom   = homeScrollBottom;
window.homeHideLanding    = homeHideLanding;
window.homeSendMessage    = homeSendMessage;

// ── Incognito chat bridges ────────────────────────────────────────────────────
window.openIncognitoChat    = openIncognitoChat;
window.closeIncognitoChat   = closeIncognitoChat;
window.incognitoSendMessage = incognitoSendMessage;

// Export mutable state refs to window so cross-module code (goHome, newChat,
// session-restore block) can read/write homeHistory and _homeSessionId.
// Since ES modules export live bindings we expose getters/setters.
Object.defineProperty(window, 'homeHistory', {
  get: () => homeHistory,
  set: (v) => { homeHistory = v; },
  configurable: true,
});
Object.defineProperty(window, '_homeSessionId', {
  get: () => _homeSessionId,
  set: (v) => { _homeSessionId = v; },
  configurable: true,
});

console.log('[HomeScreen] module loaded ✦');