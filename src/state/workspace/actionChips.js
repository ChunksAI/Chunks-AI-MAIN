// @ts-nocheck
/**
 * src/state/workspace/actionChips.js — Context-aware Action Chips
 *
 * Renders a chip bar that guides the user to the next step in the study loop.
 * Only one chip bar exists at a time — each call replaces the previous one.
 *
 * Exports:
 *   showActionChips(chips)  — render chips in the #ws-chip-bar slot
 *   clearActionChips()      — remove the current chip bar
 *   getRecoveryChips(score, topic) — score-based chip suggestions
 *   getPostExplainChips(topic)     — chips shown after an AI explanation
 *   getPostFlashcardChips(topic)   — chips shown after flashcard generation
 */

import { $el } from '../domHelpers.js';
import { getSession, updateSession } from './studySession.js';

// ── HTML-escape helper ──────────────────────────────────────────────────────

function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Action handlers ─────────────────────────────────────────────────────────

const _handlers = {
  flashcards(topic) {
    if (typeof window.wsGenerateFlashcardsInChat === 'function') {
      window.wsGenerateFlashcardsInChat(topic || getSession().topic || '');
    }
  },
  quiz(topic) {
    if (typeof window.wsShowExamCard === 'function') {
      window.wsShowExamCard(topic || getSession().topic || '');
    }
  },
  retry_quiz(topic) {
    if (typeof window.wsShowExamCard === 'function') {
      window.wsShowExamCard(topic || getSession().topic || '');
    }
  },
  fullExam(topic) {
    if (typeof window.wsNavigateToFullExam === 'function') {
      window.wsNavigateToFullExam(topic || getSession().topic || '');
    }
  },
  explain_simple(topic) {
    const t = topic || getSession().topic || 'this topic';
    if (typeof window.wsSetInput === 'function') {
      window.wsSetInput(`Explain ${t} in simpler terms`);
      setTimeout(() => { if (typeof window.wsChatSend === 'function') window.wsChatSend(); }, 100);
    }
  },
  save() {
    // best-effort save last interaction context to workspace
    if (typeof window.wsSaveToWorkspace === 'function') {
      const s = getSession();
      window.wsSaveToWorkspace(s.lastAction || 'note', {
        topic: s.topic || 'Study session',
        score: s.quizScore,
      });
    }
  },
  new_topic() {
    if (typeof window.wsSetInput === 'function') {
      window.wsSetInput('');
      const inp = $el('ws-chat-input');
      if (inp) { inp.focus(); inp.placeholder = 'Enter a new topic…'; }
    }
  },
  summarize(topic) {
    const t = topic || getSession().topic || 'this topic';
    if (typeof window.wsSetInput === 'function') {
      window.wsSetInput(`Summarize ${t}`);
      setTimeout(() => { if (typeof window.wsChatSend === 'function') window.wsChatSend(); }, 100);
    }
  },
};

// ── Chip bar rendering ──────────────────────────────────────────────────────

/**
 * Render action chips in the #ws-chip-bar slot.
 * Each chip is { icon: string, label: string, action: string }.
 * The `action` key maps to a handler function above.
 *
 * @param {Array<{icon: string, label: string, action: string}>} chips
 * @param {string} [topic] — topic to pass to handlers
 */
export function showActionChips(chips, topic) {
  if (!chips || !chips.length) return;

  let bar = $el('ws-chip-bar');
  if (!bar) return;

  const effectiveTopic = topic || getSession().topic || '';

  bar.innerHTML = '';
  bar.style.display = '';

  chips.forEach(chip => {
    const btn = document.createElement('button');
    btn.className = 'ws-study-chip';
    btn.innerHTML = `<span class="ws-study-chip-icon">${_esc(chip.icon)}</span> ${_esc(chip.label)}`;
    btn.addEventListener('click', () => {
      const handler = _handlers[chip.action];
      if (handler) {
        handler(effectiveTopic);
      }
      // Clear the chip bar after any action
      clearActionChips();
    });
    bar.appendChild(btn);
  });
}

/**
 * Remove the current chip bar content.
 */
export function clearActionChips() {
  const bar = $el('ws-chip-bar');
  if (bar) {
    bar.innerHTML = '';
    bar.style.display = 'none';
  }
}

// ── Pre-built chip sets ─────────────────────────────────────────────────────

/**
 * Score-based recovery chips (shown after quiz/exam results).
 * @param {{ correct: number, total: number, pct: number }} score
 * @param {string} topic
 * @returns {Array<{icon: string, label: string, action: string}>}
 */
export function getRecoveryChips(score, topic) {
  if (!score) return [];
  if (score.pct < 50) {
    return [
      { icon: '📚', label: 'Review flashcards', action: 'flashcards' },
      { icon: '💡', label: 'Simpler explanation', action: 'explain_simple' },
      { icon: '🔁', label: 'Retry quiz', action: 'retry_quiz' },
    ];
  }
  if (score.pct < 80) {
    return [
      { icon: '🔁', label: 'Retry quiz', action: 'retry_quiz' },
      { icon: '📚', label: 'Review flashcards', action: 'flashcards' },
      { icon: '🧪', label: 'Full Exam', action: 'fullExam' },
    ];
  }
  return [
    { icon: '🧪', label: 'Full Exam', action: 'fullExam' },
    { icon: '✨', label: 'New topic', action: 'new_topic' },
    { icon: '💾', label: 'Save result', action: 'save' },
  ];
}

/**
 * Chips shown after an AI explanation.
 * @param {string} topic
 * @returns {Array<{icon: string, label: string, action: string}>}
 */
export function getPostExplainChips(topic) {
  return [
    { icon: '🧠', label: 'Make flashcards', action: 'flashcards' },
    { icon: '📝', label: 'Quiz me', action: 'quiz' },
    { icon: '💾', label: 'Save', action: 'save' },
  ];
}

/**
 * Chips shown after flashcard generation / study complete.
 * @param {string} topic
 * @returns {Array<{icon: string, label: string, action: string}>}
 */
export function getPostFlashcardChips(topic) {
  return [
    { icon: '📝', label: 'Quiz me', action: 'quiz' },
    { icon: '🧪', label: 'Full Exam', action: 'fullExam' },
    { icon: '🔁', label: 'Study again', action: 'flashcards' },
  ];
}

/**
 * Chips shown after returning from a full exam.
 * @param {string} topic
 * @returns {Array<{icon: string, label: string, action: string}>}
 */
export function getPostExamChips(topic) {
  return [
    { icon: '📚', label: 'Review weak areas', action: 'flashcards' },
    { icon: '🔁', label: 'Retry quiz', action: 'retry_quiz' },
    { icon: '💾', label: 'Save result', action: 'save' },
  ];
}
