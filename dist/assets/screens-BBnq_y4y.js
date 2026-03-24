import{A as he}from"./lib-D9k5HLl1.js";import{g as Ye,r as Xe,a as ut,s as gt,d as mt,l as yt,b as ft,c as bt,f as xt}from"./state-DPlFcyCg.js";const wt=`
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
`,Re=[{h:"Study smarter,<br>not <em>harder</em>",s:"Ask questions, explore your textbooks, and generate study tools — all in one place."},{h:"Learn faster,<br>remember <em>longer</em>",s:"Your AI-powered study companion that turns difficult concepts into clear understanding."},{h:"Knowledge is<br>your <em>superpower</em>",s:"Ask anything, study everything — Chunks AI has your back every step of the way."},{h:"Stop cramming,<br>start <em>understanding</em>",s:"Deep learning, not surface memorization. Let Chunks AI guide you to real mastery."},{h:"Every expert<br>was once a <em>beginner</em>",s:"Break down complex topics, one question at a time. Your journey starts here."},{h:"Your grades,<br>your <em>future</em>",s:"Study with purpose. Chunks AI helps you focus on what matters most."},{h:"Turn confusion<br>into <em>clarity</em>",s:"No question is too hard. Chunks AI breaks it down until it clicks."},{h:"Ace your exams,<br>own your <em>success</em>",s:"Flashcards, summaries, practice questions — everything you need, all in one place."}],Me='<div class="hc-ai-avatar"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="#c8a84b" stroke-width="7" opacity="0.95"/><ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="#a855f7" stroke-width="7" transform="rotate(60 50 50)" opacity="0.85"/><ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="#c8a84b" stroke-width="7" transform="rotate(120 50 50)" opacity="0.75"/><circle cx="50" cy="50" r="6" fill="#e8ac2e"/></svg></div>';let ie=!1,J="off",_=[],A=null,we=!1,U=[],ke=!1;function kt(){const t=document.getElementById("incognito-modal");if(!t)return;U=[];const e=document.getElementById("incognito-messages");e&&(e.innerHTML=`
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
        <h2 class="incognito-hero-heading">You’re incognito</h2>
      </div>`);const i=document.getElementById("incognito-input");i&&(i.value="",i.style.height="auto"),t.classList.add("active"),setTimeout(()=>document.getElementById("incognito-input")?.focus(),80)}function Je(){const t=document.getElementById("incognito-modal");t&&(t.classList.remove("active"),U=[])}function Et(t){t.style.height="auto",t.style.height=t.scrollHeight+"px"}function ue(){const t=document.getElementById("incognito-messages");t&&(t.scrollTop=t.scrollHeight)}function ge(){const t=document.getElementById("incognito-messages");if(!t)return null;let e=t.querySelector(".incognito-messages-inner");return e||(e=document.createElement("div"),e.className="incognito-messages-inner",t.appendChild(e)),e}function St(t){document.getElementById("incognito-empty")?.remove();const e=ge();if(!e)return;const i=document.createElement("div");i.className="incognito-msg incognito-msg-user",i.textContent=t,e.appendChild(i),ue()}function Bt(){const t=ge();if(!t)return;const e=document.createElement("div");e.className="incognito-msg incognito-msg-ai",e.id="incognito-thinking",e.innerHTML=`
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
    </div>`,t.appendChild(e),ue()}function De(){document.getElementById("incognito-thinking")?.remove()}function Ct(t){const e=ge();if(!e)return;const i=document.createElement("div");i.className="incognito-msg incognito-msg-ai",i.innerHTML=`
    <div class="incognito-ai-row">
      <div class="incognito-ai-ava" aria-hidden="true">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/>
          <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
        </svg>
      </div>
      <div class="incognito-ai-body">${window.homeMarkdown?.(t)??t.replace(/</g,"&lt;")}</div>
    </div>`,e.appendChild(i),ue()}function Ne(t){const e=ge();if(!e)return;const i=document.createElement("div");i.className="incognito-msg incognito-msg-error",i.textContent="⚠ "+t,e.appendChild(i),ue()}async function Ke(){if(ke)return;const t=document.getElementById("incognito-input"),e=document.getElementById("incognito-send-btn"),i=t?.value?.trim();if(i){t.value="",t.style.height="auto",St(i),U.push({role:"user",content:i}),ke=!0,e&&(e.disabled=!0),Bt();try{const o=await fetch(`${he}/ask`,{method:"POST",headers:{"Content-Type":"application/json",...await window._getAuthHeader?.()??{}},body:JSON.stringify({question:i,bookId:"",mode:"general",task_type:"home_general",complexity:(()=>{const s=window._getStudyMode?.()||"balanced";return s==="concise"?3:s==="detailed"?8:5})(),language:localStorage.getItem("chunks_setting_language")||"Auto-detect",safe_content:localStorage.getItem("chunks_setting_safe-content")==="1",history:U.slice(-12)})});if(De(),o.ok){const n=(await o.json()).answer||"No response.";Ct(n),U.push({role:"assistant",content:n})}else{const s=await o.json().catch(()=>({}));Ne(s.error||`Error ${o.status}`),U.pop()}}catch{De(),Ne("Could not reach the server. Check your connection."),U.pop()}finally{ke=!1,e&&(e.disabled=!1),setTimeout(()=>t?.focus(),60)}}}function It(){const t=document.getElementById("incognito-input");t&&(t.addEventListener("keydown",e=>{e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),Ke())}),t.addEventListener("input",function(){Et(this)}))}function Tt(){const t=document.getElementById("incognito-modal");t&&t.addEventListener("click",e=>{e.target===t&&Je()})}function Mt(){const t=document.querySelector("[data-home-screen]");if(!t){console.warn("[HomeScreen] placeholder [data-home-screen] not found");return}t.outerHTML=wt;const e=Re[Math.floor(Math.random()*Re.length)],i=document.getElementById("home-hero-heading"),o=document.getElementById("home-hero-sub");i&&(i.innerHTML=e.h),o&&(o.textContent=e.s),It(),Tt()}function Lt(t){document.getElementById("book-chip")?.classList.toggle("active",t==="book"),document.getElementById("general-chip")?.classList.toggle("active",t==="general")}function Ze(t){const e=document.getElementById("home-input-bar"),i=e&&e.style.display!=="none",o=document.getElementById(i?"home-ask-input-bottom":"home-ask-input");o&&(o.value=t,o.focus(),de(o))}function zt(t){const e=t.files[0];if(!e)return;const i=e.name.replace(/\.pdf$/i,"");window._uploadedPdfFile=e,window._uploadedPdfName=i,window.wsShowToast?.("📄",`"${i}" ready to chat`,""),Ze(`Summarize "${i}" for me`),t.value=""}function de(t){t.style.height="auto",t.style.height=Math.min(t.scrollHeight,160)+"px";const e=t.closest(".ask-box");e&&e.classList.toggle("is-multiline",t.scrollHeight>30)}function et(t){const e=document.createElement("div");e.className="hc-user",e.textContent=t,document.getElementById("home-chat-history").appendChild(e),ee()}function tt(){const t=document.createElement("div");t.className="hc-ai",t.id="hc-thinking",t.innerHTML=`
    ${Me}
    <div class="hc-ai-body">
      <div style="display:flex;align-items:center;gap:10px;padding:3px 0;">
        <div class="hc-thinking"><span></span><span></span><span></span></div>
        <span id="home-thinking-label" class="hc-thinking-label">Thinking…</span>
      </div>
    </div>`,document.getElementById("home-chat-history").appendChild(t),ee();const e=["Thinking…","Analyzing concept…","Reading context…","Generating explanation…"];let i=0;t._labelTimer=setInterval(()=>{const o=document.getElementById("home-thinking-label");o&&(o.style.opacity="0",setTimeout(()=>{i=(i+1)%e.length,o.textContent=e[i],o.style.opacity=""},280))},2400)}function Be(){const t=document.getElementById("hc-thinking");t&&(clearInterval(t._labelTimer),t.remove())}function it(t,e){const i=document.createElement("div");i.className="hc-ai";let o="";e&&e.length>0&&(o=`<div class="hc-source-badge">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
      📖 Page ${e[0].page}
    </div>`),i.innerHTML=`
    ${Me}
    <div class="hc-ai-body">${window.homeMarkdown(t)}${o}</div>`,document.getElementById("home-chat-history").appendChild(i),ee()}function Ce(t){const e=document.createElement("div");e.className="hc-error",e.textContent="⚠ "+t,document.getElementById("home-chat-history").appendChild(e),ee()}function ee(t=!1){const e=document.getElementById("home-scroll-area");e&&(t?(e.style.scrollBehavior="auto",e.scrollTop=e.scrollHeight,e.style.scrollBehavior=""):e.scrollTop=e.scrollHeight)}function st(){const t=document.getElementById("home-landing"),e=document.querySelector(".home-hero"),i=document.getElementById("home-input-bar"),o=document.getElementById("home-scroll-area");t&&(t.style.display="none"),e&&(e.style.display="none"),i&&(i.style.display="flex"),o&&(o.style.justifyContent="flex-start"),setTimeout(()=>{document.getElementById("home-ask-input-bottom")?.focus()},50)}function At(){ie=!ie,["home-websearch-check","home-websearch-check-b"].forEach(t=>{const e=document.getElementById(t);e&&e.classList.toggle("on",ie)}),["home-toggle-websearch"].forEach(t=>{const e=document.getElementById(t);e&&e.classList.toggle("active",ie)})}function _t(t){J=J===t?"off":t;const e=J==="think",i=J==="deep";["home-think-check","home-think-check-b"].forEach(o=>{const s=document.getElementById(o);s&&s.classList.toggle("on",e)}),["home-deep-check","home-deep-check-b"].forEach(o=>{const s=document.getElementById(o);s&&s.classList.toggle("on",i)}),["home-toggle-think"].forEach(o=>{const s=document.getElementById(o);s&&s.classList.toggle("active",e)}),["home-toggle-deep"].forEach(o=>{const s=document.getElementById(o);s&&s.classList.toggle("active",i)})}async function Ie(){if(we||!Ye("general"))return;window._homeLastInputTime=Date.now();const t=document.getElementById("home-input-bar"),e=t&&t.style.display!=="none",i=document.getElementById(e?"home-ask-input-bottom":"home-ask-input"),o=document.getElementById(e?"home-send-btn-bottom":"home-send-btn"),s=i.value.trim();if(s){A||(window.recentAdd?.(s,null,"general"),window._homeSessionId&&(A=window._homeSessionId)),st(),et(s),i.value="",i.style.height="24px",setTimeout(()=>document.getElementById("home-ask-input-bottom")?.focus(),60),_.push({role:"user",content:s}),Xe("general"),ut("home-input-area","general"),A&&(window._saveSession?.(A,_),localStorage.setItem("chunks_active_home_session",A),window._renderAllRecent?.()),we=!0,tt(),o&&(o.disabled=!0);try{const n=await fetch(`${he}/ask`,{method:"POST",headers:{"Content-Type":"application/json",...await window._getAuthHeader?.()??{}},body:JSON.stringify({question:s,bookId:"",mode:"general",task_type:"home_general",complexity:(()=>{const a=window._getStudyMode?.()||"balanced";return a==="concise"?3:a==="detailed"?8:5})(),language:localStorage.getItem("chunks_setting_language")||"Auto-detect",safe_content:localStorage.getItem("chunks_setting_safe-content")==="1",history:_.slice(-12),...ie?{web_search:!0}:{},...J==="think"?{thinking:"thinking"}:{},...J==="deep"?{thinking:"deep"}:{}})});if(Be(),n.ok){const r=(await n.json()).answer||"No response.";it(r,null),_.push({role:"assistant",content:r}),A&&(window._saveSession?.(A,_),localStorage.setItem("chunks_active_home_session",A),window._renderAllRecent?.())}else{const a=await n.json().catch(()=>({}));Ce(a.error||`Error ${n.status}`),_.pop()}}catch{Be(),Ce("Could not reach the server. Check your connection."),_.pop()}finally{we=!1,o&&(o.disabled=!1)}}}Mt();(function(){if(!(sessionStorage.getItem("chunks_is_refresh")==="1"||sessionStorage.getItem("chunks_was_here")==="1"))return;const i=sessionStorage.getItem("chunks_active_screen");if(i==="workspace"||!i&&localStorage.getItem("chunks_active_ws_book")||i&&i!=="home")return;function o(a){const r=document.getElementById("home-chat-history");!r||!a?.length||(r.innerHTML="",a.forEach(l=>{if(l.role==="user"){const v=document.createElement("div");v.className="hc-user",v.textContent=l.content||"",r.appendChild(v)}else if(l.role==="assistant"){const v=document.createElement("div");v.className="hc-ai";const c=window.homeMarkdown?window.homeMarkdown(l.content||""):(l.content||"").replace(/</g,"&lt;");v.innerHTML=`${Me}<div class="hc-ai-body">${c}</div>`,r.appendChild(v)}}))}function s(a,r){const l=a?.history||a?.messages||[];if(!l.length&&!a?.html)return;const v=document.getElementById("home-landing"),c=document.querySelector(".home-hero"),h=document.getElementById("home-input-bar"),w=document.getElementById("home-scroll-area"),y=document.getElementById("home-chat-history");v&&(v.style.display="none"),c&&(c.style.display="none"),h&&(h.style.display="flex"),w&&(w.style.justifyContent="flex-start"),a.html&&y?y.innerHTML=window.sanitize?.(a.html)??a.html:l.length&&y&&o(l),_=l,A=r,window._setActiveRecent?.(r),setTimeout(()=>ee(!0),80)}window._homeMountSession=s;const n=localStorage.getItem("chunks_active_home_session");if(n&&!(i&&i!=="home"))try{const a=JSON.parse(localStorage.getItem("chunks_session_"+n));a&&s(a,n)}catch{}})();let Oe=0;window.addEventListener("chunks:sessions-ready",function(){if(console.log("[HomeScreen] chunks:sessions-ready fired, homeHistory.length=",_.length),A&&Date.now()-(window._homeLastInputTime||0)<12e4)return;const i=Date.now();i-Oe<3e3||(Oe=i,setTimeout(function(){try{let s=null,n=0;for(let a=0;a<localStorage.length;a++){const r=localStorage.key(a);if(!r?.startsWith("chunks_session_"))continue;let l;try{l=JSON.parse(localStorage.getItem(r))}catch{continue}if(!l.history&&l.messages&&(l.history=l.messages),!(l?.history||[]).length)continue;const c=r.replace("chunks_session_",""),h=/^r[0-9]+$/.test(c),w=new Date(l.updatedAt||0).getTime();(w>n||w===n&&h)&&(n=w,s={s:l,id:c})}s&&(localStorage.setItem("chunks_active_home_session",s.id),window._homeMountSession?.(s.s,s.id))}catch{}},100))});window._homeMountLatestSession=function(){window.dispatchEvent(new CustomEvent("chunks:sessions-ready"))};function Fe(){document.getElementById("home-ask-input")?.addEventListener("keydown",function(e){e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),Ie())}),document.getElementById("home-ask-input")?.addEventListener("input",function(){de(this)});const t=document.getElementById("home-ask-input-bottom");t&&(t.addEventListener("keydown",function(e){e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),Ie())}),t.addEventListener("input",function(){de(this)}))}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",Fe):Fe();window.homeSetMode=Lt;window.homeSetInput=Ze;window.homeHandlePdfUpload=zt;window.homeAutoResize=de;window.homeAppendUser=et;window.homeAppendThinking=tt;window.homeRemoveThinking=Be;window.homeAppendAI=it;window.homeAppendError=Ce;window.homeScrollBottom=ee;window.homeHideLanding=st;window.homeSendMessage=Ie;window.homeToggleWebSearch=At;window.homeToggleThinking=_t;window.openIncognitoChat=kt;window.closeIncognitoChat=Je;window.incognitoSendMessage=Ke;Object.defineProperty(window,"homeHistory",{get:()=>_,set:t=>{_=t},configurable:!0});Object.defineProperty(window,"_homeSessionId",{get:()=>A,set:t=>{A=t},configurable:!0});(function(){if(sessionStorage.getItem("chunks_guest_mode")!=="1")return;const e=document.getElementById("home-landing");if(!e||document.getElementById("home-guest-banner"))return;const i=document.createElement("div");i.id="home-guest-banner",i.style.cssText="display:flex;align-items:center;gap:10px;background:color-mix(in srgb,var(--gold,#f59e0b) 10%,var(--surface-2,#1e1e2e));border:1px solid color-mix(in srgb,var(--gold,#f59e0b) 25%,transparent);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--text-2,#aaa);margin:12px auto 0;max-width:560px;width:calc(100% - 32px);",i.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;opacity:.7"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg><span>You're in guest mode — chats won't be saved. <a href="#" onclick="sessionStorage.removeItem('chunks_guest_mode');window.openAuthModal?.();return false;" style="color:var(--gold,#f59e0b);text-decoration:none;font-weight:500;">Sign in</a> to keep your history.</span>`,e.appendChild(i)})();console.log("[HomeScreen] module loaded ✦");const Pt=`
<div class="screen" id="screen-workspace">

  <!-- Mobile workspace topbar (hidden on desktop) -->
  <div class="mobile-ws-topbar" style="display:none;">
    <button type="button" class="mwt-back" data-action="goHome" aria-label="Back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <div class="mwt-title-block">
      <div class="mwt-title" id="mwt-book-name">Study Workspace</div>
      <div class="mwt-subtitle" id="mwt-book-sub">Select a book to begin</div>
    </div>
    <!-- Chat / PDF toggle pill -->
    <div class="mwt-view-toggle">
      <button type="button" class="mwt-vtab active" id="mwt-tab-chat" data-action="wsMobileView" data-view="chat" aria-label="Chat view">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>Chat</span>
      </button>
      <button type="button" class="mwt-vtab" id="mwt-tab-pdf" data-action="wsMobileView" data-view="pdf" aria-label="PDF view">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        <span>PDF</span>
      </button>
    </div>
    <button type="button" class="mwt-library" data-action="openLibraryModal" aria-label="Open library">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
    </button>
  </div>
  <aside class="sidebar" data-sidebar-screen="workspace"></aside>

  <!-- PDF Panel -->
  <section class="pdf-panel">
    <div class="pdf-bar">
      <!-- Left: hamburger -->
      <button class="icon-btn" title="Toggle contents" data-action="togglePdfOutline" style="margin-right:4px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>

      <!-- Title block -->
      <div class="pdf-title-block">
        <div class="pdf-book-icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg></div>
        <span class="pdf-book-name" id="ws-book-name">No book loaded</span>
        <span class="pdf-chapter" id="ws-book-author"></span>
      </div>

      <!-- Page nav group -->
      <div class="page-nav">
        <button class="icon-btn" id="btn-prev-page" data-action="wsPrevPage" title="Previous page"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg></button>
        <span class="page-badge" id="ws-page-badge" title="Click to jump to page" data-action="wsJumpToPage" style="cursor:pointer;">1 / 1</span>
        <button class="icon-btn" id="btn-next-page" data-action="wsNextPage" title="Next page"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg></button>
      </div>

      <div class="bar-sep"></div>

      <!-- Zoom group -->
      <div style="display:flex;align-items:center;gap:2px;">
        <button class="icon-btn" id="btn-zoom-out" data-action="wsZoomOut" title="Zoom out"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="8" x2="14" y1="11" y2="11"/></svg></button>
        <span id="ws-zoom-badge" style="font-size:10px;font-family:var(--font-mono);color:var(--text-4);min-width:32px;text-align:center;user-select:none;">100%</span>
        <button class="icon-btn" id="btn-zoom-in"  data-action="wsZoomIn"  title="Zoom in"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg></button>
      </div>

      <div class="bar-sep"></div>

      <!-- Actions group -->
      <div style="display:flex;align-items:center;gap:2px;">
        <button class="icon-btn accent" title="Search"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>
        <button class="icon-btn violet" title="AI Chat"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2a8 8 0 0 0-8 8 8 8 0 0 0 4.4 7.1L6 22l4.8-2.2A8 8 0 1 0 12 2z"/></svg></button>
      </div>

      <div class="bar-sep"></div>

      <!-- Library button -->
      <button class="icon-btn" id="ws-open-lib-btn" data-action="openLibraryModal" title="Library"
        style="width:32px;height:32px;color:var(--text-3);background:transparent;border:1px solid transparent;border-radius:var(--r-sm);flex-shrink:0;transition:color var(--t-fast),background var(--t-fast),border-color var(--t-fast);">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
      </button>
    </div>

    <div class="pdf-body">
      <nav class="pdf-outline-panel" id="ws-outline-panel">
        <!-- Book cover thumbnail -->
        <div id="ws-outline-cover" style="display:none;padding:12px 12px 0;">
          <img id="ws-outline-cover-img"
            style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:6px;display:block;border:1px solid var(--border-xs);"
            src="" alt=""
            onerror="this.parentElement.style.display='none'">
        </div>
        <div class="outline-head">Contents</div>
        <div id="ws-outline-items">
          <div style="padding:20px 16px;font-size:11px;color:var(--text-4);font-style:italic;line-height:1.6;">Open a book to see contents</div>
        </div>
      </nav>

      <div class="pdf-view" id="ws-pdf-view">

        <!-- Empty state — shown when no book loaded -->
        <div id="ws-default-content" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:40px;background:var(--surface-2);z-index:2;">
          <div style="width:56px;height:56px;border-radius:16px;background:var(--gold-muted);border:1px solid var(--gold-border);display:flex;align-items:center;justify-content:center;">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
          </div>
          <div>
            <div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--text-1);margin-bottom:6px;">No book loaded</div>
            <div style="font-size:13px;max-width:220px;line-height:1.65;color:var(--text-3);">Open the Library to pick a textbook and it'll appear here.</div>
          </div>
          <button data-action="openLibraryModal" style="padding:9px 22px;border-radius:var(--r-pill);background:var(--gold);border:none;color:#090900;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-body);">Browse Library</button>
        </div>

        <!-- Loading state — skeleton while PDF fetches/renders -->
        <div id="ws-pdf-loading" style="display:none;flex-direction:column;height:100%;position:absolute;inset:0;background:var(--surface-2);overflow:hidden;">
          <!-- Book cover + title skeleton strip -->
          <div style="display:flex;align-items:center;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--border);">
            <div class="skeleton-line" style="width:36px;height:50px;border-radius:6px;flex-shrink:0;"></div>
            <div style="display:flex;flex-direction:column;gap:7px;flex:1;">
              <div class="skeleton-line" style="height:12px;width:55%;animation-delay:0.1s;"></div>
              <div class="skeleton-line" style="height:10px;width:35%;animation-delay:0.2s;"></div>
            </div>
          </div>
          <!-- Page skeleton rows -->
          <div style="flex:1;padding:20px;display:flex;flex-direction:column;gap:10px;overflow:hidden;">
            <div class="skeleton-line" style="height:14px;width:90%;animation-delay:0.05s;"></div>
            <div class="skeleton-line" style="height:12px;width:100%;animation-delay:0.1s;"></div>
            <div class="skeleton-line" style="height:12px;width:78%;animation-delay:0.15s;"></div>
            <div class="skeleton-line" style="height:12px;width:95%;animation-delay:0.2s;"></div>
            <div class="skeleton-line" style="height:12px;width:60%;animation-delay:0.25s;"></div>
            <div style="height:16px;"></div>
            <div class="skeleton-line" style="height:12px;width:88%;animation-delay:0.3s;"></div>
            <div class="skeleton-line" style="height:12px;width:100%;animation-delay:0.35s;"></div>
            <div class="skeleton-line" style="height:12px;width:72%;animation-delay:0.4s;"></div>
            <div style="height:16px;"></div>
            <div class="skeleton-line" style="height:12px;width:95%;animation-delay:0.45s;"></div>
            <div class="skeleton-line" style="height:12px;width:83%;animation-delay:0.5s;"></div>
            <div class="skeleton-line" style="height:12px;width:100%;animation-delay:0.55s;"></div>
            <div class="skeleton-line" style="height:12px;width:50%;animation-delay:0.6s;"></div>
          </div>
          <!-- Progress label at bottom -->
          <div style="padding:10px 20px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;">
            <div class="sp-spinner" style="flex-shrink:0;"></div>
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
              <div style="font-size:12px;color:var(--text-2);" id="ws-loading-text">Loading PDF…</div>
              <div style="font-size:11px;color:var(--text-4);" id="ws-loading-progress"></div>
            </div>
          </div>
        </div>

        <!-- PDF.js canvas scroll container -->
        <div id="ws-pdf-canvas-wrap" style="display:none;width:100%;height:100%;overflow-y:auto;padding:20px;box-sizing:border-box;background:var(--surface-2);flex-direction:column;align-items:center;gap:12px;">
        </div>

      </div>

    </div>
  </section>
  <div class="ws-resizer" id="ws-resizer"></div>

  <!-- Chat Panel -->
  <section class="chat-panel">
    <div class="chat-bar">
      <span class="context-tag" id="ws-context-tag">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        No book
      </span>
      <span class="chat-bar-title" id="ws-chat-title">Select a book to start studying</span>
      <button class="icon-btn" aria-label="New chat" title="New chat" data-action="wsClearChat"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
    </div>

    <div class="messages" id="ws-messages">
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;text-align:center;padding:40px;">
        <div style="width:56px;height:56px;border-radius:16px;background:var(--violet-muted);border:1px solid var(--violet-border);display:flex;align-items:center;justify-content:center;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="1.5" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div>
          <div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--text-1);margin-bottom:6px;">Ask anything</div>
          <div style="font-size:13px;color:var(--text-3);line-height:1.65;max-width:220px;">Select a book and type a question to start studying with AI.</div>
        </div>
      </div>
    </div>

    <div class="chat-input-wrap">
      <div id="ws-attach-preview" class="attach-preview" style="display:none;"></div>
      <div class="chat-input-inner">
        <div class="chat-plus-wrap">
          <button class="chat-plus" id="ws-plus-btn" onclick="wsToggleAttachMenu(event)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
          <div class="attach-menu home-rich-menu" id="ws-attach-menu">
            <div class="attach-menu-section-label">Attach</div>
            <div class="attach-menu-item" onclick="wsAttachTrigger('image')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Image</span>
            </div>
            <div class="attach-menu-item" onclick="wsAttachTrigger('pdf')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>PDF</span>
            </div>
            <div class="attach-menu-divider"></div>
            <div class="attach-menu-section-label">AI Mode</div>
            <div class="attach-menu-item attach-menu-toggle" id="ws-toggle-websearch" onclick="wsToggleWebSearch()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span>Web Search</span>
              <div class="attach-menu-check" id="ws-websearch-check"></div>
            </div>
            <div class="attach-menu-item attach-menu-toggle" id="ws-toggle-think" onclick="wsToggleThinking('think')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg>
              <span>Think</span>
              <div class="attach-menu-check" id="ws-think-check"></div>
            </div>
            <div class="attach-menu-item attach-menu-toggle" id="ws-toggle-deep" onclick="wsToggleThinking('deep')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span>Deep Think</span>
              <div class="attach-menu-check" id="ws-deep-check"></div>
            </div>
          </div>
        </div>
        <input type="file" id="ws-attach-image" accept="image/*" style="display:none;" onchange="wsHandleAttach(this,'image')">
        <input type="file" id="ws-attach-pdf" accept="application/pdf" style="display:none;" onchange="wsHandleAttach(this,'pdf')">
        <textarea id="ws-chat-input" class="chat-input-field" placeholder="Ask a follow-up about Chapter 3…" rows="1" style="resize:none;max-height:120px;overflow-y:auto;font-family:var(--font-body);font-size:13px;color:var(--text-1);background:transparent;border:none;outline:none;flex:1;line-height:1.5;"></textarea>
        <button class="chat-send" id="ws-chat-send" data-action="wsChatSend"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
      </div>
      <div class="input-hints">
        <button class="hint-tag" onclick="wsSetInput('Summarize the current page')">Summarize page</button>
        <button class="hint-tag" onclick="wsSetInput('Generate flashcards on this topic')">Generate flashcards</button>
        <button class="hint-tag" onclick="wsSetInput('Explain this equation in detail')">Explain this equation</button>
      </div>
    </div>
  </section>
