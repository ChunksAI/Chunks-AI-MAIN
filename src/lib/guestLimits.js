// @ts-nocheck
/**
 * src/lib/guestLimits.js — Guest mode usage limits + abuse prevention
 *
 * Limits:
 *   General AI   → 10 messages
 *   Workspace    →  5 messages
 *   Library      →  1 book
 *   Study Plan   →  1 plan
 *   Visual Tutor →  1 lesson
 *   Research     →  1 generation
 *   Exam         →  1 exam (MCQ only, max 5 questions)
 *
 * Abuse prevention:
 *   - Fingerprint stored in localStorage (survives session clears)
 *   - Fingerprint = canvas hash + screen + timezone + language + platform
 *   - If fingerprint matches a "burnt" record → show login wall immediately
 *   - Counts stored in localStorage (persists across sessions for same device)
 *   - sessionStorage guest flag removal does NOT reset counts (fp-keyed)
 */

// ── Constants ─────────────────────────────────────────────────────────────

export const GUEST_LIMITS = {
  general:   10,
  workspace:  5,
  library:    1,
  studyplan:  1,
  visual:     1,
  research:   1,
  exam:       1,
  flash:      2,
};

const STORAGE_KEY  = 'chunks_guest_usage';   // localStorage: usage counts
const FP_KEY       = 'chunks_guest_fp';      // localStorage: device fingerprint
const DATE_KEY     = 'chunks_guest_date';    // localStorage: last reset date (YYYY-MM-DD)
const ABUSE_KEY    = 'chunks_guest_abused';  // localStorage: abuse flag

// ── Daily reset ───────────────────────────────────────────────────────────

/** Returns today's date as a YYYY-MM-DD string (local time). */
function _today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * If the stored reset date is not today, wipe usage counts and the abuse flag
 * so every guest gets a fresh set of limits each calendar day.
 * Burnt fingerprints are intentionally preserved — they survive the daily reset.
 */
function _maybeResetDaily() {
  try {
    const stored = localStorage.getItem(DATE_KEY);
    const today  = _today();
    if (stored === today) return; // same day — nothing to do
    // New day → clear counts, abuse flag, and burnt fingerprints
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ABUSE_KEY);
    localStorage.removeItem('chunks_burnt_fps');
    localStorage.setItem(DATE_KEY, today);
  } catch (_) {}
}

// ── Fingerprint ───────────────────────────────────────────────────────────

function _buildFingerprint() {
  const parts = [];

  // Canvas hash
  try {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 50;
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Chunks🎓', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('Chunks🎓', 4, 17);
    parts.push(c.toDataURL().slice(-40));
  } catch (_) { parts.push('nocanvas'); }

  // Screen geometry
  parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

  // Timezone
  try { parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (_) {}

  // Language
  parts.push(navigator.language || '');

  // Platform
  parts.push(navigator.platform || '');

  // Plugins count (coarse)
  parts.push(String((navigator.plugins || []).length));

  // Hardware concurrency (CPU cores)
  parts.push(String(navigator.hardwareConcurrency || 0));

  // Touch support
  parts.push(String('ontouchstart' in window));

  return parts.join('|');
}

// Simple djb2-style hash → short hex string
function _hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, '0');
}

function getFingerprint() {
  try {
    const stored = localStorage.getItem(FP_KEY);
    if (stored) return stored;
  } catch (_) {}
  const fp = _hash(_buildFingerprint());
  try { localStorage.setItem(FP_KEY, fp); } catch (_) {}
  return fp;
}

// ── Usage storage ─────────────────────────────────────────────────────────

function _loadUsage() {
  _maybeResetDaily();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {};
}

function _saveUsage(usage) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(usage)); } catch (_) {}
}

function getCount(feature) {
  const usage = _loadUsage();
  return usage[feature] || 0;
}

function increment(feature) {
  const usage = _loadUsage();
  usage[feature] = (usage[feature] || 0) + 1;
  _saveUsage(usage);
  return usage[feature];
}

// ── Public API ────────────────────────────────────────────────────────────

/** Returns true if user is currently in guest mode */
export function isGuest() {
  return sessionStorage.getItem('chunks_guest_mode') === '1';
}

