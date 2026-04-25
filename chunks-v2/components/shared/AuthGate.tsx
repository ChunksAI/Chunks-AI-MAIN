'use client';

/**
 * components/shared/AuthGate.tsx — Client-side auth guard for protected routes.
 *
 * The app uses @supabase/supabase-js which stores sessions in localStorage,
 * not cookies, so the Edge middleware cannot verify auth state.
 * This component reads from AuthContext (which bootstraps from Supabase /
 * localStorage on mount) and automatically enters guest mode for unauthenticated
 * visitors — allowing them to use the app immediately without a login redirect.
 *
 * Guest users (user.isGuest === true) are allowed through — they have a non-null
 * user object provided by AuthContext after enterGuestMode() is called.
 *
 * ⚠️  Security model — IMPORTANT for contributors
 * ─────────────────────────────────────────────────
 * This component is a UX gate, NOT a security barrier.
 * A caller who bypasses the browser UI can reach any Next.js API route directly.
 *
 * All paid/pro/admin/private operations MUST be enforced by the FastAPI backend:
 *  • Verify the Supabase JWT (Authorization: Bearer <token>) server-side.
 *  • Check role/tier via /api/verify-access before granting access.
 *  • Never trust AuthContext values (user.tier, user.isAdmin, user.isGuest) as
 *    a security control — they are read from localStorage and can be tampered
 *    with by the browser.
 *
 * Usage:
 *   export default function ProtectedPage() {
 *     return <AuthGate><PageContent /></AuthGate>;
 *   }
 */

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, enterGuestMode } = useAuth();

  // Auto-enter guest mode so users land directly in the app without a
  // login redirect.  They can sign in via the modal in the sidebar.
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      enterGuestMode();
    }
  }, [user, isLoading, enterGuestMode]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'var(--text2)',
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
