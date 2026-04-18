'use client';

/**
 * contexts/ViewerContext.tsx — left-panel viewer state (P1-14).
 *
 * Single source of truth for the viewer panel (YouTube / PDF / Research).
 * Replaces the minimal P1-7 stub with full state so StudyProvider can
 * include viewer_state in every /ask request automatically.
 *
 * Preserved from the P1-7 stub:
 *   - pendingAction / SET_VIEWER_ACTION / CLEAR_VIEWER_ACTION
 *     (consumed by StudyContext to seek the embedded player)
 *
 * New in P1-14:
 *   - Full viewer panel state (viewerType, videoId, currentTimestamp, …)
 *   - Actions: OPEN_YOUTUBE, SEEK_YOUTUBE, OPEN_RESEARCH, CLOSE_VIEWER,
 *              UPDATE_VISIBLE_SEGMENT
 *   - buildViewerState() helper that serialises context state into the
 *     viewer_state dict shape expected by the backend /ask schema.
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

export type ViewerType = 'none' | 'youtube' | 'pdf' | 'research';

export interface ViewerState {
  /** Which kind of content is loaded in the left panel. */
  viewerType: ViewerType;

  // YouTube fields
  videoId: string | null;
  currentTimestamp: number;
  visibleSegment: string;

  // PDF fields
  pdfPage: number;
  pdfVisibleText: string;

  // Research fields
  researchUrl: string | null;

  // Panel open/close
  isViewerOpen: boolean;

  /** The most recently received viewer action, cleared after consumption.
   *  Preserved from the P1-7 stub for backward compatibility. */
  pendingAction: ViewerAction | null;
}

// ─── Backend payload shape ────────────────────────────────────────────────────

/**
 * The viewer_state dict shape expected by the backend /ask schema.
 * @see backend/routes/schemas.py AskRequest.viewer_state
 */
export interface ViewerStatePayload {
  type: ViewerType;
  video_id?: string;
  current_timestamp_seconds?: number;
  visible_segment?: string;
  pdf_page?: number;
  pdf_visible_text?: string;
  research_url?: string;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type ViewerContextAction =
  | { type: 'OPEN_YOUTUBE'; videoId: string }
  | { type: 'SEEK_YOUTUBE'; timestamp: number }
  | { type: 'OPEN_RESEARCH'; url: string }
  | { type: 'CLOSE_VIEWER' }
  | { type: 'UPDATE_VISIBLE_SEGMENT'; segment: string }
  /** Legacy — dispatched by StudyContext when the backend emits viewer_action. */
  | { type: 'SET_VIEWER_ACTION'; payload: ViewerAction }
  | { type: 'CLEAR_VIEWER_ACTION' };

// ─── Reducer ──────────────────────────────────────────────────────────────────

const INITIAL_STATE: ViewerState = {
  viewerType: 'none',
  videoId: null,
  currentTimestamp: 0,
  visibleSegment: '',
  pdfPage: 0,
  pdfVisibleText: '',
  researchUrl: null,
  isViewerOpen: false,
  pendingAction: null,
};

function viewerReducer(state: ViewerState, action: ViewerContextAction): ViewerState {
  switch (action.type) {
    case 'OPEN_YOUTUBE':
      return {
        ...state,
        viewerType: 'youtube',
        videoId: action.videoId,
        currentTimestamp: 0,
        visibleSegment: '',
        isViewerOpen: true,
      };

    case 'SEEK_YOUTUBE':
      return { ...state, currentTimestamp: action.timestamp };

    case 'OPEN_RESEARCH':
      return {
        ...state,
        viewerType: 'research',
        researchUrl: action.url,
        isViewerOpen: true,
      };

    case 'CLOSE_VIEWER':
      return {
        ...state,
        viewerType: 'none',
        isViewerOpen: false,
      };

    case 'UPDATE_VISIBLE_SEGMENT':
      return { ...state, visibleSegment: action.segment };

    case 'SET_VIEWER_ACTION':
      return { ...state, pendingAction: action.payload };

    case 'CLEAR_VIEWER_ACTION':
      return { ...state, pendingAction: null };

    default:
      return state;
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Serialise ViewerContext state into the viewer_state dict shape expected
 * by the backend /ask schema (AskRequest.viewer_state).
 *
 * Returns null when no viewer is open so the backend treats it as absent.
 */
export function buildViewerState(viewerCtx: ViewerState): ViewerStatePayload | null {
  if (viewerCtx.viewerType === 'none' || !viewerCtx.isViewerOpen) {
    return null;
  }

  const payload: ViewerStatePayload = { type: viewerCtx.viewerType };

  if (viewerCtx.viewerType === 'youtube') {
    if (viewerCtx.videoId) payload.video_id = viewerCtx.videoId;
    payload.current_timestamp_seconds = viewerCtx.currentTimestamp;
    if (viewerCtx.visibleSegment) payload.visible_segment = viewerCtx.visibleSegment;
  } else if (viewerCtx.viewerType === 'pdf') {
    payload.pdf_page = viewerCtx.pdfPage;
    if (viewerCtx.pdfVisibleText) payload.pdf_visible_text = viewerCtx.pdfVisibleText;
  } else if (viewerCtx.viewerType === 'research') {
    if (viewerCtx.researchUrl) payload.research_url = viewerCtx.researchUrl;
  }

  return payload;
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
