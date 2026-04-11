'use client';

import { useFlashcards } from '@/contexts/FlashcardsContext';
import DeckLibrary from '@/components/flashcards/DeckLibrary';
import DeckDetail from '@/components/flashcards/DeckDetail';
import StudySession from '@/components/flashcards/StudySession';
import Sidebar from '@/components/study/layout/Sidebar';
import { useStudy } from '@/contexts/StudyContext';
import { useRouter } from 'next/navigation';

export default function FlashcardsPage() {
  const { activeDeckId, studyMode } = useFlashcards();
  const { state, handleResetSession } = useStudy();
  const router = useRouter();

  return (
    <div className="app-shell">
      <Sidebar
        activeNav="flashcards"
        onNavChange={(id) => {
          if (id === 'study') router.push('/study');
        }}
        onNewSession={handleResetSession}
        recents={state.recents}
      />

      <main className="main">
        <div className="flashcards-page">
          {studyMode === 'study' || studyMode === 'due-only' ? (
            <StudySession />
          ) : activeDeckId ? (
            <DeckDetail />
          ) : (
            <DeckLibrary />
          )}
        </div>
      </main>
    </div>
  );
}
