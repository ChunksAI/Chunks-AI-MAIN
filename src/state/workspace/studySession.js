// @ts-nocheck
/**
 * src/state/workspace/studySession.js — Unified Study Session State
 *
 * Tracks the active study session across all feature transitions
 * (chat → flashcards → quiz → exam → review).
 *
 * Persists to sessionStorage so refreshes survive.
 *
 * Exports:
 *   getSession()          — returns current session snapshot
 *   updateSession(patch)  — merges patch and persists
 *   resetSession()        — clears session back to defaults
 */

const _SS_KEY = 'chunks_study_session';

/** Generate a simple UUID-v4 */
function _uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Default session shape */
function _defaults() {
  return {
    id:            _uuid(),
    topic:         null,
    lastAction:    null,    // 'explain' | 'flashcards' | 'quiz' | 'exam' | null
    quizScore:     null,    // { correct, total, pct } | null
    sourceFeature: 'chat',  // 'chat' | 'flashcards' | 'quiz' | 'exam'
    chatMode:      'normal', // 'normal' | 'flashcards' | 'quiz'
  };
}

/** Module-level session state */
let _session = _defaults();

/** Attempt to restore from sessionStorage on load */
function _restore() {
  try {
    const raw = sessionStorage.getItem(_SS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        _session = { ..._defaults(), ...parsed };
      }
    }
  } catch (_) { /* ignore parse errors */ }
}
_restore();

/** Persist current state */
function _persist() {
  try {
    sessionStorage.setItem(_SS_KEY, JSON.stringify(_session));
  } catch (_) { /* quota exceeded — ignore */ }
}

/**
 * Get a snapshot of the current study session.
 * @returns {Object}
 */
export function getSession() {
  return { ..._session };
}

/**
 * Merge a patch into the session and persist.
 * @param {Object} patch — partial session fields to update
 */
export function updateSession(patch) {
  if (patch && typeof patch === 'object') {
    Object.assign(_session, patch);
    _persist();
  }
}

/**
 * Reset the session to defaults (new session id).
 */
export function resetSession() {
  _session = _defaults();
  _persist();
}
