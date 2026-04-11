'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/study/layout/Sidebar';
import SearchBar from '@/components/research/SearchBar';
import ResultsGrid from '@/components/research/ResultsGrid';
import Toast from '@/components/shared/Toast';
import { useStudy } from '@/contexts/StudyContext';
import { searchContent, searchMyDocuments } from '@/lib/researchApi';
import type { ResearchResult, ResearchFilter } from '@/lib/researchApi';
import { ApiError } from '@/types/api';

const DEBOUNCE_MS = 400;

export default function ResearchPage() {
  const router = useRouter();
  const { state, handleResetSession, showToast } = useStudy();

  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<ResearchFilter[]>(['all']);
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd+K focuses the search input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleFilter = (filter: ResearchFilter) => {
    setActiveFilters((prev) => {
      if (filter === 'all') return ['all'];
      const without = prev.filter((f) => f !== 'all');
      const hasFilter = without.includes(filter);
      const next = hasFilter
        ? without.filter((f) => f !== filter)
        : [...without, filter];
      return next.length === 0 ? ['all'] : next;
    });
  };

  const runSearch = useCallback(async (q: string, filters: ResearchFilter[]) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    // Cancel previous request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      let combined: ResearchResult[] = [];

      const useMyDocs = filters.includes('all') || filters.includes('my-documents');
      const useBackend = filters.includes('all') || filters.includes('library') || filters.includes('web');

      // Client-side document search (instant)
      if (useMyDocs && state.slides.length > 0) {
        const docResults = searchMyDocuments(q, state.slides, state.docTitle);
        combined = [...docResults];
      }

      // Backend search
      if (useBackend) {
        const backendResults = await searchContent(q, filters, abortRef.current.signal);
        combined = [...combined, ...backendResults];
      }

      // Sort by relevance
      combined.sort((a, b) => b.relevanceScore - a.relevanceScore);
      setResults(combined);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof ApiError ? err.message : 'Search failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [state.slides, state.docTitle]);

  // Debounce search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query, activeFilters);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeFilters, runSearch]);

  const localToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const isIdle = !hasSearched && !loading;

  return (
    <div className="app-shell">
      <Sidebar
        activeNav="research"
        onNavChange={(id) => {
          if (id === 'study') router.push('/study');
        }}
        onNewSession={handleResetSession}
        recents={state.recents}
      />

      <main className="main">
        <div className="research-page">
          {/* ── Header ── */}
          <div className={`research-header${isIdle ? ' research-header--centered' : ''}`}>
            <div className="research-header-inner">
              {isIdle && (
                <>
                  <div style={{ fontSize: 36, marginBottom: 16 }}>🔍</div>
                  <h1 className="research-title">Research</h1>
                  <p className="research-subtitle">
                    Search your documents, the textbook library, and the web.<br />
                    <kbd>⌘K</kbd> to focus
                  </p>
                </>
              )}
              {!isIdle && (
                <h2 className="research-results-heading">
                  {loading ? 'Searching…' : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
                </h2>
              )}

              <SearchBar
                ref={searchInputRef}
                value={query}
                onChange={setQuery}
                onSearch={() => void runSearch(query, activeFilters)}
                activeFilters={activeFilters}
                onToggleFilter={handleToggleFilter}
                loading={loading}
              />
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="research-error">
              ⚠️ {error}
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          {/* ── Results ── */}
          {hasSearched && (
            <div className="research-results-area">
              <ResultsGrid
                results={results}
                loading={loading}
                query={query}
                onToast={localToast}
              />
            </div>
          )}
        </div>
      </main>

      <Toast message={toastMsg ?? state.toast} />
    </div>
  );
}
