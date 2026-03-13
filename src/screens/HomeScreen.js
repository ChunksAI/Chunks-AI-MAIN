/**
 * src/screens/HomeScreen.js — Home screen
 *
 * Owns all JavaScript for the Home / General AI screen:
 *   - Recent-items list (sidebar): add, delete, rename, pin, render, ctx menu
 *   - goHome() / newChat() — navigation + state reset helpers
 *   - Home chat: send, append, thinking, scroll, hide-landing
 *   - Home mode toggle, input helpers, PDF/image attachments
 *   - Session restore on page refresh
 *
 * The static HTML (`#screen-home`) remains in index.html until Task 38.
 *
 * Exports
 * ───────
 *   goHome()
 *   newChat()
 *   recentAdd(question, bookId, source)
 *   homeSetMode(mode)
 *   homeSetInput(text)
 *   homeHandlePdfUpload(input)
 *   homeAutoResize(el)
 *   homeScrollBottom()
 *   homeHideLanding()
 *   homeSendMessage()
 *   homeToggleAttachMenu(e, slot)
 *   homeAttachTrigger(type, slot)
 *   homeHandleAttach(input, type, slot)
 *   homeAppendUser(text)
 *   homeAppendAI(text, sources)
 *   homeAppendError(msg)
 *
 * window globals set
 * ──────────────────
 *   window.goHome, window.newChat, window.recentAdd
 *   window._setActiveRecent, window._deleteRecent
 *   window._recentItems, window._activeRecentId
 *   window._renderAllRecent, window._renderRecentList
 *   window.homeMode, window.homeHistory
 *   window._homeSessionId, window.homeIsTyping
 *   window.homeSetMode, window.homeSetInput
 *   window.homeHandlePdfUpload, window.homeAutoResize
 *   window.homeScrollBottom, window.homeHideLanding
 *   window.homeSendMessage
 *   window.homeToggleAttachMenu, window.homeAttachTrigger
 *   window.homeHandleAttach
 *   window.homeAppendUser, window.homeAppendAI, window.homeAppendError
 *
 * Task 25 — extracted from monolith:
 *   RECENT_MAX / CHAT_SVG constants         → line 2655
 *   _recentItems / _activeRecentId state    → line 2658
 *   goHome / newChat                        → line 2665
 *   recentAdd / _setActiveRecent            → line 2778
 *   _deleteRecent / _clickRecent            → line 2821
 *   _buildRecentItem / ctx menu             → line 2916
 *   _renderAllRecent / _renderRecentList    → line 3011
 *   session-restore-on-refresh block        → line 3045
 *   ws-chat-send recent hook                → line 3095
 *   homeMode / homeHistory / _homeSessionId → line 3114
 *   homeSetMode / homeSetInput              → line 3120
 *   homeHandlePdfUpload / homeAutoResize    → line 3136
 *   homeAppend* / homeScrollBottom          → line 3163
 *   homeHideLanding / homeSendMessage       → line 3236
 *   homeToggleAttachMenu / homeAttachTrigger
 *     / homeHandleAttach / _homeRenderPreview → line 4202
 */

import { API_BASE } from '../lib/api.js';
import {
  saveRecentItems,
  loadHomeSession,
  loadWsSession,
} from '../utils/storage.js';

// ── Constants ──────────────────────────────────────────────────────────────

const RECENT_MAX = 8;

const CHAT_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

// ── State ──────────────────────────────────────────────────────────────────

export let _recentItems   = JSON.parse(localStorage.getItem('chunks_recent') || 'null') || [];
export let _activeRecentId = null;

export let homeMode       = 'general';
export let homeHistory    = [];
export let _homeSessionId = null;
export let homeIsTyping   = false;

// ── Helpers (file read + thumbnail — also used by workspace) ───────────────

