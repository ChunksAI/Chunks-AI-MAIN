'use client';

/**
 * contexts/AuthContext.tsx — user authentication state
 *
 * Wraps the Supabase auth session and exposes a typed user object.
 * The AuthProvider should be placed high in the component tree (app/Providers.tsx)
 * so every page can call useAuth() to read user info or signOut.
 *
 * Features:
 *  - Magic Link + Google OAuth sign-in
 *  - Guest mode (isGuest: true) — unauthenticated users can use limited features
 *  - Plan/tier lookup from backend /api/verify-access
 *  - Admin/owner detection (isAdmin, isOwner) via backend response
 *  - Default settings written to localStorage on first sign-in
 *
 * ⚠️  Security model — IMPORTANT for contributors
 * ─────────────────────────────────────────────────
 * The fields on AuthUser (isGuest, tier, isAdmin, isOwner) are cached in
 * localStorage and resolved client-side.  They are suitable for UX decisions
 * (what to show in the UI) but MUST NOT be used as a security enforcement point:
 * a user can modify localStorage to claim any tier or role.
 *
 * All paid/admin/private actions must be authorised by the FastAPI backend:
 *  • Include `Authorization: Bearer <session.access_token>` on every sensitive call.
 *  • The backend verifies the JWT and checks tier/role via /api/verify-access.
 *  • Never gate a backend operation solely on a client-side AuthUser field.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  tier: 'free' | 'pro' | 'ultra';
  isGuest: boolean;
  isAdmin: boolean;
  isOwner: boolean;
}

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Guest user constant ──────────────────────────────────────────────────────

const GUEST_USER: AuthUser = {
  id: 'guest',
  email: '',
  name: 'Guest',
  tier: 'free',
  isGuest: true,
  isAdmin: false,
  isOwner: false,
};

// ─── Default settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Record<string, string> = {
  'chunks-chat-font-size':           'small',
  'chunks_setting_appearance':       'light',
  'chunks_setting_language':         'Auto-detect',
  'chunks_setting_spoken-language':  'Auto-detect',
  'chunks_setting_voice':            'Maple',
  'chunks_setting_notif-study':      '1',
  'chunks_setting_notif-flashcard':  '1',
  'chunks_setting_notif-library':    '0',
  'chunks_setting_notif-updates':    '0',
  'chunks_study_mode':               'balanced',
  'chunks_setting_followups':        '1',
  'chunks_setting_auto-flash':       '0',
  'chunks_improve_data':             '1',
  'chunks_setting_safe-content':     '0',
};

function applyDefaultSettings() {
  try {
    if (localStorage.getItem('chunks_settings_initialized') === '1') return;
    Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
    localStorage.setItem('chunks_settings_initialized', '1');
  } catch {
    // localStorage may be unavailable (SSR, private mode)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sessionToUser(session: Session): AuthUser {
  const u = session.user;
  const meta = (u.user_metadata ?? {}) as Record<string, string>;
  // Try to read plan from cached localStorage (populated by fetchUserPlan)
  let tier: AuthUser['tier'] = 'free';
  try {
    const cached = localStorage.getItem('chunks_user_tier');
    // Migrate legacy tier values that no longer exist on the backend.
    const migrated =
      cached === 'premium' || cached === 'paid' ? 'pro' :
      cached === 'team' ? 'pro' :
      cached;
    if (migrated && (['free', 'pro', 'ultra'] as const).includes(migrated as AuthUser['tier'])) {
      tier = migrated as AuthUser['tier'];
      // Write back the migrated value so the stale entry is corrected.
      if (migrated !== cached) localStorage.setItem('chunks_user_tier', migrated);
    }
  } catch { /* ignore */ }

  let isAdmin = false;
  let isOwner = false;
  try {
    const cachedAdmin = localStorage.getItem('chunks_admin_email');
    const cachedOwner = localStorage.getItem('chunks_owner_email');
    const email = u.email ?? '';
    if (cachedOwner && cachedOwner === email) { isOwner = true; isAdmin = true; }
    else if (cachedAdmin && cachedAdmin === email) { isAdmin = true; }
  } catch { /* ignore */ }

  return {
    id: u.id,
    email: u.email ?? '',
    name: meta.full_name ?? meta.name ?? (u.email?.split('@')[0] ?? 'Student'),
    avatar: meta.avatar_url,
    tier,
    isGuest: false,
    isAdmin,
    isOwner,
  };
}

