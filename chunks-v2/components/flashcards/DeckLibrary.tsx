'use client';

import { useState } from 'react';
import { useFlashcards } from '@/contexts/FlashcardsContext';
import { getDueCards, getMasteryPercent } from '@/lib/srsAlgorithm';
import type { SRSDeck } from '@/lib/srsAlgorithm';

function getDeckColor(title: string): string {
  const COLORS = ['#4A7C59', '#C4923A', '#3A5FC4', '#9B59B6', '#C4503A', '#2C8C99', '#1A5276'];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash * 31) + title.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * DeckLibrary — landing view showing all flashcard decks with due-today banner.
 */
export default function DeckLibrary() {
  const {
    decks,
    cards,
    getDueCards: ctxGetDueCards,
    getMastery,
    addDeck,
    deleteDeck,
    setActiveDeckId,
    setStudyMode,
  } = useFlashcards();

  const [showNewDeckForm, setShowNewDeckForm] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [newDeckError, setNewDeckError] = useState<string | null>(null);

  // Count total due cards across all decks
  const totalDue = getDueCards(cards).length;

  const handleCreateDeck = () => {
    if (!newDeckTitle.trim()) { setNewDeckError('Deck name is required.'); return; }
    setNewDeckError(null);
    const deck = addDeck({
      id: `deck-${Date.now()}`,
      title: newDeckTitle.trim(),
      description: newDeckDesc.trim() || undefined,
    });
    setShowNewDeckForm(false);
    setNewDeckTitle('');
    setNewDeckDesc('');
    // Navigate into the new deck
    setActiveDeckId(deck.id);
  };

  const handleStudyAllDue = () => {
    // Study due cards across all decks — we need to navigate to study mode
    // with the first deck that has due cards
    for (const deck of decks) {
      const due = ctxGetDueCards(deck.id);
      if (due.length > 0) {
        setActiveDeckId(deck.id);
        setStudyMode('due-only');
        return;
      }
    }
  };

  const handleDeleteDeck = (deck: SRSDeck, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${deck.title}" and all its cards? This cannot be undone.`)) return;
    deleteDeck(deck.id);
  };

  return (
    <div className="deck-library">
      {/* ── Header ── */}
      <div className="deck-library-header">
        <h1 className="deck-library-title">Flashcards</h1>
        <button
          className="ws-add-btn"
          onClick={() => setShowNewDeckForm((v) => !v)}
        >
          + Create Deck
        </button>
      </div>

      {/* ── New deck form ── */}
      {showNewDeckForm && (
        <div className="new-deck-form">
          {newDeckError && <div className="card-editor-error">{newDeckError}</div>}
          <input
            className="card-editor-input"
            type="text"
            placeholder="Deck name (e.g. Organic Chemistry)"
            value={newDeckTitle}
            onChange={(e) => setNewDeckTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateDeck()}
            autoFocus
          />
          <input
            className="card-editor-input"
            type="text"
            placeholder="Description (optional)"
            value={newDeckDesc}
            onChange={(e) => setNewDeckDesc(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ws-add-btn" onClick={handleCreateDeck}>Create</button>
            <button className="icon-btn" onClick={() => setShowNewDeckForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Due today banner ── */}
      {totalDue > 0 && (
        <div className="due-today-banner">
          <div className="due-today-text">
            <span className="due-today-badge">{totalDue}</span>
            card{totalDue !== 1 ? 's' : ''} due today
          </div>
          <button className="ws-add-btn due-today-btn" onClick={handleStudyAllDue}>
            Study Due Cards →
          </button>
        </div>
      )}

      {/* ── Deck grid ── */}
      {decks.length === 0 ? (
        <div className="deck-library-empty">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🃏</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No decks yet</div>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>
            Create your first deck to start studying with spaced repetition.
          </div>
          <button className="ws-add-btn" onClick={() => setShowNewDeckForm(true)}>
            + Create Deck
          </button>
        </div>
      ) : (
        <div className="deck-grid">
          {decks.map((deck) => {
            const deckCards = cards.filter((c) => c.deckId === deck.id);
            const mastery = getMastery(deck.id);
            const due = ctxGetDueCards(deck.id).length;
            const color = getDeckColor(deck.title);

            return (
              <button
                key={deck.id}
                className="deck-card"
                onClick={() => setActiveDeckId(deck.id)}
                aria-label={`Open deck: ${deck.title}`}
              >
                {/* Color swatch */}
                <div className="deck-card-swatch" style={{ background: color }} />

                <div className="deck-card-body">
                  <div className="deck-card-title">{deck.title}</div>
                  <div className="deck-card-count">
                    {deckCards.length} card{deckCards.length !== 1 ? 's' : ''}
                    {due > 0 && (
                      <span className="deck-due-badge">{due} due</span>
                    )}
                  </div>

                  {/* Mastery progress bar */}
                  <div className="deck-mastery-bar">
                    <div className="deck-mastery-fill" style={{ width: `${mastery}%`, background: color }} />
                  </div>
                  <div className="deck-mastery-label">{mastery}% mastered</div>

                  <div className="deck-card-footer">
                    <span className="deck-last-studied">
                      Created {formatDate(deck.createdAt)}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="deck-action-btn"
                        onClick={(e) => { e.stopPropagation(); setActiveDeckId(deck.id); setStudyMode('study'); }}
                        disabled={deckCards.length === 0}
                        title="Study this deck"
                      >
                        📖 Study
                      </button>
                      <button
                        className="deck-action-btn deck-action-danger"
                        onClick={(e) => handleDeleteDeck(deck, e)}
                        title="Delete deck"
                      >
                        ⋯
                      </button>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
