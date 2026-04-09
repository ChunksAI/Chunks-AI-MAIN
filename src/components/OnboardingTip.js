// ── OnboardingTip.js ─────────────────────────────────────────────────────────
// 3-step first-book onboarding tooltip.
// Call showOnboardingIfFirst() after a book finishes loading.
// Shows once ever; localStorage flag 'chunks_onboarding_done' prevents re-show.

const _OB_KEY   = 'chunks_onboarding_done';
const _OB_ID    = 'onboarding-tip';
const _OB_CSS_ID = 'onboarding-tip-style';
const _AUTO_DISMISS_MS = 20000;

const _STEPS = [
  {
    text:   'Highlight any text to get instant AI explanations',
    target: () => document.getElementById('ws-pdf-canvas-wrap') ||
                  document.querySelector('.pdf-panel'),
    side:   'right',
  },
  {
    text:   'Tap Explain, Quiz me, or Add note on any selection',
    target: () => document.querySelector('.pdf-panel'),
    side:   'right',
  },
  {
    text:   'Use these chips after any answer — Flashcards, Visualize, Test me',
    target: () => document.querySelector('.ws-next-chips') ||
                  document.getElementById('ws-messages'),
    side:   'top',
  },
];

function _injectStyles() {
  if (document.getElementById(_OB_CSS_ID)) return;
  const style = document.createElement('style');
  style.id = _OB_CSS_ID;
  style.textContent = `
#onboarding-tip {
  position: fixed;
  z-index: 9999;
  max-width: 280px;
  background: rgba(20, 20, 30, 0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 14px;
  padding: 14px 16px 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  color: #fff;
  font-family: var(--font-body, system-ui, sans-serif);
  font-size: 13px;
  line-height: 1.5;
  transition: opacity 0.25s ease, transform 0.25s ease;
  pointer-events: auto;
}
#onboarding-tip.ob-hidden {
  opacity: 0;
  transform: translateY(6px);
  pointer-events: none;
}
#onboarding-tip .ob-step {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.45);
  text-transform: uppercase;
  margin-bottom: 6px;
}
#onboarding-tip .ob-text {
  margin-bottom: 12px;
}
#onboarding-tip .ob-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
#onboarding-tip .ob-next {
  padding: 5px 14px;
  border-radius: 20px;
  border: none;
  background: #fff;
  color: #111;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s;
}
#onboarding-tip .ob-next:hover { background: #e8e8e8; }
#onboarding-tip .ob-skip {
  font-size: 11px;
  color: rgba(255,255,255,0.45);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  transition: color 0.15s;
}
#onboarding-tip .ob-skip:hover { color: rgba(255,255,255,0.75); }
#onboarding-tip .ob-arrow {
  position: absolute;
  width: 10px;
  height: 10px;
  background: rgba(20, 20, 30, 0.92);
  border: 1px solid rgba(255,255,255,0.12);
  transform: rotate(45deg);
}
`;
  document.head.appendChild(style);
}

function _getRect(el) {
  if (!el) return null;
  return el.getBoundingClientRect();
}

function _position(tipEl, targetEl, side) {
  const tip  = tipEl.getBoundingClientRect();
  const tgt  = _getRect(targetEl);
  const vw   = window.innerWidth;
  const vh   = window.innerHeight;
  const GAP  = 14;

  if (!tgt) {
    // Fallback: center of screen
    tipEl.style.left = Math.round((vw - tip.width) / 2) + 'px';
    tipEl.style.top  = Math.round(vh * 0.4) + 'px';
    return;
  }

  let left, top;
  const arrow = tipEl.querySelector('.ob-arrow');

  if (side === 'right') {
    // Place to the right of the target
    left = tgt.right + GAP;
    top  = tgt.top + (tgt.height / 2) - (tip.height / 2);
    if (arrow) {
      arrow.style.left   = '-6px';
      arrow.style.top    = Math.round(tip.height / 2 - 5) + 'px';
      arrow.style.bottom = '';
      arrow.style.right  = '';
      arrow.style.borderRight  = '';
      arrow.style.borderBottom = '';
    }
  } else {
    // 'top' — place above the target
    left = tgt.left + (tgt.width / 2) - (tip.width / 2);
    top  = tgt.top - tip.height - GAP;
    if (arrow) {
      arrow.style.left   = Math.round(tip.width / 2 - 5) + 'px';
      arrow.style.top    = '';
      arrow.style.bottom = '-6px';
      arrow.style.right  = '';
    }
  }

  // Clamp within viewport
  left = Math.max(8, Math.min(left, vw - tip.width - 8));
  top  = Math.max(8, Math.min(top,  vh - tip.height - 8));

  tipEl.style.left = Math.round(left) + 'px';
  tipEl.style.top  = Math.round(top)  + 'px';
}

export function showOnboardingIfFirst() {
  try {
    if (localStorage.getItem(_OB_KEY)) return;
  } catch (_) { return; }

  _injectStyles();

  // Remove any previous instance
  const old = document.getElementById(_OB_ID);
  if (old) old.remove();

  let currentStep = 0;
  let autoTimer   = null;

  const tip = document.createElement('div');
  tip.id = _OB_ID;
  tip.classList.add('ob-hidden');
  tip.innerHTML = `
    <div class="ob-arrow"></div>
    <div class="ob-step"></div>
    <div class="ob-text"></div>
    <div class="ob-actions">
      <button class="ob-next"></button>
      <button class="ob-skip">Skip</button>
    </div>`;
  document.body.appendChild(tip);

  const stepEl = tip.querySelector('.ob-step');
  const textEl = tip.querySelector('.ob-text');
  const nextBtn = tip.querySelector('.ob-next');
  const skipBtn = tip.querySelector('.ob-skip');

  function _dismiss() {
    clearTimeout(autoTimer);
    tip.classList.add('ob-hidden');
    setTimeout(() => { tip.remove(); }, 300);
    try { localStorage.setItem(_OB_KEY, '1'); } catch (_) {}
  }

  function _show(stepIndex) {
    clearTimeout(autoTimer);
    const step = _STEPS[stepIndex];
    const isLast = stepIndex === _STEPS.length - 1;

    stepEl.textContent = `${stepIndex + 1} / ${_STEPS.length}`;
    textEl.textContent = step.text;
    nextBtn.textContent = isLast ? 'Got it ✓' : 'Next →';

    // Briefly hide while repositioning to avoid flash
    tip.classList.add('ob-hidden');
    requestAnimationFrame(() => {
      _position(tip, step.target(), step.side);
      requestAnimationFrame(() => {
        tip.classList.remove('ob-hidden');
      });
    });

    autoTimer = setTimeout(_dismiss, _AUTO_DISMISS_MS);
  }

  nextBtn.addEventListener('click', () => {
    if (currentStep < _STEPS.length - 1) {
      currentStep++;
      _show(currentStep);
    } else {
      _dismiss();
    }
  });

  skipBtn.addEventListener('click', _dismiss);

  // Delay the first step so the PDF panel has finished painting
  setTimeout(() => { _show(0); }, 500);
}
