'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchLibrary, loadBook, fetchBookPdf, type LibraryBookRaw } from '@/lib/studyApi';
import { useStudy } from '@/contexts/StudyContext';
import { ApiError } from '@/types/api';

// ─── Static metadata enrichment ───────────────────────────────────────────────
// Keyed by book id — must match backend/services/books.py BOOK_LIBRARY keys.

interface BookMeta {
  emoji: string;
  subject: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  chapters: number;
  coverColor: string;
}

const BOOK_META: Record<string, BookMeta> = {
  zumdahl: {
    emoji: '⚗️', subject: 'Chemistry',
    description: 'Comprehensive general chemistry: atomic theory, stoichiometry, thermodynamics, equilibrium, and more.',
    difficulty: 'Intermediate', chapters: 22, coverColor: '#4A7C59',
  },
  atkins: {
    emoji: '🔬', subject: 'Chemistry',
    description: 'Quantum mechanics, thermodynamics, kinetics, and spectroscopy at the physical chemistry level.',
    difficulty: 'Advanced', chapters: 20, coverColor: '#3A5FC4',
  },
  klein: {
    emoji: '🧪', subject: 'Chemistry',
    description: 'Functional groups, reaction mechanisms, stereochemistry, and organic synthesis.',
    difficulty: 'Intermediate', chapters: 26, coverColor: '#9B59B6',
  },
  harris: {
    emoji: '📊', subject: 'Chemistry',
    description: 'Analytical methods, titrations, spectroscopy, chromatography, and statistical data treatment.',
    difficulty: 'Intermediate', chapters: 28, coverColor: '#C4923A',
  },
  berg: {
    emoji: '🧬', subject: 'Biology',
    description: 'Proteins, enzymes, metabolism, DNA replication, gene expression, and signal transduction.',
    difficulty: 'Advanced', chapters: 34, coverColor: '#C4503A',
  },
  netter: {
    emoji: '🫀', subject: 'Medicine',
    description: "Netter's classic illustrated atlas covering every region of the human body.",
    difficulty: 'Intermediate', chapters: 8, coverColor: '#2C8C99',
  },
  anaphy2e: {
    emoji: '🦷', subject: 'Medicine',
    description: 'Structure and function of the human body: cells, tissues, organs, and organ systems.',
    difficulty: 'Beginner', chapters: 30, coverColor: '#1A5276',
  },
};

const DEFAULT_META: BookMeta = {
  emoji: '📚', subject: 'Academic',
  description: 'A curated academic textbook available in your Chunks library.',
  difficulty: 'Intermediate', chapters: 20, coverColor: '#6B7280',
};

export interface EnrichedBook extends LibraryBookRaw {
  emoji: string;
  subject: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  chapters: number;
  coverColor: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner:     'var(--accent2)',
  Intermediate: 'var(--accent)',
  Advanced:     'var(--danger)',
};

const DIFFICULTY_BG: Record<string, string> = {
  Beginner:     'var(--accent2-light)',
  Intermediate: 'var(--accent-light)',
  Advanced:     'var(--danger-light)',
};

interface BookGridProps {
  searchQuery: string;
  activeFilter: string;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function BookSkeleton() {
  return (
    <div className="book-card" aria-hidden="true" style={{ cursor: 'default', pointerEvents: 'none' }}>
      <div className="book-cover" style={{ background: 'var(--surface2, #e5e7eb)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div className="book-meta" style={{ gap: 8 }}>
        <div style={{ height: 10, width: '40%', background: 'var(--surface2, #e5e7eb)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 14, width: '80%', background: 'var(--surface2, #e5e7eb)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 10, width: '100%', background: 'var(--surface2, #e5e7eb)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    </div>
  );
}

export default function BookGrid({ searchQuery, activeFilter }: BookGridProps) {
  const router = useRouter();
  const { dispatch } = useStudy();

  const [books, setBooks] = useState<EnrichedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingBookId, setLoadingBookId] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLibrary();
      const enriched: EnrichedBook[] = res.books.map((b) => {
        const meta = BOOK_META[b.id] ?? DEFAULT_META;
        return { ...b, ...meta };
      });
      setBooks(enriched);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load library. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const handleBookClick = useCallback(async (book: EnrichedBook) => {
    if (loadingBookId) return;
    setLoadingBookId(book.id);
    try {
      await loadBook(book.id);
      let pdfUrl = '';
      try {
        pdfUrl = await fetchBookPdf(book.id);
      } catch {
        // PDF fetch is best-effort; continue without it
      }
      dispatch({ type: 'SET_BOOK', payload: { bookId: book.id, docTitle: book.name, pdfUrl } });
      router.push('/study');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : `Could not load "${book.name}".`;
      dispatch({ type: 'SHOW_TOAST', payload: `❌ ${message}` });
    } finally {
      setLoadingBookId(null);
    }
  }, [loadingBookId, dispatch, router]);

  if (loading) {
    return (
      <div className="book-grid">
        {Array.from({ length: 6 }).map((_, i) => <BookSkeleton key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="library-empty">
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontWeight: 600, fontSize: 15, marginTop: 12 }}>Failed to load library</div>
        <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 6, marginBottom: 16 }}>{error}</div>
        <button className="ws-add-btn" onClick={() => void loadLibrary()}>Retry</button>
      </div>
    );
  }

  const filtered = books.filter((book) => {
    const matchesQuery =
      searchQuery === '' ||
      book.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      activeFilter === 'All' || book.subject === activeFilter || book.difficulty === activeFilter;
    return matchesQuery && matchesFilter;
  });

  if (filtered.length === 0) {
    return (
      <div className="library-empty">
        <div style={{ fontSize: 40 }}>🔍</div>
        <div style={{ fontWeight: 600, fontSize: 15, marginTop: 12 }}>No books found</div>
        <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 6 }}>
          Try a different search term or filter.
        </div>
      </div>
    );
  }

  return (
    <div className="book-grid">
      {filtered.map((book) => {
        const isLoading = loadingBookId === book.id;
        return (
          <button
            key={book.id}
            className="book-card"
            onClick={() => void handleBookClick(book)}
            aria-label={`Open ${book.name}`}
            disabled={isLoading || !!loadingBookId}
            style={{ opacity: loadingBookId && !isLoading ? 0.6 : 1 }}
          >
            {/* Cover */}
            <div className="book-cover" style={{ background: book.coverColor, position: 'relative' }}>
              <span className="book-cover-emoji">{isLoading ? '⏳' : book.emoji}</span>
              <div className="book-cover-lines">
                <div /><div /><div />
              </div>
            </div>

            {/* Meta */}
            <div className="book-meta">
              <div className="book-subject">{book.subject}</div>
              <div className="book-title">{book.name}</div>
              <div className="book-desc">{book.description}</div>
              <div className="book-footer">
                <span
                  className="book-difficulty"
                  style={{
                    color: DIFFICULTY_COLORS[book.difficulty],
                    background: DIFFICULTY_BG[book.difficulty],
                  }}
                >
                  {book.difficulty}
                </span>
                <span className="book-chapters">{book.chapters} chapters</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
