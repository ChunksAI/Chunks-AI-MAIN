'use client';

import { forwardRef } from 'react';
import type { ResearchFilter } from '@/lib/researchApi';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  activeFilters: ResearchFilter[];
  onToggleFilter: (filter: ResearchFilter) => void;
  loading: boolean;
}

const FILTER_OPTIONS: { id: ResearchFilter; label: string; icon: string }[] = [
  { id: 'all',          label: 'All',           icon: '✦' },
  { id: 'my-documents', label: 'My Documents',   icon: '📄' },
  { id: 'library',      label: 'Library Books',  icon: '📚' },
  { id: 'web',          label: 'Web',            icon: '🌐' },
];

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { value, onChange, onSearch, activeFilters, onToggleFilter, loading },
  ref,
) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSearch();
  };

  return (
    <div className="research-searchbar">
      <div className="research-input-wrap">
        <svg
          className="research-search-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={ref}
          className="research-input"
          type="search"
          placeholder="Search topics, concepts, questions…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          aria-label="Research search"
        />
        <button
          className="research-search-btn"
          onClick={onSearch}
          disabled={loading || !value.trim()}
          aria-label="Search"
        >
          {loading ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>

      {/* Filter chips */}
      <div className="research-filters">
        {FILTER_OPTIONS.map((f) => {
          const isActive = activeFilters.includes(f.id);
          return (
            <button
              key={f.id}
              className={`research-filter-chip${isActive ? ' active' : ''}`}
              onClick={() => onToggleFilter(f.id)}
              aria-pressed={isActive}
            >
              <span>{f.icon}</span>
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default SearchBar;
