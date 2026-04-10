'use client';

import { useState, useCallback, useEffect } from 'react';

import Sidebar      from '@/components/study/layout/Sidebar';
import Topbar       from '@/components/study/layout/Topbar';
import ContentPanel from '@/components/study/panels/ContentPanel';
import ChatPanel    from '@/components/study/panels/ChatPanel';
import WorkspaceTab from '@/components/study/tabs/WorkspaceTab';
import ReviewerTab  from '@/components/study/tabs/ReviewerTab';
import NotesTab     from '@/components/study/tabs/NotesTab';
import Toast        from '@/components/shared/Toast';
import { useResizable } from '@/hooks/useResizable';

import type { TabId, ChatMessage } from '@/types';

// ─── Initial chat messages (mirrors mockup) ───────────────────────────────────
const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'ai-1',
    role: 'ai',
    text: `I've loaded <span class="hl">Chapter 3: Cell Structure and Function</span>. I can see you're studying the organelles section.<br><br>Based on your previous sessions, you had some difficulty with <strong>mitochondria and ATP synthesis</strong>. Want to make sure you understand that better this time?`,
    memoryRecall: '<strong>Memory recall:</strong> In your last session (2 days ago), you scored 45% on mitochondria-related quiz questions. I\'ve flagged this for review.',
    actions: [
      { label: '🎯 Quiz me on this',   actionKey: 'quiz' },
      { label: '🃏 Make flashcards',   actionKey: 'flashcards' },
      { label: '✦ Explain simply',     actionKey: 'explain' },
    ],
  },
  {
    id: 'user-1',
    role: 'user',
    text: 'Can you explain how mitochondria produce ATP? I keep getting confused about the steps.',
  },
  {
    id: 'ai-2',
    role: 'ai',
    text: `Of course! ATP production in mitochondria happens through <span class="hl">cellular respiration</span>, specifically in two main stages:<br><br><strong>1. Krebs Cycle</strong> (Matrix) — Acetyl-CoA is broken down, releasing CO₂ and creating electron carriers (NADH, FADH₂).<br><br><strong>2. Electron Transport Chain</strong> (Inner membrane) — Electrons flow through protein complexes, pumping H⁺ ions to create a gradient. ATP synthase uses this gradient to synthesize ATP.<br><br>Think of it like a <span class="hl">hydroelectric dam</span> — the flow of protons through ATP synthase generates energy, just like water through a turbine. ⚡`,
    performanceBars: [
      { label: 'Cell Structure',    pct: 82, color: 'var(--accent2)' },
      { label: 'Mitochondria / ATP', pct: 45, color: 'var(--danger)' },
      { label: 'Membrane Transport', pct: 68, color: 'var(--accent)' },
    ],
    actions: [
      { label: '🎯 Quick quiz on this',    actionKey: 'quiz2' },
      { label: '🃏 Generate flashcards',   actionKey: 'flashcards2' },
      { label: '🗺️ Mind map',              actionKey: 'mindmap' },
    ],
  },
];

// ─── AI response pool ─────────────────────────────────────────────────────────
const AI_RESPONSE_POOL: ChatMessage[] = [
  {
    id: '',
    role: 'ai',
    text: "Great question! Based on what you've studied so far in Chapter 3, here's what I can tell you. The concept connects directly to your notes on cellular respiration. Should I generate some flashcards to help reinforce this?",
    actions: [{ label: '🃏 Make flashcards', actionKey: 'flashcards' }, { label: '🎯 Quiz me', actionKey: 'quiz' }],
  },
  {
    id: '',
    role: 'ai',
    text: "I've cross-referenced this with your previous sessions. You encountered a similar concept when studying Chapter 2. Let me build on that foundation — want me to also create a mini-quiz to test your understanding?",
    actions: [{ label: '🃏 Make flashcards', actionKey: 'flashcards' }, { label: '🎯 Quiz me', actionKey: 'quiz' }],
  },
  {
    id: '',
    role: 'ai',
    text: "Excellent — this is one of the weaker areas we identified earlier. Let me walk you through it step by step. I'll also flag this for your next review session so we can make sure it sticks. 🧠",
    actions: [{ label: '🃏 Make flashcards', actionKey: 'flashcards' }, { label: '🎯 Quiz me', actionKey: 'quiz' }],
  },
];

