
// @ts-nocheck
/**
 * src/screens/HomeScreen.js — Dashboard + Inline General AI Chat
 *
 * Owns:
 *   • #screen-home HTML injection (replaces data-home-screen placeholder)
 *   • Personalized greeting (date + time-of-day phrase)
 *   • Dashboard: stats row, recent activities, quick actions, what's new, feedback
 *   • #home-chat-panel — inline chat panel (workspace-style, no navigation)
 *
 * Exports: homeRestoreLanding, _homeMountLatestSession, homeStartNew
 * No-op stubs: window._homeMountSession, window._homeMarkNavTime
 */

import { lsGet } from '../utils/storage.js';
import { ws } from '../state/workspace/state.js';
import { API_BASE, _getAuthHeader } from '../lib/api.js';
import { typewriteResponse, extractThinkBlock } from '../utils/typewriter.js';
import { homeMarkdown, sanitize } from '../utils/render.js';
import { guestGate, isGuest, showLoginWall } from '../lib/guestLimits.js';

// ── What\'s New feed ───────────────────────────────────────────────────────────
// Update this array to change the What\'s New panel. badge: \'new\' | \'tip\' | \'fix\'
export const _HOME_NEWS = [
  { badge: 'new',  text: 'Smart Notes panel added to workspace',          date: '2 days ago' },
  { badge: 'tip',  text: 'Use Deep Think mode for complex problems',       date: '5 days ago' },
  { badge: 'new',  text: 'Study plans now track per-concept mastery',      date: '1 week ago' },
  { badge: 'fix',  text: 'Flashcard sync across devices improved',         date: '2 weeks ago' },
  { badge: 'tip',  text: 'Upload a PDF from the home screen to start studying', date: '3 weeks ago' },
];

// ── HTML template ─────────────────────────────────────────────────────────────

