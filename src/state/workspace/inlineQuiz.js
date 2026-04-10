// @ts-nocheck
/**
 * src/state/workspace/inlineQuiz.js — Inline Quick Quiz (chat-native quiz mode)
 *
 * Exports:
 *   wsShowExamCard(topic)        — append an Exam Mode selection card to chat
 *   wsStartInlineQuiz(topic, el) — generate questions and mount quiz widget in chat
 *   wsNavigateToFullExam(topic)  — prefill topic and navigate to the Exam screen
 */

import { API_BASE, _getAuthHeader } from '../../lib/api.js';
import { $el } from '../domHelpers.js';
import { wsScrollBottom, wsAppendUser } from './chat.js';
import { saveExamResult } from '../../lib/examDb.js';
import { showScreen } from '../navigation/index.js';

// ── Helper: HTML-escape a string ─────────────────────────────────────────────

function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Produce a value safe for use inside an onclick="...'VALUE'..." attribute:
 * first JS-escapes the string (backslash, single-quote, newlines), then
 * HTML-entity-escapes the result for the surrounding HTML attribute context.
 */
function _escJsAttr(s) {
  const jsEscaped = String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ');
  return _esc(jsEscaped);
}

// ── Question generation ───────────────────────────────────────────────────────

/**
 * Generate MCQ questions via the /ask endpoint in generate mode.
 * Returns a parsed array of { q, options:[A,B,C,D], answer, explanation } objects.
 */
async function _generateQuestions(topic, count = 7) {
  const prompt = `You are a quiz generator. Generate exactly ${count} multiple-choice questions on the topic: "${topic}".

Rules:
- Each question must have exactly 4 options labeled A, B, C, D.
- Exactly one option is correct.
- Include a brief explanation for the correct answer.
- Vary difficulty (mix easy, medium, hard).
- Output ONLY a raw JSON array with no markdown fences:
[{"q":"Question text?","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"Why A is correct."}]`;

  const authHdr = typeof _getAuthHeader === 'function' ? await _getAuthHeader() : {};
  const res = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHdr },
    body: JSON.stringify({
      question: prompt,
      mode: 'generate',
      task_type: 'exam',
      complexity: 6,
      bookId: 'none',
      history: [],
    }),
  });

  if (!res.ok) throw new Error(`Server error ${res.status}`);
  const data = await res.json();
  const raw = (data.answer || data.response || data.text || data.content || data.result || '').trim();

  // Parse JSON array from response
  const s = raw.indexOf('[');
  const e = raw.lastIndexOf(']');
  if (s < 0 || e < 0) throw new Error('Could not parse questions — please try again.');

  let jsonStr = raw.slice(s, e + 1)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
    .replace(/:\s*'([^']*)'/g, ': "$1"');

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (_) {
    const objects = [];
    const objRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    let m;
    while ((m = objRegex.exec(jsonStr)) !== null) {
      try { objects.push(JSON.parse(m[0])); } catch (_e) {}
    }
    if (objects.length) parsed = objects;
    else throw new Error('Could not parse questions — please try again.');
  }

  if (!Array.isArray(parsed) || !parsed.length) throw new Error('No questions returned.');
  return parsed;
}

// ── Exam Mode selection card ──────────────────────────────────────────────────

/**
 * Append an "Exam Mode" card to the workspace chat.
 * The card offers Quick Quiz (inline), Full Exam (navigate), and Customize.
 *
 * @param {string} topic
 * @param {string} [userMessage] — original user question to show in the bubble
 */
