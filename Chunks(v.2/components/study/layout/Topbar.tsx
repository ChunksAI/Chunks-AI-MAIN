'use client';

import { useEffect } from 'react';
import TabBar from './TabBar';
import { usePomodoro } from '@/hooks/usePomodoro';
import { useSettings } from '@/contexts/SettingsContext';
import type { TabId } from '@/types';

// ─── Component ────────────────────────────────────────────────────────────────

interface TopbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  sessionName?: string;
  onPhaseChange?: (phase: 'study' | 'break') => void;
}

export default function Topbar({
  activeTab,
  onTabChange,
  sessionName = 'Study Assistant',
  onPhaseChange,
}: TopbarProps) {
  const { timeLeft, phase, isRunning, toggle } = usePomodoro({ onPhaseChange });
  const { openSettings } = useSettings();

  // Keyboard shortcut: Cmd/Ctrl + , → open settings
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        openSettings();
      }
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [openSettings]);

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
          <div className={`timer-dot${phase === 'break' ? ' timer-dot--break' : ''}`} />
          {phase === 'study' ? '🍅' : '☕'} {timeLeft}
        </div>

        <button
          className="icon-btn"
          title={isRunning ? 'Pause timer' : 'Start timer'}
          onClick={toggle}
          aria-label={isRunning ? 'Pause Pomodoro timer' : 'Start Pomodoro timer'}
        >
          {isRunning ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </button>

      </div>
    </header>
  );
}
