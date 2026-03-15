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

// ── Default settings (new users) ─────────────────────────────────────────────

/**
 * Write default settings to localStorage the very first time a user signs in.
 * Safe to call on every SIGNED_IN — the `chunks_settings_initialized` guard
 * ensures defaults are only written once and never overwrite user choices.
 */
function _applyDefaultSettings() {
  try {
    if (localStorage.getItem('chunks_settings_initialized') === '1') return;

    const defaults = {
      // General
      'chunks-chat-font-size':            'medium',
      'chunks_setting_appearance':        'dark',
      'chunks_setting_language':          'Auto-detect',
      'chunks_setting_spoken-language':   'Auto-detect',
      'chunks_setting_voice':             'Maple',
      'chunks_setting_separate-voice':    '0',

      // Notifications (study reminders + flashcard alerts on by default)
      'chunks_setting_notif-study':       '1',
      'chunks_setting_notif-flashcard':   '1',
      'chunks_setting_notif-library':     '0',
      'chunks_setting_notif-updates':     '0',

      // Personalization
      'chunks_default_book':              'atkins',
      'chunks_study_mode':                'balanced',
      'chunks_setting_followups':         '1',
      'chunks_setting_auto-flash':        '0',

      // Data controls
      'chunks_improve_data':              '1',

      // Parental controls
      'chunks_setting_safe-content':      '0',
    };

    Object.entries(defaults).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });

    // Apply font size CSS var immediately
    const fontMap = { small: '11px', medium: '13px', large: '15px' };
    document.documentElement.style.setProperty('--chat-font-size', fontMap['medium']);

    // Mark as initialized so we never overwrite again
    localStorage.setItem('chunks_settings_initialized', '1');
  } catch (e) {
    console.warn('[auth] _applyDefaultSettings failed:', e);
  }
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
  // ── Instant gate: check localStorage BEFORE any network call ─────────────
  // If no session token exists at all, redirect to login immediately
  // without waiting for Supabase SDK or getSession() network call.
  // This prevents the homepage from flashing for unauthenticated users.
  const isGuest_      = sessionStorage.getItem('chunks_guest_mode') === '1';
  const isLoginPage_  = window.location.pathname.endsWith('login.html');
  const hasOAuthCode_ = window.location.search.includes('code=');
  const hasOAuthHash_ = window.location.hash.includes('access_token');

  if (!isGuest_ && !isLoginPage_ && !hasOAuthCode_ && !hasOAuthHash_) {
    try {
      const raw = localStorage.getItem('chunks-ai-auth');
      if (!raw) {
        // No session at all — redirect instantly, no network call needed
        window.location.replace('login.html');
        return;
      }
      // Check if token is expired
      const parsed  = JSON.parse(raw);
      const session = parsed.access_token ? parsed
                    : parsed.currentSession ? parsed.currentSession
                    : null;
      if (session && session.expires_at) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (session.expires_at - nowSec < 60) {
          // Token expired or expiring soon — let getSession() refresh it below
          // Don't redirect yet — Supabase will auto-refresh
        }
      } else if (!session || !session.access_token) {
        window.location.replace('login.html');
        return;
      }
    } catch (e) {
      // localStorage parse failed — fall through to network check
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  let sb;
  try { sb = await getSupabaseClient(); } catch (e) { return; }
  if (!sb) return;

  // 1. Restore existing session
  try {
    const { data: { session } } = await sb.auth.getSession();
    window._applyUserProfile(session);

    // Apply default settings for users who haven't been initialized yet
    if (session?.user) _applyDefaultSettings();

    // ── Auth gate ────────────────────────────────────────────────────────
    const isGuest      = sessionStorage.getItem('chunks_guest_mode') === '1';
    const isAuthed     = !!session?.user;
    const isLoginPage  = window.location.pathname.endsWith('login.html');
    const hasOAuthCode = window.location.search.includes('code=');
    const hasOAuthHash = window.location.hash.includes('access_token') ||
                         window.location.hash.includes('error_description');

    if (!isAuthed && !isGuest && !isLoginPage && !hasOAuthCode && !hasOAuthHash) {
      window.location.replace('login.html');
      return;
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
      // Apply default settings for new users (no-op if already initialized)
      _applyDefaultSettings();

      const isLoginPage = window.location.pathname.endsWith('login.html');
      if (isLoginPage) {
        window.location.replace('index.html');
        return;
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
  // Always clear state and redirect — never let a Supabase failure block logout
  function _doRedirect() {
    window._currentUser = null;
    _applyUI(null);
    // Clear localStorage session state
    localStorage.removeItem('chunks_active_home_session');
    localStorage.removeItem('chunks_active_ws_book');
    localStorage.removeItem('chunks_active_recent_id');
    // Clear sessionStorage so auth gate redirects to login on next load
    sessionStorage.setItem('chunks_signing_out', '1');
    sessionStorage.removeItem('chunks_was_here');
    sessionStorage.removeItem('chunks_active_screen');
    sessionStorage.removeItem('chunks_is_refresh');
    sessionStorage.removeItem('chunks_guest_mode');
    // Hard redirect to login
    window.location.replace('login.html');
  }

  // Try to sign out from Supabase, but redirect regardless of result
  try {
    const sb = await getSupabaseClient();
    if (sb) await sb.auth.signOut();
  } catch (e) {
    console.warn('[auth] signOut error (continuing with redirect):', e.message);
  }

  _doRedirect();
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
