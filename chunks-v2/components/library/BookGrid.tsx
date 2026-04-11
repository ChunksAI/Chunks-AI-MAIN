'use client';

import { useRouter } from 'next/navigation';

export interface LibraryBook {
  id: string;
  title: string;
  subject: string;
  description: string;
  coverColor: string;
  emoji: string;
  chapters: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  /** Direct URL to the hosted PDF (backend or CDN). Empty string = no PDF available. */
  bookPdfUrl: string;
}

// Book IDs MUST match the keys in backend/services/books.py BOOK_LIBRARY so
// that semantic search is scoped to the correct textbook on the /ask endpoint.
const BOOKS: LibraryBook[] = [
  {
    id: 'zumdahl',
    title: 'General Chemistry',
    subject: 'Chemistry',
    description: 'Comprehensive general chemistry: atomic theory, stoichiometry, thermodynamics, equilibrium, and more.',
    coverColor: '#4A7C59',
    emoji: '⚗️',
    chapters: 22,
    difficulty: 'Intermediate',
    bookPdfUrl: 'https://api.chunks.online/books/zumdahl/pdf',
  },
  {
    id: 'atkins',
    title: 'Physical Chemistry',
    subject: 'Chemistry',
    description: 'Quantum mechanics, thermodynamics, kinetics, and spectroscopy at the physical chemistry level.',
    coverColor: '#3A5FC4',
    emoji: '🔬',
    chapters: 20,
    difficulty: 'Advanced',
    bookPdfUrl: 'https://api.chunks.online/books/atkins/pdf',
  },
  {
    id: 'klein',
    title: 'Organic Chemistry',
    subject: 'Chemistry',
    description: 'Functional groups, reaction mechanisms, stereochemistry, and organic synthesis.',
    coverColor: '#9B59B6',
    emoji: '🧪',
    chapters: 26,
    difficulty: 'Intermediate',
    bookPdfUrl: 'https://api.chunks.online/books/klein/pdf',
  },
  {
    id: 'harris',
    title: 'Quantitative Chemical Analysis',
    subject: 'Chemistry',
    description: 'Analytical methods, titrations, spectroscopy, chromatography, and statistical data treatment.',
    coverColor: '#C4923A',
    emoji: '📊',
    chapters: 28,
    difficulty: 'Intermediate',
    bookPdfUrl: 'https://api.chunks.online/books/harris/pdf',
  },
  {
    id: 'berg',
    title: 'Biochemistry',
    subject: 'Biology',
    description: 'Proteins, enzymes, metabolism, DNA replication, gene expression, and signal transduction.',
    coverColor: '#C4503A',
    emoji: '🧬',
    chapters: 34,
    difficulty: 'Advanced',
    bookPdfUrl: 'https://api.chunks.online/books/berg/pdf',
  },
  {
    id: 'netter',
    title: 'Atlas of Human Anatomy',
    subject: 'Medicine',
    description: "Netter's classic illustrated atlas covering every region of the human body.",
    coverColor: '#2C8C99',
    emoji: '🫀',
    chapters: 8,
    difficulty: 'Intermediate',
    bookPdfUrl: 'https://api.chunks.online/books/netter/pdf',
  },
  {
    id: 'anaphy2e',
    title: 'Anatomy & Physiology',
    subject: 'Medicine',
    description: 'Structure and function of the human body: cells, tissues, organs, and organ systems.',
    coverColor: '#1A5276',
    emoji: '🦷',
    chapters: 30,
    difficulty: 'Beginner',
    bookPdfUrl: 'https://api.chunks.online/books/anaphy2e/pdf',
  },
];

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

export default function BookGrid({ searchQuery, activeFilter }: BookGridProps) {
  const router = useRouter();

  const filtered = BOOKS.filter((book) => {
    const matchesQuery =
      searchQuery === '' ||
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      activeFilter === 'All' || book.subject === activeFilter || book.difficulty === activeFilter;
    return matchesQuery && matchesFilter;
  });

  const handleBookClick = (book: LibraryBook) => {
    const params = new URLSearchParams({ bookId: book.id, docTitle: book.title });
    if (book.bookPdfUrl) params.set('pdfUrl', book.bookPdfUrl);
    router.push(`/study?${params.toString()}`);
  };

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
      {filtered.map((book) => (
        <button
          key={book.id}
          className="book-card"
          onClick={() => handleBookClick(book)}
          aria-label={`Open ${book.title}`}
        >
          {/* Cover */}
          <div className="book-cover" style={{ background: book.coverColor }}>
            <span className="book-cover-emoji">{book.emoji}</span>
            <div className="book-cover-lines">
              <div /><div /><div />
            </div>
          </div>

          {/* Meta */}
          <div className="book-meta">
            <div className="book-subject">{book.subject}</div>
            <div className="book-title">{book.title}</div>
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
      ))}
    </div>
  );
}
