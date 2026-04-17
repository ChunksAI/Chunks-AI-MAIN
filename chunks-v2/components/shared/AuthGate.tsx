'use client';

/**
 * components/shared/AuthGate.tsx — Client-side auth guard for protected routes.
 *
 * The app uses @supabase/supabase-js which stores sessions in localStorage,
 * not cookies, so the Edge middleware cannot verify auth state.
 * This component reads from AuthContext (which bootstraps from Supabase /
 * localStorage on mount) and redirects unauthenticated visitors to /login.
 *
 * Guest users (user.isGuest === true) are allowed through — they have a non-null
 * user object provided by AuthContext after enterGuestMode() is called.
 *
 * Usage:
 *   export default function ProtectedPage() {
 *     return <AuthGate><PageContent /></AuthGate>;
 *   }
 */

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, isLoading, router, pathname]);

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
