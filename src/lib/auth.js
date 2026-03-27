// @ts-nocheck
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
import { API_BASE } from './api.js';

// ── User state ────────────────────────────────────────────────────────────────

/** @type {{ id:string|null, email:string, name:string, avatar:string, plan:string }|null} */
export let _currentUser = null;
export let _chunksSyncFired = false;
export let _presenceChannel = null;
export let _presenceHeartbeat = null;

// Set to true the moment chunksSignOut() fires — suppresses all UI updates
// so the user never sees a "Guest" flash while the page is navigating away.
let _signingOut = false;

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
  // No-op while signing out — page is already navigating to /login
  if (_signingOut) return;
  if (!user) {
    document.querySelectorAll('.profile-name').forEach(el => { el.textContent = 'Guest'; });
    document.querySelectorAll('.profile-plan').forEach(el => { el.textContent = 'Free Plan'; });
    // Clear avatar photo — neutral grey, no gradient bleed
    document.querySelectorAll('.avatar').forEach(el => {
      el.textContent = '?';
      el.classList.remove('has-initials');
      el.style.removeProperty('background-image');
      el.style.removeProperty('background-size');
      el.style.removeProperty('background-position');
      el.style.background = 'var(--surface-3)';
    });
    document.querySelectorAll('.pd-name').forEach(el => { el.textContent = ''; });
    document.querySelectorAll('.pd-handle').forEach(el => { el.textContent = ''; });
    document.querySelectorAll('.pd-avatar').forEach(el => {
      el.textContent = '?';
      el.classList.remove('has-initials');
      el.style.removeProperty('background-image');
      el.style.removeProperty('background-size');
      el.style.background = 'var(--surface-3)';
    });
    document.querySelectorAll('.mht-avatar, .mwt-avatar').forEach(el => {
      el.textContent = '?';
      el.classList.remove('has-initials');
      el.style.removeProperty('background-image');
      el.style.background = 'var(--surface-3)';
    });
    document.querySelectorAll('.md-profile-name').forEach(el => { el.textContent = 'Guest'; });
    document.querySelectorAll('.md-profile-plan').forEach(el => { el.textContent = 'Free Plan'; });
    document.querySelectorAll('.md-avatar').forEach(el => {
      el.textContent = '?';
      el.classList.remove('has-initials');
      el.style.removeProperty('background-image');
      el.style.background = 'var(--surface-3)';
    });
    // Hide the "..." dots — no profile menu for unauthenticated guests
    document.querySelectorAll('.profile-dots').forEach(el => { el.style.display = 'none'; });
    const adminBtn = document.getElementById('pd-admin-btn');
    if (adminBtn) adminBtn.style.display = 'none';
    // Guest mode: show upsell card, hide profile row and history
    document.querySelectorAll('.guest-upsell-card').forEach(el => { el.style.display = 'flex'; });
    document.querySelectorAll('.profile-row').forEach(el => { el.style.display = 'none'; });
    document.querySelectorAll('.sidebar-history-scroll').forEach(el => { el.style.display = 'none'; });
    return;
  }

  const initials = _initials(user.name, user.email);

  // Resolve owner/admin from cache immediately — before planLabel so the label is correct on first paint
  const _cachedAdminEarly = localStorage.getItem('chunks_admin_email');
  const _cachedOwnerEarly = localStorage.getItem('chunks_owner_email');
  const _isOwnerEarly = user.isOwner || (_cachedOwnerEarly && _cachedOwnerEarly === user.email);
  const _isAdminEarly = user.isAdmin || (_cachedAdminEarly && _cachedAdminEarly === user.email);

  const planLabel = _isOwnerEarly ? 'Owner'
                  : _isAdminEarly ? 'Admin'
                  : user.plan === 'ultra' ? 'Ultra Plan'
                  : user.plan === 'pro'   ? 'Pro Plan'
                  : user.plan === 'team'  ? 'Team Plan'
                  : 'Free Plan';

  // Restore dots (may have been hidden on sign-out)
  document.querySelectorAll('.profile-dots').forEach(el => { el.style.display = ''; });

  // Helper — sets avatar element to photo or initials, fully overriding any prior state
  function _setAvatar(el, avatar, fallbackText) {
    if (avatar) {
      el.classList.remove('has-initials');
      el.textContent = '';
      el.style.setProperty('background-image', 'url(' + avatar + ')');
      el.style.setProperty('background-size', 'cover');
      el.style.setProperty('background-position', 'center');
      el.style.setProperty('background-color', 'transparent');
      el.style.setProperty('background-repeat', 'no-repeat');
    } else {
      // Remove ALL inline background overrides so .has-initials CSS gradient shows
      el.classList.add('has-initials');
      el.style.removeProperty('background-image');
      el.style.removeProperty('background-size');
      el.style.removeProperty('background-position');
      el.style.removeProperty('background-color');
      el.style.removeProperty('background-repeat');
      el.style.removeProperty('background');
      el.textContent = fallbackText;
    }
  }

  // Sidebar footer — logged-in: show profile row, hide guest upsell card, show history
  document.querySelectorAll('.guest-upsell-card').forEach(el => { el.style.display = 'none'; });
  document.querySelectorAll('.profile-row').forEach(el => { el.style.removeProperty('display'); });
  document.querySelectorAll('.sidebar-history-scroll').forEach(el => { el.style.removeProperty('display'); });
  document.querySelectorAll('.profile-name').forEach(el => { el.textContent = user.name || user.email || 'User'; });
  document.querySelectorAll('.profile-plan').forEach(el => { el.textContent = planLabel; });
  document.querySelectorAll('.avatar').forEach(el => _setAvatar(el, user.avatar, initials));

  // Profile dropdown header
  document.querySelectorAll('.pd-name').forEach(el => { el.textContent = user.name || user.email || 'User'; });
  document.querySelectorAll('.pd-handle').forEach(el => { el.textContent = user.email || ''; });
  document.querySelectorAll('.pd-avatar').forEach(el => _setAvatar(el, user.avatar, initials));

  // Mobile topbar avatars
  document.querySelectorAll('.mht-avatar, .mwt-avatar').forEach(el => _setAvatar(el, user.avatar, initials));

  // Mobile drawer profile
  document.querySelectorAll('.md-profile-name').forEach(el => { el.textContent = user.name || user.email || 'User'; });
  document.querySelectorAll('.md-profile-plan').forEach(el => { el.textContent = planLabel; });
  document.querySelectorAll('.md-avatar').forEach(el => _setAvatar(el, user.avatar, initials));

  // Show/hide the admin button in ProfileDropdown if applicable.
  // Check both the user.isAdmin/isOwner flags AND the localStorage cache so the button
  // and label appear instantly on every _applyUI call without waiting for the backend.
  const cachedAdmin = localStorage.getItem('chunks_admin_email');
  const cachedOwner = localStorage.getItem('chunks_owner_email');
  const isAdminNow  = user.isAdmin || (cachedAdmin && cachedAdmin === user.email);
  const isOwnerNow  = user.isOwner || (cachedOwner && cachedOwner === user.email);
  if (isOwnerNow && _currentUser) { _currentUser.isOwner = true; _currentUser.isAdmin = true; }
  else if (isAdminNow && _currentUser) _currentUser.isAdmin = true;
  const adminBtn = document.getElementById('pd-admin-btn');
  if (adminBtn) adminBtn.style.display = (isAdminNow || isOwnerNow) ? '' : 'none';
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
      'chunks_default_book':              null,
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

