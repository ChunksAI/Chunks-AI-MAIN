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
}

const BOOKS: LibraryBook[] = [
  {
    id: 'biology-101',
    title: 'Introduction to Biology',
    subject: 'Biology',
    description: 'Cell structure, genetics, evolution, and the building blocks of life.',
    coverColor: '#4A7C59',
    emoji: '🧬',
    chapters: 12,
    difficulty: 'Beginner',
  },
  {
    id: 'calculus-fundamentals',
    title: 'Calculus Fundamentals',
    subject: 'Mathematics',
    description: 'Limits, derivatives, integrals, and the foundations of calculus.',
    coverColor: '#3A5FC4',
    emoji: '∫',
    chapters: 10,
    difficulty: 'Intermediate',
  },
  {
    id: 'world-history',
    title: 'World History: Ancient to Modern',
    subject: 'History',
    description: 'Civilizations, empires, revolutions, and the shaping of the modern world.',
    coverColor: '#C4923A',
    emoji: '🌍',
    chapters: 16,
    difficulty: 'Intermediate',
  },
  {
    id: 'chemistry-organic',
    title: 'Organic Chemistry',
    subject: 'Chemistry',
    description: 'Carbon compounds, reaction mechanisms, and organic synthesis.',
    coverColor: '#9B59B6',
    emoji: '⚗️',
    chapters: 14,
    difficulty: 'Advanced',
  },
  {
    id: 'physics-mechanics',
    title: 'Classical Mechanics',
    subject: 'Physics',
    description: "Newton's laws, kinematics, energy, and momentum.",
    coverColor: '#C4503A',
    emoji: '⚛️',
    chapters: 11,
    difficulty: 'Intermediate',
  },
  {
    id: 'literature-english',
    title: 'English Literature Survey',
    subject: 'Literature',
    description: 'Shakespeare to modernism — close reading and literary analysis.',
    coverColor: '#2C8C99',
    emoji: '📖',
    chapters: 9,
    difficulty: 'Beginner',
  },
  {
    id: 'economics-micro',
    title: 'Microeconomics',
    subject: 'Economics',
    description: 'Supply and demand, market structures, consumer behaviour, and pricing.',
    coverColor: '#7D6608',
    emoji: '📈',
    chapters: 8,
    difficulty: 'Beginner',
  },
  {
    id: 'cs-algorithms',
    title: 'Data Structures & Algorithms',
    subject: 'Computer Science',
    description: 'Sorting, searching, graphs, dynamic programming, and complexity.',
    coverColor: '#1A5276',
    emoji: '💻',
    chapters: 13,
    difficulty: 'Advanced',
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
