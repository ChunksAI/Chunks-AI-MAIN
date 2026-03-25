// @ts-nocheck
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
 *   homeMarkdown        ← utils/render.js      (homeMarkdown)
 *   sanitize            ← utils/render.js      (window.sanitize)
 *   wsShowToast         ← state/workspace/chat.js (window.wsShowToast)
 *   recentAdd           ← large script block in index.html (window.recentAdd)
 *   _saveSession        ← large script block in index.html (window._saveSession)
 *   homeToggleAttachMenu← state/workspace/attachments.js (window.homeToggleAttachMenu)
 *   homeAttachTrigger   ← state/workspace/attachments.js (window.homeAttachTrigger)
 *   homeHandleAttach    ← state/workspace/attachments.js (window.homeHandleAttach)
 */

import { API_BASE, _getAuthHeader } from '../lib/api.js';
import { guestGate, recordUsage, renderUsageBar } from '../lib/guestLimits.js';
import { showToast } from '../components/Toast.js';
import { _getStudyMode } from '../components/SettingsModal.js';
import { homeMarkdown, sanitize } from '../utils/render.js';
import { lsGet } from '../utils/storage.js';

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
      <div class="home-hero">
        <div class="eyebrow-pill">
          <svg class="eyebrow-dot" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/>
            <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/>
            <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/>
            <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
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
              <div class="attach-menu-divider"></div>
              <div class="attach-menu-section-label">AI Mode</div>
              <div class="attach-menu-item attach-menu-toggle" id="home-toggle-websearch" onclick="homeToggleWebSearch()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span>Web Search</span>
                <div class="attach-menu-check" id="home-websearch-check"></div>
              </div>
              <div class="attach-menu-item attach-menu-toggle" id="home-toggle-think" onclick="homeToggleThinking('think')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg>
                <span>Think</span>
                <div class="attach-menu-check" id="home-think-check"></div>
              </div>
              <div class="attach-menu-item attach-menu-toggle" id="home-toggle-deep" onclick="homeToggleThinking('deep')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>Deep Think</span>
                <div class="attach-menu-check" id="home-deep-check"></div>
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
            <div class="qc-icon gold">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <div class="qc-title">Open Textbook</div>
            <div class="qc-desc">Browse your library and study alongside AI</div>
          </div>
          <div class="quick-card" data-action="showScreen" data-screen="flash">
            <div class="qc-icon violet">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="16" height="12" rx="2"/>
                <rect x="6" y="7" width="16" height="12" rx="2" fill="var(--violet-muted)" stroke="var(--violet)" stroke-width="2"/>
                <path d="M12.5 11 11 13.5h2.5L12 16" stroke-width="1.8"/>
              </svg>
            </div>
            <div class="qc-title">Flashcards</div>
            <div class="qc-desc">Generate and review study cards from any chapter</div>
          </div>
          <div class="quick-card" onclick="document.getElementById('home-pdf-upload').click()">
            <div class="qc-icon teal">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <polyline points="9 15 12 12 15 15"/>
              </svg>
            </div>
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
          <div class="attach-menu home-rich-menu" id="home-attach-menu-bottom">
            <div class="attach-menu-section-label">Attach</div>
            <div class="attach-menu-item" onclick="homeAttachTrigger('image','bottom')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Image</span>
            </div>
            <div class="attach-menu-item" onclick="homeAttachTrigger('pdf','bottom')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>PDF</span>
            </div>
            <div class="attach-menu-divider"></div>
            <div class="attach-menu-section-label">AI Mode</div>
            <div class="attach-menu-item attach-menu-toggle" onclick="homeToggleWebSearch()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span>Web Search</span>
              <div class="attach-menu-check" id="home-websearch-check-b"></div>
            </div>
            <div class="attach-menu-item attach-menu-toggle" onclick="homeToggleThinking('think')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg>
              <span>Think</span>
              <div class="attach-menu-check" id="home-think-check-b"></div>
            </div>
            <div class="attach-menu-item attach-menu-toggle" onclick="homeToggleThinking('deep')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span>Deep Think</span>
              <div class="attach-menu-check" id="home-deep-check-b"></div>
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
     Opened via profile dropdown item or Ctrl+I.
