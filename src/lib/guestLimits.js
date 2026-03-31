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
};

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
  // Backend enforces limits via Redis — always allow on the client side
  return { allowed: true, count: 0, limit: GUEST_LIMITS[feature] };
}

/**
 * Record usage of a feature. Call AFTER the action succeeds.
 * Returns the new count.
 */
export function recordUsage(feature) {
  return 0;
}

/**
 * Main gate: call before any guest action.
 * If over limit → show login wall and return false.
 * If allowed → return true (caller proceeds).
 */
export function guestGate(feature, opts = {}) {
  if (!isGuest()) return true;
  const { allowed, count, limit } = checkLimit(feature);
  if (!allowed) {
    showLoginWall(feature, { count, limit, ...opts });
    return false;
  }
  return true;
}

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
  const count = 0;
  const remaining = limit;

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

    const rows = Object.entries(GUEST_LIMITS).map(([feature, limit]) => {
      const count     = 0;
      const remaining = limit;
      const pct       = 0;
      const color     = '#34d399';
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
        <div>ℹ️ Limits enforced server-side via Redis</div>
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
