'use client';

/**
 * components/review/ReviewFlashcards.tsx — Step 2 of the review session.
 *
 * Reads the most recently generated flashcard deck for the session topic from
 * workspaceSections and presents it with SM-2 quality ratings (Again / Hard /
 * Good / Easy).  Tracks per-card ratings locally and shows a summary when all
 * cards have been rated.
 */

import { useState } from 'react';
import { useStudy } from '@/contexts/StudyContext';
import { useReviewSession } from '@/hooks/useReviewSession';
import type { Flashcard } from '@/types/api';

type SRSRating = 0 | 3 | 4 | 5;
type RatingLabel = 'again' | 'hard' | 'good' | 'easy';

const RATING_MAP: Record<RatingLabel, SRSRating> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        padding: 32,
        boxShadow: 'var(--shadow-md)',
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '60%',
          height: 14,
          borderRadius: 6,
          backgroundImage:
            'linear-gradient(90deg, var(--surface2) 25%, var(--surface) 50%, var(--surface2) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s ease infinite',
        }}
      />
      <div
        style={{
          width: '80%',
          height: 20,
          borderRadius: 6,
          backgroundImage:
            'linear-gradient(90deg, var(--surface2) 25%, var(--surface) 50%, var(--surface2) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s ease infinite',
        }}
      />
    </div>
  );
}

// ─── Rating button ────────────────────────────────────────────────────────────

interface RatingButtonProps {
  label: string;
  emoji: string;
  color: string;
  bg: string;
  onClick: () => void;
}

function RatingButton({ label, emoji, color, bg, onClick }: RatingButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minHeight: 44,
        background: 'var(--surface2)',
        border: `1px solid var(--border)`,
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text2)',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.background = bg;
        btn.style.color = color;
        btn.style.borderColor = color;
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.background = 'var(--surface2)';
        btn.style.color = 'var(--text2)';
        btn.style.borderColor = 'var(--border)';
      }}
    >
      {emoji} {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReviewFlashcards() {
  const { state } = useStudy();
  const { session, handleAdvanceReviewStep } = useReviewSession();

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<number, SRSRating>>({});
  const [done, setDone] = useState(false);

  if (!session) return null;

  // ── Find the most recent flashcard deck for this topic ─────────────────────
  const flashcardSection = state.workspaceSections.find((s) => s.title === 'Flashcard Decks');
  const deckCard = flashcardSection?.cards
    .filter((c) => c.title.toLowerCase().includes(session.topic.toLowerCase()))
    .at(-1);

  const cards: Flashcard[] = deckCard?.flashcards ?? [];

  // ── Loading / error states ─────────────────────────────────────────────────
  if (!session.flashcardsReady) return <CardSkeleton />;

  if (session.flashcardsReady && cards.length === 0) {
    return (
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: 32,
          boxShadow: 'var(--shadow-md)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
          Could not load flashcards
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
          The flashcard deck could not be found for "{session.topic}".
        </div>
        <button
          onClick={handleAdvanceReviewStep}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius)',
            height: 44,
            padding: '0 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Skip to Quiz →
        </button>
      </div>
    );
  }

  const card = cards[index];
  const isLast = index === cards.length - 1;

  // ── Done summary ───────────────────────────────────────────────────────────
  if (done) {
    const ratingValues = Object.values(ratings);
    const easyCount = ratingValues.filter((r) => r === RATING_MAP.easy).length;
    const goodCount = ratingValues.filter((r) => r === RATING_MAP.good).length;
    const hardCount = ratingValues.filter((r) => r === RATING_MAP.hard).length;
    const againCount = ratingValues.filter((r) => r === RATING_MAP.again).length;

    return (
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: 32,
          boxShadow: 'var(--shadow-md)',
          textAlign: 'center',
          animation: 'fadeUp 0.3s ease',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Flashcards complete!
        </div>
        <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24 }}>
          {cards.length} cards reviewed
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 20,
            marginBottom: 28,
            flexWrap: 'wrap',
          }}
        >
          {easyCount > 0 && (
            <span style={{ color: 'var(--accent2)', fontSize: 13 }}>😊 Easy: {easyCount}</span>
          )}
          {goodCount > 0 && (
            <span style={{ color: 'var(--accent)', fontSize: 13 }}>🤔 Good: {goodCount}</span>
          )}
          {hardCount > 0 && (
            <span style={{ color: 'var(--danger)', fontSize: 13 }}>😓 Hard: {hardCount}</span>
          )}
          {againCount > 0 && (
            <span style={{ color: 'var(--danger)', fontSize: 13 }}>🔄 Again: {againCount}</span>
          )}
        </div>

        <button
          onClick={handleAdvanceReviewStep}
          style={{
            background: 'var(--accent2)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius)',
            height: 48,
            padding: '0 28px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
            maxWidth: 280,
          }}
        >
          Continue to Quiz →
        </button>
      </div>
    );
  }

  // ── Card view ──────────────────────────────────────────────────────────────
  const progress = Math.round(((index + 1) / cards.length) * 100);

  const handleRate = (label: RatingLabel) => {
    const quality = RATING_MAP[label];
    const newRatings = { ...ratings, [index]: quality };
    setRatings(newRatings);

    if (isLast) {
      setDone(true);
      return;
    }

    setFlipped(false);
    setIndex((i) => i + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Progress */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13,
          color: 'var(--text3)',
        }}
      >
        <span>
          {index + 1} / {cards.length} cards
        </span>
        <span>{Object.values(ratings).filter((r) => r >= 4).length} mastered</span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 4,
          background: 'var(--surface2)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--accent2)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Card */}
      <div
        className={`flashcard-card-wrap${flipped ? ' flipped' : ''}`}
        onClick={() => setFlipped((f) => !f)}
        style={{ cursor: 'pointer' }}
      >
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

      {/* Rating buttons — shown only after flip */}
      {flipped && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            animation: 'fadeUp 0.2s ease',
          }}
        >
          <RatingButton
            label="Again"
            emoji="🔄"
            color="var(--danger)"
            bg="var(--danger-light)"
            onClick={() => handleRate('again')}
          />
          <RatingButton
            label="Hard"
            emoji="😓"
            color="var(--danger)"
            bg="var(--danger-light)"
            onClick={() => handleRate('hard')}
          />
          <RatingButton
            label="Good"
            emoji="🤔"
            color="var(--accent)"
            bg="var(--accent-light)"
            onClick={() => handleRate('good')}
          />
          <RatingButton
            label="Easy"
            emoji="😊"
            color="var(--accent2)"
            bg="var(--accent2-light)"
            onClick={() => handleRate('easy')}
          />
        </div>
      )}

      {!flipped && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text3)',
            paddingTop: 4,
          }}
        >
          Click the card to reveal the answer, then rate your recall
        </div>
      )}
    </div>
  );
}
