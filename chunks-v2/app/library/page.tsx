'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy, loadSnapshotByTitle } from '@/contexts/StudyContext';
import type { RecentItem } from '@/types';
import Sidebar from '@/components/study/layout/Sidebar';
import BookGrid from '@/components/library/BookGrid';

import MyDocuments from '@/components/library/MyDocuments';

const SUBJECTS = ['All', 'Chemistry', 'Biology', 'Medicine'];
const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

export default function LibraryPage() {
  const router = useRouter();
  const { user: _user } = useAuth();
  const { state, dispatch, handleRestoreDocument } = useStudy();
  const { recents } = state;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const handleNavChange = (id: string) => {
    if (id === 'study') {
      router.push('/study');
    } else if (id !== 'library') {
      // other nav items are not yet implemented
    }
  };

  // Restore a session and navigate to /study when a sidebar recent is clicked
  const handleRecentClick = (item: RecentItem) => {
    const snap = loadSnapshotByTitle(item.title);
    if (snap) {
      dispatch({
        type: 'RESTORE_SESSION',
        payload: {
          messages: snap.messages,
          workspaceSections: snap.workspaceSections,
          quizResults: snap.quizResults,
          weakAreas: snap.weakAreas,
          performanceHistory: snap.performanceHistory,
          notes: snap.notes,
          topic: snap.topic,
          docTitle: snap.docTitle,
          bookId: snap.bookId,
        },
      });
      // Also restore the correct slides + PDF so the ContentPanel shows the right document
      if (snap.docTitle) void handleRestoreDocument(snap.docTitle);
    } else {
      dispatch({ type: 'SET_TOPIC', payload: item.title });
    }
    router.push('/study');
  };

  return (
    <div className="app-shell">
      <Sidebar
        activeNav="library"
        onNavChange={handleNavChange}
        onNewSession={() => router.push('/study')}
        recents={recents}
        onRecentClick={handleRecentClick}
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

        {/* ── My Documents + Book grid ── */}
        <div className="library-content">
          <MyDocuments />
          <BookGrid searchQuery={searchQuery} activeFilter={activeFilter} />
        </div>
      </main>
    </div>
  );
}
