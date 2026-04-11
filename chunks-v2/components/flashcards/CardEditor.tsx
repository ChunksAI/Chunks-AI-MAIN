'use client';

import { useState, useRef } from 'react';
import { useFlashcards } from '@/contexts/FlashcardsContext';
import type { SRSCard } from '@/lib/srsAlgorithm';

interface CardEditorProps {
  deckId: string;
  card?: SRSCard; // When provided, editing an existing card
  onDone: () => void;
}

/**
 * CardEditor — inline form for creating or editing a flashcard.
 *
 * Normal mode: two textareas (Front / Back) plus an optional Hint input.
 * Batch mode: single textarea with `---` separator between cards.
 */
export default function CardEditor({ deckId, card, onDone }: CardEditorProps) {
  const { addCard, editCard } = useFlashcards();

  const [front, setFront] = useState(card?.front ?? '');
  const [back, setBack] = useState(card?.back ?? '');
  const [hint, setHint] = useState(card?.hint ?? '');
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const frontRef = useRef<HTMLTextAreaElement>(null);

  const handleSingle = () => {
    if (!front.trim()) { setError('Front is required.'); return; }
    if (!back.trim()) { setError('Back is required.'); return; }
    setError(null);

    if (card) {
      editCard(deckId, card.id, { front: front.trim(), back: back.trim(), hint: hint.trim() || undefined });
    } else {
      addCard(deckId, { front: front.trim(), back: back.trim(), hint: hint.trim() || undefined });
    }
    onDone();
  };

  const handleBatch = () => {
    if (!batchText.trim()) { setError('Enter at least one card.'); return; }
    setError(null);

    const blocks = batchText.split(/---+/);
    let added = 0;
    for (const block of blocks) {
      const lines = block.trim().split('\n').filter(Boolean);
      if (lines.length < 2) continue;
      addCard(deckId, { front: lines[0].trim(), back: lines[1].trim(), hint: lines[2]?.trim() });
      added++;
    }
    if (added === 0) { setError('No valid cards found. Use --- to separate cards.'); return; }
    onDone();
  };

  return (
    <div className="card-editor">
      <div className="card-editor-header">
        <span className="card-editor-title">{card ? 'Edit Card' : 'Add Card'}</span>
        <button
          className={`card-editor-toggle${batchMode ? ' active' : ''}`}
          onClick={() => setBatchMode((v) => !v)}
          title={batchMode ? 'Switch to single card' : 'Switch to batch mode (---)'}
        >
          {batchMode ? '1️⃣ Single' : '📦 Batch'}
        </button>
      </div>

      {error && (
        <div className="card-editor-error">{error}</div>
      )}

      {batchMode ? (
        <div className="card-editor-fields">
          <label className="card-editor-label">
            Cards (separate with <code>---</code>)
          </label>
          <textarea
            className="card-editor-textarea card-editor-batch"
            placeholder={"What is mitosis?\nCell division producing two identical daughter cells\n---\nWhat is meiosis?\nCell division producing four genetically unique cells"}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            rows={8}
          />
        </div>
      ) : (
        <div className="card-editor-fields">
          <label className="card-editor-label">Front (Question)</label>
          <textarea
            ref={frontRef}
            className="card-editor-textarea"
            placeholder="Enter the question or term…"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={3}
          />
          <label className="card-editor-label">Back (Answer)</label>
          <textarea
            className="card-editor-textarea"
            placeholder="Enter the answer or definition…"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            rows={3}
          />
          <label className="card-editor-label">Hint (optional)</label>
          <input
            className="card-editor-input"
            type="text"
            placeholder="Optional memory aid…"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
          />
        </div>
      )}

      <div className="card-editor-actions">
        <button
          className="ws-add-btn"
          onClick={batchMode ? handleBatch : handleSingle}
        >
          {card ? 'Save Changes' : batchMode ? 'Add Cards' : 'Add Card'}
        </button>
        <button className="icon-btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
