'use client';

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { useSRS } from '@/hooks/useSRS';
import type { UseSRSResult } from '@/hooks/useSRS';
import type { SRSCard, SRSDeck } from '@/lib/srsAlgorithm';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FlashcardsStudyMode = 'browse' | 'study' | 'due-only';

interface FlashcardsContextValue extends UseSRSResult {
  // UI state
  activeDeckId: string | null;
  setActiveDeckId: (id: string | null) => void;
  studyMode: FlashcardsStudyMode;
  setStudyMode: (mode: FlashcardsStudyMode) => void;
  currentCardIndex: number;
  setCurrentCardIndex: (index: number) => void;

  // Derived helpers
  activeDeck: SRSDeck | null;
  activeDeckCards: SRSCard[];
  activeDeckDueCards: SRSCard[];
}

const FlashcardsContext = createContext<FlashcardsContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FlashcardsProvider({ children }: { children: ReactNode }) {
  const srs = useSRS();

  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [studyMode, setStudyMode] = useState<FlashcardsStudyMode>('browse');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const activeDeck = activeDeckId ? (srs.decks.find((d) => d.id === activeDeckId) ?? null) : null;
  const activeDeckCards = activeDeckId ? srs.cards.filter((c) => c.deckId === activeDeckId) : [];
  const activeDeckDueCards = activeDeckId ? srs.getDueCards(activeDeckId) : [];

  const value: FlashcardsContextValue = {
    ...srs,
    activeDeckId,
    setActiveDeckId: (id) => {
      setActiveDeckId(id);
      setCurrentCardIndex(0);
      setStudyMode('browse');
    },
    studyMode,
    setStudyMode: (mode) => {
      setStudyMode(mode);
      setCurrentCardIndex(0);
    },
    currentCardIndex,
    setCurrentCardIndex,
    activeDeck,
    activeDeckCards,
    activeDeckDueCards,
  };

  return <FlashcardsContext.Provider value={value}>{children}</FlashcardsContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFlashcards(): FlashcardsContextValue {
  const ctx = useContext(FlashcardsContext);
  if (!ctx) throw new Error('useFlashcards must be used within FlashcardsProvider');
  return ctx;
}
