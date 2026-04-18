'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useStudy } from '@/contexts/StudyContext';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import type { ChatMessage } from '@/types';

import MarkdownRenderer from '@/components/study/chat/MarkdownRenderer';
import MessageActions from '@/components/study/chat/MessageActions';
import { resolveStudyTopic, cleanTopic } from '@/lib/topicFallback';
import { useTutorBrain } from '@/hooks/useTutorBrain';
import { useToast } from '@/contexts/ToastContext';
import { evaluateSocraticAnswer } from '@/lib/studyApi';
import { extractTopicFromResponse } from '@/lib/extractTopic';

const GAP_MARKER = 'Check your understanding →';

/**
 * Splits markdown text at the "Check your understanding →" label so the
 * CTA section can be wrapped in a styled callout block.
 * Returns null when the marker is not present.
 */
function splitAtGapMarker(text: string): { mainText: string; ctaText: string } | null {
  const idx = text.indexOf(GAP_MARKER);
  if (idx === -1) return null;
  // Walk back to the start of the line that contains the marker
  let lineStart = idx;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') {
    lineStart--;
  }
  return {
    mainText: text.slice(0, lineStart).trimEnd(),
    ctaText:  text.slice(lineStart),
  };
}

const STRUGGLE_PHRASES = [
  "i don't understand",
  "i don't get",
  "still confused",
  "explain again",
  "what does that mean",
  "lost me",
  "can you simplify",
];

const QUICK_ACTIONS = [
  '✦ Explain simply',
  '📋 Study plan',
  '❓ Quiz me',
  '🔑 Key concepts',
  '↓ Summarize',
];

