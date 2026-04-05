// @ts-nocheck
/**
 * src/state/appBridge.js — App-level bridge
 *
 * Consolidates inline JavaScript from app.html:
 *   • _aiParams / _getAuthHeader helpers
 *   • Recent chats management (session save/load/render)
 *   • Keyboard shortcuts modal + global keyboard handler
 *   • Help center modal
 *   • Bug report modal
 *   • Event delegation (ACTION_MAP)
 *   • Health reminder system
 *   • Auth modal
 *
 * All modal HTML is injected into document.body at module startup.
 * All window.* assignments are preserved for cross-module compatibility.
 */

// ── Modal HTML injection ─────────────────────────────────────────────────────
// Inject all modal HTML that was previously inline in app.html.

(function _injectModals() {
  // --- Shortcuts modal ---
  document.body.insertAdjacentHTML('beforeend', `
<div class="shortcuts-modal" id="shortcuts-modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-modal-title">
  <div class="shortcuts-content">
    <div class="shortcuts-header">
      <span class="shortcuts-title" id="shortcuts-modal-title">Keyboard shortcuts</span>
      <button class="shortcuts-close" data-action="closeShortcuts" aria-label="Close keyboard shortcuts">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="shortcuts-body">

      <div class="shortcuts-group-label">General</div>
      <div class="shortcuts-row">
        <span class="shortcuts-row-label">New chat</span>
        <span class="kbd-combo"><kbd>Ctrl</kbd><span class="kbd-sep">+</span><kbd>⇧</kbd><span class="kbd-sep">+</span><kbd>O</kbd></span>
      </div>
      <div class="shortcuts-row">
        <span class="shortcuts-row-label">Quick chat or search</span>
        <span class="kbd-combo"><kbd>Ctrl</kbd><span class="kbd-sep">+</span><kbd>K</kbd></span>
      </div>
      <div class="shortcuts-row">
        <span class="shortcuts-row-label">Incognito chat</span>
        <span class="kbd-combo"><kbd>Ctrl</kbd><span class="kbd-sep">+</span><kbd>I</kbd></span>
      </div>
      <div class="shortcuts-row">
        <span class="shortcuts-row-label">Toggle sidebar</span>
        <span class="kbd-combo"><kbd>Ctrl</kbd><span class="kbd-sep">+</span><kbd>.</kbd></span>
      </div>
      <div class="shortcuts-row">
        <span class="shortcuts-row-label">Keyboard shortcuts</span>
        <span class="kbd-combo"><kbd>Ctrl</kbd><span class="kbd-sep">+</span><kbd>/</kbd></span>
      </div>
      <div class="shortcuts-row">
        <span class="shortcuts-row-label">Settings</span>
        <span class="kbd-combo"><kbd>Ctrl</kbd><span class="kbd-sep">+</span><kbd>,</kbd></span>
      </div>

      <div class="shortcuts-group-label">In chats</div>
      <div class="shortcuts-row">
        <span class="shortcuts-row-label">Send message</span>
        <span class="kbd-combo"><kbd>Enter</kbd></span>
      </div>
      <div class="shortcuts-row">
        <span class="shortcuts-row-label">New line in message</span>
        <span class="kbd-combo"><kbd>⇧</kbd><span class="kbd-sep">+</span><kbd>Enter</kbd></span>
      </div>
      <div class="shortcuts-row">
        <span class="shortcuts-row-label">Upload file</span>
        <span class="kbd-combo"><kbd>Ctrl</kbd><span class="kbd-sep">+</span><kbd>U</kbd></span>
      </div>
      <div class="shortcuts-row">
        <span class="shortcuts-row-label">Stop response</span>
        <span class="kbd-combo"><kbd>Esc</kbd></span>
      </div>
      <div class="shortcuts-row">
        <span class="shortcuts-row-label">Delete current chat / plan</span>
        <span class="kbd-combo"><kbd>Ctrl</kbd><span class="kbd-sep">+</span><kbd>⇧</kbd><span class="kbd-sep">+</span><kbd>⌫</kbd></span>
      </div>

    </div>
  </div>
</div>
`);
  // --- Help center modal ---
  document.body.insertAdjacentHTML('beforeend', `
<div class="help-modal" id="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
  <div class="help-content">
    <div class="help-header">
      <div class="help-header-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
      </div>
      <div class="help-header-text">
        <div class="help-header-title" id="help-modal-title">Help Center</div>
        <div class="help-header-sub">Frequently asked questions about Chunks AI</div>
      </div>
      <button class="help-close" data-action="closeHelpCenter">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="help-search-wrap">
      <svg class="help-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input class="help-search" id="help-search-input" type="text" placeholder="Search questions…" data-action="filterFAQs-input">
    </div>

    <div class="help-body" id="help-body">

      <div class="help-section-label">Getting Started</div>

      <div class="faq-item">
        <div class="faq-q" data-action="toggleFAQ-self">
          What is Chunks AI?
          <svg class="faq-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="faq-a">Chunks AI is an AI-powered study assistant that helps you learn faster and retain more. You can chat with your textbooks, generate flashcards, create study plans, take practice exams, and conduct deep research — all in one place.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q" data-action="toggleFAQ-self">
          How do I start a new chat?
          <svg class="faq-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="faq-a">Click the <strong>New Chat</strong> button in the sidebar, or use the keyboard shortcut <kbd>Ctrl + Shift + O</kbd>. You can ask the General AI anything, or load a textbook in the Workspace to chat with your course material directly.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q" data-action="toggleFAQ-self">
          How do I load a textbook?
          <svg class="faq-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="faq-a">Go to <strong>Workspace</strong> in the sidebar and click <strong>Browse Library</strong>, or click the Library icon directly. Browse available textbooks by subject and click one to load it. On first load, the PDF is downloaded and cached locally for fast access next time.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q" data-action="toggleFAQ-self">
          What subjects and textbooks are available?
          <svg class="faq-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="faq-a">Chunks AI currently includes textbooks across:
          <ul>
            <li><strong>Chemistry</strong> — Zumdahl, Atkins, Klein, Harris</li>
            <li><strong>Biology / Medicine</strong> — Anatomy & Physiology 2e, Netter's Atlas</li>
            <li>More subjects are added regularly. Check the Library for the latest collection.</li>
          </ul>
        </div>
      </div>

      <div class="help-section-label">Workspace & Chat</div>

      <div class="faq-item">
        <div class="faq-q" data-action="toggleFAQ-self">
          How does the AI answer questions about my textbook?
          <svg class="faq-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="faq-a">Chunks AI uses a hierarchical indexing system that breaks your textbook into chapters, sections, and concepts. When you ask a question, it retrieves the most relevant passages and uses them as context for its answer — so responses are grounded in your actual course material, not just general knowledge.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q" data-action="toggleFAQ-self">
          Can I see where the AI's answers come from?
          <svg class="faq-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="faq-a">Yes. In the Workspace, AI responses include source citations showing which chapter and section the information came from. This lets you quickly verify answers and jump back to the original text for deeper reading.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q" data-action="toggleFAQ-self">
          Are my chat conversations saved?
          <svg class="faq-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="faq-a">Yes. Your recent chat sessions are automatically saved to your browser's local storage and appear in the sidebar history. You can click any past chat to restore the full conversation. To clear history, go to <strong>Settings → Data controls → Clear chat history</strong>.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q" data-action="toggleFAQ-self">
          How do I delete a chat from my history?
          <svg class="faq-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="faq-a">Hover over any chat in the sidebar history and click the three-dot menu (⋯) that appears. Select <strong>Delete</strong> to permanently remove it. You can also pin or rename chats from the same menu.</div>
      </div>

      <div class="help-section-label">Flashcards & Exams</div>

      <div class="faq-item">
        <div class="faq-q" data-action="toggleFAQ-self">
          How do I generate flashcards?
          <svg class="faq-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="faq-a">Go to <strong>Flashcards</strong> in the sidebar. Enter a topic or chapter name, select your textbook, and Chunks AI will generate a set of study cards automatically. You can rate each card as Easy, Got it, or Hard — the system prioritises cards you find difficult.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q" data-action="toggleFAQ-self">
          How does the Exam mode work?
          <svg class="faq-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="faq-a">In <strong>Exam</strong> mode, Chunks AI generates a timed practice exam based on your selected textbook and topic. Questions are multiple choice and free response. After submitting, you receive a score breakdown and explanations for each answer so you can learn from mistakes.</div>
      </div>

      <div class="help-section-label">Account & Privacy</div>

      <div class="faq-item">
        <div class="faq-q" data-action="toggleFAQ-self">
          Is my data private?
          <svg class="faq-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="faq-a">Your chat history and textbook cache are stored locally in your browser — they never leave your device unless you explicitly share them. You can opt out of anonymous usage data sharing in <strong>Settings → Data controls</strong>.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q" data-action="toggleFAQ-self">
          How do I upgrade my plan?
          <svg class="faq-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="faq-a">Click your profile avatar in the bottom-left corner of the sidebar and select <strong>Upgrade plan</strong>. Pro gives you unlimited chats, access to all textbooks, priority response speed, and advanced study tools.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q" data-action="toggleFAQ-self">
          How do I clear my cached textbooks?
          <svg class="faq-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="faq-a">Go to <strong>Settings → Data controls</strong> and click <strong>Clear PDF cache</strong>. This removes locally cached textbooks. They will be re-downloaded the next time you load them in Workspace.</div>
      </div>

      <div class="faq-no-results" id="faq-no-results">No results found. Try a different search term.</div>
    </div>

    <div class="help-footer">
      <span class="help-footer-text">Still need help?</span>
      <button class="help-contact-btn" data-action="contactSupport">Contact support</button>
    </div>
  </div>
</div>
`);
  // --- Bug report modal ---
  document.body.insertAdjacentHTML('beforeend', `
<div class="bug-modal-overlay" id="bug-modal" role="dialog" aria-modal="true" aria-labelledby="bug-modal-title">
  <div class="bug-modal">
    <div class="bug-modal-header">
      <div class="bug-modal-icon">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 4-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17 17c2.3.1 4 1.9 4 4"/></svg>
      </div>
      <div>
        <div class="bug-modal-title" id="bug-modal-title">Report a Bug</div>
        <div class="bug-modal-sub">Help us improve Chunks AI</div>
      </div>
      <button class="bug-modal-close" data-action="closeBugReport" aria-label="Close bug report">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="bug-modal-body">
      <div>
        <div class="bug-field-label">Category</div>
        <div class="bug-category-row" id="bug-cat-row">
          <button class="bug-cat-btn active" data-cat="UI / Display">UI / Display</button>
          <button class="bug-cat-btn" data-cat="AI Response">AI Response</button>
          <button class="bug-cat-btn" data-cat="PDF / Workspace">PDF / Workspace</button>
          <button class="bug-cat-btn" data-cat="Flashcards">Flashcards</button>
          <button class="bug-cat-btn" data-cat="Other">Other</button>
        </div>
      </div>
      <div>
        <div class="bug-field-label">Description <span style="color:var(--text-4);font-weight:400;text-transform:none;letter-spacing:0;">(required)</span></div>
        <textarea id="bug-description" class="bug-textarea" placeholder="Describe what happened and how to reproduce it…" maxlength="2000"></textarea>
      </div>
    </div>
    <div class="bug-modal-footer">
      <button class="bug-cancel-btn" data-action="closeBugReport">Cancel</button>
      <button class="bug-submit-btn" id="bug-submit-btn" data-action="submitBugReport">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        Send Report
      </button>
    </div>
  </div>
</div>
`);
  // --- Health reminder popup ---
  document.body.insertAdjacentHTML('beforeend', `
<div id="health-reminder-overlay" style="
  position:fixed;inset:0;z-index:10060;
  display:flex;align-items:center;justify-content:center;
  background:rgba(8,8,16,0.65);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  opacity:0;pointer-events:none;
  transition:opacity 300ms ease;
"></div>

<!-- Popup card -->
<div id="health-reminder-popup" style="
  position:fixed;left:50%;top:50%;
  transform:translate(-50%,-48%) scale(0.96);
  z-index:10061;width:min(430px,90vw);
  background:var(--surface-2);
  border:1px solid var(--border-md);
  border-radius:var(--r-xl);
  padding:32px 28px 26px;
  box-shadow:0 24px 64px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.04);
  font-family:var(--font-body);
  opacity:0;pointer-events:none;
  transition:opacity 300ms ease,transform 320ms cubic-bezier(0.34,1.56,0.64,1);
">
  <!-- Accent stripe -->
  <div id="hr-stripe" style="
    position:absolute;top:0;left:0;right:0;height:2px;
    border-radius:var(--r-xl) var(--r-xl) 0 0;
    background:linear-gradient(90deg,transparent,var(--teal),transparent);
    transition:background 300ms ease;
  "></div>

  <!-- Icon -->
  <div id="hr-icon" style="font-size:52px;text-align:center;margin-bottom:14px;line-height:1;user-select:none;"></div>

  <!-- Category label -->
  <div id="hr-label" style="
    font-family:var(--font-mono);font-size:9px;letter-spacing:0.13em;
    text-transform:uppercase;color:var(--text-3);text-align:center;margin-bottom:7px;
  "></div>

  <!-- Title -->
  <div id="hr-title" style="
    font-family:var(--font-head);font-size:21px;font-weight:700;
    color:var(--text-1);text-align:center;margin-bottom:11px;line-height:1.25;
  "></div>

  <!-- Body -->
  <div id="hr-body" style="
    font-size:13px;color:var(--text-2);text-align:center;
    line-height:1.65;margin-bottom:26px;
  "></div>

  <!-- Buttons -->
  <div style="display:flex;gap:10px;">
    <button id="hr-dismiss" style="
      flex:1;padding:10px 14px;border-radius:var(--r-pill);
      background:var(--surface-4);border:1px solid var(--border-sm);
      color:var(--text-3);font-size:13px;font-family:var(--font-body);
      cursor:pointer;transition:background 150ms ease,color 150ms ease;
      outline:none;
    ">Maybe later</button>
    <button id="hr-action" style="
      flex:2;padding:10px 18px;border-radius:var(--r-pill);
      background:rgba(45,212,191,0.10);border:1px solid rgba(45,212,191,0.25);
      color:var(--teal);font-size:13px;font-weight:600;font-family:var(--font-body);
      cursor:pointer;transition:filter 150ms ease,background 150ms ease;
      outline:none;
    "></button>
  </div>

  <!-- Timer bar -->
  <div style="margin-top:18px;height:2px;border-radius:2px;background:var(--surface-4);overflow:hidden;">
    <div id="hr-timer-bar" style="
      height:100%;width:100%;
      background:var(--border-md);
      border-radius:2px;
      transform-origin:left;
      transition:none;
    "></div>
  </div>
  <div style="margin-top:6px;text-align:center;font-size:10px;color:var(--text-4);font-family:var(--font-mono);">
    auto-closes in <span id="hr-countdown">15</span>s
  </div>
</div>
`);
  // --- Auth modal ---
  document.body.insertAdjacentHTML('beforeend', `
<div id="auth-modal-overlay" style="display:none;" aria-modal="true" role="dialog">
  <style>
    #auth-modal-overlay {
      position: fixed; inset: 0; z-index: 99998;
      background: rgba(0,0,0,0.72); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
    }
    @keyframes _amSlideUp { from { opacity:0; transform: translateY(16px) scale(0.97); } to { opacity:1; transform: translateY(0) scale(1); } }
    #auth-modal-card {
      background: var(--surface-2, #171820);
      border: 1px solid var(--border-sm, #2a2b38);
      border-radius: 24px;
      padding: 40px 36px 32px;
      max-width: 400px; width: 100%;
      text-align: center;
      box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;
      animation: _amSlideUp 0.25s cubic-bezier(0.34,1.1,0.64,1) both;
      position: relative;
    }
    #auth-modal-card .am-close {
      position: absolute; top: 16px; right: 16px;
      background: none; border: none; cursor: pointer;
      color: var(--text-3, #7c7c96); padding: 6px;
      border-radius: 8px; transition: color 0.15s, background 0.15s;
      display: flex; align-items: center;
    }
    #auth-modal-card .am-close:hover { color: var(--text-1,#ededf0); background: var(--surface-3,#1e1f29); }
    #auth-modal-card .am-logo {
      display: flex; align-items: center; justify-content: center;
      gap: 8px; margin-bottom: 20px;
    }
    #auth-modal-card .am-logo-name {
      font-size: 18px; font-weight: 700; color: var(--text-1,#ededf0);
      font-family: var(--font-display, inherit);
    }
    #auth-modal-card .am-logo-name span { color: var(--gold, #e8ac2e); }
    #auth-modal-card .am-title {
      font-size: 20px; font-weight: 700; color: var(--text-1,#ededf0);
      margin-bottom: 8px; letter-spacing: -0.3px;
    }
    #auth-modal-card .am-sub {
      font-size: 13px; color: var(--text-3, #7c7c96);
      line-height: 1.6; margin-bottom: 24px;
    }
    #auth-modal-card .am-pills {
      display: flex; flex-wrap: wrap; gap: 6px;
      justify-content: center; margin-bottom: 28px;
    }
    #auth-modal-card .am-pill {
      font-size: 11px; font-weight: 600;
      padding: 4px 10px; border-radius: 20px;
      background: var(--surface-3, #1e1f29);
      border: 1px solid var(--border-sm, #2a2b38);
      color: var(--text-2, #9898ae);
    }
    #auth-modal-card .am-btn-google {
      width: 100%; display: flex; align-items: center; justify-content: center;
      gap: 10px; padding: 13px 20px; border-radius: 14px;
      border: 1px solid var(--border-md, #32334a);
      background: var(--surface-3, #1e1f29);
      color: var(--text-1, #ededf0);
      font-size: 14px; font-weight: 500;
      font-family: var(--font-body, inherit);
      cursor: pointer; transition: background 0.15s, border-color 0.15s, transform 0.1s;
      margin-bottom: 12px; text-decoration: none;
    }
    #auth-modal-card .am-btn-google:hover { background: #252636; border-color: var(--border-lg,#3d3e52); transform: translateY(-1px); }
    #auth-modal-card .am-btn-google:active { transform: translateY(0); }
    #auth-modal-card .am-divider {
      display: flex; align-items: center; gap: 10px;
      margin: 4px 0 12px; color: var(--text-3, #7c7c96); font-size: 12px;
    }
    #auth-modal-card .am-divider::before,
    #auth-modal-card .am-divider::after {
      content: ''; flex: 1; height: 1px;
      background: var(--border-sm, #2a2b38);
    }
    #auth-modal-card .am-btn-guest {
      width: 100%; padding: 11px; border-radius: 12px; cursor: pointer;
      background: transparent; border: 1px solid var(--border-xs, #252633);
      color: var(--text-2, #9898ae); font-size: 13px; font-weight: 500;
      font-family: var(--font-body, inherit);
      display: flex; align-items: center; justify-content: center; gap: 7px;
      transition: background 0.15s, color 0.15s;
    }
    #auth-modal-card .am-btn-guest:hover { background: var(--surface-3,#1e1f29); color: var(--text-1,#ededf0); }
    #auth-modal-card .am-footer {
      font-size: 11px; color: var(--text-3,#7c7c96);
      margin-top: 18px; line-height: 1.5;
    }
    #auth-modal-card .am-footer a { color: var(--text-2,#9898ae); text-decoration: none; }
    #auth-modal-card .am-footer a:hover { color: var(--text-1,#ededf0); }
    #auth-modal-card .am-loading {
      display: none; flex-direction: column; align-items: center;
      gap: 12px; padding: 20px 0;
    }
    #auth-modal-card .am-spinner {
      width: 28px; height: 28px; border: 3px solid var(--border-sm,#2a2b38);
      border-top-color: var(--gold,#e8ac2e); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #auth-modal-card .am-loading-text { font-size: 13px; color: var(--text-2,#9898ae); }
  </style>

  <div id="auth-modal-card">
    <!-- Close button -->
    <button class="am-close" id="am-close-btn" aria-label="Close">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>

    <!-- Logo -->
    <div class="am-logo">
      <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="16" fill="#e8ac2e" opacity="0.15"/>
        <circle cx="18" cy="18" r="7" fill="#e8ac2e" opacity="0.5"/>
        <circle cx="18" cy="18" r="3" fill="#e8ac2e"/>
      </svg>
      <span class="am-logo-name">Chunks <span>AI</span></span>
    </div>

    <!-- Main content -->
    <div id="am-content">
      <div class="am-title">Welcome back</div>
      <div class="am-sub">Sign in to access your textbooks, flashcards, and full study history.</div>
      <div class="am-pills">
        <span class="am-pill">Workspace</span>
        <span class="am-pill">Flashcards</span>
        <span class="am-pill">Exam mode</span>
        <span class="am-pill">AI tutor</span>
        <span class="am-pill">Research</span>
      </div>

      <button class="am-btn-google" id="am-btn-google">
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <div class="am-divider" id="am-guest-divider" style="display:none">or</div>

      <button class="am-btn-guest" id="am-btn-guest" style="display:none">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Continue as guest
      </button>

      <div class="am-footer">
        By signing in you agree to our
        <a href="/terms" target="_blank">Terms of Service</a> and
        <a href="/privacy" target="_blank">Privacy Policy</a>
      </div>
    </div>

    <!-- Loading state (shown while waiting for popup) -->
    <div class="am-loading" id="am-loading">
      <div class="am-spinner"></div>
      <div class="am-loading-text">Waiting for sign in…</div>
    </div>
  </div>
</div>
`);
})();