const HOME_HTML = /* html */`
<div class="screen active" id="screen-home">

  <aside class="sidebar" data-sidebar-screen="home"></aside>

  <main class="home-main">

    <!-- Mobile topbar: logo + avatar (hidden on desktop via CSS) -->
    <div class="mobile-home-topbar" style="display:none;">
      <div class="mht-logo-row">
        <svg width="26" height="26" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="display:block;flex-shrink:0;overflow:hidden;">
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/>
          <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
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

      <!-- Chat-first landing — shown when chat history is empty -->
      <div id="home-landing">

        <!-- Welcome heading -->
        <div class="home-welcome-heading">
          <div class="home-welcome-icon">
            <svg width="32" height="32" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/>
              <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/>
              <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/>
              <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
            </svg>
          </div>
          <h2 class="home-welcome-title">Welcome, <span id="home-greeting-name">there</span></h2>
        </div>

        <!-- Document context bar -->
        <div id="home-doc-bar">
          <span id="home-doc-label" class="home-doc-label">No document loaded</span>
          <a id="home-add-doc-btn" class="home-add-doc-btn" onclick="openLibraryModal()">+ Add textbook</a>
        </div>

        <!-- Chat input -->
        <div class="chat-input-card" id="home-chat-card">

          <!-- Textarea row -->
          <div class="chat-textarea-row">
            <textarea id="home-chat-input" class="chat-input-field" placeholder="Ask me anything…" rows="1" style="resize:none;max-height:120px;overflow-y:auto;font-family:var(--font-body);font-size:13px;color:var(--text-1);background:transparent;border:none;outline:none;flex:1;line-height:1.5;"></textarea>
            <button class="chat-send" id="home-chat-send"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
          </div>

          <!-- Footer row -->
          <div class="chat-input-footer">
            <div class="chat-footer-left">
              <!-- Attach button -->
              <div class="chat-plus-wrap">
                <button class="chat-footer-btn" id="home-plus-btn" onclick="homeToggleAttachMenu(event)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  Attach
                </button>
                <div class="attach-menu home-rich-menu" id="home-attach-menu">
                  <div class="attach-menu-section-label">Attach</div>
                  <div class="attach-menu-item" onclick="homeAttachTrigger('image')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <span>Image</span>
                  </div>
                  <div class="attach-menu-item" onclick="homeAttachTrigger('pdf')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>PDF</span>
                  </div>
                  <div class="attach-menu-item" onclick="homePromptYouTube()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>
                    <span>YouTube</span>
                  </div>
                  <div class="attach-menu-divider"></div>
                  <div class="attach-menu-section-label">AI Mode</div>
                  <div class="attach-menu-item attach-menu-toggle" id="home-toggle-websearch" onclick="homeToggleWebSearch()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    <span>Web Search</span>
                    <div class="attach-menu-check" id="home-websearch-check"></div>
                  </div>
                </div>
              </div>
              <!-- Voice button -->
              <button class="chat-footer-btn mic-btn" id="home-mic-btn" title="Voice input" aria-label="Voice input" onclick="homeToggleVoiceInput()">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
                Voice
              </button>
            </div>
            <div class="chat-footer-right">
              <!-- Think dropdown -->
              <div class="chat-think-wrap" id="home-think-wrap">
                <button class="chat-footer-btn chat-think-btn" id="home-toggle-think" onclick="homeToggleThinkMenu(event)" title="Thinking mode">
                  <span class="chat-think-dot"></span>
                  <span id="home-think-label">Think</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="think-menu" id="home-think-menu">
                  <div class="think-menu-item" id="home-think-opt-think" onclick="homeToggleThinking('think')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg>
                    <span>Think</span>
                    <div class="attach-menu-check" id="home-think-check"></div>
                  </div>
                  <div class="think-menu-item" id="home-think-opt-deep" onclick="homeToggleThinking('deep')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    <span>Deep Think</span>
                    <div class="attach-menu-check" id="home-deep-check"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Category chips (below the input) -->
        <div class="home-chips">
          <button class="home-chip" onclick="homeChipSend('Help me write')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Write
          </button>
          <button class="home-chip" onclick="homeChipSend('Explain')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Explain
          </button>
          <button class="home-chip" onclick="homeChipSend('Create a study plan for')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Study Plan
          </button>
          <button class="home-chip" onclick="homeChipSend('Quiz me on')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Quiz Me
          </button>
          <button class="home-chip" onclick="homeChipSend('Summarize')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="11" y2="18"/></svg>
            Summarize
          </button>
        </div>

      </div><!-- end home-landing -->

    </div><!-- end home-scroll-area -->

    <!-- ── Inline chat panel (workspace-style, hidden until first message) ── -->
    <section class="home-chat-panel" id="home-chat-panel">

      <!-- Messages -->
      <div class="messages" id="home-messages"></div>

      <!-- Chat input (same structure as workspace) -->
      <div class="chat-input-wrap" id="home-chat-input-wrap">
        <div class="chat-input-card" id="home-chat-card-bottom">

          <!-- Textarea row -->
          <div class="chat-textarea-row">
            <textarea id="home-ask-input-bottom" class="chat-input-field" placeholder="Ask me anything…" rows="1" style="resize:none;max-height:120px;overflow-y:auto;font-family:var(--font-body);font-size:13px;color:var(--text-1);background:transparent;border:none;outline:none;flex:1;line-height:1.5;"></textarea>
            <button class="chat-send" id="home-ask-send-bottom"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
          </div>

          <!-- Footer row -->
          <div class="chat-input-footer">
            <div class="chat-footer-left">
              <!-- Attach button -->
              <div class="chat-plus-wrap">
                <button class="chat-footer-btn" id="home-plus-btn-bottom" onclick="homeToggleAttachMenuBottom(event)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  Attach
                </button>
                <div class="attach-menu home-rich-menu" id="home-attach-menu-bottom">
                  <div class="attach-menu-section-label">Attach</div>
                  <div class="attach-menu-item" onclick="homeAttachTrigger('image');homeCloseBottomMenus()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <span>Image</span>
                  </div>
                  <div class="attach-menu-item" onclick="homeAttachTrigger('pdf');homeCloseBottomMenus()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>PDF</span>
                  </div>
                  <div class="attach-menu-item" onclick="homePromptYouTube();homeCloseBottomMenus()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>
                    <span>YouTube</span>
                  </div>
                  <div class="attach-menu-divider"></div>
                  <div class="attach-menu-section-label">AI Mode</div>
                  <div class="attach-menu-item attach-menu-toggle" id="home-toggle-websearch-bottom" onclick="homeToggleWebSearchBottom()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    <span>Web Search</span>
                    <div class="attach-menu-check" id="home-websearch-check-bottom"></div>
                  </div>
                </div>
              </div>
              <!-- Voice button -->
              <button class="chat-footer-btn mic-btn" id="home-mic-btn-bottom" title="Voice input" aria-label="Voice input" onclick="homeToggleVoiceInput()">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
                Voice
              </button>
            </div>
            <div class="chat-footer-right">
              <!-- Think dropdown -->
              <div class="chat-think-wrap" id="home-think-wrap-bottom">
                <button class="chat-footer-btn chat-think-btn" id="home-toggle-think-bottom" onclick="homeToggleThinkMenuBottom(event)" title="Thinking mode">
                  <span class="chat-think-dot"></span>
                  <span id="home-think-label-bottom">Think</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="think-menu" id="home-think-menu-bottom">
                  <div class="think-menu-item" id="home-think-opt-think-bottom" onclick="homeToggleThinkingBottom('think')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg>
                    <span>Think</span>
                    <div class="attach-menu-check" id="home-think-check-bottom"></div>
                  </div>
                  <div class="think-menu-item" id="home-think-opt-deep-bottom" onclick="homeToggleThinkingBottom('deep')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    <span>Deep Think</span>
                    <div class="attach-menu-check" id="home-deep-check-bottom"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </section><!-- end home-chat-panel -->

  </main>
</div>
`;

// ── Greeting helpers ──────────────────────────────────────────────────────────

const _DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const _MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function _greetingPhrase() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function _greetingDate() {
  const now = new Date();
  return `${_DAYS[now.getDay()]}, ${_MONTHS[now.getMonth()]} ${now.getDate()}`;
}

function _updateGreeting() {
  const dateEl = document.getElementById('home-greeting-date');
  const h1El   = document.querySelector('.home-greeting-h1');
  if (dateEl) dateEl.textContent = _greetingDate();
  if (h1El) {
    const firstText = h1El.firstChild;
    if (firstText && firstText.nodeType === Node.TEXT_NODE) {
      firstText.textContent = `${_greetingPhrase()}, `;
    }
  }
  const user   = window._currentUser;
  const nameEl = document.getElementById('home-greeting-name');
  if (nameEl && user) {
    const firstName = (user.name || user.email || '').split(/\s+|@/)[0];
    if (firstName) nameEl.textContent = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  }
}

// ── Compat stubs ────────────────────────────────────────────────────────────

/** Refresh dashboard when navigating back to home. */
export function homeRestoreLanding() {
  _renderHomeActivities();
}

/** No-op — home sessions are not restored into a separate chat view. */
export function _homeMountLatestSession() {}

// Expose _mountSession as a no-op for sidebar recent-item clicks.
window._homeMountSession = function() {};

window._homeMarkNavTime = function() {};