export function wsShowExamCard(topic, userMessage) {
  const msgs = $el('ws-messages');
  if (!msgs) return;

  // Remove welcome state if present
  const welcome = document.getElementById('ws-welcome-state');
  if (welcome) welcome.remove();

  // Append the user's message bubble if provided
  if (userMessage) {
    wsAppendUser(userMessage, '');
  }

  const safeTopic     = _esc(topic || 'this topic');
  const safeTopicAttr = _escJsAttr(topic || '');  // safe inside onclick="...('...')"

  const wrapper = document.createElement('div');
  wrapper.className = 'msg msg-ai ws-exam-card-msg';

  wrapper.innerHTML = `
    <div class="ai-row">
      <div class="ai-body">
        <div class="ws-exam-card">
          <div class="ws-exam-card-header">
            <span class="ws-exam-card-icon">📝</span>
            <div>
              <div class="ws-exam-card-title">Exam Mode</div>
              <div class="ws-exam-card-topic">${safeTopic}</div>
            </div>
          </div>
          <div class="ws-exam-card-divider"></div>
          <div class="ws-exam-card-options">
            <button class="ws-exam-card-btn ws-exam-card-btn--primary"
              onclick="wsStartInlineQuiz('${safeTopicAttr}', this.closest('.ws-exam-card-msg'))">
              <span class="ws-exam-card-btn-icon">⚡</span>
              <div>
                <div class="ws-exam-card-btn-label">Quick Quiz</div>
                <div class="ws-exam-card-btn-sub">5–10 questions, right here in chat</div>
              </div>
            </button>
            <button class="ws-exam-card-btn"
              onclick="wsNavigateToFullExam('${safeTopicAttr}')">
              <span class="ws-exam-card-btn-icon">🧪</span>
              <div>
                <div class="ws-exam-card-btn-label">Full Exam</div>
                <div class="ws-exam-card-btn-sub">Advanced options, timer, scoring</div>
              </div>
            </button>
            <button class="ws-exam-card-btn"
              onclick="wsNavigateToFullExam('${safeTopicAttr}')">
              <span class="ws-exam-card-btn-icon">⚙️</span>
              <div>
                <div class="ws-exam-card-btn-label">Customize</div>
                <div class="ws-exam-card-btn-sub">Choose type, difficulty, format</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>`;

  msgs.appendChild(wrapper);
  wsScrollBottom();
}

// ── Inline quick quiz runner ──────────────────────────────────────────────────

/**
 * Replace the exam card in-place with a loading indicator, then mount the
 * inline quiz widget once questions are generated.
 *
 * @param {string}      topic     — quiz topic
 * @param {HTMLElement} cardMsg   — the .ws-exam-card-msg element to replace
 */
export async function wsStartInlineQuiz(topic, cardMsg) {
  const msgs = $el('ws-messages');
  if (!msgs) return;

  // Replace exam card with loading state
  const loadEl = document.createElement('div');
  loadEl.className = 'msg msg-ai';
  loadEl.innerHTML = `
    <div class="ai-row">
      <div class="ai-body">
        <div class="ws-iq-loading">
          <span class="ws-typing-dot"></span>
          <span class="ws-typing-dot"></span>
          <span class="ws-typing-dot"></span>
          <span style="font-size:12px;color:var(--text-3);margin-left:8px;">Generating quiz on <em>${_esc(topic)}</em>…</span>
        </div>
      </div>
    </div>`;
  if (cardMsg && cardMsg.parentNode === msgs) {
    msgs.replaceChild(loadEl, cardMsg);
  } else {
    msgs.appendChild(loadEl);
  }
  wsScrollBottom();

  let questions;
  try {
    questions = await _generateQuestions(topic, 7);
  } catch (err) {
    loadEl.innerHTML = `
      <div class="ai-row"><div class="ai-body">
        <p class="ai-text" style="color:#f87171;">⚠ ${_esc(err.message)}</p>
      </div></div>`;
    wsScrollBottom();
    return;
  }

  // Mount the quiz widget in place of the loading indicator
  _mountQuizWidget(loadEl, topic, questions);
}

// ── Quiz widget ───────────────────────────────────────────────────────────────

function _mountQuizWidget(containerMsg, topic, questions) {
  const state = {
    idx:      0,
    selected: null,       // currently selected option letter
    revealed: false,      // whether answer is revealed for this Q
    answers:  [],         // { selected, correct, isRight } per question
  };

  function _onNext() {
    if (!state.selected) return;
    if (!state.revealed) {
      // Reveal answer for this question
      const q = questions[state.idx];
      const correct = (q.answer || '').toUpperCase().trim();
      const isRight = state.selected === correct;
      state.answers.push({ selected: state.selected, correct, isRight });
      state.revealed = true;
      _render();
      return;
    }
    // Advance to next question or show results
    state.idx++;
    state.selected = null;
    state.revealed = false;
    if (state.idx >= questions.length) {
      _showResults(containerMsg, topic, questions, state.answers);
    } else {
      _render();
    }
  }

  function _render() {
    const q     = questions[state.idx];
    const total = questions.length;
    const pct   = Math.round((state.idx / total) * 100);

    const optionsHtml = (q.options || []).map((opt, i) => {
      const letter = String.fromCharCode(65 + i);   // A, B, C, D
      let cls = 'ws-iq-option';
      if (state.revealed) {
        const isCorrect  = letter === (q.answer || '').toUpperCase().trim();
        const isSelected = letter === state.selected;
        if (isCorrect)       cls += ' ws-iq-option--correct';
        else if (isSelected) cls += ' ws-iq-option--wrong';
      } else if (letter === state.selected) {
        cls += ' ws-iq-option--selected';
      }
      const disabled = state.revealed ? 'disabled' : '';
      // Use data-letter instead of inline onclick to avoid injecting letter into HTML
      return `<button class="${cls}" ${disabled} data-letter="${_esc(letter)}">${_esc(opt)}</button>`;
    }).join('');

    const explanationHtml = state.revealed && q.explanation
      ? `<div class="ws-iq-explanation">${_esc(q.explanation)}</div>`
      : '';

    const btnLabel = state.revealed
      ? (state.idx < total - 1 ? 'Next Question →' : 'See Results')
      : 'Submit Answer';

    containerMsg.className = 'msg msg-ai ws-iq-msg';
    containerMsg.innerHTML = `
      <div class="ai-row">
        <div class="ai-body ws-iq-body">
          <div class="ws-iq-progress-bar-wrap">
            <div class="ws-iq-progress-bar" style="width:${pct}%"></div>
          </div>
          <div class="ws-iq-counter">Question ${state.idx + 1} of ${total}</div>
          <div class="ws-iq-question">${_esc(q.q)}</div>
          <div class="ws-iq-options">${optionsHtml}</div>
          ${explanationHtml}
          <div class="ws-iq-footer">
            <button class="ws-iq-submit" ${!state.selected ? 'disabled' : ''}>
              ${btnLabel}
            </button>
          </div>
        </div>
      </div>`;

    // Attach event listeners after innerHTML update (avoids inline onclick)
    containerMsg.querySelectorAll('.ws-iq-option').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.revealed) return;
        state.selected = btn.dataset.letter;
        _render();
      });
    });
    const submitBtn = containerMsg.querySelector('.ws-iq-submit');
    if (submitBtn) submitBtn.addEventListener('click', _onNext);

    wsScrollBottom();
  }

  _render();
}

