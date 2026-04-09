// @ts-nocheck
/**
 * src/state/workspace/nodocWelcome.js
 *
 * Returns the HTML for the no-document welcome state shown in ws-messages
 * when no book/user-doc is loaded. Kept in a standalone module to avoid
 * circular imports between books.js and chat.js (both need it).
 */

export function _wsNodocWelcomeHtml() {
  return `<div id="ws-welcome-state" style="display:flex;flex-direction:column;height:100%;overflow-y:auto;padding:20px 16px;">
        <div class="ws-nodoc-hero">
          <div class="ws-nodoc-hero-eyebrow">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="13" height="13">
              <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/>
              <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/>
              <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/>
              <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
            </svg>
            AI Study Assistant
          </div>
          <h1>Study smarter,<br>not <em>harder</em></h1>
          <p>Ask questions, explore your textbooks, and generate study tools — all in one place.</p>
        </div>
        <div style="font-family:var(--font-head);font-size:14px;font-weight:700;color:var(--text-1);margin-bottom:14px;">Quick Actions</div>
        <div class="ws-quick-actions-grid">
          <div class="ws-quick-action-card" data-action="wsClearChat" role="button" tabindex="0" aria-label="New Chat">
            <div class="ws-qa-icon" style="background:rgba(139,124,248,0.12);color:#8b7cf8;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <span class="ws-qa-label">New Chat</span>
          </div>
          <div class="ws-quick-action-card" data-action="showScreen" data-screen="flash" role="button" tabindex="0" aria-label="Flashcards">
            <div class="ws-qa-icon" style="background:rgba(232,172,46,0.12);color:var(--gold);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
            </div>
            <span class="ws-qa-label">Flashcards</span>
          </div>
          <div class="ws-quick-action-card" data-action="showScreen" data-screen="exam" role="button" tabindex="0" aria-label="New Exam">
            <div class="ws-qa-icon" style="background:rgba(139,92,246,0.12);color:#a78bfa;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <span class="ws-qa-label">New Exam</span>
          </div>
          <div class="ws-quick-action-card" data-action="showScreen" data-screen="studyplan" role="button" tabindex="0" aria-label="Study Plan">
            <div class="ws-qa-icon" style="background:rgba(16,185,129,0.12);color:#34d399;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <span class="ws-qa-label">Study Plan</span>
          </div>
          <div class="ws-quick-action-card" data-action="showScreen" data-screen="research" role="button" tabindex="0" aria-label="Research">
            <div class="ws-qa-icon" style="background:rgba(59,130,246,0.12);color:#60a5fa;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 12h6m-3-3v6"/><path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/><path d="M21 7H3l1.5 11A2 2 0 0 0 6.48 20h11.04a2 2 0 0 0 1.98-2L21 7z"/></svg>
            </div>
            <span class="ws-qa-label">Research</span>
          </div>
          <div class="ws-quick-action-card" data-action="openLibraryModal" role="button" tabindex="0" aria-label="Browse Library">
            <div class="ws-qa-icon" style="background:rgba(232,172,46,0.08);color:var(--gold);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            </div>
            <span class="ws-qa-label">Browse Library</span>
          </div>
        </div>
        <div id="ws-no-book-prompts" style="margin-top:14px;">
          <div style="font-family:var(--font-head);font-size:12.5px;font-weight:600;color:var(--text-3);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;">Try asking</div>
          <div style="display:flex;flex-direction:column;gap:5px;">
            <button class="ws-prompt-chip" onclick="wsSetInput('Explain electrochemistry simply')">Explain electrochemistry simply</button>
            <button class="ws-prompt-chip" onclick="wsSetInput('Create a study plan')">Create a study plan</button>
            <button class="ws-prompt-chip" onclick="wsSetInput('Quiz me on this topic')">Quiz me on this topic</button>
            <button class="ws-prompt-chip" onclick="wsSetInput('What are the key concepts in this topic?')">What are the key concepts in this topic?</button>
          </div>
        </div>
      </div>`;
}