function _hdRenderWhatsNew() {
  const el = document.getElementById('hd-whats-new');
  if (!el) return;
  const BADGE_COLOR = { new: 'var(--violet)', tip: 'var(--gold)', fix: 'var(--teal)' };
  const items = _HOME_NEWS.map(item => {
    const color = BADGE_COLOR[item.badge] || 'var(--text-4)';
    return `<div class="hd-news-item">
      <span class="hd-news-badge" style="color:${color};background:color-mix(in srgb,${color} 14%,transparent);">${item.badge.charAt(0).toUpperCase() + item.badge.slice(1)}</span>
      <span class="hd-news-text">${item.text}</span>
      <span class="hd-news-date">${item.date}</span>
    </div>`;
  }).join('');
  el.innerHTML = `
    <p class="hd-section-label">WHAT\'S NEW</p>
    <div class="hd-news-list">${items}</div>`;
}

function _hdSaveFeedback(rating, tagsSet) {
  try {
    const existing = JSON.parse(localStorage.getItem('chunks_home_feedback_v1') || '[]');
    existing.push({ rating, tags: Array.from(tagsSet), date: new Date().toISOString() });
    if (existing.length > 30) existing.splice(0, existing.length - 30);
    localStorage.setItem('chunks_home_feedback_v1', JSON.stringify(existing));
  } catch (_) {}
  const confirm = document.getElementById('hd-feedback-confirm');
  if (confirm) confirm.style.display = 'block';
}

const _HD_FEEDBACK_TAGS = [
  'Easy to use', 'Helpful AI', 'Too slow',
  'Missing features', 'Love it', 'Needs more content',
];

