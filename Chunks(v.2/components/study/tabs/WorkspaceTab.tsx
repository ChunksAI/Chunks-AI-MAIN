'use client';

import { useState } from 'react';
import { useStudy } from '@/contexts/StudyContext';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import QuizRunner from '@/components/study/quiz/QuizRunner';
import FlashcardDeck from '@/components/study/flashcards/FlashcardDeck';
import type { WorkspaceCard } from '@/types';

const TYPE_COLOR: Record<string, string> = {
  flashcards: 'var(--blue)',
  quiz:       'var(--accent)',
  summary:    'var(--accent2)',
  mindmap:    'var(--accent2)',
};

const TYPE_LABEL: Record<string, string> = {
  flashcards: 'Flashcards',
  quiz:       'Quiz',
  summary:    'Summary',
  mindmap:    'Mind Map',
};

/**
 * WorkspaceTab — displays generated flashcard decks, quizzes, and notes.
 * Reads workspaceSections from StudyContext and shows QuizRunner / FlashcardDeck
 * when a card is clicked. Empty state encourages first generation.
 */
export default function WorkspaceTab() {
  const { state, dispatch, handleGenerateFlashcards, handleGenerateQuiz } = useStudy();
  const { workspaceSections, workspaceLoading, activeQuiz, activeQuizAnswers, topic } = state;

  const [activeFlashcardCard, setActiveFlashcardCard] = useState<WorkspaceCard | null>(null);

  // Show quiz runner when a quiz is active
  if (activeQuiz) {
    return (
      <ErrorBoundary>
        <QuizRunner quiz={activeQuiz} answers={activeQuizAnswers} />
      </ErrorBoundary>
    );
  }

  // Show flashcard deck when one is selected
  if (activeFlashcardCard?.flashcards) {
    return (
      <ErrorBoundary>
        <FlashcardDeck
          title={activeFlashcardCard.title}
          cards={activeFlashcardCard.flashcards}
          onClose={() => setActiveFlashcardCard(null)}
        />
      </ErrorBoundary>
    );
  }

  const totalItems = workspaceSections.reduce((sum, s) => sum + s.cards.length, 0);
  const studyTopic = topic || 'No topic set';

  return (
    <div className="workspace-tab">
      {/* ── Header ── */}
      <div className="ws-header">
        <div>
          <div className="ws-title">Workspace</div>
          <div className="ws-meta">
            {totalItems} item{totalItems !== 1 ? 's' : ''} · {studyTopic} ·{' '}
            {workspaceLoading ? 'Generating…' : 'Updated just now'}
          </div>
        </div>
        <button
          className="ws-add-btn"
          onClick={() => topic && void handleGenerateFlashcards(topic)}
          disabled={workspaceLoading || !topic}
          title={!topic ? 'Start a conversation in Chat to set a topic first' : undefined}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {workspaceLoading ? 'Generating…' : 'Add item'}
        </button>
      </div>

      {/* ── Loading skeleton ── */}
      {workspaceLoading && workspaceSections.length === 0 && (
        <div className="ws-loading">
          <div className="ws-loading-spinner" />
          <span>Generating your study materials…</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!workspaceLoading && workspaceSections.length === 0 && (
        <div className="ws-empty">
          <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
          <div style={{ fontWeight: 500, marginBottom: 6, fontSize: 15 }}>
            Your workspace is empty
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>
            {topic
              ? 'Ask the AI in the Chat tab to generate flashcards or a quiz, or start below.'
              : 'Start a conversation in the Chat tab to set a topic, then generate study materials here.'}
          </div>
          {topic && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="ws-add-btn"
                onClick={() => void handleGenerateFlashcards(topic)}
              >
                🃏 Generate flashcards
              </button>
              <button
                className="panel-btn"
                onClick={() => void handleGenerateQuiz(topic)}
              >
                🎯 Generate quiz
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Sections ── */}
      {workspaceSections.map((section) => (
        <section key={section.title}>
          <div className="ws-section-title">{section.title}</div>
          <div className="ws-grid">
            {section.cards.map((card) => (
              <div
                key={card.id}
                className="ws-card"
                style={{ cursor: card.flashcards || card.questions ? 'pointer' : 'default' }}
                onClick={() => {
                  if (card.type === 'flashcards' && card.flashcards) {
                    setActiveFlashcardCard(card);
                  } else if (card.type === 'quiz' && card.questions) {
                    dispatch({
                      type: 'START_QUIZ',
                      payload: {
                        id: card.id,
                        title: card.title,
                        questions: card.questions,
                        difficulty: card.meta.split('·')[1]?.trim() ?? 'medium',
                      },
                    });
                  }
                }}
              >
                <div className="ws-card-type">
                  <div className="type-dot" style={{ background: TYPE_COLOR[card.type] }} />
                  <span style={{ color: TYPE_COLOR[card.type] }}>{TYPE_LABEL[card.type]}</span>
                </div>
                <div className="ws-card-title">{card.title}</div>
                <div className="ws-card-meta">{card.meta}</div>
                {card.stats && (
                  <div className="ws-card-footer">
                    {card.stats.map((s, i) => (
                      <span
                        key={i}
                        className="ws-card-stat"
                        style={{
                          marginLeft: i > 0 ? 'auto' : undefined,
                          color: s.danger ? 'var(--danger)' : undefined,
                        }}
                      >
                        {s.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