function _readFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function _buildThumb(att, removeFn) {
  const wrap = document.createElement('div');
  wrap.className = 'attach-thumb';
  if (att.type === 'image') {
    const img = document.createElement('img');
    img.src = att.dataUrl; img.alt = att.name;
    wrap.appendChild(img);
  } else {
    const label = document.createElement('div');
    label.className = 'attach-thumb-pdf';
    label.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${att.name.slice(0, 8)}</span>`;
    wrap.appendChild(label);
  }
  const rm = document.createElement('button');
  rm.className = 'attach-remove'; rm.innerHTML = '✕';
  rm.onclick = removeFn;
  wrap.appendChild(rm);
  return wrap;
}

// ── Reset home UI to landing state ─────────────────────────────────────────

function _resetHomeLanding() {
  const chatHist    = document.getElementById('home-chat-history');
  const homeLanding = document.getElementById('home-landing');
  const homeHero    = document.querySelector('.home-hero');
  const homeBar     = document.getElementById('home-input-bar');
  const homeScroll  = document.getElementById('home-scroll-area');
  if (chatHist)    chatHist.innerHTML = '';
  if (homeLanding) homeLanding.style.display = '';
  if (homeHero)    homeHero.style.display = '';
  if (homeBar)     homeBar.style.display = 'none';
  if (homeScroll)  homeScroll.style.justifyContent = 'center';
}

// ── Navigation ─────────────────────────────────────────────────────────────

export function goHome() {
  _activeRecentId = null;
  homeHistory    = [];
  _homeSessionId = null;
  localStorage.removeItem('chunks_active_home_session');
  localStorage.removeItem('chunks_active_ws_book');
  localStorage.removeItem('chunks_active_recent_id');

  _resetHomeLanding();

  document.querySelectorAll('.recent-item').forEach(el => el.classList.remove('active'));

  window.showScreen?.('home');
}

export function newChat() {
  const _activeNow = document.querySelector('.screen.active');
  if (!_activeNow || _activeNow.id !== 'screen-home') window.showScreen?.('home');

  // Clear workspace messages
  const msgs = document.getElementById('ws-messages');
  if (msgs) msgs.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-4);text-align:center;padding:24px;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <div style="font-size:12px;color:var(--text-4);">Ask a question to start the conversation</div>
    </div>`;

  // Reset state
  if (window._wsChatHistory !== undefined) window._wsChatHistory = [];
  _activeRecentId = null;
  homeHistory    = [];
  _homeSessionId = null;
  localStorage.removeItem('chunks_active_home_session');
  localStorage.removeItem('chunks_home_session');
  localStorage.removeItem('chunks_active_ws_book');
  localStorage.removeItem('chunks_active_recent_id');

  if (!window._newChatIsIncognito) {
    localStorage.removeItem('chunks_incognito_session');
    const badge = document.getElementById('incognito-badge');
    if (badge) badge.style.display = 'none';
  }
  if (window._newChatIsIncognito !== undefined) window._newChatIsIncognito = false;

  _resetHomeLanding();

  // Rotate hero heading
  (function () {
    const phrases = [
      { h: 'Study smarter,<br>not <em>harder</em>', s: 'Ask questions, explore your textbooks, and generate study tools — all in one place.' },
      { h: 'Learn faster,<br>remember <em>longer</em>', s: 'Your AI-powered study companion that turns difficult concepts into clear understanding.' },
      { h: 'Knowledge is<br>your <em>superpower</em>', s: 'Ask anything, study everything — Chunks AI has your back every step of the way.' },
      { h: 'Stop cramming,<br>start <em>understanding</em>', s: 'Deep learning, not surface memorization. Let Chunks AI guide you to real mastery.' },
      { h: 'Every expert<br>was once a <em>beginner</em>', s: 'Break down complex topics, one question at a time. Your journey starts here.' },
      { h: 'Your grades,<br>your <em>future</em>', s: 'Study with purpose. Chunks AI helps you focus on what matters most.' },
      { h: 'Turn confusion<br>into <em>clarity</em>', s: 'No question is too hard. Chunks AI breaks it down until it clicks.' },
      { h: 'Ace your exams,<br>own your <em>success</em>', s: 'Flashcards, summaries, practice questions — everything you need, all in one place.' },
    ];
    const current = document.getElementById('home-hero-heading')?.innerHTML || '';
    let pick;
    do { pick = phrases[Math.floor(Math.random() * phrases.length)]; }
    while (pick.h === current && phrases.length > 1);
    const h = document.getElementById('home-hero-heading');
    const s = document.getElementById('home-hero-sub');
    if (h) h.innerHTML = pick.h;
    if (s) s.textContent = pick.s;
  })();

  const inp = document.getElementById('ws-chat-input');
  if (inp && typeof window.wsAutoResize === 'function') { inp.value = ''; window.wsAutoResize(inp); }

  const ctag = document.getElementById('ws-context-tag');
  if (ctag) {
    const bookLabel = window.wsBookMeta?.[window._wsBookId]?.split('/')?.[0]?.trim() || 'No book';
    ctag.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg> ${bookLabel}`;
  }

  const title = document.getElementById('ws-chat-title');
  if (title) title.textContent = 'Select a book to start studying';

  window.showScreen?.('workspace');
  setTimeout(() => inp?.focus(), 120);

  _renderAllRecent();
}

// ── Recent items ───────────────────────────────────────────────────────────

function _saveRecent() {
  saveRecentItems(_recentItems);
}

export function recentAdd(question, bookId, source) {
  if (!question) return;
  const label = question.length > 32 ? question.slice(0, 32).trimEnd() + '…' : question;

  if (_recentItems.length &&
      _recentItems[0].question === question &&
      _recentItems[0].source === source) {
    _setActiveRecent(_recentItems[0].id);
    if (source === 'general') {
      _homeSessionId = _recentItems[0].id;
      localStorage.setItem('chunks_home_session', _homeSessionId);
    }
    return;
  }

  const item = {
    id:     'r' + Date.now(),
    label,
    question,
    bookId: bookId || window._wsBookId || '',
    source: source || (bookId ? 'workspace' : 'general'),
  };

  _recentItems.unshift(item);
  if (_recentItems.length > RECENT_MAX) _recentItems = _recentItems.slice(0, RECENT_MAX);
  _saveRecent();
  _renderAllRecent();
  _setActiveRecent(item.id);

  if (source === 'general') {
    _homeSessionId = item.id;
    localStorage.setItem('chunks_home_session', _homeSessionId);
  }
}

function _setActiveRecent(id) {
  _activeRecentId = id;
  document.querySelectorAll('.recent-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
  if (id) localStorage.setItem('chunks_active_recent_id', id);
  else    localStorage.removeItem('chunks_active_recent_id');
}

function _deleteRecent(id, e) {
  e.stopPropagation?.();

  const item = _recentItems.find(r => r.id === id);
  _recentItems = _recentItems.filter(r => r.id !== id);
  _saveRecent();

  localStorage.removeItem('chunks_session_' + id);
  if (item?.bookId) localStorage.removeItem('chunks_ws_session_' + item.bookId);

  if (_activeRecentId === id) {
    _activeRecentId = null;
    localStorage.removeItem('chunks_active_recent_id');
    localStorage.removeItem('chunks_active_home_session');
    localStorage.removeItem('chunks_active_ws_book');

    homeHistory    = [];
    _homeSessionId = null;
    _resetHomeLanding();

    const msgs = document.getElementById('ws-messages');
    if (msgs) msgs.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-4);text-align:center;padding:24px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><div style="font-size:12px;color:var(--text-4);">Ask a question to start the conversation</div></div>`;
    if (window._wsChatHistory !== undefined) window._wsChatHistory = [];

    window.showScreen?.('home');
  }

  _renderAllRecent();
}

function _clickRecent(item) {
  _setActiveRecent(item.id);

  if (item.source === 'general' || !item.bookId) {
    window.showScreen?.('home');
    const session     = loadHomeSession(item.id);
    const landing     = document.getElementById('home-landing');
    const hero        = document.querySelector('.home-hero');
    const bar         = document.getElementById('home-input-bar');
    const scrollArea  = document.getElementById('home-scroll-area');
    const chatHistory = document.getElementById('home-chat-history');

    if (session?.html) {
      if (landing)     landing.style.display = 'none';
      if (hero)        hero.style.display = 'none';
      if (bar)         bar.style.display = 'flex';
      if (scrollArea)  scrollArea.style.justifyContent = 'flex-start';
      if (chatHistory) chatHistory.innerHTML = window.sanitize?.(session.html) ?? session.html;
      homeHistory    = session.history || [];
      _homeSessionId = item.id;
      setTimeout(() => {
        homeScrollBottom();
        document.getElementById('home-ask-input-bottom')?.focus();
      }, 60);
    } else {
      if (landing)    landing.style.display = 'none';
      if (hero)       hero.style.display = 'none';
      if (bar)        bar.style.display = 'flex';
      if (scrollArea) scrollArea.style.justifyContent = 'flex-start';
      _homeSessionId = item.id;
      setTimeout(() => {
        const bi = document.getElementById('home-ask-input-bottom');
        if (bi) { bi.value = item.question; bi.focus(); homeAutoResize(bi); }
      }, 80);
    }
  } else {
    window.showScreen?.('workspace');
    const go = () => { window.wsSetInput?.(item.question); window.wsChatSend?.(); };
    if (item.bookId !== window._wsBookId) {
      window.selectBook?.(item.bookId).then(() => setTimeout(go, 300));
    } else {
      setTimeout(go, 80);
    }
  }
}

// ── Context menu ───────────────────────────────────────────────────────────

let _ctxMenuEl = null;

function _closeCtxMenu() {
  if (_ctxMenuEl) { _ctxMenuEl.remove(); _ctxMenuEl = null; }
}

function _showRecentCtxMenu(item, e) {
  _closeCtxMenu();

  const menu = document.createElement('div');
  menu.className = 'recent-ctx-menu';
  _ctxMenuEl = menu;

  const isPinned = item.pinned || false;
  menu.innerHTML = `
    <div class="recent-ctx-item" data-action="rename">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Rename
    </div>
    <div class="recent-ctx-item" data-action="pin">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      ${isPinned ? 'Unpin chat' : 'Pin chat'}
    </div>
    <div class="recent-ctx-divider"></div>
    <div class="recent-ctx-item danger" data-action="delete">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      Delete
    </div>`;

  document.body.appendChild(menu);

  const rect = e.currentTarget.getBoundingClientRect();
  let top  = rect.top;
  let left = rect.right + 8;
  if (left + 180 > window.innerWidth)  left = rect.left - 188;
  if (top  + 160 > window.innerHeight) top  = window.innerHeight - 170;
  menu.style.top  = top  + 'px';
  menu.style.left = left + 'px';

  menu.addEventListener('click', ev => {
    const action = ev.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    _closeCtxMenu();

    if (action === 'delete') {
      window.showConfirmModal?.({
        title: 'Delete this chat?',
        desc: `"${item.label.replace(/…$/, '')}" will be permanently removed.`,
        confirmLabel: 'Delete chat',
        onConfirm: () => {
          _deleteRecent(item.id, { stopPropagation: () => {} });
          window.wsShowToast?.('🗑️', 'Chat deleted', '');
        },
      });
    } else if (action === 'rename') {
      const newName = prompt('Rename chat:', item.label.replace(/…$/, ''));
      if (newName?.trim()) {
        item.label = newName.trim().slice(0, 40);
        _saveRecent();
        _renderAllRecent();
      }
    } else if (action === 'pin') {
      item.pinned = !item.pinned;
      _recentItems.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
      _saveRecent();
      _renderAllRecent();
    }
  });

  setTimeout(() => document.addEventListener('click', _closeCtxMenu, { once: true }), 0);
}

function _buildRecentItem(item) {
  const el = document.createElement('div');
  el.className = 'recent-item' + (item.id === _activeRecentId ? ' active' : '');
  el.dataset.id = item.id;
  el.title = item.question;
  el.innerHTML = `
    ${CHAT_SVG}
    <span>${(item.pinned ? '📌 ' : '') + item.label.replace(/</g, '&lt;')}</span>
    <span class="recent-menu-btn" title="More options">···</span>`;
  el.addEventListener('click', () => _clickRecent(item));
  el.querySelector('.recent-menu-btn').addEventListener('click', ev => {
    ev.stopPropagation();
    _showRecentCtxMenu(item, ev);
  });
  return el;
}

export function _renderAllRecent() {
  const generalItems   = _recentItems.filter(r => r.source === 'general' || !r.bookId);
  const workspaceItems = _recentItems.filter(r => r.source === 'workspace' && r.bookId);

  ['recent-list-general', 'recent-list-general-ws', 'recent-list-general-flash',
   'recent-list-general-research', 'recent-list-general-exam', 'recent-list-general-studyplan']
    .forEach(id => {
      const container = document.getElementById(id);
      if (!container) return;
      container.innerHTML = '';
      if (!generalItems.length) {
        container.innerHTML = '<div class="recent-empty">No chats yet</div>';
        return;
      }
      generalItems.forEach(item => container.appendChild(_buildRecentItem(item)));
    });

  ['recent-list-home', 'recent-list-workspace', 'recent-list-flash',
   'recent-list-ws-research', 'recent-list-ws-exam', 'recent-list-ws-studyplan']
    .forEach(id => {
      const container = document.getElementById(id);
      if (!container) return;
      container.innerHTML = '';
      if (!workspaceItems.length) {
        container.innerHTML = '<div class="recent-empty">No recent chats yet</div>';
        return;
      }
      workspaceItems.forEach(item => container.appendChild(_buildRecentItem(item)));
    });
}

// Alias — some call sites use _renderRecentList
export function _renderRecentList() { _renderAllRecent(); }

// ── Home chat state / mode ─────────────────────────────────────────────────

export function homeSetMode(mode) {
  homeMode = mode;
  document.getElementById('book-chip')?.classList.toggle('active', mode === 'book');
  document.getElementById('general-chip')?.classList.toggle('active', mode === 'general');
}

export function homeSetInput(text) {
  const bar        = document.getElementById('home-input-bar');
  const chatActive = bar && bar.style.display !== 'none';
  const inp        = document.getElementById(chatActive ? 'home-ask-input-bottom' : 'home-ask-input');
  if (!inp) return;
  inp.value = text;
  inp.focus();
  homeAutoResize(inp);
}

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

export function homeAutoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  const box = el.closest('.ask-box');
  if (box) box.classList.toggle('is-multiline', el.scrollHeight > 30);
}