const CHAT_MODES = [
  { key: 'snap',     label: 'Snap',     description: 'Real-time solutions' },
  { key: 'chunk',    label: 'Chunk',    description: 'Guided learning' },
  { key: 'master',   label: 'Master',   description: 'Advanced reasoning' },
  { key: 'research', label: 'Research', description: 'Comprehensive discovery' },
] as const;
type ChatModeKey = (typeof CHAT_MODES)[number]['key'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="msg ai">
      <div className="msg-body">
        <div className="msg-bubble">
          <div className="ai-typing">
            <div className="typing-dots">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  onActionClick,
  isStreaming,
}: {
  msg: ChatMessage;
  onActionClick: (key: string) => void;
  isStreaming?: boolean;
}) {
  if (msg.role === 'user') {
    return (
      <div className="msg user">
        <div className="msg-body">
          <div className="msg-bubble">{msg.text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="msg ai">
      <div className="msg-body">
        <div className="msg-bubble">
          {msg.isPlaceholder ? (
            <span className="msg-placeholder">{msg.text}</span>
          ) : (() => {
            const split = !isStreaming ? splitAtGapMarker(msg.text) : null;
            if (split) {
              return (
                <>
                  {split.mainText && <MarkdownRenderer content={split.mainText} />}
                  <div className="gap-cta">
                    <MarkdownRenderer content={split.ctaText} />
                  </div>
                </>
              );
            }
            return <MarkdownRenderer content={msg.text} />;
          })()}
          {isStreaming && !msg.isPlaceholder && msg.text.trim() && <span className="streaming-dot" aria-hidden="true" />}
          {!isStreaming && !msg.isPlaceholder && !msg.text.trim() && (
            <span className="msg-empty-response">
              No response received — please retry.
            </span>
          )}
        </div>
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
        {!isStreaming && !msg.isPlaceholder && msg.text.trim() && msg.actions && msg.actions.length > 0 && (
          <div className="ai-actions">
            {msg.actions.map((a) => (
              <button
                key={a.actionKey}
                className="ai-action-btn"
                onClick={() => onActionClick(a.actionKey)}
                style={a.actionKey === 'mindmap' ? { display: 'none' } : undefined}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        {/* Per-message actions: Copy, Retry, Feedback — only shown once AI has content */}
        {!isStreaming && !msg.isPlaceholder && msg.text.trim() && <MessageActions msg={msg} />}
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
  const {
    state,
    dispatch,
    handleSendMessage,
    handleGenerateFlashcards,
    handleGenerateQuiz,
    handleUploadDocument,
    handleStop,
  } = useStudy();
  const { messages, chatLoading, chatError, showMemoryBar, weakAreas, topic, docTitle, chatMode, pdfBlobUrl, slides, uploadLoading, uploadError } = state;

  // Banner is shown when no document is present and not in the middle of uploading
  const hasDocument = !!(pdfBlobUrl || slides.length > 0 || uploadLoading);

  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useAutoScroll([messages, chatLoading]);

  // ── Socratic response tracking ──────────────────────────────────────────────
  // When the last AI message contains the "Check your understanding →" marker
  // we know the AI asked a Socratic question.  The next user message is treated
  // as the student's answer, and after the AI responds we detect correctness.
  // Whether we're currently waiting for the AI to evaluate a Socratic answer
  const pendingSocraticRef = useRef<{ question: string; answer: string; topic: string } | null>(null);

  const { toast } = useToast();

  // ── Voice input ──────────────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);

  const handleVoice = () => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      toast.error('Voice input is not supported in this browser');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInputValue((prev) => prev + transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  };

  // ── Mode dropdown (portal) ────────────────────────────────────────────────
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  // Refs for the trigger button and the portal <ul> (for outside-click detection)
  const modeWrapRef = useRef<HTMLDivElement>(null);
  const modeBtnRef = useRef<HTMLButtonElement>(null);
  const modeMenuRef = useRef<HTMLUListElement>(null);

  /** Compute fixed-position coordinates from the trigger button's bounding rect. */
  const calcDropdownPos = useCallback(() => {
    if (!modeBtnRef.current) return;
    const rect = modeBtnRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.top - 6,           // 6 px gap above the button
      right: window.innerWidth - rect.right,
    });
  }, []);

  const openModeMenu = () => {
    calcDropdownPos();
    setModeMenuOpen(true);
  };

  // Reposition on scroll / resize while open
  useEffect(() => {
    if (!modeMenuOpen) return;
    window.addEventListener('scroll', calcDropdownPos, true);
    window.addEventListener('resize', calcDropdownPos);
    return () => {
      window.removeEventListener('scroll', calcDropdownPos, true);
      window.removeEventListener('resize', calcDropdownPos);
    };
  }, [modeMenuOpen, calcDropdownPos]);

  // Close on outside click (checks both the trigger wrapper and the portal menu)
  useEffect(() => {
    if (!modeMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideBtn = modeWrapRef.current?.contains(target) ?? false;
      const insideMenu = modeMenuRef.current?.contains(target) ?? false;
      if (!insideBtn && !insideMenu) {
        setModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [modeMenuOpen]);

  // Build memory bar text from real weak areas
  const memoryText =
    weakAreas.length > 0
      ? `AI remembers: You struggled with ${cleanTopic(weakAreas[0].topic)} (${weakAreas[0].score}%). Let's revisit it.`
      : 'AI remembers: Keep asking questions — I track your weak areas over time.';

  const { tbRecordGap, tbRecordStudying, tbRecordSocraticPass } = useTutorBrain();

  // Derive the topic of the most recent AI response. Prefer the `topic` field
  // stored on the message (populated from the backend's structured extraction)
  // and fall back to regex-based heading parsing for snap-mode responses.
  const lastAiMessage = [...messages].reverse().find((m) => m.role === 'ai' && m.text.trim());
  const lastTopic = lastAiMessage
    ? (lastAiMessage.topic || extractTopicFromResponse(lastAiMessage.text))
    : '';

  // Detect if the last AI message contains a Socratic question
  const lastAiSplit = lastAiMessage && !chatLoading
    ? splitAtGapMarker(lastAiMessage.text)
    : null;
  const lastSocraticQuestion = lastAiSplit?.ctaText
    ? lastAiSplit.ctaText.replace(/^\s*\*\*Check your understanding →\*\*\s*/i, '').trim()
    : null;

  const handleSend = async () => {
    const val = inputValue.trim();
    if (!val || chatLoading) return;
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Detect struggle phrases and record gap in tutor brain
    const lower = val.toLowerCase();
    if (lastTopic && STRUGGLE_PHRASES.some((p) => lower.includes(p))) {
      tbRecordGap(lastTopic);
      tbRecordStudying(lastTopic);
    }

    // If the last AI message had a Socratic question, mark this as the student's answer
    // Only capture if no evaluation is already pending (prevents double-overwrite)
    if (lastSocraticQuestion && lastTopic && !pendingSocraticRef.current) {
      pendingSocraticRef.current = {
        question: lastSocraticQuestion,
        answer: val,
        topic: lastTopic,
      };
    }

    await handleSendMessage(val);

    // After the AI has responded, evaluate the Socratic answer (fire-and-forget)
    if (pendingSocraticRef.current) {
      const pending = pendingSocraticRef.current;
      pendingSocraticRef.current = null;
      evaluateSocraticAnswer(pending.question, pending.answer, pending.topic)
        .then((res) => {
          if (res.correct) {
            // Correct → advance through failing→reviewing→recovering→mastered
            tbRecordSocraticPass(pending.topic);
          } else {
            // Incorrect → ensure concept is tracked as a gap
            tbRecordGap(pending.topic);
          }
        })
        .catch(() => {
          // Best-effort — silently ignore evaluation failures
        });
    }
  };

  const handleStopClick = () => {
    handleStop();
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

  const handleModeSelect = (key: ChatModeKey) => {
    dispatch({ type: 'SET_CHAT_MODE', payload: key });
    setModeMenuOpen(false);
  };

  const handleAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void handleUploadDocument(file);
    e.target.value = '';
  };

  // Action chip handler — generates real content via context
  const handleActionClick = (key: string) => {
    const currentTopic = resolveStudyTopic(topic, docTitle, messages);
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
        // Mind map is hidden (display:none on the button) until implemented
        break;
      default:
        break;
    }
  };

  // Quick-action toolbar handler
  const handleQuickAction = (label: string) => {
    if (label === '❓ Quiz me') {
      const currentTopic = resolveStudyTopic(topic, docTitle, messages);
      void handleGenerateQuiz(currentTopic);
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'workspace' });
      return;
    }
    const map: Record<string, string> = {
      '✦ Explain simply': 'Explain the current topic in simple terms.',
      '📋 Study plan': `Create a structured study plan with a checklist for "${cleanTopic(resolveStudyTopic(topic, docTitle, messages))}". Format it as a numbered list of actionable tasks.`,
      '🔑 Key concepts': 'What are the key concepts I need to remember?',
      '↓ Summarize': 'Summarize the main points of this topic.',
    };
    const text = map[label];
    if (text) void handleSendMessage(text);
  };

  return (
    <div className="chat-panel">
      {/* Hidden file input for PDF attachment */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ── Document upload banner (only when no document is loaded) ── */}
      {!hasDocument && (
        <div className="doc-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: 'var(--text3)' }}>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <span>Attach a PDF to study from your document</span>
          <button className="doc-banner-btn" onClick={handleAttach}>Attach PDF</button>
          {uploadError && <span className="doc-banner-error">⚠️ {uploadError}</span>}
        </div>
      )}

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
        <div className="chat-col">
          {messages.length === 0 && !chatLoading && (
            <div className="chat-empty">
              <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
              <div style={{ fontWeight: 500, marginBottom: 6 }}>Start a conversation</div>
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>
                Ask anything about your study material, or use the quick actions below.
              </div>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isLastMessage = idx === messages.length - 1;
            const isStreaming = chatLoading && isLastMessage && msg.role === 'ai';
            return (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onActionClick={handleActionClick}
                isStreaming={isStreaming}
              />
            );
          })}
          {/* Typing indicator: show when loading but no AI text yet */}
          {chatLoading && (
            messages.length === 0 ||
            messages[messages.length - 1]?.role === 'user' ||
            (messages[messages.length - 1]?.role === 'ai' && !messages[messages.length - 1]?.text.trim())
          ) ? (
            <TypingIndicator />
          ) : null}
          <div ref={sentinelRef} />
        </div>
      </div>

      {/* ── Input area ── */}
      <div className="chat-input-area">
        <div className="chat-col">
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
            {chatLoading ? (
              <button
                className="send-btn send-btn--stop"
                onClick={handleStopClick}
                aria-label="Stop generation"
                title="Stop"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={() => void handleSend()}
                disabled={!inputValue.trim()}
                aria-label="Send message"
              >
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
            )}
          </div>
          <div className="input-footer">
            <button className="input-tool-btn" onClick={handleAttach} title="Attach PDF">
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
            <button
              className={`input-tool-btn${isListening ? ' active' : ''}`}
              onClick={handleVoice}
              title={isListening ? 'Listening…' : 'Voice input'}
            >
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
              {isListening ? 'Listening…' : 'Voice'}
            </button>
            <div className="mode-dropdown-wrap" ref={modeWrapRef}>
              <button
                ref={modeBtnRef}
                className="mode-dropdown-btn"
                onClick={() => (modeMenuOpen ? setModeMenuOpen(false) : openModeMenu())}
                title="Select chat mode"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="8 12 12 16 16 12" />
                </svg>
                {CHAT_MODES.find((m) => m.key === chatMode)?.label ?? 'Snap'}
              </button>
              {modeMenuOpen && dropdownPos !== null && ReactDOM.createPortal(
                <ul
                  ref={modeMenuRef}
                  className="mode-dropdown-menu-portal"
                  role="listbox"
                  style={{ top: dropdownPos.top, right: dropdownPos.right }}
                >
                  {CHAT_MODES.map((m) => (
                    <li
                      key={m.key}
                      role="option"
                      aria-selected={chatMode === m.key}
                      className={`mode-dropdown-item${chatMode === m.key ? ' active' : ''}`}
                      onClick={() => handleModeSelect(m.key)}
                    >
                      <span className="mode-dropdown-label">{m.label}</span>
                      <span className="mode-dropdown-desc">{m.description}</span>
                    </li>
                  ))}
                </ul>,
                document.body,
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