function _hdRenderFeedback() {
  const el = document.getElementById('hd-feedback');
  if (!el) return;

  // Load previous feedback to pre-populate widget
  let prevRating = 0;
  const prevTags = new Set();
  let alreadyRatedToday = false;
  try {
    const prev = JSON.parse(localStorage.getItem('chunks_home_feedback_v1') || '[]');
    if (prev.length > 0) {
      const last = prev[prev.length - 1];
      prevRating = last.rating || 0;
      (last.tags || []).forEach(t => prevTags.add(t));
      const daysSince = (Date.now() - new Date(last.date).getTime()) / 86400000;
      alreadyRatedToday = daysSince < 1;
    }
  } catch (_) {}

  const confirmStyle = alreadyRatedToday ? 'display:block;' : 'display:none;';

  el.innerHTML = `
    <p class="hd-section-label">HOW\'S YOUR STUDY SESSION GOING?</p>
    <p class="hd-feedback-q">Rate today\'s experience</p>
    <div class="hd-stars" id="hd-stars-row">
      ${[1,2,3,4,5].map(n => `<button class="hd-star${n <= prevRating ? ' active' : ''}" data-star="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}
    </div>
    <div class="hd-tag-chips" id="hd-tag-chips">
      ${_HD_FEEDBACK_TAGS.map(t => `<button class="hd-tag-chip${prevTags.has(t) ? ' active' : ''}" data-tag="${t}">${t}</button>`).join('')}
    </div>
    <div class="hd-feedback-confirm" id="hd-feedback-confirm" style="${confirmStyle}">Thanks! 🎉</div>`;

  let selectedRating = prevRating;
  const selectedTags = new Set(prevTags);

  el.querySelectorAll('.hd-star').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRating = parseInt(btn.dataset.star, 10);
      el.querySelectorAll('.hd-star').forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.star, 10) <= selectedRating);
      });
      _hdSaveFeedback(selectedRating, selectedTags);
    });
    btn.addEventListener('mouseenter', () => {
      const n = parseInt(btn.dataset.star, 10);
      el.querySelectorAll('.hd-star').forEach(s => {
        s.classList.toggle('hover', parseInt(s.dataset.star, 10) <= n);
      });
    });
  });
  el.querySelector('.hd-stars')?.addEventListener('mouseleave', () => {
    el.querySelectorAll('.hd-star').forEach(s => s.classList.remove('hover'));
  });

  el.querySelectorAll('.hd-tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      if (selectedTags.has(tag)) { selectedTags.delete(tag); chip.classList.remove('active'); }
      else                       { selectedTags.add(tag);    chip.classList.add('active');    }
      if (selectedRating > 0) _hdSaveFeedback(selectedRating, selectedTags);
    });
  });
}

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mountHomeScreen() {
  const placeholder = document.querySelector('[data-home-screen]');
  if (!placeholder) {
    console.warn('[HomeScreen] placeholder [data-home-screen] not found');
    return;
  }
  placeholder.outerHTML = HOME_HTML;
  _updateGreeting();
  _renderHomeActivities();
  _hdRenderWhatsNew();
  _hdRenderFeedback();

  // ── Wire landing chat input ───────────────────────────────────────────────
  const _chatSend  = document.getElementById('home-chat-send');
  const _chatInput = document.getElementById('home-chat-input');
  if (_chatSend)  _chatSend.addEventListener('click', homeDoSend);
  if (_chatInput) {
    _chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); homeDoSend(); }
    });
    _chatInput.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  }

  // ── Wire chat-panel bottom input ─────────────────────────────────────────
  const _bottomSend  = document.getElementById('home-ask-send-bottom');
  const _bottomInput = document.getElementById('home-ask-input-bottom');
  if (_bottomSend)  _bottomSend.addEventListener('click', homeDoSendBottom);
  if (_bottomInput) {
    _bottomInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); homeDoSendBottom(); }
    });
    _bottomInput.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  }

  // ── Close menus on outside click ─────────────────────────────────────────
  document.addEventListener('click', e => {
    const menus = ['home-attach-menu', 'home-think-menu', 'home-attach-menu-bottom', 'home-think-menu-bottom'];
    const inMenu = menus.some(id => document.getElementById(id)?.contains(e.target));
    const inBtn  = ['home-plus-btn', 'home-toggle-think', 'home-plus-btn-bottom', 'home-toggle-think-bottom']
      .some(id => document.getElementById(id)?.contains(e.target));
    if (!inMenu && !inBtn) {
      menus.forEach(id => document.getElementById(id)?.classList.remove('open'));
    }
  });
}

// ── Recent Activities ─────────────────────────────────────────────────────────

export function _renderHomeActivities() {
  const container = document.getElementById('home-activities-section');
  if (!container) return;

  const _esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // ── 1. Last read book ───────────────────────────────────────────────────────
  let lastBook = null;
  try {
    const bpAll   = JSON.parse(localStorage.getItem('chunks_book_progress_v1') || '{}');
    const entries = Object.entries(bpAll);
    if (entries.length > 0) {
      entries.sort((a, b) => (b[1].lastOpened || '') > (a[1].lastOpened || '') ? 1 : -1);
      const [bookId, prog] = entries[0];
      const meta = (window.wsBookMeta || {})[bookId];
      if (prog.lastPage) {
        const pct = prog.totalPages ? Math.min(100, Math.round((prog.lastPage / prog.totalPages) * 100)) : 0;
        lastBook = { bookId, title: meta?.name || bookId, lastPage: prog.lastPage, totalPages: prog.totalPages || 0, pct, lastOpened: prog.lastOpened || null };
      }
    }
  } catch (_) {}

  // ── 2. Most recent study plan ───────────────────────────────────────────────
  let lastPlan = null;
  try {
    const allPlans = lsGet('sp_all_plans') || {};
    const entries  = Object.entries(allPlans);
    if (entries.length > 0) {
      entries.sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0));
      const [planId, plan] = entries[0];
      const topic = plan.topic || plan.plan?.title || '';
      if (topic) {
        const n = plan.plan?.concepts?.length || 0;
        const mastery = plan.mastery || {};
        const MASTERY_WEIGHTS = { explain: 10, flash: 20, pq: 35, exam: 35 };
        const scores = Array.from({ length: n }, (_, i) => {
          const m = mastery[i] || {};
          return Math.min(100, Math.round(
            ((m.explain || 0) / 100) * MASTERY_WEIGHTS.explain +
            ((m.flash   || 0) / 100) * MASTERY_WEIGHTS.flash   +
            ((m.pq      || 0) / 100) * MASTERY_WEIGHTS.pq      +
            ((m.exam    || 0) / 100) * MASTERY_WEIGHTS.exam
          ));
        });
        const barPct = n > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / n) : 0;
        lastPlan = { planId, topic, barPct };
      }
    }
  } catch (_) {}

  // ── 3. Most recently studied or created flashcard deck ─────────────────────
  let lastDeck = null;
  try {
    const decks        = lsGet('chunks_fc_decks_v1')   || [];
    const masteryStore = lsGet('chunks_fc_mastery_v1') || {};
    const deckEntries  = Object.entries(masteryStore);
    if (deckEntries.length > 0) {
      deckEntries.sort((a, b) => (b[1].lastStudied || '').localeCompare(a[1].lastStudied || ''));
      const [deckId, stats] = deckEntries[0];
      const deck = decks.find(d => d.id === deckId);
      if (deck) lastDeck = { deckId, name: deck.name, pct: stats.pct || 0, cardCount: deck.card_count || 0 };
    }
    if (!lastDeck && decks.length > 0) {
      const sorted = decks.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      const d = sorted[0];
      if (d?.name) lastDeck = { deckId: d.id, name: d.name, pct: 0, cardCount: d.card_count || 0 };
    }
  } catch (_) {}

  // ── No activity at all → show new-user empty state ─────────────────────────
  if (!lastBook && !lastPlan && !lastDeck) {
    container.innerHTML = `
      <p class="prompts-label">Recent activity</p>
      <div class="ra-grid">
        <div class="ra-new-card ra-start-new" onclick="homeStartNew()">
          <div class="ra-card-banner ra-start-new-banner">
            <div class="ra-start-new-icon">✦</div>
          </div>
          <div class="ra-body">
            <span class="ra-new-type">Get Started</span>
            <div class="ra-new-title">Start something new</div>
            <div class="ra-new-sub">Upload a book, create a deck,<br>or start a study plan</div>
            <button class="ra-new-btn">Explore →</button>
          </div>
        </div>
      </div>`;
    return;
  }

  // ── Build rich activity cards ───────────────────────────────────────────────
  let richCards = '';

  const _iconBook  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
  const _iconPlan  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
  const _iconFlash = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;

  if (lastBook) {
    richCards += `
      <div class="ra-new-card book" data-ra-action="book" data-ra-id="${_esc(lastBook.bookId)}">
        <div class="ra-card-banner book">
          <div class="ra-icon book">${_iconBook}</div>
          <div class="ra-card-banner-label">Textbook</div>
        </div>
        <div class="ra-body">
          <span class="ra-new-type">Textbook</span>
          <div class="ra-new-title">${_esc(lastBook.title)}</div>
          <div class="ra-new-sub">Page ${lastBook.lastPage}${lastBook.totalPages ? ` of ${lastBook.totalPages}` : ''}</div>
          <button class="ra-new-btn">Continue →</button>
        </div>
      </div>`;
  }

  if (lastPlan) {
    richCards += `
      <div class="ra-new-card plan" data-ra-action="plan" data-ra-id="${_esc(lastPlan.planId)}">
        <div class="ra-card-banner plan">
          <div class="ra-icon plan">${_iconPlan}</div>
          <div class="ra-card-banner-label">Study Plan</div>
        </div>
        <div class="ra-body">
          <span class="ra-new-type">Study Plan</span>
          <div class="ra-new-title">${_esc(lastPlan.topic)}</div>
          <div class="ra-new-sub">Mastery: ${lastPlan.barPct}%</div>
          <button class="ra-new-btn">Resume →</button>
        </div>
      </div>`;
  }

  if (lastDeck) {
    const deckSub = lastDeck.cardCount
      ? `${lastDeck.cardCount} cards · ${lastDeck.pct}% mastered`
      : 'Flashcards';
    richCards += `
      <div class="ra-new-card flash" data-ra-action="flash" data-ra-id="${_esc(lastDeck.deckId)}">
        <div class="ra-card-banner flash">
          <div class="ra-icon flash">${_iconFlash}</div>
          <div class="ra-card-banner-label">Flashcards</div>
        </div>
        <div class="ra-body">
          <span class="ra-new-type">Flashcards</span>
          <div class="ra-new-title">${_esc(lastDeck.name)}</div>
          <div class="ra-new-sub">${_esc(deckSub)}</div>
          <button class="ra-new-btn">Review →</button>
        </div>
      </div>`;
  }

  richCards += `
    <div class="ra-new-card ra-start-new" onclick="homeStartNew()">
      <div class="ra-card-banner ra-start-new-banner">
        <div class="ra-start-new-icon">✦</div>
      </div>
      <div class="ra-body">
        <span class="ra-new-type">Get Started</span>
        <div class="ra-new-title">Start something new</div>
        <div class="ra-new-sub">Upload a book, create a deck,<br>or start a plan</div>
        <button class="ra-new-btn">Explore →</button>
      </div>
    </div>`;

  container.innerHTML = `
    <p class="prompts-label">Continue where you left off</p>
    <div class="ra-grid">${richCards}</div>`;

  // Wire click handlers for rich cards
  container.querySelectorAll('.ra-new-card').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.raAction;
      const id     = el.dataset.raId;
      if (action === 'book') {
        if (typeof window.selectBook === 'function') window.selectBook(id);
      } else if (action === 'plan') {
        if (typeof window.showScreen === 'function') window.showScreen('studyplan');
        setTimeout(() => { if (typeof window.spSwitchToPlan === 'function') window.spSwitchToPlan(id); }, 100);
      } else if (action === 'flash') {
        if (typeof window.showScreen === 'function') window.showScreen('flash');
      }
    });
  });

  if (lastBook) _injectPdfThumb(lastBook.bookId).catch(() => {});
}

// ── Time-ago helper ───────────────────────────────────────────────────────────
function _timeAgo(isoString) {
  if (!isoString) return '';
  const diff  = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 2)   return 'Just now';
  if (mins  < 60)  return `${mins} min ago`;
  if (hours < 24)  return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days  === 1) return '1 day ago';
  if (days  < 7)   return `${days} days ago`;
  if (days  < 30)  return `${Math.floor(days / 7)} week${days >= 14 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

// ── PDF first-page thumbnail generator ───────────────────────────────────────
async function _injectPdfThumb(bookId) {
  const wrap = document.getElementById(`ra-thumb-${bookId}`);
  if (!wrap) return;

  const SESS_KEY   = `ra_pdf_thumb_v1_${bookId}`;
  const API_BASE   = window.API_BASE || 'https://api.chunks.online';
  const CACHE_NAME = 'chunks-pdf-v1';
  const pdfUrl     = `${API_BASE}/pdf/${bookId}`;

  const cached = sessionStorage.getItem(SESS_KEY);
  if (cached) { _applyThumb(wrap, cached); return; }

  let pdfData = null;
  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(pdfUrl);
      if (match) pdfData = await match.arrayBuffer();
    }
  } catch (_) {}

  if (!pdfData) return;

  try {
    let pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      pdfjsLib = window.pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const pdf      = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const page     = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const thumbW   = 360;
    const scale    = thumbW / viewport.width;
    const vp       = page.getViewport({ scale });
    const canvas   = wrap.querySelector('.ra-pdf-canvas');
    canvas.width   = vp.width;
    canvas.height  = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    try { sessionStorage.setItem(SESS_KEY, dataUrl); } catch (_) {}
    _applyThumb(wrap, dataUrl);
  } catch (_) {}
}

