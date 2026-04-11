'use client';

import { useEffect, useState } from 'react';
import type { Flashcard } from '@/types/api';

interface FlashcardDeckProps {
  title: string;
  cards: Flashcard[];
  onClose: () => void;
}

type Rating = 'easy' | 'ok' | 'hard';

/**
 * FlashcardDeck — interactive flashcard study experience.
 * User flips each card and rates it (Easy / OK / Hard) to track mastery.
 * Supports keyboard shortcuts: Space/Enter to flip, 1=Hard, 2=OK, 3=Easy.
 */
export default function FlashcardDeck({ title, cards, onClose }: FlashcardDeckProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [done, setDone] = useState(false);

  const card = cards[index];
  const isLast = index === cards.length - 1;
  const mastered = Object.values(ratings).filter((r) => r === 'easy').length;
  const progress = Math.round(((index + 1) / cards.length) * 100);

  const handleRating = (rating: Rating) => {
    const newRatings = { ...ratings, [index]: rating };
    setRatings(newRatings);
    if (isLast) {
      setDone(true);
      return;
    }
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  // Keyboard shortcuts: Space/Enter = flip, 1 = Hard, 2 = OK, 3 = Easy
  useEffect(() => {
    if (done) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (flipped) {
        if (e.key === '1') handleRating('hard');
        if (e.key === '2') handleRating('ok');
        if (e.key === '3') handleRating('easy');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, done, index, isLast, ratings]);

  if (done) {
    const total = cards.length;
    return (
      <div className="flashcard-deck">
        <div className="flashcard-done">
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500 }}>
            Deck complete!
          </div>
          <div style={{ color: 'var(--text2)', marginTop: 8 }}>
            {mastered} / {total} mastered
          </div>
          <div className="flashcard-done-bars">
            <span style={{ color: 'var(--accent2)' }}>
              😊 Easy: {Object.values(ratings).filter((r) => r === 'easy').length}
            </span>
            <span style={{ color: 'var(--accent)' }}>
              🤔 OK: {Object.values(ratings).filter((r) => r === 'ok').length}
            </span>
            <span style={{ color: 'var(--danger)' }}>
              😓 Hard: {Object.values(ratings).filter((r) => r === 'hard').length}
            </span>
          </div>
          <button className="ws-add-btn" style={{ marginTop: 20 }} onClick={onClose}>
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcard-deck">
      {/* ── Header ── */}
      <div className="flashcard-header">
        <div className="flashcard-title">{title}</div>
        <div className="flashcard-progress-text">
          {index + 1} / {cards.length} · {mastered} mastered
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close flashcards">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
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

      {/* ── Rating buttons (shown only after flip) ── */}
      {flipped && (
        <div className="flashcard-ratings">
          <button className="rating-btn rating-hard" onClick={() => handleRating('hard')}>
            😓 Hard
          </button>
          <button className="rating-btn rating-ok" onClick={() => handleRating('ok')}>
            🤔 OK
          </button>
          <button className="rating-btn rating-easy" onClick={() => handleRating('easy')}>
            😊 Easy
          </button>
        </div>
      )}
    </div>
  );
}