</div>
`;function Ht(){const t=document.querySelector("[data-workspace-screen]");if(!t){console.warn("[WorkspaceScreen] placeholder [data-workspace-screen] not found");return}t.outerHTML=Pt}function qt(t){const e=document.getElementById("screen-workspace"),i=document.querySelector("#screen-workspace .pdf-panel"),o=document.getElementById("mwt-tab-chat"),s=document.getElementById("mwt-tab-pdf");!e||!i||(t==="pdf"?(e.classList.add("ws-pdf-mode"),i.classList.add("mobile-visible"),o?.classList.remove("active"),s?.classList.add("active")):(e.classList.remove("ws-pdf-mode"),i.classList.remove("mobile-visible"),o?.classList.add("active"),s?.classList.remove("active")))}function Rt(){const t=document.getElementById("ws-resizer"),e=document.querySelector(".pdf-panel"),i=document.getElementById("screen-workspace");if(!t||!e)return;let o=!1,s=0,n=0;t.addEventListener("mousedown",a=>{o=!0,s=a.clientX,n=e.getBoundingClientRect().width,t.classList.add("dragging"),document.body.style.cursor="col-resize",document.body.style.userSelect="none"}),document.addEventListener("mousemove",a=>{if(!o)return;const r=i.getBoundingClientRect(),l=i.querySelector(".sidebar")?.getBoundingClientRect(),v=l?l.width:244,c=r.width-v-4,h=a.clientX-s,w=Math.min(Math.max(n+h,c*.25),c*.75);e.style.flex=`0 0 ${w}px`}),document.addEventListener("mouseup",()=>{o&&(o=!1,t.classList.remove("dragging"),document.body.style.cursor="",document.body.style.userSelect="")})}Ht();Rt();window.wsMobileView=qt;console.log("[WorkspaceScreen] module loaded ✦");const Dt=`
<div class="screen" id="screen-flash" style="flex-direction:row;overflow:hidden;">
  <aside class="sidebar" data-sidebar-screen="flash"></aside>
  <main class="fc-main">

    <div id="fc-home">
      <div class="fc-home-wrap">

        <div class="fc-hero">
          <div class="fc-hero-top">
            <div>
              <div class="fc-hero-label">Flashcards</div>
              <h1 class="fc-hero-title">Study smarter,<br>remember more</h1>
              <p class="fc-hero-sub">Generate AI-powered decks from any topic. Spaced repetition keeps hard cards front and center.</p>
            </div>
            <!-- Streak widget -->
            <div class="fc-streak-widget" id="fc-streak-widget">
              <div class="fc-streak-top-row">
                <div class="fc-streak-fire" id="fc-streak-fire"></div>
                <div class="fc-streak-number-col">
                  <div class="fc-streak-count" id="fc-streak-count">0</div>
                  <div class="fc-streak-label">day streak</div>
                </div>
              </div>
              <div class="fc-streak-status" id="fc-streak-status"></div>
              <!-- Progress to next milestone -->
              <div class="fc-streak-prog-wrap">
                <div class="fc-streak-prog-track">
                  <div class="fc-streak-prog-bar" id="fc-streak-prog-bar" style="width:0%"></div>
                </div>
                <div class="fc-streak-next-label" id="fc-streak-next-label">3 days → Ocean theme</div>
              </div>
              <!-- Stats row -->
              <div class="fc-streak-stats">
                <div class="fc-streak-stat">
                  <div class="fc-streak-stat-val" id="fc-streak-longest">0</div>
                  <div class="fc-streak-stat-lbl">longest</div>
                </div>
                <div class="fc-streak-stat-divider"></div>
                <div class="fc-streak-stat">
                  <div class="fc-streak-stat-val" id="fc-streak-freeze">—</div>
                  <div class="fc-streak-stat-lbl">freeze</div>
                </div>
                <div class="fc-streak-stat-divider"></div>
                <div class="fc-streak-stat">
                  <div class="fc-streak-stat-val" id="fc-streak-xp">0</div>
                  <div class="fc-streak-stat-lbl">total XP</div>
                </div>
              </div>
              <!-- Legend badge — hidden until day 100 -->
              <div class="fc-legend-badge" id="fc-legend-badge" style="display:none;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                Legend
              </div>
            </div>
          </div>
        </div>

        <div class="fc-gen-card">
          <div class="fc-gen-header">
            <h2>Generate a new deck</h2>
            <p>Enter a topic and the AI will create a full set of study cards.</p>
          </div>
          <div class="fc-gen-body">
            <div class="fc-gen-row">
              <div class="fc-field" style="flex:1;">
                <label for="fc-topic-input">Topic or chapter</label>
                <input class="fc-input" id="fc-topic-input" type="text"
                  placeholder="e.g. Cell Division, French Revolution, Ohm's Law..."
                  onkeydown="if(event.key==='Enter')_fcGenerateFromBar()" />
              </div>
              <div class="fc-field" style="width:130px;flex-shrink:0;">
                <label for="fc-count-input">Cards</label>
                <select class="fc-input" id="fc-count-input">
                  <option value="5">5 cards</option>
                  <option value="10" selected>10 cards</option>
                  <option value="15">15 cards</option>
                  <option value="20">20 cards</option>
                </select>
              </div>
            </div>
            <div id="fc-gen-error" style="display:none;font-size:12px;color:#f87171;padding:10px 14px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:var(--r-sm);"></div>
            <div class="fc-gen-actions">
              <button class="fc-gen-btn" id="fc-gen-btn" data-action="_fcGenerateFromBar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Generate Deck
              </button>
              <button class="fc-upload-btn" id="fc-upload-btn" onclick="window._fcOpenPdfUpload()" title="Generate flashcards from a PDF, PPTX, or DOCX file">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload PDF
              </button>
            </div>
          </div>
        </div>

        <div id="fc-gen-loading" style="display:none;text-align:center;padding:48px 24px;">
          <div style="display:flex;justify-content:center;gap:5px;margin-bottom:14px;">
            <span style="width:6px;height:6px;border-radius:50%;background:var(--gold);animation:blink 1s ease-in-out infinite;display:inline-block;"></span>
            <span style="width:6px;height:6px;border-radius:50%;background:var(--gold);animation:blink 1s ease-in-out 0.2s infinite;display:inline-block;"></span>
            <span style="width:6px;height:6px;border-radius:50%;background:var(--gold);animation:blink 1s ease-in-out 0.4s infinite;display:inline-block;"></span>
          </div>
          <div style="font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--text-1);margin-bottom:4px;">Building your deck...</div>
          <div style="font-size:12px;color:var(--text-4);">Generating cards for <span id="fc-loading-topic" style="color:var(--gold);"></span></div>
        </div>

        <div id="fc-decks-section">
          <div class="fc-section-header">
            <span class="fc-section-label">Your decks</span>
            <span id="fc-total-decks" style="font-size:11px;color:var(--text-4);font-family:var(--font-mono);"></span>
          </div>
          <div id="fc-empty-state" style="display:none;text-align:center;padding:48px 24px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-4);margin-bottom:12px;opacity:0.4;"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
            <div style="font-size:13px;font-weight:600;color:var(--text-3);margin-bottom:4px;">No decks yet</div>
            <div style="font-size:12px;color:var(--text-4);">Generate your first deck above to get started.</div>
          </div>
          <div class="fc-deck-grid" id="fc-deck-grid"></div>
        </div>

      </div>
    </div>

    <div id="fc-study" style="display:none;">
      <div class="fc-study-wrap">

        <div class="fc-study-topbar">
          <button class="fc-exit-btn" data-action="_fcExitStudy">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
          <div class="fc-progress-wrap">
            <div class="fc-progress-meta">
              <span id="fc-card-label">Card 1 of 10</span>
              <span id="fc-progress-stats" style="color:var(--text-4);"></span>
            </div>
            <div class="fc-progress-track">
              <div class="fc-progress-fill" id="fc-progress-fill" style="width:0%;"></div>
            </div>
          </div>
          <div class="fc-session-info">
            <button class="fc-topbar-btn" data-action="_fcOpenThemePicker">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></svg>
              Theme
            </button>
            <button class="fc-topbar-btn" data-action="_fcToggleSound" id="fc-sound-toggle">
              <span class="fc-sound-on">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              </span>
              <span class="fc-sound-off" style="display:none;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              </span>
              Sound
            </button>
          </div>
        </div>

        <div class="fc-card-area">
          <div class="fc-card-scene" id="fc-card-scene">
            <div class="fc-card" id="fc-card" data-action="_fcFlip">
              <div class="fc-card-face fc-card-front">
                <div class="fc-card-face-label">
                  Question
                  <button class="fc-card-edit-btn" onclick="event.stopPropagation();window._fcOpenEditCard('front')" title="Edit question">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>
                <div class="fc-card-text" id="fc-card-question"></div>
                <div class="fc-card-flip-hint">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                  Tap to flip
                </div>
              </div>
              <div class="fc-card-face fc-card-back">
                <div class="fc-card-face-label" style="color:var(--gold);opacity:0.7;">
                  Answer
                  <button class="fc-card-edit-btn" onclick="event.stopPropagation();window._fcOpenEditCard('back')" title="Edit answer">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>
                <div class="fc-card-text" id="fc-card-answer"></div>
                <div class="fc-card-flip-hint" style="color:var(--text-4);">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                  Tap to flip back
                </div>
              </div>
            </div>
          </div>

          <div id="fc-pre-flip-hint" class="fc-pre-flip-hint">
            Press <kbd>Space</kbd> or tap the card to flip
          </div>

          <div class="fc-rating-row" id="fc-rating-row" style="display:none;">
            <button class="fc-rating-btn hard" data-rating="hard" data-action="_fcNext-self">
              <span class="fc-rating-icon">✕</span>
              <span class="fc-rating-label">Hard</span>
              <span class="fc-rating-sub">Review soon</span>
            </button>
            <button class="fc-rating-btn ok" data-rating="ok" data-action="_fcNext-self">
              <span class="fc-rating-icon">◐</span>
              <span class="fc-rating-label">Got it</span>
              <span class="fc-rating-sub">Needs practice</span>
            </button>
            <button class="fc-rating-btn easy" data-rating="easy" data-action="_fcNext-self">
              <span class="fc-rating-icon">✓</span>
              <span class="fc-rating-label">Easy</span>
              <span class="fc-rating-sub">Knew it well</span>
            </button>
          </div>

          <div style="text-align:center;margin-top:12px;">
            <button class="fc-skip-btn" data-rating="skipped" data-action="_fcNext-self">Skip this card</button>
          </div>

          <!-- Edit card modal -->
          <div id="fc-edit-overlay" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,0.6);z-index:100;display:none;align-items:center;justify-content:center;padding:24px;">
            <div class="fc-edit-modal" onclick="event.stopPropagation()">
              <div class="fc-edit-header">
                <span id="fc-edit-label">Edit question</span>
                <button onclick="window._fcCloseEditCard()" style="background:none;border:none;color:var(--text-4);cursor:pointer;padding:4px;line-height:0;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <textarea id="fc-edit-textarea" class="fc-edit-textarea" placeholder="Enter text..."></textarea>
              <div class="fc-edit-actions">
                <button class="fc-edit-cancel" onclick="window._fcCloseEditCard()">Cancel</button>
                <button class="fc-edit-save" onclick="window._fcSaveEditCard()">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Save card
                </button>
              </div>
            </div>
          </div>

          <!-- AI Tutor explanation panel — appears after rating Hard -->
          <div id="fc-tutor-panel" class="fc-tutor-panel" style="display:none;">
            <div class="fc-tutor-header">
              <div class="fc-tutor-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                AI Tutor
              </div>
              <div style="display:flex;gap:6px;align-items:center;">
                <button class="fc-visual-tutor-btn" onclick="window._vtOpenForConcept(document.getElementById('fc-card-question')?.textContent, document.getElementById('fc-card-answer')?.textContent)" title="Open Visual Tutor">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="3"/></svg>
                  Visual
                </button>

                <button class="fc-tutor-close" onclick="window._fcDismissTutor()" title="Got it, next card">
                  Next card
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
            <div class="fc-tutor-body" id="fc-tutor-body">
              <div class="fc-tutor-loading" id="fc-tutor-loading">
                <span></span><span></span><span></span>
              </div>
              <div class="fc-tutor-text" id="fc-tutor-text" style="display:none;"></div>
            </div>
          </div>

        </div>
      </div>
    </div>

  </main>
</div>
`,Nt=`
<div class="fc-modal-overlay" id="fc-complete-modal" style="display:none;" onclick="if(event.target===this)window._fcCloseCompleteModal()">
  <div class="fc-modal-card">
    <div class="fc-modal-top">
      <div class="fc-modal-emoji" id="fc-complete-emoji">🎉</div>
      <h2 class="fc-modal-title" id="fc-complete-title">Deck complete!</h2>
      <p class="fc-modal-sub" id="fc-complete-sub">You've gone through all your cards.</p>
    </div>
    <div class="fc-modal-stats">
      <div class="fc-modal-stat">
        <div class="fc-modal-stat-num easy" id="fc-stat-easy">0</div>
        <div class="fc-modal-stat-label">Easy</div>
      </div>
      <div class="fc-modal-stat">
        <div class="fc-modal-stat-num ok" id="fc-stat-ok">0</div>
        <div class="fc-modal-stat-label">Got it</div>
      </div>
      <div class="fc-modal-stat">
        <div class="fc-modal-stat-num hard" id="fc-stat-hard">0</div>
        <div class="fc-modal-stat-label">Hard</div>
      </div>
      <div class="fc-modal-stat">
        <div class="fc-modal-stat-num skip" id="fc-stat-skipped">0</div>
        <div class="fc-modal-stat-label">Skipped</div>
      </div>
    </div>
    <!-- XP earned this session -->
    <div class="fc-modal-xp-block" id="fc-modal-xp-block" style="display:none;">
      <div class="fc-modal-xp-row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        <span class="fc-modal-xp-earned" id="fc-modal-xp-earned">+0 XP</span>
        <span class="fc-modal-xp-bonus" id="fc-modal-xp-bonus" style="display:none;"></span>
      </div>
      <div class="fc-modal-xp-total" id="fc-modal-xp-total">0 total XP</div>
    </div>

    <div class="fc-modal-srs-note" id="fc-modal-srs-note" style="display:none;">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span id="fc-srs-message"></span>
    </div>
    <div class="fc-modal-actions">
      <button class="fc-modal-btn primary" data-action="_fcRestartDeck">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M1 4v6h6"/><path d="M5.64 5.64A9 9 0 1 1 3.51 15"/></svg>
        Study again
      </button>
      <button class="fc-modal-btn secondary" data-action="_fcStudyHardOnly" id="fc-study-hard-btn" style="display:none;">
        Study hard cards only
      </button>

      <button class="fc-modal-btn secondary" data-action="_fcCreateNew">
        New deck
      </button>
    </div>
    <button class="fc-modal-close" data-action="_fcCloseCompleteModal" aria-label="Close">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
