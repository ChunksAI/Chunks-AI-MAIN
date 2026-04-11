'use client';

import { useRouter } from 'next/navigation';
import { useStudy } from '@/contexts/StudyContext';
import type { ResearchResult } from '@/lib/researchApi';
import type { NoteItem } from '@/types';

interface ResultCardProps {
  result: ResearchResult;
  onToast: (msg: string) => void;
}

const SOURCE_ICONS: Record<string, string> = {
  document: '📄',
  library:  '📚',
  web:      '🌐',
};

export default function ResultCard({ result, onToast }: ResultCardProps) {
  const router = useRouter();
  const { dispatch, handleSendMessage } = useStudy();

  const handleStudyThis = () => {
    if (result.bookId) {
      dispatch({ type: 'SET_BOOK_ID', payload: result.bookId });
    }
    router.push('/study');
  };

  const handleAddToNotes = () => {
    const note: NoteItem = {
      id: `note-${Date.now()}`,
      type: 'note',
      title: result.title,
      content: result.excerpt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_NOTE', payload: note });
    onToast('📝 Added to Notes!');
  };

  const handleAskAI = () => {
    const question = `Tell me more about: "${result.title}". Here's what I found: ${result.excerpt.slice(0, 300)}`;
    void handleSendMessage(question);
    router.push('/study');
  };

  const relevanceColor =
    result.relevanceScore >= 80
      ? 'var(--accent2)'
      : result.relevanceScore >= 50
      ? 'var(--accent)'
      : 'var(--text3)';

  return (
    <div className="research-result-card">
      {/* Header */}
      <div className="result-card-header">
        <div className="result-card-source">
          <span className="result-source-icon">{SOURCE_ICONS[result.source] ?? '📄'}</span>
          <span className="result-source-label">{result.sourceLabel}</span>
          {result.slideNumber !== undefined && (
            <span className="result-page-badge">p.{result.slideNumber}</span>
          )}
        </div>
        <span className="result-relevance" style={{ color: relevanceColor }}>
          {result.relevanceScore}% match
        </span>
      </div>

      {/* Body */}
      <div className="result-card-title">{result.title}</div>
      <p className="result-card-excerpt">{result.excerpt}</p>

      {/* Actions */}
      <div className="result-card-actions">
        <button className="result-action-btn result-action-primary" onClick={handleStudyThis}>
          📖 Study this
        </button>
        <button className="result-action-btn" onClick={handleAddToNotes}>
          📝 Add to notes
        </button>
        <button className="result-action-btn" onClick={handleAskAI}>
          💬 Ask AI
        </button>
      </div>
    </div>
  );
}