// ── One-time guard: verify-access fires once per login, not on every auth event ──
let _adminCheckDone = false;

/**
 * Convert a Supabase session into window._currentUser and update UI.
 * Called by _initAuth and the onAuthStateChange listener.
 */
export function _applyUserProfile(session) {
  if (!session?.user) {
    _currentUser = null;
    _adminCheckDone = false;
    _applyUI(null);
    return;
  }
  // Clear guest mode — user is now authenticated
  try { sessionStorage.removeItem('chunks_guest_mode'); } catch(e) {}

  const u    = session.user;
  const meta = u.user_metadata || {};

  _currentUser = {
    id:      u.id,
    email:   u.email || '',
    name:    meta.full_name || meta.name || meta.display_name || u.email?.split('@')[0] || 'User',
    avatar:  (meta.avatar_url || meta.picture || '').replace(/^http:\/\//i, 'https://'),
    plan:    meta.plan || u.app_metadata?.plan || 'free',
    isAdmin: u.app_metadata?.role === 'admin' ||
             u.app_metadata?.role === 'owner' ||
             u.app_metadata?.role === 'superadmin' ||
             meta.is_admin === true ||
             meta.role === 'admin' ||
             meta.role === 'owner' ||
             meta.role === 'superadmin',
    isOwner: u.app_metadata?.role === 'owner' ||
             u.app_metadata?.role === 'superadmin' ||
             meta.role === 'owner' ||
             meta.role === 'superadmin',
  };

  _applyUI(_currentUser);

  // Fire verify-access ONCE per login only — not on every TOKEN_REFRESHED / re-render
  if (_adminCheckDone) return;
  _adminCheckDone = true;

  setTimeout(async () => {
    try {
      const sb = await getSupabaseClient();
      if (!sb) return;
      const { data: { session: s } } = await sb.auth.getSession();
      if (!s?.access_token) return;

      const res = await fetch(`${API_BASE}/api/admin/verify-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.access_token}` },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        // Non-admin or CORS error — clear caches silently, no console spam
        localStorage.removeItem('chunks_admin_email');
        localStorage.removeItem('chunks_owner_email');
        const adminBtn = document.getElementById('pd-admin-btn');
        if (adminBtn) adminBtn.style.display = 'none';
        return;
      }
      const data = await res.json();
      if (data.success && (data.role === 'admin' || data.role === 'owner' || data.role === 'superadmin')) {
        if (_currentUser) {
          _currentUser.isAdmin = true;
          _currentUser.isOwner = data.role === 'owner' || data.role === 'superadmin';
        }
        localStorage.setItem('chunks_admin_email', _currentUser.email);
        if (_currentUser.isOwner) localStorage.setItem('chunks_owner_email', _currentUser.email);
        else localStorage.removeItem('chunks_owner_email');
        const adminBtn = document.getElementById('pd-admin-btn');
        if (adminBtn) adminBtn.style.display = '';
        if (_currentUser) _applyUI(_currentUser);
      } else {
        localStorage.removeItem('chunks_admin_email');
        localStorage.removeItem('chunks_owner_email');
        const adminBtn = document.getElementById('pd-admin-btn');
        if (adminBtn) adminBtn.style.display = 'none';
      }
    } catch (_) {}
  }, 500);
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function _initAuth() {
  // ── Post-signout: clear flag ────────────────────────────────────────────
  // After chunksSignOut(), we redirect to /ChunksAI (homepage).
  // Clear the signing_out flag if it somehow persists on app.html load.
  if (sessionStorage.getItem('chunks_signing_out') === '1') {
    sessionStorage.removeItem('chunks_signing_out');
    sessionStorage.setItem('chunks_guest_mode', '1');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isGuest_         = sessionStorage.getItem('chunks_guest_mode') === '1';
  const isLoginPage_     = window.location.pathname === '/login';
  const hasOAuthCode_    = window.location.search.includes('code=');
  const hasOAuthHash_    = window.location.hash.includes('access_token');
  const isOAuthCallback_ = hasOAuthCode_ || hasOAuthHash_ ||
                           sessionStorage.getItem('chunks_oauth_callback') === '1';

  // ── Read cached session from localStorage ─────────────────────────────────
  // Used both for the instant gate and as a fallback if getSession() fails.
  let _cachedSession = null;
  let _cachedSessionValid = false;
  try {
    const raw = localStorage.getItem('chunks-ai-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      _cachedSession = parsed.access_token ? parsed
                     : parsed.currentSession ? parsed.currentSession
                     : null;
      if (_cachedSession?.access_token) {
        const nowSec    = Math.floor(Date.now() / 1000);
        const expiresAt = _cachedSession.expires_at || 0;
        // Valid if not expired (allow 60s clock-skew buffer)
        _cachedSessionValid = expiresAt === 0 || (expiresAt - nowSec > 60);
      }
    }
  } catch (e) { /* storage blocked or corrupt — fall through */ }

  // ── Instant gate: redirect to /login if definitely no session ────────────
  // Skip during OAuth callback — session hasn't been written yet.
  if (!isGuest_ && !isLoginPage_ && !isOAuthCallback_) {
    if (!_cachedSession || !_cachedSession.access_token) {
      window.location.replace('/ChunksAI');
      return;
    }
    // If session exists but is expired, fall through to let Supabase refresh it.
    // Do NOT redirect — the refresh may succeed.
  }
  // ─────────────────────────────────────────────────────────────────────────

  let sb;
  try { sb = await getSupabaseClient(); } catch (e) { return; }
  if (!sb) return;

  // 1. Restore existing session
  try {
    const { data: { session } } = await sb.auth.getSession();
    _applyUserProfile(session);

    // ── Sync user row on session restore (returning user / page refresh) ──
    if (session?.user) {
      const u    = session.user;
      const meta = u.user_metadata || {};
      const name = meta.full_name || meta.name || meta.display_name
                   || u.email?.split('@')[0] || 'User';
      const avatar = (meta.avatar_url || meta.picture || '').replace(/^http:\/\//i, 'https://');
      // Step 1: INSERT new user row if not exists (ignoreDuplicates:true = skip if email exists)
      sb.from('users').upsert(
        { email: u.email, full_name: name, avatar, plan: 'free', approved: true, paid: false,
          created_at: u.created_at || new Date().toISOString() },
        { onConflict: 'email', ignoreDuplicates: true }
      ).then(({ error: e1 }) => {
        if (e1) console.warn('[auth] insert new user failed:', e1.message);
        // Step 2: UPDATE display fields only (never touches plan/approved/paid)
        return sb.from('users').update({ full_name: name, avatar })
          .eq('email', u.email);
      }).then(({ error: e2 }) => {
        if (e2) console.warn('[auth] update display fields failed:', e2.message);
        else console.log('[auth] users row synced:', u.email);
      }).catch(() => {});
    }
    // ─────────────────────────────────────────────────────────────────────

    // Apply default settings for users who haven't been initialized yet
    if (session?.user) _applyDefaultSettings();

    // ── Phase 4: cross-device sync via SyncManager (run once per page load) ──
    if (session?.user && !_chunksSyncFired) {
      _chunksSyncFired = true;  // prevent duplicate calls from TOKEN_REFRESHED etc.
      (async () => {
        try {
          const sb2 = await getSupabaseClient();
          if (sb2) await sb2.rpc('ensure_user_settings', { p_user_id: session.user.id });
        } catch (_) { /* non-fatal — row may already exist */ }
        // Small delay so the page has painted, then force-sync bypassing cooldown
        setTimeout(() => {
          import('./syncManager.js').then(({ SyncManager }) => {
            SyncManager.loginSync?.({ force: true }).catch(() => {
              _chunksSyncFired = false;
            });
          }).catch(() => { _chunksSyncFired = false; });
        }, 200);
      })();
    }
    // ─────────────────────────────────────────────────────────────────────

    // ── Auth gate ────────────────────────────────────────────────────────
    const isGuest     = sessionStorage.getItem('chunks_guest_mode') === '1';
    const isLoginPage = window.location.pathname === '/login';
    const isOAuthCb   = window.location.search.includes('code=') ||
                        window.location.hash.includes('access_token') ||
                        window.location.hash.includes('error_description') ||
                        sessionStorage.getItem('chunks_oauth_callback') === '1';

    // Consider authenticated if:
    //   a) getSession() returned a live session, OR
    //   b) getSession() returned null but localStorage has a valid cached session
    //      (this happens when /api/config fetch fails or takes too long and the
    //      Supabase client is initialised with wrong/missing credentials)
    const isAuthed = !!session?.user || _cachedSessionValid;

    if (!isAuthed && !isGuest && !isLoginPage && !isOAuthCb) {
      window.location.replace('/ChunksAI');
      return;
    }

    // Clear the OAuth callback flag once we have a confirmed session
    if (session?.user || _cachedSessionValid) {
      try { sessionStorage.removeItem('chunks_oauth_callback'); } catch(e) {}
      // Also clear guest mode — a real session takes precedence
      try { sessionStorage.removeItem('chunks_guest_mode'); } catch(e) {}
      // Fix URL if _navInit() already pushed a /guest prefix before auth resolved
      try {
        if (window.location.pathname.startsWith('/guest')) {
          const fixed = window.location.pathname.replace(/^\/guest/, '') || '/home';
          window.history.replaceState(window.history.state, '', fixed);
        }
      } catch(e) {}
    }

    // ── Popup self-close (step 1 path) ───────────────────────────────────
    // getSession() exchanges ?code= directly (PKCE), so SIGNED_IN in
    // onAuthStateChange may never fire. Close the popup here instead.
    if (isOAuthCb && session?.user && window.opener && !window.opener.closed) {
      try { window.opener.postMessage('chunks_auth_success', 'https://chunks.online'); } catch(_) {}
      setTimeout(() => window.close(), 100);
      return;
    }
    // ─────────────────────────────────────────────────────────────────────
  } catch (e) {
    console.warn('[auth] getSession failed:', e.message);
  }

  // 2. Listen for future auth changes
  sb.auth.onAuthStateChange((_event, session) => {
    // Skip applying null profile on SIGNED_OUT during a page that has a valid
    // cached session — prevents "Guest" flash when Supabase fires intermediate events
    if (!session?.user && _cachedSessionValid && _event !== 'SIGNED_OUT') return;
    _applyUserProfile(session);

    // ── Register / sync user row in public users table ────────────────────
    // Every sign-in (new or returning) upserts a row so the admin panel
    // always has an up-to-date record. ignoreDuplicates:false so name/avatar
    // updates from Google are reflected, but plan/approved are never
    // overwritten (onConflict only touches the columns we specify).
    if ((_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') && session?.user) {
      const u    = session.user;
      const meta = u.user_metadata || {};
      const name = meta.full_name || meta.name || meta.display_name
                   || u.email?.split('@')[0] || 'User';
      const avatar = (meta.avatar_url || meta.picture || '').replace(/^http:\/\//i, 'https://');
      // Step 1: INSERT if new user (ignoreDuplicates:true = safe no-op for existing)
      sb.from('users').upsert(
        { email: u.email, full_name: name, avatar, plan: 'free', approved: true, paid: false,
          created_at: u.created_at || new Date().toISOString() },
        { onConflict: 'email', ignoreDuplicates: true }
      ).then(({ error: e1 }) => {
        if (e1) console.warn('[auth] insert new user failed:', e1.message);
        // Step 2: UPDATE only display fields (never overwrites plan/approved/paid)
        return sb.from('users').update({ full_name: name, avatar })
          .eq('email', u.email);
      }).then(({ error: e2 }) => {
        if (e2) console.warn('[auth] users upsert failed:', e2.message);
        else console.log('[auth] users row synced for', u.email);
      }).catch(e => console.warn('[auth] users upsert error:', e.message));
    }
    // ─────────────────────────────────────────────────────────────────────

    // ── After OAuth/magic-link redirect back, clear flag and clean URL ─────
    if (_event === 'SIGNED_IN') {
      // Clear OAuth callback flag now that session is confirmed
      try { sessionStorage.removeItem('chunks_oauth_callback'); } catch(e) {}
      // Apply default settings for new users (no-op if already initialized)
      _applyDefaultSettings();

      // Phase 4: full login sync — guarded by _chunksSyncFired (set in session restore)
      if (session?.user && !_chunksSyncFired) {
        _chunksSyncFired = true;
        (async () => {
          try {
            const sb2 = await getSupabaseClient();
            if (sb2) await sb2.rpc('ensure_user_settings', { p_user_id: session.user.id });
          } catch (_) {}
          setTimeout(() => {
            import('./syncManager.js').then(({ SyncManager }) => {
              SyncManager.loginSync?.({ force: true }).catch(() => {
                _chunksSyncFired = false;
              });
            }).catch(() => { _chunksSyncFired = false; });
          }, 200);
        })();
      }

      const isLoginPage = window.location.pathname === '/login';
      if (isLoginPage) {
        window.location.replace('/home');
        return;
      }

      // ── Popup self-close: if this page was opened as the OAuth popup ──────
      // When redirect_to=/home and we're inside a window.open() popup,
      // notify the opener and close — the opener handles navigating to /home.
      if (window.opener && !window.opener.closed) {
        try { window.opener.postMessage('chunks_auth_success', 'https://chunks.online'); } catch(_) {}
        setTimeout(() => window.close(), 100);
        return;
      }
      // ─────────────────────────────────────────────────────────────────────

      // Clean up OAuth params from the URL now that exchange is complete.
      // We deliberately did NOT strip these in navigation.js so Supabase could
      // read them. Now that SIGNED_IN has fired, we can safely clean the URL.
      try {
        const hasOAuthInUrl = window.location.hash.includes('access_token') ||
                              window.location.search.includes('code=');
        if (hasOAuthInUrl) {
          window.history.replaceState({ screen: 'home' }, '', '/home');
        } else if (window.location.pathname.startsWith('/guest')) {
          // Fix URL if _navInit() pushed a /guest prefix before auth resolved
          const fixed = window.location.pathname.replace(/^\/guest/, '') || '/home';
          window.history.replaceState(window.history.state, '', fixed);
        }
      } catch(e) {}

      // Give ChunksDB's DOMContentLoaded patcher time to run first
      setTimeout(() => {
        import('../state/flash/index.js').then(m => m._fcRenderDeckList?.()).catch(() => {});
      }, 600);
    }
    // ────────────────────────────────────────────────────────────────────

    if (_event === 'SIGNED_OUT') {
      _currentUser = null;
      // Leave presence channel on sign out
      if (_presenceChannel) {
        try { sb.removeChannel(_presenceChannel); } catch(_) {}
        _presenceChannel = null;
      }
    }
  });

  // ── Presence tracking — broadcasts this user to admin panel ──────────────
  // Runs after auth is confirmed. Tracks both signed-in users and guests.
  _trackPresence(sb);
}

async function _trackPresence(sb) {
  try {
    const isGuest = sessionStorage.getItem('chunks_guest_mode') === '1';
    const isLoginPage = window.location.pathname === '/login';
    if (isLoginPage) return; // don't track on login page

    // Clean up any existing presence channel
    if (_presenceChannel) {
      try { sb.removeChannel(_presenceChannel); } catch(_) {}
    }

    const channel = sb.channel('app-presence', {
      config: { presence: { key: Math.random().toString(36).slice(2) } }
    });

    const presenceData = isGuest
      ? { type: 'guest', ts: Date.now() }
      : {
          type:  'user',
          email: _currentUser?.email || '',
          plan:  _currentUser?.plan  || 'free',
          ts:    Date.now(),
        };

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(presenceData);
      }
    });

    _presenceChannel = channel;

    // Re-track every 4 minutes to keep presence fresh (Supabase presence
    // entries expire after ~5 minutes without a heartbeat)
    if (_presenceHeartbeat) clearInterval(_presenceHeartbeat);
    _presenceHeartbeat = setInterval(async () => {
      try {
        if (_presenceChannel) {
          await _presenceChannel.track({
            ...presenceData,
            ts: Date.now(),
          });
        }
      } catch(_) {}
    }, 4 * 60 * 1000);

  } catch(e) {
    console.warn('[auth] Presence tracking failed:', e.message);
  }
}

// ── Sign out ──────────────────────────────────────────────────────────────────

export async function chunksSignOut() {
  // Set the flag immediately — suppresses all _applyUI calls triggered by
  // the Supabase SIGNED_OUT event that fires when sb.auth.signOut() runs.
  _signingOut = true;

  // Phase 4: flush all pending writes before redirecting (max 3s wait)
  try {
    const { SyncManager } = await import('./syncManager.js');
    await SyncManager?.flushBeforeSignOut?.();
  } catch (_) {}

  // Clean up state and storage BEFORE redirecting so the user never sees
  // a "Guest" flash — the page navigates away before any re-render happens.
  function _cleanAndRedirect() {
    // Clear all state
    _currentUser = null;

    // ── Wipe ALL user-scoped localStorage data ────────────────────────────────
    // Previously only 5 pointer keys were cleared, leaving behind chat sessions,
    // settings, streak data, workspace positions, and recent items.  When a
    // second account logged in on the same browser it inherited the first user's
    // full history — a privacy and correctness bug.
    //
    // Strategy: collect every key that starts with a known user-data prefix,
    // then delete them all.  We do NOT use localStorage.clear() because that
    // would also wipe Supabase's own auth token keys (sb-*-auth-token) which
    // the SDK needs to complete the server-side signOut call that fires below.
    try {
      const USER_PREFIXES = [
        'chunks_session_',       // chat sessions (r+timestamp and UUID variants)
        'chunks_ws_session_',    // workspace chat sessions
        'chunks_ws_page_',       // per-book page position
        'chunks_ws_zoom_',       // per-book zoom level
        'chunks_ws_visited_',    // per-book last-visited timestamp
        'chunks_setting_',       // all settings keys
        'chunks_fc_',            // flashcard streak, XP, freeze tokens, accent, mastery
        'fc_streak_data',        // legacy streak key
        'fc_streak_last_study',  // legacy streak key
      ];
      const EXACT_KEYS = [
        'chunks-ai-auth',            // our cached session copy — must be cleared so the auth gate re-enters guest mode
        'chunks_recent',
        'chunks_active_home_session',
        'chunks_active_ws_book',
        'chunks_active_recent_id',
        'chunks_admin_email',
        'chunks_owner_email',
        'chunks_default_book',
        'chunks_home_session',
        'chunks_pending_upload_sessions',
        'chunks_deleted_sessions',
        'chunks_settings_initialized',
        'chunks_settings_updated_at',
        'chunks_ws_last_visited',
        'chunks-chat-font-size',
        'chunks_improve_data',
        'chunks_study_mode',
        'chunks_chunksSyncFired',
      ];

      // Collect prefix-matched keys first (can't mutate while iterating)
      const prefixKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && USER_PREFIXES.some(p => k.startsWith(p))) prefixKeys.push(k);
      }
      prefixKeys.forEach(k => localStorage.removeItem(k));
      EXACT_KEYS.forEach(k => localStorage.removeItem(k));
    } catch (_) { /* storage may be blocked in some environments */ }

    // Clear sessionStorage
    sessionStorage.setItem('chunks_signing_out', '1');
    sessionStorage.removeItem('chunks_was_here');
    sessionStorage.removeItem('chunks_active_screen');
    sessionStorage.removeItem('chunks_is_refresh');
    sessionStorage.removeItem('chunks_guest_mode');
    sessionStorage.removeItem('chunks_oauth_callback');

    // Reset the sync-fired flag so the next login triggers a fresh pull
    _chunksSyncFired = false;

    // Navigate to /ChunksAI (marketing homepage) after sign-out
    // The homepage has its own guest experience via the login CTA.
    window.location.replace('/ChunksAI');
  }

  // Fire-and-forget Supabase signOut — don't await it before redirecting
  // to avoid any delay. The session will be invalidated server-side.
  try {
    getSupabaseClient().then(sb => { if (sb) sb.auth.signOut({ scope: 'local' }); }).catch(() => {});
  } catch (e) {}

  _cleanAndRedirect();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
// Run _initAuth after the DOM is ready (supabase.js client may not be
// initialised until after the page parses).

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initAuth);
} else {
  _initAuth();
}

console.log('[auth] module loaded ✦');
