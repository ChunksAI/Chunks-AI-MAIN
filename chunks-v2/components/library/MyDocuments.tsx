'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MY_DOCS_STORAGE_KEY, type MyDocMeta } from '@/contexts/StudyContext';

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
  const [docs, setDocs] = useState<MyDocMeta[]>([]);

  // Load from localStorage after mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    setDocs(loadMyDocs());
  }, []);

  if (docs.length === 0) return null;

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
              onClick={() => router.push('/study')}
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
