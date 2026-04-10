import type { WorkspaceSection } from '@/types';

interface WorkspaceTabProps {
  onAddItem: () => void;
}

const SECTIONS: WorkspaceSection[] = [
  {
    title: 'Flashcard Decks',
    cards: [
      {
        id: 'fc1',
        type: 'flashcards',
        title: 'Cell Organelles — Complete Set',
        meta: '24 cards · Generated from Ch. 3',
        stats: [{ label: '✓ 18 mastered' }, { label: '⚠ 6 weak' }],
      },
      {
        id: 'fc2',
        type: 'flashcards',
        title: 'ATP Synthesis Pathway',
        meta: '12 cards · Auto-generated · Weak area',
        stats: [{ label: '⚠ Needs review', danger: true }],
      },
    ],
  },
  {
    title: 'Quizzes',
    cards: [
      {
        id: 'q1',
        type: 'quiz',
        title: 'Cell Structure Quiz — Chapter 3',
        meta: '20 questions · Multiple choice',
        stats: [{ label: 'Last score: 82%' }, { label: '2 days ago' }],
      },
      {
        id: 'q2',
        type: 'quiz',
        title: 'Mitochondria Deep Dive',
        meta: '15 questions · AI-adaptive',
        stats: [{ label: 'Last score: 45%' }, { label: 'Weak area', danger: true }],
      },
      {
        id: 'q3',
        type: 'quiz',
        title: 'Membrane Transport',
        meta: '10 questions · Not started',
        stats: [{ label: '—' }],
      },
    ],
  },
  {
    title: 'Notes & Summaries',
    cards: [
      {
        id: 's1',
        type: 'summary',
        title: 'Chapter 3 — AI Summary',
        meta: '320 words · Auto-generated',
        stats: [{ label: '📄 View full summary' }],
      },
      {
        id: 'm1',
        type: 'mindmap',
        title: 'Cell Biology Connections',
        meta: '14 nodes · Visual overview',
        stats: [{ label: '🗺️ Open mind map' }],
      },
    ],
  },
];

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

export default function WorkspaceTab({ onAddItem }: WorkspaceTabProps) {
  return (
    <div className="workspace-tab">
      {/* ── Header ── */}
      <div className="ws-header">
        <div>
          <div className="ws-title">Workspace</div>
          <div className="ws-meta">12 items · Chapter 3 — Cell Biology · Updated just now</div>
        </div>
        <button className="ws-add-btn" onClick={onAddItem}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add item
        </button>
      </div>

      {/* ── Sections ── */}
      {SECTIONS.map((section) => (
        <section key={section.title}>
          <div className="ws-section-title">{section.title}</div>
          <div className="ws-grid">
            {section.cards.map((card) => (
              <div key={card.id} className="ws-card">
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
