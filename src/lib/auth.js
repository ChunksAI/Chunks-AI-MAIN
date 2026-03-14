/**
 * src/lib/auth.js — Task 32
 *
 * Supabase Auth module — replaces public/shared.js stub.
 *
 * Responsibilities:
 *   • Restore existing session on page load (_initAuth)
 *   • Listen for SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED events
 *   • Populate window._currentUser = { id, email, name, avatar, plan }
 *   • Update all UI elements that display user info:
 *       .profile-name / .profile-plan / .avatar  (sidebar)
 *       .pd-name / .pd-handle / .pd-avatar        (ProfileDropdown)
 *       .mht-avatar / .mwt-avatar                 (mobile topbars)
 *   • Expose window.chunksSignOut()
 *   • Expose window._applyUserProfile(session) for ChunksDB patching
 *   • Expose window._initAuth() for external callers
 *
 * Bridges set on window.*:
 *   _currentUser, _applyUserProfile, _initAuth, chunksSignOut
 */

import { getSupabaseClient } from './supabase.js';

// ── User state ────────────────────────────────────────────────────────────────

/** @type {{ id:string|null, email:string, name:string, avatar:string, plan:string }|null} */
window._currentUser = null;

// ── UI helpers ────────────────────────────────────────────────────────────────

/** Derive initials (1-2 chars) from a display name or email. */
function _initials(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.trim()[0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

/** Update every piece of user-facing UI with the current user state. */
function _applyUI(user) {
  if (!user) {
    // Signed out — reset to defaults
    document.querySelectorAll('.profile-name').forEach(el => { el.textContent = 'Guest'; });
    document.querySelectorAll('.profile-plan').forEach(el => { el.textContent = 'Free Plan'; });
    document.querySelectorAll('.avatar').forEach(el => { el.textContent = '?'; });
    document.querySelectorAll('.pd-name').forEach(el => { el.textContent = ''; });
    document.querySelectorAll('.pd-handle').forEach(el => { el.textContent = ''; });
    document.querySelectorAll('.pd-avatar').forEach(el => { el.textContent = '?'; el.style.backgroundImage = ''; });
    document.querySelectorAll('.mht-avatar, .mwt-avatar').forEach(el => { el.textContent = '?'; el.style.backgroundImage = ''; });
    return;
  }

  const initials = _initials(user.name, user.email);
  const planLabel = user.plan === 'pro' ? 'Pro Plan' : user.plan === 'team' ? 'Team Plan' : 'Free Plan';

  // Sidebar footer
  document.querySelectorAll('.profile-name').forEach(el => { el.textContent = user.name || user.email || 'User'; });
  document.querySelectorAll('.profile-plan').forEach(el => { el.textContent = planLabel; });
  document.querySelectorAll('.avatar').forEach(el => {
    if (user.avatar) {
      el.style.backgroundImage = `url(${user.avatar})`;
      el.style.backgroundSize = 'cover';
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.textContent = initials;
    }
  });

  // Profile dropdown header
  document.querySelectorAll('.pd-name').forEach(el => { el.textContent = user.name || user.email || 'User'; });
  document.querySelectorAll('.pd-handle').forEach(el => { el.textContent = user.email || ''; });
  document.querySelectorAll('.pd-avatar').forEach(el => {
    if (user.avatar) {
      el.style.backgroundImage = `url(${user.avatar})`;
      el.style.backgroundSize = 'cover';
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.textContent = initials;
    }
  });

  // Mobile topbar avatars
  document.querySelectorAll('.mht-avatar, .mwt-avatar').forEach(el => {
    if (user.avatar) {
      el.style.backgroundImage = `url(${user.avatar})`;
      el.style.backgroundSize = 'cover';
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.textContent = initials;
    }
  });

  // Show/hide the admin button in ProfileDropdown if applicable
  const adminBtn = document.getElementById('pd-admin-btn');
  if (adminBtn) adminBtn.style.display = user.isAdmin ? '' : 'none';
}

// ── Session → _currentUser ────────────────────────────────────────────────────

/**
 * Convert a Supabase session into window._currentUser and update UI.
 * Called by _initAuth and the onAuthStateChange listener.
 * Also called by chunksDb.js which patches this function to inject .id.
 */
window._applyUserProfile = function _applyUserProfile(session) {
  if (!session?.user) {
    window._currentUser = null;
    _applyUI(null);
    return;
  }

  const u    = session.user;
  const meta = u.user_metadata || {};

  // Build a flat user object
  window._currentUser = {
    id:      u.id,
    email:   u.email || '',
    name:    meta.full_name || meta.name || meta.display_name || u.email?.split('@')[0] || 'User',
    avatar:  meta.avatar_url || meta.picture || '',
    plan:    meta.plan || u.app_metadata?.plan || 'free',
    isAdmin: u.app_metadata?.role === 'admin' || meta.is_admin === true,
  };

  _applyUI(window._currentUser);
};

// ── Init ──────────────────────────────────────────────────────────────────────

window._initAuth = async function _initAuth() {
  let sb;
  try { sb = await getSupabaseClient(); } catch (e) { return; }
  if (!sb) return;

  // 1. Restore existing session
  try {
    const { data: { session } } = await sb.auth.getSession();
    window._applyUserProfile(session);

    // ── Auth gate ────────────────────────────────────────────────────────
    // If no active session AND not in guest mode → redirect to login page.
    // Guest mode is set by login.html's "Continue as guest" button via
    // sessionStorage.setItem('chunks_guest_mode', '1').
    const isGuest      = sessionStorage.getItem('chunks_guest_mode') === '1';
    const isAuthed     = !!session?.user;
    const isLoginPage  = window.location.pathname.endsWith('login.html'); // ← FIX 1: skip gate on login page
    // FIX 3: if Supabase OAuth code/hash is in URL, wait — don't redirect yet
    const hasOAuthCode = window.location.search.includes('code=');
    const hasOAuthHash = window.location.hash.includes('access_token') ||
                         window.location.hash.includes('error_description');

    if (!isAuthed && !isGuest && !isLoginPage && !hasOAuthCode && !hasOAuthHash) {
      // Preserve the current URL so login.html can redirect back after sign-in
      const returnTo = encodeURIComponent(window.location.href);
      window.location.replace(`login.html?returnTo=${returnTo}`);
      return; // stop further init — page is navigating away
    }
    // ────────────────────────────────────────────────────────────────────
  } catch (e) {
    console.warn('[auth] getSession failed:', e.message);
  }

  // 2. Listen for future auth changes
  sb.auth.onAuthStateChange((_event, session) => {
    window._applyUserProfile(session);

    // ── FIX 2: After Google OAuth redirect back, send user to returnTo ──
    if (_event === 'SIGNED_IN') {
      const isLoginPage = window.location.pathname.endsWith('login.html');
      if (isLoginPage) {
        const params   = new URLSearchParams(window.location.search);
        const returnTo = params.get('returnTo') || 'index.html';
        window.location.replace(decodeURIComponent(returnTo));
        return; // stop further execution — page is navigating away
      }

      // Give ChunksDB's DOMContentLoaded patcher time to run first
      setTimeout(() => {
        window._fcRenderDeckList?.().catch?.(() => {});
      }, 600);
    }
    // ────────────────────────────────────────────────────────────────────

    if (_event === 'SIGNED_OUT') {
      window._currentUser = null;
    }
  });
};

// ── Sign out ──────────────────────────────────────────────────────────────────

window.chunksSignOut = async function chunksSignOut() {
  let sb;
  try { sb = await getSupabaseClient(); } catch (e) { return; }
  if (!sb) return;

  try {
    await sb.auth.signOut();
    window._currentUser = null;
    _applyUI(null);
    // Clear any active session state
    localStorage.removeItem('chunks_active_home_session');
    localStorage.removeItem('chunks_active_ws_book');
    localStorage.removeItem('chunks_active_recent_id');
    // Clear the refresh flag so the auth gate fires on the next page load
    // (without this, the page reloads thinking it's a refresh and skips login redirect)
    sessionStorage.setItem('chunks_signing_out', '1');
    sessionStorage.removeItem('chunks_was_here');
    sessionStorage.removeItem('chunks_active_screen');
    sessionStorage.removeItem('chunks_is_refresh');
    // Reload to a clean state — auth gate will redirect to login.html
    window.location.reload();
  } catch (e) {
    console.warn('[auth] signOut failed:', e.message);
  }
};

// ── Boot ──────────────────────────────────────────────────────────────────────
// Run _initAuth after the DOM is ready (supabase.js client may not be
// initialised until after the page parses).

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window._initAuth);
} else {
  window._initAuth();
}

console.log('[auth] module loaded ✦');
