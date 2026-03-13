/**
 * src/lib/auth.js — Auth module
 *
 * Extracted from the monolith (Task 32).
 * Handles Google OAuth sign-in/out, user profile, plan loading,
 * presence broadcasting, and admin access checks.
 *
 * Exposes named exports AND sets window globals for backward compat
 * with any monolith code that still calls these as globals.
 */

/* ────────────────────────────────────────────────
   STATE
──────────────────────────────────────────────── */

export let _currentUser  = null;
export let _presenceChan = null;

// Mirror to window for monolith backward compat
Object.defineProperty(window, '_currentUser', {
  get: () => _currentUser,
  set: (v) => { _currentUser = v; },
  configurable: true,
});

/* ────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────── */

/** Read logged-in email from Supabase localStorage session */
export function _getSessionEmail() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.includes('auth-token') || k.includes('supabase.auth'))) {
        const raw = JSON.parse(localStorage.getItem(k) || '{}');
        const e = raw?.user?.email || raw?.currentSession?.user?.email;
        if (e) return e;
      }
    }
  } catch(e) {}
  return null;
}

/* ────────────────────────────────────────────────
   PLAN UI
──────────────────────────────────────────────── */

const PLAN_LABELS = { free: 'Free Plan', pro: 'Pro', ultra: 'Ultra' };
const PLAN_COLORS = { free: 'var(--text-3)', pro: 'var(--green)', ultra: 'var(--gold)' };
const PLAN_ICONS  = { free: '', pro: '\u2B50 ', ultra: '\u26A1 ' };

function _normPlan(raw) {
  const p = String(raw || '').toLowerCase().trim();
  return p === 'ultra' ? 'ultra' : p === 'pro' ? 'pro' : 'free';
}

export function _applyPlanUI(planRow) {
  const plan  = _normPlan(planRow?.plan);
  const label = PLAN_ICONS[plan] + PLAN_LABELS[plan];
  const color = PLAN_COLORS[plan];
  document.querySelectorAll('.profile-plan').forEach(el => { el.textContent = label; el.style.color = color; });
  document.querySelectorAll('.md-profile-plan').forEach(el => { el.textContent = label; el.style.color = color; });
  const upgradeItem = document.querySelector('.pd-item.upgrade');
  if (upgradeItem) upgradeItem.style.display = plan === 'ultra' ? 'none' : '';
  window._userPlan    = plan;
  window._userPlanRow = planRow;
}

/* ────────────────────────────────────────────────
   LOAD PLAN FROM SUPABASE
──────────────────────────────────────────────── */

export async function _refreshUserPlan() {
  try {
    const email = _getSessionEmail();
    const sb    = await window._getChunksSb();
    if (sb && email) {
      const { data, error } = await sb.from('users')
        .select('email, plan, subscription_end, paid, full_name')
        .eq('email', email).maybeSingle();
      if (!error && data) {
        _currentUser = data;
        // Ensure user UUID is always on _currentUser for ChunksDB
        if (!_currentUser.id) {
          try {
            const { data: { session } } = await sb.auth.getSession();
            if (session?.user?.id) _currentUser.id = session.user.id;
          } catch(e) {}
        }
      }
      else _currentUser = { email, plan: 'free' };
    } else {
      _currentUser = email ? { email, plan: 'free' } : null;
    }
    _applyPlanUI(_currentUser);
    _checkAdminAccess();
  } catch(e) {
    console.warn('[Chunks] Plan load error:', e.message);
    _applyPlanUI(null);
  }
  _startPresence(); // always start presence after plan attempt
}

/* ────────────────────────────────────────────────
   PRESENCE BROADCAST
──────────────────────────────────────────────── */

export async function _startPresence() {
  try {
    const sb = await window._getChunksSb();
    if (!sb) { console.warn('[Chunks] Presence skipped: no Supabase'); return; }

    if (_presenceChan) {
      try { await sb.removeChannel(_presenceChan); } catch(e) {}
      _presenceChan = null;
    }

    const email   = _getSessionEmail() || _currentUser?.email;
    const payload = email
      ? { type: 'user', email, plan: _currentUser?.plan || 'free' }
      : { type: 'guest' };

    _presenceChan = sb.channel('app-presence');
    _presenceChan.subscribe(async (status) => {
      console.log('[Chunks] Presence:', status);
      if (status === 'SUBSCRIBED') {
        const r = await _presenceChan.track(payload);
        console.log('[Chunks] Tracked:', JSON.stringify(payload), r);
      }
    });

    window.removeEventListener('beforeunload', window._chunksUntrack);
    window._chunksUntrack = () => { try { _presenceChan?.untrack(); } catch(e) {} };
    window.addEventListener('beforeunload', window._chunksUntrack);
  } catch(e) {
    console.warn('[Chunks] Presence error:', e.message);
  }
}

/* ────────────────────────────────────────────────
   GOOGLE AUTH
──────────────────────────────────────────────── */

export async function chunksSignIn() {
  const sb = await window._getChunksSb();
  if (!sb) { console.warn('[Auth] No Supabase client'); return; }
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href, queryParams: { prompt: 'select_account' } }
  });
}

export async function chunksSignOut() {
  const sb = await window._getChunksSb();
  if (sb) await sb.auth.signOut();
  _currentUser = null;
  _applyPlanUI(null);
  location.reload();
}

