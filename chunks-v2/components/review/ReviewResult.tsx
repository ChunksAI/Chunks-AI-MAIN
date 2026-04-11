'use client';

/**
 * components/review/ReviewResult.tsx — Step 4 (final) of the review session.
 *
 * Displays the session score with an SVG donut chart, a stats row, the AI
 * recommendation, remaining weak areas, and score-based CTA buttons.
 */

import { useRouter } from 'next/navigation';
import { useStudy } from '@/contexts/StudyContext';
import { useReviewSession } from '@/hooks/useReviewSession';
import { getRecommendation, computeWeaknessScores } from '@/lib/weaknessEngine';

// ─── SVG Donut Score ──────────────────────────────────────────────────────────

interface DonutProps {
  score: number;
}

function ScoreDonut({ score }: DonutProps) {
  const radius = 70;
  const stroke = 10;
  const normalised = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalised;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? 'var(--accent2)' : score >= 50 ? 'var(--accent)' : 'var(--danger)';

  const label = score >= 50 ? 'PASSED' : 'NEEDS REVIEW';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        marginBottom: 28,
      }}
    >
      <svg
        width={radius * 2 + stroke}
        height={radius * 2 + stroke}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={radius + stroke / 2}
          cy={radius + stroke / 2}
          r={normalised}
          fill="none"
          stroke="var(--surface2)"
          strokeWidth={stroke}
        />
        {/* Fill */}
        <circle
          cx={radius + stroke / 2}
          cy={radius + stroke / 2}
          r={normalised}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>

      {/* Score number + label — positioned over the SVG */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: 'var(--text1)',
            lineHeight: 1,
          }}
        >
          {score}%
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color,
            marginTop: 4,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  accent?: boolean;
  positive?: boolean;
  negative?: boolean;
}

function StatCard({ label, value, positive, negative }: StatCardProps) {
  const color = positive
    ? 'var(--accent2)'
    : negative
      ? 'var(--danger)'
      : 'var(--text1)';

  return (
    <div
      style={{
        flex: 1,
        background: 'var(--surface2)',
        borderRadius: 'var(--radius)',
        padding: '14px 12px',
        textAlign: 'center',
        minWidth: 80,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReviewResult() {
  const router = useRouter();
  const { state, dispatch } = useStudy();
  const { session, handleEndReviewSession } = useReviewSession();

  if (!session) return null;

  const { score, correctAnswers, totalQuestions, topic, startedAt } = session;
  const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const elapsedLabel =
    elapsedSeconds < 60
      ? `${elapsedSeconds}s`
      : `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`;

  const wrongAnswers = totalQuestions - correctAnswers;

  // Improvement: compare against the second-to-last quiz result for this topic
  const topicResults = state.quizResults.filter((r) => r.topic === topic);
  const previousScore =
    topicResults.length >= 2
      ? topicResults[topicResults.length - 2]?.score ?? null
      : null;
  const improvement = previousScore !== null ? score - previousScore : null;

  const { message, nextAction } = getRecommendation(score);

  // Remaining weak areas (below 70%)
  const weaknessScores = computeWeaknessScores(state);
  const remainingWeak = weaknessScores
    .filter((w) => w.avgQuizScore < 70)
    .slice(0, 3);

  const handleRetryQuiz = () => {
    dispatch({ type: 'RESET_REVIEW_QUIZ_READY' });
    dispatch({ type: 'SET_REVIEW_STEP', payload: 'quiz' });
  };

  const handleReviewFlashcards = () => {
    dispatch({ type: 'SET_REVIEW_STEP', payload: 'flashcards' });
  };

  const handleFinish = () => {
    handleEndReviewSession();
    router.push('/study?tab=reviewer');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      {/* Score donut */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: 32,
          boxShadow: 'var(--shadow-md)',
          width: '100%',
          textAlign: 'center',
          position: 'relative',
          animation: 'fadeUp 0.3s ease',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 24,
          }}
        >
          Session Complete
        </div>

        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <ScoreDonut score={score} />
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 8,
            flexWrap: 'wrap',
          }}
        >
          <StatCard label="Correct" value={String(correctAnswers)} positive />
          <StatCard label="Wrong" value={String(wrongAnswers)} negative={wrongAnswers > 0} />
          <StatCard label="Time" value={elapsedLabel} />
          {improvement !== null && (
            <StatCard
              label="vs Last"
              value={`${improvement >= 0 ? '+' : ''}${improvement}%`}
              positive={improvement > 0}
              negative={improvement < 0}
            />
          )}
        </div>
      </div>

      {/* Recommendation */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-md)',
          width: '100%',
          borderLeft: '4px solid var(--accent2)',
          animation: 'fadeUp 0.35s ease',
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--accent2)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          💡 Recommendation
        </div>
        <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
          {message}
        </div>
      </div>

      {/* Remaining weak areas */}
      {remainingWeak.length > 0 && (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            boxShadow: 'var(--shadow-md)',
            width: '100%',
            animation: 'fadeUp 0.4s ease',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text1)',
              marginBottom: 14,
            }}
          >
            ⚠️ Still needs work
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {remainingWeak.map((w) => (
              <div
                key={w.topic}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text2)',
                    minWidth: 120,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {w.topic}
                </span>
                <div
                  style={{
                    flex: 3,
                    height: 6,
                    background: 'var(--surface2)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${w.avgQuizScore}%`,
                      background:
                        w.avgQuizScore < 50
                          ? 'var(--danger)'
                          : 'var(--accent)',
                      borderRadius: 3,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text3)',
                    minWidth: 36,
                    textAlign: 'right',
                  }}
                >
                  {w.avgQuizScore}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          width: '100%',
          animation: 'fadeUp 0.45s ease',
        }}
      >
        {nextAction === 'review_flashcards' && (
          <button
            onClick={handleReviewFlashcards}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              height: 48,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            📚 Review Flashcards Again
          </button>
        )}

        {nextAction === 'retry_quiz' && (
          <button
            onClick={handleRetryQuiz}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              height: 48,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            🔄 Retry Quiz
          </button>
        )}

        {nextAction === 'finish_session' && (
          <button
            onClick={() => router.push('/exam')}
            style={{
              background: 'var(--accent2)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              height: 48,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            🎓 Take Full Exam
          </button>
        )}

        <button
          onClick={handleFinish}
          style={{
            background: 'none',
            color: 'var(--text2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            height: 44,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          ✓ Finish Session
        </button>
      </div>
    </div>
  );
}
