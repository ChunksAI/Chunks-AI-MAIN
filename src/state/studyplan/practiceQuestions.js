// @ts-nocheck
/**
 * src/state/studyplan/practiceQuestions.js — Practice Q's engine
 */

import { sp } from './state.js';
import { $el, hide, show, setText, setHtml } from '../domHelpers.js';
import { API_BASE, _getAuthHeader } from '../../lib/api.js';
import { _aiParams } from './generation.js';
import { spMasteryRecord } from './mastery.js';
import { isGuest, showLoginWall } from '../../lib/guestLimits.js';

export async function spPqGenerate() {
  sp.pqQuestions = []; sp.pqIndex = 0; sp.pqScore = 0;
  setHtml($el('sp-pq-loading'), '<div class="sp-explain-spinner"></div><div style="font-size:12px;">Generating questions…</div>');
  $el('sp-pq-loading').style.display        = 'flex';
  hide($el('sp-pq-question-view'));
  hide($el('sp-pq-complete'));
  const concept = sp.drawerConcept;
  const prompt  = `Generate exactly 5 short-answer practice questions about: "${concept.title}".\n${concept.description ? 'Context: ' + concept.description : ''}\n${concept.keyTerms?.length ? 'Key terms: ' + concept.keyTerms.join(', ') : ''}\n\nRules:\n- Questions should test understanding, not just recall\n- Each should be answerable in 1-3 sentences\n- Vary difficulty: 2 easy, 2 medium, 1 hard\n- Output ONLY a raw JSON array, no markdown:\n[{"question":"...","ideal_answer":"...","key_points":["point1","point2"]}]`;
  try {
    const res  = await fetch(API_BASE + '/ask', { method: 'POST', headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} }, body: JSON.stringify({ question: prompt, mode: 'study', task_type: 'study_plan_practice', ...(() => { const p = _aiParams(6); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }) });
    if (res.status === 429) { const _d = await res.json().catch(()=>({})); if (_d.guest_limited && isGuest?.() && typeof showLoginWall === 'function') { showLoginWall(_d.feature||'workspace'); return; } throw new Error('Server busy'); }
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();
    sp.pqQuestions = JSON.parse((data.answer || data.response || data.text || '').trim().replace(/```(?:json)?/g,'').trim());
    spPqShowCurrent();
  } catch (err) {
    setHtml($el('sp-pq-loading'), `<div style="color:var(--red);font-size:12px;text-align:center;padding:20px;">Failed to generate questions.<br><button onclick="spPqGenerate()" style="margin-top:10px;padding:6px 14px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:11px;cursor:pointer;font-family:var(--font-body);">Try again</button></div>`);
    console.error('PQ generate error:', err);
  }
}

export function spPqShowCurrent() {
  hide($el('sp-pq-loading'));
  hide($el('sp-pq-complete'));
  $el('sp-pq-question-view').style.display = 'flex';
  const q = sp.pqQuestions[sp.pqIndex];
  if (!q) return;
  $el('sp-pq-progress-bar').style.width  = (sp.pqIndex / sp.pqQuestions.length * 100) + '%';
  setText($el('sp-pq-counter'), (sp.pqIndex + 1) + ' / ' + sp.pqQuestions.length);
  setText($el('sp-pq-question-text'), q.question);
  $el('sp-pq-answer-input').value        = '';
  $el('sp-pq-input-wrap').style.display  = 'flex';
  hide($el('sp-pq-result'));
  $el('sp-pq-answer-input').disabled     = false;
  $el('sp-pq-submit-btn').disabled       = false;
  setText($el('sp-pq-submit-btn'), 'Submit Answer');
  $el('sp-pq-answer-input').focus();
}

export async function spPqSubmit() {
  if (sp.pqGrading) return;
  const answer = $el('sp-pq-answer-input').value.trim();
  if (!answer) return;
  sp.pqGrading = true;
  const btn = $el('sp-pq-submit-btn');
  setText(btn, 'Grading…'); btn.disabled = true;
  $el('sp-pq-answer-input').disabled = true;
  const q = sp.pqQuestions[sp.pqIndex];
  const prompt = `You are a tutor grading a student's short-answer response. Your job is to distinguish genuine understanding from guessing or pattern-matching.\n\nQuestion: ${q.question}\nIdeal answer covers: ${q.ideal_answer}\nKey points to check: ${(q.key_points || []).join('; ')}\n\nStudent's answer: "${answer}"\n\nEvaluate on these dimensions:\n1. Correctness — are the facts right?\n2. Understanding depth — does the student explain WHY, not just WHAT?\n3. Confidence signal — is the answer specific and assured, or vague/hedged?\n\nRespond ONLY as raw JSON (no markdown):\n{"correct": true/false, "score": 0-100, "understanding": "surface|partial|deep", "feedback": "1-2 sentences on what was right/wrong and the correct answer", "hint": "one specific thing they should review if understanding is surface or partial"}`;
  try {
    const res    = await fetch(API_BASE + '/ask', { method: 'POST', headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} }, body: JSON.stringify({ question: prompt, mode: 'study', task_type: 'study_plan_grade', ...(() => { const p = _aiParams(5); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }) });
    if (res.status === 429) { const _d = await res.json().catch(()=>({})); if (_d.guest_limited && isGuest?.() && typeof showLoginWall === 'function') { showLoginWall(_d.feature||'workspace'); return; } throw new Error('Server busy'); }
    const data   = await res.json();
    const result = JSON.parse((data.answer || data.response || data.text || '').trim().replace(/```(?:json)?/g,'').trim());
    const depthMult = result.understanding === 'deep' ? 1.0 : result.understanding === 'partial' ? 0.75 : 0.5;
    const adjustedScore = Math.round((result.score || 0) * depthMult);
    if (adjustedScore >= 60) sp.pqScore++;
    const verdictEl = $el('sp-pq-verdict');
    const passed    = adjustedScore >= 60;
    const depthLabel = { deep: '🧠 Deep', partial: '📖 Partial', surface: '🔍 Surface' }[result.understanding || 'partial'];
    verdictEl.style.background = passed ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)';
    verdictEl.style.borderLeft = `3px solid ${passed ? 'var(--green)' : 'var(--red)'}`;
    verdictEl.style.color      = passed ? 'var(--green)' : 'var(--red)';
    setHtml(verdictEl, (passed ? '✓ Correct' : '✗ Incorrect') +
      `<span style="margin-left:8px;font-size:10px;padding:2px 7px;border-radius:var(--r-pill);background:var(--surface-3);color:var(--text-3);">${depthLabel}</span>` +
      `<span style="margin-left:auto;font-size:11px;font-family:var(--font-mono);opacity:0.8;">${adjustedScore}%</span>`);
    const feedbackEl = $el('sp-pq-explanation');
    setHtml(feedbackEl, `<div style="margin-bottom:6px;">${result.feedback || ''}</div>` +
      (result.hint && result.understanding !== 'deep' ? `<div style="margin-top:6px;padding:7px 10px;background:rgba(232,172,46,0.08);border:1px solid rgba(232,172,46,0.2);border-radius:var(--r-sm);font-size:11px;color:var(--gold);"><strong>Review tip:</strong> ${result.hint}</div>` : ''));
    setText($el('sp-pq-next-btn'), sp.pqIndex >= sp.pqQuestions.length - 1 ? 'See Results' : 'Next Question →');
    hide($el('sp-pq-input-wrap'));
    $el('sp-pq-result').style.display     = 'flex';
  } catch (err) {
    setText($el('sp-pq-explanation'), 'Grading failed. Please try again.');
    $el('sp-pq-result').style.display    = 'flex';
    hide($el('sp-pq-input-wrap'));
    console.error('PQ grade error:', err);
  } finally { sp.pqGrading = false; }
}

export function spPqNext() {
  sp.pqIndex++;
  if (sp.pqIndex >= sp.pqQuestions.length) spPqShowComplete(); else spPqShowCurrent();
}

export function spPqShowComplete() {
  hide($el('sp-pq-question-view'));
  $el('sp-pq-complete').style.display      = 'flex';
  const total = sp.pqQuestions.length;
  const pct   = Math.round((sp.pqScore / total) * 100);
  setText($el('sp-pq-complete-emoji'), pct >= 80 ? '🎯' : pct >= 60 ? '📚' : '💪');
  setHtml($el('sp-pq-complete-text'),
    `You got <strong style="color:var(--text-1);">${sp.pqScore} / ${total}</strong> correct (${pct}%).<br>` +
    (pct >= 80 ? 'Great work! Ready to take the Mini Exam.' : 'Keep practicing to strengthen your understanding.'));
  spMasteryRecord('pq', pct);
}

export function spPqRestart() { sp.pqIndex = 0; sp.pqScore = 0; spPqShowCurrent(); }
