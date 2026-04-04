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
 *     homeSendMessage, homeCopyMsg, homeFeedback, _homeRegenerate
 *   • Hero random-phrase picker (runs post-inject)
 *   • DOMContentLoaded listeners for both input bars
 *
 * Bridges set on window.*:
 *   homeSetMode, homeSetInput, homeHandlePdfUpload, homeAutoResize,
 *   homeAppendUser, homeAppendThinking, homeRemoveThinking, homeAppendAI,
 *   homeAppendError, homeScrollBottom, homeHideLanding, homeSendMessage,
 *   homeCopyMsg, homeFeedback, _homeRegenerate,
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
import { idbKeys } from '../lib/idbStorage.js';
import { ChunksDB } from '../lib/chunksDb.js';
import { subscribeToHomeMessages, unsubscribeHomeMessages } from '../state/home/homeMessagesRealtime.js';
import { createThinkingAccordion } from '../components/ThinkingAccordion.js';
import { typewriteResponse, extractThinkBlock } from '../utils/typewriter.js';
import { ws } from '../state/workspace/state.js';
import { _homeRenderPreview } from '../state/workspace/attachments.js';

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
          <div id="home-attach-preview" class="attach-preview" style="display:none;"></div>
          <div class="ask-input-row">
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
        </div>

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
        <div id="home-activities-section">
          <!-- Populated dynamically by _renderHomeActivities() -->
        </div>
      </div> <!-- end home-landing -->
    </div> <!-- end home-scroll-area -->

    <!-- Sticky bottom input bar — shown only after first message -->
    <div class="home-input-bar" id="home-input-bar" style="display:none;">
      <div class="ask-box" id="home-ask-box-bottom" style="max-width:860px;">
        <div id="home-attach-preview-bottom" class="attach-preview" style="display:none;"></div>
        <div class="ask-input-row">
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
let _thinkStart = 0;  // timestamp (ms) when AI thinking began — for elapsed time display
let _homeAbortController = null;

// ── Free-scroll: track whether the user has manually scrolled up ──────────
let _homeUserScrolled = false;

// ── Send/Stop icon SVGs ───────────────────────────────────────────────────
const _HOME_SEND_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
const _HOME_STOP_SVG = `<svg width="11" height="11" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" rx="2" ry="2" fill="currentColor"/></svg>`;

/** Swap a home send button between send ↔ stop states. */
function _homeSetGenerating(btn, on) {
  if (!btn) return;
  if (on) {
    btn.innerHTML = _HOME_STOP_SVG;
    btn.classList.add('ask-send--stop');
    btn.disabled = false;
  } else {
    btn.innerHTML = _HOME_SEND_SVG;
    btn.classList.remove('ask-send--stop');
    btn.disabled = false;
  }
}

/** Abort the active home AI request and restore the send button. */
export function homeStopGeneration() {
  if (_homeAbortController) {
    _homeAbortController.abort();
    _homeAbortController = null;
  }
}

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
      <div class="incognito-ai-body" style="background:none;border:none;padding:4px 0;"><span class="ws-typing-dot"></span></div>
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

  // Render recent activities or fallback chips
  _renderHomeActivities();

  // Wire incognito modal listeners immediately after DOM is injected
  _wireIncognitoListeners();
  _wireIncognitoBackdrop();
}

// ── Recent Activities / Suggestion chips ─────────────────────────────────────

const _SUGGEST_CHIPS = [
  'Photosynthesis', "Newton's Laws of Motion", 'Cell Division',
  'The French Revolution', 'Supply and Demand', 'Pythagorean Theorem'
];

