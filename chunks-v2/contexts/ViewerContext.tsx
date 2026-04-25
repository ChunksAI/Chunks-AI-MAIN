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
import type { ViewerAction, ViewerStatePayload } from '@/types/api';
import type { FBDData } from '@/lib/fbdParser';

// ─── State ────────────────────────────────────────────────────────────────────

export type ViewerType = 'none' | 'youtube' | 'pdf' | 'research' | 'fbd';

export interface ViewerState {
  /** Which kind of content is loaded in the left panel. */
  viewerType: ViewerType;

  // YouTube fields
  videoId: string | null;
  currentTimestamp: number;
  visibleSegment: string;

  // PDF fields
  /**
   * True when a PDF document is actively loaded in ContentPanel (centre panel).
   * Decoupled from viewerType / isViewerOpen so the AI always receives the
   * current PDF page even when the left-side viewer shows YouTube or Research.
   */
  pdfLoaded: boolean;
  pdfPage: number;
  pdfVisibleText: string;

  // Research fields
  researchUrl: string | null;

  // Panel open/close
  isViewerOpen: boolean;

  /** FBD data when viewerType === 'fbd'. */
  fbdData: FBDData | null;

  /** The most recently received viewer action, cleared after consumption.
   *  Preserved from the P1-7 stub for backward compatibility. */
  pendingAction: ViewerAction | null;
}

// ─── Backend payload shape ────────────────────────────────────────────────────

// ViewerStatePayload is imported from @/types/api (canonical definition) and
// re-exported here so consumers can import it from either location.
export type { ViewerStatePayload };

// ─── Actions ──────────────────────────────────────────────────────────────────

export type ViewerContextAction =
  | { type: 'OPEN_YOUTUBE'; videoId: string }
  | { type: 'SEEK_YOUTUBE'; timestamp: number }
  | { type: 'OPEN_RESEARCH'; url: string }
  | { type: 'OPEN_FBD'; fbdData: FBDData }
  | { type: 'CLOSE_VIEWER' }
  | { type: 'UPDATE_VISIBLE_SEGMENT'; segment: string }
  /** PDF (ContentPanel centre panel) — page tracking. */
  | { type: 'OPEN_PDF'; initialPage?: number }
  | { type: 'UPDATE_PDF_VIEW'; page: number; visibleText?: string }
  | { type: 'CLOSE_PDF' }
  /** Legacy — dispatched by StudyContext when the backend emits viewer_action. */
  | { type: 'SET_VIEWER_ACTION'; payload: ViewerAction }
  | { type: 'CLEAR_VIEWER_ACTION' };

// ─── Reducer ──────────────────────────────────────────────────────────────────

const INITIAL_STATE: ViewerState = {
  viewerType: 'none',
  videoId: null,
  currentTimestamp: 0,
  visibleSegment: '',
  pdfLoaded: false,
  pdfPage: 0,
  pdfVisibleText: '',
  researchUrl: null,
  isViewerOpen: false,
  fbdData: null,
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

    case 'OPEN_FBD':
      return {
        ...state,
        viewerType: 'fbd',
        fbdData: action.fbdData,
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

    case 'OPEN_PDF':
      return {
        ...state,
        pdfLoaded: true,
        pdfPage: action.initialPage ?? 1,
        pdfVisibleText: '',
      };

    case 'UPDATE_PDF_VIEW':
      return {
        ...state,
        pdfPage: action.page,
        pdfVisibleText: action.visibleText ?? state.pdfVisibleText,
      };

    case 'CLOSE_PDF':
      return {
        ...state,
        pdfLoaded: false,
        pdfPage: 0,
        pdfVisibleText: '',
      };

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
 * Priority:
 *  1. Left-panel viewer (YouTube, Research) when isViewerOpen.
 *  2. Centre-panel PDF (ContentPanel) when pdfLoaded — included even if the
 *     left viewer is closed so the AI always knows what page the user is on.
 *
 * Returns null when neither applies.
 */
export function buildViewerState(viewerCtx: ViewerState): ViewerStatePayload | null {
  // ── Left-panel viewer (YouTube, Research, or future PDF-in-viewer) ──────────
  if (viewerCtx.isViewerOpen && viewerCtx.viewerType !== 'none') {
    // FBD is a client-only viewer type — no server-side state to forward.
    if (viewerCtx.viewerType === 'fbd') return null;

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

  // ── Centre-panel PDF (ContentPanel) ────────────────────────────────────────
  // Always forwarded when a document is loaded so the AI knows which page
  // the user is reading, regardless of whether the left viewer is open.
  if (viewerCtx.pdfLoaded) {
    const payload: ViewerStatePayload = { type: 'pdf' };
    payload.pdf_page = viewerCtx.pdfPage;
    if (viewerCtx.pdfVisibleText) payload.pdf_visible_text = viewerCtx.pdfVisibleText;
    return payload;
  }

  return null;
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
