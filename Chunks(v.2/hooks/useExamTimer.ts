import { useEffect, useRef, useState, useCallback } from 'react';

interface UseExamTimerReturn {
  timeRemaining: number;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
}

/**
 * Countdown timer hook for exam mode.
 *
 * Ticks every second. When timeRemaining reaches 0, calls onExpire() once and
 * stops. Returns start/pause controls so the caller can integrate with exam
 * phase transitions.
 */
export function useExamTimer(initialSeconds: number, onExpire: () => void): UseExamTimerReturn {
  const [timeRemaining, setTimeRemaining] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);

  // Keep a stable ref to the callback so the interval never goes stale
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
    clearTimer();
  }, []);

  useEffect(() => {
    if (!isRunning) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearTimer();
          setIsRunning(false);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [isRunning]);

  // Cleanup on unmount
  useEffect(() => clearTimer, []);

  return { timeRemaining, isRunning, start, pause };
}