════════════════════════════════════════════════════════════ -->
<div class="incognito-modal" id="incognito-modal" role="dialog" aria-modal="true" aria-labelledby="incognito-modal-title">

  <!-- Close button — top right only -->
  <button class="incognito-close" onclick="closeIncognitoChat()" aria-label="Close incognito chat">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>

  <!-- Messages / hero — fills all space -->
  <div class="incognito-messages" id="incognito-messages">
    <div class="incognito-empty" id="incognito-empty">
      <!-- Classic incognito hat + glasses icon -->
      <div class="incognito-hero-icon" aria-hidden="true">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Hat brim -->
          <rect x="10" y="38" width="60" height="7" rx="3.5" fill="rgba(255,255,255,0.75)"/>
          <!-- Hat top -->
          <rect x="24" y="14" width="32" height="26" rx="4" fill="rgba(255,255,255,0.75)"/>
          <!-- Hat band -->
          <rect x="24" y="33" width="32" height="6" rx="0" fill="rgba(255,255,255,0.35)"/>
          <!-- Left lens outer -->
          <circle cx="26" cy="57" r="12" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.70)" stroke-width="2.5"/>
          <!-- Left lens inner shine -->
          <circle cx="22" cy="53" r="3" fill="rgba(255,255,255,0.18)"/>
          <!-- Right lens outer -->
          <circle cx="54" cy="57" r="12" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.70)" stroke-width="2.5"/>
          <!-- Right lens inner shine -->
          <circle cx="50" cy="53" r="3" fill="rgba(255,255,255,0.18)"/>
          <!-- Bridge between lenses -->
          <path d="M38 57 Q40 54 42 57" stroke="rgba(255,255,255,0.70)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <!-- Left arm -->
          <path d="M14 57 Q8 55 6 50" stroke="rgba(255,255,255,0.60)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <!-- Right arm -->
          <path d="M66 57 Q72 55 74 50" stroke="rgba(255,255,255,0.60)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        </svg>
      </div>
      <h2 class="incognito-hero-heading" id="incognito-modal-title">You&rsquo;re incognito</h2>
    </div>
  </div>

  <!-- Compose area — centered wide box -->
  <div class="incognito-compose-wrap">
    <div class="incognito-compose-box">
      <textarea
        id="incognito-input"
        class="incognito-textarea"
        placeholder="How can I help you today?"
        rows="1"
      ></textarea>
      <div class="incognito-compose-footer">
        <button class="incognito-plus-btn" aria-label="Attach" tabindex="-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <div class="incognito-compose-right">
          <span class="incognito-model-tag">Chunks AI</span>
          <button class="incognito-send" id="incognito-send-btn" onclick="incognitoSendMessage()" aria-label="Send">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
    <p class="incognito-privacy-note">Incognito chats aren&rsquo;t saved to history or used to train models.</p>
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

// Shared Chunks orbital logo avatar — used in all AI message bubbles
const _HOME_AI_AVATAR = `<div class="hc-ai-avatar"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="#c8a84b" stroke-width="7" opacity="0.95"/><ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="#a855f7" stroke-width="7" transform="rotate(60 50 50)" opacity="0.85"/><ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="#c8a84b" stroke-width="7" transform="rotate(120 50 50)" opacity="0.75"/><circle cx="50" cy="50" r="6" fill="#e8ac2e"/></svg></div>`;

export let homeMode      = 'general';
export let _homeWebSearch = false;
export let _homeThinking  = 'off'; // 'off' | 'think' | 'deep'
export let homeHistory   = [];
export let _homeSessionId = null;
let homeIsTyping = false;
let _homeLastInputTime = 0;

// ── Incognito chat state (lives only in memory — never written to storage) ────
let _incogHistory = [];
let _incogTyping  = false;

// ── Incognito chat functions ──────────────────────────────────────────────────