// ── _aiParams and _getAuthHeader ────────────────────────────────────────────
/* ── _aiParams — inline fallback ─────────────────────────────────────────────
   The canonical definition lives in src/state/flashState.js and is exposed
   as window._aiParams once that module loads. This inline version runs first
   so index.html inline scripts (research outline, exam, study-plan fallback)
   that call _aiParams() before module evaluation never throw ReferenceError.
   Once flashState.js loads it overwrites this with the identical logic.
──────────────────────────────────────────────────────────────────────────── */
function _aiParams(base) {
  const m = (typeof window._getStudyMode === 'function' ? window._getStudyMode() : null)
            || localStorage.getItem('chunks_study_mode') || 'balanced';
  const complexity  = m === 'concise'  ? Math.max(2, base - 2)
                    : m === 'detailed' ? Math.min(9, base + 2)
                    : base;
  const language    = localStorage.getItem('chunks_setting_language') || 'Auto-detect';
  const safeContent = localStorage.getItem('chunks_setting_safe-content') === '1';
  return { complexity, language, safe_content: safeContent };
}

function _getAuthHeader() {
  try {
    var raw     = localStorage.getItem('chunks-ai-auth');
    if (!raw) return {};
    var parsed  = JSON.parse(raw);
    var token   = parsed.access_token
                  || (parsed.currentSession && parsed.currentSession.access_token)
                  || null;
    if (token) return { 'Authorization': 'Bearer ' + token };
  } catch(_) {}
  return {};
}

window._aiParams      = _aiParams;
window._getAuthHeader = _getAuthHeader;

// ── Recent chats management ─────────────────────────────────────────────────
// (standalone _renderAllRecent() call removed — main.js calls window._renderAllRecent?.() instead)
/* ══════════════════════════════════════════
   RECENT CONVERSATIONS + NEW CHAT
══════════════════════════════════════════ */

const RECENT_MAX = 50;
const CHAT_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
// Pattern matching the legacy fallback label 'Session XXXXXXXX' (8 hex chars).
// Used in _saveSession and _hydrateRecentFromRemote to detect sessions that still
// carry a UUID-derived label so they can be upgraded to a meaningful title.
const _SESSION_FALLBACK_RE = /^Session [0-9a-f]{8}$/;

// Runtime guest mode check — single source of truth
const _isGuestMode = () => sessionStorage.getItem('chunks_guest_mode') === '1';
if (_isGuestMode()) document.body.classList.add('guest-mode');
let _recentItems = _isGuestMode() ? [] : (JSON.parse(localStorage.getItem('chunks_recent') || 'null') || []);
// In-memory set of IDs (both local and UUID) deleted during this page session.
// Checked in _hydrateRecentFromRemote BEFORE the localStorage tombstone so that
// a Supabase DELETE that hasn't propagated yet cannot re-inject the row.
// Auto-cleared per entry after 15 s — enough for any realistic DELETE round-trip.
const _justDeleted = new Set();
// Never restore active highlight from localStorage on page load.
// The highlight is a transient UI state — it only makes sense when the user
// is actively inside that session. On fresh load/refresh, start with no highlight.
let _activeRecentId = null;

function _saveRecent() {
  if (_isGuestMode()) return; // guests: no history persistence
  localStorage.setItem('chunks_recent', JSON.stringify(_recentItems));
}

// ── Chat session save/restore ────────────────────────────

// Helper: read a session by one or more IDs (e.g. local id, then UUID).
// chunks_session_* keys live in IndexedDB after migration — use the IDB-aware
// bridge (window._lsGet) when available, with a plain localStorage fallback.
function _readSessionData(/* ...ids */) {
  for (let i = 0; i < arguments.length; i++) {
    const id = arguments[i];
    if (!id) continue;
    try {
      const val = window._lsGet ? window._lsGet('chunks_session_' + id, null)
                                : (() => { const r = localStorage.getItem('chunks_session_' + id); return r ? JSON.parse(r) : null; })();
      if (val) return val;
    } catch (_) {}
  }
  return null;
}

function _saveSession(id, historyArr) {
  // Always save — history is only deleted when user explicitly clears it
  const updatedAt = new Date().toISOString();
  // Look up the stable UUID for this session (set on the recent item at creation time)
  const recentItem = _recentItems.find(r => r.id === id);
  const supabaseId = recentItem?.uuid || null;
  // Never store rendered HTML — save only raw message data so restore always
  // re-renders through the component (guaranteeing action buttons are present).
  const sessionData = { id, supabaseId, history: historyArr, updatedAt };
  // chunks_session_* keys live in IndexedDB — use the IDB-aware bridge when available
  if (window._lsSet) {
    window._lsSet('chunks_session_' + id, sessionData);
  } else {
    localStorage.setItem('chunks_session_' + id, JSON.stringify(sessionData));
  }
  localStorage.setItem('chunks_active_home_session', id);
  // Auto-generate a label from the first user message when the session still has
  // a generic fallback label ('New Chat' or the legacy 'Session XXXXXXXX' pattern).
  // This ensures a meaningful title is persisted to Supabase on the very next save.
  if (recentItem && (_SESSION_FALLBACK_RE.test(recentItem.label) || recentItem.label === 'New Chat' || !recentItem.label)) {
    const firstUser = (historyArr || []).find(m => m.role === 'user');
    if (firstUser?.content) {
      const content = firstUser.content;
      const newLabel = content.length > 32 ? content.slice(0, 32).trimEnd() + '…' : content;
      if (newLabel !== recentItem.label) {
        recentItem.label    = newLabel;
        recentItem.question = content.slice(0, 80);
        _saveRecent();
        _renderAllRecent();
      }
    }
  }
  // Sync to Supabase using the valid UUID
  if (supabaseId) {
    window.ChunksDB?.chat?.saveFull?.({
      id:        supabaseId,
      title:     recentItem?.label || recentItem?.question?.slice(0, 80) ||
               (() => { try { const h = _readSessionData(id); const m = ((h?.history||h?.messages)||[]).find(x=>x.role==='user'); return m?.content?.slice(0,80)||null; } catch(_){return null;} })(),
      messages:  [],   // metadata-only — messages are written via ChunksDB.messages.insertMessage per turn
      updatedAt,
    });
  }
}

function _loadSession(id) {
  // chunks_session_* keys live in IndexedDB after migration — use IDB-aware read
  return _readSessionData(id);
}