function _applyThumb(wrap, dataUrl) {
  const canvas      = wrap.querySelector('.ra-pdf-canvas');
  const placeholder = wrap.querySelector('.ra-pdf-thumb-placeholder');
  const badge       = wrap.querySelector('.ra-pdf-page-badge');
  if (canvas) {
    if (dataUrl && !canvas.width) {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.className = 'ra-pdf-canvas';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      canvas.replaceWith(img);
    } else {
      canvas.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    }
  }
  if (placeholder) placeholder.style.display = 'none';
  if (badge) badge.style.opacity = '1';
}

// ── Misc exports ──────────────────────────────────────────────────────────────

export function homeStartNew() {
  window.openLibraryModal?.();
}

// ── Auto-mount ────────────────────────────────────────────────────────────────
mountHomeScreen();

// ── Guest mode banner ─────────────────────────────────────────────────────────
(function _mountGuestBanner() {
  if (sessionStorage.getItem('chunks_guest_mode') !== '1') return;
  const landing = document.getElementById('home-landing');
  if (!landing || document.getElementById('home-guest-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'home-guest-banner';
  banner.style.cssText = 'display:flex;align-items:center;gap:10px;background:color-mix(in srgb,var(--gold,#f59e0b) 10%,var(--surface-2,#1e1e2e));border:1px solid color-mix(in srgb,var(--gold,#f59e0b) 25%,transparent);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--text-2,#aaa);margin:12px auto 0;max-width:560px;width:calc(100% - 32px);';
  banner.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;opacity:.7"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg><span>You\'re in guest mode. <a href="#" onclick="sessionStorage.removeItem(\'chunks_guest_mode\');window.openAuthModal?.();return false;" style="color:var(--gold,#f59e0b);text-decoration:none;font-weight:500;">Sign in</a> to keep your history.</span>`;
  landing.appendChild(banner);
})();

// ── Home inline chat state ────────────────────────────────────────────────────

let _homeThinking      = 'off';   // also used by landing input
let _homeWebSearch     = false;   // web search toggle in chat panel
let _homeAbortCtrl     = null;    // AbortController for active home request
let _homeChatHistory   = [];      // conversation history for context window
let _homeTyping        = false;   // true while AI is generating

// Delay (ms) to allow workspace screen transition before triggering actions
const _WS_TRANSITION_DELAY = 300;

// ── Landing chip helper ───────────────────────────────────────────────────────

function homeChipSend(text) {
  const inp = document.getElementById('home-chat-input');
  if (inp) { inp.value = text; inp.focus(); }
  homeDoSend();
}

// ── Landing send → switches to inline chat panel ─────────────────────────────

function homeDoSend() {
  const inp = document.getElementById('home-chat-input');
  if (!inp) return;
  const query = inp.value.trim();
  if (!query) return;
  inp.value = '';
  inp.style.height = 'auto';
  _homeOpenChatPanel();
  _homeSubmit(query);
}

function homeDoSendBottom() {
  if (_homeTyping) { _homeStopGeneration(); return; }
  const inp = document.getElementById('home-ask-input-bottom');
  if (!inp) return;
  const query = inp.value.trim();
  if (!query) return;
  inp.value = '';
  inp.style.height = 'auto';
  _homeSubmit(query);
}

// ── Chat panel visibility ─────────────────────────────────────────────────────

function _homeOpenChatPanel() {
  const scrollArea = document.getElementById('home-scroll-area');
  const panel      = document.getElementById('home-chat-panel');
  if (scrollArea) scrollArea.style.display = 'none';
  if (panel)      panel.style.display = 'flex';
  document.getElementById('home-ask-input-bottom')?.focus();
}

function homeNewChat() {
  _homeChatHistory = [];
  _homeTyping      = false;
  if (_homeAbortCtrl) { _homeAbortCtrl.abort(); _homeAbortCtrl = null; }
  const msgs = document.getElementById('home-messages');
  if (msgs) msgs.innerHTML = '';
  _homeSetGenerating(false);
  const panel     = document.getElementById('home-chat-panel');
  const scrollArea = document.getElementById('home-scroll-area');
  if (panel)      panel.style.display = 'none';
  if (scrollArea) scrollArea.style.display = '';
  const inp = document.getElementById('home-chat-input');
  if (inp) { inp.value = ''; inp.style.height = 'auto'; inp.focus(); }
}

// ── Stop / send button state ──────────────────────────────────────────────────

const _SEND_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
const _STOP_SVG = `<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" rx="2" ry="2" fill="currentColor"/></svg>`;

function _homeSetGenerating(on) {
  const btn = document.getElementById('home-ask-send-bottom');
  if (!btn) return;
  if (on) {
    btn.innerHTML = _STOP_SVG;
    btn.classList.add('chat-send--stop');
    btn.disabled = false;
  } else {
    btn.innerHTML = _SEND_SVG;
    btn.classList.remove('chat-send--stop');
    btn.disabled = false;
  }
}

function _homeStopGeneration() {
  if (_homeAbortCtrl) { _homeAbortCtrl.abort(); _homeAbortCtrl = null; }
}

// ── Message rendering ─────────────────────────────────────────────────────────

function _homeScrollBottom() {
  const msgs = document.getElementById('home-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function _homeAppendUser(text) {
  const msgs = document.getElementById('home-messages');
  if (!msgs) return;
  const d = document.createElement('div');
  d.className = 'msg msg-user';
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  d.innerHTML = `<div class="bubble-user">${escaped}</div>`;
  msgs.appendChild(d);
  _homeScrollBottom();
}

function _homeAppendThinking() {
  const msgs = document.getElementById('home-messages');
  _homeRemoveThinking();
  const d = document.createElement('div');
  d.className = 'msg msg-ai';
  d.id = 'home-thinking-msg';
  d.innerHTML = `<div class="ai-row"><div class="ai-body"><span class="home-thinking-dots"><span></span><span></span><span></span></span></div></div>`;
  msgs.appendChild(d);
  _homeScrollBottom();
}

function _homeRemoveThinking() {
  document.getElementById('home-thinking-msg')?.remove();
}

function _homeAppendAI(answer, question) {
  const msgs = document.getElementById('home-messages');
  if (!msgs) return null;
  const msgId = 'home-msg-' + Date.now();
  const d     = document.createElement('div');
  d.className = 'msg msg-ai';
  d.id        = msgId;
  d.innerHTML = `
    <div class="ai-row">
      <div class="ai-body">
        <p class="ai-text"></p>
        <div class="msg-acts" style="display:none;margin-top:8px;">
          <button class="msg-act home-msg-copy">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy
          </button>
          <button class="msg-act msg-act--thumb" data-type="positive" title="Helpful">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          </button>
          <button class="msg-act msg-act--thumb" data-type="negative" title="Not helpful">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
          </button>
          <button class="msg-act home-msg-retry">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.67"/></svg> Retry
          </button>
        </div>
      </div>
    </div>`;
  // Wire action buttons via closures — avoids XSS from putting user text in onclick attrs
  d.querySelector('.home-msg-copy')?.addEventListener('click', e => homeCopyMsg(e.currentTarget, msgId));
  d.querySelector('.home-msg-retry')?.addEventListener('click', () => _homeRegenerate(msgId, question));
  msgs.appendChild(d);
  _homeScrollBottom();
  return d;
}

function _homeAppendError(msg) {
  const msgs = document.getElementById('home-messages');
  if (!msgs) return;
  const d = document.createElement('div');
  d.className = 'msg msg-ai';
  const escaped = msg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  d.innerHTML = `<div class="ai-row"><div class="ai-body"><p class="ai-text" style="color:#f87171;">⚠ ${escaped}</p></div></div>`;
  msgs.appendChild(d);
  _homeScrollBottom();
}

// ── Copy handler ──────────────────────────────────────────────────────────────

function homeCopyMsg(btn, msgId) {
  const textEl = document.getElementById(msgId)?.querySelector('.ai-text');
  if (!textEl) return;
  navigator.clipboard?.writeText(textEl.innerText).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2000);
  });
}

