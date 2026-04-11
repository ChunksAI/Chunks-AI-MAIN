'use client';

import { useRef, useEffect } from 'react';
import { useStudy } from '@/contexts/StudyContext';
import type { NoteItem, TodoItem, AnyNote } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
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
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isNew = note.content === '' && note.createdAt === note.updatedAt;

  // Set initial innerHTML once on mount so contenteditable can edit freely
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.innerHTML = note.content.replace(/\n/g, '<br/>');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // Auto-focus the title of brand-new notes
  useEffect(() => {
    if (isNew && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [isNew]);

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1rem 1.25rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <input
          ref={titleRef}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: 16,
            fontWeight: 500,
            background: 'transparent',
            color: 'inherit',
            fontFamily: 'inherit',
          }}
          defaultValue={note.title}
          onBlur={(e) =>
            dispatch({
              type: 'UPDATE_NOTE',
              payload: { id: note.id, title: e.target.value, updatedAt: new Date().toISOString() },
            })
          }
        />
        <button
          title="Delete note"
          onClick={() => dispatch({ type: 'DELETE_NOTE', payload: note.id })}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text3)',
            padding: '2px 4px',
            borderRadius: 4,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>

      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        style={{
          minHeight: 80,
          fontSize: 13.5,
          lineHeight: 1.85,
          color: 'var(--text2)',
          outline: 'none',
        }}
        onBlur={() => {
          const content = contentRef.current?.innerText ?? '';
          dispatch({
            type: 'UPDATE_NOTE',
            payload: { id: note.id, content, updatedAt: new Date().toISOString() },
          });
        }}
      />

      <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 8 }}>
        Last edited {timeAgo(note.updatedAt)}
      </p>
    </div>
  );
}

// ─── Todo card ────────────────────────────────────────────────────────────────

function TodoCard({ todo }: { todo: TodoItem }) {
  const { dispatch } = useStudy();
  const checkedCount = todo.items.filter((item) => item.checked).length;
  const total = todo.items.length;
  const allDone = total > 0 && checkedCount === total;
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  return (
    <div
      style={{
        background: allDone ? 'var(--accent2-light, #f0fdf4)' : 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1rem 1.25rem',
        transition: 'background 0.2s',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>
          {allDone && '✅ '}
          {todo.title}
        </span>
        <button
          title="Delete to-do"
          onClick={() => dispatch({ type: 'DELETE_TODO', payload: todo.id })}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text3)',
            padding: '2px 4px',
            borderRadius: 4,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            height: 3,
            background: 'var(--surface2, #e5e7eb)',
            borderRadius: 2,
            overflow: 'hidden',
            marginBottom: 4,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'var(--accent2, #22c55e)',
              borderRadius: 2,
              transition: 'width 0.3s',
            }}
          />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {checkedCount} / {total} complete
        </span>
      </div>

      {/* Checklist items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {todo.items.map((item) => (
          <div
            key={item.id}
            onClick={() =>
              dispatch({ type: 'TOGGLE_TODO_ITEM', payload: { noteId: todo.id, itemId: item.id } })
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {/* Custom checkbox */}
            <div
              style={{
                width: 15,
                height: 15,
                border: item.checked ? 'none' : '1.5px solid var(--border)',
                borderRadius: 4,
                background: item.checked ? 'var(--accent2, #22c55e)' : 'transparent',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              {item.checked && (
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                  <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            <span
              style={{
                fontSize: 13.5,
                color: item.checked ? 'var(--text3)' : 'var(--text)',
                textDecoration: item.checked ? 'line-through' : 'none',
                transition: 'color 0.15s',
              }}
            >
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export default function NotesTab() {
  const { state, handleCreateNote } = useStudy();
  const { notes } = state;

  // Sort newest first
  const sorted = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="workspace-tab">
      <div className="ws-header">
        <div>
          <div className="ws-title">Notes</div>
          <div className="ws-meta">
            {notes.length === 0
              ? 'No notes yet'
              : `${notes.length} note${notes.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <button className="ws-add-btn" onClick={handleCreateNote}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Note
        </button>
      </div>

      {sorted.length === 0 ? (
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
          <p style={{ fontSize: 14 }}>
            No notes yet — click <strong>New Note</strong> to start.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 20,
            overflowY: 'auto',
          }}
        >
          {sorted.map((note: AnyNote) =>
            note.type === 'note' ? (
              <NoteCard key={note.id} note={note} />
            ) : (
              <TodoCard key={note.id} todo={note} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