// ── Workspace session save/restore ───────────────────────
function _saveWsSession(bookId, historyArr) {
  // Always save — history is only deleted when user explicitly clears it
  // Never store rendered HTML — save only raw message data so restore always
  // re-renders through the component (guaranteeing action buttons are present).
  localStorage.setItem('chunks_ws_session_' + bookId, JSON.stringify({ history: historyArr }));
  // Sync active book to ws_state (page/zoom synced separately via wsGoToPage)
  window.ChunksDB?.ws?.savePosition?.(bookId, {});
  // Track which book + recent item was last active
  localStorage.setItem('chunks_active_ws_book', bookId);

  // ── Sync workspace chat to Supabase ──────────────────────────────────────
  // Append-only: track how many messages have already been synced so we only
  // insert NEW messages on each call rather than re-inserting the entire history
  // (which would create quadratic duplicates in the messages table).
  const recentItem = _recentItems.find(r => r.bookId === bookId && r.source === 'workspace');
  const supabaseId = recentItem?.uuid || null;
  if (supabaseId && historyArr?.length) {
    const bookMeta = window.wsBookMeta?.[bookId];
    const bookName = (typeof bookMeta === 'object' ? bookMeta?.name : bookMeta?.split?.('/')?.[0]) || bookId;
    const firstUserMsg = historyArr.find(m => m.role === 'user');
    const title = recentItem?.label || (firstUserMsg?.content?.slice(0, 80)) || bookName;

    // Only insert messages that have not yet been synced to Supabase.
    const savedCountKey = 'chunks_ws_saved_cnt_' + supabaseId;
    const savedCount = parseInt(localStorage.getItem(savedCountKey) || '0', 10) || 0;
    const newMessages = historyArr.slice(savedCount);

    window.ChunksDB?.chat?.saveFull?.({
      id:        supabaseId,
      title,
      messages:  newMessages,
      bookId,
      updatedAt: new Date().toISOString(),
    })?.then?.(() => {
      // Advance the saved-count cursor only after a successful write.
      localStorage.setItem(savedCountKey, String(historyArr.length));
    }).catch?.(() => {
      // Leave cursor unchanged so the next save retries the failed messages.
    });
  } else if (supabaseId && !historyArr?.length) {
    // History was explicitly cleared — delete the Supabase row so the cleared
    // state persists across refreshes.
    window.ChunksDB?.chat?.deleteSession?.(supabaseId).catch(e => {
      console.warn('[workspace] failed to delete cleared session from Supabase:', e?.message || e);
    });
    // Also clear the localStorage entry so _loadWsSession returns nothing
    localStorage.removeItem('chunks_ws_session_' + bookId);
    // Reset the saved-count cursor so a fresh session starts from zero.
    localStorage.removeItem('chunks_ws_saved_cnt_' + supabaseId);
  }
}

function _loadWsSession(bookId) {
  try {
    const raw = localStorage.getItem('chunks_ws_session_' + bookId);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

// ── One-time startup cleanup ─────────────────────────────
// Remove stale keys left by any previous incognito session or save_history=0 setting.
// After this patch all chats always save, so these keys are no longer meaningful.
(function _cleanStaleKeys() {
  localStorage.removeItem('chunks_incognito_session');
  localStorage.removeItem('chunks_save_history');
})();
function goHome() {
  // Always return to the homepage landing — clear any active chat state
  _activeRecentId = null;
  homeHistory = [];
  _homeSessionId = null;
  localStorage.removeItem('chunks_active_home_session');
  localStorage.removeItem('chunks_active_ws_book');
  localStorage.removeItem('chunks_active_recent_id');
  localStorage.removeItem('chunks_active_vt_session');

  // Reset home to landing
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

  // Clear sidebar active state via _setActiveRecent so both DOM and localStorage are cleared
  if (typeof _setActiveRecent === 'function') _setActiveRecent(null);

  showScreen('home');

  // Refresh the Recent Activity / Try Asking section with the latest data
  if (typeof window._renderHomeActivities === 'function') window._renderHomeActivities();
}

function newChat() {
  // Always navigate to home screen first
  const _activeNow = document.querySelector('.screen.active');
  if (!_activeNow || _activeNow.id !== 'screen-home') showScreen('home');

    // Clear workspace messages + restore empty state
  const msgs = document.getElementById('ws-messages');
  if (msgs) msgs.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-4);text-align:center;padding:24px;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <div style="font-size:12px;color:var(--text-4);">Ask a question to start the conversation</div>
    </div>`;

  // Reset chat state — clear highlight properly via _setActiveRecent
  _wsChatHistory = [];
  if (typeof _setActiveRecent === 'function') _setActiveRecent(null); else _activeRecentId = null;
  homeHistory = [];
  _homeSessionId = null;
  localStorage.removeItem('chunks_active_home_session');
  localStorage.removeItem('chunks_home_session');
  localStorage.removeItem('chunks_active_ws_book');
  localStorage.removeItem('chunks_active_recent_id');
  localStorage.removeItem('chunks_active_vt_session');

  // Reset home screen to landing state
  const homeChatHistory = document.getElementById('home-chat-history');
  if (homeChatHistory) homeChatHistory.innerHTML = '';
  const homeLanding = document.getElementById('home-landing');
  const homeHero = document.querySelector('.home-hero');
  const homeBar = document.getElementById('home-input-bar');
  const homeScrollArea = document.getElementById('home-scroll-area');
  if (homeLanding) homeLanding.style.display = '';
  if (homeHero) homeHero.style.display = '';
  if (homeBar) homeBar.style.display = 'none';
  if (homeScrollArea) homeScrollArea.style.justifyContent = 'center';

  // Rotate hero heading to a new random phrase
  (function() {
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

  // Clear input
  const inp = document.getElementById('ws-chat-input');
  if (inp) { inp.value = ''; wsAutoResize(inp); }

  // Update context tag back to default
  const ctag = document.getElementById('ws-context-tag');
  if (ctag) ctag.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg> ${wsBookMeta[_wsBookId]?.split('/')[0]?.trim() || 'No book'}`;

  const title = document.getElementById('ws-chat-title');
  if (title) title.textContent = 'Select a book to start studying';

  // Go to workspace
  showScreen('workspace');

  // Focus input
  setTimeout(() => inp?.focus(), 120);

  // Deselect all recents
  _renderAllRecent();
}

// ── Add to recents (called on every send) ────────────────
function recentAdd(question, bookId, source) {
  if (!question) return;
  if (_isGuestMode()) return; // guests: no history tracking
  const label = question.length > 32 ? question.slice(0, 32).trimEnd() + '…' : question;
  // Don't duplicate if same as most recent of same source
  if (_recentItems.length && _recentItems[0].question === question && _recentItems[0].source === source) {
    _setActiveRecent(_recentItems[0].id);
    if (source === 'general') {
      _homeSessionId = _recentItems[0].id;
      window._homeSessionId = _homeSessionId;
      localStorage.setItem('chunks_home_session', _homeSessionId);
    }
    // For visual, the session id is tracked in VisualTutorScreen directly via _recentItems[0]
    return;
  }
  // For workspace chats, reuse the existing sidebar entry for the same book
  // instead of creating a duplicate on every new question.
  const effectiveBookId = (source === 'exam' || source === 'visual') ? '' : (bookId || _wsBookId || '');
  if (source === 'workspace' && effectiveBookId) {
    const existingIdx = _recentItems.findIndex(r => r.bookId === effectiveBookId && r.source === 'workspace');
    if (existingIdx !== -1) {
      const existing = _recentItems[existingIdx];
      // Preserve the existing label so the user's session name is not overwritten
      // on every new message. Only update the last question for input restoration.
      existing.question = question;
      if (existingIdx !== 0) {
        _recentItems.splice(existingIdx, 1);
        _recentItems.unshift(existing);
      }
      _saveRecent();
      _renderAllRecent();
      _setActiveRecent(existing.id);
      return;
    }
  }

  const item = {
    id: 'r' + Date.now(),
    // uuid is the cross-device stable identifier used for Supabase chat_sessions.
    // crypto.randomUUID() is available in all modern browsers.
    uuid: (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        }),
    label,
    question,
    bookId: effectiveBookId,
    source: source || (bookId ? 'workspace' : 'general')
  };
  _recentItems.unshift(item);
  if (_recentItems.length > RECENT_MAX) _recentItems = _recentItems.slice(0, RECENT_MAX);
  _saveRecent();
  _renderAllRecent();
  _setActiveRecent(item.id);
  if (source === 'general') {
    _homeSessionId = item.id;
    window._homeSessionId = item.id;
    localStorage.setItem('chunks_home_session', _homeSessionId);
  }
}

