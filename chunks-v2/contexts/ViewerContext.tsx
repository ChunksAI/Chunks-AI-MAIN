'use client';

/**
 * contexts/ViewerContext.tsx — viewer panel state stub (P1-7).
 *
 * Stores the most recent viewer_action emitted by the backend so the
 * embedded YouTube / PDF / Research panel can react to AI citations.
 *
 * The full viewer panel state (URL, timestamp, type, etc.) will be
 * migrated here in P2-1.  For now this context is minimal: it only
 * tracks the pending action that StudyContext dispatches after each
 * /ask response that includes a viewer_action.
 */

import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { ViewerAction } from '@/types/api';

// ─── State ────────────────────────────────────────────────────────────────────

export interface ViewerState {
  /** The most recently received viewer action, cleared after consumption. */
  pendingAction: ViewerAction | null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type ViewerContextAction =
  | { type: 'SET_VIEWER_ACTION'; payload: ViewerAction }
  | { type: 'CLEAR_VIEWER_ACTION' };

// ─── Reducer ──────────────────────────────────────────────────────────────────

const INITIAL_STATE: ViewerState = { pendingAction: null };

function viewerReducer(state: ViewerState, action: ViewerContextAction): ViewerState {
  switch (action.type) {
    case 'SET_VIEWER_ACTION':
      return { ...state, pendingAction: action.payload };
    case 'CLEAR_VIEWER_ACTION':
      return { ...state, pendingAction: null };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ViewerContextValue {
  viewerState: ViewerState;
  viewerDispatch: Dispatch<ViewerContextAction>;
}

const ViewerCtx = createContext<ViewerContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ViewerProvider({ children }: { children: ReactNode }) {
  const [viewerState, viewerDispatch] = useReducer(viewerReducer, INITIAL_STATE);
  return (
    <ViewerCtx.Provider value={{ viewerState, viewerDispatch }}>
      {children}
    </ViewerCtx.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useViewerContext(): ViewerContextValue {
  const ctx = useContext(ViewerCtx);
  if (!ctx) throw new Error('useViewerContext must be used inside ViewerProvider');
  return ctx;
}
