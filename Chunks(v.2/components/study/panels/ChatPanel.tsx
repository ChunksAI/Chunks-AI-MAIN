'use client';

import { useRef, useEffect, useState } from 'react';
import type { ChatMessage } from '@/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onActionClick: (key: string) => void;
  onMemoryDismiss: () => void;
  showMemoryBar: boolean;
}

const QUICK_ACTIONS = ['✦ Explain simply', '📋 Study plan', '❓ Quiz me', '🔑 Key concepts', '↓ Summarize', '🗺️ Mind map'];

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

function MessageBubble({ msg, onActionClick }: { msg: ChatMessage; onActionClick: (key: string) => void }) {
  if (msg.role === 'user') {
    return (
      <div className="msg user">
        <div className="msg-avatar user-av">D</div>
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
        <div
          className="msg-bubble"
          dangerouslySetInnerHTML={{ __html: msg.text }}
        />
        {msg.memoryRecall && (
          <div className="memory-recall">
            🧠 <span dangerouslySetInnerHTML={{ __html: msg.memoryRecall }} />
          </div>
        )}
        {msg.performanceBars && msg.performanceBars.length > 0 && (
          <div className="performance-card">
            <div className="perf-title">YOUR UNDERSTANDING — CELL BIOLOGY</div>
            <div className="perf-bars">
              {msg.performanceBars.map((bar) => (
                <div key={bar.label} className="perf-row">
                  <span className="perf-label">{bar.label}</span>
                  <div className="perf-bar-track">
                    <div className="perf-bar-fill" style={{ width: `${bar.pct}%`, background: bar.color }} />
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
              <button key={a.actionKey} className="ai-action-btn" onClick={() => onActionClick(a.actionKey)}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({ messages, onSendMessage, onActionClick, onMemoryDismiss, showMemoryBar }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    const val = inputValue.trim();
    if (!val) return;
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);
    onSendMessage(val);
    // Simulate typing delay — parent controls when new message arrives
    setTimeout(() => setIsTyping(false), 1400);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className="chat-panel">
      {/* ── Memory context bar ── */}
      {showMemoryBar && (
        <div className="memory-bar">
          <span className="memory-bar-icon">🧠</span>
          <span className="memory-bar-text">
            AI remembers: You struggled with <strong>ATP synthesis</strong> last session. Let&apos;s revisit it.
          </span>
          <span className="memory-bar-dismiss" onClick={onMemoryDismiss}>×</span>
        </div>
      )}

      {/* ── Message list ── */}
      <div className="chat-messages">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} onActionClick={onActionClick} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div className="chat-input-area">
        <div className="input-container">
          <div className="quick-actions">
            {QUICK_ACTIONS.map((label) => (
              <button key={label} className="quick-btn">{label}</button>
            ))}
          </div>
          <div className="text-input-row">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder="Ask a follow-up about Chapter 3…"
              rows={1}
              value={inputValue}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
            />
            <button className="send-btn" onClick={handleSend}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <div className="input-footer">
            <button className="input-tool-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              Attach
            </button>
            <button className="input-tool-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              Voice
            </button>
            <button className="think-toggle">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Think ∨
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