/**
 * Check if a feature is over its limit.
 * Returns { allowed: bool, count: number, limit: number }
 */
export function checkLimit(feature) {
  if (!isGuest()) return { allowed: true, count: 0, limit: GUEST_LIMITS[feature] };
  const limit = GUEST_LIMITS[feature];
  const count = getCount(feature);
  return { allowed: count < limit, count, limit };
}

/**
 * Record usage of a feature. Call AFTER the action succeeds.
 * Returns the new count.
 */
export function recordUsage(feature) {
  if (!isGuest()) return 0;
  return increment(feature);
}

/**
 * Main gate: call before any guest action.
 * If over limit → show login wall and return false.
 * If allowed → return true (caller proceeds).
 */
export function guestGate(feature, opts = {}) {
  if (!isGuest()) return true;

  // Abuse check first
  if (_isAbuser()) {
    showLoginWall('abuse');
    return false;
  }

  const { allowed, count, limit } = checkLimit(feature);
  if (!allowed) {
    showLoginWall(feature, { count, limit, ...opts });
    return false;
  }
  return true;
}

// ── Abuse prevention ──────────────────────────────────────────────────────

const ABUSE_THRESHOLD = 3; // how many features must be maxed to flag as abuser

function _isAbuser() {
  // Check if already flagged
  try {
    if (localStorage.getItem(ABUSE_KEY) === '1') return true;
  } catch (_) {}

  // Check how many features are maxed
  const usage = _loadUsage();
  let maxedCount = 0;
  for (const [feature, limit] of Object.entries(GUEST_LIMITS)) {
    if ((usage[feature] || 0) >= limit) maxedCount++;
  }

  // If >= ABUSE_THRESHOLD features maxed, flag and burn the fingerprint
  if (maxedCount >= ABUSE_THRESHOLD) {
    try { localStorage.setItem(ABUSE_KEY, '1'); } catch (_) {}
    _burnFingerprint();
    return true;
  }
  return false;
}

function _burnFingerprint() {
  try {
    const fp = getFingerprint();
    const burnt = JSON.parse(localStorage.getItem('chunks_burnt_fps') || '[]');
    if (!burnt.includes(fp)) {
      burnt.push(fp);
      localStorage.setItem('chunks_burnt_fps', JSON.stringify(burnt));
    }
  } catch (_) {}
}

// On load: ALWAYS run the daily reset first (regardless of guest mode),
// then check burnt fingerprint only if currently in guest mode.
// This ensures counts are wiped at midnight even if the user doesn't
// interact until after the date has already rolled over.
(function _checkBurntOnLoad() {
  try {
    _maybeResetDaily(); // always runs — clears stale counts on new day
    if (!isGuest()) return;
    const fp = getFingerprint();
    const burnt = JSON.parse(localStorage.getItem('chunks_burnt_fps') || '[]');
    if (burnt.includes(fp)) {
      try { localStorage.setItem(ABUSE_KEY, '1'); } catch (_) {}
    }
  } catch (_) {}
})();

// ── Login wall modal ──────────────────────────────────────────────────────

const FEATURE_LABELS = {
  general:   {
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    color: 'var(--violet)',
    bg:    'var(--violet-muted)',
    title: 'Message limit reached',
    desc:  `You've used your ${GUEST_LIMITS.general} free AI messages for today.`,
  },
  workspace: {
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    color: 'var(--violet)',
    bg:    'var(--violet-muted)',
    title: 'Workspace limit reached',
    desc:  `You've used your ${GUEST_LIMITS.workspace} free workspace messages for today.`,
  },
  library:   {
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    color: 'var(--gold)',
    bg:    'var(--gold-muted)',
    title: 'Library limit reached',
    desc:  `Guests can open ${GUEST_LIMITS.library} book. Sign in to access the full library.`,
  },
  studyplan: {
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>`,
    color: 'var(--green)',
    bg:    'rgba(52,211,153,0.10)',
    title: 'Study Plan limit reached',
    desc:  `Guests can generate ${GUEST_LIMITS.studyplan} study plan. Sign in to create more.`,
  },
  visual:    {
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
    color: 'var(--violet)',
    bg:    'var(--violet-muted)',
    title: 'Visual Tutor limit reached',
    desc:  `Guests can run ${GUEST_LIMITS.visual} visual lesson. Sign in for more sessions.`,
  },
  research:  {
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`,
    color: 'var(--gold)',
    bg:    'var(--gold-muted)',
    title: 'Research limit reached',
    desc:  `Guests can generate ${GUEST_LIMITS.research} research section. Sign in to continue researching.`,
  },
  exam:      {
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    color: 'var(--gold)',
    bg:    'var(--gold-muted)',
    title: 'Exam limit reached',
    desc:  `Guests can take ${GUEST_LIMITS.exam} practice exam. Sign in to take more.`,
  },
  flash:     {
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    color: 'var(--violet)',
    bg:    'var(--violet-muted)',
    title: 'Flashcard limit reached',
    desc:  `Guests can generate ${GUEST_LIMITS.flash} flashcard decks. Sign in to create more.`,
  },
  abuse:     {
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    color: 'var(--text-2,#9898ae)',
    bg:    'rgba(152,152,174,0.10)',
    title: 'Sign in to continue',
    desc:  "You've explored everything Chunks has to offer as a guest. Sign in to keep going!",
  },
};