</div>
`;function Ot(){const t=document.querySelector("[data-flash-screen]");t?t.outerHTML=Dt:console.warn("[FlashScreen] [data-flash-screen] not found");const e=document.querySelector("[data-fc-complete-modal]");e?e.outerHTML=Nt:console.warn("[FlashScreen] [data-fc-complete-modal] not found");try{const i=sessionStorage.getItem("exam_weak_prefill");if(i){const{topic:o,concepts:s}=JSON.parse(i),n=document.getElementById("fc-topic-input");n&&(s||o)&&(n.value=s||o,setTimeout(()=>n.focus(),150)),sessionStorage.removeItem("exam_weak_prefill")}}catch{}}Ot();console.log("[FlashScreen] module loaded ✦");const Ft=`
<div class="screen" id="screen-research" style="flex-direction:row;overflow:hidden;">

  <!-- Mobile topbar (hidden on desktop) -->
  <div class="mobile-screen-topbar" style="display:none;">
    <button type="button" class="mst-back" data-action="goHome" aria-label="Back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <span class="mst-title">Research</span>
    <div class="mst-badge gold" id="research-mobile-badge" style="display:none;">In Progress</div>
  </div>

  <!-- Sidebar -->
  <aside class="sidebar" data-sidebar-screen="research"></aside>

  <!-- Main Research Layout -->
  <div class="research-layout">

    <!-- Top bar (hidden until project started) -->
    <div class="research-topbar" id="research-topbar" style="display:none;">
      <button class="icon-btn" data-action="_researchBackToSetup" style="margin-right:4px;" title="Back to setup">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div class="research-topbar-title" id="research-paper-title">Untitled Research</div>
      <div class="research-status">
        <div class="research-status-dot"></div>
        <span id="research-progress-label">0 of 17 layers complete</span>
      </div>
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-4);display:flex;align-items:center;gap:4px;">
        <span id="topbar-words">0</span><span style="opacity:0.5;">/ ~3,000 words</span>
      </div>
      <span id="autosave-indicator" style="font-family:var(--font-mono);font-size:10px;color:var(--text-4);opacity:0;transition:opacity 0.4s;margin-left:4px;">✓ Saved</span>
      <button class="btn-sec-research" data-action="_confirmNewPaper" style="font-size:11px;padding:5px 14px;margin-left:4px;">New Paper</button>
      <button class="btn-sec-research" style="font-size:11px;padding:5px 14px;" data-action="_exportPDF">Export PDF</button>
    </div>

    <!-- SETUP VIEW -->
    <div class="research-setup" id="research-setup-view">
      <div class="research-setup-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e8ac2e" stroke-width="1.5" stroke-linecap="round"><path d="M9 12h6m-3-3v6"/><path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/><path d="M21 7H3l1.5 11A2 2 0 0 0 6.48 20h11.04a2 2 0 0 0 1.98-2L21 7z"/></svg>
      </div>
      <h2>Start Your Research Paper</h2>
      <p>Enter your topic and research problem. The AI will generate a structured outline with sections and layers — then guide you step-by-step using real academic sources.</p>
      <div class="setup-form">
        <div class="setup-field">
          <div class="setup-label">Research Title</div>
          <input class="setup-input" id="research-title-input" type="text" placeholder="e.g. The Impact of Social Media on Academic Performance Among College Students">
        </div>
        <div class="setup-field">
          <div class="setup-label">Research Problem / Objective</div>
          <textarea class="setup-input" id="research-problem-input" rows="3" placeholder="Describe the problem you want to solve or the question you want to answer…"></textarea>
        </div>
        <div class="setup-row">
          <div class="setup-field" style="flex:1;">
            <div class="setup-label">Field / Discipline</div>
            <input class="setup-input" id="research-field-input" type="text" placeholder="e.g. Psychology, Education, Chemistry…">
          </div>
          <div class="setup-field" style="flex:1;">
            <div class="setup-label">Paper Type</div>
            <select class="setup-input" id="research-type-input" style="cursor:pointer;">
              <option>Quantitative Research</option>
              <option>Qualitative Research</option>
              <option>Mixed Methods</option>
              <option>Literature Review</option>
              <option>Case Study</option>
            </select>
          </div>
        </div>
        <button class="setup-btn" id="generate-outline-btn" data-action="_researchStart">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span id="generate-outline-btn-text">Generate Research Outline</span>
        </button>

        <!-- AI Generation progress (hidden until generating) -->
        <div id="outline-gen-progress" style="display:none;margin-top:16px;width:100%;max-width:520px;">
          <div style="background:var(--surface-2);border:1px solid var(--border-xs);border-radius:var(--r-md);padding:16px 18px;display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="display:flex;gap:4px;" id="gen-thinking-dots">
                <span style="width:5px;height:5px;border-radius:50%;background:var(--violet);animation:blink 1s ease-in-out infinite;display:inline-block;"></span>
                <span style="width:5px;height:5px;border-radius:50%;background:var(--violet);animation:blink 1s ease-in-out 0.2s infinite;display:inline-block;"></span>
                <span style="width:5px;height:5px;border-radius:50%;background:var(--violet);animation:blink 1s ease-in-out 0.4s infinite;display:inline-block;"></span>
              </div>
              <span id="gen-status-text" style="font-size:12px;color:var(--text-2);">Thinking about your research topic…</span>
            </div>
            <div style="height:3px;background:var(--surface-3);border-radius:2px;overflow:hidden;">
              <div id="gen-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--violet),var(--gold));border-radius:2px;transition:width 0.5s ease;"></div>
            </div>
            <div id="gen-outline-preview" style="display:none;font-size:11px;color:var(--text-3);font-family:var(--font-mono);line-height:1.8;"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- MAIN RESEARCH VIEW (outline + editor + sources) -->
    <div id="research-view-main" style="display:none;flex:1;overflow:hidden;">
      <div class="research-body">

        <!-- Left: Outline tree -->
        <nav class="research-outline">
          <div class="research-outline-head">
            <span>Outline</span>
            <span id="outline-done-counter" style="color:var(--teal);font-size:9px;">0 / 17 done</span>
          </div>
          <div class="research-outline-scroll">

            <!-- Section I -->
            <div class="ro-section open">
              <div class="ro-section-header active" onclick="this.parentElement.classList.toggle('open')">
                <span class="ro-section-num">I</span>
                <span>Introduction</span>
                <div class="ro-progress">
                  <div class="ro-pip filled"></div>
                  <div class="ro-pip filled"></div>
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                </div>
                <svg class="ro-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
              <div class="ro-layers">
                <div class="ro-layer done" onclick="_researchSelectLayer(this,'Background of the Study','Introduction')">Background of the Study</div>
                <div class="ro-layer done" onclick="_researchSelectLayer(this,'Global Problem','Introduction')">Global Problem</div>
                <div class="ro-layer active" onclick="_researchSelectLayer(this,'Local Problem','Introduction')">Local Problem</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Research Gap','Introduction')">Research Gap</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Purpose of the Study','Introduction')">Purpose of the Study</div>
              </div>
            </div>

            <!-- Section II -->
            <div class="ro-section">
              <div class="ro-section-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="ro-section-num">II</span>
                <span>Review of Related Literature</span>
                <div class="ro-progress">
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                </div>
                <svg class="ro-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
              <div class="ro-layers">
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Theoretical Framework','Review of Related Literature')">Theoretical Framework</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Related Studies (Global)','Review of Related Literature')">Related Studies (Global)</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Related Studies (Local)','Review of Related Literature')">Related Studies (Local)</div>
              </div>
            </div>

            <!-- Section III -->
            <div class="ro-section">
              <div class="ro-section-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="ro-section-num">III</span>
                <span>Methodology</span>
                <div class="ro-progress">
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                </div>
                <svg class="ro-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
              <div class="ro-layers">
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Research Design','Methodology')">Research Design</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Participants &amp; Sampling','Methodology')">Participants &amp; Sampling</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Data Collection','Methodology')">Data Collection</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Data Analysis','Methodology')">Data Analysis</div>
              </div>
            </div>

            <!-- Section IV -->
            <div class="ro-section">
              <div class="ro-section-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="ro-section-num">IV</span>
                <span>Results &amp; Discussion</span>
                <div class="ro-progress">
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                </div>
                <svg class="ro-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
              <div class="ro-layers">
                <div class="ro-layer">Key Findings</div>
                <div class="ro-layer">Interpretation</div>
                <div class="ro-layer">Implications</div>
              </div>
            </div>

            <!-- Section V -->
            <div class="ro-section">
              <div class="ro-section-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="ro-section-num">V</span>
                <span>Conclusion</span>
                <div class="ro-progress">
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                </div>
                <svg class="ro-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
              <div class="ro-layers">
                <div class="ro-layer">Summary</div>
                <div class="ro-layer">Recommendations</div>
              </div>
            </div>

          </div><!-- /scroll -->
        </nav>

        <!-- Center: Layer editor -->
        <div class="research-main">
          <div class="research-tabs">
            <div class="research-tab active" onclick="switchResearchTab('write', this)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Write Layer
            </div>
            <div class="research-tab" onclick="switchResearchTab('search', this)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Search Papers
            </div>
            <div class="research-tab" onclick="switchResearchTab('paper', this)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Full Paper
            </div>
          </div>

          <div class="research-content">

            <!-- TAB: Write Layer -->
            <div id="tab-write" class="research-tab-panel" style="display:flex;flex:1;overflow:hidden;">
            <div class="layer-editor" style="overflow-y:auto;">

              <div class="layer-header">
                <div class="layer-section-crumb">
                  <span>Introduction</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
                  <span style="color:var(--gold);">Local Problem</span>
                </div>
                <div class="layer-title">Local Problem</div>
                <div class="layer-desc" id="layer-desc-text">Loading…</div>
                <div id="layer-tip-card" style="display:none;margin-top:8px;background:var(--surface-2);border:1px solid var(--border-xs);border-radius:var(--r-sm);overflow:hidden;">
                  <div id="layer-tip-checklist" style="padding:10px 14px 6px;display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--text-3);line-height:1.5;"></div>
                  <div style="padding:6px 14px 8px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border-xs);">
                    <span id="layer-tip-target" style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);"></span>
                    <button data-action="_toggleTip" style="font-size:10px;padding:4px 10px;background:var(--surface-3);border:1px solid var(--border-xs);border-radius:var(--r-pill);color:var(--text-3);cursor:pointer;font-family:var(--font-body);position:relative;z-index:1;">Dismiss</button>
                  </div>
                </div>
                <button id="layer-tip-toggle" data-action="_toggleTip" style="margin-top:6px;font-size:10px;background:transparent;border:none;color:var(--text-4);cursor:pointer;font-family:var(--font-body);padding:0;display:flex;align-items:center;gap:4px;">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Show tips
                </button>
              </div>

              <div class="layer-steps" id="layer-steps-container">
                <!-- Rendered dynamically by _renderLayerEditor() -->
              </div>
            </div><!-- /layer-editor -->
            </div><!-- /tab-write -->

            <!-- TAB: Search Papers -->
            <div id="tab-search" class="research-tab-panel" style="display:none;flex:1;flex-direction:column;overflow:hidden;">
              <div style="padding:20px 24px 12px;border-bottom:1px solid var(--border-xs);flex-shrink:0;">
                <div style="font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--text-1);margin-bottom:4px;">Search Academic Papers</div>
                <div style="font-size:12px;color:var(--text-3);">Find and attach sources to any layer of your research paper.</div>
                <div style="display:flex;gap:8px;margin-top:12px;">
                  <div class="hover-search-wrap" style="flex:1;display:flex;align-items:center;gap:8px;background:var(--surface-2);border:1px solid var(--border-xs);border-radius:var(--r-sm);padding:8px 12px;transition:border-color var(--t-fast);">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--text-4);flex-shrink:0;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input id="paper-search-input" type="text" placeholder="Search by title, author, keyword…" style="flex:1;background:transparent;border:none;outline:none;font-family:var(--font-body);font-size:13px;color:var(--text-1);" onkeydown="if(event.key==='Enter')_runPaperSearch()">
                  </div>
                  <button data-action="_runPaperSearch" class="hover-search-btn" style="padding:8px 18px;border-radius:var(--r-sm);background:var(--gold);border:none;color:#090900;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font-body);white-space:nowrap;transition:background var(--t-fast);">Search</button>
                </div>
                <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
                  <span style="font-size:11px;color:var(--text-4);">Try:</span>
                  <span id="search-chip-1" class="prompt-chip" style="font-size:11px;padding:3px 10px;" onclick="document.getElementById('paper-search-input').value=this.textContent;_runPaperSearch()">social media academic performance</span>
                  <span id="search-chip-2" class="prompt-chip" style="font-size:11px;padding:3px 10px;" onclick="document.getElementById('paper-search-input').value=this.textContent;_runPaperSearch()">digital distraction students</span>
                  <span id="search-chip-3" class="prompt-chip" style="font-size:11px;padding:3px 10px;" onclick="document.getElementById('paper-search-input').value=this.textContent;_runPaperSearch()">screen time GPA correlation</span>
                </div>
              </div>
              <!-- Ready-to-write banner — shown when sources are attached -->
              <div id="sources-ready-banner" style="display:none;padding:10px 24px;background:var(--gold-muted);border-bottom:1px solid var(--gold-border);flex-shrink:0;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span id="sources-ready-label" style="font-size:12px;color:var(--gold);font-weight:600;">1 source attached to this layer</span>
                  </div>
                  <button onclick="switchResearchTab('write', document.querySelectorAll('.research-tab')[0])" style="padding:5px 14px;border-radius:var(--r-pill);background:var(--gold);border:none;color:#090900;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font-body);white-space:nowrap;">
                    Write Layer →
                  </button>
                </div>
              </div>
              <div id="paper-search-results" style="flex:1;overflow-y:auto;padding:16px 24px;display:flex;flex-direction:column;gap:8px;">
                <!-- Default state -->
                <div id="paper-search-empty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-4);text-align:center;">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.25"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <div style="font-size:12px;">Search for papers and attach them to this layer</div>
                  <div style="font-size:11px;color:var(--text-4);opacity:0.6;">Sources give the AI context to write a better paragraph</div>
                </div>
              </div>
            </div><!-- /tab-search -->

            <!-- TAB: Full Paper — rendered dynamically by _renderFullPaper() -->
            <div id="tab-paper" class="research-tab-panel" style="display:none;flex:1;flex-direction:column;overflow:hidden;">
              <div style="padding:16px 24px 12px;border-bottom:1px solid var(--border-xs);flex-shrink:0;display:flex;align-items:center;gap:10px;">
                <div style="flex:1;">
                  <div style="font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--text-1);">Full Paper Preview</div>
                  <div style="font-size:12px;color:var(--text-3);margin-top:2px;" id="full-paper-subtitle">All accepted layers compiled</div>
                </div>
                <button data-action="_exportPDF" class="hover-export-btn" style="padding:6px 14px;border-radius:var(--r-pill);background:transparent;border:1px solid var(--border-md);color:var(--text-2);font-size:11px;cursor:pointer;font-family:var(--font-body);display:flex;align-items:center;gap:6px;transition:all var(--t-fast);">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export PDF
                </button>
              </div>
              <div id="full-paper-body" style="flex:1;overflow-y:auto;padding:32px 48px;max-width:800px;margin:0 auto;width:100%;">
                <!-- Rendered by _renderFullPaper() -->
              </div>
            </div><!-- /tab-paper -->

          </div><!-- /research-content -->
        </div><!-- /research-main -->

        <!-- Right: Sources panel -->
        <div class="research-side">
          <!-- Citation Manager tabs -->
          <div style="display:flex;border-bottom:1px solid var(--border-xs);">
            <button id="cit-tab-sources" onclick="_switchCitTab('sources')" style="flex:1;padding:10px 0;background:transparent;border:none;border-bottom:2px solid var(--gold);color:var(--text-1);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font-body);transition:all 0.15s;">Sources</button>
            <button id="cit-tab-refs" onclick="_switchCitTab('refs')" style="flex:1;padding:10px 0;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--text-3);font-size:11px;font-weight:600;cursor:pointer;font-family:var(--font-body);transition:all 0.15s;">References</button>
            <span id="sources-count-badge" style="display:flex;align-items:center;padding:0 10px;font-size:10px;color:var(--gold);font-family:var(--font-mono);">0</span>
          </div>

          <!-- Sources tab -->
          <div id="cit-panel-sources" class="research-side-scroll" style="flex:1;overflow-y:auto;padding:12px;">
            <!-- Rendered dynamically by _renderSourcesPanel() -->
          </div>

          <!-- References tab -->
          <div id="cit-panel-refs" style="display:none;flex:1;overflow-y:auto;padding:12px;">
            <!-- Rendered dynamically by _renderReferences() -->
          </div>

          <div class="research-paper-stats">
            <div class="rps-card">
              <div class="rps-num" id="stat-sources">0</div>
              <div class="rps-label">Sources Used</div>
            </div>
            <div class="rps-card">
              <div class="rps-num" id="stat-layers">0</div>
              <div class="rps-label">Layers Done</div>
            </div>
            <div class="rps-card">
              <div class="rps-num" id="stat-words">0</div>
              <div class="rps-label">Words Written</div>
            </div>
            <div class="rps-card" style="border-color:var(--gold-border);">
              <div class="rps-num" id="stat-pct" style="font-size:16px;">0%</div>
              <div class="rps-label">Complete</div>
            </div>
          </div>
        </div>

      </div><!-- /research-body -->
    </div><!-- /research-view-main -->

  </div><!-- /research-layout -->
</div><!-- /screen-research -->
`;function jt(){const t=document.querySelector("[data-research-screen]");if(!t){console.warn("[ResearchScreen] placeholder [data-research-screen] not found");return}t.outerHTML=Ft,$t()}let te=null,je=null;function $t(){const t=document.getElementById("screen-research");t&&(t.addEventListener("dragstart",e=>{const i=e.target.closest(".ro-layer[draggable]");i&&(te=i.dataset.lid,je=i.dataset.sid,i.classList.add("dragging"),e.dataTransfer.effectAllowed="move")}),t.addEventListener("dragend",()=>{t.querySelectorAll(".ro-layer").forEach(e=>e.classList.remove("dragging","drag-over"))}),t.addEventListener("dragover",e=>{const i=e.target.closest(".ro-layer[draggable]");i&&(e.preventDefault(),e.dataTransfer.dropEffect="move",t.querySelectorAll(".ro-layer").forEach(o=>o.classList.remove("drag-over")),i.dataset.lid!==te&&i.classList.add("drag-over"))}),t.addEventListener("drop",e=>{e.preventDefault();const i=e.target.closest(".ro-layer[draggable]");if(!i||!te||i.dataset.lid===te)return;const o=window.RS;if(!o?.outline)return;const s=o.outline.find(v=>v.id===je),n=o.outline.find(v=>v.id===i.dataset.sid);if(!s||!n)return;const a=s.layers.findIndex(v=>v.id===te),r=n.layers.findIndex(v=>v.id===i.dataset.lid);if(a===-1||r===-1)return;const[l]=s.layers.splice(a,1);n.layers.splice(r,0,l),window._save?.(),window._renderOutline?.(),window._showToast?.("⇅",`Moved "${l.name}"`,"var(--text-3)")}))}jt();console.log("[ResearchScreen] module loaded ✦");const Vt=`
<div class="screen" id="screen-exam" style="flex-direction:row;overflow:hidden;">

  <aside class="sidebar" data-sidebar-screen="exam"></aside>

  <!-- Main exam area -->
  <main class="exam-main">
    <div class="exam-wrap">

      <!-- SETUP VIEW -->
      <div id="exam-setup">
        <div style="margin-bottom:24px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Exam Mode</div>
            <h1 style="font-family:var(--font-head);font-size:24px;font-weight:800;color:var(--text-1);margin-bottom:6px;">Test Your Knowledge</h1>
            <p style="font-size:13px;color:var(--text-4);line-height:1.6;">Generate a timed exam from any topic or textbook chapter. The AI will create questions, grade your answers, and explain what you got wrong.</p>
          </div>
          <button onclick="examShowHistory()" style="flex-shrink:0;display:flex;align-items:center;gap:6px;padding:7px 13px;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-sm);color:var(--text-3);font-size:11px;font-family:var(--font-body);cursor:pointer;white-space:nowrap;transition:background 0.15s;" onmouseenter="this.style.background='var(--surface-3)'" onmouseleave="this.style.background='var(--surface-2)'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            History
          </button>
        </div>

        <div class="exam-setup-card">
          <div class="exam-setup-header">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
              <div>
                <h2>Configure Your Exam</h2>
                <p>Choose your topic, format, and difficulty — the AI does the rest.</p>
              </div>
              <div id="exam-adaptive-badge" style="display:none;flex-shrink:0;display:flex;align-items:center;gap:5px;padding:4px 10px;background:rgba(139,124,248,0.12);border:1px solid rgba(139,124,248,0.3);border-radius:20px;font-size:10px;color:var(--violet);font-weight:600;letter-spacing:0.04em;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                ADAPTIVE ON
              </div>
            </div>
          </div>
          <div class="exam-setup-body">

            <div class="exam-field">
              <label>Topic or Chapter</label>
              <input class="exam-input" id="exam-topic-input" type="text" placeholder="e.g. Mitosis and Meiosis, World War II, Newton's Laws…" />
            </div>

            <!-- ── Source Material ── -->
            <div class="exam-field">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <label style="margin-bottom:0;">Source Material <span style="color:var(--text-4);font-weight:400;letter-spacing:0;">(optional)</span></label>
                <div class="exam-src-tabs" id="exam-src-tabs">
                  <button class="exam-src-tab active" data-tab="pdf" onclick="examSrcTab(this)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    PDF
                  </button>
                  <button class="exam-src-tab" data-tab="notes" onclick="examSrcTab(this)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                    Notes
                  </button>
                </div>
              </div>

              <!-- PDF tab -->
              <div id="exam-src-pdf">
                <input type="file" id="exam-pdf-file" accept="application/pdf" style="display:none;" onchange="examHandlePdfFile(this)">
                <div class="exam-upload-zone" id="exam-upload-zone"
                     onclick="if(!this.classList.contains('has-file'))document.getElementById('exam-pdf-file').click()"
                     ondragover="examDragOver(event)" ondragleave="examDragLeave(event)" ondrop="examDrop(event)">
                  <div id="exam-upload-idle">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-4);margin-bottom:8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:3px;">Drop a PDF here or click to browse</div>
                    <div style="font-size:11px;color:var(--text-4);">Questions will be generated from your document's content</div>
                  </div>
                  <div id="exam-upload-attached" style="display:none;width:100%;">
                    <div class="exam-file-badge">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span id="exam-file-name">document.pdf</span>
                      <span id="exam-file-pages" style="color:var(--text-4);margin-left:auto;flex-shrink:0;"></span>
                      <button class="exam-file-clear" data-action="examClearSource" title="Remove">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                    <div id="exam-extract-status" style="font-size:11px;color:var(--text-4);margin-top:6px;display:flex;align-items:center;gap:5px;"></div>
                  </div>
                </div>
              </div>

              <!-- Notes tab -->
              <div id="exam-src-notes" style="display:none;">
                <textarea id="exam-notes-input" class="exam-input exam-notes-area"
                  placeholder="Paste your study notes, lecture slides text, or any content you want the exam based on…"></textarea>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
                  <span id="exam-notes-count" style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);">0 chars</span>
                  <button data-action="examClearNotes" class="hover-clear-btn" style="font-size:10px;color:var(--text-4);background:none;border:none;cursor:pointer;font-family:var(--font-body);">Clear</button>
                </div>
              </div>
            </div>
            <!-- /Source Material -->

            <!-- ── Scan Mode (shown when source material is attached) ── -->
            <div class="exam-field" id="exam-scan-mode-field" style="display:none;">
              <label>Generation Mode</label>
              <div class="exam-scan-grid">

                <div class="exam-scan-card active" data-mode="quick" data-action="examSelectScanMode-self">
                  <div class="exam-scan-top">
                    <span class="exam-scan-icon">⚡</span>
                    <span class="exam-scan-badge" style="background:rgba(45,212,191,0.12);color:var(--teal);">~4s</span>
                  </div>
                  <div class="exam-scan-name">Quick</div>
                  <div class="exam-scan-desc">Fixed question count from your material. Fast, great for a quick quiz.</div>
                </div>

                <div class="exam-scan-card" data-mode="smart" data-action="examSelectScanMode-self">
                  <div class="exam-scan-top">
                    <span class="exam-scan-icon">🧠</span>
                    <span class="exam-scan-badge" style="background:rgba(139,124,248,0.12);color:var(--violet);">~6s</span>
                  </div>
                  <div class="exam-scan-name">Smart</div>
                  <div class="exam-scan-desc">AI reads the full document first, then generates questions covering every section.</div>
                </div>

                <div class="exam-scan-card" data-mode="deep" data-action="examSelectScanMode-self">
                  <div class="exam-scan-top">
                    <span class="exam-scan-icon">🔬</span>
                    <span class="exam-scan-badge" style="background:rgba(232,172,46,0.12);color:var(--gold);">~20s</span>
                  </div>
                  <div class="exam-scan-name">Deep Scan</div>
                  <div class="exam-scan-desc">Chunks your document, extracts every concept, and generates one question per concept.</div>
                </div>

              </div>
              <!-- Deep scan note -->
              <div id="exam-deep-note" style="display:none;margin-top:8px;font-size:11px;color:var(--text-4);padding:8px 12px;background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:var(--r-sm);line-height:1.5;">
                🔬 Deep Scan generates <strong style="color:var(--gold);">one question per concept</strong> found across your entire document — ignoring the question count unless you set it above 10 to cap large results.
              </div>
            </div>
            <!-- /Scan Mode -->

            <div class="exam-row">
              <div class="exam-field">
                <label id="exam-count-label">Number of Questions</label>
                <select class="exam-input" id="exam-count-input">
                  <option value="5">5 questions</option>
                  <option value="10" selected>10 questions</option>
                  <option value="15">15 questions</option>
                  <option value="20">20 questions</option>
                  <option value="30">30 questions</option>
                </select>
              </div>
              <div class="exam-field">
                <label>Time Limit</label>
                <select class="exam-input" id="exam-time-input">
                  <option value="0">No limit</option>
                  <option value="300">5 minutes</option>
                  <option value="600" selected>10 minutes</option>
                  <option value="900">15 minutes</option>
                  <option value="1800">30 minutes</option>
                </select>
              </div>
            </div>

            <div class="exam-field">
              <label>Question Type</label>
              <div class="exam-type-grid exam-type-grid-5" id="exam-type-grid">
                <button class="exam-type-btn active" data-type="mcq" data-action="examSelectType-self">
                  <span class="etb-icon">🔘</span>Multiple Choice
                </button>
                <button class="exam-type-btn" data-type="truefalse" data-action="examSelectType-self">
                  <span class="etb-icon">✅</span>True / False
                </button>
                <button class="exam-type-btn" data-type="situational" data-action="examSelectType-self">
                  <span class="etb-icon">⚡</span>Situational
                </button>
                <button class="exam-type-btn" data-type="cbl" data-action="examSelectType-self">
                  <span class="etb-icon">🩺</span>Case-Based
                </button>
                <button class="exam-type-btn" data-type="mixed" data-action="examSelectType-self">
                  <span class="etb-icon">🎲</span>Mixed
                </button>
                <button class="exam-type-btn" data-type="openended" data-action="examSelectType-self">
                  <span class="etb-icon">✍️</span>Open-Ended
                </button>
              </div>
              <!-- CBL hint -->
              <div id="exam-cbl-hint" style="display:none;margin-top:8px;font-size:12px;color:#e0c4c4;padding:10px 14px;background:rgba(220,38,38,0.13);border:1px solid rgba(220,38,38,0.35);border-radius:var(--r-sm);line-height:1.6;">
                🩺 Case-Based Learning presents a full clinical vignette — patient age, sex, chief complaint, history, vitals, and labs — then asks for the <strong style="color:#ff8a8a;font-weight:700;">diagnosis, next best step, or treatment</strong>. Designed for medical students.
              </div>
              <!-- Situational hint -->
              <div id="exam-situational-hint" style="display:none;margin-top:8px;font-size:12px;color:#c8c0e0;padding:10px 14px;background:rgba(139,92,246,0.13);border:1px solid rgba(139,92,246,0.35);border-radius:var(--r-sm);line-height:1.6;">
                📋 Situational questions present a real-world scenario (patient case, workplace event, academic problem) and ask what the <strong style="color:#b899ff;font-weight:700;">best course of action</strong> is. Great for clinical, professional, or applied exams.
              </div>
              <!-- Open-Ended hint -->
              <div id="exam-openended-hint" style="display:none;margin-top:8px;font-size:12px;color:#c0d8c0;padding:10px 14px;background:rgba(45,212,191,0.08);border:1px solid rgba(45,212,191,0.25);border-radius:var(--r-sm);line-height:1.6;">
                ✍️ Open-ended questions require a written response. The AI will read your answer and score it based on accuracy, completeness, and understanding — giving you detailed feedback on what you got right and what to improve.
              </div>
            </div>

            <div class="exam-field">
              <label>Difficulty</label>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="exam-type-btn" data-diff="easy" data-action="examSelectDiff-self" style="flex:1;">Easy</button>
                <button class="exam-type-btn active" data-diff="medium" data-action="examSelectDiff-self" style="flex:1;">Medium</button>
                <button class="exam-type-btn" data-diff="hard" data-action="examSelectDiff-self" style="flex:1;">Hard</button>
                <button class="exam-type-btn" data-diff="adaptive" data-action="examSelectDiff-self" style="flex:1;border-color:rgba(139,124,248,0.4);color:var(--violet);">
                  ⚡ Adaptive
                </button>
              </div>
              <div id="exam-adaptive-diff-hint" style="display:none;margin-top:8px;font-size:11px;color:var(--violet);padding:8px 12px;background:rgba(139,124,248,0.08);border:1px solid rgba(139,124,248,0.25);border-radius:var(--r-sm);line-height:1.6;">
                ⚡ <strong>Adaptive mode</strong> generates 3 difficulty pools and dynamically escalates or drops difficulty based on your answers — get 2 right in a row and it gets harder, miss 2 and it eases up.
              </div>
            </div>

            <div id="exam-error" style="display:none;font-size:12px;color:#f87171;padding:10px 14px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:var(--r-sm);"></div>

            <button class="exam-start-btn" id="exam-start-btn" data-action="examStart">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Generate Exam
            </button>
          </div>
        </div>
      </div><!-- /exam-setup -->

      <!-- LOADING -->
      <div id="exam-loading" style="display:none;text-align:center;padding:60px 24px;">
        <div style="display:flex;justify-content:center;gap:5px;margin-bottom:16px;">
          <span style="width:6px;height:6px;border-radius:50%;background:var(--gold);animation:blink 1s ease-in-out infinite;display:inline-block;"></span>
          <span style="width:6px;height:6px;border-radius:50%;background:var(--gold);animation:blink 1s ease-in-out 0.2s infinite;display:inline-block;"></span>
          <span style="width:6px;height:6px;border-radius:50%;background:var(--gold);animation:blink 1s ease-in-out 0.4s infinite;display:inline-block;"></span>
        </div>
        <div style="font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--text-1);margin-bottom:6px;" id="exam-loading-text">Generating your exam…</div>
        <div style="font-size:12px;color:var(--text-4);">Writing questions on <span id="exam-loading-topic" style="color:var(--gold);"></span></div>
        <div id="exam-loading-adaptive" style="display:none;margin-top:8px;font-size:11px;color:var(--violet);font-weight:500;"></div>

        <!-- Deep scan progress (hidden for quick/smart) -->
        <div id="exam-deep-progress" style="display:none;margin-top:28px;max-width:400px;margin-left:auto;margin-right:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span id="exam-deep-step-text" style="font-size:11px;color:var(--text-3);font-family:var(--font-mono);text-align:left;"></span>
            <span id="exam-deep-pct" style="font-size:11px;color:var(--gold);font-family:var(--font-mono);">0%</span>
          </div>
          <div style="height:3px;background:var(--surface-4);border-radius:2px;overflow:hidden;">
            <div id="exam-deep-bar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--gold),var(--violet));border-radius:2px;transition:width 0.4s ease;"></div>
          </div>
          <div id="exam-deep-stages" style="display:flex;justify-content:space-between;margin-top:12px;gap:6px;">
            <div class="exam-deep-stage" id="stage-chunk">
              <div class="exam-deep-stage-dot"></div>
              <div class="exam-deep-stage-label">Split</div>
            </div>
            <div class="exam-deep-stage-line"></div>
            <div class="exam-deep-stage" id="stage-extract">
              <div class="exam-deep-stage-dot"></div>
              <div class="exam-deep-stage-label">Extract</div>
            </div>
            <div class="exam-deep-stage-line"></div>
            <div class="exam-deep-stage" id="stage-generate">
              <div class="exam-deep-stage-dot"></div>
              <div class="exam-deep-stage-label">Generate</div>
            </div>
          </div>
        </div>
      </div><!-- /exam-loading -->

      <!-- QUIZ VIEW -->
      <div id="exam-quiz" style="display:none;">
        <div class="exam-topbar">
          <button data-action="examAbort" class="hover-abort-btn" style="background:transparent;border:none;color:var(--text-4);cursor:pointer;font-size:12px;font-family:var(--font-body);display:flex;align-items:center;gap:4px;padding:0;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
            Exit
          </button>
          <div class="exam-progress-wrap">
            <div class="exam-progress-label">
              <span id="exam-q-label">Question 1 of 10</span>
              <span id="exam-score-live">0 correct</span>
            </div>
            <div class="exam-progress-track">
              <div class="exam-progress-fill" id="exam-progress-fill" style="width:0%"></div>
            </div>
          </div>
          <div class="exam-timer" id="exam-timer-display">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span id="exam-timer-text">--:--</span>
          </div>
          <div id="exam-adaptive-diff-badge" style="display:none;font-size:10px;font-weight:600;padding:3px 9px;background:rgba(139,124,248,0.12);border:1px solid rgba(139,124,248,0.3);border-radius:20px;color:var(--violet);white-space:nowrap;"></div>
        </div>

        <div id="exam-q-card" class="exam-q-card">
          <div class="exam-q-header">
            <div id="exam-q-ref" style="display:none;" class="exam-q-ref">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span id="exam-q-ref-text"></span>
            </div>
            <div class="exam-q-num" id="exam-q-num">QUESTION 1</div>
            <!-- CBL Clinical Vignette Card -->
            <div id="exam-cbl-card" style="display:none;" class="exam-cbl-card">
              <div class="exam-cbl-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                <span>Clinical Vignette</span>
                <span id="exam-cbl-tag" class="exam-cbl-tag"></span>
              </div>
              <div id="exam-cbl-vitals" class="exam-cbl-vitals"></div>
              <div id="exam-cbl-body" class="exam-cbl-body"></div>
            </div>
            <div class="exam-q-text" id="exam-q-text">Loading…</div>
          </div>
          <div class="exam-options" id="exam-options"></div>
          <!-- Open-ended answer area (shown instead of options for open-ended questions) -->
          <div id="exam-openended-area" style="display:none;padding:0 0 8px;">
            <textarea id="exam-openended-input"
              placeholder="Type your answer here… Aim for 2–5 sentences. The AI will evaluate your response for accuracy and completeness."
              style="width:100%;min-height:110px;padding:12px 14px;background:var(--surface-3);border:1px solid var(--border-sm);border-radius:var(--r-sm);color:var(--text-1);font-size:13px;font-family:var(--font-body);line-height:1.6;resize:vertical;box-sizing:border-box;"
              oninput="examOpenEndedInput(this)"></textarea>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
              <span id="exam-oe-char-count" style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);">0 chars</span>
              <span id="exam-oe-hint" style="font-size:10px;color:var(--text-4);">Press Next to submit for AI grading</span>
            </div>
          </div>
          <div class="exam-feedback" id="exam-feedback"></div>
        </div>

        <div class="exam-nav">
          <div style="font-size:11px;color:var(--text-4);" id="exam-answered-hint"></div>
          <div style="display:flex;gap:8px;">
            <button class="exam-nav-btn secondary" id="exam-skip-btn" data-action="examSkip">Skip</button>
            <button class="exam-nav-btn primary" id="exam-next-btn" data-action="examNext" disabled>Next →</button>
          </div>
        </div>
      </div><!-- /exam-quiz -->

      <!-- RESULTS VIEW -->
      <div id="exam-results" style="display:none;">
        <div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-4);letter-spacing:0.06em;margin-bottom:4px;">EXAM COMPLETE</div>
            <div style="font-family:var(--font-head);font-size:18px;font-weight:700;color:var(--text-1);" id="results-topic-title"></div>
          </div>
          <button onclick="examShowHistory()" style="display:flex;align-items:center;gap:5px;padding:6px 12px;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-sm);color:var(--text-3);font-size:11px;font-family:var(--font-body);cursor:pointer;" onmouseenter="this.style.background='var(--surface-3)'" onmouseleave="this.style.background='var(--surface-2)'">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            View History
          </button>
        </div>
        <div class="exam-results-card">
          <div class="exam-results-header">
            <div class="exam-score-ring" id="score-ring">0%</div>
            <h3 id="results-headline">Good effort!</h3>
            <p id="results-subline">Review the questions below to see where you went wrong.</p>
          </div>
          <div class="exam-stats-row">
            <div class="exam-stat">
              <div class="exam-stat-num" id="stat-correct">0</div>
              <div class="exam-stat-label">Correct</div>
            </div>
            <div class="exam-stat">
              <div class="exam-stat-num" id="stat-wrong" style="color:var(--text-3);">0</div>
              <div class="exam-stat-label">Wrong / Skipped</div>
            </div>
            <div class="exam-stat">
              <div class="exam-stat-num" id="stat-time-taken">—</div>
              <div class="exam-stat-label">Time Taken</div>
            </div>
            <div class="exam-stat">
              <div class="exam-stat-num" id="stat-streak">0</div>
              <div class="exam-stat-label">Best Streak</div>
            </div>
          </div>
          <div class="exam-review" id="exam-review-list"></div>

          <!-- ── Weak Concepts Panel (shown when student got questions wrong) ── -->
          <div id="exam-weak-panel" style="display:none; margin:0 24px 4px; padding:16px 18px; background:rgba(248,113,113,0.06); border:1px solid rgba(248,113,113,0.18); border-radius:var(--r-sm);">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style="font-size:11px;font-weight:700;color:#f87171;letter-spacing:0.06em;text-transform:uppercase;">Concepts to Review</span>
              <span id="exam-weak-count" style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);margin-left:auto;"></span>
            </div>
            <div id="exam-weak-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;"></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="exam-nav-btn secondary" id="exam-goto-flash-btn" onclick="examGoToFlashcards()" style="font-size:11px;padding:7px 14px;display:flex;align-items:center;gap:6px;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                Study with Flashcards
              </button>
              <button class="exam-nav-btn secondary" id="exam-goto-visual-btn" onclick="examGoToVisualTutor()" style="font-size:11px;padding:7px 14px;display:flex;align-items:center;gap:6px;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                Explain with Visual Tutor
              </button>
              <!-- Task 6: Review weak concepts directly in workspace chat -->
              <button class="exam-nav-btn secondary" id="exam-goto-chat-btn" onclick="examGoToChat()" style="font-size:11px;padding:7px 14px;display:flex;align-items:center;gap:6px;border-color:var(--border-md);color:var(--text-2);">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Review in Chat
              </button>
            </div>
          </div>

          <div class="exam-actions">
            <button class="exam-nav-btn primary" data-action="examRetry" style="flex:1;">
              Retake Exam
            </button>
            <button class="exam-nav-btn secondary" data-action="examNewTopic" style="flex:1;">
              New Topic
            </button>
          </div>
        </div>
      </div><!-- /exam-results -->

      <!-- ══ HISTORY VIEW (Task 2) ══════════════════════════════════════ -->
      <div id="exam-history-view" style="display:none;padding:0 0 40px;">

        <!-- Header -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          <button onclick="examHideHistory()" style="display:flex;align-items:center;gap:5px;background:transparent;border:none;color:var(--text-4);cursor:pointer;font-size:12px;font-family:var(--font-body);padding:0;" onmouseenter="this.style.color='var(--text-2)'" onmouseleave="this.style.color='var(--text-4)'">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;">Exam History</div>
            <div style="font-family:var(--font-head);font-size:18px;font-weight:700;color:var(--text-1);">Your Progress Over Time</div>
          </div>
          <button onclick="examClearHistory()" style="margin-left:auto;display:flex;align-items:center;gap:5px;padding:6px 11px;background:transparent;border:1px solid rgba(248,113,113,0.25);border-radius:var(--r-sm);color:#f87171;font-size:11px;font-family:var(--font-body);cursor:pointer;" onmouseenter="this.style.background='rgba(248,113,113,0.07)'" onmouseleave="this.style.background='transparent'">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Clear All
          </button>
        </div>

        <!-- Summary stats -->
        <div id="exam-hist-summary" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px;"></div>

        <!-- Topic progress section -->
        <div style="margin-bottom:24px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:12px;">Progress by Topic</div>
          <div id="exam-hist-topics" style="display:flex;flex-direction:column;gap:10px;"></div>
        </div>

        <!-- Full history table -->
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:12px;">All Attempts</div>
          <div id="exam-hist-table" style="display:flex;flex-direction:column;gap:6px;"></div>
        </div>

      </div><!-- /exam-history-view -->

    </div><!-- /exam-wrap -->
  </main>
