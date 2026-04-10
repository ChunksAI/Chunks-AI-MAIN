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
  tier: 'free' | 'pro' | 'premium' | 'ultra' | 'team';
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
    const cached = localStorage.getItem('chunks_user_tier') as AuthUser['tier'] | null;
    if (cached && ['free', 'pro', 'premium', 'ultra', 'team'].includes(cached)) {
      tier = cached;
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
    const tier = (['free', 'pro', 'premium', 'ultra', 'team'] as const).includes(
      data.tier as AuthUser['tier'],
    )
      ? (data.tier as AuthUser['tier'])
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

  const [apiBase] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const injected = (window as unknown as Record<string, unknown>).CHUNKS_BACKEND_URL;
      if (typeof injected === 'string' && injected) return injected;
    }
    return process.env.NEXT_PUBLIC_API_URL ?? 'https://api.chunks.online';
  });

  // Restore guest mode from sessionStorage after mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    try {
      setGuestMode(sessionStorage.getItem('chunks_guest_mode') === '1');
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
    try { localStorage.removeItem('chunks_user_tier'); } catch { /* ignore */ }
    await sb.auth.signOut();
  }, []);

  const enterGuestMode = useCallback(() => {
    try { sessionStorage.setItem('chunks_guest_mode', '1'); } catch { /* ignore */ }
    setGuestMode(true);
  }, []);

  const exitGuestMode = useCallback(() => {
    try { sessionStorage.removeItem('chunks_guest_mode'); } catch { /* ignore */ }
    setGuestMode(false);
  }, []);

  // Resolved user: authenticated > guest > null
  const resolvedUser = state.user ?? (guestMode ? GUEST_USER : null);

  return (
    <AuthContext.Provider
      value={{ ...state, user: resolvedUser, signOut, enterGuestMode, exitGuestMode }}
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