// ── Chat rendering ─────────────────────────────────────────────────────────

export function homeAppendUser(text) {
  const el = document.createElement('div');
  el.className = 'hc-user';
  el.textContent = text;
  document.getElementById('home-chat-history')?.appendChild(el);
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
  document.getElementById('home-chat-history')?.appendChild(wrap);
  homeScrollBottom();

  const labels = ['Thinking…', 'Searching book…', 'Reading context…', 'Composing answer…'];
  let li = 0;
  wrap._labelTimer = setInterval(() => {
    const el = document.getElementById('home-thinking-label');
    if (el) { li = (li + 1) % labels.length; el.textContent = labels[li]; }
  }, 1800);
}

function homeRemoveThinking() {
  const el = document.getElementById('hc-thinking');
  if (el) { clearInterval(el._labelTimer); el.remove(); }
}

export function homeAppendAI(text, sources) {
  const wrap = document.createElement('div');
  wrap.className = 'hc-ai';
  let sourceBadge = '';
  if (sources?.length) {
    sourceBadge = `<div class="hc-source-badge">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
      📖 Page ${sources[0].page}
    </div>`;
  }
  const md = window.homeMarkdown?.(text) ?? text;
  wrap.innerHTML = `
    <div class="hc-ai-avatar">✦</div>
    <div class="hc-ai-body">${md}${sourceBadge}</div>`;
  document.getElementById('home-chat-history')?.appendChild(wrap);
  homeScrollBottom();
}