function _setActiveRecent(id) {
  _activeRecentId = id;
  document.querySelectorAll('.recent-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
  if (id) localStorage.setItem('chunks_active_recent_id', id);
  else localStorage.removeItem('chunks_active_recent_id');
}

async function _deleteRecent(id, e) {
  if (e && e.stopPropagation) e.stopPropagation();

  // Find the item before removing it
  const item = _recentItems.find(r => r.id === id);

  // Resolve the Supabase UUID for this session.
  // item.uuid can be null if _hydrateRecentFromRemote never ran (fresh page load,
  // session created before sync was set up, etc.). Without a UUID the Supabase DELETE
  // never fires and the row survives — coming back on every subsequent sync.
  // Fallback: read supabaseId from the localStorage session entry itself.
  let resolvedUuid = item?.uuid || null;
  if (!resolvedUuid) {
    try {
      // Use IDB-aware read — chunks_session_* keys live in IndexedDB after migration
      const lsEntry = _readSessionData(id);
      resolvedUuid = lsEntry?.supabaseId || null;
      // Also scan for a UUID-keyed entry whose id matches
      if (!resolvedUuid) {
        const _isUUID = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
        // Use IDB keys if available, fall back to localStorage scan
        const allKeys = (window._idbKeys && typeof window._idbKeys === 'function')
          ? window._idbKeys('chunks_session_')
          : (() => { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith('chunks_session_')) ks.push(k); } return ks; })();
        for (const k of allKeys) {
          const candidate = k.replace('chunks_session_', '');
          if (!_isUUID(candidate)) continue;
          try {
            const e2 = _readSessionData(candidate);
            if (e2?.id === id) { resolvedUuid = candidate; break; }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // ── NON-OPTIMISTIC DELETE: await Supabase first ─────────────────────────
  // Do NOT update local state until the DB delete succeeds.
  // If the delete fails, show a toast and leave the item in the sidebar.
  if (resolvedUuid && window.ChunksDB?.chat?.deleteSession) {
    const result = await window.ChunksDB.chat.deleteSession(resolvedUuid);
    if (result && result.error) {
      console.error('[_deleteRecent] Supabase delete failed:', result.error);
      wsShowToast?.('⚠', 'Failed to delete chat. Please try again.', 'var(--red)');
      return; // DO NOT update local state — the row still exists in Supabase
    }
  }

  // ── DB delete succeeded (or user is guest) — now update local state ─────
  // Remove from list and persist
  _recentItems = _recentItems.filter(r => r.id !== id);
  _saveRecent();

  // Remove saved session data from IDB/localStorage — both the r+timestamp key AND UUID key.
  // Use the IDB-aware bridge when available (chunks_session_* live in IndexedDB).
  const _rmSession = k => { if (window._lsRemove) window._lsRemove(k); else localStorage.removeItem(k); };
  _rmSession('chunks_session_' + id);
  if (resolvedUuid) {
    _rmSession('chunks_session_' + resolvedUuid);
  }
  if (item && item.bookId) {
    localStorage.removeItem('chunks_ws_session_' + item.bookId);
  }

  // In-memory guard — immune to Supabase DELETE propagation delay.
  // _hydrateRecentFromRemote checks this BEFORE the localStorage tombstone,
  // so a row that comes back from a sync that raced the DELETE is dropped here.
  [id, resolvedUuid].filter(Boolean).forEach(v => {
    _justDeleted.add(v);
    setTimeout(() => _justDeleted.delete(v), 15000);
  });

  // Tombstone BOTH the local id AND the resolved UUID so:
  //   1. _uploadLocalChatSessions never re-uploads this session
  //   2. pullAndApply never re-writes it to localStorage from Supabase
  try {
    const tombs = JSON.parse(localStorage.getItem('chunks_deleted_sessions') || '[]');
    [id, resolvedUuid].filter(Boolean).forEach(v => { if (!tombs.includes(v)) tombs.push(v); });
    localStorage.setItem('chunks_deleted_sessions', JSON.stringify(tombs.slice(-200)));
  } catch (_) {}

  if (item && item.source === 'visual') {
    localStorage.removeItem('chunks_vt_session_' + id);
  }
  if (item && item.source === 'exam' && item._snapId) {
    localStorage.removeItem('exam_snap_' + item._snapId);
  }

  // If this was the active chat, reset the UI back to landing.
  // Match by local id, by resolvedUuid (when the session was restored from
  // Supabase and _activeRecentId was set to the UUID), or by _homeSessionId
  // (the app.html local tracking var) as a final fallback.
  const isActiveSession = _activeRecentId === id
    || (resolvedUuid && _activeRecentId === resolvedUuid)
    || _homeSessionId === id
    || (resolvedUuid && _homeSessionId === resolvedUuid);
  if (isActiveSession) {
    _activeRecentId = null;
    localStorage.removeItem('chunks_active_recent_id');
    localStorage.removeItem('chunks_active_home_session');
    localStorage.removeItem('chunks_active_ws_book');
    localStorage.removeItem('chunks_active_vt_session');

    // Reset home landing
    homeHistory = [];
    _homeSessionId = null;
    // Also clear the HomeScreen.js module-level _homeSessionId via the window setter.
    window._homeSessionId = null;
    const chatHist   = document.getElementById('home-chat-history');
    const homeLanding = document.getElementById('home-landing');
    const homeHero   = document.querySelector('.home-hero');
    const homeBar    = document.getElementById('home-input-bar');
    const homeScroll = document.getElementById('home-scroll-area');
    if (chatHist)   chatHist.innerHTML = '';
    if (homeLanding) homeLanding.style.display = '';
    if (homeHero)   homeHero.style.display = '';
    if (homeBar)    homeBar.style.display = 'none';
    if (homeScroll) homeScroll.style.justifyContent = 'center';

    // Reset workspace messages
    const msgs = document.getElementById('ws-messages');
    if (msgs) msgs.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-4);text-align:center;padding:24px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><div style="font-size:12px;color:var(--text-4);">Ask a question to start the conversation</div></div>`;
    _wsChatHistory = [];

    // If deleted item was a visual tutor chat, stay on visual screen at entry
    if (item && item.source === 'visual') {
      if (typeof window._vtClear === 'function') window._vtClear();
      showScreen('visual');
    } else {
      showScreen('home');
    }
  }

  _renderAllRecent();
}

function _clickRecent(item) {
  _setActiveRecent(item.id);
  // Always set _navFromHistory = true so showScreen skips the "fresh navigation"
  // reset block — this preserves the active highlight for the clicked item and
  // prevents any stale-state clears from running on history-item navigation.
  // setNavFromHistory updates the module-scoped variable used by showScreen.
  if (typeof window.setNavFromHistory === 'function') window.setNavFromHistory(true);
  if (item.source === 'exam') {
    // Restore snapshot first, THEN show screen — prevents flash of setup view
    if (item._snapId && typeof window._examLoadSnap === 'function') {
      window._examLoadSnap(item._snapId, item.id);
    } else {
      // No snapshot — pre-fill topic so user can re-run
      _activeExamRecentId = item.id;
      const topicInput = document.getElementById('exam-topic-input');
      if (topicInput) topicInput.value = item.question?.replace(/\s*\(\d+%\)$/, '') || '';
    }
    showScreen('exam');
  } else if (item.source === 'visual') {
    // Visual Tutor — showScreen first (sets _navFromHistory correctly),
    // then restore so the highlight set above is never cleared by a second showScreen call
    showScreen('visual');
    if (typeof window._vtRestoreSession === 'function') {
      window._vtRestoreSession(item.id, item.question);
    }
  } else if (item.source === 'general' || !item.bookId) {
    // General AI — restore saved session
    showScreen('home');
    let session = _loadSession(item.id);
    // If the local-ID session has no history, also try the UUID key.
    // pullAndApply() stores sessions under their UUID, so the local-ID key
    // may have been overwritten with an empty history blob.
    if ((!session?.history?.length) && item.uuid) {
      const byUuid = _loadSession(item.uuid);
      if (byUuid?.history?.length) session = byUuid;
    }
    const landing = document.getElementById('home-landing');
    const hero = document.querySelector('.home-hero');
    const bar = document.getElementById('home-input-bar');
    const scrollArea = document.getElementById('home-scroll-area');
    const chatHistory = document.getElementById('home-chat-history');

    const history = session?.history || session?.messages || [];

    if (session && history.length) {
      // Restore full conversation — always re-render from structured data so
      // action buttons (Copy, Thumbs Up/Down, Retry) are always present and functional.
      if (landing) landing.style.display = 'none';
      if (hero) hero.style.display = 'none';
      if (bar) bar.style.display = 'flex';
      if (scrollArea) scrollArea.style.justifyContent = 'flex-start';

      // Point the active-session pointers at the clicked item so that
      // _onSessionsReady (fired by pullAndApply) restores the same session
      // rather than overwriting it with whichever session was last saved.
      localStorage.setItem('chunks_active_home_session', item.id);
      const _clickedUuid = session.supabaseId || item.uuid || null;
      if (_clickedUuid) localStorage.setItem('chunks_active_home_supabase_id', _clickedUuid);
      // Mark as "recently navigated" so _onSessionsReady treats this as a live session.
      if (typeof window._homeMarkNavTime === 'function') window._homeMarkNavTime();

      // _homeMountSession is always available when a recent item is clicked (HomeScreen.js
      // has already initialised by this point).  Never inject raw HTML — it loses event
      // handlers when passed through DOMPurify.
      if (typeof window._homeMountSession === 'function') {
        window._homeMountSession(session, item.id);
      } else {
        // Rare: HomeScreen.js not yet ready — defer briefly to let module init settle.
        setTimeout(() => window._homeMountSession?.(session, item.id), 200);
      }

      homeHistory = history;
      _homeSessionId = item.id;
      window._homeSessionId = item.id;
      setTimeout(() => {
        homeScrollBottom();
        document.getElementById('home-ask-input-bottom')?.focus();
      }, 60);
    } else {
      // No local history — set up UI then try to load messages from Supabase.
      // This handles sessions whose history was cleared by pullAndApply() because
      // messages now live in the Supabase messages table rather than in the session
      // metadata blob.
      if (landing) landing.style.display = 'none';
      if (hero) hero.style.display = 'none';
      if (bar) bar.style.display = 'flex';
      if (scrollArea) scrollArea.style.justifyContent = 'flex-start';
      _homeSessionId = item.id;
      window._homeSessionId = item.id;

      const sessionUuid = session?.supabaseId
        || item.uuid
        || _loadSession(item.uuid)?.supabaseId
        || null;

      // Point active-session pointers at the clicked item before the async
      // fetch so that _onSessionsReady (if it fires concurrently) loads the
      // same session instead of overwriting with a stale/different one.
      localStorage.setItem('chunks_active_home_session', item.id);
      if (sessionUuid) localStorage.setItem('chunks_active_home_supabase_id', sessionUuid);
      if (typeof window._homeMarkNavTime === 'function') window._homeMarkNavTime();

      if (sessionUuid && window.ChunksDB?.isLoggedIn?.()) {
        // Show a subtle loading indicator while fetching
        if (chatHistory) chatHistory.innerHTML = '<div class="hc-session-loading">Loading conversation…</div>';
        (async () => {
          try {
            const { data: remoteMessages } = (await window.ChunksDB.messages.loadSession(sessionUuid)) ?? {};
            if (remoteMessages?.length) {
              const remoteSession = { id: item.id, supabaseId: sessionUuid, history: remoteMessages };
              // Cache locally so subsequent clicks are instant
              window._lsSet?.('chunks_session_' + item.id, remoteSession);
              if (typeof window._homeMountSession === 'function') {
                window._homeMountSession(remoteSession, item.id);
              } else {
                setTimeout(() => {
                  if (typeof window._homeMountSession === 'function') {
                    window._homeMountSession(remoteSession, item.id);
                  }
                }, 200);
              }
              homeHistory = remoteMessages;
              setTimeout(() => {
                homeScrollBottom();
                document.getElementById('home-ask-input-bottom')?.focus();
              }, 60);
            } else {
              // Nothing found in Supabase either — show inline notice
              if (chatHistory) chatHistory.innerHTML = '<div class="hc-session-unavailable">Session no longer available</div>';
            }
          } catch (_err) {
            // Network or Supabase error — replace the loading indicator with a notice
            if (chatHistory) chatHistory.innerHTML = '<div class="hc-session-unavailable">Could not load conversation</div>';
          }
        })();
      } else {
        // Guest or no UUID — session data is gone
        if (chatHistory) chatHistory.innerHTML = '<div class="hc-session-unavailable">Session no longer available</div>';
      }
    }
  } else {
    // Workspace / book question — restore saved session, never re-send
    showScreen('workspace');

    const _doRestore = async () => {
      // For logged-in users: always fetch fresh chat history from Supabase so the
      // panel reflects the authoritative database state rather than stale localStorage.
      if (window.ChunksDB?.isLoggedIn()) {
        const { data: freshHistory } = await window.ChunksDB.chat.getSessionByBook(item.bookId);
        if (freshHistory?.length) {
          // Supabase only stores role+content — merge thinkContent/thinkDuration/blocks
          // from the local session so ThinkingAccordions and source citations survive refresh.
          const wsLocalSession = _loadWsSession(item.bookId);
          const wsLocalHistory = wsLocalSession?.history || wsLocalSession?.messages || [];
          const mergedHistory = wsLocalHistory.length ? freshHistory.map((m, idx) => {
            if (m.role !== 'assistant') return m;
            const byIndex = wsLocalHistory[idx];
            const localMatch = (byIndex?.role === 'assistant')
              ? byIndex
              : wsLocalHistory.find(lm => lm.role === 'assistant' && lm.content === m.content);
            if (!localMatch) return m;
            const merged = { ...m };
            if (localMatch.thinkContent) {
              merged.thinkContent  = localMatch.thinkContent;
              merged.thinkDuration = localMatch.thinkDuration ?? 0;
            }
            if (localMatch.blocks?.length) merged.blocks = localMatch.blocks;
            return merged;
          }) : freshHistory;
          window._wsRenderHistory(document.getElementById('ws-messages'), mergedHistory);
          _wsChatHistory = mergedHistory;
          // Sync ws.chatHistory so _wsAsk sends correct context on next question.
          if (window.ws) window.ws.chatHistory = mergedHistory;
          localStorage.setItem('chunks_active_ws_book', item.bookId);
          window.ChunksDB?.ws?.savePosition?.(item.bookId, {});
          setTimeout(() => document.getElementById('ws-chat-input')?.focus(), 80);
          return;
        }
      }

      // Fallback for guests or when Supabase returns no data: read localStorage/IDB.
      let wsSession = _loadWsSession(item.bookId);
      // Fallback: look up by UUID in IDB (written by pullAndApply for cross-device / re-login)
      if (!wsSession || !(wsSession.history || []).length) {
        const idbSession = _readSessionData(item.uuid, item.id);
        if (idbSession && (idbSession.history || idbSession.messages || []).length) {
          wsSession = { history: idbSession.history || idbSession.messages || [] };
        }
      }
      const wsHistory = wsSession?.history || wsSession?.messages || [];
      if (wsSession && wsHistory.length) {
        // Always re-render from structured history — never inject raw HTML, which
        // loses event handlers when passed through DOMPurify.
        const msgs = document.getElementById('ws-messages');
        window._wsRenderHistory(msgs, wsHistory);
        _wsChatHistory = wsHistory;
        // Sync ws.chatHistory so _wsAsk sends correct context on next question.
        if (window.ws) window.ws.chatHistory = wsHistory;
        localStorage.setItem('chunks_active_ws_book', item.bookId);
        // Phase 3: record active book in ws_state
        window.ChunksDB?.ws?.savePosition?.(item.bookId, {});
        setTimeout(() => {
          const m = document.getElementById('ws-messages');
          if (m) m.scrollTop = m.scrollHeight;
          document.getElementById('ws-chat-input')?.focus();
        }, 80);
      } else {
        // No saved session found anywhere — show inline notice
        const msgs = document.getElementById('ws-messages');
        if (msgs) msgs.innerHTML = '<div class="ws-session-unavailable">Session no longer available</div>';
      }
    };

    if (item.bookId !== _wsBookId || !_wsPdfDoc) {
      selectBook(item.bookId).then(() => setTimeout(_doRestore, 400));
    } else {
      setTimeout(_doRestore, 80);
    }
  }
}

function _buildRecentItem(item) {
  const el = document.createElement('div');
  el.className = 'recent-item' + (item.id === _activeRecentId ? ' active' : '');
  el.dataset.id = item.id;
  el.title = item.question;
  el.innerHTML = `
    <span class="recent-title">${(item.pinned ? '📌 ' : '') + item.label.replace(/</g,'&lt;')}</span>
    <span class="recent-menu-btn" title="More options">···</span>`;
  el.addEventListener('click', () => _clickRecent(item));
  el.querySelector('.recent-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    _showRecentCtxMenu(item, e);
  });
  return el;
}

// ── Context menu ─────────────────────────────────────────
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

  // Position near the button
  const rect = e.currentTarget.getBoundingClientRect();
  let top = rect.top;
  let left = rect.right + 8;
  // If it goes off screen right, flip to left side
  if (left + 180 > window.innerWidth) left = rect.left - 188;
  if (top + 160 > window.innerHeight) top = window.innerHeight - 170;
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';

  menu.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    _closeCtxMenu();

    if (action === 'delete') {
      showConfirmModal({
        title: 'Delete this chat?',
        desc: `"${item.label.replace(/…$/, '')}" will be permanently removed.`,
        confirmLabel: 'Delete chat',
        onConfirm: async () => {
          await _deleteRecent(item.id, { stopPropagation: () => {} });
          wsShowToast('🗑️', 'Chat deleted', '');
        }
      });

    } else if (action === 'rename') {
      const newName = prompt('Rename chat:', item.label.replace(/…$/, ''));
      if (newName && newName.trim()) {
        item.label    = newName.trim().slice(0, 40);
        item.question = item.question || item.label;
        _saveRecent();
        _renderAllRecent();
        // Sync renamed title to Supabase if session has a uuid
        if (item.uuid) {
          window.ChunksDB?.chat?.saveFull?.({
            id:        item.uuid,
            title:     item.label,
            messages:  [],   // empty — saveFull merges, never overwrites existing messages with []
            updatedAt: new Date().toISOString(),
          });
        }
      }

    } else if (action === 'pin') {
      item.pinned = !item.pinned;
      // Move pinned items to top
      _recentItems.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
      _saveRecent();
      _renderAllRecent();
    }
  });

  // Close on outside click
  setTimeout(() => document.addEventListener('click', _closeCtxMenu, { once: true }), 0);
}

function _renderAllRecent() {
  const generalItems   = _recentItems.filter(r => r.source === 'general' || (!r.bookId && r.source !== 'visual' && r.source !== 'exam'));
  const workspaceItems = _recentItems.filter(r => r.source === 'workspace' && r.bookId);

  // All General AI list IDs across every screen
  const generalIds = [
    'recent-list-general', 'recent-list-general-ws', 'recent-list-general-flash',
    'recent-list-general-research', 'recent-list-general-exam', 'recent-list-general-studyplan',
    'recent-list-general-visual', 'recent-list-general-lib',
  ];
  generalIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = generalItems.length
      ? ''
      : '<div class="recent-empty">No chats yet</div>';
    generalItems.forEach(item => el.appendChild(_buildRecentItem(item)));
  });

  // All Workspace list IDs across every screen
  const workspaceIds = [
    'recent-list-home', 'recent-list-workspace', 'recent-list-flash',
    'recent-list-ws-research', 'recent-list-ws-exam', 'recent-list-ws-studyplan',
    'recent-list-ws-visual', 'recent-list-ws-lib',
  ];
  workspaceIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = workspaceItems.length
      ? ''
      : '<div class="recent-empty">No recent chats yet</div>';
    workspaceItems.forEach(item => el.appendChild(_buildRecentItem(item)));
  });

  // Refresh home landing "Recent activity" section
  if (typeof window._renderHomeActivities === 'function') {
    window._renderHomeActivities();
  }

  // Refresh document-grouped recents view
  _renderDocGroupedRecents();

  // Refresh unified sidebar recents (sidebar Change 1)
  window._renderUnifiedRecents?.();
}
// Expose immediately so Sidebar.js can call it as soon as it evaluates
window._renderAllRecent = _renderAllRecent;

// ── Document-grouped recents ─────────────────────────────────────────────

function _renderDocGroupedRecents() {
  const allItems = Array.isArray(_recentItems) ? _recentItems : [];

  // ── Recent Chats section: general + visual + exam items (flat list) ───────
  const chatItems = allItems.filter(r => r.source !== 'workspace');

  document.querySelectorAll('.sidebar-recent-chats-list').forEach(container => {
    if (chatItems.length === 0) {
      container.innerHTML = '<div class="recent-empty">No history yet</div>';
      return;
    }
    container.innerHTML = '';
    chatItems.forEach(item => container.appendChild(_buildRecentItem(item)));
  });

  // ── Recent Workspace section: workspace items grouped by book ─────────────
  const wsItems = allItems.filter(r => r.source === 'workspace' && r.bookId);

  document.querySelectorAll('.sidebar-recent-workspace-list').forEach(container => {
    if (wsItems.length === 0) {
      container.innerHTML = '<div class="recent-empty">No history yet</div>';
      return;
    }

    // Group by bookId
    const bookGroups = new Map();
    wsItems.forEach(item => {
      const key = item.bookId;
      if (!bookGroups.has(key)) {
        const meta = window.wsBookMeta?.[item.bookId];
        const metaName = typeof meta === 'object' ? meta?.name : meta?.split?.('/')?.[0];
        const userDocName = item.bookId === '__user_doc__'
          ? (localStorage.getItem('chunks_active_ws_user_doc_name') || 'My Document')
          : item.bookId;
        bookGroups.set(key, { title: metaName || userDocName, items: [] });
      }
      bookGroups.get(key).items.push(item);
    });

    const DOC_GROUP_MAX_TITLE = 22;
    const html = [];
    bookGroups.forEach(({ title, items: groupItems }) => {
      const safeTitle = title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const count = groupItems.length;
      const truncTitle = title.length > DOC_GROUP_MAX_TITLE ? title.slice(0, DOC_GROUP_MAX_TITLE) + '…' : title;
      const safeTrunc = truncTitle.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const iconHtml = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

      const itemsHtml = groupItems.map(item => {
        const isActive = item.id === _activeRecentId;
        const lbl = (item.pinned ? '📌 ' : '') + item.label.replace(/</g,'&lt;');
        return `<div class="recent-item doc-group-item${isActive ? ' active' : ''}" data-id="${item.id}" title="${item.question.replace(/"/g,'&quot;')}">
          <span class="recent-title">${lbl}</span>
          <span class="recent-menu-btn" title="More options">···</span>
        </div>`;
      }).join('');

      html.push(`<div class="sidebar-doc-group" data-group-type="doc">
        <div class="doc-group-header" role="button" aria-expanded="true">
          ${iconHtml}
          <span class="doc-group-title" title="${safeTitle}">${safeTrunc}</span>
          <span class="doc-group-count">${count}</span>
          <svg class="hist-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="doc-group-items">${itemsHtml}</div>
      </div>`);
    });

    container.innerHTML = html.join('');

    // Wire up group collapse toggles
    container.querySelectorAll('.doc-group-header').forEach(header => {
      header.addEventListener('click', () => {
        const group = header.closest('.sidebar-doc-group');
        group.classList.toggle('collapsed');
        header.setAttribute('aria-expanded', group.classList.contains('collapsed') ? 'false' : 'true');
      });
    });

    // Wire up item clicks and context menus
    container.querySelectorAll('.doc-group-item').forEach(el => {
      const id = el.dataset.id;
      const item = _recentItems.find(r => r.id === id);
      if (!item) return;
      el.addEventListener('click', e => {
        if (e.target.classList.contains('recent-menu-btn')) return;
        _clickRecent(item);
      });
      el.querySelector('.recent-menu-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        _showRecentCtxMenu(item, e);
      });
    });
  });
}


// Alias — called on page load and when research screen opens
function _renderRecentList() { _renderAllRecent(); }

// ── Window bridges — let ES modules reach these inline-script functions ───
window._renderAllRecent   = _renderAllRecent;
window._renderRecentList  = _renderRecentList;
window._setActiveRecent   = _setActiveRecent;
window._saveRecent        = _saveRecent;
window._saveSession       = _saveSession;
// Exposes the `let _recentItems` binding (not a window property) so ES modules
// can wipe it atomically.  clearAllHistory() in SettingsModal.js calls this.
window._clearRecentItems  = function() { _recentItems = []; };

// ── Chat search popup ─────────────────────────────────────────────────────
(function() {
  let _overlay = null;
  let _focusedIdx = -1;

  function _sourceLabel(source) {
    if (!source || source === 'general') return 'General AI';
    if (source === 'workspace') return 'Workspace';
    if (source === 'visual') return 'Visual Tutor';
    if (source === 'exam') return 'Exam';
    return source;
  }

  function _highlight(text, query) {
    if (!query) return text.replace(/</g, '&lt;');
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(/</g, '&lt;').replace(new RegExp(`(${safe})`, 'gi'), '<mark>$1</mark>');
  }

  function _buildOverlay() {
    const el = document.createElement('div');
    el.className = 'chat-search-overlay';
    el.innerHTML = `
      <div class="chat-search-popup" role="dialog" aria-label="Search chats">
        <div class="chat-search-input-row">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="chat-search-input" id="chat-search-input" placeholder="Search chats…" autocomplete="off" spellcheck="false" />
          <span class="chat-search-kbd">Esc</span>
        </div>
        <div class="chat-search-results" id="chat-search-results"></div>
        <div class="chat-search-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>`;

    el.addEventListener('click', e => {
      if (!el.querySelector('.chat-search-popup').contains(e.target)) _closeSearch();
    });

    const input = el.querySelector('#chat-search-input');
    input.addEventListener('input', () => _renderResults(input.value.trim()));
    input.addEventListener('keydown', e => {
      const items = el.querySelectorAll('.chat-search-result-item');
      if (e.key === 'ArrowDown') { e.preventDefault(); _moveFocus(items, 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); _moveFocus(items, -1); }
      else if (e.key === 'Enter') { e.preventDefault(); const f = el.querySelector('.chat-search-result-item.focused'); if (f) f.click(); }
      else if (e.key === 'Escape') _closeSearch();
    });

    document.body.appendChild(el);
    _overlay = el;
    requestAnimationFrame(() => el.classList.add('open'));
    setTimeout(() => input.focus(), 80);
    _renderResults('');
  }

  function _moveFocus(items, dir) {
    items.forEach(i => i.classList.remove('focused'));
    _focusedIdx = Math.max(0, Math.min(items.length - 1, _focusedIdx + dir));
    if (items[_focusedIdx]) { items[_focusedIdx].classList.add('focused'); items[_focusedIdx].scrollIntoView({ block: 'nearest' }); }
  }

  function _renderResults(query) {
    _focusedIdx = -1;
    const resultsEl = _overlay.querySelector('#chat-search-results');
    const lq = query.toLowerCase();
    const all = typeof _recentItems !== 'undefined' ? _recentItems : [];
    const filtered = lq ? all.filter(r => r.label.toLowerCase().includes(lq)) : all.slice(0, 30);

    if (!filtered.length) {
      resultsEl.innerHTML = `<div class="chat-search-empty">${query ? 'No chats match "' + query.replace(/</g,'&lt;') + '"' : 'No chats yet'}</div>`;
      return;
    }

    // Group by source
    const groups = {};
    filtered.forEach(r => {
      const src = r.source || 'general';
      if (!groups[src]) groups[src] = [];
      groups[src].push(r);
    });

    const ORDER = ['general', 'workspace', 'visual', 'exam'];
    let html = '';
    ORDER.forEach(src => {
      if (!groups[src]) return;
      html += `<div class="chat-search-section-label">${_sourceLabel(src)}</div>`;
      groups[src].forEach(item => {
        html += `<div class="chat-search-result-item" data-id="${item.id}">
          <span class="chat-search-result-name">${_highlight(item.label, query)}</span>
        </div>`;
      });
    });
    resultsEl.innerHTML = html;

    resultsEl.querySelectorAll('.chat-search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const item = all.find(r => r.id === el.dataset.id);
        if (item) { _closeSearch(); _clickRecent(item); }
      });
    });
  }

  function _closeSearch() {
    if (!_overlay) return;
    _overlay.classList.remove('open');
    setTimeout(() => { _overlay?.remove(); _overlay = null; }, 200);
  }

  function openChatSearch() {
    if (_overlay) { _closeSearch(); return; }
    _buildOverlay();
  }

  // Keyboard shortcut: Ctrl/Cmd+K
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openChatSearch(); }
  });

  // Wire up all search buttons (delegated — sidebars mount after this runs)
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="openChatSearch-self"]');
    if (btn && !_isGuestMode()) openChatSearch();
  });

  window.openChatSearch = openChatSearch;
})();

