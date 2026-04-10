'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import type { ReactNode } from 'react';

/**
 * app/Providers.tsx — client-side provider wrapper for app/layout.tsx.
 *
 * layout.tsx is a server component so it cannot hold client context providers
 * directly. This thin client wrapper owns AuthProvider (and any future
 * top-level providers) so the layout stays a server component.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
