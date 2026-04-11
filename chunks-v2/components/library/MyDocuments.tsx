'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MY_DOCS_STORAGE_KEY, type MyDocMeta } from '@/contexts/StudyContext';
import { useStudy } from '@/contexts/StudyContext';

const SLIDES_STORAGE_KEY = 'chunks_v2_slides';

interface PersistedSlides {
  slides: Array<{ title: string; slide_number?: number; content: string[]; notes?: string }>;
  docTitle: string;
  bookId: string | null;
}

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

function loadSlidesForDoc(docTitle: string): PersistedSlides | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SLIDES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSlides;
    if (parsed && parsed.docTitle === docTitle && Array.isArray(parsed.slides)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
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
  const { dispatch } = useStudy();
  const [docs, setDocs] = useState<MyDocMeta[]>([]);

  // Load from localStorage after mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    setDocs(loadMyDocs());
  }, []);

  if (docs.length === 0) return null;

  const handleStudyClick = (doc: MyDocMeta) => {
    // Restore slides from localStorage so AI context is available on /study
    const persisted = loadSlidesForDoc(doc.docTitle);
    if (persisted && persisted.slides.length > 0) {
      dispatch({
        type: 'SET_SLIDES',
        payload: { slides: persisted.slides, docTitle: persisted.docTitle, bookId: persisted.bookId },
      });
    } else {
      // No cached slides — navigate anyway; AI can still answer from topic context
      dispatch({
        type: 'SHOW_TOAST',
        payload: `📄 "${doc.docTitle}" selected — re-upload to restore full AI context`,
      });
      dispatch({ type: 'SET_TOPIC', payload: doc.docTitle });
    }
    router.push('/study');
  };

  return (
    <section className="my-docs-section">
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
    </section>
  );
}
