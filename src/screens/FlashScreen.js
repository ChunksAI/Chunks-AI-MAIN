/**
 * src/screens/FlashScreen.js — Task 27
 *
 * Owns:
 *   • #screen-flash HTML injection  (replaces data-flash-screen placeholder)
 *   • #fc-complete-modal injection   (replaces data-fc-complete-modal placeholder)
 *
 * Views inside #screen-flash:
 *   fc-home     — setup bar + saved deck grid (landing)
 *   fc-study    — active card study session
 *
 * All state logic (_fcGenerateFromBar, _fcNext, _fcRenderCard, etc.)
 * lives in src/state/flashState.js (Task 17).
 */

const FLASH_HTML = `
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
              <div class="fc-streak-fire" id="fc-streak-fire">🔥</div>
              <div class="fc-streak-count" id="fc-streak-count">0</div>
              <div class="fc-streak-label">day streak</div>
              <div class="fc-streak-status" id="fc-streak-status"></div>
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
            <span id="fc-deck-name-label" style="font-size:11px;color:var(--text-4);font-family:var(--font-mono);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
            <button id="fc-sound-toggle" onclick="
              const muted = window._fcSound.toggle();
              this.title = muted ? 'Unmute sounds' : 'Mute sounds';
              this.querySelector('.fc-sound-on').style.display  = muted ? 'none' : '';
              this.querySelector('.fc-sound-off').style.display = muted ? '' : 'none';
            " title="Mute sounds" style="background:none;border:none;cursor:pointer;color:var(--text-4);padding:2px 4px;border-radius:4px;display:flex;align-items:center;transition:color 0.15s;" onmouseenter="this.style.color='var(--text-2)'" onmouseleave="this.style.color='var(--text-4)'">
              <span class="fc-sound-on">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              </span>
              <span class="fc-sound-off" style="display:none;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              </span>
            </button>
          </div>
        </div>

        <div class="fc-card-area">
          <div class="fc-card-scene" id="fc-card-scene">
            <div class="fc-card" id="fc-card" data-action="_fcFlip">
              <div class="fc-card-face fc-card-front">
                <div class="fc-card-face-label">Question</div>
                <div class="fc-card-text" id="fc-card-question"></div>
                <div class="fc-card-flip-hint">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                  Tap to flip
                </div>
              </div>
              <div class="fc-card-face fc-card-back">
                <div class="fc-card-face-label">Answer</div>
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

          <!-- AI Tutor explanation panel — appears after rating Hard -->
          <div id="fc-tutor-panel" class="fc-tutor-panel" style="display:none;">
            <div class="fc-tutor-header">
              <div class="fc-tutor-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                AI Tutor
              </div>
              <button class="fc-tutor-close" onclick="window._fcDismissTutor()" title="Got it, next card">
                Next card
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
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
`;

const FC_COMPLETE_HTML = `
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
`;

export function mountFlashScreen() {
  const sp = document.querySelector('[data-flash-screen]');
  if (sp) sp.outerHTML = FLASH_HTML;
  else console.warn('[FlashScreen] [data-flash-screen] not found');

  const mp = document.querySelector('[data-fc-complete-modal]');
  if (mp) mp.outerHTML = FC_COMPLETE_HTML;
  else console.warn('[FlashScreen] [data-fc-complete-modal] not found');
}

mountFlashScreen();
console.log('[FlashScreen] module loaded ✦');
