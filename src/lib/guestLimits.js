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
};

const STORAGE_KEY  = 'chunks_guest_usage';   // localStorage: usage counts
const FP_KEY       = 'chunks_guest_fp';      // localStorage: device fingerprint

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
const ABUSE_KEY = 'chunks_guest_abused';

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

// On load: check if this fingerprint was previously burnt
(function _checkBurntOnLoad() {
  try {
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
  general:   { icon: '💬', title: 'General AI limit reached', desc: `You've used all ${GUEST_LIMITS.general} free messages.` },
  workspace: { icon: '📖', title: 'Workspace limit reached',  desc: `You've used all ${GUEST_LIMITS.workspace} free workspace messages.` },
  library:   { icon: '📚', title: 'Library limit reached',    desc: `Guests can open ${GUEST_LIMITS.library} book. Sign in to access the full library.` },
  studyplan: { icon: '📅', title: 'Study Plan limit reached', desc: `Guests can create ${GUEST_LIMITS.studyplan} study plan. Sign in for unlimited plans.` },
  visual:    { icon: '🎓', title: 'Visual Tutor limit reached', desc: `Guests can run ${GUEST_LIMITS.visual} visual lesson. Sign in for unlimited access.` },
  research:  { icon: '🔬', title: 'Research limit reached',   desc: `Guests can generate ${GUEST_LIMITS.research} research section. Sign in for unlimited research.` },
  exam:      { icon: '📝', title: 'Exam limit reached',       desc: `Guests can take ${GUEST_LIMITS.exam} practice exam. Sign in for unlimited exams.` },
  abuse:     { icon: '🔒', title: 'Sign in to continue',      desc: 'You\'ve explored everything Chunks has to offer as a guest. Sign in to keep going!' },
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
      @keyframes _gwFadeIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
      #guest-login-wall .gw-card {
        background:var(--surface-2, #171820);
        border:1px solid var(--border-sm, #2a2b38);
        border-radius:20px;
        padding:36px 32px 28px;
        max-width:380px;width:100%;
        text-align:center;
        box-shadow:0 24px 60px rgba(0,0,0,0.5);
      }
      #guest-login-wall .gw-icon { font-size:40px; margin-bottom:14px; }
      #guest-login-wall .gw-title { font-size:18px; font-weight:700; color:var(--text-1,#ededf0); margin-bottom:8px; }
      #guest-login-wall .gw-desc  { font-size:13px; color:var(--text-3,#7c7c96); line-height:1.55; margin-bottom:24px; }
      #guest-login-wall .gw-btn-login {
        width:100%;padding:12px;border-radius:12px;border:none;cursor:pointer;
        background:#ededf0;color:#111219;font-size:14px;font-weight:700;
        font-family:var(--font-body,inherit);margin-bottom:10px;
        transition:opacity 0.15s;
      }
      #guest-login-wall .gw-btn-login:hover { opacity:0.88; }
      #guest-login-wall .gw-btn-signup {
        width:100%;padding:11px;border-radius:12px;cursor:pointer;
        background:transparent;border:1px solid var(--border-xs,#252633);
        color:var(--text-2,#9898ae);font-size:13px;font-weight:600;
        font-family:var(--font-body,inherit);margin-bottom:16px;
        transition:background 0.15s,color 0.15s;
      }
      #guest-login-wall .gw-btn-signup:hover { background:var(--surface-3,#1e1f29);color:var(--text-1,#ededf0); }
      #guest-login-wall .gw-dismiss {
        font-size:12px;color:var(--text-3,#7c7c96);cursor:pointer;
        background:none;border:none;font-family:inherit;
        text-decoration:underline;text-underline-offset:2px;
        transition:color 0.15s;
      }
      #guest-login-wall .gw-dismiss:hover { color:var(--text-2,#9898ae); }
    </style>
    <div class="gw-card">
      <div class="gw-icon">${info.icon}</div>
      <div class="gw-title">${info.title}</div>
      <div class="gw-desc">${info.desc}<br><br><strong style="color:var(--text-2,#9898ae)">Sign in for unlimited access — it's free.</strong></div>
      <button class="gw-btn-login" onclick="window.location.href='/login'">Log in</button>
      <button class="gw-btn-signup" onclick="window.location.href='/login?signup=1'">Sign up for free</button>
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
    existing.textContent = `${remaining} free message${remaining === 1 ? '' : 's'} left — Sign in for unlimited`;
    existing.style.color = remaining === 1 ? 'var(--gold,#e8ac2e)' : 'var(--text-3)';
  } else if (remaining === 0) {
    existing.textContent = 'Free limit reached — Sign in for unlimited';
    existing.style.color = 'var(--gold,#e8ac2e)';
  } else {
    existing.textContent = '';
  }
}

// ── Export to window for non-module scripts ───────────────────────────────

window.guestGate       = guestGate;
window.guestCheckLimit = checkLimit;
window.guestRecordUsage = recordUsage;
window.showGuestLoginWall = showLoginWall;
window.enforceExamConstraints = enforceExamConstraints;
window.renderGuestUsageBar = renderUsageBar;
window.isGuestMode     = isGuest;