/** Fetch the real plan/tier + admin status from the backend. */
async function fetchUserPlan(
  session: Session,
  apiBase: string,
): Promise<{ tier: AuthUser['tier']; isAdmin: boolean; isOwner: boolean }> {
  try {
    const res = await fetch(`${apiBase}/api/verify-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return { tier: 'free', isAdmin: false, isOwner: false };
    const data = (await res.json()) as {
      tier?: string;
      role?: string;
      is_admin?: boolean;
      is_owner?: boolean;
    };
    // Normalise the tier string from the backend.
    // Map legacy 'paid' → 'pro' so old DB rows don't fall back to 'free'.
    const rawTier = data.tier ?? '';
    const normalisedTier =
      rawTier === 'paid' || rawTier === 'premium' ? 'pro' :
      rawTier === 'team' ? 'pro' :
      rawTier;
    const tier = (['free', 'pro', 'ultra'] as const).includes(
      normalisedTier as AuthUser['tier'],
    )
      ? (normalisedTier as AuthUser['tier'])
      : 'free';
    const isOwner = data.is_owner === true || data.role === 'owner';
    const isAdmin = isOwner || data.is_admin === true || data.role === 'admin';

    // Cache for instant restore on next page load
    try {
      localStorage.setItem('chunks_user_tier', tier);
      if (isOwner) localStorage.setItem('chunks_owner_email', session.user.email ?? '');
      if (isAdmin) localStorage.setItem('chunks_admin_email', session.user.email ?? '');
    } catch { /* ignore */ }

    return { tier, isAdmin, isOwner };
  } catch {
    return { tier: 'free', isAdmin: false, isOwner: false };
  }
}

// Returns '; Secure' when the page is served over HTTPS so the guest cookie is
// not transmitted over plain HTTP in production.
function guestCookieSecureFlag(): string {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
  });

  // Guest mode flag — stored in sessionStorage so it resets when the tab closes
  // Initialized to false to match SSR; real value loaded in useEffect to avoid hydration mismatch
  const [guestMode, setGuestMode] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  const [apiBase] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const injected = (window as unknown as Record<string, unknown>).CHUNKS_BACKEND_URL;
      if (typeof injected === 'string' && injected) return injected;
    }
    return process.env.NEXT_PUBLIC_API_URL ?? 'https://api.chunks.online';
  });

  // Restore guest mode from sessionStorage after mount (avoids SSR/hydration mismatch).
  // Also re-set the cookie so that an expired 24-hour cookie doesn't leave the user
  // stuck: the middleware only reads the cookie, so refreshing it here ensures
  // subsequent navigations to protected routes pass through correctly.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('chunks_guest_mode') === '1') {
        document.cookie = `chunks_guest=1; path=/; max-age=86400; SameSite=Lax${guestCookieSecureFlag()}`;
        setGuestMode(true);
      }
    } catch { /* sessionStorage may be unavailable in private browsing or restricted environments */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeFn: (() => void) | undefined;

    async function init() {
      try {
        const sb = await getSupabaseClient();

        // Restore existing session
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!cancelled) {
          if (session) {
            const user = sessionToUser(session);
            setState({ user, session, isLoading: false });
            // Fetch real plan in background — updates state once resolved
            void fetchUserPlan(session, apiBase).then(({ tier, isAdmin, isOwner }) => {
              if (cancelled) return;
              setState((s) => ({
                ...s,
                user: s.user && !s.user.isGuest
                  ? { ...s.user, tier, isAdmin, isOwner }
                  : s.user,
              }));
            });
          } else {
            setState({ user: null, session: null, isLoading: false });
          }
        }

        // Listen for auth state changes (sign-in, sign-out, token refresh)
        const {
          data: { subscription },
        } = sb.auth.onAuthStateChange((_event, newSession) => {
          if (cancelled) return;
          if (newSession) {
            const user = sessionToUser(newSession);
            setState({ user, session: newSession, isLoading: false });
            // Apply default settings on first sign-in
            applyDefaultSettings();
            // Fetch plan in background
            void fetchUserPlan(newSession, apiBase).then(({ tier, isAdmin, isOwner }) => {
              if (cancelled) return;
              setState((s) => ({
                ...s,
                user: s.user && !s.user.isGuest
                  ? { ...s.user, tier, isAdmin, isOwner }
                  : s.user,
              }));
            });
            // Clear guest mode on successful sign-in
            try { sessionStorage.removeItem('chunks_guest_mode'); } catch { /* ignore */ }
            try { document.cookie = `chunks_guest=; path=/; max-age=0; SameSite=Lax${guestCookieSecureFlag()}`; } catch { /* ignore */ }
            setGuestMode(false);
          } else {
            setState({ user: null, session: null, isLoading: false });
          }
        });

        unsubscribeFn = () => subscription.unsubscribe();
      } catch {
        if (!cancelled) setState((s) => ({ ...s, isLoading: false }));
      }
    }

    void init();

    return () => {
      cancelled = true;
      unsubscribeFn?.();
    };
  }, [apiBase]);

  const signOut = useCallback(async () => {
    const sb = await getSupabaseClient();

    // ── Purge auth-related localStorage keys ─────────────────────────────────
    for (const key of ['chunks_user_tier', 'chunks_admin_email', 'chunks_owner_email', 'chunks_settings_initialized']) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
    // Remove all chunks_setting_* keys (user preferences written by SettingsContext)
    try {
      const keysToRemove = Object.keys(localStorage).filter((k) => k.startsWith('chunks_setting_'));
      for (const key of keysToRemove) {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    // ── Purge sessionStorage ──────────────────────────────────────────────────
    try { sessionStorage.removeItem('chunks_guest_mode'); } catch { /* ignore */ }

    // ── Clear guest cookie ────────────────────────────────────────────────────
    try { document.cookie = `chunks_guest=; path=/; max-age=0; SameSite=Lax${guestCookieSecureFlag()}`; } catch { /* ignore */ }

    // ── Sign out from Supabase — AuthGate will auto-enter guest mode ────────
    await sb.auth.signOut();
  }, []);

  const enterGuestMode = useCallback(() => {
    try { sessionStorage.setItem('chunks_guest_mode', '1'); } catch { /* ignore */ }
    try { document.cookie = `chunks_guest=1; path=/; max-age=86400; SameSite=Lax${guestCookieSecureFlag()}`; } catch { /* ignore */ }
    setGuestMode(true);
  }, []);

  const exitGuestMode = useCallback(() => {
    try { sessionStorage.removeItem('chunks_guest_mode'); } catch { /* ignore */ }
    try { document.cookie = `chunks_guest=; path=/; max-age=0; SameSite=Lax${guestCookieSecureFlag()}`; } catch { /* ignore */ }
    setGuestMode(false);
  }, []);

  const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

  // Resolved user: authenticated > guest > null
  const resolvedUser = state.user ?? (guestMode ? GUEST_USER : null);

  return (
    <AuthContext.Provider
      value={{ ...state, user: resolvedUser, signOut, enterGuestMode, exitGuestMode, isLoginModalOpen, openLoginModal, closeLoginModal }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
