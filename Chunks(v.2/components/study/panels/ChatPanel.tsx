'use client';

import { useRef, useState } from 'react';
import { useStudy } from '@/contexts/StudyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import type { ChatMessage } from '@/types';

import MarkdownRenderer from '@/components/study/chat/MarkdownRenderer';

const QUICK_ACTIONS = [
  '✦ Explain simply',
  '📋 Study plan',
  '❓ Quiz me',
  '🔑 Key concepts',
  '↓ Summarize',
  '🗺️ Mind map',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="msg ai">
      <div className="msg-avatar ai">C</div>
      <div className="msg-body">
        <div className="ai-typing">
          <div className="typing-dots">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  userInitial,
  onActionClick,
}: {
  msg: ChatMessage;
  userInitial: string;
  onActionClick: (key: string) => void;
}) {
  if (msg.role === 'user') {
    return (
      <div className="msg user">
        <div className="msg-avatar user-av">{userInitial}</div>
        <div className="msg-body">
          <div className="msg-bubble">{msg.text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="msg ai">
      <div className="msg-avatar ai">C</div>
      <div className="msg-body">
        <span className="msg-sender">CHUNKS AI</span>
        <div className="msg-bubble"><MarkdownRenderer content={msg.text} /></div>
        {msg.memoryRecall && (
          <div className="memory-recall">
            🧠 <MarkdownRenderer content={msg.memoryRecall} />
          </div>
        )}
        {msg.performanceBars && msg.performanceBars.length > 0 && (
          <div className="performance-card">
            <div className="perf-title">YOUR UNDERSTANDING</div>
            <div className="perf-bars">
              {msg.performanceBars.map((bar) => (
                <div key={bar.label} className="perf-row">
                  <span className="perf-label">{bar.label}</span>
                  <div className="perf-bar-track">
                    <div
                      className="perf-bar-fill"
                      style={{ width: `${bar.pct}%`, background: bar.color }}
                    />
                  </div>
                  <span className="perf-pct">{bar.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {msg.actions && msg.actions.length > 0 && (
          <div className="ai-actions">
            {msg.actions.map((a) => (
              <button
                key={a.actionKey}
                className="ai-action-btn"
                onClick={() => onActionClick(a.actionKey)}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

/**
 * ChatPanel — reads all state from StudyContext and dispatches actions.
 * No longer needs props from the page — self-contained smart component.
 */
export default function ChatPanel() {
  const { state, dispatch, handleSendMessage, handleGenerateFlashcards, handleGenerateQuiz } =
    useStudy();
  const { user } = useAuth();
  const { messages, chatLoading, chatError, showMemoryBar, weakAreas, topic } = state;

  const userInitial = (user?.name?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase();

  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sentinelRef = useAutoScroll([messages, chatLoading]);

  // Build memory bar text from real weak areas
  const memoryText =
    weakAreas.length > 0
      ? `AI remembers: You struggled with ${weakAreas[0].topic} (${weakAreas[0].score}%). Let's revisit it.`
      : 'AI remembers: Keep asking questions — I track your weak areas over time.';

  const handleSend = async () => {
    const val = inputValue.trim();
    if (!val || chatLoading) return;
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await handleSendMessage(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  // Action chip handler — generates real content via context
  const handleActionClick = (key: string) => {
    const currentTopic = topic || 'the current topic';
    switch (key) {
      case 'flashcards':
      case 'flashcards2':
        void handleGenerateFlashcards(currentTopic);
        dispatch({ type: 'SET_ACTIVE_TAB', payload: 'workspace' });
        break;
      case 'quiz':
      case 'quiz2':
        void handleGenerateQuiz(currentTopic);
        dispatch({ type: 'SET_ACTIVE_TAB', payload: 'workspace' });
        break;
      case 'mindmap':
        dispatch({ type: 'SHOW_TOAST', payload: '��️ Mind map coming soon!' });
        break;
      default:
        break;
    }
  };

  // Quick-action toolbar handler
  const handleQuickAction = (label: string) => {
    const map: Record<string, string> = {
      '✦ Explain simply': 'Explain the current topic in simple terms.',
      '📋 Study plan': 'Create a study plan for this topic.',
      '❓ Quiz me': 'Give me a quick quiz on what I just read.',
      '🔑 Key concepts': 'What are the key concepts I need to remember?',
      '↓ Summarize': 'Summarize the main points of this topic.',
      '🗺️ Mind map': 'Create a mind map outline of this topic.',
    };
    const text = map[label];
    if (text) void handleSendMessage(text);
  };

  return (
    <div className="chat-panel">
      {/* ── Memory context bar ── */}
      {showMemoryBar && (
        <div className="memory-bar">
          <span className="memory-bar-icon">🧠</span>
          <span className="memory-bar-text">{memoryText}</span>
          <span
            className="memory-bar-dismiss"
            onClick={() => dispatch({ type: 'DISMISS_MEMORY_BAR' })}
          >
            ×
          </span>
        </div>
      )}

      {/* ── Inline error ── */}
      {chatError && (
        <div className="chat-error-bar">
          ⚠️ {chatError}
          <button onClick={() => dispatch({ type: 'CLEAR_CHAT_ERROR' })}>✕</button>
        </div>
      )}

      {/* ── Message list ── */}
      <div className="chat-messages">
        {messages.length === 0 && !chatLoading && (
          <div className="chat-empty">
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <div style={{ fontWeight: 500, marginBottom: 6 }}>Start a conversation</div>
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>
              Ask anything about your study material, or use the quick actions below.
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} userInitial={userInitial} onActionClick={handleActionClick} />
        ))}
        {chatLoading && <TypingIndicator />}
        <div ref={sentinelRef} />
      </div>

      {/* ── Input area ── */}
      <div className="chat-input-area">
        <div className="input-container">
          <div className="quick-actions">
            {QUICK_ACTIONS.map((label) => (
              <button key={label} className="quick-btn" onClick={() => handleQuickAction(label)}>
                {label}
              </button>
            ))}
          </div>
          <div className="text-input-row">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder="Ask a follow-up about your study material…"
              rows={1}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={chatLoading}
            />
            <button className="send-btn" onClick={() => void handleSend()} disabled={chatLoading}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div className="input-footer">
            <button className="input-tool-btn">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              Attach
            </button>
            <button className="input-tool-btn">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              Voice
            </button>
            <button className="think-toggle">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Think ∨
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