// ── Regenerate ────────────────────────────────────────────────────────────────

async function _homeRegenerate(msgId, question) {
  document.getElementById(msgId)?.remove();
  if (_homeChatHistory.length && _homeChatHistory[_homeChatHistory.length - 1].role === 'assistant') {
    _homeChatHistory.pop();
  }
  await _homeAsk(question);
}

// ── Core API call ─────────────────────────────────────────────────────────────

async function _homeSubmit(query) {
  if (!guestGate('workspace')) return;
  _homeAppendUser(query);
  _homeChatHistory.push({ role: 'user', content: query });
  await _homeAsk(query);
}

async function _homeAsk(question) {
  _homeTyping = true;
  _homeAbortCtrl = new AbortController();
  const { signal } = _homeAbortCtrl;
  _homeSetGenerating(true);
  _homeAppendThinking();

  try {
    const thinking  = _homeThinking;
    const complexity = thinking === 'deep' ? 9 : 5;
    const body = {
      question,
      bookId:    'none',
      mode:      'home_general',
      task_type: 'home_general',
      complexity,
      history:   _homeChatHistory.slice(-10),
    };
    if (_homeWebSearch)         body.web_search = true;
    if (thinking === 'think')   body.thinking   = 'thinking';
    if (thinking === 'deep')    body.thinking   = 'deep';

    let res;
    for (let attempt = 0; attempt <= 3; attempt++) {
      res = await fetch(`${API_BASE}/ask`, {
        method:  'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} },
        body:    JSON.stringify(body),
      });
      if (res.status !== 429) break;
      const d429 = await res.json().catch(() => ({}));
      if (d429.guest_limited && isGuest?.() && typeof showLoginWall === 'function') {
        showLoginWall(d429.feature || 'workspace');
        _homeChatHistory.pop();
        _homeRemoveThinking();
        _homeTyping = false;
        _homeSetGenerating(false);
        return;
      }
      if (d429.plan_limited && d429.upgrade_needed) {
        _homeRemoveThinking();
        _homeAppendError(d429.error || 'You\'ve reached your plan limit. Upgrade for unlimited access!');
        _homeChatHistory.pop();
        if (typeof window.openUpgradeModal === 'function') window.openUpgradeModal();
        _homeTyping = false;
        _homeSetGenerating(false);
        return;
      }
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
        continue;
      }
      _homeRemoveThinking();
      _homeAppendError('Server is busy — please wait a moment and try again.');
      _homeChatHistory.pop();
      _homeTyping = false;
      _homeSetGenerating(false);
      return;
    }

    if (!res.ok) {
      _homeRemoveThinking();
      const err = await res.json().catch(() => ({}));
      _homeAppendError(err.error || `Server error ${res.status}`);
      _homeChatHistory.pop();
      _homeTyping = false;
      _homeSetGenerating(false);
      return;
    }

    const data = await res.json();
    if (data.guest_limited && isGuest?.() && typeof showLoginWall === 'function') {
      showLoginWall(data.feature || 'workspace');
      _homeChatHistory.pop();
      _homeRemoveThinking();
      _homeTyping = false;
      _homeSetGenerating(false);
      return;
    }

    const { answer: cleanAnswer } = extractThinkBlock(data.answer || '');
    const finalAnswer = cleanAnswer || data.answer || 'No response.';

    _homeRemoveThinking();
    const aiEl   = _homeAppendAI('', question);
    const textEl = aiEl?.querySelector('.ai-text');
    if (textEl) {
      await typewriteResponse(textEl, finalAnswer, {
        render:      text => sanitize(homeMarkdown(text)),
        onScroll:    _homeScrollBottom,
        isCancelled: () => signal.aborted,
      });
    }
    const actsEl = aiEl?.querySelector('.msg-acts');
    if (actsEl) actsEl.style.display = '';

    _homeChatHistory.push({ role: 'assistant', content: finalAnswer });

  } catch (err) {
    if (err?.name === 'AbortError') {
      _homeRemoveThinking();
    } else {
      _homeRemoveThinking();
      _homeAppendError('Something went wrong. Please try again.');
      _homeChatHistory.pop();
    }
  } finally {
    _homeTyping  = false;
    _homeAbortCtrl = null;
    _homeSetGenerating(false);
  }
}

