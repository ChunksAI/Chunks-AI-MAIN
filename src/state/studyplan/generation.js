// @ts-nocheck
/**
 * src/state/studyplan/generation.js — Plan generation + overlay
 */

import { sp } from './state.js';
import { $el, setHtml } from '../domHelpers.js';
import { API_BASE, _getAuthHeader } from '../../lib/api.js';
import { guestGate, recordUsage, isGuest, showLoginWall } from '../../lib/guestLimits.js';
import { spValidateInputs, spShowValidationError } from './input.js';
import { _getStudyMode } from '../../components/SettingsModal.js';
import { setActivePlan } from '../../components/Sidebar.js';
import { _spGenPlanId } from './planLibrary.js';
import { spRenderPlanPatched } from './patches.js';
import { spUpdateExamDateUI } from './calendar.js';
import { spUpdateReminderUI } from './notifications.js';
import { spSavePlanToSidebarAndLibrary } from './patches.js';

export function spShowOverlay() {
  $el('sp-generating-overlay').style.display = 'flex';
  for (let i = 1; i <= 5; i++) $el('gen-step-'+i).className = 'sp-gen-step';
  const delays = [200, 900, 2200, 3800, 5400];
  delays.forEach((delay, idx) => {
    setTimeout(() => {
      if (idx > 0) { const prev = $el('gen-step-'+idx); prev.className = 'sp-gen-step done'; prev.querySelector('.sp-gen-step-dot').innerHTML = ''; }
      $el('gen-step-'+(idx+1)).className = 'sp-gen-step active';
    }, delay);
  });
}

export function spHideOverlay() {
  for (let i = 1; i <= 5; i++) $el('gen-step-'+i).className = 'sp-gen-step done';
  setTimeout(() => { $el('sp-generating-overlay').style.display = 'none'; }, 400);
}

export function _aiParams(base) {
  const m = (typeof _getStudyMode === 'function' ? _getStudyMode() : null)
            || localStorage.getItem('chunks_study_mode') || 'balanced';
  const complexity = m === 'concise' ? Math.max(2, base - 2)
                   : m === 'detailed' ? Math.min(9, base + 2)
                   : base;
  const language    = localStorage.getItem('chunks_setting_language') || 'Auto-detect';
  const safeContent = localStorage.getItem('chunks_setting_safe-content') === '1';
  return { complexity, language, safe_content: safeContent };
}

