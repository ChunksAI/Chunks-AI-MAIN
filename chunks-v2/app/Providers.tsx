'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { QuizProvider } from '@/contexts/QuizContext';
import { NotesProvider } from '@/contexts/NotesContext';
import { StudyProvider } from '@/contexts/StudyContext';
import { FlashcardsProvider } from '@/contexts/FlashcardsContext';
import { ToastProvider } from '@/contexts/ToastContext';
import SettingsModal from '@/components/shared/SettingsModal';
import ToastHost from '@/components/ToastHost';
import type { ReactNode } from 'react';

/**
 * app/Providers.tsx — client-side provider wrapper for app/layout.tsx.
 *
 * layout.tsx is a server component so it cannot hold client context providers
 * directly. This thin client wrapper owns all context providers so the layout
 * stays a server component.
 *
 * Provider nesting order (outer → inner):
 *   ToastProvider → AuthProvider → SettingsProvider → ChatProvider →
 *   QuizProvider → NotesProvider → StudyProvider → FlashcardsProvider
 *
 * ToastProvider is outermost so any provider — including AuthProvider — can
 * fire toast notifications (e.g. on auth error or session expiry).
 *
 * ChatProvider, QuizProvider, and NotesProvider must all be ancestors of
 * StudyProvider because StudyProvider calls useChatContext(), useQuizContext(),
 * and useNotesContext() internally to read and write their slices of state.
 *
 * StudyProvider is global so state (book selection, messages, workspace)
 * persists as users navigate between Library, Research, Study, and Flashcards.
 *
 * FlashcardsProvider is global so SRS decks and study-mode persist across pages.
 *
 * SettingsModal and ToastHost are rendered here so they are always in the DOM
 * tree regardless of which page/route is active.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <ChatProvider>
            <QuizProvider>
              <NotesProvider>
                <StudyProvider>
                  <FlashcardsProvider>
                    {children}
                  </FlashcardsProvider>
                  {/* Global modals — always available regardless of current route */}
                  <SettingsModal />
                </StudyProvider>
              </NotesProvider>
            </QuizProvider>
          </ChatProvider>
        </SettingsProvider>
      </AuthProvider>
      {/* Global toast notifications — rendered outside auth so auth errors show too */}
      <ToastHost />
    </ToastProvider>
  );
}
