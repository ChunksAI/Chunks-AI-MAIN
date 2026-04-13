'use client';

import { lazy, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useStudy, loadSnapshotByTitle } from '@/contexts/StudyContext';
import { useAuth } from '@/contexts/AuthContext';
import type { RecentItem } from '@/types';
import Sidebar from '@/components/study/layout/Sidebar';
import Topbar from '@/components/study/layout/Topbar';
import ContentPanel from '@/components/study/panels/ContentPanel';
import ChatPanel from '@/components/study/panels/ChatPanel';
import Toast from '@/components/shared/Toast';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { useResizable } from '@/hooks/useResizable';
import { useTutorSync } from '@/hooks/useTutorSync';

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
  const { state, dispatch, handleSendMessage, showToast, handleResetSession, handleRestoreDocument } = useStudy();
  const { user } = useAuth();
  const { activeTab, toast, docTitle, topic, recents, pdfBlobUrl, slides, uploadLoading } = state;

  // Sync student knowledge model with backend (load on mount, debounce-save on change,
  // regression check on mount)
  const { regressions } = useTutorSync();

  // Show a toast whenever regression is detected on page load
  useEffect(() => {
    if (regressions.length === 0) return;
    const names = regressions.slice(0, 2).join(', ');
    const extra = regressions.length > 2 ? ` (+${regressions.length - 2} more)` : '';
    showToast(`🔁 It's been a while — time to review: ${names}${extra}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regressions]);

  // Show the split layout only when a document is present (or uploading)
  const hasDocument = !!(pdfBlobUrl || slides.length > 0 || uploadLoading);
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

  // Restore a previous session when the user clicks a recent item in the sidebar
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
      // Also restore the correct slides + PDF for this document
      if (snap.docTitle) void handleRestoreDocument(snap.docTitle);
    } else {
      dispatch({ type: 'SET_TOPIC', payload: item.title });
    }
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
        onNewSession={handleResetSession}
        recents={recents}
        onRecentClick={handleRecentClick}
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
          {/* Chat tab — split layout when document loaded, full-width chat otherwise */}
          {activeTab === 'chat' && (
            <div className="workspace" ref={containerRef}>
              {hasDocument && (
                <>
                  <ContentPanel
                    style={{ width: `${pct}%` }}
                    onExplain={handleExplain}
                    onQuiz={handleQuizFromContent}
                    onSummarize={handleSummarize}
                  />
                  <div className="resizer" onMouseDown={onMouseDown} />
                </>
              )}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudyPage() {
  return <StudyLayout />;
}
