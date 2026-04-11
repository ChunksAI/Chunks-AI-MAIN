'use client';

import { useState } from 'react';
import { useFlashcards } from '@/contexts/FlashcardsContext';
import CardEditor from './CardEditor';
import type { SRSCard } from '@/lib/srsAlgorithm';
import { getMasteryPercent } from '@/lib/srsAlgorithm';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * DeckDetail — shows all cards in a deck with management controls.
 */
export default function DeckDetail() {
  const {
    activeDeckId,
    activeDeck,
    activeDeckCards,
    activeDeckDueCards,
    getMastery,
    deleteCard,
    exportDeck,
    importDeck,
    setStudyMode,
    setActiveDeckId,
  } = useFlashcards();

  const [showAddEditor, setShowAddEditor] = useState(false);
  const [editingCard, setEditingCard] = useState<SRSCard | null>(null);

  if (!activeDeckId || !activeDeck) return null;

  const mastery = getMastery(activeDeckId);
  const totalCards = activeDeckCards.length;
  const masteredCount = activeDeckCards.filter((c) => c.repetitions >= 3).length;
  const dueCount = activeDeckDueCards.length;
  const avgEase = totalCards > 0
    ? Math.round((activeDeckCards.reduce((s, c) => s + c.easeFactor, 0) / totalCards) * 100) / 100
    : 2.5;

  const handleExport = () => {
    const csv = exportDeck(activeDeckId);
    triggerDownload(`${activeDeck.title.replace(/\s+/g, '_')}.csv`, csv);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csv = ev.target?.result as string;
      const count = importDeck(activeDeckId, csv);
      alert(`Imported ${count} card${count !== 1 ? 's' : ''}.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="deck-detail">
      {/* ── Header ── */}
      <div className="deck-detail-header">
        <button
          className="deck-back-btn"
          onClick={() => setActiveDeckId(null)}
          aria-label="Back to deck library"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          All Decks
        </button>
        <h2 className="deck-detail-title">{activeDeck.title}</h2>
        {activeDeck.description && (
          <p className="deck-detail-desc">{activeDeck.description}</p>
        )}
      </div>

      {/* ── Stats row ── */}
      <div className="deck-stats-row">
        <div className="deck-stat">
          <div className="deck-stat-value">{totalCards}</div>
          <div className="deck-stat-label">Total</div>
        </div>
        <div className="deck-stat">
          <div className="deck-stat-value" style={{ color: 'var(--accent2)' }}>{masteredCount}</div>
          <div className="deck-stat-label">Mastered</div>
        </div>
        <div className="deck-stat">
          <div className="deck-stat-value" style={{ color: dueCount > 0 ? 'var(--accent)' : 'var(--text3)' }}>{dueCount}</div>
          <div className="deck-stat-label">Due</div>
        </div>
        <div className="deck-stat">
          <div className="deck-stat-value">{avgEase}</div>
          <div className="deck-stat-label">Avg Ease</div>
        </div>
        <div className="deck-stat">
          <div className="deck-stat-value" style={{ color: 'var(--accent2)' }}>{mastery}%</div>
          <div className="deck-stat-label">Mastery</div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="deck-detail-actions">
        <button
          className="ws-add-btn"
          onClick={() => setStudyMode('study')}
          disabled={totalCards === 0}
        >
          📖 Study All
        </button>
        {dueCount > 0 && (
          <button
            className="ws-add-btn"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={() => setStudyMode('due-only')}
          >
            🎯 Study Due ({dueCount})
          </button>
        )}
        <button className="panel-btn" onClick={() => setShowAddEditor((v) => !v)}>
          + Add Card
        </button>
        <button className="panel-btn" onClick={handleExport}>
          ↓ Export CSV
        </button>
        <label className="panel-btn" style={{ cursor: 'pointer' }}>
          ↑ Import CSV
          <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
        </label>
      </div>

      {/* ── Add card editor ── */}
      {showAddEditor && (
        <CardEditor
          deckId={activeDeckId}
          onDone={() => setShowAddEditor(false)}
        />
      )}

      {/* ── Edit card editor ── */}
      {editingCard && (
        <CardEditor
          deckId={activeDeckId}
          card={editingCard}
          onDone={() => setEditingCard(null)}
        />
      )}

      {/* ── Card list ── */}
      {totalCards === 0 ? (
        <div className="deck-detail-empty">
          <div style={{ fontSize: 36, marginBottom: 12 }}>🃏</div>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>No cards yet</div>
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>
            Add your first card using the button above.
          </div>
        </div>
      ) : (
        <div className="card-list">
          {activeDeckCards.map((card) => (
            <div key={card.id} className="card-list-row">
              <div className="card-list-fronts">
                <div className="card-list-front">{card.front}</div>
                <div className="card-list-back">{card.back.length > 80 ? `${card.back.slice(0, 80)}…` : card.back}</div>
              </div>
              <div className="card-list-meta">
                <span className={`card-list-due${card.repetitions === 0 ? ' new' : ''}`}>
                  {card.repetitions === 0 ? 'New' : formatDate(card.nextReview)}
                </span>
                <span className="card-list-reps">×{card.repetitions}</span>
              </div>
              <div className="card-list-btns">
                <button
                  className="icon-btn"
                  onClick={() => setEditingCard(card)}
                  aria-label={`Edit "${card.front}"`}
                >
                  ✏️
                </button>
                <button
                  className="icon-btn"
                  onClick={() => deleteCard(activeDeckId, card.id)}
                  aria-label={`Delete "${card.front}"`}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
