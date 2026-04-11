'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import SettingsModal from '@/components/shared/SettingsModal';
import type { ReactNode } from 'react';

/**
 * app/Providers.tsx — client-side provider wrapper for app/layout.tsx.
 *
 * layout.tsx is a server component so it cannot hold client context providers
 * directly. This thin client wrapper owns AuthProvider + SettingsProvider
 * (and any future top-level providers) so the layout stays a server component.
 *
 * SettingsModal is rendered here so it is always in the DOM tree regardless
 * of which page/route is active.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SettingsProvider>
        {children}
        {/* Global modals — always available regardless of current route */}
        <SettingsModal />
      </SettingsProvider>
    </AuthProvider>
  );
}