</div><!-- /#screen-exam -->
`;function Wt(){const t=document.querySelector("[data-exam-screen]");if(!t){console.warn("[ExamScreen] placeholder [data-exam-screen] not found");return}t.outerHTML=Vt;const e=document.getElementById("exam-notes-input");e&&e.addEventListener("input",()=>{const s=e.value.length,n=document.getElementById("exam-notes-count");n&&(n.textContent=s.toLocaleString()+" chars"),window._examSourceText=e.value.slice(0,6e4),window._examSourceLabel="your notes",typeof window._examToggleScanMode=="function"&&window._examToggleScanMode(s>0)});const i=document.getElementById("exam-topic-input"),o=document.getElementById("exam-adaptive-badge");if(i&&o){const s=()=>{const n=typeof window._examGetWeakContext=="function"?window._examGetWeakContext(i.value.trim()):null;o.style.display=n?"flex":"none",n&&(o.title=`Focusing on: ${n.concepts.slice(0,3).join(", ")} (${n.attempts} past attempt${n.attempts>1?"s":""}, avg ${n.avgScore}%)`)};i.addEventListener("input",s),setTimeout(s,300)}}Wt();console.log("[ExamScreen] module loaded ✦");const Gt=`
<div class="screen" id="screen-studyplan">

  <!-- SIDEBAR -->
  <aside class="sidebar" data-sidebar-screen="studyplan"></aside>

  <!-- MAIN -->
  <div class="sp-main" style="position:relative;">

    <!-- TOP BAR -->
    <div class="sp-topbar">
      <button type="button" class="mst-back sp-back-btn" data-action="goHome" aria-label="Back" style="display:none;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--gold);flex-shrink:0;"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      <span class="sp-topbar-title">Study Plan</span>
      <span class="sp-topbar-badge">CRITICAL PATH</span>
      <div class="sp-topbar-actions">
        <button class="sp-topbar-btn" id="btn-switch-plan" data-action="spShowPlansMenu">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
          My Plans
        </button>
        <button class="sp-topbar-btn" id="btn-new-plan" data-action="spShowEmpty" style="display:none;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Plan
        </button>
        <button class="sp-topbar-btn" id="btn-active-plan" data-action="spShowPlan" style="display:none;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
          View Plan
        </button>
      </div>

    </div>

    <!-- BODY -->
    <div class="sp-body">

      <!-- ══ EMPTY / SETUP STATE ══ -->
      <div id="sp-empty-state" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;width:100%;">
        <div class="sp-setup">

          <!-- Hero -->
          <div class="sp-setup-hero">
            <div class="sp-setup-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e8ac2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div class="sp-setup-title">Build Your Critical Path</div>
            <div class="sp-setup-subtitle">Upload your lecture slides or enter a topic — the AI will break it into essential concepts and guide you step-by-step to full mastery.</div>
            <div class="sp-hero-chips">
              <span class="sp-hero-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>Step-by-step pacing</span>
              <span class="sp-hero-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Mastery tracking</span>
              <span class="sp-hero-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>AI flashcards</span>
              <span class="sp-hero-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 11l3 3L22 4"/></svg>Exam simulation</span>
            </div>
          </div>

          <!-- Setup Card -->
          <div class="sp-setup-card">
            <div class="sp-setup-card-header">
              <h2>Create a Study Plan</h2>
              <p>Choose a topic or upload your material — we handle the rest.</p>
            </div>
            <div class="sp-setup-card-body">

              <!-- Source tabs -->
              <div class="sp-field">
                <label>Source Material</label>
                <div class="sp-src-tabs">
                  <button class="sp-src-tab active" id="sp-tab-upload" onclick="spSwitchTab('upload')">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Upload Slides
                  </button>
                  <button class="sp-src-tab" id="sp-tab-topic" onclick="spSwitchTab('topic')">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                    Enter Topic
                  </button>
                  <button class="sp-src-tab" id="sp-tab-notes" onclick="spSwitchTab('notes')">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Paste Notes
                  </button>
                </div>
              </div>

              <!-- Upload zone -->
              <div id="sp-src-upload">
                <input type="file" id="sp-file-input" accept="application/pdf" style="display:none;" onchange="spHandleFileSelect(this.files[0])">
                <div class="sp-upload-zone" id="sp-upload-idle"
                  onclick="document.getElementById('sp-file-input').click()"
                  ondragover="spDragOver(event)"
                  ondragleave="spDragLeave(event)"
                  ondrop="spDrop(event)">
                  <div class="sp-upload-zone-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-3);"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <div class="sp-upload-zone-label">Drop a PDF here or click to browse</div>
                  <div class="sp-upload-zone-sub">AI will extract every concept from your slides</div>
                </div>
                <div id="sp-upload-attached" style="display:none;">
                  <div style="display:flex;align-items:center;gap:10px;padding:11px 13px;background:var(--surface-2);border:1px solid var(--gold-border);border-radius:var(--r-md);">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span id="sp-file-name" style="font-size:12px;font-weight:600;color:var(--text-1);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
                    <span id="sp-file-pages" style="font-size:11px;color:var(--text-3);font-family:var(--font-mono);flex-shrink:0;"></span>
                    <button data-action="spClearUpload" class="hover-del-btn" style="background:none;border:none;cursor:pointer;color:var(--text-3);padding:2px;display:flex;align-items:center;transition:color 120ms;">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div id="sp-extract-status" style="display:none;align-items:center;gap:7px;margin-top:8px;font-size:11px;color:var(--text-3);">
                    <div class="sp-spinner"></div>
                    <span id="sp-extract-msg">Extracting text from PDF…</span>
                  </div>
                  <div id="sp-extract-done" style="display:none;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:var(--green);">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span id="sp-extract-chars"></span> characters extracted — ready to generate
                  </div>
                </div>
              </div>

              <!-- Topic input -->
              <div id="sp-src-topic" style="display:none;">
                <div class="sp-field">
                  <label>Topic or Subject</label>
                  <input class="sp-input" type="text" placeholder="e.g. Nucleophilic Substitution, The French Revolution, Mitosis…" id="sp-topic-input">
                </div>
                <div class="sp-field" style="margin-top:12px;">
                  <label>Depth <span style="color:var(--text-4);font-weight:400;">(optional)</span></label>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="sp-activity-chip active-chip" id="sp-depth-intro" onclick="spSetDepth('intro')">Introductory</button>
                    <button class="sp-activity-chip" id="sp-depth-mid" onclick="spSetDepth('mid')">Intermediate</button>
                    <button class="sp-activity-chip" id="sp-depth-adv" onclick="spSetDepth('adv')">Advanced</button>
                    <button class="sp-activity-chip" id="sp-depth-exam" onclick="spSetDepth('exam')">Exam Prep</button>
                  </div>
                </div>
              </div>

              <!-- Notes textarea -->
              <div id="sp-src-notes" style="display:none;">
                <textarea class="sp-input" id="sp-notes-input" rows="5"
                  style="resize:none;line-height:1.6;"
                  placeholder="Paste your notes, lecture text, or any content to build the plan from…"
                  oninput="spUpdateNotesCount()"></textarea>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
                  <span id="sp-notes-count" style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);">0 chars</span>
                  <button onclick="document.getElementById('sp-notes-input').value='';spUpdateNotesCount();" class="hover-clear-btn" style="font-size:10px;color:var(--text-4);background:none;border:none;cursor:pointer;font-family:var(--font-body);">Clear</button>
                </div>
              </div>

              <!-- Validation error -->
              <div id="sp-validation-error" style="display:none;align-items:center;gap:7px;padding:10px 13px;background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);border-radius:var(--r-md);font-size:12px;color:var(--red);">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span id="sp-validation-msg">Please provide a topic or upload a file.</span>
              </div>

              <button class="sp-generate-btn" id="sp-generate-btn" data-action="spHandleGenerate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Generate Critical Path
              </button>

            </div>
          </div>

        </div>
      </div>

      <!-- ══ ACTIVE / POPULATED STATE ══ -->
      <div id="sp-active-state" style="display:none;flex:1;overflow:hidden;">
        <div class="sp-body" style="height:100%;">

          <!-- Roadmap column -->
          <div class="sp-roadmap-col">

            <!-- Plan header -->
            <div class="sp-plan-header">
              <div class="sp-plan-header-info">
                <div class="sp-plan-header-eyebrow">Study Plan · Organic Chemistry</div>
                <div class="sp-plan-header-title">Nucleophilic Substitution Reactions</div>
                <div class="sp-plan-header-sub">6 core concepts · ~4 hrs to mastery · Based on Klein, Ch. 7</div>
              <!-- Exam date row -->
              <div id="sp-exam-date-row" style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
                <div id="sp-exam-date-display" style="display:none;align-items:center;gap:6px;padding:4px 10px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:var(--r-pill);font-size:11px;font-family:var(--font-mono);color:#f87171;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span id="sp-exam-date-label">Exam: —</span>
                  <span id="sp-exam-days-left" style="font-size:10px;opacity:0.75;"></span>
                  <button onclick="spClearExamDate()" style="background:none;border:none;cursor:pointer;color:#f87171;padding:0 0 0 2px;line-height:1;font-size:14px;" title="Remove exam date">×</button>
                </div>
                <button id="sp-set-exam-date-btn" onclick="spShowExamDatePicker()" style="display:flex;align-items:center;gap:5px;padding:4px 10px;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-pill);font-size:11px;color:var(--text-3);cursor:pointer;font-family:var(--font-body);transition:color var(--t-fast),border-color var(--t-fast);">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Set Exam Date
                </button>
              </div>
              <!-- Exam date picker (hidden) -->
              <div id="sp-exam-date-picker" style="display:none;margin-top:8px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-md);display:none;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-size:11px;color:var(--text-3);">Exam date:</span>
                <input type="date" id="sp-exam-date-input" style="background:var(--surface-3);border:1px solid var(--border-sm);border-radius:var(--r-sm);padding:4px 8px;color:var(--text-1);font-size:12px;font-family:var(--font-mono);cursor:pointer;" onchange="spSetExamDate(this.value)">
                <button onclick="document.getElementById('sp-exam-date-picker').style.display='none';" style="background:none;border:none;cursor:pointer;color:var(--text-4);font-size:18px;line-height:1;padding:0;">×</button>
              </div>
              <!-- Daily reminder row (hidden until exam date is set) -->
              <div id="sp-reminder-row" style="display:none;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap;">
                <button id="sp-reminder-btn" onclick="spToggleReminder()" style="display:flex;align-items:center;gap:5px;padding:4px 10px;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-pill);font-size:11px;color:var(--text-3);cursor:pointer;font-family:var(--font-body);transition:color var(--t-fast),border-color var(--t-fast),background var(--t-fast);">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  <span id="sp-reminder-btn-label">Enable daily reminder</span>
                </button>
                <div id="sp-reminder-time-wrap" style="display:none;align-items:center;gap:5px;">
                  <span style="font-size:11px;color:var(--text-4);">at</span>
                  <input type="time" id="sp-reminder-time" value="20:00" style="background:var(--surface-3);border:1px solid var(--border-sm);border-radius:var(--r-sm);padding:2px 6px;color:var(--text-1);font-size:11px;font-family:var(--font-mono);cursor:pointer;">
                  <button onclick="spUpdateReminderTime(document.getElementById('sp-reminder-time').value)" style="padding:2px 8px;background:var(--surface-3);border:1px solid var(--border-sm);border-radius:var(--r-pill);font-size:10px;color:var(--text-3);cursor:pointer;font-family:var(--font-body);transition:color var(--t-fast),border-color var(--t-fast);">Set</button>
                </div>
              </div>
            </div>
              <div class="sp-overall-ring">
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="24" fill="none" stroke="var(--surface-3)" stroke-width="5"/>
                  <circle id="sp-ring-arc" cx="30" cy="30" r="24" fill="none" stroke="var(--gold)" stroke-width="5"
                    stroke-dasharray="150.8" stroke-dashoffset="150.8"
                    stroke-linecap="round" transform="rotate(-90 30 30)"/>
                  <text id="sp-ring-pct" x="30" y="34" text-anchor="middle" font-family="'Syne',sans-serif" font-size="12" font-weight="800" fill="#ededf0">0%</text>
                </svg>
                <div class="sp-overall-ring-label">Overall</div>
              </div>
            </div>

            <!-- Stats row -->
            <div class="sp-stats-row" id="sp-stats-row-chips"></div>

            <!-- Roadmap label -->
            <div class="sp-roadmap-label">Critical Path to Mastery</div>

            <!-- THE PATH -->
            <div class="sp-path">

              <!-- ① MASTERED -->
              <div class="sp-node">
                <div class="sp-node-bullet mastered">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div class="sp-node-card">
                  <div class="sp-node-card-top">
                    <div class="sp-node-card-title">1. Nucleophiles &amp; Electrophiles</div>
                    <span class="sp-node-status-badge mastered">Mastered</span>
                  </div>
                  <div class="sp-node-card-desc">Understand what makes a molecule a nucleophile or electrophile, and how electron density drives reactivity.</div>
                  <div class="sp-mastery-bar-wrap">
                    <div class="sp-mastery-bar-track"><div class="sp-mastery-bar-fill" style="width:100%;background:var(--green);"></div></div>
                    <div class="sp-mastery-pct" style="color:var(--green);">100%</div>
                  </div>
                  <div class="sp-activities" style="margin-top:10px;">
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> AI Explain</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Flashcards</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Practice Q's</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Mini Exam</span>
                  </div>
                </div>
              </div>

              <!-- ② MASTERED -->
              <div class="sp-node">
                <div class="sp-node-bullet mastered">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div class="sp-node-card">
                  <div class="sp-node-card-top">
                    <div class="sp-node-card-title">2. Leaving Groups &amp; Substrate Structure</div>
                    <span class="sp-node-status-badge mastered">Mastered</span>
                  </div>
                  <div class="sp-node-card-desc">Identify good vs. poor leaving groups, and understand how primary, secondary, and tertiary substrates behave differently.</div>
                  <div class="sp-mastery-bar-wrap">
                    <div class="sp-mastery-bar-track"><div class="sp-mastery-bar-fill" style="width:100%;background:var(--green);"></div></div>
                    <div class="sp-mastery-pct" style="color:var(--green);">100%</div>
                  </div>
                  <div class="sp-activities" style="margin-top:10px;">
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> AI Explain</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Flashcards</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Practice Q's</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Mini Exam</span>
                  </div>
                </div>
              </div>

              <!-- ③ IN PROGRESS -->
              <div class="sp-node">
                <div class="sp-node-bullet in-progress"><span style="font-size:13px;">3</span></div>
                <div class="sp-node-card active-card">
                  <div class="sp-node-card-top">
                    <div class="sp-node-card-title">3. The SN2 Mechanism</div>
                    <span class="sp-node-status-badge in-progress">In Progress</span>
                  </div>
                  <div class="sp-node-card-desc">Master the concerted backside-attack mechanism: transition state geometry, stereochemical inversion (Walden inversion), and rate law.</div>
                  <div class="sp-mastery-bar-wrap">
                    <div class="sp-mastery-bar-track"><div class="sp-mastery-bar-fill" style="width:65%;background:var(--gold);"></div></div>
                    <div class="sp-mastery-pct" style="color:var(--gold);">65%</div>
                  </div>
                  <div class="sp-activities" style="margin-top:10px;">
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> AI Explain</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Flashcards</span>
                    <span class="sp-activity-chip active-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Practice Q's</span>
                    <span class="sp-activity-chip locked-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Mini Exam</span>
                  </div>
                </div>
              </div>

              <!-- ④ READY -->
              <div class="sp-node">
                <div class="sp-node-bullet ready"><span style="font-size:13px;">4</span></div>
                <div class="sp-node-card">
                  <div class="sp-node-card-top">
                    <div class="sp-node-card-title">4. The SN1 Mechanism</div>
                    <span class="sp-node-status-badge ready">Ready</span>
                  </div>
                  <div class="sp-node-card-desc">Understand carbocation formation, racemization, solvent effects, and why SN1 favors tertiary substrates in polar protic solvents.</div>
                  <div class="sp-mastery-bar-wrap">
                    <div class="sp-mastery-bar-track"><div class="sp-mastery-bar-fill" style="width:0%;background:var(--violet);"></div></div>
                    <div class="sp-mastery-pct">0%</div>
                  </div>
                  <div class="sp-activities" style="margin-top:10px;">
                    <span class="sp-activity-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg> AI Explain</span>
                    <span class="sp-activity-chip locked-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Flashcards</span>
                    <span class="sp-activity-chip locked-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Practice Q's</span>
                    <span class="sp-activity-chip locked-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Mini Exam</span>
                  </div>
                </div>
              </div>

              <!-- ⑤ LOCKED -->
              <div class="sp-node">
                <div class="sp-node-bullet locked"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                <div class="sp-node-card">
                  <div class="sp-node-card-top">
                    <div class="sp-node-card-title">5. SN1 vs SN2 — Predicting the Pathway</div>
                    <span class="sp-node-status-badge locked">Locked</span>
                  </div>
                  <div class="sp-node-card-desc">Apply decision-making frameworks to predict which mechanism dominates based on substrate, nucleophile, solvent, and temperature.</div>
                  <div class="sp-mastery-bar-wrap">
                    <div class="sp-mastery-bar-track"><div class="sp-mastery-bar-fill" style="width:0%;background:var(--text-4);"></div></div>
                    <div class="sp-mastery-pct">—</div>
                  </div>
                  <div class="sp-activities" style="margin-top:10px;">
                    <span class="sp-activity-chip locked-chip">AI Explain</span>
                    <span class="sp-activity-chip locked-chip">Flashcards</span>
                    <span class="sp-activity-chip locked-chip">Practice Q's</span>
                    <span class="sp-activity-chip locked-chip">Mini Exam</span>
                  </div>
                </div>
              </div>

              <!-- ⑥ LOCKED -->
              <div class="sp-node">
                <div class="sp-node-bullet locked"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                <div class="sp-node-card">
                  <div class="sp-node-card-top">
                    <div class="sp-node-card-title">6. Exam Simulation — Full Topic</div>
                    <span class="sp-node-status-badge locked">Locked</span>
                  </div>
                  <div class="sp-node-card-desc">A timed, graded exam across all six concepts. Unlocks when all prior concepts reach 80%+ mastery.</div>
                  <div class="sp-mastery-bar-wrap">
                    <div class="sp-mastery-bar-track"><div class="sp-mastery-bar-fill" style="width:0%;"></div></div>
                    <div class="sp-mastery-pct">—</div>
                  </div>
                  <div style="margin-top:10px;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-4);">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Unlock by completing all previous concepts
                  </div>
                </div>
              </div>

            </div><!-- /.sp-path -->
          </div><!-- /.sp-roadmap-col -->

          <!-- Right detail panel -->
          <div class="sp-detail-col" id="sp-detail-col">
            <div>
              <div class="sp-detail-section-title">Overall Progress</div>
              <div class="sp-donut-wrap">
                <svg id="sp-donut-svg" width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="var(--surface-3)" stroke-width="10"/>
                  <circle id="sp-donut-mastered" cx="60" cy="60" r="48" fill="none" stroke="var(--green)" stroke-width="10" stroke-dasharray="301.6" stroke-dashoffset="301.6" stroke-linecap="round" transform="rotate(-90 60 60)"/>
                  <circle id="sp-donut-inprogress" cx="60" cy="60" r="48" fill="none" stroke="var(--gold)" stroke-width="10" stroke-dasharray="301.6" stroke-dashoffset="301.6" stroke-linecap="round" transform="rotate(-90 60 60)"/>
                  <text id="sp-donut-pct" x="60" y="55" text-anchor="middle" font-family="'Syne',sans-serif" font-size="22" font-weight="800" fill="#ededf0">0%</text>
                  <text x="60" y="72" text-anchor="middle" font-family="'DM Sans',sans-serif" font-size="10" fill="#55556a">mastery</text>
                </svg>
                <div class="sp-legend">
                  <div class="sp-legend-row"><div class="sp-legend-dot" style="background:var(--green);"></div>Mastered<div class="sp-legend-count" id="sp-leg-mastered">0 / 0</div></div>
                  <div class="sp-legend-row"><div class="sp-legend-dot" style="background:var(--gold);"></div>In Progress<div class="sp-legend-count" id="sp-leg-inprog">0 / 0</div></div>
                  <div class="sp-legend-row"><div class="sp-legend-dot" style="background:var(--violet);"></div>Ready<div class="sp-legend-count" id="sp-leg-ready">0 / 0</div></div>
                  <div class="sp-legend-row"><div class="sp-legend-dot" style="background:var(--text-4);"></div>Locked<div class="sp-legend-count" id="sp-leg-locked">0 / 0</div></div>
                </div>
              </div>
            </div>
            <div>
              <div class="sp-detail-section-title">Exam Readiness</div>
              <div class="sp-readiness">
                <div class="sp-readiness-header">
                  <div class="sp-readiness-title">Score Forecast</div>
                  <div class="sp-readiness-score" id="sp-readiness-score">0%</div>
                </div>
                <div class="sp-readiness-bar-track"><div class="sp-readiness-bar-fill" id="sp-readiness-bar"></div></div>
                <div class="sp-readiness-note" id="sp-readiness-note">Generate a study plan to see your forecast.</div>
              </div>
            </div>
            <div>
              <div class="sp-detail-section-title">Up Next</div>
              <div class="sp-upcoming" id="sp-upcoming-list">
                <div style="font-size:12px;color:var(--text-4);padding:8px 0;">Generate a plan to see suggestions.</div>
              </div>
            </div>
            <div style="padding:14px 16px;background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-lg);display:flex;align-items:center;gap:12px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <div>
                <div id="sp-time-remaining" style="font-size:12px;font-weight:600;color:var(--text-1);margin-bottom:2px;">—</div>
                <div id="sp-time-sub" style="font-size:11px;color:var(--text-3);">Complete activities to track your pace.</div>
              </div>
            </div>
          </div><!-- /.sp-detail-col -->

        </div><!-- inner sp-body -->
      </div><!-- /#sp-active-state -->

    </div><!-- /.sp-body -->
  </div><!-- /.sp-main -->

  <!-- ══ Generation Overlay ══ -->
  <div id="sp-generating-overlay">
    <div class="sp-gen-card">
      <div class="sp-spinner-lg"></div>
      <div>
        <div style="font-family:var(--font-head);font-size:16px;font-weight:800;color:var(--text-1);margin-bottom:4px;">Building Your Critical Path</div>
        <div style="font-size:12px;color:var(--text-3);">Analyzing material and mapping concepts…</div>
      </div>
      <div class="sp-gen-steps">
        <div class="sp-gen-step" id="gen-step-1"><div class="sp-gen-step-dot"></div>Reading source material</div>
        <div class="sp-gen-step" id="gen-step-2"><div class="sp-gen-step-dot"></div>Identifying core concepts</div>
        <div class="sp-gen-step" id="gen-step-3"><div class="sp-gen-step-dot"></div>Building prerequisite map</div>
        <div class="sp-gen-step" id="gen-step-4"><div class="sp-gen-step-dot"></div>Estimating time to mastery</div>
        <div class="sp-gen-step" id="gen-step-5"><div class="sp-gen-step-dot"></div>Finalizing critical path</div>
      </div>
    </div>
  </div>

