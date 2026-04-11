'use client';

import { useStudy } from '@/contexts/StudyContext';
import Badge from '@/components/shared/Badge';
import Card from '@/components/shared/Card';
import type { TopicChip } from '@/types';

/**
 * ReviewerTab — displays real performance data from StudyContext.
 * Shows weak areas, performance history, and AI insights derived from
 * actual quiz results. Empty state is shown before the user takes any quiz.
 */
export default function ReviewerTab() {
  const { state, handleStartReview } = useStudy();
  const { weakAreas, performanceHistory, quizResults } = state;

  // Build topic chips from real data
  const topicChips: TopicChip[] = [
    ...weakAreas.slice(0, 3).map((w) => ({
      label: `${w.topic} ⚠`,
      variant: (w.score < 50 ? 'danger' : 'warning') as TopicChip['variant'],
    })),
    ...performanceHistory
      .filter((p) => p.score >= 80)
      .slice(0, 3)
      .map((p) => ({ label: `${p.topic} ✓`, variant: 'success' as TopicChip['variant'] })),
  ];

  const sessionCount = quizResults.length;
  const topicCount = new Set([
    ...quizResults.map((r) => r.topic),
    ...weakAreas.map((w) => w.topic),
  ]).size;
  const lastUpdated =
    quizResults.length > 0
      ? new Date(quizResults[quizResults.length - 1].completedAt).toLocaleTimeString()
      : 'No sessions yet';

  // ── Empty state ────────────────────────────────────────────────────────────
  if (quizResults.length === 0 && weakAreas.length === 0) {
    return (
      <div className="reviewer-tab">
        <div className="ws-header">
          <div>
            <div className="ws-title">AI Reviewer</div>
            <div className="ws-meta">Complete a quiz to see your performance insights</div>
          </div>
        </div>
        <div className="ws-empty" style={{ marginTop: 48 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 500, marginBottom: 6, fontSize: 15 }}>No review data yet</div>
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>
            Take a quiz in the Workspace tab to see your weak areas and insights here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reviewer-tab">
      {/* ── Header ── */}
      <div className="ws-header">
        <div>
          <div className="ws-title">AI Reviewer</div>
          <div className="ws-meta">
            Based on {sessionCount} session{sessionCount !== 1 ? 's' : ''} · {topicCount} topic
            {topicCount !== 1 ? 's' : ''} · Updated {lastUpdated}
          </div>
        </div>
        <button
          className="review-session-btn"
          style={{ width: 'auto', padding: '8px 18px', fontSize: 14 }}
          onClick={() => handleStartReview()}
        >
          Start Review Session →
        </button>
      </div>

      {/* ── 2-col grid ── */}
      <div className="review-grid">
        {/* Topics studied */}
        {topicChips.length > 0 && (
          <Card>
            <div className="review-card-header">
              <div className="review-card-title">📚 Topics Studied</div>
              <span
                className="review-card-badge"
                style={{ background: 'var(--accent2-light)', color: 'var(--accent2)' }}
              >
                {topicChips.length} topics
              </span>
            </div>
            <div className="topic-chips">
              {topicChips.map((c) => (
                <Badge key={c.label} variant={c.variant}>
                  {c.label}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {/* Weak areas */}
        {weakAreas.length > 0 && (
          <Card>
            <div className="review-card-header">
              <div className="review-card-title">⚠️ Weak Areas</div>
              <span
                className="review-card-badge"
                style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}
              >
                Needs review
              </span>
            </div>
            <div className="perf-bars">
              {weakAreas.map((t) => (
                <div key={t.topic} className="weak-topic">
                  <div
                    className="weak-topic-icon"
                    style={{
                      background: t.score < 50 ? 'var(--danger-light)' : 'var(--accent-light)',
                    }}
                  >
                    {t.score < 50 ? '⚡' : '🔬'}
                  </div>
                  <div className="weak-topic-info">
                    <div className="weak-topic-name">{t.topic}</div>
                    <div className="weak-topic-score">
                      Quiz score: {t.score}% · {t.attempts} attempt{t.attempts !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="weak-topic-bar">
                    <div className="weak-topic-fill" style={{ width: `${t.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* ── Performance history ── */}
      {performanceHistory.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div className="review-card-header">
            <div className="review-card-title">📈 Recent Performance</div>
          </div>
          <div className="perf-bars">
            {performanceHistory.slice(-5).map((entry, i) => (
              <div key={i} className="perf-row">
                <span className="perf-label">{entry.topic}</span>
                <div className="perf-bar-track">
                  <div
                    className="perf-bar-fill"
                    style={{
                      width: `${entry.score}%`,
                      background:
                        entry.score >= 80
                          ? 'var(--accent2)'
                          : entry.score >= 50
                            ? 'var(--accent)'
                            : 'var(--danger)',
                    }}
                  />
                </div>
                <span className="perf-pct">{entry.score}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Targeted review CTAs ── */}
      {weakAreas.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {weakAreas.slice(0, 3).map((w) => (
            <button
              key={w.topic}
              className="ws-add-btn"
              onClick={() => handleStartReview(w.topic)}
            >
              📖 Review {w.topic}
            </button>
          ))}
        </div>
      )}

      {/* ── Full review CTA ── */}
      <button className="review-session-btn" onClick={() => handleStartReview()}>
        🎓 Start Personalized Review Session
      </button>
    </div>
  );
}
