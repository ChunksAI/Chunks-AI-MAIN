/**
 * src/state/studyplan/exam.js — Mini exam engine + timer
 */

import { sp } from './state.js';
import { $el, $qsa, hide, show, setText, setHtml } from '../domHelpers.js';
import { API_BASE, _getAuthHeader } from '../../lib/api.js';
import { _aiParams } from './generation.js';
import { spMasteryRecord } from './mastery.js';
import { spSrsUpdate } from './srs.js';
import { isGuest, showLoginWall } from '../../lib/guestLimits.js';

export async function spExamGenerate() {
  sp.examQuestions = []; sp.examIndex = 0; sp.examAnswers = []; sp.examStarted = false;
  clearInterval(sp.examTimerHandle);
  setHtml($el('sp-exam-loading'), '<div class="sp-explain-spinner" style="border-top-color:var(--red);"></div><div style="font-size:12px;">Generating exam…</div>');
  ['sp-exam-loading','sp-exam-intro','sp-exam-question-view','sp-exam-results'].forEach((id, i) => {
    $el(id).style.display = i === 0 ? 'flex' : 'none';
  });
  const concept = sp.drawerConcept;
  const prompt  = `Generate exactly 10 multiple-choice exam questions about: "${concept.title}".\n${concept.description ? 'Context: ' + concept.description : ''}\n${concept.keyTerms?.length ? 'Key terms: ' + concept.keyTerms.join(', ') : ''}\n\nRules:\n- 4 options labeled A-D, one correct answer\n- Mix of easy, medium, and hard questions\n- Test understanding and application, not just definitions\n- Output ONLY a raw JSON array, no markdown:\n[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"1 sentence why this is correct"}]`;
  const _examFetchWithRetry = async (maxRetries = 3) => {
    const loadingEl = $el('sp-exam-loading');
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await fetch(API_BASE + '/ask', { method: 'POST', headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} }, body: JSON.stringify({ question: prompt, mode: 'study', task_type: 'study_plan_exam', ...(() => { const p = _aiParams(7); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }) });
      if (res.status === 429) {
        const _d = await res.json().catch(() => ({}));
        if (_d.guest_limited && isGuest?.() && typeof showLoginWall === 'function') { showLoginWall(_d.feature || 'exam'); return null; }
        if (_d.plan_limited && _d.upgrade_needed) { if (typeof window.openUpgradeModal === 'function') window.openUpgradeModal(); return null; }
        if (attempt < maxRetries) {
          const waitSec = Math.pow(2, attempt + 1);
          if (loadingEl) loadingEl.querySelector('.sp-exam-loading-text') && (loadingEl.querySelector('.sp-exam-loading-text').textContent = `Server is busy — retrying in ${waitSec}s…`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
          continue;
        }
        throw new Error('Server is busy — please wait a moment and try again.');
      }
      if (!res.ok) throw new Error('Server error ' + res.status);
      return await res.json();
    }
  };
  try {
    const data = await _examFetchWithRetry();
    if (!data) return;
    sp.examQuestions = JSON.parse((data.answer || data.response || data.text || '').trim().replace(/```(?:json)?/g,'').trim());
    hide($el('sp-exam-loading'));
    $el('sp-exam-intro').style.display   = 'flex';
    _spExamUpdateTimerDisplay(300);
  } catch (err) {
    setHtml($el('sp-exam-loading'), `<div style="color:var(--red);font-size:12px;text-align:center;padding:20px;">Failed to generate exam.<br><button onclick="spExamGenerate()" style="margin-top:10px;padding:6px 14px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:11px;cursor:pointer;font-family:var(--font-body);">Try again</button></div>`);
    console.error('Exam generate error:', err);
  }
}

export function spExamStart() {
  sp.examIndex = 0; sp.examAnswers = []; sp.examStarted = true; sp.examTimerSec = 300;
  hide($el('sp-exam-intro'));
  $el('sp-exam-question-view').style.display = 'flex';
  clearInterval(sp.examTimerHandle);
  sp.examTimerHandle = setInterval(() => {
    sp.examTimerSec--;
    _spExamUpdateTimerDisplay(sp.examTimerSec);
    if (sp.examTimerSec <= 0) { clearInterval(sp.examTimerHandle); spExamFinish(); }
  }, 1000);
  spExamShowCurrent();
}

export function _spExamUpdateTimerDisplay(sec) {
  const str = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  ['sp-exam-timer','sp-exam-timer-display'].forEach(id => {
    const el = $el(id);
    if (el) { setText(el, str); el.style.color = sec <= 60 ? 'var(--red)' : sec <= 120 ? 'var(--gold)' : 'var(--red)'; }
  });
}

export function spExamShowCurrent() {
  const q = sp.examQuestions[sp.examIndex];
  if (!q) return;
  $el('sp-exam-progress-bar').style.width = (sp.examIndex / sp.examQuestions.length * 100) + '%';
  setText($el('sp-exam-counter'), (sp.examIndex + 1) + '/' + sp.examQuestions.length);
  setText($el('sp-exam-q-text'), q.q);
  const opts = $el('sp-exam-options');
  opts.innerHTML = '';
  q.options.forEach((opt, i) => {
    const letter = ['A','B','C','D'][i];
    const btn = document.createElement('button');
    btn.className = 'sp-exam-opt-btn'; btn.textContent = opt;
    btn.onclick = () => spExamAnswer(letter, btn);
    opts.appendChild(btn);
  });
}

export function spExamAnswer(letter, btnEl) {
  $qsa('.sp-exam-opt-btn').forEach(b => b.disabled = true);
  const q = sp.examQuestions[sp.examIndex];
  sp.examAnswers.push({ chosen: letter, correct: q.answer });
  const correct = letter === q.answer;
  btnEl.style.background  = correct ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)';
  btnEl.style.borderColor = correct ? 'var(--green)' : 'var(--red)';
  btnEl.style.color       = correct ? 'var(--green)' : 'var(--red)';
  if (!correct) {
    $qsa('.sp-exam-opt-btn').forEach(b => {
      if (b.textContent.charAt(0) === q.answer) { b.style.background = 'rgba(52,211,153,0.1)'; b.style.borderColor = 'var(--green)'; b.style.color = 'var(--green)'; }
    });
  }
  const expEl = document.createElement('div');
  expEl.style.cssText = 'font-size:11px;color:var(--text-3);padding:8px 12px;background:var(--surface-2);border-radius:var(--r-sm);border:1px solid var(--border-xs);margin-top:4px;line-height:1.5;flex-shrink:0;';
  expEl.textContent = q.explanation || '';
  $el('sp-exam-options').appendChild(expEl);
  setTimeout(() => { sp.examIndex++; if (sp.examIndex >= sp.examQuestions.length) spExamFinish(); else spExamShowCurrent(); }, 1800);
}

export function spExamFinish() {
  clearInterval(sp.examTimerHandle);
  hide($el('sp-exam-question-view'));
  $el('sp-exam-results').style.display       = 'flex';
  const total   = sp.examQuestions.length;
  const correct = sp.examAnswers.filter(a => a.chosen === a.correct).length;
  const pct     = Math.round((correct / total) * 100);
  const passed  = pct >= 70;
  setText($el('sp-exam-result-emoji'), passed ? '🏆' : '📖');
  setText($el('sp-exam-result-title'), passed ? 'Exam Passed!' : 'Not Quite Yet');
  setText($el('sp-exam-result-score'), pct + '%');
  $el('sp-exam-result-score').style.color = passed ? 'var(--green)' : 'var(--red)';
  setText($el('sp-exam-result-sub'), passed
    ? `You got ${correct}/${total} correct. The next concept is now unlocked!`
    : `You got ${correct}/${total} correct. You need 70% to pass. Review the concept and try again.`);
  spMasteryRecord('exam', pct);
  if (sp.drawerConcept && sp.currentPlan) {
    const idx = sp.currentPlan.concepts.indexOf(sp.drawerConcept);
    if (idx >= 0) spSrsUpdate(idx, pct);
  }
}

export function spExamRestart() { spExamGenerate(); }