export function _renderHomeActivities() {
  const container = document.getElementById('home-activities-section');
  if (!container) return;

  const _esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const _barColor = pct => pct >= 80 ? 'var(--green)' : pct >= 20 ? 'var(--gold)' : 'var(--text-4)';

  // ── 1. Last read book ───────────────────────────────────────────────────────
  let lastBook = null;
  try {
    const bpAll = JSON.parse(localStorage.getItem('chunks_book_progress_v1') || '{}');
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
    const entries = Object.entries(allPlans);
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
            ((m.explain || 0) / 100) * MASTERY_WEIGHTS.explain + ((m.flash || 0) / 100) * MASTERY_WEIGHTS.flash +
            ((m.pq || 0) / 100) * MASTERY_WEIGHTS.pq + ((m.exam || 0) / 100) * MASTERY_WEIGHTS.exam
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
    const decks = lsGet('chunks_fc_decks_v1') || [];
    const masteryStore = lsGet('chunks_fc_mastery_v1') || {};
    const deckEntries = Object.entries(masteryStore);
    if (deckEntries.length > 0) {
      deckEntries.sort((a, b) => (b[1].lastStudied || '').localeCompare(a[1].lastStudied || ''));
      const [deckId, stats] = deckEntries[0];
      const deck = decks.find(d => d.id === deckId);
      if (deck) lastDeck = { deckId, name: deck.name, pct: stats.pct || 0, cardCount: deck.card_count || 0 };
    }
    // Fallback: most recently created deck if none have been studied yet
    if (!lastDeck && decks.length > 0) {
      const sorted = decks.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      const d = sorted[0];
      if (d?.name) lastDeck = { deckId: d.id, name: d.name, pct: 0, cardCount: d.card_count || 0 };
    }
  } catch (_) {}

  // ── No activity at all → show "Try asking" for new users ───────────────────
  if (!lastBook && !lastPlan && !lastDeck) {
    container.innerHTML = `
      <p class="prompts-label">Try asking</p>
      <div class="prompts-chips">
        ${_SUGGEST_CHIPS.map(t =>
          `<button class="prompt-chip" data-action="homeSetInput-text">${t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</button>`
        ).join('')}
      </div>`;
    return;
  }

  // ── Build rich activity section ─────────────────────────────────────────────
  let richCards = '';

  if (lastBook) {
    const timeAgo  = _timeAgo(lastBook.lastOpened);
    const pctColor = _barColor(lastBook.pct);
    richCards += `
      <div class="ra-card book ra-compact-card" data-ra-action="book" data-ra-id="${_esc(lastBook.bookId)}">
        <div class="ra-compact-top">
          <div class="ra-compact-icon gold">📖</div>
          <span class="ra-compact-type">Textbook</span>
        </div>
        <div class="ra-compact-title">${_esc(lastBook.title)}</div>
        <div class="ra-compact-meta">
          <span>📍 Page ${lastBook.lastPage}${lastBook.totalPages ? ` of ${lastBook.totalPages}` : ''}</span>
          <span class="ra-compact-time">${_esc(timeAgo)}</span>
        </div>
        <div class="ra-compact-bar-row">
          <div class="ra-compact-bar"><div class="ra-compact-bar-fill" style="width:${lastBook.pct}%;background:${pctColor}"></div></div>
          <span class="ra-compact-pct">${lastBook.pct}%</span>
        </div>
        <button class="ra-compact-btn gold-btn">Continue Studying →</button>
      </div>`;
  }

  if (lastPlan) {
    const planPctColor = _barColor(lastPlan.barPct);
    richCards += `
      <div class="ra-card plan ra-compact-card" data-ra-action="plan" data-ra-id="${_esc(lastPlan.planId)}">
        <div class="ra-compact-top">
          <div class="ra-compact-icon violet">📋</div>
          <span class="ra-compact-type">Study Plan</span>
        </div>
        <div class="ra-compact-title">${_esc(lastPlan.topic)}</div>
        <div class="ra-compact-meta">
          <span>📍 Mastery progress</span>
        </div>
        <div class="ra-compact-bar-row">
          <div class="ra-compact-bar"><div class="ra-compact-bar-fill" style="width:${lastPlan.barPct}%;background:${planPctColor}"></div></div>
          <span class="ra-compact-pct">${lastPlan.barPct}%</span>
        </div>
        <button class="ra-compact-btn violet-btn">Resume →</button>
      </div>`;
  }

  if (lastDeck) {
    const deckPctColor = _barColor(lastDeck.pct);
    const deckSub      = lastDeck.cardCount ? `${lastDeck.cardCount} cards` : 'Flashcards';
    richCards += `
      <div class="ra-card flash ra-compact-card" data-ra-action="flash" data-ra-id="${_esc(lastDeck.deckId)}">
        <div class="ra-compact-top">
          <div class="ra-compact-icon teal">🃏</div>
          <span class="ra-compact-type">${_esc(deckSub)}</span>
        </div>
        <div class="ra-compact-title">${_esc(lastDeck.name)}</div>
        <div class="ra-compact-meta">
          <span>📍 Cards mastered</span>
        </div>
        <div class="ra-compact-bar-row">
          <div class="ra-compact-bar"><div class="ra-compact-bar-fill" style="width:${lastDeck.pct}%;background:${deckPctColor}"></div></div>
          <span class="ra-compact-pct">${lastDeck.pct}%</span>
        </div>
        <button class="ra-compact-btn teal-btn">Review →</button>
      </div>`;
  }

  container.innerHTML = `
    <p class="prompts-label">Recent activity</p>
    <div class="ra-grid">${richCards}</div>`;

  // Wire click handlers for rich cards
  container.querySelectorAll('.ra-card').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.raAction;
      const id = el.dataset.raId;
      if (action === 'book') {
        if (typeof window.selectBook === 'function') window.selectBook(id);
      } else if (action === 'plan') {
        if (typeof window.showScreen === 'function') window.showScreen('studyplan');
        // spSwitchToPlan runs after showScreen() initialises the study plan screen
        setTimeout(() => { if (typeof window.spSwitchToPlan === 'function') window.spSwitchToPlan(id); }, 100);
      } else if (action === 'flash') {
        if (typeof window.showScreen === 'function') window.showScreen('flash');
      }
    });
  });

  // Async: generate PDF first-page thumbnail for book card
  if (lastBook) {
    _injectPdfThumb(lastBook.bookId).catch(() => {});
  }
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

  const SESS_KEY  = `ra_pdf_thumb_v1_${bookId}`;
  const API_BASE  = window.API_BASE || 'https://api.chunks.online';
  const CACHE_NAME = 'chunks-pdf-v1';
  const pdfUrl     = `${API_BASE}/pdf/${bookId}`;

  // 1. Fast path: cached data URL in sessionStorage
  const cached = sessionStorage.getItem(SESS_KEY);
  if (cached) { _applyThumb(wrap, cached); return; }

  // 2. Try to get PDF bytes from Cache API (already downloaded)
  let pdfData = null;
  try {
    if ('caches' in window) {
      const cache  = await caches.open(CACHE_NAME);
      const match  = await cache.match(pdfUrl);
      if (match) pdfData = await match.arrayBuffer();
    }
  } catch (_) {}

  if (!pdfData) return; // PDF not cached yet — leave placeholder

  // 3. Load PDF.js and render page 1 to canvas
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

    const canvas = wrap.querySelector('.ra-pdf-canvas');
    canvas.width  = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

    // 4. Convert to JPEG and cache in sessionStorage
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
      // dataUrl from sessionStorage — inject as img instead
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