// ── Cross-device session hydration ────────────────────────────────────────────
// Called by ChunksDB.chat.pullAndApply() after it writes remote sessions into
// localStorage.  Merges those sessions into _recentItems so that _saveSession
// can find their uuid and route subsequent writes to Supabase.
//
// This is the fix for Bug #1: without this, supabaseId is always null on a
// restored device, causing every new message to be written only to localStorage.
//
// @param {Array} remoteSessions  — raw rows from chat_sessions (Supabase shape)
window._hydrateRecentFromRemote = function(remoteSessions) {
  if (!Array.isArray(remoteSessions) || !remoteSessions.length) return;

  // Load tombstones — must happen BEFORE we touch _recentItems so we can
  // purge any deleted sessions that were loaded from localStorage at boot.
  const _hydrateTombs = (() => {
    try { return new Set(JSON.parse(localStorage.getItem('chunks_deleted_sessions') || '[]')); }
    catch(_) { return new Set(); }
  })();

  // STEP 1: Purge tombstoned sessions that snuck in from localStorage at boot.
  // Without this, a deleted session in chunks_recent stays in the sidebar even
  // after tombstones are restored from Supabase — because _recentItems was
  // already populated before sync ran.
  const before = _recentItems.length;
  _recentItems = _recentItems.filter(r => {
    // _justDeleted is checked first — it's in-memory and immune to Supabase
    // DELETE propagation delay that the localStorage tombstone is subject to.
    if (_justDeleted.has(r.id) || (r.uuid && _justDeleted.has(r.uuid))) return false;
    if (_hydrateTombs.has(r.id) || (r.uuid && _hydrateTombs.has(r.uuid))) return false;
    return true;
  });
  if (_recentItems.length !== before) {
    _saveRecent();
    _renderAllRecent();
    console.log(`[app] purged ${before - _recentItems.length} tombstoned session(s) from sidebar`);
  }

  // STEP 2: Add remote sessions not yet in _recentItems
  const existingUuids = new Set(_recentItems.map(r => r.uuid).filter(Boolean));

  // Build uuid→source map from existing local items so we preserve
  // 'exam' / 'visual' / 'workspace' source on sessions we already know about.
  const _knownSource = {};
  _recentItems.forEach(r => { if (r.uuid) _knownSource[r.uuid] = r.source; });

  // Also update labels for existing items whose title may now be set (was '' before)
  let labelUpdated = false;
  _recentItems.forEach(r => {
    if (!r.uuid) return;
    const match = remoteSessions.find(s => s.id === r.uuid);
    if (!match) return;
    const newTitle = match.title || '';
    // Try first user message if still no title
    let bestLabel = newTitle;
    if (!bestLabel) {
      try {
        const localSession = _readSessionData(match.id);
        if (localSession) {
          const msgs = localSession.history || localSession.messages || [];
          const firstUser = msgs.find(m => m.role === 'user');
          if (firstUser?.content) bestLabel = firstUser.content.slice(0, 60).trim();
        }
      } catch(_) {}
    }
    if (bestLabel && bestLabel.length > 32) bestLabel = bestLabel.slice(0, 32).trimEnd() + '…';
    if (bestLabel && bestLabel !== r.label) {
      r.label    = bestLabel;
      r.question = newTitle || bestLabel;
      labelUpdated = true;
    } else if (!bestLabel && _SESSION_FALLBACK_RE.test(r.label)) {
      // Upgrade legacy 'Session XXXXXXXX' fallback labels to 'New Chat'
      r.label = 'New Chat';
      labelUpdated = true;
    }
  });

  let changed = false;

  for (const remote of remoteSessions) {
    if (!remote.id) continue;
    if (existingUuids.has(remote.id)) continue;
    // Check _justDeleted before tombstones — the DELETE may not have propagated yet.
    if (_justDeleted.has(remote.id)) continue;
    if (_hydrateTombs.has(remote.id)) continue;

    const localId = remote.id;
    const title = remote.title || '';

    // Build label: prefer saved title → first user message → uuid prefix (never 'Chat')
    let label = title;
    if (!label) {
      // Try to pull first user message from local session data
      try {
        const localSession = _readSessionData(remote.id);
        if (localSession) {
          const msgs = localSession.history || localSession.messages || [];
          const firstUser = msgs.find(m => m.role === 'user');
          if (firstUser?.content) label = firstUser.content.slice(0, 60).trim();
        }
      } catch(_) {}
    }
    if (!label) label = 'New Chat';
    if (label.length > 32) label = label.slice(0, 32).trimEnd() + '…';

    // Prefer locally-known source (preserves 'exam'/'visual'/'workspace').
    // Fall back to book_id inference for sessions only seen on this device for first time.
    const source = _knownSource[remote.id] || (remote.book_id ? 'workspace' : 'general');

    _recentItems.push({
      id:       localId,
      uuid:     remote.id,
      label,
      question: title,
      bookId:   remote.book_id || '',
      source,
    });

    existingUuids.add(remote.id);
    changed = true;
  }

  if (!changed && !labelUpdated && before === _recentItems.length) return;

  // Trim to cap — keep the most-recent RECENT_MAX entries.
  if (_recentItems.length > RECENT_MAX) {
    _recentItems = _recentItems.slice(0, RECENT_MAX);
  }

  _saveRecent();
  _renderAllRecent();
  // Deferred re-render handles the race where pullAndApply completes before
  // mountSidebars() has finished injecting the sidebar DOM containers.
  setTimeout(() => { _renderAllRecent(); }, 50);
};
window._loadSession       = _loadSession;
window._saveWsSession     = _saveWsSession;
window._loadWsSession     = _loadWsSession;
window._deleteRecent      = _deleteRecent;
window._clickRecent       = _clickRecent;
window._showRecentCtxMenu = _showRecentCtxMenu;
window._buildRecentItem   = _buildRecentItem;
window._getRecentItems    = () => _recentItems;
window.recentAdd          = recentAdd;
// goHome/newChat need to be on window for inline onkeydown handlers in Sidebar.js
window.goHome             = goHome;
window.newChat            = newChat;