// ── Landing attach/think menu helpers ────────────────────────────────────────

function homeToggleAttachMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('home-attach-menu');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('#home-attach-menu, #home-think-menu').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

function homeAttachTrigger(type) {
  document.querySelectorAll('#home-attach-menu, #home-think-menu, #home-attach-menu-bottom, #home-think-menu-bottom').forEach(m => m.classList.remove('open'));
  if (typeof window.showScreen === 'function') window.showScreen('workspace');
  setTimeout(() => { window.wsAttachTrigger?.(type); }, _WS_TRANSITION_DELAY);
}

function homePromptYouTube() {
  document.querySelectorAll('#home-attach-menu, #home-think-menu, #home-attach-menu-bottom, #home-think-menu-bottom').forEach(m => m.classList.remove('open'));
  if (typeof window.showScreen === 'function') window.showScreen('workspace');
  setTimeout(() => { window.wsPromptYouTube?.(); }, _WS_TRANSITION_DELAY);
}

function homeToggleWebSearch() {
  ws.webSearch = !ws.webSearch;
  document.getElementById('home-websearch-check')?.classList.toggle('on', ws.webSearch);
  document.getElementById('home-toggle-websearch')?.classList.toggle('active', ws.webSearch);
}

function homeToggleVoiceInput() {
  if (typeof window.showScreen === 'function') window.showScreen('workspace');
  setTimeout(() => { window.wsToggleVoiceInput?.(); }, _WS_TRANSITION_DELAY);
}

