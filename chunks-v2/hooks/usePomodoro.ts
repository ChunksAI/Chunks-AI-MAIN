'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'study' | 'break';

const STUDY_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface UsePomodoroOptions {
  onPhaseChange?: (phase: Phase) => void;
}

interface UsePomodoroReturn {
  timeLeft: string;
  phase: Phase;
  isRunning: boolean;
  toggle: () => void;
  reset: () => void;
}

/**
 * Manages a Pomodoro countdown: 25-minute study → 5-minute break → repeat.
 * Auto-switches phase when the countdown reaches 00:00 and calls onPhaseChange.
 */
export function usePomodoro({ onPhaseChange }: UsePomodoroOptions = {}): UsePomodoroReturn {
  const [phase, setPhase] = useState<Phase>('study');
  const [seconds, setSeconds] = useState(STUDY_SECONDS);
  const [isRunning, setIsRunning] = useState(false);

  // Keep a stable ref to onPhaseChange so the interval never needs to re-register
  const onPhaseChangeRef = useRef(onPhaseChange);
  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
  }, [onPhaseChange]);

  useEffect(() => {
    if (!isRunning) return;

    const id = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          // Switch phase
          setPhase((currentPhase) => {
            const nextPhase: Phase = currentPhase === 'study' ? 'break' : 'study';
            onPhaseChangeRef.current?.(nextPhase);
            return nextPhase;
          });
          return phase === 'study' ? BREAK_SECONDS : STUDY_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [isRunning, phase]);

  const toggle = useCallback(() => setIsRunning((r) => !r), []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setPhase('study');
    setSeconds(STUDY_SECONDS);
  }, []);

  return {
    timeLeft: formatTime(seconds),
    phase,
    isRunning,
    toggle,
    reset,
  };
}
