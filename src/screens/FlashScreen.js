/**
 * src/screens/FlashScreen.js — Task 27
 *
 * Owns:
 *   • #screen-flash HTML injection (replaces data-flash-screen placeholder)
 *   • #fc-complete-modal HTML injection (replaces data-fc-complete-modal placeholder)
 *
 * All flashcard logic (flipCard, _fcNext, _fcRenderCard, _fcGenerateFromBar,
 * _fcRestartDeck, _fcCreateNew, _fcShowCompleteModal, etc.) lives in:
 *   src/state/flashState.js  (Task 17)
 *   src/state/navigation.js  (Task 15) — flipCard, keyboard shortcuts
 */

// ── HTML templates ────────────────────────────────────────────────────────────

const FLASH_HTML = /* html */`
<div class="screen" id="screen-flash" style="flex-direction:row;overflow:hidden;">

  <!-- Mobile topbar (hidden on desktop) -->
  <div class="mobile-screen-topbar" style="display:none;">
    <button type="button" class="mst-back" data-action="goHome" aria-label="Back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <span class="mst-title">Flashcards</span>
    <span class="mst-badge violet" id="flash-mobile-count">0 / 0</span>
  </div>

  <!-- Sidebar -->
  <aside class="sidebar" data-sidebar-screen="flash"></aside>

  <!-- Main flashcard content -->
  <div class="flash-main">

    <div class="flash-header">
      <div class="flash-breadcrumb">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
        Flashcards
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        <span id="flash-deck-title">No deck loaded</span>
      </div>
      <div class="flash-progress">
        <span class="flash-count" id="flash-count-label">0 / 0</span>
        <div class="progress-track">
          <div class="progress-fill" id="flash-progress-fill" style="width:0%"></div>
        </div>
      </div>
    </div>

    <div class="gen-bar">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--text-3);flex-shrink:0;"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83"/></svg>
      <input class="gen-input" id="fc-gen-input" type="text" placeholder="Generate cards from a topic e.g. Entropy, Gibbs free energy…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_fcGenerateFromBar();}">
      <button class="gen-btn" id="gen-btn" data-action="_fcGenerateFromBar">Generate with AI</button>
    </div>

    <!-- Flashcard with 3D flip -->
    <div class="flash-scene">
      <div class="flash-card-wrap" id="flashCard" data-action="flipCard" tabindex="0" role="button" aria-label="Flashcard. Click to flip.">

        <!-- Front: Question -->
        <div class="flash-face" id="flash-face-front">
          <span class="flash-tag" id="flash-tag-front">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <span id="flash-tag-text">Question</span>
          </span>
          <p class="flash-q" id="flash-question">Generate or select a deck from the sidebar to start studying.</p>
          <div class="flash-source" id="flash-source-front" style="opacity:0;"></div>
        </div>

        <!-- Back: Answer -->
        <div class="flash-face flash-face-back" id="flash-face-back">
          <span class="flash-tag" style="color:var(--gold);background:var(--gold-muted);border-color:var(--gold-border);">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            Answer
          </span>
          <div class="flash-a" id="flash-answer">—</div>
          <div class="flash-source" id="flash-source-back" style="opacity:0;"></div>
        </div>
      </div>
    </div>

    <p class="flash-hint" id="flipHint">Click the card or press Space to reveal the answer</p>

    <div class="flash-controls">
      <button class="flash-btn hard" data-action="_fcNext-self" data-rating="hard">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        Hard
      </button>
      <button class="flash-btn ok" data-action="_fcNext-self" data-rating="ok">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
        Got it
      </button>
      <button class="flash-btn easy" data-action="_fcNext-self" data-rating="easy">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
        Easy
      </button>
      <div style="width:1px;height:22px;background:var(--border-xs);"></div>
      <button class="flash-btn primary" data-action="flipCard">
        Reveal Answer
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>

    <div class="flash-stats">
      <div class="stat"><div class="stat-num" id="stat-easy" style="color:var(--green)">0</div><div class="stat-label">Easy</div></div>
      <div class="stat"><div class="stat-num" id="stat-ok" style="color:var(--gold)">0</div><div class="stat-label">Got it</div></div>
      <div class="stat"><div class="stat-num" id="stat-hard" style="color:var(--red)">0</div><div class="stat-label">Hard</div></div>
      <div class="stat"><div class="stat-num" id="stat-skipped" style="color:var(--text-3)">0</div><div class="stat-label">Skipped</div></div>
    </div>

  </div><!-- /.flash-main -->

</div><!-- /#screen-flash -->
`;