/** Placeholder used when a user sends an image without any text. */
const _IMAGE_ONLY_LABEL = '[Image]';

export function homeAppendUser(text, images = []) {
  const container = document.getElementById('home-chat-history');
  // Image bubble first (separate bubble) — matches Claude.ai / ChatGPT layout
  let firstBubble = null;
  if (images.length > 0) {
    const imgBubble = document.createElement('div');
    imgBubble.className = 'hc-user';
    images.forEach(a => {
      const wrap = document.createElement('div');
      wrap.className = 'chat-img-wrap';
      wrap.onclick = () => window.openImgLightbox?.(wrap);
      const img = document.createElement('img');
      img.src = a.dataUrl; img.alt = a.name;
      wrap.appendChild(img);
      imgBubble.appendChild(wrap);
    });
    container.appendChild(imgBubble);
    firstBubble = imgBubble;
  }
  // Text bubble second (separate bubble below images)
  if (text) {
    const textBubble = document.createElement('div');
    textBubble.className = 'hc-user';
    textBubble.appendChild(document.createTextNode(text));
    container.appendChild(textBubble);
    if (!firstBubble) firstBubble = textBubble;
  }
  if (firstBubble) {
    const scrollContainer = document.getElementById('home-scroll-area');
    if (scrollContainer) {
      scrollContainer.scrollTop = firstBubble.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top + scrollContainer.scrollTop;
    }
  }
}

/** Handle for the currently-mounted ThinkingAccordion (if any). */
let _homeThinkingHandle = null;
let _homeThinkingWrap   = null;

