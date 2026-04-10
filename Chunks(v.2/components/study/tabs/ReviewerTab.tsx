import type { TopicChip, WeakTopic } from '@/types';
import Badge from '@/components/shared/Badge';
import Card from '@/components/shared/Card';

interface ReviewerTabProps {
  onStartReview: () => void;
}

const TOPIC_CHIPS: TopicChip[] = [
  { label: 'Cell Structure ✓', variant: 'success' },
  { label: 'ATP Synthesis ⚠',  variant: 'danger' },
  { label: 'Membrane Transport', variant: 'warning' },
  { label: 'Cytoskeleton',      variant: 'info' },
];

const WEAK_TOPICS: WeakTopic[] = [
  { icon: '⚡', name: 'ATP Synthesis',          score: 'Quiz score: 45% · 3 attempts', pct: 45, iconBg: 'var(--danger-light)' },
  { icon: '🔬', name: 'Electron Transport Chain', score: 'Quiz score: 52% · 1 attempt',  pct: 52, iconBg: 'var(--accent-light)' },
];

export default function ReviewerTab({ onStartReview }: ReviewerTabProps) {
  return (
    <div className="reviewer-tab">
      {/* ── Header ── */}
      <div className="ws-header">
        <div>
          <div className="ws-title">AI Reviewer</div>
          <div className="ws-meta">Based on 3 sessions · 4 topics studied · Updated 2h ago</div>
        </div>
        <button
          className="review-session-btn"
          style={{ width: 'auto', padding: '8px 18px', fontSize: 14 }}
          onClick={onStartReview}
        >
          Start Review Session →
        </button>
      </div>

      {/* ── 2-col grid ── */}
      <div className="review-grid">
        {/* Topics studied */}
        <Card>
          <div className="review-card-header">
            <div className="review-card-title">📚 Topics Studied</div>
            <span className="review-card-badge" style={{ background: 'var(--accent2-light)', color: 'var(--accent2)' }}>
              4 topics
            </span>
          </div>
          <div className="topic-chips">
            {TOPIC_CHIPS.map((c) => (
              <Badge key={c.label} variant={c.variant}>{c.label}</Badge>
            ))}
          </div>
        </Card>

        {/* Weak areas */}
        <Card>
          <div className="review-card-header">
            <div className="review-card-title">⚠️ Weak Areas</div>
            <span className="review-card-badge" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
              Needs review
            </span>
          </div>
          <div className="perf-bars">
            {WEAK_TOPICS.map((t) => (
              <div key={t.name} className="weak-topic">
                <div className="weak-topic-icon" style={{ background: t.iconBg }}>{t.icon}</div>
                <div className="weak-topic-info">
                  <div className="weak-topic-name">{t.name}</div>
                  <div className="weak-topic-score">{t.score}</div>
                </div>
                <div className="weak-topic-bar">
                  <div className="weak-topic-fill" style={{ width: `${t.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── AI Insights ── */}
      <Card style={{ marginBottom: 16 }}>
        <div className="review-card-header">
          <div className="review-card-title">🤖 AI Study Insights</div>
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.75 }}>
          <p style={{ marginBottom: 10 }}>
            Based on your study patterns, you learn best in the <strong>morning (9–11 AM)</strong> and
            tend to retain concepts better when you generate flashcards immediately after reading.
          </p>
          <p style={{ marginBottom: 10 }}>
            You&apos;ve studied <strong>Cell Biology</strong> for 3 sessions (4.5 hrs total). Your
            understanding of cell structure is strong (82%), but{' '}
            <span style={{ color: 'var(--danger)', fontWeight: 500 }}>
              ATP synthesis remains your biggest gap
            </span>
            . I recommend dedicating your next 2 sessions to this topic.
          </p>
          <p>
            <strong>Suggested next steps:</strong> Review the ATP synthesis flashcards → Take the
            Mitochondria quiz again → Ask me to explain the ETC step by step.
          </p>
        </div>
      </Card>

      {/* ── CTA ── */}
      <button className="review-session-btn" onClick={onStartReview}>
        🎓 Start Personalized Review Session
      </button>
    </div>
  );
}