const FC_COMPLETE_MODAL_HTML = /* html */`
<div id="fc-complete-modal" style="
  display:none;position:fixed;inset:0;z-index:9000;
  background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);will-change:transform;
  align-items:center;justify-content:center;
">
  <div style="
    background:var(--surface-1);border:1px solid var(--border-md);
    border-radius:18px;padding:36px 40px;max-width:420px;width:90%;
    box-shadow:0 24px 80px rgba(0,0,0,0.7);text-align:center;
    animation:fadeUp 0.3s var(--ease-spring);
  ">
    <div style="font-size:40px;margin-bottom:12px;">🎉</div>
    <div style="font-size:20px;font-weight:700;color:var(--text-1);margin-bottom:6px;">Deck Complete!</div>
    <div style="font-size:13px;color:var(--text-2);margin-bottom:24px;" id="fc-complete-subtitle">You've gone through all cards.</div>

    <!-- Stats summary -->
    <div style="display:flex;justify-content:center;gap:24px;margin-bottom:28px;padding:16px;background:var(--surface-2);border-radius:12px;border:1px solid var(--border-xs);">
      <div style="text-align:center;">
        <div style="font-size:22px;font-weight:700;color:var(--green);" id="fc-modal-easy">0</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:2px;">Easy</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:22px;font-weight:700;color:var(--gold);" id="fc-modal-ok">0</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:2px;">Got it</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:22px;font-weight:700;color:var(--red);" id="fc-modal-hard">0</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:2px;">Hard</div>
      </div>
    </div>

    <!-- Action buttons -->
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button data-action="_fcRestartDeck" style="
        width:100%;padding:12px;border-radius:10px;border:none;
        background:var(--gold);color:#000;font-weight:700;font-size:14px;
        cursor:pointer;font-family:inherit;
      ">↺  Restart This Deck</button>
      <button data-action="_fcCreateNew" style="
        width:100%;padding:12px;border-radius:10px;
        border:1px solid var(--border-md);background:var(--surface-2);
        color:var(--text-1);font-weight:600;font-size:14px;
        cursor:pointer;font-family:inherit;
      ">+ Generate New Deck</button>
      <button data-action="_fcCloseCompleteModal" style="
        width:100%;padding:10px;border-radius:10px;border:none;
        background:transparent;color:var(--text-3);font-size:13px;
        cursor:pointer;font-family:inherit;
      ">Close</button>
    </div>
  </div>
</div>
`;

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mountFlashScreen() {
  const screenPlaceholder = document.querySelector('[data-flash-screen]');
  if (!screenPlaceholder) {
    console.warn('[FlashScreen] placeholder [data-flash-screen] not found');
    return;
  }
  screenPlaceholder.outerHTML = FLASH_HTML;

  const modalPlaceholder = document.querySelector('[data-fc-complete-modal]');
  if (!modalPlaceholder) {
    console.warn('[FlashScreen] placeholder [data-fc-complete-modal] not found');
    return;
  }
  modalPlaceholder.outerHTML = FC_COMPLETE_MODAL_HTML;
}

// ── Auto-mount (synchronous) ──────────────────────────────────────────────────
mountFlashScreen();

console.log('[FlashScreen] module loaded ✦');