<!-- Plans modal — lives at screen root so position:fixed is unclipped -->
<div id="sp-plans-modal-overlay" style="display:none;position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);align-items:center;justify-content:center;" onclick="if(event.target===this)spHidePlansMenu()">
  <div id="sp-plans-menu" class="sp-plans-modal-panel">
    <!-- Header -->
    <div class="sp-plans-modal-header">
      <div class="sp-plans-modal-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        My Plans
      </div>
      <div class="sp-plans-modal-meta" id="sp-plans-modal-count"></div>
      <button data-action="spHidePlansMenu" class="sp-plans-modal-close" title="Close">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <!-- Search -->
    <div class="sp-plans-modal-search-wrap">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--text-4);flex-shrink:0;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input id="sp-plans-search" class="sp-plans-modal-search" type="text" placeholder="Search plans…" oninput="spFilterPlansMenu(this.value)" autocomplete="off" />
    </div>
    <!-- List -->
    <div id="sp-plans-menu-list" class="sp-plans-modal-list"></div>
    <!-- Footer -->
    <div class="sp-plans-modal-footer">
      <button class="sp-plans-modal-new-btn" data-action="spHidePlansMenu" onclick="setTimeout(()=>{ if(typeof spShowEmpty==='function') spShowEmpty(); },80)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Plan
      </button>
    </div>
  </div>
</div>

</div><!-- /#screen-studyplan -->
`,Ut=`
<div id="sp-explain-drawer" role="dialog" aria-modal="true" aria-labelledby="sp-explain-title">

  <!-- Header -->
  <div class="sp-explain-header">
    <div class="sp-explain-header-icon" id="sp-drawer-icon" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e8ac2e" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
    </div>
    <div class="sp-explain-header-text">
      <div class="sp-explain-eyebrow" id="sp-drawer-eyebrow">AI Explain</div>
      <div id="sp-explain-title">Concept Title</div>
    </div>
    <button data-action="spCloseExplainDrawer" class="hover-close-btn" aria-label="Close AI Explain" style="background:none;border:none;cursor:pointer;color:var(--text-3);padding:4px;display:flex;align-items:center;border-radius:var(--r-sm);transition:color var(--t-fast),background var(--t-fast);">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  <!-- Tab bar -->
  <div class="sp-drawer-tabs" role="tablist" aria-label="Content tabs">
    <button class="sp-drawer-tab active" id="sp-tab-explain" role="tab" aria-selected="true" aria-controls="sp-panel-explain" data-action="spDrawerTab" data-tab="explain">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
      AI Explain
    </button>
    <button class="sp-drawer-tab" id="sp-tab-flash" role="tab" aria-selected="false" aria-controls="sp-panel-flash" data-action="spDrawerTab" data-tab="flash">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
      Flashcards
    </button>
    <button class="sp-drawer-tab" id="sp-tab-pq" role="tab" aria-selected="false" aria-controls="sp-panel-pq" data-action="spDrawerTab" data-tab="pq">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      Practice Q's
    </button>
    <button class="sp-drawer-tab" id="sp-tab-exam" role="tab" aria-selected="false" aria-controls="sp-panel-exam" data-action="spDrawerTab" data-tab="exam">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      Mini Exam
    </button>
    <button class="sp-drawer-tab sp-drawer-tab-visual" id="sp-tab-visual" role="tab" aria-selected="false" aria-label="Explain Visually" data-action="spOpenVisualTutor" style="color:var(--teal);border-bottom-color:transparent;gap:4px;">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/><path d="M10 10l2-2 2 2" stroke-width="1.5"/></svg>
      Visual
    </button>
  </div>

  <!-- Key terms -->
  <div id="sp-explain-chips"></div>

  <!-- EXPLAIN VIEW -->
  <div id="sp-view-explain" role="tabpanel" aria-labelledby="sp-tab-explain" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;">
    <div id="sp-explain-body" style="flex:1;overflow-y:auto;padding:20px 22px 32px;font-size:13.5px;line-height:1.85;color:var(--text-2);">
      <div class="sp-explain-spinner"></div>
    </div>
    <!-- Task 4: Study in Chat CTA at the bottom of each AI explanation -->
    <div id="sp-study-in-chat-bar" style="
      flex-shrink:0;
      padding:12px 20px 16px;
      border-top:1px solid var(--border-xs);
      background:var(--surface-1);
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
    ">
      <div style="font-size:11px;color:var(--text-3);line-height:1.4;">
        Want to go deeper? Ask follow-up questions in the chat.
      </div>
      <button
        id="sp-open-in-chat-btn"
        data-action="spOpenInWorkspace"
        style="
          flex-shrink:0;
          padding:7px 14px;
          border-radius:var(--r-pill);
          background:var(--surface-3);
          border:1px solid var(--border-md);
          color:var(--text-1);
          font-size:11px;
          font-weight:700;
          cursor:pointer;
          font-family:var(--font-body);
          display:flex;
          align-items:center;
          gap:6px;
          transition:background 0.15s,border-color 0.15s;
          white-space:nowrap;
        "
        onmouseenter="this.style.background='var(--surface-4)';this.style.borderColor='var(--violet-border)'"
        onmouseleave="this.style.background='var(--surface-3)';this.style.borderColor='var(--border-md)'"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Study in Chat →
      </button>
    </div>
  </div>

  <!-- FLASHCARD VIEW -->
  <div id="sp-view-flash" role="tabpanel" aria-labelledby="sp-tab-flash" style="flex:1;display:none;flex-direction:column;overflow:hidden;">
    <div id="sp-fc-loading" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--text-3);">
      <div class="sp-explain-spinner"></div>
      <div style="font-size:12px;">Generating flashcards…</div>
    </div>
    <div id="sp-fc-deck" style="flex:1;display:none;flex-direction:column;padding:16px 20px;gap:12px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="flex:1;height:3px;background:var(--surface-3);border-radius:2px;overflow:hidden;">
          <div id="sp-fc-progress-bar" style="height:100%;background:var(--gold);border-radius:2px;transition:width 0.3s;width:0%;"></div>
        </div>
        <span id="sp-fc-counter" style="font-size:11px;font-family:var(--font-mono);color:var(--text-4);flex-shrink:0;">1 / 10</span>
      </div>
      <div class="sp-fc-scene" data-action="spFcFlip">
        <div class="sp-fc-card" id="sp-fc-card">
          <div class="sp-fc-front">
            <div class="sp-fc-side-label">Question</div>
            <div id="sp-fc-front-text" class="sp-fc-text"></div>
            <div class="sp-fc-tap-hint">Tap to reveal answer</div>
          </div>
          <div class="sp-fc-back">
            <div class="sp-fc-side-label" style="color:var(--teal);">Answer</div>
            <div id="sp-fc-back-text" class="sp-fc-text"></div>
          </div>
        </div>
      </div>
      <div id="sp-fc-ratings" style="display:none;gap:8px;">
        <button class="sp-fc-rate-btn hard" onclick="spFcRate('hard')">😓 Hard</button>
        <button class="sp-fc-rate-btn ok"   onclick="spFcRate('ok')">🤔 OK</button>
        <button class="sp-fc-rate-btn easy" onclick="spFcRate('easy')">😄 Easy</button>
      </div>
    </div>
    <div id="sp-fc-complete" style="flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;">
      <div style="font-size:32px;">🎉</div>
      <div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--text-1);">Deck Complete!</div>
      <div id="sp-fc-result-text" style="font-size:12px;color:var(--text-3);line-height:1.6;"></div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button data-action="spFcRestart" style="padding:8px 16px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:12px;cursor:pointer;font-family:var(--font-body);">Restart</button>
        <button data-action="spDrawerTab" data-tab="explain" style="padding:8px 16px;border-radius:var(--r-pill);background:var(--gold);border:none;color:#090900;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body);">Back to Explain</button>
      </div>
    </div>
  </div>

  <!-- PRACTICE Q's VIEW -->
  <div id="sp-view-pq" style="flex:1;display:none;flex-direction:column;overflow:hidden;">
    <div id="sp-pq-loading" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--text-3);">
      <div class="sp-explain-spinner"></div>
      <div style="font-size:12px;">Generating questions…</div>
    </div>
    <div id="sp-pq-question-view" style="flex:1;display:none;flex-direction:column;padding:16px 20px;gap:12px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="flex:1;height:3px;background:var(--surface-3);border-radius:2px;overflow:hidden;">
          <div id="sp-pq-progress-bar" style="height:100%;background:var(--teal);border-radius:2px;transition:width 0.3s;width:0%;"></div>
        </div>
        <span id="sp-pq-counter" style="font-size:11px;font-family:var(--font-mono);color:var(--text-4);flex-shrink:0;">1 / 5</span>
      </div>
      <div style="background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-lg);padding:16px 18px;">
        <div style="font-family:var(--font-mono);font-size:10px;color:var(--teal);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">Question</div>
        <div id="sp-pq-question-text" style="font-size:14px;font-weight:600;color:var(--text-1);line-height:1.5;"></div>
      </div>
      <div id="sp-pq-input-wrap" style="display:flex;flex-direction:column;gap:8px;">
        <textarea id="sp-pq-answer-input" placeholder="Type your answer here…" rows="3"
          style="width:100%;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-md);padding:12px 14px;font-family:var(--font-body);font-size:13px;color:var(--text-1);resize:none;outline:none;transition:border-color var(--t-fast);line-height:1.5;"
          onfocus="this.style.borderColor='rgba(45,212,191,0.4)'" onblur="this.style.borderColor=''"
          onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey))spPqSubmit()"></textarea>
        <button data-action="spPqSubmit" id="sp-pq-submit-btn"
          style="align-self:flex-end;padding:8px 20px;border-radius:var(--r-pill);background:var(--teal);border:none;color:#051a18;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font-body);transition:opacity var(--t-fast);">
          Submit Answer
        </button>
      </div>
      <div id="sp-pq-result" style="display:none;flex-direction:column;gap:10px;overflow-y:auto;">
        <div id="sp-pq-verdict" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:var(--r-md);font-size:13px;font-weight:600;"></div>
        <div id="sp-pq-explanation" style="font-size:12.5px;color:var(--text-2);line-height:1.7;padding:12px 14px;background:var(--surface-2);border:1px solid var(--border-xs);border-radius:var(--r-md);"></div>
        <button data-action="spPqNext" id="sp-pq-next-btn"
          style="align-self:flex-end;padding:8px 20px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-1);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body);">
          Next Question →
        </button>
      </div>
    </div>
    <div id="sp-pq-complete" style="flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;">
      <div id="sp-pq-complete-emoji" style="font-size:36px;">🎯</div>
      <div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--text-1);">Practice Complete!</div>
      <div id="sp-pq-complete-text" style="font-size:12px;color:var(--text-3);line-height:1.6;"></div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button data-action="spPqRestart" style="padding:8px 16px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:12px;cursor:pointer;font-family:var(--font-body);">Retry</button>
        <button data-action="spDrawerTab" data-tab="exam" style="padding:8px 16px;border-radius:var(--r-pill);background:var(--teal);border:none;color:#051a18;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body);">Take Mini Exam →</button>
      </div>
    </div>
  </div>

  <!-- MINI EXAM VIEW -->
  <div id="sp-view-exam" style="flex:1;display:none;flex-direction:column;overflow:hidden;">
    <div id="sp-exam-loading" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--text-3);">
      <div class="sp-explain-spinner" style="border-top-color:var(--red);"></div>
      <div style="font-size:12px;">Generating exam…</div>
    </div>
    <div id="sp-exam-intro" style="flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;">
      <div style="width:52px;height:52px;border-radius:var(--r-lg);background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25);display:flex;align-items:center;justify-content:center;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      </div>
      <div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--text-1);">Mini Exam Ready</div>
      <div style="font-size:12px;color:var(--text-3);line-height:1.6;">10 questions · Timed · Pass at 70% to unlock next concept</div>
      <div id="sp-exam-timer-display" style="font-family:var(--font-mono);font-size:28px;font-weight:700;color:var(--red);">5:00</div>
      <button data-action="spExamStart" style="padding:10px 28px;border-radius:var(--r-pill);background:var(--red);border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font-body);">Start Exam</button>
    </div>
    <div id="sp-exam-question-view" style="flex:1;display:none;flex-direction:column;padding:14px 18px;gap:10px;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:8px;flex:1;">
          <div style="flex:1;height:3px;background:var(--surface-3);border-radius:2px;overflow:hidden;">
            <div id="sp-exam-progress-bar" style="height:100%;background:var(--red);border-radius:2px;transition:width 0.3s;width:0%;"></div>
          </div>
          <span id="sp-exam-counter" style="font-size:11px;font-family:var(--font-mono);color:var(--text-4);flex-shrink:0;">1/10</span>
        </div>
        <div id="sp-exam-timer" style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--red);margin-left:12px;flex-shrink:0;">5:00</div>
      </div>
      <div style="background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-md);padding:14px 16px;flex-shrink:0;">
        <div id="sp-exam-q-text" style="font-size:13px;font-weight:600;color:var(--text-1);line-height:1.5;"></div>
      </div>
      <div id="sp-exam-options" style="display:flex;flex-direction:column;gap:7px;overflow-y:auto;flex:1;"></div>
    </div>
    <div id="sp-exam-results" style="flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;overflow-y:auto;">
      <div id="sp-exam-result-emoji" style="font-size:40px;"></div>
      <div id="sp-exam-result-title" style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--text-1);"></div>
      <div id="sp-exam-result-score" style="font-family:var(--font-mono);font-size:32px;font-weight:700;"></div>
      <div id="sp-exam-result-sub" style="font-size:12px;color:var(--text-3);line-height:1.6;max-width:300px;"></div>
      <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;justify-content:center;">
        <button data-action="spExamRestart" style="padding:8px 16px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:12px;cursor:pointer;font-family:var(--font-body);">Retry Exam</button>
        <button data-action="spDrawerTab" data-tab="explain" style="padding:8px 16px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:12px;cursor:pointer;font-family:var(--font-body);">Back to Explain</button>
      </div>
    </div>
  </div>