// ─── Action key → toast message ───────────────────────────────────────────────
const ACTION_TOASTS: Record<string, string> = {
  quiz:        '🎯 Quiz created in Workspace!',
  quiz2:       '🎯 ATP quiz added to Workspace!',
  flashcards:  '🃏 Flashcards added to Workspace!',
  flashcards2: '🃏 ATP flashcards added to Workspace!',
  mindmap:     '🗺️ Mind map added to Workspace!',
};

let msgCounter = 10;
function nextId() { return `msg-${++msgCounter}`; }

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function StudyPage() {
  const [activeTab,     setActiveTab]     = useState<TabId>('chat');
  const [activeNav,     setActiveNav]     = useState('study');
  const [messages,      setMessages]      = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [showMemoryBar, setShowMemoryBar] = useState(true);
  const [toast,         setToast]         = useState<string | null>(null);

  const { pct, containerRef, onMouseDown } = useResizable();

  // Auto-clear toast after 2.8 s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((msg: string) => setToast(msg), []);

  // ── Chat send ──────────────────────────────────────────────────────────────
  const handleSendMessage = useCallback((text: string) => {
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      const template = AI_RESPONSE_POOL[Math.floor(Math.random() * AI_RESPONSE_POOL.length)];
      const aiMsg: ChatMessage = { ...template, id: nextId() };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1400);
  }, []);

  // ── Action chips below AI messages ────────────────────────────────────────
  const handleActionClick = useCallback((key: string) => {
    const toastMsg = ACTION_TOASTS[key];
    if (toastMsg) { showToast(toastMsg); return; }
  }, [showToast]);

  // ── Highlight tooltip callbacks ────────────────────────────────────────────
  const handleExplain = useCallback((topic: string) => {
    const text = `I'll explain that highlighted concept in simple terms. The <strong>${topic}</strong> acts like a selective security guard — it controls what enters and exits the cell, maintaining the ideal internal environment. 🔬`;
    const msg: ChatMessage = { id: nextId(), role: 'ai', text, actions: [{ label: '🃏 Make flashcards', actionKey: 'flashcards' }] };
    setMessages((prev) => [...prev, msg]);
    setActiveTab('chat');
  }, []);

  const handleQuizFromContent = useCallback((topic: string) => {
    const text = `Here's a quick quiz on <strong>${topic}</strong>:<br><br>Q: What is the primary function of the plasma membrane?<br><br>a) DNA replication<br>b) Separating intracellular from extracellular environments ✓<br>c) Producing ATP<br>d) Synthesizing proteins<br><br>This has been saved to your Workspace quiz set! 📊`;
    const msg: ChatMessage = { id: nextId(), role: 'ai', text, actions: [{ label: '🎯 More questions', actionKey: 'quiz' }] };
    setMessages((prev) => [...prev, msg]);
    setActiveTab('chat');
  }, []);

  const handleSummarize = useCallback(() => {
    showToast('📋 Summary added to Workspace!');
  }, [showToast]);

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <Sidebar
        activeNav={activeNav}
        onNavChange={setActiveNav}
        onNewSession={() => showToast('✨ New study session started')}
      />

      {/* ── Main content ── */}
      <main className="main">
        <Topbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="tab-content-area">
          {/* ── Chat tab ── */}
          {activeTab === 'chat' && (
            <div className="workspace" ref={containerRef}>
              <ContentPanel
                style={{ width: `${pct}%` }}
                onExplain={handleExplain}
                onQuiz={handleQuizFromContent}
                onSummarize={handleSummarize}
              />
              {/* Resizer */}
              <div className="resizer" onMouseDown={onMouseDown} />
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                onActionClick={handleActionClick}
                onMemoryDismiss={() => setShowMemoryBar(false)}
                showMemoryBar={showMemoryBar}
              />
            </div>
          )}

          {/* ── Workspace tab ── */}
          {activeTab === 'workspace' && (
            <WorkspaceTab onAddItem={() => showToast('✨ New item created!')} />
          )}

          {/* ── Reviewer tab ── */}
          {activeTab === 'reviewer' && (
            <ReviewerTab onStartReview={() => showToast('🎓 Review session started!')} />
          )}

          {/* ── Notes tab ── */}
          {activeTab === 'notes' && (
            <NotesTab onNewNote={() => showToast('📝 New note created!')} />
          )}
        </div>
      </main>

      {/* ── Toast ── */}
      <Toast message={toast} />
    </div>
  );
}