export function homeAppendThinking(hasImage = false) {
  // Remove any leftover accordion from a prior request
  homeRemoveThinking();

  const wrap = document.createElement('div');
  wrap.className = 'hc-ai';
  wrap.id = 'hc-thinking';

  document.getElementById('home-chat-history').appendChild(wrap);
  _homeThinkingWrap = wrap;

  if (_homeThinking === 'off') {
    if (hasImage) {
      // Animated "Analyzing image..." text indicator for image messages
      const span = document.createElement('span');
      span.className = 'ws-analyzing-text';
      span.textContent = 'Analyzing image.';
      let dots = 1;
      const timer = setInterval(() => {
        dots = (dots % 3) + 1;
        span.textContent = 'Analyzing image' + '.'.repeat(dots);
      }, 500);
      wrap._labelTimer = timer;
      const body = document.createElement('div');
      body.className = 'hc-ai-body';
      body.style.padding = '4px 0';
      body.appendChild(span);
      wrap.appendChild(body);
    } else {
      // Simple blinking dot indicator for text-only messages
      wrap.innerHTML = `<div class="hc-ai-body" style="padding:4px 0;"><span class="ws-typing-dot"></span></div>`;
    }
  } else {
    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'hc-ai-body';

    const container = document.createElement('div');
    container.style.cssText = 'width:100%;';
    bodyWrap.appendChild(container);

    wrap.appendChild(bodyWrap);

    // Mount ThinkingAccordion in streaming mode (empty text, live header dot)
    _homeThinkingHandle = createThinkingAccordion(container, {
      thinkingText: '',
      elapsed: 0,
      isStreaming: true,
    });
  }

  homeScrollBottom();
}

export function homeRemoveThinking() {
  if (_homeThinkingHandle) {
    if (_homeThinkingHandle._revealTimer) clearTimeout(_homeThinkingHandle._revealTimer);
    _homeThinkingHandle.unmount();
    _homeThinkingHandle = null;
  }
  if (_homeThinkingWrap) {
    _homeThinkingWrap.remove();
    _homeThinkingWrap = null;
  }
  // Fallback: remove by id in case something else created it
  const el = document.getElementById('hc-thinking');
  if (el) { clearInterval(el._labelTimer); el.remove(); }
}

export function homeAppendAI(text, sources, { typewrite = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'hc-ai';
  // Store raw content for realtime deduplication (rendered HTML textContent ≠ markdown source)
  wrap.dataset.rawContent = text;
  let sourceBadge = '';
  if (sources && sources.length > 0) {
    sourceBadge = `<div class="hc-source-badge">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
      📖 Page ${sources[0].page}
    </div>`;
  }
  // Always use .hc-ai-text wrapper for consistency (typewriter or not)
  const bodyContent = typewrite ? '' : homeMarkdown(text);
  const actsHtml = `
    <div class="msg-acts" style="margin-top:8px;">
      <button class="msg-act" onclick="homeCopyMsg(this,this.closest('.hc-ai'))" title="Copy">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy
      </button>
      <button class="msg-act msg-act--thumb" data-type="positive" onclick="homeFeedback(this,'positive')" title="Helpful">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
      </button>
      <button class="msg-act msg-act--thumb" data-type="negative" onclick="homeFeedback(this,'negative')" title="Not helpful">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
      </button>
      <button class="msg-act" onclick="_homeRegenerate(this.closest('.hc-ai'))" title="Retry">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.67"/></svg> Retry
      </button>
    </div>`;
  wrap.innerHTML = `
    <div class="hc-ai-body"><div class="hc-ai-text">${bodyContent}</div>${sourceBadge}${actsHtml}</div>`;
  document.getElementById('home-chat-history').appendChild(wrap);
  homeScrollBottom();
  return wrap;
}

export function homeCopyMsg(btn, wrapEl) {
  const textEl = wrapEl?.querySelector('.hc-ai-text');
  if (!textEl) return;
  navigator.clipboard?.writeText(textEl.innerText).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2000);
  }).catch(() => {
    showToast('⚠', 'Could not copy — check browser permissions', 'var(--red)');
  });
}

export function homeFeedback(btn, type) {
  const wrap = btn.closest('.hc-ai');
  if (!wrap) return;
  const histIdx = parseInt(wrap.dataset.histIdx ?? '-1');
  const entry = (histIdx >= 0 && histIdx < homeHistory.length) ? homeHistory[histIdx] : null;
  const current = entry?.feedback ?? null;
  const next = current === type ? null : type;
  wrap.querySelectorAll('.msg-act--thumb').forEach(b => b.classList.remove('active'));
  if (next) btn.classList.add('active');
  if (entry) {
    entry.feedback = next;
    if (_homeSessionId) window._saveSession?.(_homeSessionId, homeHistory);
  }
}

