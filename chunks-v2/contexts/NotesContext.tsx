'use client';

/**
 * contexts/NotesContext.tsx — notes and todos slice of the study session state.
 *
 * Owns all notes-related state (notes, todos) and the corresponding reducer
 * cases.  StudyProvider consumes this context internally and merges it into
 * the StudyContextValue so existing consumers of useStudy() remain
 * backward-compatible.
 */

import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { AnyNote, NoteItem, TodoItem } from '@/types';

// ─── State ────────────────────────────────────────────────────────────────────

export interface NotesState {
  notes: AnyNote[];
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type NotesAction =
  | { type: 'ADD_NOTE'; payload: NoteItem }
  | { type: 'UPDATE_NOTE'; payload: { id: string; title?: string; content?: string; updatedAt: string } }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'ADD_TODO'; payload: TodoItem }
  | { type: 'TOGGLE_TODO_ITEM'; payload: { noteId: string; itemId: string } }
  | { type: 'DELETE_TODO'; payload: string }
  /** Bulk-restore notes (e.g. from a session snapshot). */
  | { type: 'RESTORE_NOTES'; payload: AnyNote[] }
  /** Reset notes on session reset. */
  | { type: 'RESET_NOTES' };

// ─── Initial state ────────────────────────────────────────────────────────────

export const INITIAL_NOTES_STATE: NotesState = {
  notes: [],
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function notesReducer(state: NotesState, action: NotesAction): NotesState {
  switch (action.type) {
    case 'ADD_NOTE':
      return { ...state, notes: [...state.notes, action.payload] };

    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map((n): AnyNote => {
          if (n.id !== action.payload.id || n.type !== 'note') return n;
          return {
            ...n,
            ...(action.payload.title !== undefined ? { title: action.payload.title } : {}),
            ...(action.payload.content !== undefined ? { content: action.payload.content } : {}),
            updatedAt: action.payload.updatedAt,
          };
        }),
      };

    case 'DELETE_NOTE':
    case 'DELETE_TODO':
      return { ...state, notes: state.notes.filter((n) => n.id !== action.payload) };

    case 'ADD_TODO':
      return { ...state, notes: [...state.notes, action.payload] };

    case 'TOGGLE_TODO_ITEM':
      return {
        ...state,
        notes: state.notes.map((n): AnyNote => {
          if (n.id !== action.payload.noteId || n.type !== 'todo') return n;
          return {
            ...n,
            items: n.items.map((item) =>
              item.id !== action.payload.itemId
                ? item
                : { ...item, checked: !item.checked },
            ),
          };
        }),
      };

    case 'RESTORE_NOTES':
      return { ...state, notes: action.payload };

    case 'RESET_NOTES':
      return INITIAL_NOTES_STATE;

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface NotesContextValue {
  notesState: NotesState;
  notesDispatch: Dispatch<NotesAction>;
}

const NotesContext = createContext<NotesContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notesState, notesDispatch] = useReducer(notesReducer, INITIAL_NOTES_STATE);

  return (
    <NotesContext.Provider value={{ notesState, notesDispatch }}>
      {children}
    </NotesContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotesContext(): NotesContextValue {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotesContext must be used within NotesProvider');
  return ctx;
}
