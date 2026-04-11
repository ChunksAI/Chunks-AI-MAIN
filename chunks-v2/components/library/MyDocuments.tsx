'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MY_DOCS_STORAGE_KEY, loadSnapshotByTitle, type MyDocMeta } from '@/contexts/StudyContext';
import { useStudy } from '@/contexts/StudyContext';
import type { RecentItem } from '@/types';

function loadMyDocs(): MyDocMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MY_DOCS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as MyDocMeta[]) : [];
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function MyDocuments() {
  const router = useRouter();
  const { state, dispatch, handleRestoreDocument } = useStudy();
  const { recents } = state;
  const [docs, setDocs] = useState<MyDocMeta[]>([]);

  // Load from localStorage after mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    setDocs(loadMyDocs());
  }, []);

  if (docs.length === 0 && recents.length === 0) return null;

  const handleStudyClick = (doc: MyDocMeta) => {
    // Use handleRestoreDocument so slides + PDF blob are both restored correctly
    dispatch({ type: 'SET_TOPIC', payload: doc.docTitle });
    void handleRestoreDocument(doc.docTitle);
    router.push('/study');
  };

  // Restore a past session from a recent item (used as fallback when no PDFs uploaded)
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
    router.push('/study');
  };

  // Titles already covered by uploaded docs — used to avoid duplicating entries
  const docTitles = new Set(docs.map((d) => d.docTitle));
  // Recents that don't have a corresponding uploaded-doc entry
  const orphanRecents = recents.filter((r) => !docTitles.has(r.title));

  return (
    <section className="my-docs-section">
      {docs.length > 0 && (
        <>
          <h2 className="my-docs-heading">My Documents</h2>
          <div className="my-docs-grid">
            {docs.map((doc) => (
              <div key={doc.filename + doc.uploadedAt} className="my-doc-card">
                <div className="my-doc-icon">📄</div>
                <div className="my-doc-info">
                  <div className="my-doc-title" title={doc.docTitle}>{doc.docTitle}</div>
                  <div className="my-doc-meta">{doc.filename}</div>
                  <div className="my-doc-meta">Uploaded {formatDate(doc.uploadedAt)}</div>
                </div>
                <button
                  className="my-doc-study-btn"
                  onClick={() => handleStudyClick(doc)}
                  aria-label={`Study ${doc.docTitle}`}
                >
                  Study
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {orphanRecents.length > 0 && (
        <>
          <h2 className="my-docs-heading" style={{ marginTop: docs.length > 0 ? 24 : 0 }}>
            Recent Sessions
          </h2>
          <div className="my-docs-grid">
            {orphanRecents.map((item) => (
              <div key={item.id} className="my-doc-card">
                <div className="recent-session-icon" style={{ background: item.color }}>
                  📚
                </div>
                <div className="my-doc-info">
                  <div className="my-doc-title" title={item.title}>{item.title}</div>
                  <div className="my-doc-meta">Study session</div>
                </div>
                <button
                  className="my-doc-study-btn"
                  onClick={() => handleRecentClick(item)}
                  aria-label={`Resume ${item.title}`}
                >
                  Resume
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
