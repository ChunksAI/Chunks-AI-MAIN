'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/study/layout/Sidebar';
import BookGrid from '@/components/library/BookGrid';

const SUBJECTS = ['All', 'Chemistry', 'Biology', 'Medicine'];
const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

export default function LibraryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const handleNavChange = (id: string) => {
    if (id === 'study') {
      router.push('/study');
    } else if (id !== 'library') {
      // other nav items are not yet implemented
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        activeNav="library"
        onNavChange={handleNavChange}
        onNewSession={() => router.push('/study')}
        user={user}
      />

      <main className="main">
        {/* ── Page header ── */}
        <div className="library-header">
          <div className="library-header-left">
            <h1 className="library-title">Library</h1>
            <p className="library-subtitle">Choose a subject to start studying</p>
          </div>

          {/* Search */}
          <div className="library-search-wrap">
            <svg className="library-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className="library-search"
              type="search"
              placeholder="Search books…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search books"
            />
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="library-filter-bar">
          {SUBJECTS.map((subject) => (
            <button
              key={subject}
              className={`library-filter-chip${activeFilter === subject ? ' active' : ''}`}
              onClick={() => setActiveFilter(subject)}
            >
              {subject}
            </button>
          ))}
          <div className="library-filter-sep" />
          {DIFFICULTIES.map((diff) => (
            <button
              key={diff}
              className={`library-filter-chip${activeFilter === diff ? ' active' : ''}`}
              onClick={() => setActiveFilter(diff)}
            >
              {diff}
            </button>
          ))}
        </div>

        {/* ── Book grid ── */}
        <div className="library-content">
          <BookGrid searchQuery={searchQuery} activeFilter={activeFilter} />
        </div>
      </main>
    </div>
  );
}
