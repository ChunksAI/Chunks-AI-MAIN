'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useStudy } from '@/contexts/StudyContext';
import { useViewerContext } from '@/contexts/ViewerContext';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import type { ChatMessage } from '@/types';

import MarkdownRenderer from '@/components/study/chat/MarkdownRenderer';
import MessageActions from '@/components/study/chat/MessageActions';
import ChunkCard from '@/components/study/ChunkCard';
import ResearchCard from '@/components/study/ResearchCard';
import { resolveStudyTopic, cleanTopic } from '@/lib/topicFallback';
import { useTutorBrain } from '@/hooks/useTutorBrain';
import { useToast } from '@/contexts/ToastContext';
import { evaluateSocraticAnswer } from '@/lib/studyApi';
import { extractTopicFromResponse } from '@/lib/extractTopic';
import { useAuth } from '@/contexts/AuthContext';

const GAP_MARKER = 'Check your understanding →';

/**
 * Matches a YouTube video URL (standard watch, shorts, embed) including
 * optional www./m. subdomain prefix.  Used to intercept paste-to-ingest.
 * Keep in sync with _YT_URL_RE in backend/routes/chat.py.
 */
const YT_URL_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;

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

// Phrases that signal the student has grasped the current topic.
// When detected, the topic is moved to "mastered" in the tutor brain.
const UNDERSTANDING_PHRASES = [
  "i understand",
  "i get it",
  "i got it",
  "i get this",
  "i got this",
  "got it",
  "that makes sense",
  "makes sense now",
  "now i understand",
  "i understand now",
  "that's clear",
  "that is clear",
  "clear now",
  "understood",
  "i'm good",
  "i am good",
  "i know this",
  "i know it now",
  "thank you, i understand",
  "thank you i understand",
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

// Staged placeholder labels shown while Research mode is waiting for a response.
// Timings (ms from placeholder appearing): 0 / 8 000 / 16 000 / 20 000 / 45 000.
const RESEARCH_STAGES = [
  '🔎 Searching sources…',
  '📚 Reading evidence…',
  '🧠 Synthesizing findings…',
  'Still researching sources…',
  'This is taking longer than usual.',
] as const;

function MessageBubble({
  msg,
  onActionClick,
  isStreaming,
  onRetry,
  onCancel,
  onCitationClick,
}: {
  msg: ChatMessage;
  onActionClick: (key: string) => void;
  isStreaming?: boolean;
  onRetry?: () => void;
  /** Called when the user clicks Cancel on a non-streaming placeholder bubble. */
  onCancel?: () => void;
  /** When provided, clicking a source citation chip opens it in the viewer panel. */
  onCitationClick?: (url: string) => void;
}) {
  // For Research-mode placeholders, cycle through RESEARCH_STAGES to give the user
  // a sense of progress. For other non-streaming modes, fall back to a simple 20 s
  // slow-warning.  All timers are cleared once isPlaceholder becomes false.
  const [slowWarning, setSlowWarning] = useState(false);
  const [researchStage, setResearchStage] = useState(0);
  const isResearch = msg.mode === 'research';
  useEffect(() => {
    if (!msg.isPlaceholder) {
      setSlowWarning(false);
      setResearchStage(0);
      return;
    }
    if (isResearch) {
      // Stage timings: 8 s → evidence, 16 s → synthesizing, 20 s → still, 45 s → slow
      const timers = [
        setTimeout(() => setResearchStage(1), 8_000),
        setTimeout(() => setResearchStage(2), 16_000),
        setTimeout(() => setResearchStage(3), 20_000),
        setTimeout(() => setResearchStage(4), 45_000),
      ];
      return () => timers.forEach(clearTimeout);
    }
    const timer = setTimeout(() => setSlowWarning(true), 20_000);
    return () => clearTimeout(timer);
  }, [msg.isPlaceholder, isResearch]);
  if (msg.role === 'user') {
    return (
      <div className="msg user">
        <div className="msg-body">
          {msg.imageDataUrl && (
            <img
              src={msg.imageDataUrl}
              alt="Attached image"
              className="msg-image-thumb"
            />
          )}
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
            <>
              <span className="msg-placeholder">
                {isResearch
                  ? RESEARCH_STAGES[researchStage]
                  : (slowWarning ? 'Still working… this is taking longer than usual.' : msg.text)}
              </span>
              {onCancel && (
                <button
                  className="ai-action-btn"
                  onClick={onCancel}
                  style={{ marginTop: 8 }}
                >
                  ✕ Cancel
                </button>
              )}
            </>
          ) : (() => {
            // Structured modes: render rich cards instead of flat markdown.
            if (msg.structured && typeof msg.structured === 'object') {
              if ('summary' in msg.structured) {
                return <ResearchCard structured={msg.structured} webCitations={msg.webCitations} onCitationClick={onCitationClick} />;
              }
              return <ChunkCard structured={msg.structured} />;
            }
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
          {!isStreaming && !msg.isPlaceholder && !msg.structured && !msg.text.trim() && (
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
        {/* Per-message actions: Copy, Retry, Feedback — shown when AI has content or when the message errored */}
        {!isStreaming && !msg.isPlaceholder && (msg.text.trim() || msg.error) && (
          <MessageActions msg={msg} onRetry={onRetry} />
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
  const {
    state,
    dispatch,
    handleSendMessage,
    handleGenerateFlashcards,
    handleGenerateQuiz,
    handleUploadDocument,
    handleStop,
    handleIngestYouTube,
    handleSendImageMessage,
  } = useStudy();
  const { user } = useAuth();
  const { viewerState, viewerDispatch } = useViewerContext();
  const { messages, chatLoading, chatError, showMemoryBar, weakAreas, topic, docTitle, chatMode, pdfBlobUrl, slides, uploadLoading, uploadError } = state;

  // Banner is shown when no document is present and not in the middle of uploading
  const hasDocument = !!(pdfBlobUrl || slides.length > 0 || uploadLoading);

  // ── Context chip — shows what the AI knows about ──────────────────────────
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const contextChip = (() => {
    const { pdfLoaded, pdfPage, viewerType, isViewerOpen, currentTimestamp } = viewerState;
    const hasPdf = pdfLoaded;
    const hasYt  = isViewerOpen && viewerType === 'youtube';
    const hasRes = isViewerOpen && viewerType === 'research';
    if (!hasPdf && !hasYt && !hasRes) return null;
    const parts: string[] = [];
    if (hasPdf) parts.push(`PDF p.\u202f${pdfPage}`);
    if (hasYt)  parts.push(`YouTube\u202f${fmtTime(currentTimestamp)}`);
    if (hasRes) parts.push('Research paper');
    return parts.join(' · ');
  })();

  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useAutoScroll([messages, chatLoading]);
  // Prevents a second /ask call when the user double-clicks Send or presses
  // Enter twice before the first request finishes.  A ref (not state) is used
  // so the guard is set synchronously — before any re-render occurs.
  const sendingRef = useRef(false);

  // ── Image attachment state ────────────────────────────────────────────────
  const [imageAttachment, setImageAttachment] = useState<{ dataUrl: string; mimeType: string } | null>(null);

  // ── YouTube launcher modal ────────────────────────────────────────────────
  const [ytModalOpen, setYtModalOpen] = useState(false);
  const [ytModalUrl, setYtModalUrl] = useState('');
  const [ytModalError, setYtModalError] = useState('');
  const ytModalInputRef = useRef<HTMLInputElement>(null);

  const openYtModal = () => {
    setYtModalUrl('');
    setYtModalError('');
    setYtModalOpen(true);
  };

  const handleYtModalSubmit = async () => {
    const val = ytModalUrl.trim();
    if (!YT_URL_RE.test(val)) {
      setYtModalError('Please enter a valid YouTube URL');
      return;
    }
    setYtModalOpen(false);
    setYtModalUrl('');
    setYtModalError('');
    await handleIngestYouTube(val);
  };

  // ── Research launcher modal ───────────────────────────────────────────────
  const [researchModalOpen, setResearchModalOpen] = useState(false);
  const [researchModalUrl, setResearchModalUrl] = useState('');
  const researchModalInputRef = useRef<HTMLInputElement>(null);

  const openResearchModal = () => {
    setResearchModalUrl('');
    setResearchModalOpen(true);
  };

  const handleResearchModalSubmit = () => {
    const val = researchModalUrl.trim();
    if (!val) return;
    viewerDispatch({ type: 'OPEN_RESEARCH', url: val });
    setResearchModalOpen(false);
    setResearchModalUrl('');
  };

  // ── Citation click handler (opens URL in left viewer panel) ───────────────
  const handleCitationClick = useCallback((url: string) => {
    if (YT_URL_RE.test(url)) {
      void handleIngestYouTube(url);
    } else {
      viewerDispatch({ type: 'OPEN_RESEARCH', url });
    }
  }, [handleIngestYouTube, viewerDispatch]);

  // ── Socratic response tracking ──────────────────────────────────────────────
  // When the last AI message contains the "Check your understanding →" marker
  // we know the AI asked a Socratic question.  The next user message is treated
  // as the student's answer, and after the AI responds we detect correctness.
  // Whether we're currently waiting for the AI to evaluate a Socratic answer
  const pendingSocraticRef = useRef<{ question: string; answer: string; topic: string } | null>(null);

  const { toast } = useToast();

  // ── Voice input ──────────────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Stop the microphone when the component unmounts (resource/leak guard).
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch { /* ignore stop() errors on unmount */ }
    };
  }, []);

  // Auto-focus the URL input when either launcher modal opens
  useEffect(() => {
    if (ytModalOpen) {
      setTimeout(() => ytModalInputRef.current?.focus(), 0);
    }
  }, [ytModalOpen]);

  useEffect(() => {
    if (researchModalOpen) {
      setTimeout(() => researchModalInputRef.current?.focus(), 0);
    }
  }, [researchModalOpen]);

  const handleVoice = () => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      toast.error('Voice input is not supported in this browser');
      return;
    }
    const SR: typeof SpeechRecognition =
      window.SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setInputValue((prev) => prev + transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  // ── Mode dropdown (portal) ────────────────────────────────────────────────
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  /** Index of the keyboard-focused option; -1 means no option is focused. */
  const [focusedModeIdx, setFocusedModeIdx] = useState(-1);

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
    // Pre-focus the currently active mode when opening via keyboard
    const activeIdx = CHAT_MODES.findIndex((m) => m.key === chatMode);
    setFocusedModeIdx(activeIdx >= 0 ? activeIdx : 0);
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
        setFocusedModeIdx(-1);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [modeMenuOpen]);

  // Programmatically focus the <li> element when focusedModeIdx changes while the menu is open
  useEffect(() => {
    if (!modeMenuOpen || focusedModeIdx < 0) return;
    const items = modeMenuRef.current?.querySelectorAll<HTMLLIElement>('[role="option"]');
    items?.[focusedModeIdx]?.focus();
  }, [modeMenuOpen, focusedModeIdx]);

  /** Keyboard handler for the portal listbox. */
  const handleModeMenuKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setModeMenuOpen(false);
      setFocusedModeIdx(-1);
      modeBtnRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedModeIdx((prev) => (prev + 1) % CHAT_MODES.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedModeIdx((prev) => (prev - 1 + CHAT_MODES.length) % CHAT_MODES.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedModeIdx >= 0) {
        handleModeSelect(CHAT_MODES[focusedModeIdx].key);
      }
    }
  };

  // Build memory bar text from real weak areas
  const memoryText =
    weakAreas.length > 0
      ? `AI remembers: You struggled with ${cleanTopic(weakAreas[0].topic)} (${weakAreas[0].score}%). Let's revisit it.`
      : 'AI remembers: Keep asking questions — I track your weak areas over time.';

  const { tbRecordGap, tbRecordStudying, tbRecordSocraticPass, tbRecordMastery } = useTutorBrain(
    user?.isGuest ? undefined : user?.id,
    state.bookId ?? undefined,
  );

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
    // Synchronous mutex: prevents a second call from executing before the first
    // one finishes, even if triggered by rapid double-Enter or double-click.
    if (sendingRef.current) return;
    sendingRef.current = true;

    try {
      const val = inputValue.trim();

      // If there's an image attachment, send as image message
      if (imageAttachment) {
        if (chatLoading) return;
        setInputValue('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        const attachment = imageAttachment;
        setImageAttachment(null);
        await handleSendImageMessage(attachment.dataUrl, attachment.mimeType, val || 'Explain this image.');
        return;
      }

      if (!val || chatLoading) return;

      // ── YouTube URL intercept — paste a video link to load it into the viewer ──
      if (YT_URL_RE.test(val)) {
        setInputValue('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        await handleIngestYouTube(val);
        return;
      }

      setInputValue('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      // Detect struggle phrases and record gap in tutor brain
      const lower = val.toLowerCase();
      if (lastTopic && STRUGGLE_PHRASES.some((p) => lower.includes(p))) {
        tbRecordGap(lastTopic);
        tbRecordStudying(lastTopic);
      }

      // Detect understanding / mastery phrases and mark topic as mastered
      if (lastTopic && UNDERSTANDING_PHRASES.some((p) => lower.includes(p))) {
        tbRecordMastery(lastTopic);
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
    } finally {
      // The finally block always runs — including when any early `return` fires
      // inside the try (e.g. chatLoading check for image sends).  This guarantees
      // sendingRef is always reset so subsequent sends are not permanently blocked.
      sendingRef.current = false;
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
    setFocusedModeIdx(-1);
    modeBtnRef.current?.focus();
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

  const handleImageAttach = () => {
    imageInputRef.current?.click();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setImageAttachment({ dataUrl, mimeType: file.type || 'image/jpeg' });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    setImageAttachment(null);
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

    const { pdfLoaded, pdfPage, viewerType, isViewerOpen, currentTimestamp } = viewerState;
    const hasPdf = pdfLoaded;
    const hasYt  = isViewerOpen && viewerType === 'youtube';
    const hasRes = isViewerOpen && viewerType === 'research';

    // Build a short context suffix so prompts stay concise
    const pdfRef  = hasPdf ? `PDF page ${pdfPage}` : '';
    const ytRef   = hasYt  ? `the video segment at ${fmtTime(currentTimestamp)}` : '';
    const resRef  = hasRes ? 'this research paper' : '';

    const map: Record<string, string> = {
      '✦ Explain simply': hasPdf && hasYt
        ? `Explain the content on ${pdfRef} in simple terms, also referencing ${ytRef}.`
        : hasPdf
        ? `Explain the content on ${pdfRef} in simple terms.`
        : hasYt
        ? `Explain what's being discussed in ${ytRef} in simple terms.`
        : hasRes
        ? `Explain the main idea of ${resRef} in simple terms.`
        : 'Explain the current topic in simple terms.',

      '📋 Study plan': `Create a structured study plan with a checklist for "${cleanTopic(resolveStudyTopic(topic, docTitle, messages))}". Format it as a numbered list of actionable tasks.`,

      '🔑 Key concepts': hasPdf && hasYt
        ? `What are the key concepts on ${pdfRef}? Also reference ${ytRef} where relevant.`
        : hasPdf
        ? `What are the key concepts covered on ${pdfRef}?`
        : hasYt
        ? `What are the key concepts discussed in ${ytRef}?`
        : hasRes
        ? `What are the key concepts from ${resRef}?`
        : 'What are the key concepts I need to remember?',

      '↓ Summarize': hasPdf && hasYt
        ? `Summarize the content on ${pdfRef} and relate it to ${ytRef}.`
        : hasPdf
        ? `Summarize the content on ${pdfRef}.`
        : hasYt
        ? `Summarize what's covered in ${ytRef}.`
        : hasRes
        ? `Summarize ${resRef} and connect it to my current study topic.`
        : 'Summarize the main points of this topic.',
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
      {/* Hidden file input for image attachment */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={handleImageFileChange}
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
                onRetry={msg.error && msg.originalQuestion ? () => {
                  dispatch({ type: 'REMOVE_MESSAGE', payload: msg.id });
                  void handleSendMessage(msg.originalQuestion!);
                } : undefined}
                onCancel={msg.isPlaceholder ? handleStopClick : undefined}
                onCitationClick={handleCitationClick}
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
          {/* Image attachment preview */}
          {imageAttachment && (
            <div className="image-preview-bar">
              <img src={imageAttachment.dataUrl} alt="Attachment preview" className="image-preview-thumb" />
              <button className="image-preview-remove" onClick={handleRemoveImage} title="Remove image" aria-label="Remove image">
                ✕
              </button>
            </div>
          )}
          {contextChip && (
            <div className="context-chip" aria-label={`AI context: ${contextChip}`}>
              <span className="context-chip-dot" aria-hidden="true" />
              {contextChip}
            </div>
          )}
          <div className="text-input-row">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder={imageAttachment ? 'Ask something about this image… (or send as-is)' : 'Ask a follow-up about your study material…'}
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
                disabled={!inputValue.trim() && !imageAttachment}
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
              className={`input-tool-btn${imageAttachment ? ' active' : ''}`}
              onClick={handleImageAttach}
              title="Attach an image (textbook page, diagram, handwritten notes)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Photo
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
            <button
              className="input-tool-btn"
              onClick={openYtModal}
              title="Load a YouTube video into the viewer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#ff0000' }}>
                <path d="M23.5 6.2a3.01 3.01 0 0 0-2.12-2.13C19.54 3.62 12 3.62 12 3.62s-7.54 0-9.38.45A3.01 3.01 0 0 0 .5 6.2C.06 8.06 0 12 0 12s.06 3.94.5 5.8a3.01 3.01 0 0 0 2.12 2.13C4.46 20.38 12 20.38 12 20.38s7.54 0 9.38-.45a3.01 3.01 0 0 0 2.12-2.13C23.94 15.94 24 12 24 12s-.06-3.94-.5-5.8zM9.75 15.5V8.5L16 12l-6.25 3.5z"/>
              </svg>
              YouTube
            </button>
            <button
              className="input-tool-btn"
              onClick={openResearchModal}
              title="Load a research paper or URL into the viewer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              Research
            </button>
            <div className="mode-dropdown-wrap" ref={modeWrapRef}>
              <button
                ref={modeBtnRef}
                className="mode-dropdown-btn"
                onClick={() => {
                  if (modeMenuOpen) {
                    setModeMenuOpen(false);
                    setFocusedModeIdx(-1);
                  } else {
                    openModeMenu();
                  }
                }}
                aria-haspopup="listbox"
                aria-expanded={modeMenuOpen}
                aria-controls="mode-listbox"
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
                  id="mode-listbox"
                  ref={modeMenuRef}
                  className="mode-dropdown-menu-portal"
                  role="listbox"
                  aria-label="Chat mode"
                  aria-activedescendant={focusedModeIdx >= 0 ? `mode-option-${CHAT_MODES[focusedModeIdx].key}` : undefined}
                  style={{ top: dropdownPos.top, right: dropdownPos.right }}
                  onKeyDown={handleModeMenuKeyDown}
                  tabIndex={-1}
                >
                  {CHAT_MODES.map((m, idx) => (
                    <li
                      key={m.key}
                      id={`mode-option-${m.key}`}
                      role="option"
                      aria-selected={chatMode === m.key}
                      tabIndex={-1}
                      className={`mode-dropdown-item${chatMode === m.key ? ' active' : ''}${focusedModeIdx === idx ? ' focused' : ''}`}
                      onClick={() => handleModeSelect(m.key)}
                      onMouseEnter={() => setFocusedModeIdx(idx)}
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

      {/* ── YouTube launcher modal ── */}
      {ytModalOpen && ReactDOM.createPortal(
        <div
          className="viewer-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Load YouTube video"
          onClick={(e) => { if (e.target === e.currentTarget) setYtModalOpen(false); }}
        >
          <div className="viewer-modal">
            <div className="viewer-modal-header">
              <span className="viewer-modal-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#ff0000', marginRight: 6 }}>
                  <path d="M23.5 6.2a3.01 3.01 0 0 0-2.12-2.13C19.54 3.62 12 3.62 12 3.62s-7.54 0-9.38.45A3.01 3.01 0 0 0 .5 6.2C.06 8.06 0 12 0 12s.06 3.94.5 5.8a3.01 3.01 0 0 0 2.12 2.13C4.46 20.38 12 20.38 12 20.38s7.54 0 9.38-.45a3.01 3.01 0 0 0 2.12-2.13C23.94 15.94 24 12 24 12s-.06-3.94-.5-5.8zM9.75 15.5V8.5L16 12l-6.25 3.5z"/>
                </svg>
                Load YouTube Video
              </span>
              <button
                className="viewer-modal-close"
                onClick={() => setYtModalOpen(false)}
                aria-label="Close"
              >✕</button>
            </div>
            <p className="viewer-modal-hint">Paste a YouTube URL to load the video and transcript into the viewer panel.</p>
            <input
              ref={ytModalInputRef}
              className="viewer-modal-input"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={ytModalUrl}
              onChange={(e) => { setYtModalUrl(e.target.value); setYtModalError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleYtModalSubmit(); if (e.key === 'Escape') setYtModalOpen(false); }}
            />
            {ytModalError && <p className="viewer-modal-error">{ytModalError}</p>}
            <div className="viewer-modal-actions">
              <button className="viewer-modal-btn viewer-modal-btn--cancel" onClick={() => setYtModalOpen(false)}>Cancel</button>
              <button className="viewer-modal-btn viewer-modal-btn--submit" onClick={() => void handleYtModalSubmit()}>Load Video</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Research launcher modal ── */}
      {researchModalOpen && ReactDOM.createPortal(
        <div
          className="viewer-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Load research paper"
          onClick={(e) => { if (e.target === e.currentTarget) setResearchModalOpen(false); }}
        >
          <div className="viewer-modal">
            <div className="viewer-modal-header">
              <span className="viewer-modal-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                Load Research Paper
              </span>
              <button
                className="viewer-modal-close"
                onClick={() => setResearchModalOpen(false)}
                aria-label="Close"
              >✕</button>
            </div>
            <p className="viewer-modal-hint">Paste an arXiv, DOI, or any research paper URL to open it in the viewer panel.</p>
            <input
              ref={researchModalInputRef}
              className="viewer-modal-input"
              type="url"
              placeholder="https://arxiv.org/abs/... or DOI URL"
              value={researchModalUrl}
              onChange={(e) => setResearchModalUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleResearchModalSubmit(); if (e.key === 'Escape') setResearchModalOpen(false); }}
            />
            <div className="viewer-modal-actions">
              <button className="viewer-modal-btn viewer-modal-btn--cancel" onClick={() => setResearchModalOpen(false)}>Cancel</button>
              <button
                className="viewer-modal-btn viewer-modal-btn--submit"
                onClick={handleResearchModalSubmit}
                disabled={!researchModalUrl.trim()}
              >Open in Viewer</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
