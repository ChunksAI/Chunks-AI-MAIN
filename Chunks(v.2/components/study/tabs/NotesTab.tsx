'use client';

import { useStudy } from '@/contexts/StudyContext';
import type { NoteItem } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// ─── Note card ────────────────────────────────────────────────────────────────

function NoteCard({ note }: { note: NoteItem }) {
  const { dispatch } = useStudy();

  return (
    <div className="review-card">
      <input
        className="note-title-input"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 500,
          marginBottom: 12,
          letterSpacing: -0.2,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          width: '100%',
          color: 'inherit',
        }}
        defaultValue={note.title}
        onBlur={(e) =>
          dispatch({ type: 'UPDATE_NOTE', payload: { id: note.id, title: e.target.value } })
        }
      />
      <textarea
        className="note-body-textarea"
        style={{
          fontSize: 13.5,
          color: 'var(--text2)',
          lineHeight: 1.85,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          width: '100%',
          resize: 'vertical',
          minHeight: 120,
          fontFamily: 'inherit',
        }}
        defaultValue={note.body}
        placeholder="Start typing your notes here…"
        onBlur={(e) =>
          dispatch({ type: 'UPDATE_NOTE', payload: { id: note.id, body: e.target.value } })
        }
      />
      <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 8 }}>
        Auto-saved · Last edited {formatRelative(note.updatedAt)}
      </p>
    </div>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export default function NotesTab() {
  const { state, handleAddNote } = useStudy();
  const { notes, docTitle } = state;

  return (
    <div className="workspace-tab">
      <div className="ws-header">
        <div>
          <div className="ws-title">Notes</div>
          <div className="ws-meta">
            {notes.length > 0
              ? `Auto-saved · ${notes.length} note${notes.length === 1 ? '' : 's'}${docTitle ? ` · ${docTitle}` : ''}`
              : 'No notes yet'}
          </div>
        </div>
        <button className="ws-add-btn" onClick={handleAddNote}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Note
        </button>
      </div>

      {notes.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '64px 24px',
            color: 'var(--text3)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 32 }}>📝</span>
          <p style={{ fontSize: 14 }}>No notes yet — click <strong>New Note</strong> to start.</p>
        </div>
      ) : (
        <div className="ws-grid">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
