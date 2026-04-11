'use client';

/**
 * components/review/ReviewExplain.tsx — Step 1 of the review session.
 *
 * Displays the AI-generated explanation for the weak topic.  Shows a shimmer
 * skeleton while the explanation is being loaded, then renders the full
 * markdown content via MarkdownRenderer.
 */

import { useReviewSession } from '@/hooks/useReviewSession';
import MarkdownRenderer from '@/components/study/chat/MarkdownRenderer';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ExplanationSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        padding: 32,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {[80, 95, 70, 85, 60, 40].map((width, i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? 20 : 14,
            width: `${width}%`,
            borderRadius: 6,
            marginBottom: i === 0 ? 24 : 12,
            background: 'var(--surface2)',
            animation: 'shimmer 1.5s ease infinite',
            backgroundImage:
              'linear-gradient(90deg, var(--surface2) 25%, var(--surface) 50%, var(--surface2) 75%)',
            backgroundSize: '200% 100%',
          }}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReviewExplain() {
  const { session, handleAdvanceReviewStep } = useReviewSession();

  if (!session) return null;

  const isLoading = session.explanationText === '';

  if (isLoading) {
    return <ExplanationSkeleton />;
  }

  const wordCount = session.explanationText.split(/\s+/).filter(Boolean).length;
  const readMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        padding: 32,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Topic chip */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'var(--accent-light)',
          color: 'var(--accent)',
          fontSize: 12,
          fontWeight: 600,
          borderRadius: 20,
          padding: '4px 12px',
          marginBottom: 20,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}
      >
        {session.topic}
      </div>

      {/* Explanation body */}
      <MarkdownRenderer content={session.explanationText} />

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 28,
          paddingTop: 20,
          borderTop: '1px solid var(--border)',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>
          ⏱ {readMinutes} min read · {wordCount} words
        </span>

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
            transition: 'opacity 0.15s',
            flex: '1 1 auto',
            maxWidth: 280,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
        >
          I understand — next step →
        </button>
      </div>
    </div>
  );
}