export async function _homeRegenerate(aiWrapEl) {
  if (homeIsTyping) return;
  const histIdx = parseInt(aiWrapEl?.dataset.histIdx ?? '-1');
  const question = (histIdx > 0 ? homeHistory[histIdx - 1]?.content : null) || '';
  if (!question) return;

  aiWrapEl.remove();
  if (homeHistory.length && homeHistory[homeHistory.length - 1].role === 'assistant') {
    homeHistory.pop();
  }

  homeIsTyping = true;
  _homeAbortController = new AbortController();
  const { signal } = _homeAbortController;
  homeAppendThinking(false);
  _thinkStart = Date.now();
  _homeSetGenerating(document.getElementById('home-send-btn'), true);
  _homeSetGenerating(document.getElementById('home-send-btn-bottom'), true);

  const sessionSbId = _homeSessionId ? (lsGet('chunks_session_' + _homeSessionId)?.supabaseId ?? null) : null;

  try {
    const res = await fetch(`${API_BASE}/ask`, {
      method: 'POST',
      signal,
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
        ...(_homeThinking === 'think' ? { thinking: 'thinking' } : {}),
        ...(_homeThinking === 'deep'  ? { thinking: 'deep'     } : {}),
      }),
    });

    if (!res.ok) {
      homeRemoveThinking();
      const err = await res.json().catch(() => ({}));
      homeAppendError(err.error || `Error ${res.status}`);
    } else {
      const data = await res.json();
      const { answer, thinkingContent: clientThinking } = extractThinkBlock(data.answer || '');
      const cleanAnswer = answer || 'No response.';
      const thinkingContent = data.thinking_content || clientThinking || null;
      const elapsed = Math.round((Date.now() - _thinkStart) / 1000);
      await homeAppendThinkingAccordion(thinkingContent, elapsed, _homeThinking);

      const aiWrap = homeAppendAI(cleanAnswer, null, { typewrite: true });
      const textEl = aiWrap?.querySelector('.hc-ai-text');
      if (textEl) {
        await typewriteResponse(textEl, cleanAnswer, {
          render: homeMarkdown,
          onScroll: homeScrollBottom,
          isCancelled: () => signal.aborted,
        });
      }

      homeHistory.push({ role: 'assistant', content: cleanAnswer });
      if (aiWrap) aiWrap.dataset.histIdx = String(homeHistory.length - 1);
      if (_homeSessionId) {
        window._saveSession?.(_homeSessionId, homeHistory);
        if (sessionSbId) {
          ChunksDB.messages.insertMessage({ role: 'assistant', content: cleanAnswer, sessionId: sessionSbId });
        }
      }
    }
  } catch (e) {
    if (e?.name !== 'AbortError') {
      homeRemoveThinking();
      homeAppendError('Could not reach the server. Check your connection.');
    } else {
      homeRemoveThinking();
    }
  } finally {
    homeIsTyping = false;
    _homeAbortController = null;
    _homeSetGenerating(document.getElementById('home-send-btn'), false);
    _homeSetGenerating(document.getElementById('home-send-btn-bottom'), false);
  }
}

/**
 * Finalize the ThinkingAccordion with actual thinking content.
 * Replaces the streaming accordion with one that animates the real steps.
 *
 * @param {string|null} thinkingContent  Raw `<think>` content returned by the backend.
 * @param {number}      elapsed          Seconds elapsed while the model was thinking.
 * @param {'think'|'deep'} thinkingMode  Active thinking mode.
 */