// ── Home chat session restore → src/screens/HomeScreen.js (Task 25) ──────
// (Moved to HomeScreen.js so it runs after mountHomeScreen() injects the DOM)

// ── Hook wsChatSend to add to recents on every send ──────
// Deferred to DOMContentLoaded: #ws-chat-send and #ws-chat-input are injected
// by WorkspaceScreen.js (a module), which runs before DOMContentLoaded fires.
// At inline-script parse time those elements don't exist yet — attaching here
// would return null and the listeners would never fire.
document.addEventListener('DOMContentLoaded', function() {
  const sendBtn = document.getElementById('ws-chat-send');
  const inputEl = document.getElementById('ws-chat-input');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const q = document.getElementById('ws-chat-input')?.value?.trim();
      if (q) recentAdd(q, window._wsBookId, 'workspace');
    }, true); // capture — fires before wsChatSend clears the input
  }
  if (inputEl) {
    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        const q = this.value.trim();
        if (q) recentAdd(q, window._wsBookId, 'workspace');
      }
    }, true);
  }
});

// ── Shortcuts modal open/close + keyboard shortcuts handler ─────────────────
/* ── Shortcuts Modal ── */
let _shortcutsFocusRelease = null;
function openShortcuts() {
  document.getElementById('shortcuts-modal').classList.add('active');
  _shortcutsFocusRelease = trapFocus(document.getElementById('shortcuts-modal'));
}
function closeShortcuts() {
  document.getElementById('shortcuts-modal').classList.remove('active');
  if (_shortcutsFocusRelease) { _shortcutsFocusRelease(); _shortcutsFocusRelease = null; }
}

// Close on backdrop click
document.getElementById('shortcuts-modal')?.addEventListener('click', function(e) {
  if (e.target === this) closeShortcuts();
});

/* ── Global keyboard shortcuts ── */
document.addEventListener('keydown', function(e) {
  const tag = document.activeElement?.tagName?.toLowerCase();
  const isTyping = tag === 'textarea' || tag === 'input' || document.activeElement?.isContentEditable;

  const shortcutsOpen = document.getElementById('shortcuts-modal')?.classList.contains('active');
  const settingsOpen  = document.getElementById('settings-modal')?.classList.contains('active');
  const helpOpen      = document.getElementById('help-modal')?.classList.contains('active');
  const confirmOpen   = document.getElementById('confirm-modal')?.classList.contains('active');
  const libraryOpen   = document.getElementById('library-modal')?.classList.contains('active');
  const explainOpen   = document.getElementById('sp-explain-drawer')?.classList.contains('open');
  const incogOpen     = document.getElementById('incognito-modal')?.classList.contains('active');

  // ── Ctrl+/ — toggle shortcuts (always works) ─────────────
  if (e.ctrlKey && !e.shiftKey && e.key === '/') {
    e.preventDefault();
    if (shortcutsOpen) closeShortcuts(); else { closeSettings(); closeHelpCenter(); openShortcuts(); }
    return;
  }

  // ── Ctrl+, — toggle settings (always works) ──────────────
  if (e.ctrlKey && !e.shiftKey && e.key === ',') {
    e.preventDefault();
    if (settingsOpen) closeSettings(); else { closeShortcuts(); closeHelpCenter(); openSettings('general'); }
    return;
  }

  // ── Ctrl+K — focus/blur active screen chat input (always works, any screen) ────
  if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    const activeScreen = document.querySelector('.screen.active');
    const input =
      (activeScreen && (
        activeScreen.querySelector('textarea:not([style*="display:none"])') ||
        activeScreen.querySelector('input[type="text"]:not([style*="display:none"])')
      )) ||
      document.getElementById('home-ask-input-bottom') ||
      document.getElementById('ws-chat-input') ||
      document.getElementById('vt-input') ||
      document.getElementById('home-ask-input');
    if (input) {
      if (document.activeElement === input) input.blur();
      else input.focus();
    }
    return;
  }

  // ── Escape — layered close ────────────────────────────────
  if (e.key === 'Escape' && !e.ctrlKey && !e.shiftKey) {
    if (confirmOpen)   { closeConfirmModal();           return; }
    if (incogOpen)     { window.closeIncognitoChat?.(); return; }
    if (explainOpen)   { spCloseExplainDrawer();        return; }
    if (shortcutsOpen) { closeShortcuts();              return; }
    if (helpOpen)      { closeHelpCenter();             return; }
    if (libraryOpen)   { closeLibraryModal();           return; }
    if (settingsOpen)  { closeSettings();               return; }
    if (typeof wsStopStream === 'function') { wsStopStream(); }
    return;
  }

  // ── Ctrl+. — toggle sidebar (always works, any screen) ───
  if (e.ctrlKey && !e.shiftKey && e.key === '.') {
    e.preventDefault();
    if (typeof toggleSidebar === 'function') toggleSidebar();
    return;
  }

  // ── Ctrl+Shift+Backspace — delete current chat OR active study plan ────────
  // (before isTyping guard so it works regardless of focus, from any screen)
  if (e.ctrlKey && e.shiftKey && e.key === 'Backspace') {
    e.preventDefault();

    // Check if a study plan is currently loaded.
    // window._spActivePlanId is now bridged via Object.defineProperty, but also
    // fall back to localStorage so the shortcut works even before spInitScreen runs.
    const _activePlanId = (typeof window._spActivePlanId !== 'undefined' && window._spActivePlanId)
      ? window._spActivePlanId
      : (() => { try { return localStorage.getItem('sp_active_plan_id') || null; } catch(_) { return null; } })();
    const _activePlan   = (typeof window._spCurrentPlan  !== 'undefined') ? window._spCurrentPlan  : null;

    if (_activePlanId && _activePlan) {
      // Delete the active study plan (works from any screen)
      const topic = _activePlan.topic || 'this plan';
      showConfirmModal({
        title: 'Delete this plan?',
        desc: `"${topic}" will be permanently removed.`,
        confirmLabel: 'Delete plan',
        onConfirm: () => {
          if (typeof window.spDeletePlan === 'function') window.spDeletePlan(_activePlanId);
          if (typeof window._renderRecentPlansAllSidebars === 'function') window._renderRecentPlansAllSidebars();
          wsShowToast('🗑️', `"${topic}" deleted`, '');
        }
      });
    } else if (_activeRecentId) {
      // Delete the active chat
      const item = _recentItems.find(r => r.id === _activeRecentId);
      showConfirmModal({
        title: 'Delete this chat?',
        desc: item ? `"${item.label.replace(/…$/, '')}" will be permanently removed.` : 'This chat will be permanently removed.',
        confirmLabel: 'Delete chat',
        onConfirm: () => {
          _deleteRecent(_activeRecentId, { stopPropagation: () => {} });
          wsShowToast('🗑️', 'Chat deleted', '');
        }
      });
    } else {
      wsShowToast('⚠', 'No active chat or plan to delete', '');
    }
    return;
  }

  // ── Ctrl+I — toggle incognito chat modal (always works, even while typing) ──
  if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'i') {
    e.preventDefault();
    const modal = document.getElementById('incognito-modal');
    if (modal?.classList.contains('active')) window.closeIncognitoChat?.();
    else window.openIncognitoChat?.();
    return;
  }

  // ── Ctrl+Shift+O — new chat (always works, even while typing) ──
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    if (typeof newChat === 'function') newChat();
    return;
  }

  // ── Ctrl+U — upload file (always works, even while typing) ───
  if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'u') {
    e.preventDefault();
    const activeScreen = document.querySelector('.screen.active');
    const fileInput = (activeScreen || document).querySelector('input[type="file"]');
    if (fileInput) fileInput.click();
    else wsShowToast('📎', 'File upload not available here', '');
    return;
  }

  // Skip remaining shortcuts while typing
  if (isTyping) return;

});

window.openShortcuts  = openShortcuts;
window.closeShortcuts = closeShortcuts;

// ── Help center open/close/filter ───────────────────────────────────────────
let _helpFocusRelease = null;
function openHelpCenter() {
  document.getElementById('help-modal').classList.add('active');
  document.getElementById('help-search-input').value = '';
  filterFAQs('');
  _helpFocusRelease = trapFocus(document.getElementById('help-modal'));
}
function closeHelpCenter() {
  document.getElementById('help-modal').classList.remove('active');
  if (_helpFocusRelease) { _helpFocusRelease(); _helpFocusRelease = null; }
}

document.getElementById('help-modal')?.addEventListener('click', function(e) {
  if (e.target === this) closeHelpCenter();
});

function toggleFAQ(qEl) {
  const item = qEl.closest('.faq-item');
  const wasOpen = item.classList.contains('open');
  // Close all
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
}

function filterFAQs(query) {
  const q = query.toLowerCase().trim();
  const items = document.querySelectorAll('.faq-item');
  const labels = document.querySelectorAll('#help-body .help-section-label');
  let anyVisible = false;

  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    const match = !q || text.includes(q);
    item.style.display = match ? '' : 'none';
    if (match) anyVisible = true;
  });

  // Hide section labels if all items in that section are hidden
  labels.forEach(label => {
    let next = label.nextElementSibling;
    let hasVisible = false;
    while (next && !next.classList.contains('help-section-label') && !next.classList.contains('faq-no-results')) {
      if (next.style.display !== 'none') hasVisible = true;
      next = next.nextElementSibling;
    }
    label.style.display = hasVisible ? '' : 'none';
  });

  document.getElementById('faq-no-results').style.display = anyVisible ? 'none' : 'block';
}

window.openHelpCenter  = openHelpCenter;
window.closeHelpCenter = closeHelpCenter;
window.toggleFAQ       = toggleFAQ;
window.filterFAQs      = filterFAQs;

