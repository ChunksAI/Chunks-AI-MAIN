// @ts-nocheck
/**
 * src/lib/progressTracker.js — Progress tracking & weak area detection
 *
 * Tracks per-topic learning data across flashcard sessions and exams.
 * Persists to in-memory store under 'chunks_progress_v1'.
 *
 * Schema (per topic key):
 *   { attempts, correct, lastStudied }
 *
 * Exports:
 *   trackFlashcardSession(topic, stats)  — record flashcard session outcome
 *   trackExamResult(topic, correct, total) — record exam outcome
 *   getWeakAreas()                       — topics with accuracy < 0.70
 *   getAllProgress()                     — full progress map
 *   getTopicProgress(topic)              — progress for one topic
 *   clearProgress()                      — wipe all tracking data
 */
import { lsGet as _lsGet, lsSet as _lsSet, lsRemove as _lsRemove } from '../utils/storage.js';

const _STORAGE_KEY = 'chunks_progress_v1';

// ── Internal helpers ──────────────────────────────────────────────────────────

function _load() {
  try {
    return _lsGet(_STORAGE_KEY) || {};
  } catch (_) { return {}; }
}

function _save(data) {
  try { _lsSet(_STORAGE_KEY, data); } catch (_) {}
}

function _normaliseTopic(topic) {
  return (topic || '').trim().toLowerCase().slice(0, 120);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a completed flashcard session for a topic.
 * @param {string} topic
 * @param {{ easy: number, ok: number, hard: number, skipped: number }} stats
 */
export function trackFlashcardSession(topic, stats) {
  const key = _normaliseTopic(topic);
  if (!key) return;
  const { easy = 0, ok = 0, hard = 0, skipped = 0 } = stats || {};
  const attempts = easy + ok + hard + skipped;
  if (attempts === 0) return;
  const correct = easy + ok;
  const data = _load();
  const prev = data[key] || { attempts: 0, correct: 0 };
  data[key] = {
    attempts:    prev.attempts + attempts,
    correct:     prev.correct  + correct,
    lastStudied: Date.now(),
  };
  _save(data);
}

/**
 * Record a completed exam result for a topic.
 * @param {string} topic
 * @param {number} correct
 * @param {number} total
 */
export function trackExamResult(topic, correct, total) {
  const key = _normaliseTopic(topic);
  if (!key || !total) return;
  const data = _load();
  const prev = data[key] || { attempts: 0, correct: 0 };
  data[key] = {
    attempts:    prev.attempts + total,
    correct:     prev.correct  + correct,
    lastStudied: Date.now(),
  };
  _save(data);
}

/**
 * Return progress record for a single topic.
 * @param {string} topic
 * @returns {{ attempts: number, correct: number, accuracy: number, lastStudied: number } | null}
 */
export function getTopicProgress(topic) {
  const key = _normaliseTopic(topic);
  if (!key) return null;
  const data = _load();
  const entry = data[key];
  if (!entry) return null;
  const accuracy = entry.attempts > 0 ? entry.correct / entry.attempts : 0;
  return { ...entry, accuracy };
}

/**
 * Return the full progress map enriched with accuracy.
 * @returns {Array<{ topic: string, attempts: number, correct: number, accuracy: number, lastStudied: number }>}
 */
export function getAllProgress() {
  const data = _load();
  return Object.entries(data).map(([topic, entry]) => ({
    topic,
    ...entry,
    accuracy: entry.attempts > 0 ? entry.correct / entry.attempts : 0,
  }));
}

/**
 * Return topics where accuracy < 0.70 (weak areas), sorted by weakest first.
 * Only includes topics with at least 3 attempts to avoid noise.
 * @returns {Array<{ topic: string, accuracy: number, weaknessScore: number }>}
 */
export function getWeakAreas() {
  return getAllProgress()
    .filter(p => p.attempts >= 3 && p.accuracy < 0.70)
    .map(p => ({ topic: p.topic, accuracy: p.accuracy, weaknessScore: +(1 - p.accuracy).toFixed(2) }))
    .sort((a, b) => b.weaknessScore - a.weaknessScore);
}

/**
 * Wipe all tracking data.
 */
export function clearProgress() {
  try { _lsRemove(_STORAGE_KEY); } catch (_) {}
}

// ── Window bridge ─────────────────────────────────────────────────────────────

export const ProgressTracker = {
  trackFlashcardSession,
  trackExamResult,
  getTopicProgress,
  getAllProgress,
  getWeakAreas,
  clearProgress,
};