export async function homeAppendThinkingAccordion(thinkingContent, elapsed, thinkingMode) {
  // Clean up any existing streaming accordion handle
  if (_homeThinkingHandle) {
    _homeThinkingHandle.unmount();
    _homeThinkingHandle = null;
  }

  // If the streaming wrap still exists, repurpose it for the real accordion
  let wrap;
  if (_homeThinkingWrap) {
    wrap = _homeThinkingWrap;
    wrap.removeAttribute('id');
    // Re-wrap as a thinking-accordion container instead of an AI message
    wrap.className = 'hc-thinking-accordion-wrap';
    wrap.innerHTML = '';
    _homeThinkingWrap = null;
  } else {
    wrap = document.createElement('div');
    wrap.className = 'hc-thinking-accordion-wrap';
    document.getElementById('home-chat-history').appendChild(wrap);
  }

  // When the model produced no thinking content, remove the placeholder silently
  if (!thinkingContent) {
    wrap.remove();
    homeScrollBottom();
    return;
  }
  const container = document.createElement('div');
  wrap.appendChild(container);
  const accordionHandle = createThinkingAccordion(container, { thinkingText: thinkingContent, elapsed, isStreaming: false });
  homeScrollBottom();

  // animationDone resolves immediately (no animation), then the accordion is
  // already auto-collapsed.  Await it so callers get the expected Promise.
  await accordionHandle.animationDone;
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
  if (!instant && _homeUserScrolled) return;
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
  if (homeIsTyping) { homeStopGeneration(); return; }
  if (!guestGate('general')) return; // guest limit check
  _homeUserScrolled = false; // allow auto-scroll for the new response
  // Mark that the user is actively in this session — prevents sync from overwriting mid-conversation
  _homeLastInputTime = Date.now();
  const bar = document.getElementById('home-input-bar');
  const chatActive = bar && bar.style.display !== 'none';
  const inp     = document.getElementById(chatActive ? 'home-ask-input-bottom' : 'home-ask-input');

  const question  = inp.value.trim();
  // Capture image attachments before anything async clears them
  const imageAtts = ws.homeAttachments.filter(a => a.type === 'image');
  const imageAtt  = imageAtts[0] || null; // use first image for vision API

  if (!question && !imageAtt) return;

  // On the FIRST message of a session: create a recent entry which
  // also sets window._homeSessionId via recentAdd → _saveRecent.
  // We must call recentAdd BEFORE appending to homeHistory so the
  // session id is assigned before the first _saveSession call below.
  if (!_homeSessionId) {
    window.recentAdd?.(question || _IMAGE_ONLY_LABEL, null, 'general');
    // recentAdd sets window._homeSessionId via the index.html closure;
    // read it back so this module's local var is in sync.
    if (window._homeSessionId) _homeSessionId = window._homeSessionId;
  }

  homeHideLanding();
  homeAppendUser(question, imageAtts);
  inp.value = '';
  inp.style.height = '24px';
  setTimeout(() => document.getElementById('home-ask-input-bottom')?.focus(), 60);

  // Clear image attachments now that we've captured them for the request
  ws.homeAttachments = ws.homeAttachments.filter(a => a.type !== 'image');
  _homeRenderPreview();

  homeHistory.push({ role: 'user', content: question || _IMAGE_ONLY_LABEL, ...(imageAtt ? { imageDataUrl: imageAtt.dataUrl } : {}) });
  recordUsage('general'); // track guest usage
  renderUsageBar('home-input-area', 'general'); // show counter near input

  // Save immediately so refresh before AI responds still restores the chat.
  // _homeSessionId is now guaranteed to be set (created above if new).
  // Resolve the supabaseId once here — _saveSession writes it synchronously
  // into IDB/localStorage, so it is readable immediately via lsGet.
  // Both dual-write calls (user + assistant) reuse this value.
  let sessionSbId = null;
  if (_homeSessionId) {
    window._saveSession?.(_homeSessionId, homeHistory);
    localStorage.setItem('chunks_active_home_session', _homeSessionId);
    window._renderAllRecent?.();
    sessionSbId = lsGet('chunks_session_' + _homeSessionId)?.supabaseId ?? null;
    if (sessionSbId) {
      // Persist the UUID so session restore can find it even after chunks_session_* cleanup.
      localStorage.setItem('chunks_active_home_supabase_id', sessionSbId);
      ChunksDB.messages.insertMessage({ role: 'user', content: question || _IMAGE_ONLY_LABEL, sessionId: sessionSbId });
      // Subscribe to realtime for this session (no-op if already subscribed to same id).
      subscribeToHomeMessages(sessionSbId);
    }
  }

  homeIsTyping = true;
  _homeAbortController = new AbortController();
  const { signal } = _homeAbortController;
  homeAppendThinking(!!imageAtt);
  _thinkStart = Date.now();
  // Update both buttons — homeHideLanding() may have swapped which one is visible
  _homeSetGenerating(document.getElementById('home-send-btn'), true);
  _homeSetGenerating(document.getElementById('home-send-btn-bottom'), true);

  try {
    let res;
    if (imageAtt) {
      // ── Vision path: route to /ask-image ─────────────────────────────────
      const imgB64 = imageAtt.dataUrl.split(',')[1] || '';
      const complexity = (() => { const m = _getStudyMode?.() || 'balanced'; return m === 'concise' ? 3 : m === 'detailed' ? 8 : 5; })();
      res = await fetch(`${API_BASE}/ask-image`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} },
        body: JSON.stringify({
          image_b64:  imgB64,
          image_type: imageAtt.file.type || 'image/jpeg',
          question:   question || 'Describe this image.',
          complexity,
        }),
      });
      homeRemoveThinking(); // vision endpoint has no thinking mode — remove indicator now
    } else {
      // ── Text path: route to /ask ──────────────────────────────────────────
      res = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        signal,
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

      // Preserve the thinking wrap regardless of mode — homeAppendThinkingAccordion
      // will repurpose it with real steps or silently remove it if none found.
    }

    if (!res.ok) {
      homeRemoveThinking(); // clean up on error
      const err = await res.json().catch(() => ({}));
      homeAppendError(err.error || `Error ${res.status}`);
      homeHistory.pop();
    } else {
      const data   = await res.json();

      // ── Client-side <think> extraction (safety net if backend missed it) ──
      const { answer, thinkingContent: clientThinking } = extractThinkBlock(data.answer || '');
      const cleanAnswer     = answer || 'No response.';
      const thinkingContent = data.thinking_content || clientThinking || null;

      if (!imageAtt) {
        const elapsed = Math.round((Date.now() - _thinkStart) / 1000);
        // Finalize the thinking wrap (shows accordion with steps, or silently
        // removes the placeholder when the model returned no thinking content).
        // Await animation so accordion collapses before the AI response starts.
        await homeAppendThinkingAccordion(thinkingContent, elapsed, _homeThinking);
      }

      // ── Typewriter: render AI response word by word ──
      const aiWrap = homeAppendAI(cleanAnswer, null, { typewrite: true });
      const textEl = aiWrap?.querySelector('.hc-ai-text');
      if (textEl) {
        await typewriteResponse(textEl, cleanAnswer, {
          render: homeMarkdown,
          onScroll: homeScrollBottom,
          isCancelled: () => signal.aborted,
        });
      }

      homeHistory.push({ role: 'assistant', content: cleanAnswer });
      if (aiWrap) aiWrap.dataset.histIdx = String(homeHistory.length - 1);
      // Overwrite with full exchange (user + AI)
      if (_homeSessionId) {
        window._saveSession?.(_homeSessionId, homeHistory);
        localStorage.setItem('chunks_active_home_session', _homeSessionId);
        window._renderAllRecent?.();
        // Dual-write assistant turn to the per-row messages table.
        if (sessionSbId) {
          ChunksDB.messages.insertMessage({ role: 'assistant', content: cleanAnswer, sessionId: sessionSbId });
        }
      }
    }
  } catch (e) {
    if (e?.name === 'AbortError') {
      homeRemoveThinking();
      // Keep whatever text has already been rendered — do not pop history here
    } else {
      homeRemoveThinking();
      homeAppendError('Could not reach the server. Check your connection.');
      homeHistory.pop();
    }
  } finally {
    homeIsTyping = false;
    _homeAbortController = null;
    const topSendBtn    = document.getElementById('home-send-btn');
    const bottomSendBtn = document.getElementById('home-send-btn-bottom');
    _homeSetGenerating(topSendBtn, false);
    _homeSetGenerating(bottomSendBtn, false);
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
    history.forEach((msg, idx) => {
      if (msg.role === 'user') {
        const hasImage = msg.imageDataUrl && /^data:image\/[a-zA-Z+]+;base64,/.test(msg.imageDataUrl);
        if (hasImage) {
          const imgBubble = document.createElement('div');
          imgBubble.className = 'hc-user';
          const wrap = document.createElement('div');
          wrap.className = 'chat-img-wrap';
          wrap.onclick = () => window.openImgLightbox?.(wrap);
          const img = document.createElement('img');
          img.src = msg.imageDataUrl; img.alt = 'attached image';
          wrap.appendChild(img);
          imgBubble.appendChild(wrap);
          chatHist.appendChild(imgBubble);
        }
        const text = (msg.content || '').replace(/\n\[Attached:[^\]]*\]/g, '').trim();
        const skipText = hasImage && text === _IMAGE_ONLY_LABEL;
        if (text && !skipText) {
          const el = document.createElement('div');
          el.className = 'hc-user';
          el.textContent = text;
          chatHist.appendChild(el);
        }
      } else if (msg.role === 'assistant') {
        const wrap = homeAppendAI(msg.content || '', null, { typewrite: false });
        if (wrap) {
          wrap.dataset.histIdx = String(idx);
          // Restore saved feedback active state
          if (msg.feedback) {
            const thumbBtn = wrap.querySelector(`.msg-act--thumb[data-type="${msg.feedback}"]`);
            if (thumbBtn) thumbBtn.classList.add('active');
          }
        }
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

    if (history.length && chatHist) {
      // Prefer history-based render so images stored as base64 in imageDataUrl survive refresh
      _renderFromHistory(history);
    } else if (session.html && chatHist) {
      // Fallback: use cached HTML when no history array is available
      chatHist.innerHTML = sanitize(session.html);
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
  window._homeMountSession = _mountSession;

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
  setTimeout(async function restoreSession() {
    try {
      // Phase 3: try the stored supabaseId first (written on every message send).
      // This avoids scanning IDB/localStorage entirely when the UUID is known.
      let supabaseId = localStorage.getItem('chunks_active_home_supabase_id') || null;
      let localSessionId = localStorage.getItem('chunks_active_home_session') || null;

      // Fallback: scan IDB/localStorage to find the newest session and its supabaseId.
      // This path handles the first login after Phase 2 (before any message has been
      // sent from this device to populate chunks_active_home_supabase_id).
      if (!supabaseId) {
        let newest = null;
        let newestTime = 0;
        const sessionKeys = idbKeys('chunks_session_');
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith('chunks_session_') && !sessionKeys.includes(k)) sessionKeys.push(k);
        }
        for (const k of sessionKeys) {
          let s;
          try { s = lsGet(k); } catch (_) { continue; }
          if (!s) continue;
          if (!s.history && s.messages) s.history = s.messages;
          const history = s?.history || [];
          if (!history.length) continue;
          const localId = k.replace('chunks_session_', '');
          const isLocalKey = /^r[0-9]+$/.test(localId);
          const t = new Date(s.updatedAt || 0).getTime();
          if (t > newestTime || (t === newestTime && isLocalKey)) {
            newestTime = t;
            newest = { s, id: localId };
          }
        }
        if (newest) {
          localSessionId = newest.id;
          supabaseId     = newest.s?.supabaseId ?? null;
          localStorage.setItem('chunks_active_home_session', newest.id);
          if (supabaseId) localStorage.setItem('chunks_active_home_supabase_id', supabaseId);
        }
      }

      if (!supabaseId) return; // no session found anywhere — stay on landing

      // Phase 3: Supabase is the authoritative source — no localStorage fallback.
      const { data: sbMsgs, source } = await ChunksDB.messages.loadSession(supabaseId);
      if (source === 'supabase' && sbMsgs?.length) {
        console.log('[HomeScreen] restoreSession — using Supabase messages for session', localSessionId);
        const sbHistory = sbMsgs.map(m => ({ role: m.role, content: m.content, ts: new Date(m.created_at).getTime() }));
        // Reconstruct a minimal session descriptor so _mountSession can work.
        const sessionDesc = localSessionId ? (lsGet('chunks_session_' + localSessionId) ?? {}) : {};
        _mountSession({ ...sessionDesc, history: sbHistory }, localSessionId ?? supabaseId);
        // Start realtime subscription for this session (subscribeToHomeMessages
        // cleans up any previous channel internally before subscribing).
        subscribeToHomeMessages(supabaseId);
      } else {
        console.log('[HomeScreen] restoreSession — Supabase empty for session', localSessionId, '— leaving fast-path restore');
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

  // ── Free-scroll: detect manual scrolling in the chat area ────────────────
  const scrollArea = document.getElementById('home-scroll-area');
  if (scrollArea) {
    scrollArea.addEventListener('scroll', function() {
      const atBottom = this.scrollHeight - this.scrollTop - this.clientHeight < 100;
      _homeUserScrolled = !atBottom;
    });
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
  set: (v) => {
    _homeSessionId = v;
    // Unsubscribe from realtime when the session is cleared (goHome / newChat).
    if (v === null) unsubscribeHomeMessages();
  },
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
