'use client';

import { useState, useEffect } from 'react';
import TabBar from './TabBar';
import type { TabId } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `studying for ${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `studying for ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `studying for ${h}h` : `studying for ${h}h ${m}m`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TopbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  sessionName?: string;
}

export default function Topbar({
  activeTab,
  onTabChange,
  sessionName = 'Study Assistant',
}: TopbarProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="topbar">
      {/* ── Left: session title ── */}
      <div className="topbar-left">
        <div className="session-title">
          <div className="session-icon">📄</div>
          <span className="session-name">{sessionName}</span>
        </div>
      </div>

      {/* ── Centre: tab bar ── */}
      <TabBar activeTab={activeTab} onChange={onTabChange} />

      {/* ── Right: timer + icon buttons ── */}
      <div className="topbar-right">
        <div className="study-timer">
          <div className="timer-dot" />
          {formatElapsed(elapsed)}
        </div>

        <button className="icon-btn" title="Memory">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
        </button>

        <button className="icon-btn" title="Settings">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