export function openIncognitoChat() {
  const modal = document.getElementById('incognito-modal');
  if (!modal) return;
  _incogHistory = [];
  const msgs = document.getElementById('incognito-messages');
  if (msgs) {
    msgs.innerHTML = `
      <div class="incognito-empty" id="incognito-empty">
        <div class="incognito-hero-icon" aria-hidden="true">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="38" width="60" height="7" rx="3.5" fill="rgba(255,255,255,0.75)"/>
            <rect x="24" y="14" width="32" height="26" rx="4" fill="rgba(255,255,255,0.75)"/>
            <rect x="24" y="33" width="32" height="6" rx="0" fill="rgba(255,255,255,0.35)"/>
            <circle cx="26" cy="57" r="12" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.70)" stroke-width="2.5"/>
            <circle cx="22" cy="53" r="3" fill="rgba(255,255,255,0.18)"/>
            <circle cx="54" cy="57" r="12" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.70)" stroke-width="2.5"/>
            <circle cx="50" cy="53" r="3" fill="rgba(255,255,255,0.18)"/>
            <path d="M38 57 Q40 54 42 57" stroke="rgba(255,255,255,0.70)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path d="M14 57 Q8 55 6 50" stroke="rgba(255,255,255,0.60)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path d="M66 57 Q72 55 74 50" stroke="rgba(255,255,255,0.60)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          </svg>
        </div>
        <h2 class="incognito-hero-heading">You\u2019re incognito</h2>
      </div>`;
  }
  const inp = document.getElementById('incognito-input');
  if (inp) { inp.value = ''; inp.style.height = 'auto'; }
  modal.classList.add('active');
  setTimeout(() => document.getElementById('incognito-input')?.focus(), 80);
}

export function closeIncognitoChat() {
  const modal = document.getElementById('incognito-modal');
  if (!modal) return;
  modal.classList.remove('active');
  _incogHistory = [];
}