export function homeAppendError(msg) {
  const el = document.createElement('div');
  el.className = 'hc-error';
  el.textContent = '⚠ ' + msg;
  document.getElementById('home-chat-history')?.appendChild(el);
  homeScrollBottom();
}

export function homeScrollBottom() {
  const area = document.getElementById('home-scroll-area');
  if (area) area.scrollTop = area.scrollHeight;
}

export function homeHideLanding() {
  const landing    = document.getElementById('home-landing');
  const hero       = document.querySelector('.home-hero');
  const bar        = document.getElementById('home-input-bar');
  const scrollArea = document.getElementById('home-scroll-area');
  if (landing)    landing.style.display = 'none';
  if (hero)       hero.style.display = 'none';
  if (bar)        bar.style.display = 'flex';
  if (scrollArea) scrollArea.style.justifyContent = 'flex-start';
  setTimeout(() => document.getElementById('home-ask-input-bottom')?.focus(), 50);
}

// ── Main send ──────────────────────────────────────────────────────────────

export async function homeSendMessage() {
  if (homeIsTyping) return;
  const bar        = document.getElementById('home-input-bar');
  const chatActive = bar && bar.style.display !== 'none';
  const inp        = document.getElementById(chatActive ? 'home-ask-input-bottom' : 'home-ask-input');
  const sendBtn    = document.getElementById(chatActive ? 'home-send-btn-bottom' : 'home-send-btn');

  const question = inp?.value?.trim();
  if (!question) return;

  if (!_homeSessionId) recentAdd(question, null, 'general');

  homeHideLanding();
  homeAppendUser(question);
  if (inp) { inp.value = ''; inp.style.height = '24px'; }
  setTimeout(() => document.getElementById('home-ask-input-bottom')?.focus(), 60);

  homeHistory.push({ role: 'user', content: question });
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
      if (_homeSessionId) {
        window._saveSession?.(_homeSessionId, homeHistory);
        localStorage.setItem('chunks_active_home_session', _homeSessionId);
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

// ── Attachment menu (home) ─────────────────────────────────────────────────

function _closeAllAttachMenus() {
  document.querySelectorAll('.attach-menu').forEach(m => m.classList.remove('open'));
}

export function homeToggleAttachMenu(e, slot) {
  e.stopPropagation();
  const id   = slot === 'bottom' ? 'home-attach-menu-bottom' : 'home-attach-menu';
  const menu = document.getElementById(id);
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  _closeAllAttachMenus();
  if (!isOpen) menu.classList.add('open');
}

export function homeAttachTrigger(type, slot) {
  _closeAllAttachMenus();
  const id = type === 'image'
    ? `home-attach-image${slot === 'bottom' ? '-bottom' : ''}`
    : `home-attach-pdf${slot === 'bottom' ? '-bottom' : '-new'}`;
  document.getElementById(id)?.click();
}

export async function homeHandleAttach(input, type, slot) {
  const file = input.files[0]; if (!file) return;
  input.value = '';
  const dataUrl = await _readFile(file);
  const att = { type, file, dataUrl, name: file.name };
  window._homeAttachments?.push(att);
  _homeRenderPreview();
  if (type === 'pdf') {
    const name = file.name.replace(/\.pdf$/i, '');
    window._uploadedPdfFile = file;
    window._uploadedPdfName = name;
    homeSetInput(`Summarize "${name}" for me`);
  }
}

function _homeRenderPreview() {
  ['home-attach-preview', 'home-attach-preview-bottom'].forEach(id => {
    const strip = document.getElementById(id); if (!strip) return;
    strip.innerHTML = '';
    const atts = window._homeAttachments ?? [];
    strip.style.display = atts.length ? 'flex' : 'none';
    atts.forEach((att, i) => {
      strip.appendChild(_buildThumb(att, () => {
        atts.splice(i, 1);
        _homeRenderPreview();
      }));
    });
  });
}

// ── Session restore on refresh ─────────────────────────────────────────────

function _restoreSessionOnRefresh() {
  if (sessionStorage.getItem('chunks_is_refresh') !== '1') return;

  const activeScreen   = sessionStorage.getItem('chunks_active_screen');
  const activeRecentId = localStorage.getItem('chunks_active_recent_id');

  if (activeScreen === 'workspace' ||
      (!activeScreen && localStorage.getItem('chunks_active_ws_book'))) {
    // Restore workspace chat
    const bookId = localStorage.getItem('chunks_active_ws_book');
    if (bookId) {
      const wsSession = loadWsSession(bookId);
      window.selectBook?.(bookId).then(() => {
        if (wsSession?.html) {
          setTimeout(() => {
            const msgs = document.getElementById('ws-messages');
            if (msgs) msgs.innerHTML = window.sanitize?.(wsSession.html) ?? wsSession.html;
            if (window._wsChatHistory !== undefined) window._wsChatHistory = wsSession.history || [];
            if (activeRecentId) _setActiveRecent(activeRecentId);
            setTimeout(() => {
              const m = document.getElementById('ws-messages');
              if (m) m.scrollTop = m.scrollHeight;
            }, 80);
          }, 600);
        }
      });
    }
  } else {
    // Restore home chat
    const savedId = localStorage.getItem('chunks_active_home_session');
    if (savedId && (!activeScreen || activeScreen === 'home')) {
      const session = loadHomeSession(savedId);
      if (session?.html) {
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
        _setActiveRecent(savedId);
        setTimeout(() => homeScrollBottom(), 80);
      }
    }
  }
}

// ── DOM-ready wiring ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Render the recent list immediately
  _renderAllRecent();

  // Restore session if this is a page refresh
  _restoreSessionOnRefresh();

  // Bottom chat input — Enter to send + auto-resize
  const bottomInput = document.getElementById('home-ask-input-bottom');
  if (bottomInput) {
    bottomInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); homeSendMessage(); }
    });
    bottomInput.addEventListener('input', function () { homeAutoResize(this); });
  }

  // Top landing input — Enter to send + auto-resize
  const topInput = document.getElementById('home-ask-input');
  if (topInput) {
    topInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); homeSendMessage(); }
    });
    topInput.addEventListener('input', function () { homeAutoResize(this); });
  }

  // Hook ws-chat-send to capture question for recents (capture phase)
  document.getElementById('ws-chat-send')?.addEventListener('click', () => {
    const q = document.getElementById('ws-chat-input')?.value?.trim();
    if (q) recentAdd(q, window._wsBookId, 'workspace');
  }, true);

  document.getElementById('ws-chat-input')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      const q = this.value.trim();
      if (q) recentAdd(q, window._wsBookId);
    }
  }, true);

  // Close attach menus when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.chat-plus-wrap') && !e.target.closest('.ask-plus-wrap')) {
      _closeAllAttachMenus();
    }
  });
});