export function showLoginWall(feature = 'general', opts = {}) {
  // Remove any existing wall
  document.getElementById('guest-login-wall')?.remove();

  const info = FEATURE_LABELS[feature] || FEATURE_LABELS.general;

  const overlay = document.createElement('div');
  overlay.id = 'guest-login-wall';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);
    display:flex;align-items:center;justify-content:center;
    padding:20px;animation:_gwFadeIn 0.2s ease;
  `;

  overlay.innerHTML = `
    <style>
      @keyframes _gwFadeIn  { from { opacity:0; transform:translateY(8px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
      @keyframes _gwIconPop { 0%{transform:scale(0.7);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
      #guest-login-wall .gw-card {
        background: var(--surface-2, #171820);
        border: 1px solid var(--border-sm, #2a2b38);
        border-radius: 24px;
        padding: 36px 32px 28px;
        max-width: 360px; width: 100%;
        text-align: center;
        box-shadow: 0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset;
        animation: _gwFadeIn 0.22s cubic-bezier(0.34,1.2,0.64,1) both;
      }
      #guest-login-wall .gw-icon-wrap {
        width: 64px; height: 64px; border-radius: 18px;
        display: flex; align-items: center; justify-content: center;
        margin: 0 auto 20px;
        animation: _gwIconPop 0.35s cubic-bezier(0.34,1.4,0.64,1) 0.05s both;
      }
      #guest-login-wall .gw-title {
        font-size: 17px; font-weight: 700;
        color: var(--text-1, #ededf0);
        margin-bottom: 8px; letter-spacing: -0.2px;
      }
      #guest-login-wall .gw-desc {
        font-size: 13px; color: var(--text-3, #7c7c96);
        line-height: 1.6; margin-bottom: 8px;
      }
      #guest-login-wall .gw-cta {
        font-size: 13px; font-weight: 600;
        color: var(--text-2, #9898ae);
        margin-bottom: 24px; display: block;
      }
      #guest-login-wall .gw-divider {
        height: 1px; background: var(--border-sm, #2a2b38);
        margin: 0 0 20px; border: none;
      }
      #guest-login-wall .gw-btn-login {
        width: 100%; padding: 12px; border-radius: 12px; border: none; cursor: pointer;
        background: var(--text-1, #ededf0); color: #111219;
        font-size: 14px; font-weight: 700;
        font-family: var(--font-body, inherit); margin-bottom: 10px;
        transition: opacity 0.15s, transform 0.1s;
      }
      #guest-login-wall .gw-btn-login:hover  { opacity: 0.9; transform: translateY(-1px); }
      #guest-login-wall .gw-btn-login:active { transform: translateY(0); }
      #guest-login-wall .gw-btn-signup {
        width: 100%; padding: 11px; border-radius: 12px; cursor: pointer;
        background: transparent; border: 1px solid var(--border-xs, #252633);
        color: var(--text-2, #9898ae); font-size: 13px; font-weight: 600;
        font-family: var(--font-body, inherit); margin-bottom: 18px;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
      }
      #guest-login-wall .gw-btn-signup:hover {
        background: var(--surface-3, #1e1f29);
        color: var(--text-1, #ededf0);
        border-color: var(--border-sm, #2a2b38);
      }
      #guest-login-wall .gw-dismiss {
        font-size: 12px; color: var(--text-3, #7c7c96); cursor: pointer;
        background: none; border: none; font-family: inherit;
        transition: color 0.15s; padding: 4px 8px;
      }
      #guest-login-wall .gw-dismiss:hover { color: var(--text-2, #9898ae); }
    </style>
    <div class="gw-card">
      <div class="gw-icon-wrap" style="background:${info.bg};color:${info.color};">
        ${info.svg}
      </div>
      <div class="gw-title">${info.title}</div>
      <div class="gw-desc">${info.desc}</div>
      <span class="gw-cta">Sign in for more access — it's free.</span>
      <hr class="gw-divider">
      <button class="gw-btn-login" onclick="if(typeof window.openAuthModal==='function'){document.getElementById('guest-login-wall')?.remove();window.openAuthModal();}else{window.location.href='/ChunksAI';}">Log in</button>
      <button class="gw-btn-signup" onclick="if(typeof window.openAuthModal==='function'){document.getElementById('guest-login-wall')?.remove();window.openAuthModal();}else{window.location.href='/ChunksAI';}">Sign up for free</button>
      <br>
      <button class="gw-dismiss" id="gw-dismiss-btn">Maybe later</button>
    </div>
  `;

  // Dismiss on backdrop click (only if not abuse-locked)
  if (feature !== 'abuse') {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector('#gw-dismiss-btn').addEventListener('click', () => overlay.remove());
  } else {
    // Abuse lock: no dismiss
    overlay.querySelector('#gw-dismiss-btn').style.display = 'none';
  }

  document.body.appendChild(overlay);
}

// ── Screen entry preview (shown once per session per screen) ─────────────

const SCREEN_PREVIEW_LABELS = {
  workspace: `You have ${GUEST_LIMITS.workspace} free workspace messages as a guest`,
  library:   `You can open ${GUEST_LIMITS.library} book as a guest`,
  flash:     `You can generate ${GUEST_LIMITS.flash} flashcard decks as a guest`,
  studyplan: `You can generate ${GUEST_LIMITS.studyplan} study plan as a guest`,
  visual:    `You can run ${GUEST_LIMITS.visual} visual tutor lesson as a guest`,
  research:  `You can generate ${GUEST_LIMITS.research} research section as a guest`,
  exam:      `You can take ${GUEST_LIMITS.exam} practice exam as a guest — MCQ only, up to 5 questions`,
};

const PREVIEW_SESSION_KEY = 'chunks_guest_preview_shown';

/**
 * Show a subtle, dismissable banner the first time a guest lands on a screen
 * in a session. Does nothing for non-guest users or the home screen.
 */
export function showGuestScreenPreview(screen) {
  if (!isGuest()) return;
  const message = SCREEN_PREVIEW_LABELS[screen];
  if (!message) return;

  // Only show once per session per screen
  try {
    const shown = JSON.parse(sessionStorage.getItem(PREVIEW_SESSION_KEY) || '{}');
    if (shown[screen]) return;
    shown[screen] = true;
    sessionStorage.setItem(PREVIEW_SESSION_KEY, JSON.stringify(shown));
  } catch (_) { return; }

  const bannerId = 'guest-screen-preview-banner';
  document.getElementById(bannerId)?.remove();

  // Center in the main content area, accounting for any visible sidebar
  const sidebar = document.querySelector('.sidebar');
  const sidebarW = (sidebar && sidebar.getBoundingClientRect().width) || 0;
  const leftVal = sidebarW > 0 ? `calc(50% + ${Math.round(sidebarW / 2)}px)` : '50%';

  const banner = document.createElement('div');
  banner.id = bannerId;
  banner.style.cssText = [
    `position:fixed;top:12px;left:${leftVal};transform:translateX(-50%);`,
    'z-index:9999;',
    'background:var(--surface-2,#171820);',
    'border:1px solid var(--border-sm,#2a2b38);',
    'border-radius:10px;',
    'padding:10px 16px;',
    'display:flex;align-items:center;gap:10px;',
    'font-size:13px;color:var(--text-2,#9898ae);',
    'box-shadow:0 4px 24px rgba(0,0,0,0.4);',
    'max-width:440px;width:calc(100% - 32px);',
    'animation:_gpFadeIn 0.2s ease both;',
  ].join('');

  banner.innerHTML = `
    <style>
      @keyframes _gpFadeIn{from{opacity:0;transform:translateX(-50%) translateY(-6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
      #guest-screen-preview-banner .gp-close{background:none;border:none;cursor:pointer;color:var(--text-3,#7c7c96);font-size:18px;line-height:1;padding:0 0 0 4px;flex-shrink:0;transition:color 0.15s;}
      #guest-screen-preview-banner .gp-close:hover{color:var(--text-1,#ededf0);}
    </style>
    <span style="flex:1;">${message} — <a href="#" onclick="event.preventDefault();if(typeof window.openAuthModal==='function')window.openAuthModal();" style="color:var(--violet,#8b5cf6);text-decoration:none;font-weight:600;">Sign in for more</a></span>
    <button class="gp-close" aria-label="Dismiss">&#x2715;</button>
  `;

  banner.querySelector('.gp-close').addEventListener('click', () => banner.remove());
  document.body.appendChild(banner);
  setTimeout(() => banner?.remove(), 6000);
}

// On module load, expose showGuestScreenPreview globally and show the preview
// for the currently active screen. The global exposure allows screens.js to
// call window.showGuestScreenPreview?.() without a static import (avoiding a
// bundle-size increase for logged-in users). The _previewCurrentScreen IIFE
// handles the page-load restore case where showScreen() fires before this
// module has finished loading.
window.showGuestScreenPreview = showGuestScreenPreview;
(function _previewCurrentScreen() {
  if (!isGuest()) return;
  setTimeout(() => {
    try {
      const current = sessionStorage.getItem('chunks_last_screen');
      if (current && current !== 'home') showGuestScreenPreview(current);
    } catch (_) {}
  }, 200);
})();

// ── Exam guest constraints ────────────────────────────────────────────────

/** Force MCQ-only and max 5 questions for guests, returns true if modified */
export function enforceExamConstraints() {
  if (!isGuest()) return false;

  // Force MCQ type
  const mcqBtn = document.querySelector('#exam-type-grid .exam-type-btn[data-type="mcq"]');
  if (mcqBtn && !mcqBtn.classList.contains('active')) {
    mcqBtn.click();
  }
  // Disable non-MCQ buttons
  document.querySelectorAll('#exam-type-grid .exam-type-btn').forEach(btn => {
    if (btn.dataset.type !== 'mcq') {
      btn.disabled = true;
      btn.style.opacity = '0.35';
      btn.title = 'Sign in to unlock more question types';
    }
  });

  // Cap question count at 5
  const countInput = document.getElementById('exam-count-input');
  if (countInput) {
    const val = parseInt(countInput.value) || 10;
    if (val > 5) countInput.value = 5;
    countInput.max = '5';
    countInput.addEventListener('input', () => {
      if (parseInt(countInput.value) > 5) countInput.value = 5;
    });
  }

  return true;
}

// ── Usage indicator (subtle counter in UI) ────────────────────────────────

/**
 * Render a small "X / Y messages left" indicator inside a container element.
 * Pass the element id and feature key.
 */
export function renderUsageBar(containerId, feature) {
  if (!isGuest()) return;
  const container = document.getElementById(containerId);
  if (!container) return;

  const limit = GUEST_LIMITS[feature];
  const count = getCount(feature);
  const remaining = Math.max(0, limit - count);

  let existing = container.querySelector('.guest-usage-indicator');
  if (!existing) {
    existing = document.createElement('div');
    existing.className = 'guest-usage-indicator';
    existing.style.cssText = 'font-size:11px;color:var(--text-3);text-align:center;padding:4px 0 2px;pointer-events:none;';
    container.appendChild(existing);
  }

  if (remaining <= 3 && remaining > 0) {
    existing.textContent = `${remaining} free message${remaining === 1 ? '' : 's'} left — Sign in for more`;
    existing.style.color = remaining === 1 ? 'var(--gold,#e8ac2e)' : 'var(--text-3)';
  } else if (remaining === 0) {
    existing.textContent = 'Free limit reached — Sign in for more access';
    existing.style.color = 'var(--gold,#e8ac2e)';
  } else {
    existing.textContent = '';
  }
}

// ── Debug overlay (?debug=limits) ────────────────────────────────────────
// Visit /guest?debug=limits to see a live overlay of current guest usage.

(function _maybeShowDebugOverlay() {
  if (!new URLSearchParams(window.location.search).has('debug') ||
      new URLSearchParams(window.location.search).get('debug') !== 'limits') return;

  function _renderDebug() {
    const existing = document.getElementById('_dbg-limits');
    if (existing) existing.remove();

    _maybeResetDaily();
    const usage   = _loadUsage();
    const today   = localStorage.getItem(DATE_KEY) || '—';
    const abused  = localStorage.getItem(ABUSE_KEY) === '1';
    const fp      = localStorage.getItem(FP_KEY) || '—';
    const burnt   = JSON.parse(localStorage.getItem('chunks_burnt_fps') || '[]');

    const rows = Object.entries(GUEST_LIMITS).map(([feature, limit]) => {
      const count     = usage[feature] || 0;
      const remaining = Math.max(0, limit - count);
      const pct       = Math.round((count / limit) * 100);
      const color     = remaining === 0 ? '#ef4444' : remaining <= 2 ? '#f59e0b' : '#34d399';
      return `
        <tr>
          <td style="padding:4px 10px 4px 0;color:#ededf0;text-transform:capitalize;">${feature}</td>
          <td style="padding:4px 6px;text-align:center;color:${color};font-weight:600;">${count} / ${limit}</td>
          <td style="padding:4px 0 4px 6px;">
            <div style="width:80px;height:5px;background:#2a2b38;border-radius:3px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width .3s;"></div>
            </div>
          </td>
        </tr>`;
    }).join('');

    const el = document.createElement('div');
    el.id = '_dbg-limits';
    el.style.cssText = [
      'position:fixed;bottom:16px;right:16px;z-index:999999',
      'background:#111219;border:1px solid #2a2b38;border-radius:14px',
      'padding:16px 18px;font-family:monospace;font-size:12px',
      'box-shadow:0 8px 32px rgba(0,0,0,.6);min-width:260px',
      'color:#9898ae;line-height:1.4',
    ].join(';');

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#e8ac2e;font-weight:700;font-size:13px;">🔍 Guest Limits Debug</span>
        <button onclick="document.getElementById('_dbg-limits').remove()"
          style="background:none;border:none;color:#9898ae;cursor:pointer;font-size:16px;line-height:1;padding:0 0 0 10px;">×</button>
      </div>
      <table style="border-collapse:collapse;width:100%;">${rows}</table>
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid #2a2b38;font-size:11px;color:#7c7c96;">
        <div>📅 Reset date: <span style="color:#ededf0;">${today}</span></div>
        <div>🕐 Next reset: <span style="color:#ededf0;">midnight local time</span></div>
        <div>🛡 Abuse flag: <span style="color:${abused ? '#ef4444' : '#34d399'}">${abused ? 'YES' : 'no'}</span></div>
        <div>🔑 Fingerprint: <span style="color:#ededf0;">${fp}</span></div>
        <div>🔥 Burnt FPs: <span style="color:${burnt.length ? '#ef4444' : '#34d399'}">${burnt.length}</span></div>
      </div>
      <div style="margin-top:10px;text-align:center;">
        <button onclick="(function(){localStorage.removeItem('chunks_guest_usage');localStorage.removeItem('chunks_guest_abused');localStorage.removeItem('chunks_guest_date');window._renderDebugLimits?.();})()"
          style="background:#1e1f29;border:1px solid #2a2b38;color:#9898ae;font-family:monospace;font-size:11px;padding:4px 12px;border-radius:6px;cursor:pointer;">
          ↺ Reset counts
        </button>
      </div>
    `;
    document.body.appendChild(el);
  }

  window._renderDebugLimits = _renderDebug;

  // Mount after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _renderDebug);
  } else {
    setTimeout(_renderDebug, 300);
  }
})();
