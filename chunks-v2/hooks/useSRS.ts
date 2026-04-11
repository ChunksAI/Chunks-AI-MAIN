'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  computeNextReview,
  getDueCards as _getDueCards,
  getMasteryPercent,
  exportCardsToCsv,
  parseCsvToCards,
} from '@/lib/srsAlgorithm';
import type { SRSCard, SRSDeck, SRSQuality } from '@/lib/srsAlgorithm';
import { SRS_STORAGE_KEY } from '@/lib/constants';

// ─── Storage shape ────────────────────────────────────────────────────────────

interface SRSStore {
  decks: SRSDeck[];
  cards: SRSCard[];
}

function loadStore(): SRSStore {
  if (typeof window === 'undefined') return { decks: [], cards: [] };
  try {
    const raw = localStorage.getItem(SRS_STORAGE_KEY);
    if (!raw) return { decks: [], cards: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as SRSStore).decks) &&
      Array.isArray((parsed as SRSStore).cards)
    ) {
      return parsed as SRSStore;
    }
    return { decks: [], cards: [] };
  } catch {
    return { decks: [], cards: [] };
  }
}

function saveStore(store: SRSStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota errors — persistence is best-effort
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseSRSResult {
  decks: SRSDeck[];
  cards: SRSCard[];
  getDueCards: (deckId?: string) => SRSCard[];
  getMastery: (deckId: string) => number;
  rateCard: (deckId: string, cardId: string, quality: SRSQuality) => void;
  addDeck: (deck: Omit<SRSDeck, 'createdAt' | 'updatedAt'>) => SRSDeck;
  addCard: (deckId: string, card: Omit<SRSCard, 'id' | 'deckId' | 'easeFactor' | 'interval' | 'repetitions' | 'nextReview' | 'createdAt' | 'updatedAt'>) => SRSCard;
  editCard: (deckId: string, cardId: string, updates: Partial<Pick<SRSCard, 'front' | 'back' | 'hint'>>) => void;
  deleteCard: (deckId: string, cardId: string) => void;
  deleteDeck: (deckId: string) => void;
  importDeck: (deckId: string, csv: string) => number;
  exportDeck: (deckId: string) => string;
}

export function useSRS(): UseSRSResult {
  const [store, setStore] = useState<SRSStore>({ decks: [], cards: [] });

  // Load from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    setStore(loadStore());
  }, []);

  const persist = useCallback((next: SRSStore) => {
    setStore(next);
    saveStore(next);
  }, []);

  const getDueCards = useCallback(
    (deckId?: string) => {
      const subset = deckId ? store.cards.filter((c) => c.deckId === deckId) : store.cards;
      return _getDueCards(subset);
    },
    [store.cards],
  );

  const getMastery = useCallback(
    (deckId: string) => {
      const deckCards = store.cards.filter((c) => c.deckId === deckId);
      return getMasteryPercent(deckCards);
    },
    [store.cards],
  );

  const rateCard = useCallback(
    (deckId: string, cardId: string, quality: SRSQuality) => {
      const next = {
        ...store,
        cards: store.cards.map((c) => {
          if (c.id !== cardId || c.deckId !== deckId) return c;
          return computeNextReview(c, quality);
        }),
      };
      persist(next);
    },
    [store, persist],
  );

  const addDeck = useCallback(
    (deckData: Omit<SRSDeck, 'createdAt' | 'updatedAt'>): SRSDeck => {
      const now = new Date().toISOString();
      const deck: SRSDeck = { ...deckData, createdAt: now, updatedAt: now };
      persist({ ...store, decks: [...store.decks, deck] });
      return deck;
    },
    [store, persist],
  );

  const addCard = useCallback(
    (
      deckId: string,
      cardData: Omit<SRSCard, 'id' | 'deckId' | 'easeFactor' | 'interval' | 'repetitions' | 'nextReview' | 'createdAt' | 'updatedAt'>,
    ): SRSCard => {
      const now = new Date().toISOString();
      const card: SRSCard = {
        ...cardData,
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        deckId,
        easeFactor: 2.5,
        interval: 1,
        repetitions: 0,
        nextReview: now,
        createdAt: now,
        updatedAt: now,
      };
      persist({ ...store, cards: [...store.cards, card] });
      return card;
    },
    [store, persist],
  );

  const editCard = useCallback(
    (deckId: string, cardId: string, updates: Partial<Pick<SRSCard, 'front' | 'back' | 'hint'>>) => {
      const now = new Date().toISOString();
      const next = {
        ...store,
        cards: store.cards.map((c) =>
          c.id === cardId && c.deckId === deckId
            ? { ...c, ...updates, updatedAt: now }
            : c,
        ),
      };
      persist(next);
    },
    [store, persist],
  );

  const deleteCard = useCallback(
    (deckId: string, cardId: string) => {
      persist({
        ...store,
        cards: store.cards.filter((c) => !(c.id === cardId && c.deckId === deckId)),
      });
    },
    [store, persist],
  );

  const deleteDeck = useCallback(
    (deckId: string) => {
      persist({
        decks: store.decks.filter((d) => d.id !== deckId),
        cards: store.cards.filter((c) => c.deckId !== deckId),
      });
    },
    [store, persist],
  );

  const importDeck = useCallback(
    (deckId: string, csv: string): number => {
      const now = new Date().toISOString();
      const parsed = parseCsvToCards(csv, deckId);
      const newCards: SRSCard[] = parsed.map((c) => ({
        ...c,
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: now,
        updatedAt: now,
      }));
      persist({ ...store, cards: [...store.cards, ...newCards] });
      return newCards.length;
    },
    [store, persist],
  );

  const exportDeck = useCallback(
    (deckId: string): string => {
      const deckCards = store.cards.filter((c) => c.deckId === deckId);
      return exportCardsToCsv(deckCards);
    },
    [store.cards],
  );

  return {
    decks: store.decks,
    cards: store.cards,
    getDueCards,
    getMastery,
    rateCard,
    addDeck,
    addCard,
    editCard,
    deleteCard,
    deleteDeck,
    importDeck,
    exportDeck,
  };
}