</div><!-- /#sp-explain-drawer -->
`;function Qt(){const t=document.querySelector("[data-studyplan-screen]");if(!t){console.warn("[StudyPlanScreen] placeholder [data-studyplan-screen] not found");return}t.outerHTML=Gt;const e=document.querySelector("[data-sp-explain-drawer]");if(!e){console.warn("[StudyPlanScreen] placeholder [data-sp-explain-drawer] not found");return}e.outerHTML=Ut}Qt();console.log("[StudyPlanScreen] module loaded ✦");const $e=`
<div class="screen" id="screen-visual" style="display:none;">

  <aside class="sidebar" data-sidebar-screen="visual"></aside>

  <!-- ── SCREEN 1: ENTRY ─────────────────────────────────────────────── -->
  <div class="vtp-screen active" id="screen-entry">
    <div class="orb orb-g"></div>
    <div class="orb orb-v"></div>
    <div class="orb orb-t"></div>
    <canvas class="vtp-particles" id="vtp-particles"></canvas>

    <!-- Scroll hint — shown when content overflows -->
    <div class="vtp-scroll-hint" id="vtp-scroll-hint">
      <button class="vtp-scroll-hint-btn" onclick="document.getElementById('screen-entry').scrollBy({top:200,behavior:'smooth'})">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        Scroll for examples
      </button>
    </div>

    <div class="entry-inner">
      <div class="entry-hook">
        <div class="entry-hook-dot"></div>
        See it. Understand it. Remember it.
      </div>

      <div class="entry-badge">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 21h8m-4-4v4"/></svg>
        Visual Tutor · Chunks AI
      </div>

      <div class="entry-h">
        What do you want to<br><em>understand today?</em>
      </div>
      <div class="entry-s">
        Type any topic and watch it come to life — animated diagrams,<br>
        interactive visuals, and bite-size explanations. <strong style="color:var(--t1-vt);">Under 3 minutes.</strong>
      </div>

      <div class="entry-input-wrap">
        <input class="entry-input" id="vtp-entry-input" placeholder="">
        <button class="entry-start" id="vtp-entry-start">Visualize →</button>
      </div>

      <!-- Feature pills -->
      <div class="vtp-feature-pills">
        <div class="vtp-fpill">
          <span class="vtp-fpill-icon" style="background:var(--gm);color:var(--gold);">✦</span>
          Animated diagrams
        </div>
        <div class="vtp-fpill">
          <span class="vtp-fpill-icon" style="background:var(--vm);color:var(--violet);">◉</span>
          Quiz after each step
        </div>
        <div class="vtp-fpill">
          <span class="vtp-fpill-icon" style="background:var(--tm);color:var(--teal);">≋</span>
          Ask anything live
        </div>
      </div>

      <div class="entry-divider"><div class="entry-divider-text">or pick an example</div></div>

      <!-- Animated example cards -->
      <div class="vtp-example-cards" id="vtp-chips">

        <div class="vtp-card gold" data-topic="pH Scale">
          <div class="vtp-card-preview">
            <div class="vtp-mini-bars" id="vtp-bars-ph"></div>
          </div>
          <div class="vtp-card-topic">⚗ pH Scale</div>
          <div class="vtp-card-sub">acid · neutral · base</div>
          <div class="vtp-card-tag">chemistry</div>
        </div>

        <div class="vtp-card violet" data-topic="Cell Structure">
          <div class="vtp-card-preview">
            <div class="vtp-mini-cell">
              <div class="vtp-cell-membrane"></div>
              <div class="vtp-cell-nucleus"></div>
              <div class="vtp-cell-orb"></div>
              <div class="vtp-cell-orb" style="animation-delay:-1.5s;width:6px;height:6px;"></div>
              <div class="vtp-cell-orb" style="animation-delay:-3s;width:5px;height:5px;background:rgba(232,172,46,.6);border-color:rgba(232,172,46,.9);"></div>
            </div>
          </div>
          <div class="vtp-card-topic">🧬 Cell Structure</div>
          <div class="vtp-card-sub">nucleus · membrane · organelles</div>
          <div class="vtp-card-tag">biology</div>
        </div>

        <div class="vtp-card teal" data-topic="Wave Motion">
          <div class="vtp-card-preview">
            <div class="vtp-mini-wave">
              <svg id="vtp-wave-svg" width="100%" height="100%" viewBox="0 0 200 72" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="vtp-wg" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stop-color="rgba(45,212,191,0.1)"/>
                    <stop offset="50%" stop-color="rgba(45,212,191,0.55)"/>
                    <stop offset="100%" stop-color="rgba(45,212,191,0.1)"/>
                  </linearGradient>
                </defs>
                <path id="vtp-wave1" fill="none" stroke="url(#vtp-wg)" stroke-width="2.5" stroke-linecap="round"/>
                <path id="vtp-wave2" fill="none" stroke="rgba(139,124,248,0.35)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="4 3"/>
              </svg>
            </div>
          </div>
          <div class="vtp-card-topic">〰 Wave Motion</div>
          <div class="vtp-card-sub">frequency · amplitude · phase</div>
          <div class="vtp-card-tag">physics</div>
        </div>

        <div class="vtp-card gold" data-topic="Supply &amp; Demand">
          <div class="vtp-card-preview">
            <svg viewBox="0 0 120 72" width="100%" height="100%" style="position:absolute;inset:0;">
              <path d="M10,12 L110,62" stroke="var(--gold-vt)" stroke-width="2" stroke-linecap="round" fill="none" stroke-dasharray="140" stroke-dashoffset="140">
                <animate attributeName="stroke-dashoffset" from="140" to="0" dur="1.2s" fill="freeze" begin="0.3s"/>
              </path>
              <path d="M10,62 L110,12" stroke="var(--teal)" stroke-width="2" stroke-linecap="round" fill="none" stroke-dasharray="140" stroke-dashoffset="140">
                <animate attributeName="stroke-dashoffset" from="140" to="0" dur="1.2s" fill="freeze" begin="0.6s"/>
              </path>
              <circle cx="60" cy="37" r="4" fill="var(--s2)" stroke="var(--gold-vt)" stroke-width="1.5" opacity="0">
                <animate attributeName="opacity" from="0" to="1" dur="0.4s" fill="freeze" begin="1.5s"/>
              </circle>
              <text x="12" y="10" font-size="8" fill="var(--gold-vt)" font-family="DM Mono,monospace">D</text>
              <text x="12" y="68" font-size="8" fill="var(--teal)" font-family="DM Mono,monospace">S</text>
            </svg>
          </div>
          <div class="vtp-card-topic">📈 Supply &amp; Demand</div>
          <div class="vtp-card-sub">equilibrium · price · market</div>
          <div class="vtp-card-tag">economics</div>
        </div>

        <div class="vtp-card violet" data-topic="DNA Structure">
          <div class="vtp-card-preview">
            <svg id="vtp-dna-svg" viewBox="0 0 100 72" width="100%" height="100%" style="position:absolute;inset:0;"></svg>
          </div>
          <div class="vtp-card-topic">🧪 DNA Structure</div>
          <div class="vtp-card-sub">helix · base pairs · genes</div>
          <div class="vtp-card-tag">biology</div>
        </div>

        <div class="vtp-card" data-topic="Newton's Laws">
          <div class="vtp-card-preview" style="display:flex;align-items:center;justify-content:center;gap:8px;">
            <span class="vtp-force-arrow" style="color:var(--gold-vt);">→</span>
            <span style="font-size:20px;color:var(--t3);">⚽</span>
            <span class="vtp-force-arrow" style="color:var(--teal);animation-delay:.5s;">←</span>
          </div>
          <div class="vtp-card-topic">⚡ Newton's Laws</div>
          <div class="vtp-card-sub">force · motion · reaction</div>
          <div class="vtp-card-tag">physics</div>
        </div>

      </div>

      <!-- Extra chips -->
      <div class="entry-chips" style="margin-top:12px;" id="vtp-extra-chips">
        <div class="chip" data-topic="Photosynthesis">🌿 Photosynthesis</div>
        <div class="chip" data-topic="Osmosis">💧 Osmosis</div>
        <div class="chip" data-topic="Stoichiometry">🔢 Stoichiometry</div>
        <div class="chip" data-topic="Mitosis">🔬 Mitosis</div>
        <div class="chip" data-topic="Electric Circuits">⚡ Electric Circuits</div>
      </div>
    </div>
  </div>

  <!-- ── SCREEN 2: LESSON ────────────────────────────────────────────── -->
  <div class="vtp-screen" id="screen-lesson">

    <!-- XP Toast -->
    <div class="xp-toast" id="xp-toast">⚡ +10 XP</div>

    <div class="lesson-header">
      <div class="lh-logo">
        <svg width="20" height="20" viewBox="0 0 100 100">
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity=".95"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity=".88"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity=".8"/>
          <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
        </svg>
        Chunks <em>AI</em>
      </div>
      <div class="lh-topic" id="lh-topic-label">–</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="lh-timer" id="lh-timer">⏱️ ~2 min</div>
        <div class="lh-streak" id="lh-streak">🔥 3-day streak</div>
        <button class="lh-exit" id="vtp-exit-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Exit
        </button>
      </div>
    </div>

    <!-- Whiteboard -->
    <div class="wb-area" id="wb-area">
      <div class="step-prog"><div class="step-prog-fill" id="prog-fill" style="width:0%"></div></div>
      <div class="step-dots" id="step-dots"></div>
      <canvas id="wb-canvas" class="wb-canvas"></canvas>

      <!-- Quiz pre-announce -->
      <div class="quiz-announce" id="quiz-announce">
        <div class="quiz-announce-pill" id="quiz-announce-pill">⚡ Quick check before we continue…</div>
      </div>

      <!-- MCQ Quiz Overlay -->
      <div class="quiz-overlay" id="quiz-overlay">
        <div class="quiz-card">
          <div class="quiz-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Quick Check · Step <span id="quiz-step-num">3</span>
          </div>
          <div class="quiz-q" id="quiz-question">What is pH 7?</div>
          <div class="quiz-options" id="quiz-options"></div>
          <div class="quiz-xp-pop" id="quiz-xp-pop">⚡ +20 XP &nbsp;🔥 Nice!</div>
          <div class="quiz-feedback" id="quiz-feedback"></div>
          <button class="quiz-continue" id="quiz-continue">Continue Lesson →</button>
        </div>
      </div>
    </div>

    <!-- Bottom panel -->
    <div class="bottom-panel">
      <div class="exp-wrap">
        <div class="exp-purpose" id="exp-purpose"></div>
        <div class="exp-label" id="exp-label">Step 1 — Introduction</div>
        <div class="exp-text" id="exp-text"><span class="cursor"></span></div>
        <div class="simplified-wrap" id="simplified-wrap">
          <div class="simplified-label">✦ Simplified version</div>
          <span id="simplified-text"></span>
        </div>
      </div>

      <!-- Got it? row — PRIMARY CTA -->
      <div class="gotit-row" id="gotit-row">
        <button class="gotit-yes" id="vtp-gotit-yes">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Got it!
        </button>
        <button class="gotit-no" id="vtp-gotit-no">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Not really
        </button>
        <button class="btn-skip" id="btn-skip">Skip → Quiz</button>
      </div>

      <!-- Controls bar -->
      <div class="controls-bar">
        <div class="ask-reply" id="ask-reply">
          <span class="ask-reply-close" id="vtp-reply-close">✕</span>
          <span id="ask-reply-text"></span>
        </div>
        <div class="step-counter"><span id="step-cur">1</span>/<span id="step-tot">5</span></div>
        <input class="ask-input" id="ask-input" placeholder="Ask anything…">
        <button class="btn-simplify" id="btn-simplify" title="Simplify this step">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Simpler
        </button>
        <div class="autoplay-toggle" id="autoplay-toggle" title="Auto-advance">
          <div class="autoplay-track" id="autoplay-track">
            <div class="autoplay-thumb"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── SCREEN 3: COMPLETE ──────────────────────────────────────────── -->
  <div class="vtp-screen" id="screen-complete">
    <div class="orb orb-g" style="opacity:.08"></div>

    <div class="complete-card">
      <div class="complete-glow"></div>
      <div class="complete-emoji">🎉</div>
      <div class="complete-h">Lesson Complete!</div>
      <div class="complete-sub">You understood <strong id="complete-topic">pH Scale</strong></div>
      <div class="complete-confidence">
        🧠 You now understand this better than <strong>80% of students</strong> who study this topic.
      </div>

      <div class="score-ring-wrap">
        <div class="score-ring">
          <svg width="110" height="110" viewBox="0 0 110 110">
            <circle cx="55" cy="55" r="45" stroke="var(--s3)" stroke-width="8" fill="none"/>
            <circle class="score-arc" id="score-arc" cx="55" cy="55" r="45" stroke="var(--teal)" stroke-width="8" fill="none"/>
          </svg>
          <div class="score-num">
            <strong id="score-val">5/5</strong>
            <span>Steps</span>
          </div>
        </div>
        <div class="score-detail">
          <div class="score-detail-h">Great session</div>
          <div class="score-stat"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>Quiz: <span id="score-quiz">Passed</span></div>
          <div class="score-stat"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Simplify used: <span id="score-simplify">0×</span></div>
          <div class="score-stat"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Questions asked: <span id="score-asks">0</span></div>
          <div class="score-stat" style="color:var(--gold-vt);font-weight:600;margin-top:6px;">⚡ XP earned: <span id="score-xp">+50 XP</span></div>
        </div>
      </div>

      <div class="lesson-summary" id="lesson-summary">
        <div class="summary-title">Key takeaways</div>
        <div id="summary-items"></div>
      </div>

      <div class="complete-actions">
        <button class="btn-primary-action" id="vtp-again-btn">Practice Again ↺</button>
        <button class="btn-review-weak hidden" id="btn-review-weak">📌 Review weak areas</button>
        <button class="btn-sec-action" id="vtp-new-btn">Learn Something New →</button>
      </div>

  <!-- ── SCREEN: LOADING ─────────────────────────────────────────────── -->
  <div class="vtp-screen" id="screen-loading">
    <div class="orb orb-g" style="opacity:.05"></div>
    <div class="vtp-loading-inner">
      <div class="vtp-loading-logo">
        <svg width="40" height="40" viewBox="0 0 100 100">
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity=".95"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity=".88"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity=".8"/>
          <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
        </svg>
      </div>
      <div class="vtp-loading-title">Building your lesson…</div>
      <div class="vtp-loading-topic" id="vtp-loading-topic"></div>
      <div class="vtp-loading-bar"><div class="vtp-loading-bar-fill" id="vtp-loading-bar-fill"></div></div>
      <div class="vtp-loading-steps" id="vtp-loading-steps">
        <div class="vtp-lstep" id="vtp-lstep-0">Analysing topic</div>
        <div class="vtp-lstep" id="vtp-lstep-1">Structuring 5 steps</div>
        <div class="vtp-lstep" id="vtp-lstep-2">Designing visuals</div>
        <div class="vtp-lstep" id="vtp-lstep-3">Writing quiz question</div>
      </div>
      <button class="vtp-loading-cancel" id="vtp-loading-cancel">Cancel</button>
      <div class="vtp-loading-error" id="vtp-loading-error" style="display:none">
        <div class="vtp-loading-error-msg" id="vtp-loading-error-msg"></div>
        <button class="vtp-loading-retry" id="vtp-loading-retry">Try again →</button>
      </div>
    </div>
  </div>

</div>
`,Ve={amber:{fill:"rgba(232,172,46,0.13)",stroke:"#e8ac2e",text:"#e8ac2e",bold:"#c49020"},blue:{fill:"rgba(96,165,250,0.13)",stroke:"#60a5fa",text:"#60a5fa",bold:"#3b82f6"},teal:{fill:"rgba(45,212,191,0.13)",stroke:"#2dd4bf",text:"#2dd4bf",bold:"#14b8a6"},red:{fill:"rgba(248,113,113,0.13)",stroke:"#f87171",text:"#f87171",bold:"#ef4444"},green:{fill:"rgba(74,222,128,0.13)",stroke:"#4ade80",text:"#4ade80",bold:"#22c55e"},purple:{fill:"rgba(167,139,250,0.13)",stroke:"#a78bfa",text:"#a78bfa",bold:"#8b5cf6"}};function G(t){return Ve[t]||Ve.amber}let F=null,Z=null,le={};const Yt=t=>`You are the lesson engine for Chunks AI, a visual tutoring app for students.
Generate a complete 5-step lesson for the topic: "${t}"

Return ONLY valid JSON — no markdown fences, no explanation text, just the raw JSON object.

{
  "hook": "One punchy sentence — why this confuses students or why it matters",
  "summary": ["takeaway 1", "takeaway 2", "takeaway 3", "takeaway 4"],
  "quiz": {
    "onStep": 3,
    "q": "A specific multiple-choice question testing the core concept",
    "options": [
      {"text": "correct answer — specific and accurate", "correct": true},
      {"text": "plausible wrong answer", "correct": false},
      {"text": "plausible wrong answer", "correct": false},
      {"text": "plausible wrong answer", "correct": false}
    ],
    "feedbackRight": "✓ Why this answer is correct — 1 sentence",
    "feedbackWrong": "✗ The common mistake and the right idea — 1 sentence"
  },
  "steps": [
    {
      "label": "Step 1 — Short Title",
      "text": "<strong>Hook sentence.</strong> 2-3 clear educational sentences. Use <em>key terms</em>.",
      "simple": "One plain-English sentence. No jargon.",
      "draw": { ... see draw types below ... },
      "contextualReplies": [
        "Direct answer to likely student question about this step",
        "Answer to another likely question",
        "Answer to a third likely question"
      ]
    }
  ]
}

For each step's "draw" field choose the best type:

TYPE "flow" — sequences, processes, cause-and-effect:
{"type":"flow","items":[{"label":"Name","sub":"1 detail","color":"amber"}],"note":"footer"}
Use 2–5 items. Colors: amber, blue, teal, red, green, purple.

TYPE "equation" — formulas with labeled parts:
{"type":"equation","formula":"A = B × C","parts":[{"symbol":"A","name":"Full name","unit":"unit","color":"amber"},{"symbol":"B","name":"Full name","unit":"unit","color":"blue"},{"symbol":"C","name":"Full name","unit":"unit","color":"teal"}],"note":"plain-English meaning"}

TYPE "compare" — two contrasting things side by side:
{"type":"compare","leftLabel":"Left","leftPoints":["point 1","point 2","point 3"],"leftColor":"red","rightLabel":"Right","rightPoints":["point 1","point 2","point 3"],"rightColor":"teal","note":"footer"}

TYPE "scale" — spectrum, range, gradient:
{"type":"scale","lowLabel":"Low end","highLabel":"High end","lowColor":"red","highColor":"teal","markers":[{"label":"Name","value":0.15,"sub":"detail"},{"label":"Name","value":0.5,"sub":"detail"}],"note":"footer"}
value is 0.0 (left edge) to 1.0 (right edge).

TYPE "bullets" — key facts or summary points:
{"type":"bullets","title":"Optional heading","items":[{"icon":"→","text":"Point one — keep under 55 chars"},{"icon":"→","text":"Point two"}],"color":"teal","note":"footer"}
Max 5 items.

