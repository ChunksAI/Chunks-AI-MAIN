'use client';

/**
 * contexts/ChatContext.tsx — chat slice of the study session state.
 *
 * Owns all chat-related state (messages, loading, errors, chat mode) and
 * the corresponding reducer cases.  StudyProvider consumes this context
 * internally and merges it into the StudyContextValue so existing consumers
 * of useStudy() continue to work without changes.
 */

import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { ChatMessage, PerformanceBar } from '@/types';

// ─── State ────────────────────────────────────────────────────────────────────

export type ChatMode = 'snap' | 'chunk' | 'master' | 'research';

export interface ChatState {
  messages: ChatMessage[];
  chatLoading: boolean;
  chatError: string | null;
  /** The text of the most recent user message — used for per-message retry. */
  lastUserMessage: string;
  /** Active chat mode sent to the backend on each /ask request. */
  chatMode: ChatMode;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type ChatAction =
  | { type: 'SEND_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_LAST_USER_MESSAGE'; payload: string }
  | { type: 'SET_CHAT_LOADING'; payload: boolean }
  | { type: 'RECEIVE_MESSAGE'; payload: ChatMessage }
  | { type: 'START_AI_MESSAGE'; payload: ChatMessage }
  | { type: 'APPEND_MESSAGE_CHUNK'; payload: { id: string; chunk: string } }
  | { type: 'UPDATE_MESSAGE_META'; payload: { id: string; memoryRecall?: string; performanceBars?: PerformanceBar[]; topic?: string } }
  | { type: 'REMOVE_MESSAGE'; payload: string }
  | { type: 'MESSAGE_ERROR'; payload: string }
  | { type: 'HANDLE_CHAT_ERROR'; payload: { messageId: string; error: string } }
  | { type: 'CLEAR_CHAT_ERROR' }
  | { type: 'REPLACE_AI_MESSAGE'; payload: { id: string; text: string; actions?: { label: string; actionKey: string }[] } }
  | { type: 'SET_CHAT_MODE'; payload: ChatMode }
  /** Bulk-restore messages (e.g. from a session snapshot). */
  | { type: 'RESTORE_MESSAGES'; payload: ChatMessage[] }
  /** Reset chat to initial state while preserving chatMode preference. */
  | { type: 'RESET_CHAT' };

// ─── Initial state ────────────────────────────────────────────────────────────

export const INITIAL_CHAT_STATE: ChatState = {
  messages: [],
  chatLoading: false,
  chatError: null,
  lastUserMessage: '',
  chatMode: 'snap',
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SEND_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        chatLoading: true,
        chatError: null,
        lastUserMessage: action.payload.text,
      };

    case 'SET_LAST_USER_MESSAGE':
      return { ...state, lastUserMessage: action.payload };

    case 'SET_CHAT_LOADING':
      return { ...state, chatLoading: action.payload };

    case 'RECEIVE_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        chatLoading: false,
        chatError: null,
      };

    case 'START_AI_MESSAGE':
      // Adds an AI bubble without changing chatLoading — used during streaming
      // so the loading/stop state remains active while chunks are arriving.
      return {
        ...state,
        messages: [...state.messages, action.payload],
        chatError: null,
      };

    case 'APPEND_MESSAGE_CHUNK': {
      const messages = state.messages.map((m) =>
        m.id === action.payload.id
          ? { ...m, text: m.text + action.payload.chunk }
          : m,
      );
      return { ...state, messages };
    }

    case 'UPDATE_MESSAGE_META': {
      const messages = state.messages.map((m) =>
        m.id === action.payload.id
          ? {
              ...m,
              ...(action.payload.memoryRecall !== undefined
                ? { memoryRecall: action.payload.memoryRecall }
                : {}),
              ...(action.payload.performanceBars !== undefined
                ? { performanceBars: action.payload.performanceBars }
                : {}),
              ...(action.payload.topic !== undefined
                ? { topic: action.payload.topic }
                : {}),
            }
          : m,
      );
      return { ...state, messages };
    }

    case 'REMOVE_MESSAGE':
      return {
        ...state,
        messages: state.messages.filter((m) => m.id !== action.payload),
        chatLoading: false,
      };

    case 'MESSAGE_ERROR':
      return { ...state, chatLoading: false, chatError: action.payload };

    case 'HANDLE_CHAT_ERROR':
      return {
        ...state,
        chatLoading: false,
        chatError: action.payload.error,
        messages: state.messages.filter((m) => m.id !== action.payload.messageId),
      };

    case 'CLEAR_CHAT_ERROR':
      return { ...state, chatError: null };

    case 'REPLACE_AI_MESSAGE': {
      // Replaces placeholder text with the real answer and clears isPlaceholder.
      const messages = state.messages.map((m) =>
        m.id === action.payload.id
          ? {
              ...m,
              text: action.payload.text,
              isPlaceholder: false,
              ...(action.payload.actions !== undefined ? { actions: action.payload.actions } : {}),
            }
          : m,
      );
      return { ...state, messages };
    }

    case 'SET_CHAT_MODE':
      return { ...state, chatMode: action.payload };

    case 'RESTORE_MESSAGES':
      return { ...state, messages: action.payload };

    case 'RESET_CHAT':
      return {
        ...INITIAL_CHAT_STATE,
        // Preserve the user's chat mode preference across session resets
        chatMode: state.chatMode,
      };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ChatContextValue {
  chatState: ChatState;
  chatDispatch: Dispatch<ChatAction>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chatState, chatDispatch] = useReducer(chatReducer, INITIAL_CHAT_STATE);

  return (
    <ChatContext.Provider value={{ chatState, chatDispatch }}>
      {children}
    </ChatContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}