// ── Result card ───────────────────────────────────────────────────────────────

function _showResults(containerMsg, topic, questions, answers) {
  const total   = questions.length;
  const correct = answers.filter(a => a.isRight).length;
  const pct     = Math.round((correct / total) * 100);

  // Persist result (best-effort, silent fail for guests)
  saveExamResult({
    topic,
    questions,
    score: pct,
    meta:  { mode: 'inline_quick_quiz', correct, total },
  }).catch(() => {});

  const emoji     = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪';
  const safeTopic = _esc(topic || 'this topic');

  containerMsg.className = 'msg msg-ai';
  containerMsg.innerHTML = `
    <div class="ai-row">
      <div class="ai-body">
        <div class="ws-iq-result-card">
          <div class="ws-iq-result-score">${emoji} You scored <strong>${correct}/${total}</strong></div>
          <div class="ws-iq-result-sub">${pct}% on ${safeTopic}</div>
          <div class="ws-iq-result-bar-wrap">
            <div class="ws-iq-result-bar" style="width:${pct}%"></div>
          </div>
          <div class="ws-iq-result-actions">
            <button class="ws-iq-result-btn" data-action="retry">🔁 Retry Quiz</button>
            <button class="ws-iq-result-btn" data-action="flashcards">📚 Review Flashcards</button>
            <button class="ws-iq-result-btn ws-iq-result-btn--primary" data-action="fullexam">🧪 Take Full Exam</button>
          </div>
        </div>
      </div>
    </div>`;

  // Wire up result action buttons without inline onclick
  containerMsg.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
    wsStartInlineQuiz(topic, containerMsg);
  });
  containerMsg.querySelector('[data-action="flashcards"]')?.addEventListener('click', () => {
    if (typeof window.wsGenerateFlashcardsInChat === 'function') {
      window.wsGenerateFlashcardsInChat(topic);
    }
  });
  containerMsg.querySelector('[data-action="fullexam"]')?.addEventListener('click', () => {
    wsNavigateToFullExam(topic);
  });

  wsScrollBottom();
}

// ── Full Exam navigation ──────────────────────────────────────────────────────

/**
 * Navigate to the Exam screen and prefill the topic input.
 *
 * @param {string} topic
 */
export function wsNavigateToFullExam(topic) {
  try {
    sessionStorage.setItem('chunks_nav_from', 'workspace');
    if (topic) sessionStorage.setItem('chunks_nav_topic', topic);
  } catch (_) {}

  showScreen('exam');

  // Prefill topic after the screen is visible (next tick)
  requestAnimationFrame(() => {
    const topicEl = document.getElementById('exam-topic-input');
    if (topicEl && topic) {
      topicEl.value = topic;
      topicEl.dispatchEvent(new Event('input'));
    }
    // Show back-to-workspace button
    const backBtn = document.getElementById('exam-back-to-ws');
    if (backBtn) {
      backBtn.style.display = '';
      const label = backBtn.querySelector('.exam-back-label');
      if (label) label.textContent = `← Back · ${topic || 'Workspace'}`;
    }
  });
}