Rules:
- Generate exactly 5 steps.
- Use a DIFFERENT draw type for each step where possible.
- Make content specific and accurate for "${t}" — NOT generic filler.
- contextualReplies must be real, specific answers a tutor would give — not "great question!".
- quiz options must be specific to the topic, not abstract.`;async function Xt(t){if(le[t])return le[t];F=new AbortController;const e=await window._getAuthHeader?.()??{},i=await fetch(`${he}/ask`,{method:"POST",signal:F.signal,headers:{"Content-Type":"application/json",...e},body:JSON.stringify({question:Yt(t),mode:"visual_tutor",bookId:"none",complexity:7,history:[]})});if(!i.ok)throw new Error(`Server error ${i.status} — please try again`);const o=await i.json(),n=(o.answer??o.response??o.text??"").trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();let a;try{a=JSON.parse(n)}catch{const l=n.match(/\{[\s\S]*\}/);if(l)try{a=JSON.parse(l[0])}catch{throw new Error("AI returned malformed JSON — please try again")}else throw new Error("AI response was not valid JSON — please try again")}if(!a.steps?.length)throw new Error("AI returned an incomplete lesson — please try again");for(;a.steps.length<5;){const r=a.steps.length+1;a.steps.push({label:`Step ${r} — Summary`,text:`<strong>Wrapping up.</strong> Let's consolidate what you've learned about ${t}.`,simple:`Review the key ideas about ${t}.`,draw:{type:"bullets",items:[{icon:"→",text:`Key idea about ${t}`}],color:"teal"},contextualReplies:[`That's a great question about ${t}.`]})}return a.hook=a.hook||`You'll understand ${t} in under 3 minutes`,a.summary=a.summary||[`${t} explained`,"Visual steps complete","Quiz passed","Ready to apply"],a.quiz=a.quiz||{onStep:3,q:`What is the core idea behind ${t}?`,options:[{text:"The relationship between its key variables",correct:!0},{text:"When it was historically discovered",correct:!1},{text:"The exceptions to the rule",correct:!1},{text:"Its mathematical proof",correct:!1}],feedbackRight:"✓ Correct — the core relationship is the key insight.",feedbackWrong:`✗ Focus on the core relationship in ${t}.`},a.steps.forEach(r=>{(!r.draw||typeof r.draw=="string")&&(r.draw={type:"bullets",items:[{icon:"→",text:r.label||"Key idea"}],color:"amber"})}),le[t]=a,a}function Jt(){const t=document.querySelectorAll("#screen-loading .vtp-lstep"),e=document.getElementById("vtp-loading-bar-fill"),i=document.getElementById("vtp-loading-error");i&&(i.style.display="none"),t.forEach(s=>s.classList.remove("active","done")),t[0]&&t[0].classList.add("active"),e&&(e.style.width="8%");let o=0;Z&&clearInterval(Z),Z=setInterval(()=>{if(o<t.length-1){t[o].classList.remove("active"),t[o].classList.add("done"),o++,t[o].classList.add("active");const s=8+Math.round(o/t.length*82);e&&(e.style.width=s+"%")}},950)}function me(){Z&&(clearInterval(Z),Z=null);const t=document.getElementById("vtp-loading-bar-fill");t&&(t.style.width="100%")}function Kt(t){me();const e=document.getElementById("vtp-loading-error"),i=document.getElementById("vtp-loading-error-msg"),o=document.getElementById("vtp-loading-steps");o&&(o.style.display="none"),i&&(i.textContent=t),e&&(e.style.display="block")}function ot(t){if(!P||!t)return;ae();const e=P,i=$,o=V,s=i/2,n=o/2,a=(y,b)=>setTimeout(y,b),r="#ededf0",l="#9898ae",v="#55556a";function c(y,b,u,x,m,E,g){e.beginPath(),e.roundRect(y,b,u,x,m),E&&(e.fillStyle=E,e.fill()),g&&(e.strokeStyle=g,e.lineWidth=1.5,e.stroke())}function h(y,b,u,x,m,E,g){e.font=`${g||"normal"} ${x}px sans-serif`,e.fillStyle=m,e.textAlign=E||"center",e.textBaseline="middle",e.fillText(y,b,u)}function w(y){y&&(e.font="11px sans-serif",e.fillStyle=v,e.textAlign="center",e.textBaseline="middle",e.fillText(y,s,o-30))}if(t.type==="flow"){const y=(t.items||[]).slice(0,5),b=y.length,u=Math.min(130,(i-80)/b-20),x=64,m=(i-80-b*u)/(b-1||1),E=40,g=n-x/2-10;y.forEach((p,k)=>{const d=G(p.color||"amber"),f=E+k*(u+m);a(()=>{if(k>0){const S=f-m+4;e.strokeStyle=v,e.lineWidth=1.5,e.beginPath(),e.moveTo(S,g+x/2),e.lineTo(f-6,g+x/2),e.stroke(),e.fillStyle=v,e.beginPath(),e.moveTo(f-4,g+x/2),e.lineTo(f-10,g+x/2-5),e.lineTo(f-10,g+x/2+5),e.fill()}c(f,g,u,x,10,d.fill,d.stroke),h(p.label||"",f+u/2,g+22,13,d.text,"center","600"),p.sub&&h(p.sub,f+u/2,g+42,11,l)},80+k*130)}),a(()=>w(t.note),80+b*130+200);return}if(t.type==="equation"){const y=(t.parts||[]).slice(0,4),b=t.formula||"",u=120,x=70,m=y.length,E=Math.min(30,(i-80-m*u)/(m-1||1)),g=(i-(m*u+(m-1)*E))/2;a(()=>{e.font="bold 28px sans-serif",e.fillStyle=r,e.textAlign="center",e.textBaseline="middle",e.fillText(b,s,n-70)},80),a(()=>{e.strokeStyle="rgba(255,255,255,0.08)",e.lineWidth=1,e.beginPath(),e.moveTo(80,n-40),e.lineTo(i-80,n-40),e.stroke()},200),y.forEach((p,k)=>{const d=G(p.color||"amber"),f=g+k*(u+E),S=n-20;a(()=>{c(f,S,u,x,10,d.fill,d.stroke),h(p.symbol||"",f+u/2,S+18,18,d.text,"center","bold"),h(p.name||"",f+u/2,S+40,11,r),p.unit&&h(p.unit,f+u/2,S+56,10,l)},300+k*140)}),a(()=>{t.note&&h(t.note,s,n+80,12,l,"center")},300+y.length*140+100);return}if(t.type==="compare"){const y=(t.leftPoints||[]).slice(0,4),b=(t.rightPoints||[]).slice(0,4),u=G(t.leftColor||"red"),x=G(t.rightColor||"teal"),m=i*.38,E=i*.06,g=i*.56,p=n-110;a(()=>{c(E,p,m,220,12,u.fill,u.stroke),h(t.leftLabel||"Left",E+m/2,p+22,14,u.text,"center","600"),y.forEach((k,d)=>{e.font="12px sans-serif",e.fillStyle=r,e.textAlign="left",e.textBaseline="middle";const f=m-28;e.fillText("• "+k.slice(0,38),E+14,p+52+d*36,f)})},80),a(()=>{c(s-18,n-12,36,24,12,"rgba(255,255,255,0.06)","rgba(255,255,255,0.15)"),h("VS",s,n,12,l,"center","600")},180),a(()=>{c(g,p,m,220,12,x.fill,x.stroke),h(t.rightLabel||"Right",g+m/2,p+22,14,x.text,"center","600"),b.forEach((k,d)=>{e.font="12px sans-serif",e.fillStyle=r,e.textAlign="left",e.textBaseline="middle",e.fillText("• "+k.slice(0,38),g+14,p+52+d*36,m-28)})},280),a(()=>w(t.note),480);return}if(t.type==="scale"){const y=(t.markers||[]).slice(0,6),b=G(t.lowColor||"red"),u=G(t.highColor||"teal"),x=60,m=n-16,E=i-120,g=28;a(()=>{for(let k=0;k<20;k++){const d=k/20,f=parseInt(b.stroke.slice(1,3)||"f8",16),S=parseInt(b.stroke.slice(3,5)||"71",16),q=parseInt(b.stroke.slice(5,7)||"71",16),L=parseInt(u.stroke.slice(1,3)||"2d",16),D=parseInt(u.stroke.slice(3,5)||"d4",16),W=parseInt(u.stroke.slice(5,7)||"bf",16),z=Math.round(f+(L-f)*d),N=Math.round(S+(D-S)*d),re=Math.round(q+(W-q)*d);e.fillStyle=`rgba(${z},${N},${re},0.22)`,e.fillRect(x+k*(E/20),m,E/20+1,g)}e.strokeStyle="rgba(255,255,255,0.12)",e.lineWidth=1,e.strokeRect(x,m,E,g),h(t.lowLabel||"Low",x+4,m-16,11,b.text,"left"),h(t.highLabel||"High",x+E-4,m-16,11,u.text,"right")},80),y.forEach((p,k)=>{const d=x+(p.value||0)*E,f=k%2===0;a(()=>{e.strokeStyle=r,e.lineWidth=1.5,e.beginPath(),e.moveTo(d,m),e.lineTo(d,m+g),e.stroke(),e.fillStyle=r,e.beginPath(),e.arc(d,f?m-18:m+g+18,3,0,Math.PI*2),e.fill(),h(p.label||"",d,f?m-34:m+g+34,12,r,"center","600"),p.sub&&h(p.sub,d,f?m-18:m+g+18,10,l)},200+k*120)}),a(()=>w(t.note),200+y.length*120+150);return}if(t.type==="bullets"){const y=(t.items||[]).slice(0,5),b=G(t.color||"teal"),u=52,x=18,m=Math.min(i-120,520),E=y.length*u+(y.length-1)*8,g=n-E/2-10,p=(i-m)/2;t.title&&a(()=>h(t.title,s,g-28,14,r,"center","600"),60),y.forEach((k,d)=>{const f=g+d*(u+8);a(()=>{c(p,f,m,u,10,b.fill,b.stroke+"50"),h(k.icon||"→",p+x+6,f+u/2,14,b.text,"center","bold"),e.font="13px sans-serif",e.fillStyle=r,e.textAlign="left",e.textBaseline="middle";const S=(k.text||"").slice(0,70);e.fillText(S,p+x+22,f+u/2,m-x*2-22)},80+d*110)}),a(()=>w(t.note),80+y.length*110+100);return}a(()=>{c(s-140,n-52,280,104,16,"rgba(232,172,46,0.07)","rgba(232,172,46,0.18)"),h(I,s,n-10,18,r,"center","bold"),h(`Step ${C+1} of ${M}`,s,n+16,12,l)},160)}async function Q(){if(!Ye("visual"))return;const t=document.getElementById("vtp-entry-input"),e=(t?t.value.trim():"").replace(/^(explain|what is|what are|how does|how do|tell me about)\s+/i,"").trim()||"Photosynthesis";I=e,C=0,ye=0,fe=0,oe=!1,X=!1,Te=0,j=[],se=[],Pe(),Xe("visual");const i=document.getElementById("vtp-loading-topic");i&&(i.textContent=e),H("screen-loading"),Jt();try{B=await Xt(e)}catch(r){if(r.name==="AbortError")return;Kt(r.message||"Could not generate lesson — please try again.");return}me(),M=B.steps.length;const o=document.querySelector("#screen-visual .entry-hook");if(o){const r=o.childNodes[o.childNodes.length-1];r&&(r.textContent=" "+(B.hook||"You'll understand this in 5 steps"))}const s=document.getElementById("lh-topic-label"),n=document.getElementById("complete-topic");s&&(s.textContent=I),n&&(n.textContent=I);const a=document.getElementById("summary-items");a&&(a.innerHTML=(B.summary||[]).map(r=>`<div class="summary-item"><div class="summary-dot"></div>${r}</div>`).join("")),H("screen-lesson"),typeof window.recentAdd=="function"&&window.recentAdd(I,"","visual"),ui(),setTimeout(()=>{Le(),ze(),ne(0)},220)}let I="",B=null,C=0,M=5,O,P,$,V,Y=null,ce=!1,X=!1,K=!1,T=null,ye=0,fe=0,oe=!1,Te=0,j=[],We=null,se=[],Ee=null;function Zt(){return Ee||(Ee=new(window.AudioContext||window.webkitAudioContext)),Ee}function pe(t){try{const e=Zt(),i=e.createOscillator(),o=e.createGain();i.connect(o),o.connect(e.destination);const s=e.currentTime;t==="tick"?(i.type="sine",i.frequency.setValueAtTime(660,s),o.gain.setValueAtTime(.06,s),o.gain.exponentialRampToValueAtTime(.001,s+.08),i.start(s),i.stop(s+.08)):t==="correct"?(i.type="triangle",i.frequency.setValueAtTime(523,s),i.frequency.setValueAtTime(659,s+.1),i.frequency.setValueAtTime(784,s+.2),o.gain.setValueAtTime(.12,s),o.gain.exponentialRampToValueAtTime(.001,s+.45),i.start(s),i.stop(s+.45)):t==="wrong"?(i.type="sawtooth",i.frequency.setValueAtTime(220,s),i.frequency.exponentialRampToValueAtTime(180,s+.25),o.gain.setValueAtTime(.08,s),o.gain.exponentialRampToValueAtTime(.001,s+.28),i.start(s),i.stop(s+.28)):t==="gotit"&&(i.type="sine",i.frequency.setValueAtTime(440,s),i.frequency.setValueAtTime(528,s+.1),o.gain.setValueAtTime(.09,s),o.gain.exponentialRampToValueAtTime(.001,s+.2),i.start(s),i.stop(s+.2))}catch{}}function H(t){document.querySelectorAll(".vtp-screen").forEach(i=>i.classList.remove("active"));const e=document.getElementById(t);e&&e.classList.add("active")}function Ge(){Y&&clearTimeout(Y),T&&clearTimeout(T),ae();const t=document.getElementById("simplified-wrap");t&&(t.style.display="none");const e=document.getElementById("gotit-row");e&&(e.style.display="none");const i=document.getElementById("vtp-entry-input");i&&(i.value=""),H("screen-entry")}function at(){const t=document.getElementById("vtp-entry-input");t&&(t.value=I),Q()}function Le(){O=document.getElementById("wb-canvas");const t=document.getElementById("wb-area");!O||!t||($=t.offsetWidth,V=t.offsetHeight,O.width=$,O.height=V,P=O.getContext("2d"),nt())}function nt(){if(P){P.clearRect(0,0,$,V),P.fillStyle="rgba(255,255,255,0.03)";for(let t=44;t<$;t+=44)for(let e=44;e<V;e+=44)P.beginPath(),P.arc(t,e,1.3,0,Math.PI*2),P.fill()}}function ae(){P&&(P.clearRect(0,0,$,V),nt())}function ze(){const t=document.getElementById("step-dots");if(t){t.innerHTML="";for(let e=0;e<M;e++){const i=document.createElement("div");i.className="sdot"+(e===0?" active":""),i.id="sd-"+e,t.appendChild(i)}}}function ei(t){for(let e=0;e<M;e++){const i=document.getElementById("sd-"+e);i&&(i.className="sdot"+(e<t?" done":e===t?" active":""))}}function ti(t){const e=t===0?0:t/(M-1)*100,i=document.getElementById("prog-fill");i&&(i.style.width=e+"%")}function ne(t){ce=!0,ci();const e=document.getElementById("simplified-wrap"),i=document.getElementById("gotit-row");e&&(e.style.display="none"),i&&(i.style.display="none");const o=B.steps[t],s=document.getElementById("step-cur"),n=document.getElementById("step-tot");s&&(s.textContent=t+1),n&&(n.textContent=M);const a=o.label||"",r=a.indexOf("—"),l=r>-1?a.slice(0,r).trim():a,v=r>-1?a.slice(r+1).trim():"",c=document.getElementById("exp-purpose"),h=document.getElementById("exp-label");c&&c.classList.remove("vis"),h&&h.classList.remove("vis"),v?(c&&(c.textContent=l+" of "+M),h&&(h.textContent=v)):(c&&(c.textContent=""),h&&(h.textContent=a)),setTimeout(()=>{c&&c.classList.add("vis"),h&&h.classList.add("vis")},100);const w=document.getElementById("ask-input"),y=document.getElementById("btn-simplify");w&&(w.disabled=!0,w.placeholder="AI is explaining…"),y&&(y.disabled=!0),ei(t),ti(t),pe("tick"),hi(o.draw||{type:"bullets",items:[{icon:"→",text:o.label||I}],color:"amber"}),vi(o.text,()=>{ce=!1,y&&(y.disabled=!1),w&&(w.disabled=!1,w.placeholder="Ask anything…"),ii()})}function ii(){const t=document.getElementById("gotit-row");t&&(t.style.display="flex");const e=document.getElementById("btn-skip");e&&(e.style.display=B.quiz&&!X?"inline-block":"none"),K&&(T&&clearTimeout(T),T=setTimeout(()=>ve(!0),5e3))}function ve(t){T&&clearTimeout(T);const e=document.getElementById("gotit-row");e&&(e.style.display="none"),t?(Ae(),oi(),pe("gotit"),ni()):(j.includes(C)||j.push(C),dt(),setTimeout(()=>{const i=document.getElementById("gotit-row");i&&(i.style.display="flex")},400))}function si(){if(!j.length){at();return}C=j[0],j=[],H("screen-lesson"),setTimeout(()=>{Le(),ze(),ne(C)},220)}function oi(){const t=document.getElementById("xp-toast");t&&(t.classList.add("show"),setTimeout(()=>t.classList.remove("show"),1800))}function ai(){T&&clearTimeout(T);const t=document.getElementById("gotit-row");t&&(t.style.display="none"),B.quiz&&!X?rt():_e()}function ni(){const t=B.quiz;if(t&&t.onStep===C+1&&!X){rt();return}if(C>=M-1){_e();return}C++,ne(C)}function rt(){const t=B.quiz;if(!t){lt();return}const e=document.getElementById("quiz-announce-pill");e?(e.classList.add("show"),setTimeout(()=>{e.classList.remove("show"),setTimeout(()=>Ue(t),200)},900)):Ue(t)}function Ue(t){const e=document.getElementById("quiz-step-num"),i=document.getElementById("quiz-question"),o=document.getElementById("quiz-feedback"),s=document.getElementById("quiz-continue");e&&(e.textContent=t.onStep),i&&(i.textContent=t.q),o&&(o.style.display="none"),s&&(s.style.display="none");const n=document.getElementById("quiz-options");if(!n)return;n.innerHTML="";const a=["A","B","C","D"];t.options.forEach((l,v)=>{const c=document.createElement("div");c.className="qopt",c.innerHTML=`<div class="qopt-letter">${a[v]}</div><span>${l.text}</span>`,c.addEventListener("click",()=>ri(v,l.correct)),n.appendChild(c)});const r=document.getElementById("quiz-overlay");r&&r.classList.add("open")}function ri(t,e){if(X)return;X=!0,oe=e;const i=document.querySelectorAll("#screen-visual .qopt"),o=B.quiz;i.forEach((r,l)=>{r.style.cursor="default",r.onclick=null,l===t&&r.classList.add(e?"correct":"wrong"),!e&&o.options[l].correct&&r.classList.add("reveal")});const s=document.getElementById("quiz-xp-pop");e&&s?(s.classList.add("show"),pe("correct"),Ae()):pe("wrong");const n=document.getElementById("quiz-feedback"),a=document.getElementById("quiz-continue");n&&(n.textContent=e?o.feedbackRight:o.feedbackWrong,n.className="quiz-feedback "+(e?"correct":"wrong"),n.style.display="block"),a&&(a.style.display="block")}function li(){const t=document.getElementById("quiz-overlay");t&&t.classList.remove("open"),lt()}function lt(){if(C>=M-1){_e();return}C++,ne(C)}function dt(){ye++;const t=B.steps[C],e=t.simple||"Think of it this way: "+t.text.replace(/<[^>]+>/g,"").slice(0,80)+"…",i=document.getElementById("simplified-wrap"),o=document.getElementById("simplified-text");o&&(o.innerHTML=e),i&&(i.style.display="block")}async function di(){const t=document.getElementById("ask-input");if(!t)return;const e=t.value.trim();if(!e)return;t.value="",fe++;const i=B.steps[C],o=i.contextualReplies||[],s=o[Te%o.length]||`That relates to ${i.label.split("—")[1]?.trim()||I}. Focus on the key relationship shown in the diagram — that's where the answer lives.`;Te++;const n=document.getElementById("ask-input"),a=document.getElementById("btn-simplify");n&&(n.disabled=!0,n.placeholder="Thinking…"),a&&(a.disabled=!0),Se('<span class="ask-thinking">●●●</span>');const r=B.steps.slice(0,C+1).map((c,h)=>`Step ${h+1} (${c.label.split("—")[1]?.trim()||""}): ${c.text.replace(/<[^>]+>/g,"").slice(0,120)}`).join(`
`),l=`You are a friendly, direct tutor for Chunks AI helping a student understand "${I}". The student is working through a 5-step visual lesson. Answer in 2–3 sentences max. Be specific — use the exact concepts from the lesson. Never say "Great question!" or add filler preamble. Just answer directly. If referencing something from an earlier step, say "as we covered in step N…" 