/* Register or refresh user in the `users` table */
export async function _ensureUserInDb(session) {
  if (!session?.user) return;
  const sb = await window._getChunksSb();
  if (!sb) return;
  const { user } = session;
  const email     = user.email;
  const full_name = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0];
  const avatar    = user.user_metadata?.avatar_url || '';

  const { error } = await sb.from('users').upsert({
    email,
    full_name,
    avatar,
    plan:       'free',
    approved:   true,
    created_at: new Date().toISOString()
  }, { onConflict: 'email', ignoreDuplicates: true });

  if (error) console.warn('[Auth] User upsert error:', error.message);
  else console.log('[Auth] User registered/verified:', email);
}

/* ────────────────────────────────────────────────
   PROFILE UI
──────────────────────────────────────────────── */

export function _applyUserProfile(session) {
  if (!session?.user) return;
  const { user } = session;
  const email     = user.email;
  const full_name = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const firstName = full_name.split(' ')[0] || email.split('@')[0];
  const initials  = full_name
    ? full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : email[0].toUpperCase();
  const handle    = '@' + email.split('@')[0];
  const avatarUrl = user.user_metadata?.avatar_url || '';

  function _setAvatar(el, url, text) {
    if (!el) return;
    const prev = el.querySelector('img.avatar-photo');
    if (prev) prev.remove();
    if (url) {
      const img = document.createElement('img');
      img.className = 'avatar-photo';
      img.src = url;
      img.alt = text;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
      img.onerror = () => { img.remove(); el.textContent = text; };
      el.textContent = '';
      el.style.backgroundImage = '';
      el.appendChild(img);
    } else {
      el.textContent = text;
      el.style.backgroundImage = '';
    }
  }

  document.querySelectorAll('.profile-name').forEach(el => el.textContent = firstName);

  const pdAvatar = document.querySelector('.pd-avatar');
  const pdName   = document.querySelector('.pd-name');
  const pdHandle = document.querySelector('.pd-handle');
  _setAvatar(pdAvatar, avatarUrl, initials);
  if (pdName)   pdName.textContent   = full_name || firstName;
  if (pdHandle) pdHandle.textContent = handle;

  document.querySelectorAll('.avatar').forEach(el => _setAvatar(el, avatarUrl, initials));
  _setAvatar(document.querySelector('.mht-avatar'), avatarUrl, initials);

  document.querySelectorAll('.settings-account-name, [data-user-name]').forEach(el => el.textContent = full_name || firstName);
  document.querySelectorAll('.settings-account-email, [data-user-email]').forEach(el => el.textContent = email);

  const mdName = document.querySelector('.md-profile-name');
  if (mdName) mdName.textContent = firstName;

  // Ensure _currentUser.id is set (ChunksDB needs it)
  if (session.user && _currentUser) {
    _currentUser.id = session.user.id;
  }
}

/* ────────────────────────────────────────────────
   ADMIN ACCESS
──────────────────────────────────────────────── */

const ADMIN_EMAILS = ['contridascharles91@gmail.com', 'deffmichaeldawang@gmail.com'];

export function openAdminPanel() {
  window.open('admin.html', '_blank', 'noopener,noreferrer');
}

export function _checkAdminAccess() {
  const email = _currentUser?.email || (() => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.includes('auth-token') || k.includes('supabase'))) {
          const raw = JSON.parse(localStorage.getItem(k) || '{}');
          const candidate = raw?.user?.email || raw?.currentSession?.user?.email;
          if (candidate) return candidate;
        }
      }
    } catch(e) {}
    return document.querySelector('.pd-handle')?.textContent?.trim().replace(/^@/, '') || '';
  })();

  const isAdmin = ADMIN_EMAILS.includes(email);
  const btn = document.getElementById('pd-admin-btn');
  if (btn) btn.style.display = isAdmin ? '' : 'none';
}

/* ────────────────────────────────────────────────
   BOOT
──────────────────────────────────────────────── */

export async function _initAuth() {
  const sb = await window._getChunksSb();
  if (!sb) return;

  // Handle OAuth redirect (access_token in URL hash)
  if (window.location.hash.includes('access_token') || window.location.search.includes('code=')) {
    const { data } = await sb.auth.getSession();
    if (data?.session) {
      history.replaceState(null, '', window.location.pathname);
      await _ensureUserInDb(data.session);
      _applyUserProfile(data.session);
    }
  }

  // Restore existing session
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await _ensureUserInDb(session);
    _applyUserProfile(session);
  }

  // Listen for auth changes (sign-in / sign-out / token refresh)
  sb.auth.onAuthStateChange(async (event, session) => {
    console.log('[Auth] Event:', event);
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      await _ensureUserInDb(session);
      _applyUserProfile(session);
      await _refreshUserPlan();
    } else if (event === 'SIGNED_OUT') {
      _currentUser = null;
      _applyPlanUI(null);
    }
  });
}

/* ── DOMContentLoaded bootstrap ── */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(_refreshUserPlan, 800);
  setTimeout(_initAuth, 1000);
  _checkAdminAccess();
  document.getElementById('profile-dropdown')
    ?.addEventListener('animationstart', _checkAdminAccess);
});
setTimeout(_checkAdminAccess, 1200);

/* ────────────────────────────────────────────────
   WINDOW GLOBALS (backward compat)
──────────────────────────────────────────────── */

window.chunksSignIn         = chunksSignIn;
window.chunksSignOut        = chunksSignOut;
window._initAuth            = _initAuth;
window._refreshUserPlan     = _refreshUserPlan;
window._applyUserProfile    = _applyUserProfile;
window._applyPlanUI         = _applyPlanUI;
window._getSessionEmail     = _getSessionEmail;
window._ensureUserInDb      = _ensureUserInDb;
window._startPresence       = _startPresence;
window._checkAdminAccess    = _checkAdminAccess;
window.openAdminPanel       = openAdminPanel;

console.log('[Auth] Module ready');