function homeToggleThinkMenu(e) {
  e?.stopPropagation();
  const menu = document.getElementById('home-think-menu');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('#home-attach-menu, #home-think-menu').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

function homeToggleThinking(mode) {
  _homeThinking = _homeThinking === mode ? 'off' : mode;
  _homeSyncThinkUI();
  document.getElementById('home-think-menu')?.classList.remove('open');
}

// ── Chat panel attach/think menu helpers ──────────────────────────────────────

function homeCloseBottomMenus() {
  document.getElementById('home-attach-menu-bottom')?.classList.remove('open');
  document.getElementById('home-think-menu-bottom')?.classList.remove('open');
}

function homeToggleAttachMenuBottom(e) {
  e.stopPropagation();
  const menu = document.getElementById('home-attach-menu-bottom');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('#home-attach-menu-bottom, #home-think-menu-bottom').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

function homeToggleWebSearchBottom() {
  _homeWebSearch = !_homeWebSearch;
  document.getElementById('home-websearch-check-bottom')?.classList.toggle('on', _homeWebSearch);
  document.getElementById('home-toggle-websearch-bottom')?.classList.toggle('active', _homeWebSearch);
}

function homeToggleThinkMenuBottom(e) {
  e?.stopPropagation();
  const menu = document.getElementById('home-think-menu-bottom');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('#home-attach-menu-bottom, #home-think-menu-bottom').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

function homeToggleThinkingBottom(mode) {
  _homeThinking = _homeThinking === mode ? 'off' : mode;
  _homeSyncThinkUI();
  document.getElementById('home-think-menu-bottom')?.classList.remove('open');
}

function _homeSyncThinkUI() {
  const isThink = _homeThinking === 'think';
  const isDeep  = _homeThinking === 'deep';
  const isAny   = isThink || isDeep;
  // Landing controls
  document.getElementById('home-think-check')?.classList.toggle('on', isThink);
  document.getElementById('home-deep-check')?.classList.toggle('on', isDeep);
  document.getElementById('home-toggle-think')?.classList.toggle('active', isAny);
  const lbl = document.getElementById('home-think-label');
  if (lbl) lbl.textContent = isDeep ? 'Deep Think' : 'Think';
  // Bottom controls
  document.getElementById('home-think-check-bottom')?.classList.toggle('on', isThink);
  document.getElementById('home-deep-check-bottom')?.classList.toggle('on', isDeep);
  document.getElementById('home-toggle-think-bottom')?.classList.toggle('active', isAny);
  const lblB = document.getElementById('home-think-label-bottom');
  if (lblB) lblB.textContent = isDeep ? 'Deep Think' : 'Think';
}

// ── window exports ────────────────────────────────────────────────────────────

window.homeChipSend              = homeChipSend;
window.homeDoSend                = homeDoSend;
window.homeDoSendBottom          = homeDoSendBottom;
window.homeNewChat               = homeNewChat;
window.homeCopyMsg               = homeCopyMsg;
window._homeRegenerate           = _homeRegenerate;
window.homeToggleAttachMenu      = homeToggleAttachMenu;
window.homeAttachTrigger         = homeAttachTrigger;
window.homePromptYouTube         = homePromptYouTube;
window.homeToggleWebSearch       = homeToggleWebSearch;
window.homeToggleVoiceInput      = homeToggleVoiceInput;
window.homeToggleThinkMenu       = homeToggleThinkMenu;
window.homeToggleThinking        = homeToggleThinking;
window.homeCloseBottomMenus      = homeCloseBottomMenus;
window.homeToggleAttachMenuBottom = homeToggleAttachMenuBottom;
window.homeToggleWebSearchBottom = homeToggleWebSearchBottom;
window.homeToggleThinkMenuBottom = homeToggleThinkMenuBottom;
window.homeToggleThinkingBottom  = homeToggleThinkingBottom;

// ── Home doc-bar updater ──────────────────────────────────────────────────────

function updateHomeDocBar(bookTitle) {
  const label  = document.getElementById('home-doc-label');
  const addBtn = document.getElementById('home-add-doc-btn');
  if (label)  label.textContent  = bookTitle ? bookTitle : 'No document loaded';
  if (addBtn) addBtn.textContent = bookTitle ? 'Change book' : '+ Add textbook';
}

window.updateHomeDocBar = updateHomeDocBar;

console.log('[HomeScreen] module loaded \u2726');
