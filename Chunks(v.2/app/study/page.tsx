'use client';

import { lazy, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { StudyProvider, useStudy } from '@/contexts/StudyContext';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/study/layout/Sidebar';
import Topbar from '@/components/study/layout/Topbar';
import ContentPanel from '@/components/study/panels/ContentPanel';
import ChatPanel from '@/components/study/panels/ChatPanel';
import Toast from '@/components/shared/Toast';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { useResizable } from '@/hooks/useResizable';

// Lazy-load heavy tabs so the chat view is interactive immediately
const WorkspaceTab = lazy(() => import('@/components/study/tabs/WorkspaceTab'));
const ReviewerTab  = lazy(() => import('@/components/study/tabs/ReviewerTab'));
const NotesTab     = lazy(() => import('@/components/study/tabs/NotesTab'));

// ─── Reads bookId/docTitle from URL and dispatches to context ─────────────────
// Must be wrapped in <Suspense> because it uses useSearchParams.

function BookParamsReader() {
  const { dispatch } = useStudy();
  const searchParams = useSearchParams();

  useEffect(() => {
    const bookId = searchParams.get('bookId');
    const paramDocTitle = searchParams.get('docTitle');
    const paramPdfUrl = searchParams.get('pdfUrl');
    if (bookId && paramDocTitle) {
      dispatch({
        type: 'SET_BOOK',
        payload: { bookId, docTitle: paramDocTitle, pdfUrl: paramPdfUrl ?? '' },
      });
    } else if (bookId) {
      dispatch({ type: 'SET_BOOK_ID', payload: bookId });
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ─── Inner layout — has access to StudyContext ────────────────────────────────

function StudyLayout() {
  const { state, dispatch, handleSendMessage, showToast } = useStudy();
  const { user } = useAuth();
  const { activeTab, toast, docTitle, topic, recents } = state;
  const { pct, containerRef, onMouseDown } = useResizable();
  const router = useRouter();

  // ContentPanel callbacks → drive Chat via context
  const handleExplain = (topic: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'chat' });
    void handleSendMessage(`Explain "${topic}" in simple terms.`, { selectedText: topic });
  };

  const handleQuizFromContent = (topic: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'chat' });
    void handleSendMessage(`Give me a short quiz on "${topic}".`, { selectedText: topic });
  };

  const handleSummarize = () => {
    showToast('📋 Summary added to Workspace!');
  };

  return (
    <div className="app-shell">
      {/* Read bookId from URL params — wrapped in Suspense as required by Next.js */}
      <Suspense fallback={null}>
        <BookParamsReader />
      </Suspense>

      {/* ── Sidebar ── */}
      <Sidebar
        activeNav="study"
        onNavChange={(id) => {
          if (id === 'library') router.push('/library');
        }}
        onNewSession={() =>
          dispatch({ type: 'SHOW_TOAST', payload: '✨ New study session started' })
        }
        user={user}
        recents={recents}
      />

      {/* ── Main ── */}
      <main className="main">
        <Topbar
          activeTab={activeTab}
          onTabChange={(tab) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab })}
          sessionName={docTitle || topic || 'Study Assistant'}
          onPhaseChange={(phase) => {
            showToast(
              phase === 'break'
                ? '☕ Break time! Rest for 5 minutes.'
                : '📚 Back to study!',
            );
          }}
        />

        <div className="content-area">
          {/* Chat tab — split layout */}
          {activeTab === 'chat' && (
            <div className="workspace" ref={containerRef}>
              <ContentPanel
                style={{ width: `${pct}%` }}
                onExplain={handleExplain}
                onQuiz={handleQuizFromContent}
                onSummarize={handleSummarize}
              />
              <div className="resizer" onMouseDown={onMouseDown} />
              <ErrorBoundary>
                <ChatPanel />
              </ErrorBoundary>
            </div>
          )}

          {/* Workspace tab — lazy */}
          {activeTab === 'workspace' && (
            <Suspense fallback={<div className="tab-loading">Loading workspace…</div>}>
              <ErrorBoundary>
                <WorkspaceTab />
              </ErrorBoundary>
            </Suspense>
          )}

          {/* Reviewer tab — lazy */}
          {activeTab === 'reviewer' && (
            <Suspense fallback={<div className="tab-loading">Loading reviewer…</div>}>
              <ErrorBoundary>
                <ReviewerTab />
              </ErrorBoundary>
            </Suspense>
          )}

          {/* Notes tab — lazy */}
          {activeTab === 'notes' && (
            <Suspense fallback={<div className="tab-loading">Loading notes…</div>}>
              <ErrorBoundary>
                <NotesTab />
              </ErrorBoundary>
            </Suspense>
          )}
        </div>
      </main>

      <Toast message={toast} />
    </div>
  );
}

// ─── Page — wraps with StudyProvider ─────────────────────────────────────────

export default function StudyPage() {
  return (
    <StudyProvider>
      <StudyLayout />
    </StudyProvider>
  );
}
