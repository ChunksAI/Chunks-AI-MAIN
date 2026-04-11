import { useCallback } from 'react';

const SESSION_KEY = 'chunks_v2_study_session';

interface StudySessionData {
  topic: string | null;
  lastAction: string | null;
  quizScore: number | null;
}

/**
 * Thin wrapper around sessionStorage for study session persistence.
 * Mirrors the pattern in src/state/workspace/studySession.js from the old system.
 *
 * Data survives page refresh but not browser close, keeping sessions scoped
 * to a single browsing session without cluttering localStorage.
 */
export function useStudySession() {
  const saveSession = useCallback((data: StudySessionData) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch {
      // sessionStorage may be unavailable in private browsing or with strict
      // cookie settings — degrade gracefully without throwing
    }
  }, []);

  const restoreSession = useCallback((): StudySessionData | null => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as StudySessionData) : null;
    } catch {
      return null;
    }
  }, []);

  const clearSession = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { saveSession, restoreSession, clearSession };
}
