'use client';

import { useState } from 'react';
import { useFlashcards } from '@/contexts/FlashcardsContext';
import type { SRSQuality } from '@/lib/srsAlgorithm';
import { getMasteryPercent } from '@/lib/srsAlgorithm';

/**
 * StudySession — SM-2 study interface for a flashcard deck.
 *
 * Shows cards one by one. User flips the card, then rates their recall:
 *   - Again (quality 0): card goes back to the front of the queue
 *   - Hard  (quality 3)
 *   - OK    (quality 4)
 *   - Easy  (quality 5)
 * Done screen shows mastery delta (before vs after session).
 */
export default function StudySession() {
  const {
    activeDeckId,
    activeDeck,
    studyMode,
    activeDeckCards,
    activeDeckDueCards,
    rateCard,
    setStudyMode,
  } = useFlashcards();

  const sourceCards = studyMode === 'due-only' ? activeDeckDueCards : activeDeckCards;

  // Mastery snapshot before session starts
  const [masteryBefore] = useState(() => getMasteryPercent(activeDeckCards));

  // Queue: copy of cards to study. "Again" re-appends the card.
  const [queue, setQueue] = useState(() => [...sourceCards]);
  const [sessionRatings, setSessionRatings] = useState<Record<string, SRSQuality>>({});
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  if (!activeDeckId || !activeDeck) {
    return (
      <div className="flashcard-deck">
        <div className="flashcard-done">
          <div style={{ fontSize: 32, marginBottom: 12 }}>😕</div>
          <div>No deck selected.</div>
        </div>
      </div>
    );
  }

  if (sourceCards.length === 0) {
    return (
      <div className="flashcard-deck">
        <div className="flashcard-done">
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500 }}>
            Nothing due!
          </div>
          <div style={{ color: 'var(--text2)', marginTop: 8, marginBottom: 20 }}>
            All cards are up to date. Check back later.
          </div>
          <button className="ws-add-btn" onClick={() => setStudyMode('browse')}>
            Back to Deck
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    const masteryAfter = getMasteryPercent(activeDeckCards);
    const delta = masteryAfter - masteryBefore;
    return (
      <div className="flashcard-deck">
        <div className="flashcard-done">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500 }}>
            Session complete!
          </div>
          <div style={{ color: 'var(--text2)', marginTop: 8 }}>
            {Object.keys(sessionRatings).length} cards reviewed
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 24, justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent2)' }}>
                {masteryAfter}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Mastery</div>
            </div>
            {delta !== 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: delta > 0 ? 'var(--accent2)' : 'var(--danger)' }}>
                  {delta > 0 ? '+' : ''}{delta}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Change</div>
              </div>
            )}
          </div>
          <div className="flashcard-done-bars" style={{ marginTop: 20 }}>
            <span style={{ color: 'var(--accent2)' }}>
              😊 Easy: {Object.values(sessionRatings).filter((r) => r === 5).length}
            </span>
            <span style={{ color: 'var(--accent)' }}>
              🤔 OK: {Object.values(sessionRatings).filter((r) => r === 4).length}
            </span>
            <span style={{ color: 'var(--danger)' }}>
              😓 Hard: {Object.values(sessionRatings).filter((r) => r === 3).length}
            </span>
          </div>
          <button className="ws-add-btn" style={{ marginTop: 20 }} onClick={() => setStudyMode('browse')}>
            Back to Deck
          </button>
        </div>
      </div>
    );
  }

  const card = queue[0];
  if (!card) {
    setDone(true);
    return null;
  }

  const progress = Math.round((1 - queue.length / Math.max(sourceCards.length, 1)) * 100);

  const handleRate = (quality: SRSQuality) => {
    rateCard(activeDeckId, card.id, quality);
    setSessionRatings((prev) => ({ ...prev, [card.id]: quality }));

    if (quality === 0) {
      // "Again" — push card to end of queue (excluding this occurrence)
      setQueue((prev) => [...prev.slice(1), card]);
    } else {
      setQueue((prev) => prev.slice(1));
    }

    if (queue.length === 1 && quality !== 0) {
      setDone(true);
    }

    setFlipped(false);
  };

  return (
    <div className="flashcard-deck">
      {/* ── Header ── */}
      <div className="flashcard-header">
        <div className="flashcard-title">{activeDeck.title}</div>
        <div className="flashcard-progress-text">
          {Math.max(0, sourceCards.length - queue.length + 1)} / {sourceCards.length}
        </div>
        <button
          className="icon-btn"
          onClick={() => setStudyMode('browse')}
          aria-label="Exit study session"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Progress bar ── */}
      <div className="quiz-progress-bar">
        <div className="quiz-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* ── Card ── */}
      <div className="flashcard-card-wrap" onClick={() => setFlipped((f) => !f)}>
        <div className={`flashcard-card${flipped ? ' flipped' : ''}`}>
          <div className="flashcard-face flashcard-front">
            <span className="flashcard-label">QUESTION</span>
            <div className="flashcard-text">{card.front}</div>
            {card.hint && <div className="flashcard-hint">💡 {card.hint}</div>}
            <div className="flashcard-tap-hint">Tap to reveal answer →</div>
          </div>
          <div className="flashcard-face flashcard-back">
            <span className="flashcard-label">ANSWER</span>
            <div className="flashcard-text">{card.back}</div>
          </div>
        </div>
      </div>

      {/* ── Rating buttons (shown after flip) ── */}
      {flipped && (
        <div className="flashcard-ratings">
          <button className="rating-btn rating-hard" onClick={() => handleRate(0)}>
            🔄 Again
          </button>
          <button className="rating-btn rating-hard" onClick={() => handleRate(3)}>
            😓 Hard
          </button>
          <button className="rating-btn rating-ok" onClick={() => handleRate(4)}>
            🤔 OK
          </button>
          <button className="rating-btn rating-easy" onClick={() => handleRate(5)}>
            😊 Easy
          </button>
        </div>
      )}
    </div>
  );
}