// ── Bug report open/close/submit ─────────────────────────────────────────────
(function () {
  'use strict';

  let _bugFocusRelease = null;

  function openBugReport() {
    const overlay = document.getElementById('bug-modal');
    if (!overlay) return;
    // Reset form
    document.getElementById('bug-description').value = '';
    document.querySelectorAll('.bug-cat-btn').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
    });
    const submitBtn = document.getElementById('bug-submit-btn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send Report';

    overlay.classList.add('active');
    _bugFocusRelease = typeof trapFocus === 'function' ? trapFocus(overlay) : null;
    setTimeout(() => document.getElementById('bug-description')?.focus(), 80);
  }

  function closeBugReport() {
    document.getElementById('bug-modal')?.classList.remove('active');
    if (_bugFocusRelease) { _bugFocusRelease(); _bugFocusRelease = null; }
  }

  async function submitBugReport() {
    const desc = document.getElementById('bug-description').value.trim();
    if (!desc) {
      document.getElementById('bug-description').focus();
      document.getElementById('bug-description').style.borderColor = 'rgba(248,113,113,0.7)';
      setTimeout(() => { document.getElementById('bug-description').style.borderColor = ''; }, 1800);
      return;
    }
    const cat = document.querySelector('.bug-cat-btn.active')?.dataset.cat || 'Other';
    const user = document.querySelector('.pd-handle')?.textContent?.trim() || 'anonymous';
    const submitBtn = document.getElementById('bug-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    try {
      // Attempt to POST to backend; silently fall back to mailto if unavailable
      const _bugCtrl = new AbortController();
      const _bugTimer = setTimeout(() => _bugCtrl.abort(), 5000);
      let res;
      try {
        res = await fetch(`${typeof API_BASE !== 'undefined' ? API_BASE : ''}/api/bug-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: cat, description: desc, user }),
          signal: _bugCtrl.signal
        });
      } finally {
        clearTimeout(_bugTimer);
      }
      if (!res.ok) throw new Error('server error');
    } catch (_) {
      // Fallback: open mailto so the report still reaches the team
      const subject = encodeURIComponent(`[Bug] ${cat} — Chunks AI`);
      const body = encodeURIComponent(`User: ${user}\nCategory: ${cat}\n\n${desc}`);
      window.open(`mailto:support@chunks.ai?subject=${subject}&body=${body}`, '_blank');
    }

    closeBugReport();
    wsShowToast && wsShowToast('🐛', 'Bug report sent — thank you!', '');
  }

  // Close on overlay click
  document.getElementById('bug-modal')?.addEventListener('click', function (e) {
    if (e.target === this) closeBugReport();
  });

  // Category pill selection
  document.getElementById('bug-cat-row')?.addEventListener('click', function (e) {
    const btn = e.target.closest('.bug-cat-btn');
    if (!btn) return;
    this.querySelectorAll('.bug-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('bug-modal')?.classList.contains('active')) {
      closeBugReport();
    }
  });

  // Expose globally so pdAction can call them
  window.openBugReport  = openBugReport;
  window.closeBugReport = closeBugReport;
  window.submitBugReport = submitBugReport;
})();

// ── Event delegation ACTION_MAP ─────────────────────────────────────────────
// openUpgradeModal / closeUpgradeModal / handleUpgradeClick updated to window.*
// (defined in upgrade-modal inline script, not in this module)
(function () {
  'use strict';

  /* Registry: maps data-action values to handler functions.
     Each handler receives (element, event) as arguments.         */
  const ACTION_MAP = {
    /* ── Navigation ─────────────────────────────────────── */
    'goHome':                 ()      => goHome(),
    'newChat':                ()      => newChat(),
    'openLibraryModal':       ()      => openLibraryModal(),
    'closeLibraryModal':      ()      => closeLibraryModal(),
    'toggleProfileDropdown':  (el,ev) => toggleProfileDropdown(ev),
    'closeUpgradeModal':      ()      => window.closeUpgradeModal?.(),
    'closeShortcuts':         ()      => closeShortcuts(),
    'closeHelpCenter':        ()      => closeHelpCenter(),

    /* ── Sidebar / sidebar-self ─────────────────────────── */
    'toggleSidebar-self':     (el)    => toggleSidebar(el),
    'handleLogoClick-self':   (el)    => {
      // If sidebar is compact, expand it; otherwise go home
      const sidebar = el.closest('.sidebar');
      if (sidebar && sidebar.classList.contains('compact')) {
        toggleSidebar(el);
      } else {
        handleLogoClick(el);
      }
    },
    'toggleHistorySection-self': (el) => {
      const sectionId = el.dataset.section;
      // Toggle all instances of this section across all sidebars
      document.querySelectorAll('#' + sectionId).forEach(sec => {
        sec.classList.toggle('collapsed');
      });
      // Persist state
      const isCollapsed = document.getElementById(sectionId)?.classList.contains('collapsed');
      try { sessionStorage.setItem('hist_collapsed_' + sectionId, isCollapsed ? '1' : '0'); } catch(e) {}
    },

    /* ── showScreen ─────────────────────────────────────── */
    'showScreen':             (el)    => showScreen(el.dataset.screen),

    /* ── Workspace ──────────────────────────────────────── */
    'togglePdfOutline':       ()      => togglePdfOutline(),
    'wsJumpToPage':           ()      => wsJumpToPage(),
    'wsZoomOut':              ()      => wsZoomOut(),
    'wsZoomIn':               ()      => wsZoomIn(),
    'wsPrevPage':             ()      => wsPrevPage(),
    'wsNextPage':             ()      => wsNextPage(),
    'wsChatSend':             ()      => wsChatSend(),
    'wsClearChat':            ()      => wsClearChat(),
    'wsMobileView':           (el)    => wsMobileView(el.dataset.view),
    'wsMakeFlashcard-self':   (el)    => wsMakeFlashcard(el),
    '_exportPDF':             ()      => _exportPDF(),
    '_wsRegenerate':          ()      => _wsRegenerate(),
    'wsShowToast':            ()      => wsShowToast(),

    /* ── Home ───────────────────────────────────────────── */
    'homeSendMessage':        ()      => homeSendMessage(),
    'homeSetInput-text':      (el)    => homeSetInput(el.textContent),

    /* ── Flashcards ─────────────────────────────────────── */
    '_fcFlip':                ()      => _fcFlip(),
    '_fcGenerateFromBar':     ()      => _fcGenerateFromBar(),
    '_fcRestartDeck':         ()      => _fcRestartDeck(),
    '_fcStudyHardOnly':       ()      => _fcStudyHardOnly(),
    '_fcCreateNew':           ()      => _fcCreateNew(),
    '_fcExitStudy':           ()      => _fcExitStudy(),
    '_fcNext-self':           (el)    => _fcNext(el.dataset.rating),
    '_fcCloseCompleteModal':  ()      => _fcCloseCompleteModal(),
    '_vtSendInput':           ()      => window._vtSendInput(),
    '_vtBack':                ()      => window._vtBack(),
    '_vtClear':               ()      => window._vtClear(),
    '_vtAskPill-self':        (el)    => window._vtAsk(el.dataset.query),
    '_fcOpenThemePicker':     ()      => window._fcOpenThemePicker(),
    '_fcToggleSound':         ()      => {
      const muted = window._fcSound.toggle();
      const btn = document.getElementById('fc-sound-toggle');
      if (btn) {
        btn.querySelector('.fc-sound-on').style.display  = muted ? 'none' : '';
        btn.querySelector('.fc-sound-off').style.display = muted ? '' : 'none';
      }
    },

    /* ── Research ───────────────────────────────────────── */
    '_researchBackToSetup':   ()      => _researchBackToSetup(),
    '_confirmNewPaper':       ()      => _confirmNewPaper(),
    '_researchStart':         ()      => _researchStart(),
    '_runPaperSearch':        ()      => _runPaperSearch(),
    '_generateParagraph':     ()      => _generateParagraph(),
    '_copyAllRefs':           ()      => _copyAllRefs(),
    '_closeHistory':          ()      => _closeHistory(),
    '_clearAndReset':         ()      => _clearAndReset(),
    '_toggleTip':             ()      => _toggleTip(),
    '_copyCiteKey':           ()      => _copyCiteKey(),
    '_toggleSection-self':    (el)    => _toggleSection(el),

    /* ── Exam ───────────────────────────────────────────── */
    'examClearSource':        (el, ev) => examClearSource(ev),
    'examClearNotes':         ()      => examClearNotes(),
    'examStart':              ()      => examStart(),
    'examAbort':              ()      => examAbort(),
    'examSkip':               ()      => examSkip(),
    'examNext':               ()      => examNext(),
    'examRetry':              ()      => examRetry(),
    'examNewTopic':           ()      => examNewTopic(),
    'examSelectType-self':    (el)    => examSelectType(el),
    'examSelectScanMode-self':(el)    => examSelectScanMode(el),
    'examSelectDiff-self':    (el)    => examSelectDiff(el),

    /* ── Study Plan sidebar ─────────────────────────────── */
    'spNavigateToPlan-self':  (el, ev) => {
      // Ignore clicks that originate from the dots menu button
      if (ev.target.closest('.sp-plan-menu-btn')) return;
      const planId = el.dataset.planId;

      // Write the active plan ID to localStorage FIRST — this is the ground
      // truth read by _renderRecentPlansAllSidebars, so the highlight will be
      // correct no matter when the re-render fires (spInitScreen, spSwitchToPlan, etc.)
      if (planId) {
        try { localStorage.setItem('sp_active_plan_id', planId); } catch(_) {}
      }

      // Update in-memory state and DOM highlights immediately
      if (planId && typeof window.setActivePlan === 'function') window.setActivePlan(planId);

      // Mark as history navigation so showScreen restores the plan (not empty state)
      window._navFromHistory = true;
      if (typeof showScreen === 'function') showScreen('studyplan');

      if (planId) {
        setTimeout(() => {
          // spSwitchToPlan loads the plan, updates _spActivePlanId, calls setActivePlan
          if (typeof window.spSwitchToPlan === 'function') window.spSwitchToPlan(planId);
          // Re-render after switch — localStorage already has the correct planId
          // so every plan item gets the right isActive class
          if (typeof window._renderRecentPlansAllSidebars === 'function') {
            window._renderRecentPlansAllSidebars();
          }
        }, 120);
      } else {
        setTimeout(() => {
          if (typeof window.spInitScreen === 'function') window.spInitScreen();
        }, 120);
      }
    },
    'spPlanCtxMenu-self': (el, ev) => {
      ev.stopPropagation();
      const planId = el.dataset.planId;
      const topic  = el.dataset.planTopic;

      // Close any existing context menu
      const existing = document.getElementById('sp-plan-ctx-menu');
      if (existing) existing.remove();

      const menu = document.createElement('div');
      menu.id = 'sp-plan-ctx-menu';
      menu.className = 'recent-ctx-menu';
      menu.innerHTML = `
        <div class="recent-ctx-item" data-sp-action="rename">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Rename
        </div>
        <div class="recent-ctx-divider"></div>
        <div class="recent-ctx-item danger" data-sp-action="delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Delete
        </div>`;
      document.body.appendChild(menu);

      // Position next to the dots button
      const rect = el.getBoundingClientRect();
      let top  = rect.top;
      let left = rect.right + 8;
      if (left + 180 > window.innerWidth)  left = rect.left - 188;
      if (top + 130  > window.innerHeight) top  = window.innerHeight - 140;
      menu.style.top  = top  + 'px';
      menu.style.left = left + 'px';

      const closeMenu = () => { menu.remove(); };

      menu.addEventListener('click', e => {
        const action = e.target.closest('[data-sp-action]')?.dataset.spAction;
        if (!action) return;
        closeMenu();

        if (action === 'delete') {
          showConfirmModal({
            title: 'Delete this plan?',
            desc: `"${topic}" will be permanently removed.`,
            confirmLabel: 'Delete plan',
            onConfirm: () => {
              // Remove from sp_recent_plans list
              try {
                let plans = JSON.parse(localStorage.getItem('sp_recent_plans') || '[]');
                plans = plans.filter(p => p !== topic);
                localStorage.setItem('sp_recent_plans', JSON.stringify(plans));
              } catch(_) {}
              // Remove from sp_all_plans and call spDeletePlan if loaded
              if (planId && typeof window.spDeletePlan === 'function') {
                window.spDeletePlan(planId);
              } else {
                try {
                  const all = JSON.parse(localStorage.getItem('sp_all_plans') || '{}');
                  delete all[planId];
                  localStorage.setItem('sp_all_plans', JSON.stringify(all));
                } catch(_) {}
              }
              if (typeof window._renderRecentPlansAllSidebars === 'function') {
                window._renderRecentPlansAllSidebars();
              }
              if (typeof wsShowToast === 'function') wsShowToast('🗑️', `"${topic}" deleted`, '');
            }
          });

        } else if (action === 'rename') {
          const newName = prompt('Rename plan:', topic);
          if (newName && newName.trim()) {
            const trimmed = newName.trim().slice(0, 60);
            // Update sp_recent_plans
            try {
              let plans = JSON.parse(localStorage.getItem('sp_recent_plans') || '[]');
              const idx = plans.indexOf(topic);
              if (idx >= 0) plans[idx] = trimmed;
              localStorage.setItem('sp_recent_plans', JSON.stringify(plans));
            } catch(_) {}
            // Update sp_all_plans entry topic
            try {
              const all = JSON.parse(localStorage.getItem('sp_all_plans') || '{}');
              if (planId && all[planId]) {
                all[planId].topic = trimmed;
                if (all[planId].plan) all[planId].plan.topic = trimmed;
                localStorage.setItem('sp_all_plans', JSON.stringify(all));
              }
            } catch(_) {}
            if (typeof window._renderRecentPlansAllSidebars === 'function') {
              window._renderRecentPlansAllSidebars();
            }
            if (typeof wsShowToast === 'function') wsShowToast('✏️', `Renamed to "${trimmed}"`, '');
          }
        }
      });

      setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
    },
    'toggleRecentPlans-self': (el) => {
      const sectionId = el.dataset.section;
      document.querySelectorAll('#' + sectionId).forEach(sec => {
        sec.classList.toggle('collapsed');
      });
      const isCollapsed = document.getElementById(sectionId)?.classList.contains('collapsed');
      try { sessionStorage.setItem('sp_plans_collapsed_' + sectionId, isCollapsed ? '1' : '0'); } catch(e) {}
    },

    /* ── Study Plan ─────────────────────────────────────── */
    'spDrawerTab':            (el)    => spDrawerTab(el.dataset.tab),
    'spCloseExplainDrawer':   ()      => spCloseExplainDrawer(),
    'spHandleGenerate':       ()      => spHandleGenerate(),
    'spFcGenerate':           ()      => spFcGenerate(),
    'spFcFlip':               ()      => spFcFlip(),
    'spFcRestart':            ()      => spFcRestart(),
    'spPqSubmit':             ()      => spPqSubmit(),
    'spPqNext':               ()      => spPqNext(),
    'spPqRestart':            ()      => spPqRestart(),
    'spExamStart':            ()      => spExamStart(),
    'spExamRestart':          ()      => spExamRestart(),
    'spShowEmpty':            ()      => spShowEmpty(),
    'spShowPlan':             ()      => spShowPlan(),
    'spShowPlansMenu':        ()      => spShowPlansMenu(),
    'spClearUpload':          ()      => spClearUpload(),
    'spOpenExplainDrawer':    ()      => spOpenExplainDrawer(),
    'spExamGenerate':         ()      => spExamGenerate(),
    'spPqGenerate':           ()      => spPqGenerate(),

    /* ── Settings ───────────────────────────────────────── */
    'settingsSelect-self':         (el) => settingsSelect(el),
    'settingsDropdown-self':       (el) => settingsDropdown(el),
    'settingsSelectDefaultBook-self': (el) => settingsSelectDefaultBook(el),
    'settingsSelectVoice-self':    (el) => settingsSelectVoice(el),
    'settingsSelectStudyMode-self':(el) => settingsSelectStudyMode(el),
    'settingsPlayVoice':           ()   => settingsPlayVoice(),
    'closeSettings':               ()   => closeSettings(),

    /* ── FAQ / accordion ─────────────────────────────────── */
    'toggleFAQ-self':         (el)    => toggleFAQ(el),

    /* ── History / misc ─────────────────────────────────── */
    'clearAllHistory':        ()      => clearAllHistory(),
    'clearPdfCache':          ()      => clearPdfCache(),

    /* ── Upgrade modal (Task 34) ─────────────────────────── */
    'closeUpgradeModal-backdrop': (el, ev) => { if (ev.target === el) window.closeUpgradeModal?.(); },
    'handleUpgradeClick':     (el)    => window.handleUpgradeClick?.(el.dataset.plan),

    /* ── Bug report (Task 34) ────────────────────────────── */
    'closeBugReport':         ()      => closeBugReport(),
    'submitBugReport':        ()      => submitBugReport(),

    /* ── Incognito chat ──────────────────────────────────── */
    'openIncognitoChat':      ()      => window.openIncognitoChat?.(),
    'closeIncognitoChat':     ()      => window.closeIncognitoChat?.(),

    /* ── Help centre (Task 34) ───────────────────────────── */
    'contactSupport':         ()      => { if (typeof wsShowToast === 'function') wsShowToast('📬', 'Support email: help@chunksai.com', ''); },
    'filterFAQs-input':       (el)    => { if (typeof filterFAQs === 'function') filterFAQs(el.value); },

    /* ── Mobile drawer (Task 34) ─────────────────────────── */
    'closeMobileDrawer':      ()      => closeMobileDrawer(),
    'drawerNav':              (el)    => drawerNav(el.dataset.screen),
    'drawerUpgrade':          ()      => { closeMobileDrawer(); window.openUpgradeModal?.(); },

    /* ── Mobile bottom nav (Task 34) ─────────────────────── */
    'mobileNav-self':         (el)    => mobileNav(el.dataset.screen, el),
  };

  /* Single delegated listener on the document */
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    // Guest mode: allow navigation and toggle buttons; block everything else in sidebar
    if (_isGuestMode() && el.closest('.sidebar')) {
      const _SIDEBAR_ALWAYS_ALLOWED = ['toggleSidebar-self', 'handleLogoClick-self', 'showScreen', 'drawerNav', 'goHome'];
      if (!_SIDEBAR_ALWAYS_ALLOWED.includes(action)) return;
    }

    const handler = ACTION_MAP[action];
    if (typeof handler === 'function') {
      e.stopPropagation();
      handler(el, e);
    }
  }, false);

  /* Input delegation for data-action elements that need oninput (Task 34) */
  document.addEventListener('input', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'filterFAQs-input') {
      const handler = ACTION_MAP[action];
      if (typeof handler === 'function') handler(el, e);
    }
  }, false);

  // Submenu hover listeners → src/components/ProfileDropdown.js (Task 22)

})();

// ── Health reminder system ───────────────────────────────────────────────────
(function () {
  /* ── Reminder bank ─────────────────────────────────────────── */
  const REMINDERS = [
    {
      icon: '💧', label: 'Hydration Check',
      title: 'Time to hydrate!',
      body: "You've been studying hard. Drink a full glass of water — your brain is 73% water and even mild dehydration slows focus and memory.",
      action: "I'm drinking it now 💙",
      color: 'var(--teal)',
      colorMuted: 'rgba(45,212,191,0.10)',
      colorBorder: 'rgba(45,212,191,0.28)',
      stripe: 'linear-gradient(90deg,transparent,var(--teal),transparent)'
    },
    {
      icon: '👁️', label: '20-20-20 Rule',
      title: 'Give your eyes a break',
      body: "Look at something 20 feet away for 20 seconds. This resets your eye muscles and reduces digital eye strain significantly.",
      action: "Done, eyes feel better!",
      color: 'var(--violet)',
      colorMuted: 'rgba(139,124,248,0.10)',
      colorBorder: 'rgba(139,124,248,0.28)',
      stripe: 'linear-gradient(90deg,transparent,var(--violet),transparent)'
    },
    {
      icon: '🧘', label: 'Posture Check',
      title: 'Sit up straight!',
      body: "Roll your shoulders back, unclench your jaw, and plant both feet on the floor. Good posture increases oxygen to the brain by up to 30%.",
      action: "Fixed — spine is happy!",
      color: 'var(--gold)',
      colorMuted: 'rgba(232,172,46,0.10)',
      colorBorder: 'rgba(232,172,46,0.28)',
      stripe: 'linear-gradient(90deg,transparent,var(--gold),transparent)'
    },
    {
      icon: '🌬️', label: 'Breathing Break',
      title: 'Box breathing time',
      body: "Inhale 4s → hold 4s → exhale 4s → hold 4s. Just two cycles. This calms your nervous system and sharpens focus instantly.",
      action: "Breathed, refreshed 🌿",
      color: 'var(--teal)',
      colorMuted: 'rgba(45,212,191,0.10)',
      colorBorder: 'rgba(45,212,191,0.28)',
      stripe: 'linear-gradient(90deg,transparent,var(--teal),transparent)'
    },
    {
      icon: '🤸', label: 'Movement Break',
      title: 'Stand up & stretch!',
      body: "Stand, reach overhead, roll your neck gently, do 10 shoulder circles. Sitting long hours cuts circulation — a quick stretch fixes it.",
      action: "Stretched, feeling good!",
      color: 'var(--violet)',
      colorMuted: 'rgba(139,124,248,0.10)',
      colorBorder: 'rgba(139,124,248,0.28)',
      stripe: 'linear-gradient(90deg,transparent,var(--violet),transparent)'
    },
    {
      icon: '🍎', label: 'Brain Fuel',
      title: 'Time for a light snack?',
      body: "If it's been 3+ hours, grab nuts, fruit, or whole grains. Your brain consumes 20% of your body's glucose — keep it fueled!",
      action: "Grabbing a snack now",
      color: 'var(--gold)',
      colorMuted: 'rgba(232,172,46,0.10)',
      colorBorder: 'rgba(232,172,46,0.28)',
      stripe: 'linear-gradient(90deg,transparent,var(--gold),transparent)'
    },
    {
      icon: '🛌', label: 'Rest Check',
      title: 'Long session alert!',
      body: "After 90 minutes of focused study, your hippocampus needs a break to consolidate what you learned. A 10-min rest doubles retention.",
      action: "Taking a proper break",
      color: 'var(--violet)',
      colorMuted: 'rgba(139,124,248,0.10)',
      colorBorder: 'rgba(139,124,248,0.28)',
      stripe: 'linear-gradient(90deg,transparent,var(--violet),transparent)'
    },
    {
      icon: '🌡️', label: 'Environment Check',
      title: 'How\'s your study space?',
      body: "Ideal study temp is 20–22°C (68–72°F). A too-warm room causes drowsiness; too cold pulls focus. Adjust your environment!",
      action: "All good here ✓",
      color: 'var(--teal)',
      colorMuted: 'rgba(45,212,191,0.10)',
      colorBorder: 'rgba(45,212,191,0.28)',
      stripe: 'linear-gradient(90deg,transparent,var(--teal),transparent)'
    },
    {
      icon: '☀️', label: 'Light Check',
      title: 'Is your lighting okay?',
      body: "Study in a well-lit room to avoid eye strain. Position your light source to the side — never directly behind your screen.",
      action: "Adjusted my light!",
      color: 'var(--gold)',
      colorMuted: 'rgba(232,172,46,0.10)',
      colorBorder: 'rgba(232,172,46,0.28)',
      stripe: 'linear-gradient(90deg,transparent,var(--gold),transparent)'
    },
    {
      icon: '🙌', label: 'You\'re Doing Great',
      title: 'Keep going, you\'ve got this!',
      body: "Every page you study today is a step toward your goal. Celebrate the small wins — consistency beats intensity every time.",
      action: "Thanks, back to it! 💪",
      color: 'var(--gold)',
      colorMuted: 'rgba(232,172,46,0.10)',
      colorBorder: 'rgba(232,172,46,0.28)',
      stripe: 'linear-gradient(90deg,transparent,var(--gold),transparent)'
    },
  ];

  /* ── State ─────────────────────────────────────────────────── */
  let _lastIdx      = -1;
  let _schedTimer   = null;
  let _autoClose    = null;
  let _countdownInt = null;

  /* ─── Interval: 1 min for testing, change to 30 * 60 * 1000 for production ── */
  const INTERVAL_MS   = 30 * 60 * 1000;
  const AUTO_CLOSE_MS = 15 * 1000;

  /* ── Pick non-repeating reminder ───────────────────────────── */
  function _pick() {
    let idx;
    do { idx = Math.floor(Math.random() * REMINDERS.length); }
    while (idx === _lastIdx && REMINDERS.length > 1);
    _lastIdx = idx;
    return REMINDERS[idx];
  }

  /* ── DOM refs ──────────────────────────────────────────────── */
  const $overlay    = () => document.getElementById('health-reminder-overlay');
  const $popup      = () => document.getElementById('health-reminder-popup');
  const $stripe     = () => document.getElementById('hr-stripe');
  const $icon       = () => document.getElementById('hr-icon');
  const $label      = () => document.getElementById('hr-label');
  const $title      = () => document.getElementById('hr-title');
  const $body       = () => document.getElementById('hr-body');
  const $action     = () => document.getElementById('hr-action');
  const $bar        = () => document.getElementById('hr-timer-bar');
  const $countdown  = () => document.getElementById('hr-countdown');

  /* ── Show ──────────────────────────────────────────────────── */
  function _show() {
    const r = _pick();

    $icon().textContent   = r.icon;
    $label().textContent  = r.label;
    $title().textContent  = r.title;
    $body().textContent   = r.body;
    $action().textContent = r.action;
    $stripe().style.background  = r.stripe;
    $action().style.background  = r.colorMuted;
    $action().style.borderColor = r.colorBorder;
    $action().style.color       = r.color;

    /* Animate in */
    $overlay().style.opacity       = '1';
    $overlay().style.pointerEvents = 'auto';
    $popup().style.opacity         = '1';
    $popup().style.pointerEvents   = 'auto';
    $popup().style.transform       = 'translate(-50%,-50%) scale(1)';

    /* Timer bar animation */
    const bar = $bar();
    bar.style.transition = 'none';
    bar.style.transform  = 'scaleX(1)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.transition = `transform ${AUTO_CLOSE_MS}ms linear`;
        bar.style.transform  = 'scaleX(0)';
      });
    });

    /* Countdown */
    let secs = Math.round(AUTO_CLOSE_MS / 1000);
    $countdown().textContent = secs;
    clearInterval(_countdownInt);
    _countdownInt = setInterval(() => {
      secs--;
      const el = $countdown();
      if (el) el.textContent = secs;
      if (secs <= 0) clearInterval(_countdownInt);
    }, 1000);

    /* Auto-close */
    clearTimeout(_autoClose);
    _autoClose = setTimeout(_hide, AUTO_CLOSE_MS);
  }

  /* ── Hide ──────────────────────────────────────────────────── */
  function _hide() {
    clearTimeout(_autoClose);
    clearInterval(_countdownInt);
    $overlay().style.opacity       = '0';
    $overlay().style.pointerEvents = 'none';
    $popup().style.opacity         = '0';
    $popup().style.pointerEvents   = 'none';
    $popup().style.transform       = 'translate(-50%,-48%) scale(0.96)';
    _schedule();
  }

  /* ── Schedule next ─────────────────────────────────────────── */
  function _schedule() {
    clearTimeout(_schedTimer);
    _schedTimer = setTimeout(_show, INTERVAL_MS);
  }

  /* ── Init ──────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('hr-dismiss').addEventListener('click', _hide);
    document.getElementById('hr-action').addEventListener('click', _hide);
    document.getElementById('health-reminder-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) _hide();
    });

    /* Hover states for dismiss button */
    const dismiss = document.getElementById('hr-dismiss');
    dismiss.addEventListener('mouseover', () => { dismiss.style.background = 'var(--surface-3)'; dismiss.style.color = 'var(--text-2)'; });
    dismiss.addEventListener('mouseout',  () => { dismiss.style.background = 'var(--surface-4)'; dismiss.style.color = 'var(--text-3)'; });

    /* Hover for action button */
    const action = document.getElementById('hr-action');
    action.addEventListener('mouseover', () => { action.style.filter = 'brightness(1.18)'; });
    action.addEventListener('mouseout',  () => { action.style.filter = ''; });

    _schedule();
  });
})();

// ── Auth modal logic ──────────────────────────────────────────────────────────
(function() {
  var SUPABASE_URL  = '';
  var GOOGLE_OAUTH  = '';

  // Fetch Supabase config from backend (credentials never hardcoded client-side)
  fetch('https://api.chunks.online/api/config')
    .then(function(r) { return r.json(); })
    .then(function(cfg) {
      if (cfg && cfg.supabaseUrl) {
        SUPABASE_URL = cfg.supabaseUrl;
        GOOGLE_OAUTH = SUPABASE_URL + '/auth/v1/authorize?provider=google&redirect_to=https://chunks.online/home';
      }
    }).catch(function(e) { console.warn('[auth-modal] Config fetch failed:', e.message); });

  var overlay       = document.getElementById('auth-modal-overlay');
  var content       = document.getElementById('am-content');
  var loading       = document.getElementById('am-loading');
  var _authPopup    = null;
  var _pollTimer    = null;
  var _isGuest      = sessionStorage.getItem('chunks_guest_mode') === '1';

  // Show guest button + divider only when in guest mode
  if (_isGuest) {
    var guestDiv = document.getElementById('am-guest-divider');
    var guestBtn = document.getElementById('am-btn-guest');
    if (guestDiv) guestDiv.style.display = '';
    if (guestBtn) guestBtn.style.display = '';
  }

  // ── Open modal ─────────────────────────────────────────────────────────────
  function openAuthModal() {
    content.style.display = '';
    loading.style.display = 'none';
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  window.openAuthModal = openAuthModal;

  // ── Close modal ────────────────────────────────────────────────────────────
  function closeAuthModal() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    if (_authPopup && !_authPopup.closed) _authPopup.close();
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }
  window.closeAuthModal = closeAuthModal;

  // ── Successful auth handler (shared by popup poll + postMessage) ───────────
  function _onAuthSuccess() {
    try { sessionStorage.removeItem('chunks_guest_mode'); } catch(_) {}
    closeAuthModal();
    window.location.reload();
  }

  // ── Google sign-in popup ───────────────────────────────────────────────────
  function startGoogleAuth() {
    if (!GOOGLE_OAUTH) {
      // Config not loaded yet — show loading briefly then retry
      content.style.display = 'none';
      loading.style.display = 'flex';
      setTimeout(function() {
        content.style.display = '';
        loading.style.display = 'none';
      }, 1500);
      return;
    }

    // Show loading state
    content.style.display = 'none';
    loading.style.display = 'flex';

    // Open OAuth popup
    var w = 480, h = 560;
    var left = Math.max(0, (screen.width  - w) / 2);
    var top  = Math.max(0, (screen.height - h) / 2);
    _authPopup = window.open(
      GOOGLE_OAUTH,
      'chunks_auth_popup',
      'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top +
      ',toolbar=no,menubar=no,scrollbars=yes,resizable=yes'
    );

    if (!_authPopup || _authPopup.closed) {
      // Popup blocked — fall back to direct OAuth redirect (returns to /ChunksAI)
      window.location.href = GOOGLE_OAUTH;
      return;
    }

    // Poll for popup close (fallback if postMessage fails)
    _pollTimer = setInterval(function() {
      if (_authPopup && _authPopup.closed) {
        clearInterval(_pollTimer); _pollTimer = null;
        // Popup closed — check if auth succeeded by refreshing session
        _checkAuthAfterPopup();
      }
    }, 400);
  }

  // ── Check session after popup closes ──────────────────────────────────────
  function _checkAuthAfterPopup() {
    // Give Supabase a moment to write the session to localStorage
    setTimeout(function() {
      try {
        var raw = localStorage.getItem('chunks-ai-auth');
        if (raw) {
          var parsed = JSON.parse(raw);
          var session = parsed.access_token ? parsed : (parsed.currentSession || null);
          if (session && session.access_token) {
            _onAuthSuccess();
            return;
          }
        }
      } catch(e) {}
      // No session found — go back to login form
      content.style.display = '';
      loading.style.display = 'none';
    }, 300);
  }

  // ── Listen for postMessage from login popup ────────────────────────────────
  window.addEventListener('message', function(e) {
    if (e.origin !== 'https://chunks.online') return;
    if (e.data === 'chunks_auth_success') {
      if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
      if (_authPopup && !_authPopup.closed) { try { _authPopup.close(); } catch(_) {} }
      _onAuthSuccess();
    }
  });

  // ── Continue as guest — just close the modal ──────────────────────────────
  document.getElementById('am-btn-guest')?.addEventListener('click', function() {
    closeAuthModal();
  });

  // ── Google button ──────────────────────────────────────────────────────────
  document.getElementById('am-btn-google').addEventListener('click', startGoogleAuth);

  // ── Close button + backdrop ────────────────────────────────────────────────
  document.getElementById('am-close-btn').addEventListener('click', closeAuthModal);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeAuthModal();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.style.display !== 'none') closeAuthModal();
  });
})();

