'use client';

/**
 * contexts/AuthContext.tsx — user authentication state
 *
 * Wraps the Supabase auth session and exposes a typed user object.
 * The AuthProvider should be placed high in the component tree (app/Providers.tsx)
 * so every page can call useAuth() to read user info or signOut.
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
  tier: 'free' | 'pro' | 'premium';
  isGuest: boolean;
}

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sessionToUser(session: Session): AuthUser {
  const u = session.user;
  const meta = (u.user_metadata ?? {}) as Record<string, string>;
  return {
    id: u.id,
    email: u.email ?? '',
    name: meta.full_name ?? meta.name ?? (u.email?.split('@')[0] ?? 'Student'),
    avatar: meta.avatar_url,
    tier: 'free', // updated via /api/me/plan in a production extension
    isGuest: false,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
  });

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
          setState({ user: session ? sessionToUser(session) : null, session, isLoading: false });
        }

        // Listen for auth state changes (sign-in, sign-out, token refresh)
        const {
          data: { subscription },
        } = sb.auth.onAuthStateChange((_event, newSession) => {
          if (cancelled) return;
          setState({
            user: newSession ? sessionToUser(newSession) : null,
            session: newSession,
            isLoading: false,
          });
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
  }, []);

  const signOut = useCallback(async () => {
    const sb = await getSupabaseClient();
    await sb.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signOut }}>
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