// ── Window globals ─────────────────────────────────────────────────────────

// Expose mutable state refs so other modules (SettingsModal, etc.) can read/write them
Object.defineProperties(window, {
  _recentItems:   { get: () => _recentItems,   set: v => { _recentItems = v; },   configurable: true },
  _activeRecentId:{ get: () => _activeRecentId, set: v => { _activeRecentId = v; }, configurable: true },
  homeHistory:    { get: () => homeHistory,     set: v => { homeHistory = v; },     configurable: true },
  _homeSessionId: { get: () => _homeSessionId,  set: v => { _homeSessionId = v; },  configurable: true },
  homeIsTyping:   { get: () => homeIsTyping,    set: v => { homeIsTyping = v; },    configurable: true },
  homeMode:       { get: () => homeMode,        set: v => { homeMode = v; },        configurable: true },
});

window.goHome               = goHome;
window.newChat              = newChat;
window.recentAdd            = recentAdd;
window._setActiveRecent     = _setActiveRecent;  // needed by cross-module callers
window._deleteRecent        = _deleteRecent;     // needed by cross-module callers
window._renderAllRecent     = _renderAllRecent;
window._renderRecentList    = _renderRecentList;
window.homeSetMode          = homeSetMode;
window.homeSetInput         = homeSetInput;
window.homeHandlePdfUpload  = homeHandlePdfUpload;
window.homeAutoResize       = homeAutoResize;
window.homeScrollBottom     = homeScrollBottom;
window.homeHideLanding      = homeHideLanding;
window.homeSendMessage      = homeSendMessage;
window.homeToggleAttachMenu = homeToggleAttachMenu;
window.homeAttachTrigger    = homeAttachTrigger;
window.homeHandleAttach     = homeHandleAttach;
window.homeAppendUser       = homeAppendUser;
window.homeAppendAI         = homeAppendAI;
window.homeAppendError      = homeAppendError;
