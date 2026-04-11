'use client';

import type { ResearchResult } from '@/lib/researchApi';
import ResultCard from './ResultCard';

interface ResultsGridProps {
  results: ResearchResult[];
  loading: boolean;
  query: string;
  onToast: (msg: string) => void;
}

function SkeletonCard() {
  return (
    <div className="research-result-card research-skeleton" aria-hidden="true">
      <div className="skeleton-line" style={{ width: '30%', height: 10 }} />
      <div className="skeleton-line" style={{ width: '70%', height: 14, marginTop: 10 }} />
      <div className="skeleton-line" style={{ width: '100%', height: 10, marginTop: 8 }} />
      <div className="skeleton-line" style={{ width: '90%', height: 10, marginTop: 4 }} />
      <div className="skeleton-line" style={{ width: '60%', height: 10, marginTop: 4 }} />
    </div>
  );
}

export default function ResultsGrid({ results, loading, query, onToast }: ResultsGridProps) {
  if (loading) {
    return (
      <div className="research-results-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (results.length === 0 && query) {
    return (
      <div className="research-empty">
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No results found</div>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>
          Try different keywords, or switch to &ldquo;Web&rdquo; search for broader results.
        </div>
      </div>
    );
  }

  return (
    <div className="research-results-grid">
      {results.map((result) => (
        <ResultCard key={result.id} result={result} onToast={onToast} />
      ))}
    </div>
  );
}