export async function spHandleGenerate() {
  if (!spValidateInputs()) return;
  if (!guestGate('studyplan')) return;

  let sourceContent = '', sourceName = '', sourceType = sp.activeTab;
  if (sp.activeTab === 'upload') {
    sourceContent = sp.pdfText;
    sourceName    = sp.pdfFileName.replace(/\.pdf$/i, '');
  } else if (sp.activeTab === 'topic') {
    const topic = $el('sp-topic-input').value.trim();
    const depthLabels = { intro:'Introductory', mid:'Intermediate', adv:'Advanced', exam:'Exam Prep' };
    sourceContent = `Topic: ${topic}\nDepth level: ${depthLabels[sp.activeDepth]}`;
    sourceName    = topic;
  } else {
    sourceContent = $el('sp-notes-input').value.trim();
    sourceName    = 'Study Notes';
  }

  spShowOverlay();
  const btn = $el('sp-generate-btn');
  btn.disabled = true; btn.style.opacity = '0.6';

  const systemPrompt = `You are an expert curriculum designer and learning scientist.
Your job is to analyze educational material and produce a structured "critical path to mastery" — a sequence of essential concepts a student must learn in order, from foundations to full understanding.

CRITICAL: Respond with ONLY a valid JSON object. No markdown fences, no prose, no explanation — just the raw JSON.

JSON schema:
{
  "topic": "Short title of the overall topic (max 6 words)",
  "subject": "Parent subject / course name",
  "estimatedHours": <number, total hours to master>,
  "sourceType": "pdf" | "topic" | "notes",
  "concepts": [
    {
      "id": <1-based integer>,
      "title": "Concept title (max 8 words)",
      "description": "2–3 sentence explanation of what this concept covers and why it matters.",
      "estimatedMinutes": <integer, realistic study time>,
      "keyTerms": ["term1", "term2", "term3"]
    }
  ]
}

Rules:
- Produce between 4 and 8 concepts (6 is ideal).
- Order them as a true prerequisite chain — earlier concepts must be mastered before later ones.
- The last concept should always be a synthesis / exam simulation node titled "Final Exam Simulation".
- Keep titles sharp and student-friendly.
- estimatedHours should be the sum of all estimatedMinutes / 60, rounded to 1 decimal.`;

  const contentSlice = sourceType === 'topic' ? sourceContent : sourceContent.slice(0, 16000);
  const userPrompt   = sourceType === 'topic'
    ? `Build a critical path for: ${contentSlice}`
    : `Analyze the following material and build a critical path to mastery:\n\n${contentSlice}`;
  const fullPrompt   = systemPrompt + '\n\n' + userPrompt;

  let _authHeaders = { 'Content-Type': 'application/json' };
  try {
    _authHeaders = { ..._authHeaders, ...await _getAuthHeader?.() ?? {} };
  } catch (_) {}

  let _spAttempt = 0;
  const _spMaxAttempts = 3;

  const _spTryGenerate = async () => {
    const response = await fetch(API_BASE + '/ask', {
      method: 'POST', headers: _authHeaders,
      body: JSON.stringify({ question: fullPrompt, mode: 'generate', task_type: 'study_plan', ...(() => { const p = _aiParams(7); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }),
    });
    if (response.status === 429) {
      const _d429 = await response.json().catch(() => ({}));
      if (_d429.guest_limited && isGuest?.() && typeof showLoginWall === 'function') {
        showLoginWall(_d429.feature || 'studyplan');
        return null;
      }
      if (_d429.plan_limited && _d429.upgrade_needed) {
        if (typeof window.openUpgradeModal === 'function') window.openUpgradeModal();
        return null;
      }
      throw Object.assign(new Error('Server is busy — please wait a moment and try again.'), { noRetry: false, _is429: true });
    }
    if (!response.ok) {
      let errMsg = 'Server error ' + response.status;
      try { const e = await response.json(); errMsg = e.error || errMsg; } catch (_) {}
      const noRetry = response.status === 502 || response.status < 500;
      throw Object.assign(new Error(errMsg), { noRetry });
    }
    const data = await response.json();
    let plan;
    if (data.answer && typeof data.answer === 'object' && data.answer.concepts) {
      plan = data.answer;
    } else {
      const rawText = (typeof data.answer === 'string' ? data.answer : data.response || data.text || data.content || '').trim();
      if (!rawText) throw new Error('Empty response from server.');
      plan = JSON.parse(rawText.replace(/```(?:json)?/g, '').trim());
    }
    if (!plan || !Array.isArray(plan.concepts) || plan.concepts.length === 0) throw new Error('Invalid plan structure returned. Please try again.');
    sp.currentPlan = plan;
    sp.mastery = {};
    sp.examDate = null;
    try {
      localStorage.removeItem('sp_exam_date_default');
    } catch (_) {}
    sp.activePlanId = _spGenPlanId();
    recordUsage('studyplan');
    if (typeof setActivePlan === 'function') setActivePlan(sp.activePlanId);
    spHideOverlay();
    spRenderPlanPatched(plan, sourceName);
    spUpdateExamDateUI();
    spUpdateReminderUI();
    spSavePlanToSidebarAndLibrary(plan.topic);
  };

  const _spRetry = async () => {
    try { await _spTryGenerate(); } catch (err) {
      if (!err.noRetry && _spAttempt < _spMaxAttempts) {
        _spAttempt++;
        const base = 1500 * _spAttempt;
        const jitter = Math.random() * 600 - 300;
        await new Promise(r => setTimeout(r, base + jitter));
        return _spRetry();
      }
      console.error('SP generation error:', err);
      spHideOverlay();
      btn.disabled = false; btn.style.opacity = '';
      spShowValidationError('Generation failed: ' + err.message + ' Check your connection and try again.');
    }
  };
  _spRetry();
}