function _incogAutoResize(el) {
  // No cap — textarea grows freely with content, no scrollbar ever shown
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function _incogScrollBottom() {
  const msgs = document.getElementById('incognito-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function _incogGetInner() {
  const msgs = document.getElementById('incognito-messages');
  if (!msgs) return null;
  let inner = msgs.querySelector('.incognito-messages-inner');
  if (!inner) {
    inner = document.createElement('div');
    inner.className = 'incognito-messages-inner';
    msgs.appendChild(inner);
  }
  return inner;
}

function _incogAppendUser(text) {
  document.getElementById('incognito-empty')?.remove();
  const inner = _incogGetInner();
  if (!inner) return;
  const d = document.createElement('div');
  d.className = 'incognito-msg incognito-msg-user';
  d.textContent = text;
  inner.appendChild(d);
  _incogScrollBottom();
}

function _incogAppendThinking() {
  const inner = _incogGetInner();
  if (!inner) return;
  const d = document.createElement('div');
  d.className = 'incognito-msg incognito-msg-ai';
  d.id = 'incognito-thinking';
  d.innerHTML = `
    <div class="incognito-ai-row">
      <div class="incognito-ai-ava" aria-hidden="true">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/>
          <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
        </svg>
      </div>
      <div class="hc-thinking"><span></span><span></span><span></span></div>
    </div>`;
  inner.appendChild(d);
  _incogScrollBottom();
}

function _incogRemoveThinking() {
  document.getElementById('incognito-thinking')?.remove();
}

function _incogAppendAI(text) {
  const inner = _incogGetInner();
  if (!inner) return;
  const d = document.createElement('div');
  d.className = 'incognito-msg incognito-msg-ai';
  d.innerHTML = `
    <div class="incognito-ai-row">
      <div class="incognito-ai-ava" aria-hidden="true">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/>
          <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
        </svg>
      </div>
      <div class="incognito-ai-body">${homeMarkdown?.(text) ?? text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>
    </div>`;
  inner.appendChild(d);
  _incogScrollBottom();
}

function _incogAppendError(msg) {
  const inner = _incogGetInner();
  if (!inner) return;
  const d = document.createElement('div');
  d.className = 'incognito-msg incognito-msg-error';
  d.textContent = '\u26a0 ' + msg;
  inner.appendChild(d);
  _incogScrollBottom();
}

export async function incognitoSendMessage() {
  if (_incogTyping) return;
  const inp = document.getElementById('incognito-input');
  const btn = document.getElementById('incognito-send-btn');
  const question = inp?.value?.trim();
  if (!question) return;

  inp.value = '';
  inp.style.height = 'auto';
  _incogAppendUser(question);
  _incogHistory.push({ role: 'user', content: question });

  _incogTyping = true;
  if (btn) btn.disabled = true;
  _incogAppendThinking();

  try {
    const res = await fetch(`${API_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} },
      body: JSON.stringify({
        question,
        bookId: '',
        mode: 'general',
        task_type: 'home_general',
        complexity: (() => { const m = _getStudyMode?.() || 'balanced'; return m === 'concise' ? 3 : m === 'detailed' ? 8 : 5; })(),
        language: localStorage.getItem('chunks_setting_language') || 'Auto-detect',
        safe_content: localStorage.getItem('chunks_setting_safe-content') === '1',
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
  showToast('📄', `"${name}" ready to chat`, '');
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
    ${_HOME_AI_AVATAR}
    <div class="hc-ai-body">
      <div style="display:flex;align-items:center;gap:10px;padding:3px 0;">
        <div class="hc-thinking"><span></span><span></span><span></span></div>
        <span id="home-thinking-label" class="hc-thinking-label">Thinking…</span>
      </div>
    </div>`;
  document.getElementById('home-chat-history').appendChild(wrap);
  homeScrollBottom();
  const labels = ['Thinking…', 'Analyzing concept…', 'Reading context…', 'Generating explanation…'];
  let li = 0;
  wrap._labelTimer = setInterval(() => {
    const el = document.getElementById('home-thinking-label');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => {
      li = (li + 1) % labels.length;
      el.textContent = labels[li];
      el.style.opacity = '';
    }, 280);
  }, 2400);
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
    ${_HOME_AI_AVATAR}
    <div class="hc-ai-body">${homeMarkdown(text)}${sourceBadge}</div>`;
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

// ── AI Mode toggles ───────────────────────────────────────────────────────
export function homeToggleWebSearch() {
  _homeWebSearch = !_homeWebSearch;
  ['home-websearch-check','home-websearch-check-b'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', _homeWebSearch);
  });
  ['home-toggle-websearch'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', _homeWebSearch);
  });
}

export function homeToggleThinking(mode) {
  // Toggle off if already active, else switch to new mode
  _homeThinking = _homeThinking === mode ? 'off' : mode;
  const isThink = _homeThinking === 'think';
  const isDeep  = _homeThinking === 'deep';
  ['home-think-check','home-think-check-b'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', isThink);
  });
  ['home-deep-check','home-deep-check-b'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', isDeep);
  });
  ['home-toggle-think'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', isThink);
  });
  ['home-toggle-deep'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', isDeep);
  });
}

export async function homeSendMessage() {
  if (homeIsTyping) return;
  if (!guestGate('general')) return; // guest limit check
  // Mark that the user is actively in this session — prevents sync from overwriting mid-conversation
  _homeLastInputTime = Date.now();
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
  recordUsage('general'); // track guest usage
  renderUsageBar('home-input-area', 'general'); // show counter near input

  // Save immediately so refresh before AI responds still restores the chat.
  // _homeSessionId is now guaranteed to be set (created above if new).
  if (_homeSessionId) {
    window._saveSession?.(_homeSessionId, homeHistory);
    localStorage.setItem('chunks_active_home_session', _homeSessionId);
    window._renderAllRecent?.();
    // Supabase write is handled by _saveSession → saveFull (single write path).
    // appendMessage was removed here to fix the double-write race (Bug #2):
    // saveFull UPSERTs the full array while appendMessage appends a single turn —
    // whichever resolves second wins and can duplicate or truncate messages.
  }

  homeIsTyping = true;
  homeAppendThinking();
  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} },
      body: JSON.stringify({
        question,
        bookId: '',
        mode: 'general',
        task_type: 'home_general',
        complexity: (() => { const m = _getStudyMode?.() || 'balanced'; return m === 'concise' ? 3 : m === 'detailed' ? 8 : 5; })(),
        language: localStorage.getItem('chunks_setting_language') || 'Auto-detect',
        safe_content: localStorage.getItem('chunks_setting_safe-content') === '1',
        history: homeHistory.slice(-12),
        ...(_homeWebSearch ? { web_search: true } : {}),
        ...(_homeThinking === 'think' ? { thinking: 'thinking' } : {}),
        ...(_homeThinking === 'deep'  ? { thinking: 'deep'     } : {}),
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
        // Supabase write is handled by _saveSession → saveFull (single write path).
        // appendMessage was removed here to fix the double-write race (Bug #2).
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
  // chunks_is_refresh is set by navigation.js._restoreScreen() which runs on
  // DOMContentLoaded. This IIFE runs at module eval time (before DCL), so we
  // also check chunks_was_here as the early-available signal.
  const isRefresh = sessionStorage.getItem('chunks_is_refresh') === '1' ||
                    sessionStorage.getItem('chunks_was_here') === '1';
  if (!isRefresh) return;

  const activeScreen = sessionStorage.getItem('chunks_active_screen');

  // Workspace restore is fully handled by navigation.js._restoreScreen() —
  // skip it here entirely to avoid double-restore or timing conflicts.
  if (activeScreen === 'workspace' ||
      (!activeScreen && localStorage.getItem('chunks_active_ws_book'))) {
    return;
  }

  // ── Restore home chat ──
  if (activeScreen && activeScreen !== 'home') return;

  // Helper that actually mounts the session into the DOM
  // ── renderFromHistory: re-builds chat DOM from message array ────────────
  // Used when html is empty (cross-device restore — HTML was never stored on
  // this device). Falls back gracefully if markdown renderer isn't ready.
  function _renderFromHistory(history) {
    const chatHist = document.getElementById('home-chat-history');
    if (!chatHist || !history?.length) return;
    chatHist.innerHTML = '';
    history.forEach(msg => {
      if (msg.role === 'user') {
        const el = document.createElement('div');
        el.className = 'hc-user';
        el.textContent = msg.content || '';
        chatHist.appendChild(el);
      } else if (msg.role === 'assistant') {
        const wrap = document.createElement('div');
        wrap.className = 'hc-ai';
        const rendered = homeMarkdown
          ? homeMarkdown(msg.content || '')
          : (msg.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
        wrap.innerHTML = `${_HOME_AI_AVATAR}<div class="hc-ai-body">${rendered}</div>`;
        chatHist.appendChild(wrap);
      }
    });
  }

  // ── _mountSession: show the landing-to-chat transition ──────────────────
  function _mountSession(session, sessionId) {
    const history = session?.history || session?.messages || [];
    if (!history.length && !session?.html) return;

    const landing    = document.getElementById('home-landing');
    const hero       = document.querySelector('.home-hero');
    const bar        = document.getElementById('home-input-bar');
    const scrollArea = document.getElementById('home-scroll-area');
    const chatHist   = document.getElementById('home-chat-history');

    if (landing)    landing.style.display = 'none';
    if (hero)       hero.style.display = 'none';
    if (bar)        bar.style.display = 'flex';
    if (scrollArea) scrollArea.style.justifyContent = 'flex-start';

    if (session.html && chatHist) {
      // Local device — use cached rendered HTML
      chatHist.innerHTML = sanitize(session.html);
    } else if (history.length && chatHist) {
      // Cross-device restore — rebuild from message array
      _renderFromHistory(history);
    }

    // Always populate homeHistory from the message array so the _onSessionsReady
    // guard correctly sees this session as active. Previously, sessions restored
    // via cached HTML could leave homeHistory=[] even though content was showing,
    // causing cross-device sync to mount a second session on top of this one.
    homeHistory    = history;
    _homeSessionId = sessionId;
    window._setActiveRecent?.(sessionId);
    setTimeout(() => homeScrollBottom(true), 80);
  }
  // Expose so module-level listener can call it after IIFE exits
  // _mountSession exposed via export below

  // ── Restore on page load ─────────────────────────────────────────────────
  // For logged-in users: don't block on sync — just restore what localStorage
  // has right now, then let SyncManager call _homeMountLatestSession() after
  // sync completes to pick up any newer sessions from other devices.

  const savedId = localStorage.getItem('chunks_active_home_session');
  if (savedId && !(activeScreen && activeScreen !== 'home')) {
    try {
      const s = lsGet('chunks_session_' + savedId);
      if (s) _mountSession(s, savedId);
    } catch (_) {}
  }
})();

// ── Cross-device chat restore ─────────────────────────────────────────────────
// Registered at module level (OUTSIDE the IIFE) so it's always active —
// even on a fresh device where isRefresh=false and the IIFE exits early.
// Fires when chat.pullAndApply() downloads sessions from Supabase.
let _sessionsReadyLastFired = 0;
window.addEventListener('chunks:sessions-ready', function _onSessionsReady() {
  console.log('[HomeScreen] chunks:sessions-ready fired, homeHistory.length=', homeHistory.length);

  // Only block if the user actively TYPED something in the last 2 minutes.
  // _homeSessionId being set just means a session was restored — that's fine
  // to override with a newer remote session. Only a live in-progress conversation
  // (user typed recently) should block the remote session from loading.
  const userIsLive = _homeSessionId && (Date.now() - (_homeLastInputTime || 0)) < 120_000;
  if (userIsLive) return;

  // Debounce: TOKEN_REFRESHED triggers a second pullAll shortly after the first,
  // causing this event to fire twice in quick succession and mount the session twice.
  const now = Date.now();
  if (now - _sessionsReadyLastFired < 3000) return;
  _sessionsReadyLastFired = now;

  // Yield to the microtask queue so _hydrateRecentFromRemote can finish
  // writing _recentItems before we attempt to restore the session.
  // Without this delay, chunks:sessions-ready fires synchronously inside
  // chat.pullAndApply() — immediately after _hydrateRecentFromRemote is
  // called but before its internal localStorage / _recentItems writes have
  // settled — causing _homeMountSession to see an empty _recentItems and
  // fall back to the landing screen instead of the last chat.
  setTimeout(function restoreSession() {
    // Find the newest session in localStorage with actual content.
    // Prefer the r+timestamp keyed entry (has supabaseId for future writes)
    // over the UUID-keyed entry when both exist for the same session.
    try {
      let newest = null;
      let newestTime = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith('chunks_session_')) continue;
        let s;
        try { s = JSON.parse(localStorage.getItem(k)); } catch (_) { continue; }
        // Normalise: pullAndApply writes 'messages', _saveSession writes 'history'
        if (!s.history && s.messages) s.history = s.messages;
        const history = s?.history || [];
        if (!history.length) continue;
        const localId = k.replace('chunks_session_', '');
        // Prefer the r+timestamp key over the UUID key for the same session
        const isLocalKey = /^r[0-9]+$/.test(localId);
        const t = new Date(s.updatedAt || 0).getTime();
        if (t > newestTime || (t === newestTime && isLocalKey)) {
          newestTime = t;
          newest = { s, id: localId };
        }
      }
      if (newest) {
        localStorage.setItem('chunks_active_home_session', newest.id);
        _mountSession(newest.s, newest.id);
      }
    } catch (_) {}
  }, 100);
});

export function _homeMountLatestSession() {
  window.dispatchEvent(new CustomEvent('chunks:sessions-ready'));
}

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

// Window bridges removed — now handled by src/globals.js

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

// ── Guest mode banner ─────────────────────────────────────────────────────────
// Show a subtle "Sign in to save your chats" notice when running as guest.

(function _mountGuestBanner() {
  if (sessionStorage.getItem('chunks_guest_mode') !== '1') return;
  const landing = document.getElementById('home-landing');
  if (!landing || document.getElementById('home-guest-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'home-guest-banner';
  banner.style.cssText = 'display:flex;align-items:center;gap:10px;background:color-mix(in srgb,var(--gold,#f59e0b) 10%,var(--surface-2,#1e1e2e));border:1px solid color-mix(in srgb,var(--gold,#f59e0b) 25%,transparent);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--text-2,#aaa);margin:12px auto 0;max-width:560px;width:calc(100% - 32px);';
  banner.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;opacity:.7"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg><span>You're in guest mode — chats won't be saved. <a href="#" onclick="sessionStorage.removeItem('chunks_guest_mode');window.openAuthModal?.();return false;" style="color:var(--gold,#f59e0b);text-decoration:none;font-weight:500;">Sign in</a> to keep your history.</span>`;
  landing.appendChild(banner);
})();

console.log('[HomeScreen] module loaded ✦');
