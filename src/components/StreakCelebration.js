// ── StreakCelebration.js ──────────────────────────────────────────────────────
// Micro-celebration toast shown the FIRST TIME a user generates a flashcard set.
// Introduces the streak system and creates a reason to return tomorrow.

const _SC_KEY    = 'chunks_streak_celebrated';
const _SC_ID     = 'streak-celebration';
const _SC_CSS_ID = 'streak-celebration-style';
const _AUTO_DISMISS_MS = 8000;

function _injectStyles() {
  if (document.getElementById(_SC_CSS_ID)) return;
  const style = document.createElement('style');
  style.id = _SC_CSS_ID;
  style.textContent = `
@keyframes sc-slide-in {
  from { transform: translateX(120%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@keyframes sc-slide-out {
  from { transform: translateX(0);    opacity: 1; }
  to   { transform: translateX(120%); opacity: 0; }
}
#streak-celebration {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 260px;
  z-index: 9999;
  background: var(--surface-1, #1a1a24);
  border: 1px solid rgba(255,180,0,0.25);
  border-radius: 16px;
  padding: 18px 16px 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05);
  font-family: var(--font-body, system-ui, sans-serif);
  animation: sc-slide-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
}
#streak-celebration.sc-out {
  animation: sc-slide-out 0.35s ease-in both;
}
#streak-celebration .sc-fire {
  font-size: 36px;
  line-height: 1;
  margin-bottom: 10px;
  display: block;
}
#streak-celebration .sc-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1, #fff);
  margin-bottom: 5px;
}
#streak-celebration .sc-sub {
  font-size: 12px;
  color: var(--text-3, rgba(255,255,255,0.5));
  line-height: 1.5;
  margin-bottom: 14px;
}
#streak-celebration .sc-btn {
  display: block;
  width: 100%;
  padding: 7px 0;
  border-radius: 20px;
  border: none;
  background: linear-gradient(90deg, #f5a623, #f97316);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s;
  text-align: center;
}
#streak-celebration .sc-btn:hover { opacity: 0.88; }
`;
  document.head.appendChild(style);
}

export function celebrateFirstFlashcard() {
  try {
    if (localStorage.getItem(_SC_KEY)) return;
  } catch (_) { return; }

  _injectStyles();

  // Remove any stale instance
  const old = document.getElementById(_SC_ID);
  if (old) old.remove();

  const card = document.createElement('div');
  card.id = _SC_ID;
  card.innerHTML = `
    <span class="sc-fire">🔥</span>
    <div class="sc-title">Your streak starts today!</div>
    <div class="sc-sub">Come back tomorrow to keep it alive. Streaks unlock themes and badges.</div>
    <button class="sc-btn">Let's go</button>`;
  document.body.appendChild(card);

  let dismissed = false;

  function _dismiss() {
    if (dismissed) return;
    dismissed = true;
    try { localStorage.setItem(_SC_KEY, '1'); } catch (_) {}
    card.classList.add('sc-out');
    setTimeout(() => { card.remove(); }, 380);
  }

  card.querySelector('.sc-btn').addEventListener('click', _dismiss);
  setTimeout(_dismiss, _AUTO_DISMISS_MS);
}