Steps the student has seen so far:
${r}`,v=se.slice(-4).flatMap(({q:c,a:h})=>[{role:"user",content:c},{role:"assistant",content:h}]);try{const c=await window._getAuthHeader?.()??{},h=await fetch(`${he}/ask`,{method:"POST",headers:{"Content-Type":"application/json",...c},body:JSON.stringify({question:e,mode:"visual_tutor",bookId:"none",complexity:4,history:v,_vtpSystemCtx:l})});if(!h.ok)throw new Error(`HTTP ${h.status}`);const w=await h.json(),b=(w.answer??w.response??w.text??"").trim()||s;se.push({q:e,a:b}),Se(b)}catch(c){console.warn("[VTP] Ask error, using local fallback:",c.message),se.push({q:e,a:s}),Se(s)}finally{n&&(n.disabled=!1,n.placeholder="Ask anything…"),a&&(a.disabled=!1)}}function Se(t){const e=document.getElementById("ask-reply"),i=document.getElementById("ask-reply-text");i&&(i.innerHTML=t),e&&e.classList.add("open")}function ct(){const t=document.getElementById("ask-reply");t&&t.classList.remove("open")}function ci(){ct()}function pi(){K=!K;const t=document.getElementById("autoplay-track");if(t&&t.classList.toggle("on",K),K&&!ce){const e=document.getElementById("gotit-row");e&&e.style.display!=="none"&&(T&&clearTimeout(T),T=setTimeout(()=>ve(!0),3e3))}else T&&clearTimeout(T)}function vi(t,e){const i=document.getElementById("exp-text");if(!i){e&&e();return}i.innerHTML='<span class="cursor"></span>';const o=t.replace(/<[^>]+>/g,"");let s=0;const n=o.length>130?13:17;Y&&clearTimeout(Y);function a(){s++,i.textContent=o.slice(0,s);const r=document.createElement("span");r.className="cursor",i.appendChild(r),s<o.length?Y=setTimeout(a,n):setTimeout(()=>{i.innerHTML=t,e&&e()},60)}a()}function Ae(){const t=document.getElementById("wb-area");if(!t)return;const e=["#e8ac2e","#4ade80","#2dd4bf","#8b7cf8","#f87171"];for(let i=0;i<14;i++){const o=document.createElement("div");o.className="confetti-dot";const s=20+Math.random()*60,n=20+Math.random()*60;o.style.cssText=`left:${s}%;top:${n}%;background:${e[i%e.length]};animation-delay:${i*40}ms;animation-duration:${500+Math.random()*400}ms;`,t.appendChild(o),setTimeout(()=>o.remove(),1200)}}function _e(){const t=M*10+(oe?20:0),e=document.getElementById("score-val"),i=document.getElementById("score-quiz"),o=document.getElementById("score-simplify"),s=document.getElementById("score-asks"),n=document.getElementById("score-xp");e&&(e.textContent=M+"/"+M),i&&(i.textContent=B.quiz?oe?"Passed ✓":"Attempted":"N/A"),o&&(o.textContent=ye+"×"),s&&(s.textContent=fe),n&&(n.textContent="+"+t+" XP");const a=document.getElementById("btn-review-weak");a&&(a.className=j.length>0?"btn-review-weak":"btn-review-weak hidden");try{const r=localStorage.getItem("chunks_recent");if(r){const l=JSON.parse(r),v=l.find(c=>c.source==="visual"&&c.question===I);v&&!v.label.endsWith(" ✓")&&(v.label=(v.label.length>28?v.label.slice(0,28).trimEnd()+"…":v.label)+" ✓",localStorage.setItem("chunks_recent",JSON.stringify(l)),window._renderAllRecent?.())}}catch{}H("screen-complete"),setTimeout(()=>{const r=document.getElementById("score-arc");r&&(r.style.strokeDashoffset="0")},250),Ae()}function hi(t){setTimeout(()=>{ae(),ot(t)},100)}function Pe(){const t=document.getElementById("quiz-overlay");t&&t.classList.remove("open");const e=document.getElementById("quiz-feedback"),i=document.getElementById("quiz-continue"),o=document.getElementById("quiz-xp-pop"),s=document.getElementById("quiz-options");e&&(e.style.display="none",e.textContent="",e.className="quiz-feedback"),i&&(i.style.display="none"),o&&o.classList.remove("show"),s&&(s.innerHTML="");const n=document.getElementById("quiz-announce-pill");n&&n.classList.remove("show");const a=document.getElementById("simplified-wrap");a&&(a.style.display="none");const r=document.getElementById("gotit-row");r&&(r.style.display="none");const l=document.getElementById("ask-reply");l&&l.classList.remove("open");const v=document.getElementById("simplified-wrap");v&&(v.style.display="none");const c=document.getElementById("ask-input"),h=document.getElementById("btn-simplify");c&&(c.disabled=!1,c.value="",c.placeholder="Ask anything…"),h&&(h.disabled=!1);const w=document.getElementById("prog-fill");w&&(w.style.width="0%")}typeof window<"u"&&(window._vtClear=function(){Y&&clearTimeout(Y),T&&clearTimeout(T),F&&(F.abort(),F=null),me(),B=null,ce=!1,K=!1,Pe(),ae();const t=document.getElementById("vtp-entry-input");t&&(t.value=""),H("screen-entry")});typeof window<"u"&&(window._vtOpenForConcept=function(t){window._navFromHistory=!0,window.showScreen&&window.showScreen("visual"),setTimeout(()=>{const e=document.getElementById("vtp-entry-input");e&&t&&(e.value=t),t?Q():H("screen-entry")},300)});function ui(){try{const t=localStorage.getItem("chunks_recent");if(!t||!B||!I)return;const i=JSON.parse(t).find(s=>s.source==="visual"&&s.question===I);if(!i)return;const o={topic:I,lesson:B};localStorage.setItem("chunks_vt_session_"+i.id,JSON.stringify(o))}catch{}}typeof window<"u"&&(window._vtRestoreSession=function(t,e){window._navFromHistory=!0,setTimeout(()=>{try{const o=localStorage.getItem("chunks_vt_session_"+t);if(o){const s=JSON.parse(o);if(s.lesson&&s.topic){I=s.topic,B=s.lesson,C=0,M=s.lesson.steps.length,ye=0,fe=0,oe=!1,X=!1,j=[],se=[];const n=document.getElementById("lh-topic-label"),a=document.getElementById("complete-topic");n&&(n.textContent=I),a&&(a.textContent=I);const r=document.getElementById("summary-items");r&&(r.innerHTML=(s.lesson.summary||[]).map(l=>'<div class="summary-item"><div class="summary-dot"></div>'+l+"</div>").join("")),Pe(),H("screen-lesson"),setTimeout(()=>{Le(),ze(),ne(0)},220);return}}}catch{}const i=document.getElementById("vtp-entry-input");i&&e&&(i.value=e),H("screen-entry")},150)});let Qe=!1;function gi(){if(Qe)return;Qe=!0;const t=document.querySelector("[data-visual-screen]");if(t)t.outerHTML=$e;else{const e=document.createElement("div");e.innerHTML=$e,document.body.appendChild(e.firstElementChild)}setTimeout(()=>{const e=document.getElementById("vtp-entry-input");if(e){e.addEventListener("keydown",g=>{g.key==="Enter"&&Q()});try{const g=sessionStorage.getItem("exam_weak_prefill");if(g){const{vtQuery:p}=JSON.parse(g);p&&(e.value=p,setTimeout(()=>e.focus(),150)),sessionStorage.removeItem("exam_weak_prefill")}}catch{}}const i=document.getElementById("vtp-entry-start");i&&i.addEventListener("click",Q);const o=document.getElementById("vtp-chips");o&&o.querySelectorAll("[data-topic]").forEach(g=>{g.addEventListener("click",()=>{const p=document.getElementById("vtp-entry-input");p&&(p.value=g.getAttribute("data-topic")),Q()})});const s=document.getElementById("vtp-extra-chips");s&&s.querySelectorAll("[data-topic]").forEach(g=>{g.addEventListener("click",()=>{const p=document.getElementById("vtp-entry-input");p&&(p.value=g.getAttribute("data-topic")),Q()})}),mi(),function(){const p=document.getElementById("screen-entry"),k=document.getElementById("vtp-scroll-hint");if(!p||!k)return;function d(){const f=p.scrollHeight>p.clientHeight+10,S=p.scrollTop+p.clientHeight>=p.scrollHeight-20;k.classList.toggle("visible",f&&!S)}p.addEventListener("scroll",d,{passive:!0}),window.addEventListener("resize",d),setTimeout(d,400)}();const n=document.getElementById("vtp-exit-btn");n&&n.addEventListener("click",Ge);const a=document.getElementById("vtp-gotit-yes");a&&a.addEventListener("click",()=>ve(!0));const r=document.getElementById("vtp-gotit-no");r&&r.addEventListener("click",()=>ve(!1));const l=document.getElementById("btn-skip");l&&l.addEventListener("click",ai);const v=document.getElementById("vtp-reply-close");v&&v.addEventListener("click",ct);const c=document.getElementById("ask-input");c&&c.addEventListener("keydown",g=>{g.key==="Enter"&&di()});const h=document.getElementById("btn-simplify");h&&h.addEventListener("click",dt);const w=document.getElementById("autoplay-toggle");w&&w.addEventListener("click",pi);const y=document.getElementById("quiz-continue");y&&y.addEventListener("click",li);const b=document.getElementById("vtp-again-btn");b&&b.addEventListener("click",at);const u=document.getElementById("vtp-new-btn");u&&u.addEventListener("click",Ge);const x=document.getElementById("btn-review-weak");x&&x.addEventListener("click",si);const m=document.getElementById("vtp-loading-cancel");m&&m.addEventListener("click",()=>{F&&(F.abort(),F=null),me(),H("screen-entry")});const E=document.getElementById("vtp-loading-retry");E&&E.addEventListener("click",()=>{I&&delete le[I],Q()}),window.addEventListener("resize",()=>{clearTimeout(We),We=setTimeout(()=>{if(!O||!B)return;const g=document.getElementById("wb-area");g&&($=g.offsetWidth,V=g.offsetHeight,O.width=$,O.height=V,ae(),B?.steps[C]&&ot(B.steps[C].draw))},150)})},100),console.log("[VisualTutorScreen] mounted ✦")}function mi(){const t=["How does osmosis work?","Explain Newton's 3rd Law","What is the pH scale?","Show me how DNA replication works","Explain supply and demand curves","How does photosynthesis happen?","Visualize electric circuits","What is cell division?"];let e=0,i=0,o=!1;const s=document.getElementById("vtp-entry-input");function n(){if(!s||document.activeElement===s){setTimeout(n,500);return}const d=t[e];o?i>0?(s.placeholder=d.slice(0,--i)+"|",setTimeout(n,28)):(o=!1,e=(e+1)%t.length,setTimeout(n,400)):i<d.length?(s.placeholder=d.slice(0,++i)+"|",setTimeout(n,55+Math.random()*30)):setTimeout(()=>{o=!0,n()},1800)}n();const a=["#f87171","#fb923c","#facc15","#a3e635","#4ade80","#34d399","#22d3ee","#60a5fa","#818cf8","#a78bfa","#c084fc","#e879f9","#f472b6","#fb7185"],r=[90,82,74,65,56,50,44,44,50,56,65,74,82,90],l=document.getElementById("vtp-bars-ph");l&&r.forEach((d,f)=>{const S=document.createElement("div");S.className="vtp-mini-bar",S.style.cssText=`height:${d}%;background:${a[f]};opacity:0.85;animation-delay:${f*.04}s;`,l.appendChild(S)});let v=0;function c(d,f,S,q,L=200,D=72){let W="";for(let z=0;z<=L;z+=2){const N=D/2+f*Math.sin(z/L*S*Math.PI*2+q);W+=(z===0?"M":"L")+z+","+N}d.setAttribute("d",W)}function h(){v+=.04;const d=document.getElementById("vtp-wave1"),f=document.getElementById("vtp-wave2");d&&c(d,18,2,v),f&&c(f,12,3,-v*1.3),requestAnimationFrame(h)}h();let w=0;const y=["#e8ac2e","#2dd4bf","#8b7cf8","#f87171"];function b(){const d=document.getElementById("vtp-dna-svg");if(!d)return;const f=14,S=50,q=72;let L="";for(let D=0;D<=f;D++){const W=D/f,z=4+W*(q-8),N=W*Math.PI*4+w,re=S+Math.sin(N)*20,He=S-Math.sin(N)*20,qe=2.5+Math.abs(Math.sin(N)),xe=y[D%y.length],ht=(.3+Math.abs(Math.cos(N))*.5).toFixed(2);L+=`<line x1="${re.toFixed(1)}" y1="${z.toFixed(1)}" x2="${He.toFixed(1)}" y2="${z.toFixed(1)}" stroke="${xe}" stroke-width="1.2" stroke-linecap="round" opacity="${ht}"/>`,L+=`<circle cx="${re.toFixed(1)}" cy="${z.toFixed(1)}" r="${qe.toFixed(1)}" fill="${xe}" opacity="0.9"/>`,L+=`<circle cx="${He.toFixed(1)}" cy="${z.toFixed(1)}" r="${qe.toFixed(1)}" fill="${xe}" opacity="0.9"/>`}d.innerHTML=L,w+=.03,requestAnimationFrame(b)}b();const u=document.getElementById("vtp-particles");if(!u)return;const x=u.getContext("2d"),m=document.getElementById("screen-entry");function E(){u.width=m?m.offsetWidth:window.innerWidth,u.height=m?m.offsetHeight:window.innerHeight}E(),window.addEventListener("resize",E);const g=["rgba(232,172,46,","rgba(139,124,248,","rgba(45,212,191,"],p=Array.from({length:55},()=>({x:Math.random()*u.width,y:Math.random()*u.height,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,r:Math.random()*1.4+.3,a:Math.random()*.35+.05,color:g[Math.floor(Math.random()*3)]}));function k(){x.clearRect(0,0,u.width,u.height),p.forEach(d=>{d.x+=d.vx,d.y+=d.vy,d.x<0&&(d.x=u.width),d.x>u.width&&(d.x=0),d.y<0&&(d.y=u.height),d.y>u.height&&(d.y=0),x.beginPath(),x.arc(d.x,d.y,d.r,0,Math.PI*2),x.fillStyle=d.color+d.a+")",x.fill()});for(let d=0;d<p.length;d++)for(let f=d+1;f<p.length;f++){const S=p[d].x-p[f].x,q=p[d].y-p[f].y,L=Math.sqrt(S*S+q*q);L<90&&(x.beginPath(),x.moveTo(p[d].x,p[d].y),x.lineTo(p[f].x,p[f].y),x.strokeStyle=`rgba(255,255,255,${.02*(1-L/90)})`,x.lineWidth=.5,x.stroke())}requestAnimationFrame(k)}k()}typeof document<"u"&&gi();const yi=`
<div class="screen" id="screen-library">

  <aside class="sidebar" data-sidebar-screen="library"></aside>

  <main class="lib-page-main">

    <!-- Page header -->
    <div class="lib-page-header">
      <div class="lib-page-title-row">
        <div class="lib-page-title-group">
          <div class="lib-title-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            </svg>
          </div>
          <div>
            <h1 class="lib-page-heading">Textbook Library</h1>
            <span class="lib-title-count" id="lib-page-total-count">· 11 books</span>
          </div>
        </div>
      </div>

      <!-- Search -->
      <div class="lib-search-row" style="margin-top:18px;">
        <div class="lib-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input class="lib-search-input" id="lib-page-search" type="text"
                 placeholder="Search textbooks, authors…"
                 oninput="filterLibraryPage(this.value)">
        </div>
      </div>

      <!-- Category pills -->
      <div class="lib-pills" style="margin-top:12px;">
        <button class="lib-pill active" onclick="filterLibPageSection('all',this)">
          <span class="lib-pill-dot" style="background:#8b7cf8"></span>All Courses
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('chemistry',this)">
          <span class="lib-pill-dot" style="background:#22d3ee"></span>Chemistry
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('biology',this)">
          <span class="lib-pill-dot" style="background:#4ade80"></span>Biology
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('nursing',this)">
          <span class="lib-pill-dot" style="background:#f472b6"></span>Nursing
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('physics',this)">
          <span class="lib-pill-dot" style="background:#fb923c"></span>Physics
        </button>
        <button class="lib-pill" onclick="filterLibPageSection('psychology',this)">
          <span class="lib-pill-dot" style="background:#8b5cf6"></span>Psychology
        </button>
      </div>
    </div><!-- /page-header -->

    <!-- Scrollable body -->
    <div class="lib-page-body" id="lib-page-body">

      <!-- ── MY DOCUMENTS ──────────────────────────────────── -->
      <div class="lib-section lib-section--my-docs" data-page-section="my-docs" id="lib-my-docs-section"
           ondragover="libDragOver(event)" ondrop="libDrop(event)" ondragleave="libDragLeave(event)">

        <!-- Section header with inline Upload button -->
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(139,124,248,.1);color:#8b7cf8">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <span class="lib-section-name">My Documents</span>
          <span class="lib-section-count" id="lib-my-docs-count">0 files</span>
          <div class="lib-section-line"></div>
          <!-- Upload button — lives in header, no wasted card slot -->
          <button class="lib-upload-btn" id="lib-upload-btn" onclick="libTriggerUpload()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span id="lib-upload-btn-label">Upload</span>
          </button>
        </div>

        <!-- Upload progress bar — full width, hidden until uploading -->
        <div class="lib-upload-progress" id="lib-upload-progress" style="margin-bottom:0;border-radius:var(--r-pill);overflow:hidden;height:3px;background:var(--surface-4);display:none;">
          <div class="lib-upload-progress-bar" id="lib-upload-progress-bar"></div>
        </div>

        <!-- Drop zone hint — only visible while dragging over -->
        <div class="lib-drop-zone" id="lib-drop-zone">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Drop PDF or PowerPoint here
        </div>

        <!-- Row list — populated by libRenderMyDocs() -->
        <div class="lib-docs-list" id="lib-my-docs-list"></div>

        <!-- Empty state — shown when no docs yet -->
        <div class="lib-docs-empty" id="lib-docs-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.25;color:var(--violet)">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span>Upload a PDF or PowerPoint to study it with AI</span>
        </div>

      </div><!-- /my-docs -->

      <!-- ── CHEMISTRY ────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="chemistry">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(34,211,238,.1);color:#22d3ee">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l1 9H8z"/><path d="M8 12a5 5 0 0 0 8 0"/><path d="M6.7 19.8A2 2 0 0 0 8 21h8a2 2 0 0 0 1.3-3.5L14 12H10z"/></svg>
          </div>
          <span class="lib-section-name">Chemistry</span>
          <span class="lib-section-count">4 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card" onclick="selectBook('zumdahl')">
            <div class="library-book-icon"><img src="/covers/zumdahl.jpg" alt="General Chemistry cover" onerror="this.parentElement.innerHTML='📗'"></div>
            <div class="lib-book-info"><div class="library-book-title">General Chemistry</div><div class="library-book-author">Zumdahl &amp; Zumdahl</div><div class="library-book-edition">9th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Chemistry</span></div></div>
          </div>
          <div class="library-book-card" onclick="selectBook('atkins')">
            <div class="library-book-icon"><img src="/covers/atkins.jpg" alt="Physical Chemistry cover" onerror="this.parentElement.innerHTML='📘'"></div>
            <div class="lib-book-info"><div class="library-book-title">Physical Chemistry</div><div class="library-book-author">Atkins &amp; de Paula</div><div class="library-book-edition">8th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Physical Chem</span></div></div>
          </div>
          <div class="library-book-card" onclick="selectBook('klein')">
            <div class="library-book-icon"><img src="/covers/klein.jpg" alt="Organic Chemistry cover" onerror="this.parentElement.innerHTML='📙'"></div>
            <div class="lib-book-info"><div class="library-book-title">Organic Chemistry</div><div class="library-book-author">David Klein</div><div class="library-book-edition">4th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Organic</span></div></div>
          </div>
          <div class="library-book-card" onclick="selectBook('harris')">
            <div class="library-book-icon"><img src="/covers/harris.jpg" alt="Quantitative Chemical Analysis cover" onerror="this.parentElement.innerHTML='📒'"></div>
            <div class="lib-book-info"><div class="library-book-title">Quantitative Chemical Analysis</div><div class="library-book-author">Daniel C. Harris</div><div class="library-book-edition">10th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Analytical</span></div></div>
          </div>
        </div>
      </div>

      <!-- ── BIOLOGY ─────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="biology">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(74,222,128,.1);color:#4ade80">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="m17 6-2.5-2.5"/><path d="m14 8-1-1"/><path d="m7 18 2.5 2.5"/><path d="m10 16 1 1"/><path d="M2 9c6.667 6 13.333 0 20 6"/></svg>
          </div>
          <span class="lib-section-name">Biology</span>
          <span class="lib-section-count">3 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card" onclick="selectBook('anaphy2e')">
            <div class="library-book-icon"><img src="/covers/anaphy2e.jpg" alt="Anatomy &amp; Physiology cover" onerror="this.parentElement.innerHTML='🧬'"></div>
            <div class="lib-book-info"><div class="library-book-title">Anatomy &amp; Physiology</div><div class="library-book-author">Patton &amp; Thibodeau</div><div class="library-book-edition">2nd Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Biology</span></div></div>
          </div>
          <div class="library-book-card" onclick="selectBook('biology2e')">
            <div class="library-book-icon"><img src="/covers/biology2e.jpg" alt="Biology cover" onerror="this.parentElement.innerHTML='🌿'"></div>
            <div class="lib-book-info"><div class="library-book-title">Biology</div><div class="library-book-author">OpenStax</div><div class="library-book-edition">2nd Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Biology</span></div></div>
          </div>
          <div class="library-book-card" onclick="selectBook('biochem')">
            <div class="library-book-icon"><img src="/covers/Biochem.jpg" alt="Biochemistry cover" onerror="this.parentElement.innerHTML='🔬'"></div>
            <div class="lib-book-info"><div class="library-book-title">Biochemistry</div><div class="library-book-author">Berg, Tymoczko &amp; Stryer</div><div class="library-book-edition">9th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Biochem</span></div></div>
          </div>
        </div>
      </div>

      <!-- ── NURSING ─────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="nursing">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(244,114,182,.1);color:#f472b6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z"/></svg>
          </div>
          <span class="lib-section-name">Nursing</span>
          <span class="lib-section-count">2 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card" onclick="selectBook('netter')">
            <div class="library-book-icon"><img src="/covers/netter.jpg" alt="Atlas of Human Anatomy cover" onerror="this.parentElement.innerHTML='🫀'"></div>
            <div class="lib-book-info"><div class="library-book-title">Atlas of Human Anatomy</div><div class="library-book-author">Frank H. Netter</div><div class="library-book-edition">7th Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Anatomy</span></div></div>
          </div>
          <div class="library-book-card" onclick="selectBook('nursing-skills-2e')">
            <div class="library-book-icon"><img src="/covers/nursing-skills-2e.jpg" alt="Nursing Skills cover" onerror="this.parentElement.innerHTML='🩺'"></div>
            <div class="lib-book-info"><div class="library-book-title">Nursing Skills</div><div class="library-book-author">OpenStax</div><div class="library-book-edition">2nd Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Nursing</span></div></div>
          </div>
        </div>
      </div>

      <!-- ── PHYSICS ──────────────────────────────────────────── -->
      <div class="lib-section" data-page-section="physics">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(251,146,60,.1);color:#fb923c">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/></svg>
          </div>
          <span class="lib-section-name">Physics</span>
          <span class="lib-section-count">1 book</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card" onclick="selectBook('physics2e')">
            <div class="library-book-icon"><img src="/covers/physics2e.jpg" alt="College Physics cover" onerror="this.parentElement.innerHTML='⚛️'"></div>
            <div class="lib-book-info"><div class="library-book-title">College Physics</div><div class="library-book-author">OpenStax</div><div class="library-book-edition">2nd Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Physics</span></div></div>
          </div>
        </div>
      </div>

      <!-- ── PSYCHOLOGY ───────────────────────────────────────── -->
      <div class="lib-section" data-page-section="psychology">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(139,92,246,.1);color:#8b5cf6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 1 8 8c0 4.4-3.6 8-8 8a8 8 0 0 1 0-16z"/><path d="M12 18v4"/><path d="M8 22h8"/><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M9.5 14a3.5 3.5 0 0 0 5 0"/></svg>
          </div>
          <span class="lib-section-name">Psychology</span>
          <span class="lib-section-count">1 book</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">
          <div class="library-book-card" onclick="selectBook('psychology2e')">
            <div class="library-book-icon"><img src="/covers/psychology2e.jpg" alt="Psychology cover" onerror="this.parentElement.innerHTML='🧠'"></div>
            <div class="lib-book-info"><div class="library-book-title">Psychology</div><div class="library-book-author">OpenStax</div><div class="library-book-edition">2nd Edition</div><div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Psychology</span></div></div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div class="lib-empty-state" id="lib-page-empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <div class="lib-empty-title">No results found</div>
        <div class="lib-empty-desc">Try a different search term or category</div>
      </div>

    </div><!-- /lib-page-body -->
  </main>
</div>`;function fi(){const t=document.querySelector("[data-library-screen]");if(!t){console.warn("[LibraryScreen] placeholder [data-library-screen] not found");return}t.outerHTML=yi}fi();window.filterLibraryPage=function(t){const e=t.trim().toLowerCase(),i=document.getElementById("screen-library");if(!i)return;let o=!1;i.querySelectorAll(".library-book-card").forEach(n=>{const a=n.textContent.toLowerCase(),r=!e||a.includes(e);n.style.display=r?"":"none",r&&(o=!0)}),i.querySelectorAll(".lib-section").forEach(n=>{const a=[...n.querySelectorAll(".library-book-card")].filter(r=>r.style.display!=="none");n.style.display=a.length?"":"none"});const s=document.getElementById("lib-page-empty-state");s&&(s.style.display=o?"none":"flex")};window.filterLibPageSection=function(t,e){const i=document.getElementById("screen-library");if(!i)return;i.querySelectorAll(".lib-pill").forEach(n=>n.classList.remove("active")),e&&e.classList.add("active");const o=document.getElementById("lib-page-search");o&&(o.value=""),i.querySelectorAll(".lib-section").forEach(n=>{const a=t==="all"||n.dataset.pageSection===t;n.style.display=a?"":"none",a&&n.querySelectorAll(".library-book-card").forEach(r=>r.style.display="")});const s=document.getElementById("lib-page-empty-state");s&&(s.style.display="none")};let R=null;function bi(){return R||(R=document.createElement("input"),R.type="file",R.accept=".pdf,.ppt,.pptx",R.style.display="none",R.addEventListener("change",t=>{const e=t.target.files?.[0];e&&pt(e),t.target.value=""}),document.body.appendChild(R),R)}window.libTriggerUpload=function(){bi().click()};window.libDragOver=function(t){t.preventDefault(),document.getElementById("lib-my-docs-section")?.classList.add("lib-upload-drag");const e=document.getElementById("lib-drop-zone");e&&(e.style.display="flex")};window.libDragLeave=function(t){const e=document.getElementById("lib-my-docs-section");if(e&&!e.contains(t.relatedTarget)){e.classList.remove("lib-upload-drag");const i=document.getElementById("lib-drop-zone");i&&(i.style.display="none")}};window.libDrop=function(t){t.preventDefault(),document.getElementById("lib-my-docs-section")?.classList.remove("lib-upload-drag");const e=document.getElementById("lib-drop-zone");e&&(e.style.display="none");const i=t.dataTransfer?.files?.[0];i&&pt(i)};async function pt(t){if(!/\.(pdf|pptx?|ppt)$/i.test(t.name)){wsShowToast?.("⚠","Only PDF and PowerPoint files are supported","var(--red)");return}const i=80*1024*1024;if(t.size>i){wsShowToast?.("⚠","File too large (max 80 MB)","var(--red)");return}const o=document.getElementById("lib-upload-btn"),s=document.getElementById("lib-upload-btn-label"),n=document.getElementById("lib-upload-progress"),a=document.getElementById("lib-upload-progress-bar");s&&(s.textContent="Reading…"),o&&(o.disabled=!0),n&&(n.style.display="block"),a&&(a.style.width="15%");try{let r="",l=0;if(/\.(pptx?|ppt)$/i.test(t.name)){a&&(a.style.width="35%");const w=new FormData;w.append("file",t);const b=await(await fetch(`${window._API_BASE||"https://api.chunks.online"}/upload-document`,{method:"POST",body:w})).json();if(!b.success)throw new Error(b.error||"Server extraction failed");r=JSON.stringify(b.slides||[]),l=b.total_slides||0,a&&(a.style.width="75%")}else{a&&(a.style.width="25%");const w=await t.arrayBuffer();a&&(a.style.width="40%");const b=await(await(window._loadPdfJs?.()||Promise.reject("PDF.js not loaded"))).getDocument({data:w}).promise;l=b.numPages;const u=[],x=Math.min(l,300);for(let m=1;m<=x;m++){a&&(a.style.width=40+Math.round(m/x*45)+"%");const p=(await(await b.getPage(m)).getTextContent()).items.map(k=>k.str).join(" ").trim();p&&u.push(`[Page ${m}]
${p}`)}r=u.join(`

`)}a&&(a.style.width="90%");const{data:c,error:h}=await gt(t,r,l);if(h||!c)throw new Error(h||"Save failed");a&&(a.style.width="100%"),setTimeout(()=>{n&&(n.style.display="none"),a&&(a.style.width="0%"),s&&(s.textContent="Upload"),o&&(o.disabled=!1)},600),await be(),wsShowToast?.("✦",`"${t.name}" added to your library`,"var(--violet-border)"),typeof selectUserDoc=="function"&&selectUserDoc(c.id)}catch(r){console.error("[libHandleFile] error:",r),wsShowToast?.("⚠","Upload failed: "+r.message,"var(--red)"),n&&(n.style.display="none"),a&&(a.style.width="0%"),s&&(s.textContent="Upload"),o&&(o.disabled=!1)}}window.libDeleteDoc=async function(t,e){t.stopPropagation(),confirm("Remove this document from your library?")&&(await mt(e),await be(),wsShowToast?.("✦","Document removed","var(--text-3)"))};async function be(){const t=document.getElementById("lib-my-docs-list"),e=document.getElementById("lib-my-docs-count"),i=document.getElementById("lib-docs-empty");if(!t)return;const{data:o}=await yt();e&&(e.textContent=`${o.length} file${o.length!==1?"s":""}`),i&&(i.style.display=o.length===0?"flex":"none"),t.innerHTML="",o.forEach(s=>{const n=/\.(pptx?|ppt)$/i.test(s.name),a=s.name.split(".").pop().toUpperCase(),r=(s.size/1048576).toFixed(1),l=s.pageCount,v=new Date(s.uploadedAt).toLocaleDateString(void 0,{month:"short",day:"numeric"}),c=n?"#fb923c":"#8b7cf8",h=n?"rgba(251,146,60,0.25)":"var(--violet-border)",w=n?"rgba(251,146,60,0.08)":"rgba(139,124,248,0.08)",y=s.name.replace(/\.[^.]+$/,""),b=document.createElement("div");b.className="lib-doc-row",b.onclick=()=>{typeof selectUserDoc=="function"&&selectUserDoc(s.id)},b.innerHTML=`
      <div class="lib-doc-row-icon" style="background:${w};border-color:${h};">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="lib-doc-row-info">
        <div class="lib-doc-row-name">${y}</div>
        <div class="lib-doc-row-meta">
          <span class="lib-doc-row-badge" style="color:${c};border-color:${h};background:${w};">${a}</span>
          <span>${l} ${n?"slides":"pages"}</span>
          <span>·</span>
          <span>${r} MB</span>
          <span>·</span>
          <span>${v}</span>
        </div>
      </div>
      <button class="lib-doc-row-delete" onclick="libDeleteDoc(event,'${s.id}')" title="Remove document">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`,t.appendChild(b)})}document.addEventListener("DOMContentLoaded",()=>{be(),vt()});function vt(){["zumdahl","atkins","klein","harris","berg","netter","anaphy2e","biochem"].forEach(e=>{const i=document.querySelector(`.library-book-card[onclick*="${e}"]`);if(!i)return;const o=ft(e);if(!o)return;const s=bt(o),n=xt(o.lastOpened),a=o.openCount||0;i.querySelector(".lib-progress-block")?.remove();const r=document.createElement("div");if(r.className="lib-progress-block",r.innerHTML=`
      <div class="lib-progress-row">
        <span class="lib-progress-label">${n?"🕐 "+n:""}</span>
        <span class="lib-progress-sessions">${a} session${a!==1?"s":""}</span>
      </div>
      ${s>0?`
      <div class="lib-progress-bar-wrap">
        <div class="lib-progress-bar-fill" style="width:${s}%"></div>
      </div>
      <div class="lib-progress-pct">${s}% read</div>
      `:""}
    `,i.appendChild(r),a>0){const l=i.querySelector(".library-book-icon");if(l&&!l.querySelector(".lib-studied-ring")){const v=document.createElement("div");v.className="lib-studied-ring",l.appendChild(v)}}})}window._libInjectProgress=vt;window.libRenderMyDocs=be;
