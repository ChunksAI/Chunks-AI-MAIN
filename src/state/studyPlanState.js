/**
 * src/state/studyPlanState.js — Study Plan state
 *
 * Owns all logic for the Study Plan screen:
 *  • Input (PDF upload/extraction, topic, notes) + tab switching
 *  • Plan generation (Claude API → JSON roadmap)
 *  • Mastery tracking + node unlock chain
 *  • AI Explain drawer + _spStreamExplain
 *  • Mini flashcard engine (sp-specific, separate from main flash screen)
 *  • Practice Q's engine (generate + grade via AI)
 *  • Mini Exam engine (timed MCQ)
 *  • Panel/donut live update
 *  • Recent plans sidebar
 *
 * Task 18 — extracted from monolith, index.html lines 9767–11379.
 */

import { API_BASE } from '../lib/api.js';

// ── State ──────────────────────────────────────────────────────────────────

export let _spActiveTab    = 'upload';
export let _spActiveDepth  = 'intro';
export let _spPdfText      = '';
export let _spPdfFileName  = '';
export let _spPdfPageCount = 0;
export let _spCurrentPlan  = null;
export let _spAllPlans     = {};   // { planId: { plan, mastery, savedAt, topic } }
export let _spActivePlanId = null; // currently loaded plan id
export let _spMastery      = {};
export let _spGenTimer     = null;
export let _spExplainFocusRelease = null;
export let _spDrawerConcept = null;
export let _spFcDeck   = [];
export let _spFcIndex  = 0;
export let _spFcFlipped = false;
export let _spFcStats  = { easy: 0, ok: 0, hard: 0 };
export let _spPqQuestions = [];
export let _spPqIndex     = 0;
export let _spPqScore     = 0;
export let _spPqGrading   = false;
export let _spExamQuestions  = [];
export let _spExamIndex      = 0;
export let _spExamAnswers    = [];
export let _spExamTimerSec   = 300;
export let _spExamTimerHandle = null;
export let _spExamStarted    = false;
export let _explainAbortCtrl = null;
export let _spExamDate = null;  // ISO date string 'YYYY-MM-DD' or null
export let _spSrsSchedule = {}; // { conceptIdx: { nextReview: timestamp, interval: days, ease: float } }
export const SRS_MIN_INTERVAL = 1;
export const SRS_EASE_DEFAULT = 2.5;

export const SP_WEIGHTS = { explain: 10, flash: 20, pq: 35, exam: 35 };

// ── Mastery helpers ────────────────────────────────────────────────────────

export function spMasteryGet(idx) {
  if (!_spMastery[idx]) _spMastery[idx] = { explain: 0, flash: 0, pq: 0, exam: 0 };
  return _spMastery[idx];
}

export function spMasteryScore(idx) {
  if (idx === undefined || idx === null || idx < 0) return 0;
  const m = spMasteryGet(idx);
  return Math.min(100, Math.round(
    (m.explain / 100) * SP_WEIGHTS.explain +
    (m.flash   / 100) * SP_WEIGHTS.flash   +
    (m.pq      / 100) * SP_WEIGHTS.pq      +
    (m.exam    / 100) * SP_WEIGHTS.exam
  ));
}

export function spMasteryRecord(activityKey, score) {
  if (!_spDrawerConcept || !_spCurrentPlan) return;
  const idx = _spCurrentPlan.concepts.indexOf(_spDrawerConcept);
  if (idx < 0) return;
  const m = spMasteryGet(idx);
  m[activityKey] = Math.max(m[activityKey], score);
  const total = spMasteryScore(idx);
  spMasteryUpdateNode(idx, total);
  if (total >= 80) spMasteryUnlockNext(idx);
  spUpdatePanel();
  // Keep localStorage in sync so mastery survives a refresh
  try { localStorage.setItem('sp_active_mastery', JSON.stringify(_spMastery)); } catch (_) {}
  // Also update sp_all_plans so clicking the plan from the sidebar loads current mastery
  try {
    if (_spActivePlanId && _spAllPlans[_spActivePlanId]) {
      _spAllPlans[_spActivePlanId].mastery = { ..._spMastery };
      localStorage.setItem('sp_all_plans', JSON.stringify(_spAllPlans));
    }
  } catch (_) {}
}

export function spMasteryUpdateNode(idx, masteryPct) {
  const node = document.querySelector(`.sp-node[data-concept-id="${idx + 1}"]`);
  if (!node) return;
  const bar    = node.querySelector('.sp-mastery-bar-fill');
  const pctEl  = node.querySelector('.sp-mastery-pct');
  const bullet = node.querySelector('.sp-node-bullet');
  const badge  = node.querySelector('.sp-node-status-badge');
  const card   = node.querySelector('.sp-node-card');
  if (!bar) return;

  let status, barColor;
  if (masteryPct >= 80) { status = 'mastered'; barColor = 'var(--green)'; }
  else if (masteryPct > 0) { status = 'in-progress'; barColor = 'var(--gold)'; }
  else { status = 'ready'; barColor = 'var(--violet)'; }

  bar.style.width      = masteryPct + '%';
  bar.style.background = barColor;
  bar.style.boxShadow  = `0 0 8px ${barColor}`;
  setTimeout(() => { bar.style.boxShadow = ''; }, 800);

  if (pctEl) { pctEl.textContent = masteryPct > 0 ? masteryPct + '%' : '—'; pctEl.style.color = masteryPct > 0 ? barColor : ''; }

  if (bullet) {
    bullet.className = 'sp-node-bullet ' + status;
    bullet.innerHTML = status === 'mastered'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<span style="font-size:13px;">${idx + 1}</span>`;
  }

  if (badge) {
    const labels = { mastered: 'Mastered', 'in-progress': 'In Progress', ready: 'Ready' };
    badge.className   = 'sp-node-status-badge ' + status;
    badge.textContent = labels[status];
  }

  if (card) card.classList.toggle('active-card', status === 'ready' || status === 'in-progress');
  if (status === 'mastered') spMasteryMarkChipsDone(node);
}

export function spMasteryMarkChipsDone(node) {
  node.querySelectorAll('.sp-activity-chip.available').forEach(chip => {
    chip.className = 'sp-activity-chip done';
    chip.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> ${chip.textContent.trim()}`;
  });
}

export function spMasteryUnlockNext(idx) {
  if (!_spCurrentPlan) return;
  const nextIdx  = idx + 1;
  if (nextIdx >= _spCurrentPlan.concepts.length) return;
  const nextNode = document.querySelector(`.sp-node[data-concept-id="${nextIdx + 1}"]`);
  if (!nextNode) return;
  const bullet = nextNode.querySelector('.sp-node-bullet');
  if (!bullet || !bullet.classList.contains('locked')) return;

  bullet.className = 'sp-node-bullet ready';
  bullet.innerHTML = `<span style="font-size:13px;">${nextIdx + 1}</span>`;

  const badge = nextNode.querySelector('.sp-node-status-badge');
  if (badge) { badge.className = 'sp-node-status-badge ready'; badge.textContent = 'Ready'; }
  const card = nextNode.querySelector('.sp-node-card');
  if (card) card.classList.add('active-card');
  const bar = nextNode.querySelector('.sp-mastery-bar-fill');
  if (bar) bar.style.background = 'var(--violet)';

  const actIcons = {
    'AI Explain':    `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>`,
    'Flashcards':    `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>`,
    "Practice Q's":  `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    'Mini Exam':     `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    'Visual Tutor':  `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="2"/><path d="M8 21h8m-4-4v4"/></svg>`,
  };
  nextNode.querySelectorAll('.sp-activity-chip.locked-chip').forEach(chip => {
    const txt = chip.textContent.trim();
    chip.className = 'sp-activity-chip available';
    chip.innerHTML = (actIcons[txt] || '') + ' ' + txt;
  });

  const concept = _spCurrentPlan.concepts[nextIdx];
  if (typeof wsShowToast === 'function') wsShowToast('🔓', `"${concept?.title}" unlocked!`, 'var(--gold-border)');
}

// ── Tab / depth / notes UI ─────────────────────────────────────────────────

export function spSwitchTab(tab) {
  _spActiveTab = tab;
  ['upload','topic','notes'].forEach(t => {
    const tabEl = document.getElementById('sp-tab-'+t);
    const srcEl = document.getElementById('sp-src-'+t);
    if (tabEl) tabEl.classList.toggle('active', t === tab);
    if (srcEl) srcEl.style.display = t === tab ? '' : 'none';
  });
  spHideValidationError();
}

export function spSetDepth(d) {
  _spActiveDepth = d;
  ['intro','mid','adv','exam'].forEach(v => {
    const btn = document.getElementById('sp-depth-'+v);
    if (btn) btn.classList.toggle('active-chip', v === d);
  });
}

export function spUpdateNotesCount() {
  const len = (document.getElementById('sp-notes-input').value || '').length;
  document.getElementById('sp-notes-count').textContent = len.toLocaleString() + ' chars';
}

export function spShowValidationError(msg) {
  const el = document.getElementById('sp-validation-error');
  document.getElementById('sp-validation-msg').textContent = msg;
  el.style.display = 'flex';
  el.classList.remove('sp-shake');
  void el.offsetWidth;
  el.classList.add('sp-shake');
}

export function spHideValidationError() {
  document.getElementById('sp-validation-error').style.display = 'none';
}

export function spValidateInputs() {
  if (_spActiveTab === 'upload') {
    if (!_spPdfText) { spShowValidationError('Please upload a PDF file first.'); return false; }
  } else if (_spActiveTab === 'topic') {
    const val = (document.getElementById('sp-topic-input').value || '').trim();
    if (!val) { spShowValidationError('Please enter a topic or subject.'); document.getElementById('sp-topic-input').focus(); return false; }
  } else if (_spActiveTab === 'notes') {
    const val = (document.getElementById('sp-notes-input').value || '').trim();
    if (val.length < 50) { spShowValidationError('Please paste at least 50 characters of notes.'); document.getElementById('sp-notes-input').focus(); return false; }
  }
  spHideValidationError();
  return true;
}

// ── PDF upload + extraction ────────────────────────────────────────────────

export function spDragOver(e) {
  e.preventDefault();
  document.getElementById('sp-upload-idle').style.borderColor = 'var(--gold)';
  document.getElementById('sp-upload-idle').style.background  = 'var(--gold-muted)';
}
export function spDragLeave(_e) {
  document.getElementById('sp-upload-idle').style.borderColor = '';
  document.getElementById('sp-upload-idle').style.background  = '';
}
export function spDrop(e) {
  e.preventDefault();
  spDragLeave(e);
  const file = e.dataTransfer.files[0];
  if (file) spHandleFileSelect(file);
}

export function spClearUpload() {
  _spPdfText = ''; _spPdfFileName = ''; _spPdfPageCount = 0;
  document.getElementById('sp-file-input').value = '';
  document.getElementById('sp-upload-idle').style.display     = '';
  document.getElementById('sp-upload-attached').style.display = 'none';
  document.getElementById('sp-extract-status').style.display  = 'none';
  document.getElementById('sp-extract-done').style.display    = 'none';
  spHideValidationError();
}

export async function spHandleFileSelect(file) {
  if (!file) return;
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) { spShowValidationError('Only PDF files are supported right now.'); return; }
  if (file.size > 30 * 1024 * 1024) { spShowValidationError('File is too large. Please use a PDF under 30 MB.'); return; }

  _spPdfFileName = file.name;
  _spPdfText     = '';

  document.getElementById('sp-upload-idle').style.display     = 'none';
  document.getElementById('sp-upload-attached').style.display = '';
  document.getElementById('sp-file-name').textContent         = file.name;
  document.getElementById('sp-file-pages').textContent        = '';
  document.getElementById('sp-extract-done').style.display    = 'none';
  document.getElementById('sp-extract-status').style.display  = 'flex';
  document.getElementById('sp-extract-msg').textContent       = 'Reading PDF…';
  spHideValidationError();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const _pdfjs = await (typeof _loadPdfJs === 'function' ? _loadPdfJs() : Promise.reject(new Error('PDF.js not loaded')));
    const pdf = await _pdfjs.getDocument({ data: arrayBuffer }).promise;
    _spPdfPageCount = pdf.numPages;
    document.getElementById('sp-file-pages').textContent = `${_spPdfPageCount} pages`;
    document.getElementById('sp-extract-msg').textContent = `Extracting text (0 / ${_spPdfPageCount} pages)…`;

    const pageTexts = [];
    for (let i = 1; i <= _spPdfPageCount; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map(item => item.str).join(' '));
      document.getElementById('sp-extract-msg').textContent = `Extracting text (${i} / ${_spPdfPageCount} pages)…`;
    }

    _spPdfText = pageTexts.join('\n\n').replace(/\s{3,}/g, ' ').trim();
    if (_spPdfText.length > 40000) _spPdfText = _spPdfText.slice(0, 40000) + '…';

    document.getElementById('sp-extract-status').style.display = 'none';
    document.getElementById('sp-extract-done').style.display   = 'flex';
    document.getElementById('sp-extract-chars').textContent    = _spPdfText.length.toLocaleString();
  } catch (err) {
    console.error('PDF extraction error:', err);
    document.getElementById('sp-extract-status').style.display = 'none';
    spShowValidationError('Could not read this PDF: ' + (err?.message || String(err)) + '. Try a different file.');
    spClearUpload();
  }
}

// ── Generation overlay ─────────────────────────────────────────────────────

export function spShowOverlay() {
  document.getElementById('sp-generating-overlay').style.display = 'flex';
  for (let i = 1; i <= 5; i++) document.getElementById('gen-step-'+i).className = 'sp-gen-step';
  const delays = [200, 900, 2200, 3800, 5400];
  delays.forEach((delay, idx) => {
    setTimeout(() => {
      if (idx > 0) { const prev = document.getElementById('gen-step-'+idx); prev.className = 'sp-gen-step done'; prev.querySelector('.sp-gen-step-dot').innerHTML = ''; }
      document.getElementById('gen-step-'+(idx+1)).className = 'sp-gen-step active';
    }, delay);
  });
}

export function spHideOverlay() {
  for (let i = 1; i <= 5; i++) document.getElementById('gen-step-'+i).className = 'sp-gen-step done';
  setTimeout(() => { document.getElementById('sp-generating-overlay').style.display = 'none'; }, 400);
}

// ── Plan generation ────────────────────────────────────────────────────────

export // ── Settings helpers (study mode, language, safe content) ───────────────────
function _aiParams(base) {
  const m = (typeof window._getStudyMode === 'function' ? window._getStudyMode() : null)
            || localStorage.getItem('chunks_study_mode') || 'balanced';
  const complexity = m === 'concise' ? Math.max(2, base - 2)
                   : m === 'detailed' ? Math.min(9, base + 2)
                   : base;
  const language    = localStorage.getItem('chunks_setting_language') || 'Auto-detect';
  const safeContent = localStorage.getItem('chunks_setting_safe-content') === '1';
  return { complexity, language, safe_content: safeContent };
}

async function spHandleGenerate() {
  if (!spValidateInputs()) return;

  let sourceContent = '', sourceName = '', sourceType = _spActiveTab;
  if (_spActiveTab === 'upload') {
    sourceContent = _spPdfText;
    sourceName    = _spPdfFileName.replace(/\.pdf$/i, '');
  } else if (_spActiveTab === 'topic') {
    const topic = document.getElementById('sp-topic-input').value.trim();
    const depthLabels = { intro:'Introductory', mid:'Intermediate', adv:'Advanced', exam:'Exam Prep' };
    sourceContent = `Topic: ${topic}\nDepth level: ${depthLabels[_spActiveDepth]}`;
    sourceName    = topic;
  } else {
    sourceContent = document.getElementById('sp-notes-input').value.trim();
    sourceName    = 'Study Notes';
  }

  spShowOverlay();
  const btn = document.getElementById('sp-generate-btn');
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
    _authHeaders = { ..._authHeaders, ...await window._getAuthHeader?.() ?? {} };
  } catch (_) {}

  let _spAttempt = 0;
  const _spMaxAttempts = 3;

  const _spTryGenerate = async () => {
    const response = await fetch(API_BASE + '/ask', {
      method: 'POST', headers: _authHeaders,
      body: JSON.stringify({ question: fullPrompt, mode: 'generate', task_type: 'study_plan', ...(() => { const p = _aiParams(7); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }),
    });
    if (response.status === 429) throw Object.assign(new Error('Server is busy — please wait a moment and try again.'), { noRetry: true });
    if (!response.ok) {
      let errMsg = 'Server error ' + response.status;
      try { const e = await response.json(); errMsg = e.error || errMsg; } catch (_) {}
      // 502 = model returned bad JSON (not transient — retrying won't help)
      // 503 = upstream model unavailable (transient — worth retrying)
      // 500 = unhandled server exception (retry may help)
      // 4xx = client error (don't retry)
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
    _spCurrentPlan = plan;
    _spMastery = {};
    _spActivePlanId = _spGenPlanId(); // new ID for new plan
    if (typeof window.setActivePlan === 'function') window.setActivePlan(_spActivePlanId);
    spHideOverlay();
    spRenderPlanPatched(plan, sourceName);
    spSavePlanToSidebarAndLibrary(plan.topic);
    // Show My Plans button
    const switchBtn = document.getElementById('btn-switch-plan');
    if (switchBtn) switchBtn.style.display = '';
  };

  const _spRetry = async () => {
    try { await _spTryGenerate(); } catch (err) {
      if (!err.noRetry && _spAttempt < _spMaxAttempts) {
        _spAttempt++;
        // Exponential backoff with jitter: 1.5s, 3s, 4.5s (±300ms jitter)
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

// ── Render plan ────────────────────────────────────────────────────────────

export function spRenderPlan(plan, sourceName) {
  const n = plan.concepts.length;
  document.querySelector('.sp-plan-header-eyebrow').textContent = `Study Plan · ${plan.subject || sourceName}`;
  document.querySelector('.sp-plan-header-title').textContent   = plan.topic;
  document.querySelector('.sp-plan-header-sub').textContent     = `${n} core concepts · ~${plan.estimatedHours} hrs to mastery`;

  const pathEl = document.querySelector('.sp-path');
  pathEl.innerHTML = '';
  plan.concepts.forEach((concept, idx) => {
    pathEl.appendChild(spBuildNode(concept, idx + 1, idx === 0 ? 'ready' : 'locked', n));
  });

  spUpdateStats(plan.concepts, []);
  spUpdatePanel();
  spUpdateDetailPanel(plan.concepts, []);
  spShowPlan();
  setTimeout(animateBars, 150);
}

export function spBuildNode(concept, num, status, total) {
  const isLast = num === total;
  const wrapper = document.createElement('div');
  wrapper.className        = 'sp-node';
  wrapper.dataset.conceptId = num;

  const bulletIcon = {
    mastered:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    'in-progress': `<span style="font-size:13px;">${num}</span>`,
    ready:         `<span style="font-size:13px;">${num}</span>`,
    locked:        `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  }[status];

  const statusLabel   = { mastered:'Mastered', 'in-progress':'In Progress', ready:'Ready', locked:'Locked' }[status];
  const _savedMastery = spMasteryScore(num - 1);
  const mastery       = status === 'mastered' ? Math.max(100, _savedMastery) : (status === 'locked' ? 0 : _savedMastery);
  const barColor      = mastery >= 80 ? 'var(--green)' : mastery > 0 ? 'var(--gold)' : (status === 'ready' ? 'var(--violet)' : 'var(--text-4)');
  const effectiveStatus = mastery >= 80 ? 'mastered' : (mastery > 0 ? 'in-progress' : status);

  const actIcons = {
    'AI Explain':    `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>`,
    'Flashcards':    `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>`,
    "Practice Q's":  `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    'Mini Exam':     `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    'Visual Tutor':  `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="2"/><path d="M8 21h8m-4-4v4"/></svg>`,
  };
  const lockIcon  = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  const checkIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const activitiesHTML = ['AI Explain', 'Flashcards', "Practice Q's", 'Mini Exam', 'Visual Tutor'].map(act => {
    const isAvailable = status === 'ready', isDone = status === 'mastered';
    const chipClass   = isDone ? 'done' : isAvailable ? 'available' : 'locked-chip';
    const icon        = isDone ? checkIcon : isAvailable ? (actIcons[act] || '') : lockIcon;
    return `<span class="sp-activity-chip ${chipClass}">${icon} ${act}</span>`;
  }).join('');

  const descText    = isLast ? `A timed, graded exam across all ${total - 1} concepts. Unlocks when all prior concepts reach 80%+ mastery.` : concept.description;
  const keyTermsHTML = (!isLast && concept.keyTerms && status !== 'locked')
    ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">${concept.keyTerms.map(t => `<span style="font-size:10px;font-family:var(--font-mono);padding:2px 7px;border-radius:var(--r-pill);background:var(--surface-3);color:var(--text-3);border:1px solid var(--border-xs);">${t}</span>`).join('')}</div>` : '';
  const lockedNote  = (isLast && status === 'locked')
    ? `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-4);margin-top:10px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Unlock by completing all previous concepts</div>` : '';

  wrapper.innerHTML = `
    <div class="sp-node-bullet ${effectiveStatus}">${effectiveStatus === 'mastered' ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>` : bulletIcon}</div>
    <div class="sp-node-card ${(effectiveStatus === 'ready' || effectiveStatus === 'in-progress') ? 'active-card' : ''}">
      <div class="sp-node-card-top">
        <div class="sp-node-card-title">${num}. ${concept.title}</div>
        <div style="display:flex;align-items:center;gap:5px;">
          ${spConfidenceBadge(num - 1)}
          <span class="sp-node-status-badge ${effectiveStatus}">${statusLabel}</span>
        </div>
      </div>
      <div class="sp-node-card-desc">${descText}</div>
      ${keyTermsHTML}
      <div class="sp-mastery-bar-wrap">
        <div class="sp-mastery-bar-track"><div class="sp-mastery-bar-fill" style="width:${mastery}%;background:${barColor};"></div></div>
        <div class="sp-mastery-pct" style="${mastery > 0 ? 'color:'+barColor : ''}">${mastery > 0 ? mastery+'%' : (status === 'locked' ? '—' : '0%')}</div>
      </div>
      ${isLast ? lockedNote : `<div class="sp-activities" style="margin-top:10px;">${activitiesHTML}</div>`}
      ${concept.estimatedMinutes ? `<div style="margin-top:8px;font-size:10px;color:var(--text-4);font-family:var(--font-mono);">~${concept.estimatedMinutes} min</div>` : ''}
    </div>`;
  return wrapper;
}

export function spUpdateStats(concepts, masteredIds) {
  const counts = { mastered: 0, 'in-progress': 0, ready: 0, locked: 0 };
  concepts.forEach((c, i) => {
    if (masteredIds.includes(i)) counts.mastered++;
    else if (i === 0) counts.ready++;
    else counts.locked++;
  });
  const row = document.querySelector('.sp-stats-row');
  if (!row) return;
  row.innerHTML = Object.entries(counts).map(([status, count]) => {
    if (count === 0) return '';
    const colors = { mastered:'var(--green)', 'in-progress':'var(--gold)', ready:'var(--violet)', locked:'var(--text-4)' };
    const labels = { mastered:'Mastered', 'in-progress':'In Progress', ready:'Ready', locked:'Locked' };
    return `<div class="sp-stat-chip"><div class="sp-stat-dot" style="background:${colors[status]};"></div>${count} ${labels[status]}</div>`;
  }).join('');
}

export function spUpdateDetailPanel(concepts, masteredIds) {
  const n = concepts.length, nMastered = masteredIds.length;
  const pct = Math.round((nMastered / n) * 100);
  document.querySelectorAll('.sp-donut-center-pct').forEach(el => el.textContent = pct + '%');
  const locked = n - nMastered - 1;
  const legendCounts = document.querySelectorAll('.sp-legend-count');
  if (legendCounts.length >= 4) {
    legendCounts[0].textContent = `${nMastered} / ${n}`;
    legendCounts[1].textContent = `0 / ${n}`;
    legendCounts[2].textContent = `1 / ${n}`;
    legendCounts[3].textContent = `${locked} / ${n}`;
  }
  if (concepts.length > 0 && document.querySelector('.sp-upcoming-title'))
    document.querySelector('.sp-upcoming-title').textContent = concepts[0].title;
}

// ── View helpers ───────────────────────────────────────────────────────────

export function spShowEmpty() {
  document.getElementById('sp-empty-state').style.display  = 'flex';
  document.getElementById('sp-active-state').style.display = 'none';
  document.getElementById('toggle-empty')?.classList.add('active-view');
  document.getElementById('toggle-plan')?.classList.remove('active-view');
  const btn = document.getElementById('sp-generate-btn');
  if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  // Deselect any active plan in the sidebar — we're starting a new session
  if (typeof window.setActivePlan === 'function') window.setActivePlan(null);
}

export function spShowPlan() {
  document.getElementById('sp-empty-state').style.display  = 'none';
  document.getElementById('sp-active-state').style.display = 'flex';
  document.getElementById('toggle-plan')?.classList.add('active-view');
  document.getElementById('toggle-empty')?.classList.remove('active-view');
}

export function spSavePlanToSidebar(topic) {
  if (!topic) return;
  let plans = [];
  try { plans = JSON.parse(localStorage.getItem('sp_recent_plans') || '[]'); } catch (_) {}
  plans = plans.filter(p => p !== topic);
  plans.unshift(topic);
  plans = plans.slice(0, 6);
  localStorage.setItem('sp_recent_plans', JSON.stringify(plans));
  spRenderRecentPlansSidebar(plans);
  // Persist the full plan + mastery so it survives a page refresh
  if (_spCurrentPlan) {
    try {
      localStorage.setItem('sp_active_plan', JSON.stringify(_spCurrentPlan));
      localStorage.setItem('sp_active_mastery', JSON.stringify(_spMastery));
    } catch (e) {
      console.warn('Could not persist study plan to localStorage:', e);
    }
  }
}

export function spRenderRecentPlansSidebar(plans) {
  // Delegate to the global sidebar renderer so ALL sidebars update
  if (typeof window._renderRecentPlansAllSidebars === 'function') {
    window._renderRecentPlansAllSidebars();
  }
}

// Restore recent plans on load — always render so section is always visible
(function() {
  try {
    if (typeof window._renderRecentPlansAllSidebars === 'function') {
      window._renderRecentPlansAllSidebars();
    } else {
      // Sidebar.js may not have exposed the global yet — schedule for next tick
      setTimeout(() => { window._renderRecentPlansAllSidebars?.(); }, 200);
    }
  } catch (_) {}
})();

export function animateBars() {
  document.querySelectorAll('.sp-mastery-bar-fill').forEach(bar => {
    const target = bar.style.width;
    bar.style.width = '0%';
    requestAnimationFrame(() => { setTimeout(() => { bar.style.width = target; }, 80); });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('toggle-plan')?.addEventListener('click', () => {
    if (!_spCurrentPlan) return;
    setTimeout(animateBars, 100);
  });
});

// ── AI Explain drawer ──────────────────────────────────────────────────────

export function spOpenExplainDrawer(concept, startTab) {
  const drawer   = document.getElementById('sp-explain-drawer');
  const overlay  = document.getElementById('sp-explain-overlay');
  const titleEl  = document.getElementById('sp-explain-title');
  const bodyEl   = document.getElementById('sp-explain-body');
  const chipWrap = document.getElementById('sp-explain-chips');

  _spDrawerConcept = concept;
  _spFcDeck = []; _spFcIndex = 0; _spFcStats = { easy: 0, ok: 0, hard: 0 };
  _spPqQuestions = []; _spPqIndex = 0; _spPqScore = 0;
  _spExamQuestions = []; _spExamIndex = 0; _spExamAnswers = [];
  clearInterval(_spExamTimerHandle);

  spDrawerTab(startTab || 'explain');
  titleEl.textContent = concept.title;
  bodyEl.innerHTML    = '<div class="sp-explain-spinner"></div>';
  chipWrap.innerHTML  = '';

  if (concept.keyTerms?.length) {
    concept.keyTerms.forEach(t => {
      const c = document.createElement('span');
      c.className = 'sp-explain-term-chip'; c.textContent = t;
      chipWrap.appendChild(c);
    });
  }

  drawer.classList.add('open');
  overlay.classList.add('open');
  _spExplainFocusRelease = typeof trapFocus === 'function' ? trapFocus(drawer) : null;

  if (!startTab || startTab === 'explain') _spStreamExplain(concept, bodyEl);
}

export function spCloseExplainDrawer() {
  document.getElementById('sp-explain-drawer').classList.remove('open');
  document.getElementById('sp-explain-overlay').classList.remove('open');
  if (_explainAbortCtrl) { _explainAbortCtrl.abort(); _explainAbortCtrl = null; }
  if (_spExplainFocusRelease) { _spExplainFocusRelease(); _spExplainFocusRelease = null; }
}

export async function _spStreamExplain(concept, bodyEl) {
  if (_explainAbortCtrl) _explainAbortCtrl.abort();
  _explainAbortCtrl = new AbortController();

  const keyTermsList = concept.keyTerms?.length ? `Key terms to cover: ${concept.keyTerms.join(', ')}.` : '';
  const prompt = `You are an expert study tutor. Give a thorough, engaging deep-dive explanation of the concept: "${concept.title}".

${concept.description ? `Context: ${concept.description}` : ''}
${keyTermsList}

Your explanation should:
- Start with a clear, simple definition (1-2 sentences)
- Explain the core idea with an analogy or intuitive framing
- Break down the mechanism / how it works step-by-step
- Give 1-2 concrete real-world examples
- Highlight common misconceptions or tricky edge cases
- End with a 2-3 sentence summary that reinforces the key takeaway

Use **bold** for key terms. Use ### headings to separate sections. Use bullet lists where appropriate. Do NOT use --- dividers. Keep the tone conversational but precise — like a brilliant tutor talking directly to the student. Aim for about 400-600 words.`;

  try {
    const resp = await fetch(API_BASE + '/ask', {
      method: 'POST', signal: _explainAbortCtrl.signal,
      headers: { 'Content-Type': 'application/json', ...await window._getAuthHeader?.() ?? {} },
      body: JSON.stringify({ question: prompt, mode: 'study', task_type: 'study_plan_explain', ...(() => { const p = _aiParams(7); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }),
    });
    if (!resp.ok) throw new Error('API error ' + resp.status);
    const data = await resp.json();
    if (!data.success) throw new Error(data.error || 'Backend error');
    const fullText = data.answer || data.response || data.text || '';
    bodyEl.innerHTML = typeof _spExplainMarkdown === 'function' ? _spExplainMarkdown(fullText) : fullText;
    spMasteryRecord('explain', 100);
  } catch (err) {
    if (err.name === 'AbortError') return;
    bodyEl.innerHTML = `<div style="color:var(--red);font-size:13px;padding:16px 0;">Failed to load explanation. Please try again.</div>`;
    console.error('AI Explain error:', err);
  }
}

// ── Drawer tab switching ───────────────────────────────────────────────────

export function spDrawerTab(tab) {
  document.querySelectorAll('.sp-drawer-tab').forEach(t => { t.classList.remove('active'); t.classList.remove('sp-drawer-tab-locked'); });
  document.getElementById('sp-tab-' + tab)?.classList.add('active');
  ['explain','flash','pq','exam'].forEach(v => {
    const el = document.getElementById('sp-view-' + v);
    if (el) el.style.display = v === tab ? 'flex' : 'none';
  });
  document.getElementById('sp-explain-chips').style.display = tab === 'explain' ? '' : 'none';

  const tabMeta = {
    explain: { label:'AI Explain',    color:'#e8ac2e', bg:'var(--gold-muted)',        border:'var(--gold-border)',          svg:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e8ac2e" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>` },
    flash:   { label:'Flashcards',    color:'#8b7cf8', bg:'var(--violet-muted)',       border:'var(--violet-border)',        svg:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b7cf8" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>` },
    pq:      { label:"Practice Q's",  color:'#2dd4bf', bg:'var(--teal-muted)',         border:'rgba(45,212,191,0.25)',       svg:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>` },
    exam:    { label:'Mini Exam',     color:'#f87171', bg:'rgba(248,113,113,0.08)',    border:'rgba(248,113,113,0.25)',      svg:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>` },
  };
  const m = tabMeta[tab] || tabMeta.explain;
  const eyebrow = document.getElementById('sp-drawer-eyebrow');
  const icon    = document.getElementById('sp-drawer-icon');
  if (eyebrow) eyebrow.textContent   = m.label;
  if (icon)    { icon.innerHTML = m.svg; icon.style.background = m.bg; icon.style.borderColor = m.border; }

  if (tab === 'flash') {
    if (_spFcDeck.length === 0) spFcGenerate(); else spFcShowDeck();
  } else if (tab === 'pq') {
    if (_spPqQuestions.length === 0) spPqGenerate(); else spPqShowCurrent();
  } else if (tab === 'exam') {
    if (_spExamQuestions.length === 0) spExamGenerate(); else spExamShowCurrent();
  }
}

// ── Mini flashcard engine ──────────────────────────────────────────────────

export async function spFcGenerate() {
  document.getElementById('sp-fc-loading').innerHTML = '<div class="sp-explain-spinner"></div><div style="font-size:12px;">Generating flashcards…</div>';
  document.getElementById('sp-fc-loading').style.display   = 'flex';
  document.getElementById('sp-fc-deck').style.display      = 'none';
  document.getElementById('sp-fc-complete').style.display  = 'none';
  try {
    const concept = _spDrawerConcept;
    const res = await fetch(API_BASE + '/generate-flashcards', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...await window._getAuthHeader?.() ?? {} },
      body: JSON.stringify({ topic: concept.title + (concept.description ? ': ' + concept.description : ''), bookId: null, count: 8 }),
    });
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();
    if (!data.success || !data.flashcards?.length) throw new Error(data.error || 'No cards');
    _spFcDeck = data.flashcards; _spFcIndex = 0; _spFcStats = { easy: 0, ok: 0, hard: 0 }; _spFcFlipped = false;
    spFcShowDeck();
  } catch (err) {
    document.getElementById('sp-fc-loading').innerHTML = `<div style="color:var(--red);font-size:12px;text-align:center;padding:20px;">Failed to generate cards.<br><button onclick="spFcGenerate()" style="margin-top:10px;padding:6px 14px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:11px;cursor:pointer;font-family:var(--font-body);">Try again</button></div>`;
    console.error('FC generate error:', err);
  }
}

export function spFcShowDeck() {
  document.getElementById('sp-fc-loading').style.display  = 'none';
  document.getElementById('sp-fc-complete').style.display = 'none';
  document.getElementById('sp-fc-deck').style.display     = 'flex';
  spFcRenderCard();
}

export function spFcRenderCard() {
  const card = _spFcDeck[_spFcIndex];
  if (!card) return;
  _spFcFlipped = false;
  document.getElementById('sp-fc-card').classList.remove('flipped');
  document.getElementById('sp-fc-ratings').style.display = 'none';
  document.getElementById('sp-fc-front-text').textContent = card.front || card.question || card.term || '';
  document.getElementById('sp-fc-back-text').textContent  = card.back  || card.answer   || card.definition || '';
  const pct = (_spFcIndex / _spFcDeck.length) * 100;
  document.getElementById('sp-fc-progress-bar').style.width = pct + '%';
  document.getElementById('sp-fc-counter').textContent = (_spFcIndex + 1) + ' / ' + _spFcDeck.length;
}

export function spFcFlip() {
  if (_spFcFlipped) return;
  _spFcFlipped = true;
  document.getElementById('sp-fc-card').classList.add('flipped');
  document.getElementById('sp-fc-ratings').style.display = 'flex';
}

export function spFcRate(rating) {
  _spFcStats[rating] = (_spFcStats[rating] || 0) + 1;
  _spFcIndex++;
  if (_spFcIndex >= _spFcDeck.length) spFcShowComplete(); else spFcRenderCard();
}

export function spFcShowComplete() {
  document.getElementById('sp-fc-deck').style.display     = 'none';
  document.getElementById('sp-fc-complete').style.display = 'flex';
  const total = _spFcDeck.length;
  document.getElementById('sp-fc-result-text').innerHTML =
    `You reviewed all <strong style="color:var(--text-1);">${total}</strong> cards.<br>` +
    `<span style="color:var(--green);">Easy: ${_spFcStats.easy}</span> &nbsp;·&nbsp; ` +
    `<span style="color:var(--gold);">OK: ${_spFcStats.ok}</span> &nbsp;·&nbsp; ` +
    `<span style="color:var(--red);">Hard: ${_spFcStats.hard}</span>`;
  const fcScore = total > 0 ? Math.round(((_spFcStats.easy * 100) + (_spFcStats.ok * 70) + (_spFcStats.hard * 40)) / total) : 0;
  spMasteryRecord('flash', fcScore);
}

export function spFcRestart() {
  _spFcIndex = 0; _spFcStats = { easy: 0, ok: 0, hard: 0 }; _spFcFlipped = false;
  spFcShowDeck();
}

// ── Live panel ─────────────────────────────────────────────────────────────

export function spUpdatePanel() {
  if (!_spCurrentPlan) return;
  const concepts = _spCurrentPlan.concepts;
  const total    = concepts.length;
  const CIRC     = 301.6;
  let nMastered = 0, nInProg = 0, nReady = 0, nLocked = 0, totalMastery = 0;
  concepts.forEach((c, i) => {
    const score = spMasteryScore(i);
    totalMastery += score;
    if (score >= 80) nMastered++;
    else if (score > 0) nInProg++;
    else {
      const node   = document.querySelector(`.sp-node[data-concept-id="${i + 1}"]`);
      const bullet = node?.querySelector('.sp-node-bullet');
      if (bullet?.classList.contains('locked')) nLocked++; else nReady++;
    }
  });
  const avgMastery = total > 0 ? Math.round(totalMastery / total) : 0;

  const ringArc = document.getElementById('sp-ring-arc');
  const ringPct = document.getElementById('sp-ring-pct');
  const RING_CIRC = 150.8;
  if (ringArc) { ringArc.setAttribute('stroke-dashoffset', RING_CIRC - (avgMastery / 100) * RING_CIRC); ringArc.setAttribute('stroke', avgMastery >= 80 ? 'var(--green)' : avgMastery > 0 ? 'var(--gold)' : 'var(--text-4)'); }
  if (ringPct) ringPct.textContent = avgMastery + '%';

  const statsRow = document.getElementById('sp-stats-row-chips');
  if (statsRow) {
    statsRow.innerHTML = [
      { color:'var(--green)',  label:'Mastered',    n: nMastered },
      { color:'var(--gold)',   label:'In Progress', n: nInProg   },
      { color:'var(--violet)', label:'Ready',       n: nReady    },
      { color:'var(--text-4)', label:'Locked',      n: nLocked   },
    ].filter(c => c.n > 0).map(c => `<div class="sp-stat-chip"><div class="sp-stat-dot" style="background:${c.color};"></div>${c.n} ${c.label}</div>`).join('');
  }

  const masteredArc  = (nMastered / total) * CIRC;
  const inProgArc    = (nInProg   / total) * CIRC;
  const masteredRot  = -90;
  const inProgRot    = masteredRot + (nMastered / total) * 360;
  const dMastered    = document.getElementById('sp-donut-mastered');
  const dInProg      = document.getElementById('sp-donut-inprogress');
  const dPct         = document.getElementById('sp-donut-pct');
  if (dMastered) { dMastered.setAttribute('stroke-dashoffset', CIRC - masteredArc); dMastered.setAttribute('transform', `rotate(${masteredRot} 60 60)`); }
  if (dInProg)   { dInProg.setAttribute('stroke-dashoffset', CIRC - inProgArc);   dInProg.setAttribute('transform', `rotate(${inProgRot} 60 60)`); }
  if (dPct) dPct.textContent = avgMastery + '%';

  const leg = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n + ' / ' + total; };
  leg('sp-leg-mastered', nMastered); leg('sp-leg-inprog', nInProg); leg('sp-leg-ready', nReady); leg('sp-leg-locked', nLocked);

  // Score forecast
  let forecast = 0;
  concepts.forEach((c, i) => {
    const score = spMasteryScore(i);
    const m = spMasteryGet(i);
    const readiness = score >= 80 ? 100 : Math.round(((m.pq || 0) * 0.4) + ((m.exam || 0) * 0.6));
    forecast += readiness;
  });
  forecast = total > 0 ? Math.round(forecast / total) : 0;
  const scoreEl = document.getElementById('sp-readiness-score');
  const barEl   = document.getElementById('sp-readiness-bar');
  const noteEl  = document.getElementById('sp-readiness-note');
  if (scoreEl) { scoreEl.textContent = forecast + '%'; scoreEl.style.color = forecast >= 80 ? 'var(--green)' : forecast >= 60 ? 'var(--gold)' : 'var(--red)'; }
  if (barEl)   { barEl.style.width = forecast + '%'; barEl.style.background = forecast >= 80 ? 'var(--green)' : forecast >= 60 ? 'var(--gold)' : 'var(--red)'; }
  if (noteEl) {
    if (forecast >= 80) { noteEl.textContent = "You're on track for a great exam result. Keep it up!"; }
    else {
      let worstIdx = -1, worstScore = 999;
      concepts.forEach((c, i) => { const s = spMasteryScore(i); if (s < 80 && s < worstScore) { worstScore = s; worstIdx = i; } });
      noteEl.textContent = `Focus on "${worstIdx >= 0 ? concepts[worstIdx].title : 'remaining concepts'}" to push your forecast above 80%.`;
    }
  }

  const upNextEl = document.getElementById('sp-upcoming-list');
  if (upNextEl) {
    const items = spGetUpNextItems(concepts);
    if (items.length === 0) { upNextEl.innerHTML = '<div style="font-size:12px;color:var(--text-4);padding:8px 0;">All concepts mastered! 🎉</div>'; }
    else {
      const iconSvg = { explain:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e8ac2e" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>`, flash:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b7cf8" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>`, pq:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`, exam:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>` };
      const iconBg  = { explain:'background:var(--gold-muted);border:1px solid var(--gold-border)', flash:'background:var(--violet-muted);border:1px solid var(--violet-border)', pq:'background:var(--teal-muted);border:1px solid rgba(45,212,191,0.25)', exam:'background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25)' };
      upNextEl.innerHTML = items.map(item => `
        <div class="sp-upcoming-item" onclick="spOpenExplainDrawer(_spCurrentPlan.concepts[${item.conceptIdx}], '${item.tab}')" style="cursor:pointer;">
          <div class="sp-upcoming-icon" style="${iconBg[item.tab] || ''}">${iconSvg[item.tab] || ''}</div>
          <div class="sp-upcoming-info"><div class="sp-upcoming-title">${item.title}</div><div class="sp-upcoming-sub">${item.sub}</div></div>
          <svg class="sp-upcoming-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>`).join('');
    }
  }

  const timeEl  = document.getElementById('sp-time-remaining');
  const timeSub = document.getElementById('sp-time-sub');
  if (timeEl && _spCurrentPlan) {
    const remainingMins = concepts.reduce((sum, c, i) => sum + (spMasteryScore(i) < 80 ? (c.estimatedMinutes || 30) : 0), 0);
    if (remainingMins === 0) { timeEl.textContent = 'All done! 🎉'; if (timeSub) timeSub.textContent = "You've mastered all concepts."; }
    else {
      const hrs = (remainingMins / 60).toFixed(1);
      timeEl.textContent = `~${hrs} hrs remaining`;
      if (timeSub) timeSub.textContent = remainingMins < 60 ? `About ${remainingMins} minutes of study left.` : `At a steady pace, you'll finish in ${hrs} hours.`;
    }
  }
}

export function spGetUpNextItems(concepts) {
  const items = [], SUBS = { explain: () => 'Start · AI Explanation', flash: () => 'Reinforce with flashcards', pq: () => 'Practice Questions', exam: () => 'Take Mini Exam' };
  for (let i = 0; i < concepts.length && items.length < 3; i++) {
    const score  = spMasteryScore(i);
    if (score >= 80) continue;
    const node   = document.querySelector(`.sp-node[data-concept-id="${i + 1}"]`);
    const bullet = node?.querySelector('.sp-node-bullet');
    if (bullet?.classList.contains('locked') && i > 0) continue;
    const m = spMasteryGet(i);
    for (const act of ['exam','pq','flash','explain']) {
      if ((m[act] || 0) < 80 && items.length < 3) { items.push({ conceptIdx: i, title: concepts[i].title, sub: SUBS[act](concepts[i]), tab: act }); break; }
    }
  }
  return items;
}

// ── Practice Q's ───────────────────────────────────────────────────────────

export async function spPqGenerate() {
  _spPqQuestions = []; _spPqIndex = 0; _spPqScore = 0;
  document.getElementById('sp-pq-loading').innerHTML = '<div class="sp-explain-spinner"></div><div style="font-size:12px;">Generating questions…</div>';
  document.getElementById('sp-pq-loading').style.display        = 'flex';
  document.getElementById('sp-pq-question-view').style.display  = 'none';
  document.getElementById('sp-pq-complete').style.display       = 'none';
  const concept = _spDrawerConcept;
  const prompt  = `Generate exactly 5 short-answer practice questions about: "${concept.title}".\n${concept.description ? 'Context: ' + concept.description : ''}\n${concept.keyTerms?.length ? 'Key terms: ' + concept.keyTerms.join(', ') : ''}\n\nRules:\n- Questions should test understanding, not just recall\n- Each should be answerable in 1-3 sentences\n- Vary difficulty: 2 easy, 2 medium, 1 hard\n- Output ONLY a raw JSON array, no markdown:\n[{"question":"...","ideal_answer":"...","key_points":["point1","point2"]}]`;
  try {
    const res  = await fetch(API_BASE + '/ask', { method: 'POST', headers: { 'Content-Type': 'application/json', ...await window._getAuthHeader?.() ?? {} }, body: JSON.stringify({ question: prompt, mode: 'study', task_type: 'study_plan_practice', ...(() => { const p = _aiParams(6); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }) });
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();
    _spPqQuestions = JSON.parse((data.answer || data.response || data.text || '').trim().replace(/```(?:json)?/g,'').trim());
    spPqShowCurrent();
  } catch (err) {
    document.getElementById('sp-pq-loading').innerHTML = `<div style="color:var(--red);font-size:12px;text-align:center;padding:20px;">Failed to generate questions.<br><button onclick="spPqGenerate()" style="margin-top:10px;padding:6px 14px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:11px;cursor:pointer;font-family:var(--font-body);">Try again</button></div>`;
    console.error('PQ generate error:', err);
  }
}

export function spPqShowCurrent() {
  document.getElementById('sp-pq-loading').style.display       = 'none';
  document.getElementById('sp-pq-complete').style.display      = 'none';
  document.getElementById('sp-pq-question-view').style.display = 'flex';
  const q = _spPqQuestions[_spPqIndex];
  if (!q) return;
  document.getElementById('sp-pq-progress-bar').style.width  = (_spPqIndex / _spPqQuestions.length * 100) + '%';
  document.getElementById('sp-pq-counter').textContent       = (_spPqIndex + 1) + ' / ' + _spPqQuestions.length;
  document.getElementById('sp-pq-question-text').textContent = q.question;
  document.getElementById('sp-pq-answer-input').value        = '';
  document.getElementById('sp-pq-input-wrap').style.display  = 'flex';
  document.getElementById('sp-pq-result').style.display      = 'none';
  document.getElementById('sp-pq-answer-input').disabled     = false;
  document.getElementById('sp-pq-submit-btn').disabled       = false;
  document.getElementById('sp-pq-submit-btn').textContent    = 'Submit Answer';
  document.getElementById('sp-pq-answer-input').focus();
}

export async function spPqSubmit() {
  if (_spPqGrading) return;
  const answer = document.getElementById('sp-pq-answer-input').value.trim();
  if (!answer) return;
  _spPqGrading = true;
  const btn = document.getElementById('sp-pq-submit-btn');
  btn.textContent = 'Grading…'; btn.disabled = true;
  document.getElementById('sp-pq-answer-input').disabled = true;
  const q = _spPqQuestions[_spPqIndex];
  const prompt = `You are a tutor grading a student's short-answer response. Your job is to distinguish genuine understanding from guessing or pattern-matching.\n\nQuestion: ${q.question}\nIdeal answer covers: ${q.ideal_answer}\nKey points to check: ${(q.key_points || []).join('; ')}\n\nStudent's answer: "${answer}"\n\nEvaluate on these dimensions:\n1. Correctness — are the facts right?\n2. Understanding depth — does the student explain WHY, not just WHAT?\n3. Confidence signal — is the answer specific and assured, or vague/hedged?\n\nRespond ONLY as raw JSON (no markdown):\n{"correct": true/false, "score": 0-100, "understanding": "surface|partial|deep", "feedback": "1-2 sentences on what was right/wrong and the correct answer", "hint": "one specific thing they should review if understanding is surface or partial"}`;
  try {
    const res    = await fetch(API_BASE + '/ask', { method: 'POST', headers: { 'Content-Type': 'application/json', ...await window._getAuthHeader?.() ?? {} }, body: JSON.stringify({ question: prompt, mode: 'study', task_type: 'study_plan_grade', ...(() => { const p = _aiParams(5); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }) });
    const data   = await res.json();
    const result = JSON.parse((data.answer || data.response || data.text || '').trim().replace(/```(?:json)?/g,'').trim());
    // Depth-adjusted scoring: surface understanding penalised even if factually correct
    const depthMult = result.understanding === 'deep' ? 1.0 : result.understanding === 'partial' ? 0.75 : 0.5;
    const adjustedScore = Math.round((result.score || 0) * depthMult);
    if (adjustedScore >= 60) _spPqScore++;
    const verdictEl = document.getElementById('sp-pq-verdict');
    const passed    = adjustedScore >= 60;
    const depthLabel = { deep: '🧠 Deep', partial: '📖 Partial', surface: '🔍 Surface' }[result.understanding || 'partial'];
    verdictEl.style.background = passed ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)';
    verdictEl.style.borderLeft = `3px solid ${passed ? 'var(--green)' : 'var(--red)'}`;
    verdictEl.style.color      = passed ? 'var(--green)' : 'var(--red)';
    verdictEl.innerHTML = (passed ? '✓ Correct' : '✗ Incorrect') +
      `<span style="margin-left:8px;font-size:10px;padding:2px 7px;border-radius:var(--r-pill);background:var(--surface-3);color:var(--text-3);">${depthLabel}</span>` +
      `<span style="margin-left:auto;font-size:11px;font-family:var(--font-mono);opacity:0.8;">${adjustedScore}%</span>`;
    const feedbackEl = document.getElementById('sp-pq-explanation');
    feedbackEl.innerHTML = `<div style="margin-bottom:6px;">${result.feedback || ''}</div>` +
      (result.hint && result.understanding !== 'deep' ? `<div style="margin-top:6px;padding:7px 10px;background:rgba(232,172,46,0.08);border:1px solid rgba(232,172,46,0.2);border-radius:var(--r-sm);font-size:11px;color:var(--gold);"><strong>Review tip:</strong> ${result.hint}</div>` : '');
    document.getElementById('sp-pq-next-btn').textContent = _spPqIndex >= _spPqQuestions.length - 1 ? 'See Results' : 'Next Question →';
    document.getElementById('sp-pq-input-wrap').style.display = 'none';
    document.getElementById('sp-pq-result').style.display     = 'flex';
  } catch (err) {
    document.getElementById('sp-pq-explanation').textContent = 'Grading failed. Please try again.';
    document.getElementById('sp-pq-result').style.display    = 'flex';
    document.getElementById('sp-pq-input-wrap').style.display = 'none';
    console.error('PQ grade error:', err);
  } finally { _spPqGrading = false; }
}

export function spPqNext() {
  _spPqIndex++;
  if (_spPqIndex >= _spPqQuestions.length) spPqShowComplete(); else spPqShowCurrent();
}

export function spPqShowComplete() {
  document.getElementById('sp-pq-question-view').style.display = 'none';
  document.getElementById('sp-pq-complete').style.display      = 'flex';
  const total = _spPqQuestions.length;
  const pct   = Math.round((_spPqScore / total) * 100);
  document.getElementById('sp-pq-complete-emoji').textContent = pct >= 80 ? '🎯' : pct >= 60 ? '📚' : '💪';
  document.getElementById('sp-pq-complete-text').innerHTML =
    `You got <strong style="color:var(--text-1);">${_spPqScore} / ${total}</strong> correct (${pct}%).<br>` +
    (pct >= 80 ? 'Great work! Ready to take the Mini Exam.' : 'Keep practicing to strengthen your understanding.');
  spMasteryRecord('pq', pct);
}

export function spPqRestart() { _spPqIndex = 0; _spPqScore = 0; spPqShowCurrent(); }

// ── Mini Exam ──────────────────────────────────────────────────────────────

export async function spExamGenerate() {
  _spExamQuestions = []; _spExamIndex = 0; _spExamAnswers = []; _spExamStarted = false;
  clearInterval(_spExamTimerHandle);
  document.getElementById('sp-exam-loading').innerHTML = '<div class="sp-explain-spinner" style="border-top-color:var(--red);"></div><div style="font-size:12px;">Generating exam…</div>';
  ['sp-exam-loading','sp-exam-intro','sp-exam-question-view','sp-exam-results'].forEach((id, i) => {
    document.getElementById(id).style.display = i === 0 ? 'flex' : 'none';
  });
  const concept = _spDrawerConcept;
  const prompt  = `Generate exactly 10 multiple-choice exam questions about: "${concept.title}".\n${concept.description ? 'Context: ' + concept.description : ''}\n${concept.keyTerms?.length ? 'Key terms: ' + concept.keyTerms.join(', ') : ''}\n\nRules:\n- 4 options labeled A-D, one correct answer\n- Mix of easy, medium, and hard questions\n- Test understanding and application, not just definitions\n- Output ONLY a raw JSON array, no markdown:\n[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"1 sentence why this is correct"}]`;
  try {
    const res  = await fetch(API_BASE + '/ask', { method: 'POST', headers: { 'Content-Type': 'application/json', ...await window._getAuthHeader?.() ?? {} }, body: JSON.stringify({ question: prompt, mode: 'study', task_type: 'study_plan_exam', ...(() => { const p = _aiParams(7); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }) });
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();
    _spExamQuestions = JSON.parse((data.answer || data.response || data.text || '').trim().replace(/```(?:json)?/g,'').trim());
    document.getElementById('sp-exam-loading').style.display = 'none';
    document.getElementById('sp-exam-intro').style.display   = 'flex';
    _spExamUpdateTimerDisplay(300);
  } catch (err) {
    document.getElementById('sp-exam-loading').innerHTML = `<div style="color:var(--red);font-size:12px;text-align:center;padding:20px;">Failed to generate exam.<br><button onclick="spExamGenerate()" style="margin-top:10px;padding:6px 14px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:11px;cursor:pointer;font-family:var(--font-body);">Try again</button></div>`;
    console.error('Exam generate error:', err);
  }
}

export function spExamStart() {
  _spExamIndex = 0; _spExamAnswers = []; _spExamStarted = true; _spExamTimerSec = 300;
  document.getElementById('sp-exam-intro').style.display         = 'none';
  document.getElementById('sp-exam-question-view').style.display = 'flex';
  clearInterval(_spExamTimerHandle);
  _spExamTimerHandle = setInterval(() => {
    _spExamTimerSec--;
    _spExamUpdateTimerDisplay(_spExamTimerSec);
    if (_spExamTimerSec <= 0) { clearInterval(_spExamTimerHandle); spExamFinish(); }
  }, 1000);
  spExamShowCurrent();
}

export function _spExamUpdateTimerDisplay(sec) {
  const str = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  ['sp-exam-timer','sp-exam-timer-display'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = str; el.style.color = sec <= 60 ? 'var(--red)' : sec <= 120 ? 'var(--gold)' : 'var(--red)'; }
  });
}

export function spExamShowCurrent() {
  const q = _spExamQuestions[_spExamIndex];
  if (!q) return;
  document.getElementById('sp-exam-progress-bar').style.width = (_spExamIndex / _spExamQuestions.length * 100) + '%';
  document.getElementById('sp-exam-counter').textContent = (_spExamIndex + 1) + '/' + _spExamQuestions.length;
  document.getElementById('sp-exam-q-text').textContent  = q.q;
  const opts = document.getElementById('sp-exam-options');
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
  document.querySelectorAll('.sp-exam-opt-btn').forEach(b => b.disabled = true);
  const q = _spExamQuestions[_spExamIndex];
  _spExamAnswers.push({ chosen: letter, correct: q.answer });
  const correct = letter === q.answer;
  btnEl.style.background  = correct ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)';
  btnEl.style.borderColor = correct ? 'var(--green)' : 'var(--red)';
  btnEl.style.color       = correct ? 'var(--green)' : 'var(--red)';
  if (!correct) {
    document.querySelectorAll('.sp-exam-opt-btn').forEach(b => {
      if (b.textContent.charAt(0) === q.answer) { b.style.background = 'rgba(52,211,153,0.1)'; b.style.borderColor = 'var(--green)'; b.style.color = 'var(--green)'; }
    });
  }
  const expEl = document.createElement('div');
  expEl.style.cssText = 'font-size:11px;color:var(--text-3);padding:8px 12px;background:var(--surface-2);border-radius:var(--r-sm);border:1px solid var(--border-xs);margin-top:4px;line-height:1.5;flex-shrink:0;';
  expEl.textContent = q.explanation || '';
  document.getElementById('sp-exam-options').appendChild(expEl);
  setTimeout(() => { _spExamIndex++; if (_spExamIndex >= _spExamQuestions.length) spExamFinish(); else spExamShowCurrent(); }, 1800);
}

export function spExamFinish() {
  clearInterval(_spExamTimerHandle);
  document.getElementById('sp-exam-question-view').style.display = 'none';
  document.getElementById('sp-exam-results').style.display       = 'flex';
  const total   = _spExamQuestions.length;
  const correct = _spExamAnswers.filter(a => a.chosen === a.correct).length;
  const pct     = Math.round((correct / total) * 100);
  const passed  = pct >= 70;
  document.getElementById('sp-exam-result-emoji').textContent = passed ? '🏆' : '📖';
  document.getElementById('sp-exam-result-title').textContent = passed ? 'Exam Passed!' : 'Not Quite Yet';
  document.getElementById('sp-exam-result-score').textContent = pct + '%';
  document.getElementById('sp-exam-result-score').style.color = passed ? 'var(--green)' : 'var(--red)';
  document.getElementById('sp-exam-result-sub').textContent   = passed
    ? `You got ${correct}/${total} correct. The next concept is now unlocked!`
    : `You got ${correct}/${total} correct. You need 70% to pass. Review the concept and try again.`;
  spMasteryRecord('exam', pct);
  // SRS: schedule next review based on exam performance
  if (_spDrawerConcept && _spCurrentPlan) {
    const idx = _spCurrentPlan.concepts.indexOf(_spDrawerConcept);
    if (idx >= 0) spSrsUpdate(idx, pct);
  }
}

export function spExamRestart() { spExamGenerate(); }

// ── Activity chip delegation ───────────────────────────────────────────────

document.addEventListener('click', e => {
  const chip = e.target.closest('.sp-activity-chip:not(.locked-chip):not(.done)');
  if (!chip) return;
  const node = chip.closest('.sp-node');
  if (!node) return;
  const conceptId = parseInt(node.dataset.conceptId, 10);
  if (!conceptId || !_spCurrentPlan) return;
  const concept  = _spCurrentPlan.concepts[conceptId - 1];
  if (!concept) return;
  const chipText = chip.textContent.trim();
  const tabMap   = { 'AI Explain': undefined, 'Flashcards': 'flash', "Practice Q's": 'pq', 'Mini Exam': 'exam' };
  if (chipText in tabMap) { spOpenExplainDrawer(concept, tabMap[chipText]); return; }
  if (chipText === 'Visual Tutor') { spOpenExplainDrawer(concept); setTimeout(() => spOpenVisualTutor(), 100); }
});

// ── spInitScreen (called by showScreen) ───────────────────────────────────

export function spInitScreen() {
  // Restore the last active plan + mastery from localStorage on page load / screen switch.
  if (_spCurrentPlan) {
    // Plan is already in memory — ensure the plan view is visible (not the empty state).
    // spShowEmpty() may have been called (e.g. "New Plan" button) before navigating away;
    // calling spShowPlan() here guarantees the plan is shown on return.
    if (typeof spShowPlan === 'function') spShowPlan();
    // Re-highlight sidebar in case we navigated away and back
    if (_spActivePlanId && typeof window.setActivePlan === 'function') {
      window.setActivePlan(_spActivePlanId);
    }
    setTimeout(() => { spUpdateExamDateUI(); spUpdateDailySchedule(); }, 100);
    return;
  }
  // Load multi-plan library
  spLoadAllPlans();
  // Show "My Plans" button if there are saved plans
  const planBtn = document.getElementById('btn-switch-plan');
  if (planBtn) planBtn.style.display = Object.keys(_spAllPlans).length > 0 ? '' : 'none';
  try {
    const savedPlan    = localStorage.getItem('sp_active_plan');
    const savedMastery = localStorage.getItem('sp_active_mastery');
    if (savedPlan) {
      const plan = JSON.parse(savedPlan);
      if (plan && Array.isArray(plan.concepts) && plan.concepts.length > 0) {
        _spCurrentPlan = plan;
        _spMastery     = savedMastery ? (JSON.parse(savedMastery) || {}) : {};
        // Restore exam date for this plan
        const storedDate = localStorage.getItem('sp_exam_date_' + (_spActivePlanId || 'default'));
        if (storedDate) _spExamDate = storedDate;
        spRenderPlanPatched(plan, plan.topic || 'Saved Plan');
        // Re-apply mastery visuals for each node
        plan.concepts.forEach((_, idx) => {
          spMasteryUpdateNode(idx, spMasteryScore(idx));
        });
        // Inject daily schedule container
        const detailCol = document.getElementById('sp-detail-col');
        if (detailCol && !document.getElementById('sp-daily-schedule')) {
          const schedDiv = document.createElement('div');
          schedDiv.id = 'sp-daily-schedule';
          schedDiv.style.display = 'none';
          detailCol.appendChild(schedDiv);
        }
        if (detailCol && !document.getElementById('sp-srs-panel')) {
          const srsDiv = document.createElement('div');
          srsDiv.id = 'sp-srs-panel';
          srsDiv.style.display = 'none';
          detailCol.appendChild(srsDiv);
        }
        if (detailCol && !document.getElementById('sp-ical-btn')) {
          const icalBtn = document.createElement('button');
          icalBtn.id = 'sp-ical-btn';
          icalBtn.onclick = () => spExportIcal();
          icalBtn.style.cssText = 'width:100%;display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-md);color:var(--text-3);font-size:12px;cursor:pointer;font-family:var(--font-body);transition:color var(--t-fast),border-color var(--t-fast);margin-top:8px;';
          icalBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Export to Calendar (.ics)';
          icalBtn.onmouseenter = () => { icalBtn.style.color = 'var(--text-1)'; icalBtn.style.borderColor = 'var(--border-md)'; };
          icalBtn.onmouseleave = () => { icalBtn.style.color = 'var(--text-3)'; icalBtn.style.borderColor = 'var(--border-xs)'; };
          detailCol.appendChild(icalBtn);
        }
        spSrsLoad();
        // Highlight the active plan in all sidebar Recent Plans sections
        if (_spActivePlanId && typeof window.setActivePlan === 'function') {
          window.setActivePlan(_spActivePlanId);
        } else {
          // _spActivePlanId may not be set yet — read from localStorage
          const storedPlanId = localStorage.getItem('sp_active_plan_id');
          if (storedPlanId && typeof window.setActivePlan === 'function') {
            _spActivePlanId = storedPlanId;
            window.setActivePlan(storedPlanId);
          }
        }
        setTimeout(() => { spUpdateExamDateUI(); spUpdateDailySchedule(); spUpdateSrsPanel(); }, 200);
      }
    }
  } catch (e) {
    console.warn('Could not restore study plan from localStorage:', e);
  }
}

// ── FIX 1: Multi-plan management ──────────────────────────────────────────

export function _spGenPlanId() {
  return 'plan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

export function spSaveCurrentPlanToLibrary() {
  if (!_spCurrentPlan) return;
  const id = _spActivePlanId || _spGenPlanId();
  _spActivePlanId = id;
  _spAllPlans[id] = {
    plan: _spCurrentPlan,
    mastery: { ..._spMastery },
    savedAt: Date.now(),
    topic: _spCurrentPlan.topic,
    examDate: _spExamDate || null,
  };
  try {
    localStorage.setItem('sp_all_plans', JSON.stringify(_spAllPlans));
    localStorage.setItem('sp_active_plan_id', id);
    localStorage.setItem('sp_active_plan', JSON.stringify(_spCurrentPlan));
    localStorage.setItem('sp_active_mastery', JSON.stringify(_spMastery));
  } catch (e) { console.warn('Could not save plan library:', e); }
}

export function spLoadAllPlans() {
  try {
    const raw = localStorage.getItem('sp_all_plans');
    if (raw) _spAllPlans = JSON.parse(raw);
    _spActivePlanId = localStorage.getItem('sp_active_plan_id') || null;
    const dateRaw = localStorage.getItem('sp_exam_date_' + _spActivePlanId);
    if (dateRaw) _spExamDate = dateRaw;
  } catch (e) {}
}

export function spShowPlansMenu() {
  spLoadAllPlans();
  const menu = document.getElementById('sp-plans-menu');
  const list = document.getElementById('sp-plans-menu-list');
  if (!menu || !list) return;
  const entries = Object.entries(_spAllPlans).sort((a, b) => b[1].savedAt - a[1].savedAt);
  if (entries.length === 0) {
    list.innerHTML = '<div style="padding:8px 14px;font-size:12px;color:var(--text-4);">No saved plans yet.</div>';
  } else {
    list.innerHTML = entries.map(([id, entry]) => {
      const isActive = id === _spActivePlanId;
      const n = entry.plan?.concepts?.length || 0;
      const mastered = Object.values(entry.mastery || {}).filter((m, i) => {
        const score = Object.values(m || {}).reduce((s, v, idx) => {
          const keys = ['explain','flash','pq','exam'];
          const w = { explain:10, flash:20, pq:35, exam:35 };
          return s + (v / 100) * (w[keys[idx]] || 0);
        }, 0);
        return score >= 80;
      }).length;
      const pct = n > 0 ? Math.round((mastered / n) * 100) : 0;
      return `<button onclick="spSwitchToPlan('${id}');spHidePlansMenu();" style="width:100%;text-align:left;padding:8px 14px;background:${isActive ? 'var(--surface-3)' : 'none'};border:none;color:var(--text-1);font-size:12px;cursor:pointer;display:flex;align-items:center;gap:10px;font-family:var(--font-body);border-left:2px solid ${isActive ? 'var(--gold)' : 'transparent'};" onmouseenter="this.style.background='var(--surface-3)'" onmouseleave="this.style.background='${isActive ? 'var(--surface-3)' : 'none'}'">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${isActive ? 'var(--gold)' : 'var(--text-3)'}" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        <div style="flex:1;overflow:hidden;">
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:${isActive ? '600' : '400'}">${entry.topic || 'Untitled'}</div>
          <div style="font-size:10px;color:var(--text-4);">${n} concepts · ${pct}% mastery</div>
        </div>
        <button onclick="event.stopPropagation();spDeletePlan('${id}');" style="background:none;border:none;cursor:pointer;color:var(--text-4);padding:2px;display:flex;align-items:center;" title="Delete plan">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </button>`;
    }).join('');
  }
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

export function spHidePlansMenu() {
  const menu = document.getElementById('sp-plans-menu');
  if (menu) menu.style.display = 'none';
}

export function spSwitchToPlan(id) {
  spLoadAllPlans();
  const entry = _spAllPlans[id];
  if (!entry || !entry.plan) return;
  _spCurrentPlan = entry.plan;
  // Prefer sp_active_mastery from localStorage when loading the active plan,
  // because spMasteryRecord writes there in real-time but sp_all_plans.mastery
  // may be slightly stale (written on the same tick, but read from disk).
  // For non-active plans, fall back to the entry mastery.
  try {
    const activeId = localStorage.getItem('sp_active_plan_id');
    if (activeId === id) {
      const raw = localStorage.getItem('sp_active_mastery');
      _spMastery = raw ? (JSON.parse(raw) || {}) : (entry.mastery || {});
    } else {
      _spMastery = entry.mastery || {};
    }
  } catch (_) {
    _spMastery = entry.mastery || {};
  }
  _spActivePlanId = id;
  // Highlight the active plan in all sidebars
  if (typeof window.setActivePlan === 'function') window.setActivePlan(id);
  _spExamDate = entry.examDate || null;
  try {
    localStorage.setItem('sp_active_plan_id', id);
    localStorage.setItem('sp_active_plan', JSON.stringify(entry.plan));
    localStorage.setItem('sp_active_mastery', JSON.stringify(_spMastery));
  } catch (e) {}
  spRenderPlan(entry.plan, entry.plan.topic || 'Plan');
  entry.plan.concepts.forEach((_, idx) => spMasteryUpdateNode(idx, spMasteryScore(idx)));
  spSrsLoad();
  spUpdateExamDateUI();
  spUpdateDailySchedule();
  setTimeout(() => spUpdateSrsPanel(), 200);
  if (typeof wsShowToast === 'function') wsShowToast('📚', `Switched to "${entry.topic}"`, 'var(--gold-border)');
}

export function spDeletePlan(id) {
  // Find the topic before deleting so we can remove it from recent plans
  const deletedTopic = _spAllPlans[id]?.topic;

  delete _spAllPlans[id];
  try { localStorage.setItem('sp_all_plans', JSON.stringify(_spAllPlans)); } catch (e) {}

  // Also remove from sp_recent_plans list
  if (deletedTopic) {
    try {
      let recentPlans = JSON.parse(localStorage.getItem('sp_recent_plans') || '[]');
      recentPlans = recentPlans.filter(p => p !== deletedTopic);
      localStorage.setItem('sp_recent_plans', JSON.stringify(recentPlans));
    } catch (e) {}
  }

  if (_spActivePlanId === id) {
    _spActivePlanId = null;
    _spCurrentPlan = null;
    _spMastery = {};
    localStorage.removeItem('sp_active_plan');
    localStorage.removeItem('sp_active_mastery');
    localStorage.removeItem('sp_active_plan_id');
    if (typeof window.setActivePlan === 'function') window.setActivePlan(null);
    spShowEmpty();
  }

  // Re-render all sidebar recent-plans sections in realtime
  if (typeof window._renderRecentPlansAllSidebars === 'function') {
    window._renderRecentPlansAllSidebars();
  }

  spShowPlansMenu(); // re-render in-screen menu
}

// ── FIX 2: Exam date + calendar ────────────────────────────────────────────

export function spShowExamDatePicker() {
  const picker = document.getElementById('sp-exam-date-picker');
  const setBtn = document.getElementById('sp-set-exam-date-btn');
  if (!picker) return;
  picker.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
  if (setBtn) setBtn.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
  const input = document.getElementById('sp-exam-date-input');
  if (input && _spExamDate) input.value = _spExamDate;
}

export function spSetExamDate(val) {
  if (!val) return;
  // Validate the date is complete — year must be 4 digits (type="date" returns YYYY-MM-DD)
  const parts = val.split('-');
  if (parts.length !== 3 || parts[0].length !== 4 || parseInt(parts[0], 10) < 2020) return;
  _spExamDate = val;
  try { localStorage.setItem('sp_exam_date_' + (_spActivePlanId || 'default'), val); } catch (e) {}
  // save into the plan entry
  if (_spActivePlanId && _spAllPlans[_spActivePlanId]) {
    _spAllPlans[_spActivePlanId].examDate = val;
    try { localStorage.setItem('sp_all_plans', JSON.stringify(_spAllPlans)); } catch (e) {}
  }
  spUpdateExamDateUI();
  // Hide picker
  const picker = document.getElementById('sp-exam-date-picker');
  if (picker) picker.style.display = 'none';
  const setBtn = document.getElementById('sp-set-exam-date-btn');
  if (setBtn) setBtn.style.display = 'flex';
  // Regenerate daily schedule in detail panel
  spUpdateDailySchedule();
}

export function spClearExamDate() {
  _spExamDate = null;
  try { localStorage.removeItem('sp_exam_date_' + (_spActivePlanId || 'default')); } catch (e) {}
  if (_spActivePlanId && _spAllPlans[_spActivePlanId]) {
    _spAllPlans[_spActivePlanId].examDate = null;
    try { localStorage.setItem('sp_all_plans', JSON.stringify(_spAllPlans)); } catch (e) {}
  }
  spUpdateExamDateUI();
}

export function spUpdateExamDateUI() {
  const display = document.getElementById('sp-exam-date-display');
  const setBtn  = document.getElementById('sp-set-exam-date-btn');
  const label   = document.getElementById('sp-exam-date-label');
  const daysEl  = document.getElementById('sp-exam-days-left');
  if (!display || !setBtn) return;
  if (_spExamDate) {
    const examMs = new Date(_spExamDate + 'T00:00:00').getTime();
    const nowMs  = new Date().setHours(0,0,0,0);
    const days   = Math.ceil((examMs - nowMs) / 86400000);
    if (label) label.textContent = 'Exam: ' + new Date(_spExamDate + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    if (daysEl) {
      if (days < 0)      daysEl.textContent = '(past)';
      else if (days === 0) daysEl.textContent = '(today!)';
      else if (days === 1) daysEl.textContent = '(tomorrow)';
      else                 daysEl.textContent = `(${days} days)`;
    }
    display.style.display = 'flex';
    setBtn.style.display  = 'none';
  } else {
    display.style.display = 'none';
    setBtn.style.display  = 'flex';
  }
}

export function spUpdateDailySchedule() {
  const el = document.getElementById('sp-daily-schedule');
  if (!el || !_spCurrentPlan || !_spExamDate) {
    if (el) el.style.display = 'none';
    return;
  }
  const concepts = _spCurrentPlan.concepts;
  const examMs   = new Date(_spExamDate + 'T00:00:00').getTime();
  const nowMs    = new Date().setHours(0,0,0,0);
  const daysLeft = Math.ceil((examMs - nowMs) / 86400000);
  if (daysLeft <= 0) { el.style.display = 'none'; return; }

  const remaining = concepts.filter((c, i) => spMasteryScore(i) < 80);
  if (remaining.length === 0) { el.style.display = 'none'; return; }

  const totalMins = remaining.reduce((s, c) => s + (c.estimatedMinutes || 30), 0);
  const minsPerDay = Math.ceil(totalMins / daysLeft);

  el.style.display = 'block';
  el.innerHTML = `
    <div class="sp-detail-section-title" style="margin-top:16px;">Daily Schedule</div>
    <div style="padding:12px 14px;background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-md);">
      <div style="font-size:12px;color:var(--text-2);line-height:1.6;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:var(--text-3);">Days until exam</span>
          <span style="font-weight:600;color:var(--text-1);">${daysLeft}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:var(--text-3);">Concepts remaining</span>
          <span style="font-weight:600;color:var(--text-1);">${remaining.length}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <span style="color:var(--text-3);">Study per day</span>
          <span style="font-weight:600;color:var(--gold);">${minsPerDay >= 60 ? (minsPerDay/60).toFixed(1)+'h' : minsPerDay+'min'}</span>
        </div>
        <div style="border-top:1px solid var(--border-xs);padding-top:8px;display:flex;flex-direction:column;gap:4px;">
          ${remaining.slice(0,4).map((c, i) => `
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;">
              <div style="width:5px;height:5px;border-radius:50%;background:var(--gold);flex-shrink:0;"></div>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-2);">${c.title}</span>
              <span style="color:var(--text-4);font-family:var(--font-mono);">${c.estimatedMinutes||30}m</span>
            </div>`).join('')}
          ${remaining.length > 4 ? `<div style="font-size:10px;color:var(--text-4);">+${remaining.length-4} more concepts</div>` : ''}
        </div>
      </div>
    </div>`;
}

// ── FIX 3: Adaptive concept ordering ──────────────────────────────────────

export function spCheckAdaptiveReorder() {
  // Called after exam results. If concept scored < 50 and it's not the last
  // concept, surface it again after the next concept.
  if (!_spCurrentPlan || !_spDrawerConcept) return;
  const concepts = _spCurrentPlan.concepts;
  const idx = concepts.indexOf(_spDrawerConcept);
  if (idx < 0 || idx >= concepts.length - 2) return;
  const examScore = spMasteryGet(idx)?.exam || 0;
  if (examScore < 50 && examScore > 0) {
    // Move concept to appear again after the next one (not the final exam)
    const insertAt = Math.min(idx + 2, concepts.length - 1);
    const clone = { ...concepts[idx], title: concepts[idx].title + ' (Review)', _isReview: true };
    const alreadyQueued = concepts.some(c => c._isReview && c.title.startsWith(concepts[idx].title));
    if (!alreadyQueued) {
      concepts.splice(insertAt, 0, clone);
      if (typeof wsShowToast === 'function') wsShowToast('🔁', `"${concepts[idx].title}" added for review after next concept`, 'var(--gold-border)');
      spRenderPlan(_spCurrentPlan, _spCurrentPlan.topic);
      _spCurrentPlan.concepts.forEach((_, i) => spMasteryUpdateNode(i, spMasteryScore(i)));
    }
  }
}

// ── FIX 4: Visual Tutor connection ─────────────────────────────────────────

export function spOpenVisualTutor() {
  if (!_spDrawerConcept) return;
  spCloseExplainDrawer();
  const q = _spDrawerConcept.title + (
    _spDrawerConcept.description ? ' — ' + _spDrawerConcept.description.slice(0, 80) : ''
  );
  // Use the established VT bridge
  if (typeof window._vtOpenForConcept === 'function') {
    window._vtOpenForConcept(_spDrawerConcept.title, q);
  } else if (typeof window.showScreen === 'function') {
    window._navFromHistory = true;
    window.showScreen('visual');
    setTimeout(() => {
      if (window._vtAsk) window._vtAsk('explain ' + q);
    }, 400);
  }
}

// ── FIX 5: Override spSavePlanToSidebar to also save to multi-plan library ─

const _originalSpSavePlanToSidebar = spSavePlanToSidebar;

export function spSavePlanToSidebarAndLibrary(topic) {
  // Generate ID if first time
  if (!_spActivePlanId) _spActivePlanId = _spGenPlanId();
  spSaveCurrentPlanToLibrary();
  // Original sidebar (recent plans list)
  if (!topic) return;
  let plans = [];
  try { plans = JSON.parse(localStorage.getItem('sp_recent_plans') || '[]'); } catch (_) {}
  plans = plans.filter(p => p !== topic);
  plans.unshift(topic);
  plans = plans.slice(0, 6);
  localStorage.setItem('sp_recent_plans', JSON.stringify(plans));
  spRenderRecentPlansSidebar(plans);
  // Show My Plans button
  const btn = document.getElementById('btn-switch-plan');
  if (btn) btn.style.display = '';
}

// ── Exam date schedule hook in spUpdatePanel ────────────────────────────────

const _originalSpUpdatePanel = spUpdatePanel;

// Patch spRenderPlan to restore exam date + schedule after render
const _originalSpRenderPlan = spRenderPlan;
export function spRenderPlanPatched(plan, sourceName) {
  _originalSpRenderPlan(plan, sourceName);
  setTimeout(() => {
    spUpdateExamDateUI();
    spUpdateDailySchedule();
    // Show My Plans button if multiple plans exist
    spLoadAllPlans();
    const btn = document.getElementById('btn-switch-plan');
    if (btn) btn.style.display = Object.keys(_spAllPlans).length > 1 ? '' : 'none';
    // Inject daily schedule container into detail panel if not present
    const detailCol = document.getElementById('sp-detail-col');
    if (detailCol && !document.getElementById('sp-daily-schedule')) {
      const schedDiv = document.createElement('div');
      schedDiv.id = 'sp-daily-schedule';
      schedDiv.style.display = 'none';
      detailCol.appendChild(schedDiv);
      spUpdateDailySchedule();
    }
    // Inject SRS review panel if not present
    if (detailCol && !document.getElementById('sp-srs-panel')) {
      const srsDiv = document.createElement('div');
      srsDiv.id = 'sp-srs-panel';
      srsDiv.style.display = 'none';
      detailCol.appendChild(srsDiv);
    }
    // Inject iCal export button if not present
    if (detailCol && !document.getElementById('sp-ical-btn')) {
      const icalBtn = document.createElement('button');
      icalBtn.id = 'sp-ical-btn';
      icalBtn.onclick = () => spExportIcal();
      icalBtn.style.cssText = 'width:100%;display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-md);color:var(--text-3);font-size:12px;cursor:pointer;font-family:var(--font-body);transition:color var(--t-fast),border-color var(--t-fast);margin-top:8px;';
      icalBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Export to Calendar (.ics)';
      icalBtn.onmouseenter = () => { icalBtn.style.color = 'var(--text-1)'; icalBtn.style.borderColor = 'var(--border-md)'; };
      icalBtn.onmouseleave = () => { icalBtn.style.color = 'var(--text-3)'; icalBtn.style.borderColor = 'var(--border-xs)'; };
      detailCol.appendChild(icalBtn);
    }
    // Load SRS data and update review panel
    spSrsLoad();
    setTimeout(() => spUpdateSrsPanel(), 150);
  }, 100);
}

// ── Patch spExamFinish to call adaptive reorder ─────────────────────────────

const _originalSpExamFinish = spExamFinish;
export function spExamFinishPatched() {
  _originalSpExamFinish();
  setTimeout(() => spCheckAdaptiveReorder(), 500);
}

// ── Spaced Repetition System (SM-2 variant) ───────────────────────────────

export function spSrsUpdate(conceptIdx, examScore) {
  // SM-2 algorithm: schedule next review based on performance
  // examScore: 0-100
  if (!_spSrsSchedule[conceptIdx]) {
    _spSrsSchedule[conceptIdx] = { nextReview: Date.now(), interval: SRS_MIN_INTERVAL, ease: SRS_EASE_DEFAULT, reviews: 0 };
  }
  const s = _spSrsSchedule[conceptIdx];
  const grade = examScore >= 90 ? 5 : examScore >= 80 ? 4 : examScore >= 70 ? 3 : examScore >= 60 ? 2 : 1;

  if (grade >= 3) {
    s.interval = s.reviews === 0 ? 1 : s.reviews === 1 ? 3 : Math.round(s.interval * s.ease);
    s.ease = Math.max(1.3, s.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  } else {
    s.interval = SRS_MIN_INTERVAL;
    s.ease = Math.max(1.3, s.ease - 0.2);
  }
  s.nextReview = Date.now() + s.interval * 86400000;
  s.reviews++;
  s.lastScore = examScore;

  try {
    localStorage.setItem('sp_srs_' + (_spActivePlanId || 'default'), JSON.stringify(_spSrsSchedule));
  } catch(e) {}
  spUpdateSrsPanel();
}

export function spSrsLoad() {
  try {
    const raw = localStorage.getItem('sp_srs_' + (_spActivePlanId || 'default'));
    if (raw) _spSrsSchedule = JSON.parse(raw);
  } catch(e) {}
}

export function spSrsGetDueToday() {
  if (!_spCurrentPlan) return [];
  const now = Date.now();
  return _spCurrentPlan.concepts.reduce((due, concept, idx) => {
    const s = _spSrsSchedule[idx];
    if (s && s.nextReview <= now + 86400000) { // due today or overdue
      due.push({ idx, concept, overdue: s.nextReview < now, daysUntil: Math.ceil((s.nextReview - now) / 86400000) });
    }
    return due;
  }, []);
}

export function spUpdateSrsPanel() {
  const el = document.getElementById('sp-srs-panel');
  if (!el || !_spCurrentPlan) return;
  const due = spSrsGetDueToday();
  if (due.length === 0) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = `
    <div class="sp-detail-section-title" style="margin-top:16px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2" stroke-linecap="round" style="margin-right:4px;"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="M12 8v4l3 3"/></svg>
      Review Due (${due.length})
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${due.slice(0,3).map(d => `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:${d.overdue ? 'rgba(139,124,248,0.07)' : 'var(--surface-1)'};border:1px solid ${d.overdue ? 'var(--violet-border)' : 'var(--border-xs)'};border-radius:var(--r-md);cursor:pointer;" onclick="spOpenExplainDrawer(_spCurrentPlan.concepts[${d.idx}],'exam')">
          <div style="width:6px;height:6px;border-radius:50%;background:${d.overdue ? 'var(--violet)' : 'var(--text-4)'};flex-shrink:0;"></div>
          <div style="flex:1;overflow:hidden;">
            <div style="font-size:11px;font-weight:600;color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.concept.title}</div>
            <div style="font-size:10px;color:${d.overdue ? 'var(--violet)' : 'var(--text-4)'};">${d.overdue ? 'Overdue' : 'Due today'} · last ${_spSrsSchedule[d.idx]?.lastScore ?? '—'}%</div>
          </div>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>`).join('')}
      ${due.length > 3 ? `<div style="font-size:10px;color:var(--text-4);padding:4px 0;">+${due.length-3} more due</div>` : ''}
    </div>`;
}

// ── iCal / calendar export ─────────────────────────────────────────────────

export function spExportIcal() {
  if (!_spCurrentPlan || !_spExamDate) {
    if (typeof wsShowToast === 'function') wsShowToast('📅', 'Set an exam date first to export calendar', 'var(--gold-border)');
    return;
  }
  const concepts = _spCurrentPlan.concepts;
  const examMs   = new Date(_spExamDate + 'T00:00:00').getTime();
  const nowMs    = new Date().setHours(0,0,0,0);
  const daysLeft = Math.max(1, Math.ceil((examMs - nowMs) / 86400000));
  const remaining = concepts.filter((c, i) => spMasteryScore(i) < 80);
  const totalMins = remaining.reduce((s, c) => s + (c.estimatedMinutes || 30), 0);
  const minsPerDay = Math.ceil(totalMins / daysLeft);

  const pad = n => String(n).padStart(2, '0');
  const toIcalDate = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  };
  const toIcalDateTime = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };
  const uid = () => Math.random().toString(36).slice(2) + '@chunks-ai';

  const CRLF = '\r\n';
  let events = [];

  // One study session per remaining concept, spread over available days
  let dayOffset = 0;
  remaining.forEach((concept, i) => {
    const sessionMs = nowMs + dayOffset * 86400000;
    const startMs   = sessionMs + 9 * 3600000; // 9 AM
    const endMs     = startMs + (concept.estimatedMinutes || 30) * 60000;
    events.push([
      'BEGIN:VEVENT',
      `UID:${uid()}`,
      `DTSTART:${toIcalDateTime(startMs)}`,
      `DTEND:${toIcalDateTime(endMs)}`,
      `SUMMARY:Study: ${concept.title}`,
      `DESCRIPTION:Critical Path · ${_spCurrentPlan.topic}\nEstimated: ${concept.estimatedMinutes||30} min`,
      `CATEGORIES:STUDY`,
      'END:VEVENT',
    ].join(CRLF));
    // advance day every ~minsPerDay minutes of content
    if ((i + 1) % Math.max(1, Math.ceil(minsPerDay / (concept.estimatedMinutes || 30))) === 0) dayOffset++;
  });

  // Exam day event
  events.push([
    'BEGIN:VEVENT',
    `UID:${uid()}`,
    `DTSTART;VALUE=DATE:${toIcalDate(examMs)}`,
    `DTEND;VALUE=DATE:${toIcalDate(examMs + 86400000)}`,
    `SUMMARY:📝 EXAM: ${_spCurrentPlan.topic}`,
    `DESCRIPTION:Final exam for ${_spCurrentPlan.topic}\nPrepared with Chunks AI Critical Path`,
    `CATEGORIES:EXAM`,
    'END:VEVENT',
  ].join(CRLF));

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    "PRODID:-//Chunks AI//Study Plan//EN",
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${_spCurrentPlan.topic} Study Plan`,
    ...events,
    'END:VCALENDAR',
  ].join(CRLF);

  const blob = new Blob([ical], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (_spCurrentPlan.topic || 'study-plan').replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.ics';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  if (typeof wsShowToast === 'function') wsShowToast('📅', 'Calendar exported — import into Google Calendar or Apple Calendar', 'var(--gold-border)');
}

// ── Confidence tracking across sessions ────────────────────────────────────

export function spConfidenceGet(conceptIdx) {
  // Returns rolling confidence: weighted avg of last 3 exam scores
  const s = _spSrsSchedule[conceptIdx];
  if (!s || !s.reviews) return null;
  return s.lastScore || null;
}

export function spConfidenceBadge(conceptIdx) {
  const score = spConfidenceGet(conceptIdx);
  if (score === null) return '';
  if (score >= 90) return '<span style="font-size:9px;padding:1px 6px;border-radius:var(--r-pill);background:rgba(52,211,153,0.12);color:var(--green);font-family:var(--font-mono);">confident</span>';
  if (score >= 70) return '<span style="font-size:9px;padding:1px 6px;border-radius:var(--r-pill);background:rgba(232,172,46,0.12);color:var(--gold);font-family:var(--font-mono);">learning</span>';
  return '<span style="font-size:9px;padding:1px 6px;border-radius:var(--r-pill);background:rgba(248,113,113,0.12);color:var(--red);font-family:var(--font-mono);">review</span>';
}

// ── Legacy global bridges ─────────────────────────────────────────────────
const _SP_FNS = {
  spSwitchTab, spSetDepth, spUpdateNotesCount, spShowValidationError, spHideValidationError,
  spValidateInputs, spDragOver, spDragLeave, spDrop, spClearUpload, spHandleFileSelect,
  spShowOverlay, spHideOverlay, spHandleGenerate,
  spRenderPlan, spBuildNode, spUpdateStats, spUpdateDetailPanel, spUpdatePanel, spGetUpNextItems,
  spShowEmpty, spShowPlan, spSavePlanToSidebar, spRenderRecentPlansSidebar, animateBars,
  spMasteryGet, spMasteryScore, spMasteryRecord, spMasteryUpdateNode, spMasteryUnlockNext,
  spOpenExplainDrawer, spCloseExplainDrawer, spDrawerTab,
  spFcGenerate, spFcShowDeck, spFcRenderCard, spFcFlip, spFcRate, spFcShowComplete, spFcRestart,
  spPqGenerate, spPqShowCurrent, spPqSubmit, spPqNext, spPqShowComplete, spPqRestart,
  spExamGenerate, spExamStart, spExamShowCurrent, spExamAnswer, spExamFinish, spExamRestart,
  spInitScreen,
};
Object.assign(window, _SP_FNS);

// Mutable state bridges
[
  ['_spCurrentPlan',    () => _spCurrentPlan,    v => { _spCurrentPlan = v; }],
  ['_spActivePlanId',   () => _spActivePlanId,   v => { _spActivePlanId = v; }],
  ['_spDrawerConcept',  () => _spDrawerConcept,  v => { _spDrawerConcept = v; }],
  ['_spMastery',        () => _spMastery,        v => { _spMastery = v; }],
  ['_spFcDeck',         () => _spFcDeck,         v => { _spFcDeck = v; }],
  ['_spPqQuestions',    () => _spPqQuestions,    v => { _spPqQuestions = v; }],
  ['_spExamQuestions',  () => _spExamQuestions,  v => { _spExamQuestions = v; }],
].forEach(([k, get, set]) => Object.defineProperty(window, k, { get, set, configurable: true }));
// ── Window bridges — all sp* functions used via onclick= or window.* calls ───
window.spSwitchTab          = spSwitchTab;
window.spSetDepth           = spSetDepth;
window.spUpdateNotesCount   = spUpdateNotesCount;
window.spDragOver           = spDragOver;
window.spDragLeave          = spDragLeave;
window.spDrop               = spDrop;
window.spClearUpload        = spClearUpload;
window.spHandleFileSelect   = spHandleFileSelect;
window.spShowValidationError= spShowValidationError;
window.spHideValidationError= spHideValidationError;
window.spValidateInputs     = spValidateInputs;
window.spShowOverlay        = spShowOverlay;
window.spHideOverlay        = spHideOverlay;
window.spHandleGenerate     = spHandleGenerate;
window.spRenderPlan         = spRenderPlan;
window.spBuildNode          = spBuildNode;
window.spUpdateStats        = spUpdateStats;
window.spUpdateDetailPanel  = spUpdateDetailPanel;
window.spShowEmpty          = spShowEmpty;
window.spShowPlan           = spShowPlan;
window.spSavePlanToSidebar  = spSavePlanToSidebar;
window.spRenderRecentPlansSidebar = spRenderRecentPlansSidebar;
window.animateBars          = animateBars;
window.spOpenExplainDrawer  = spOpenExplainDrawer;
window.spCloseExplainDrawer = spCloseExplainDrawer;
window.spDrawerTab          = spDrawerTab;
window.spFcGenerate         = spFcGenerate;
window.spFcShowDeck         = spFcShowDeck;
window.spFcRenderCard       = spFcRenderCard;
window.spFcFlip             = spFcFlip;
window.spFcRate             = spFcRate;
window.spFcShowComplete     = spFcShowComplete;
window.spFcRestart          = spFcRestart;
window.spUpdatePanel        = spUpdatePanel;
window.spGetUpNextItems     = spGetUpNextItems;
window.spPqGenerate         = spPqGenerate;
window.spPqShowCurrent      = spPqShowCurrent;
window.spPqSubmit           = spPqSubmit;
window.spPqNext             = spPqNext;
window.spPqShowComplete     = spPqShowComplete;
window.spPqRestart          = spPqRestart;
window.spExamGenerate       = spExamGenerate;
window.spExamStart          = spExamStart;
window.spExamShowCurrent    = spExamShowCurrent;
window.spExamAnswer         = spExamAnswer;
window.spExamFinish         = spExamFinish;
window.spExamRestart        = spExamRestart;
window.spInitScreen         = spInitScreen;

// ── New function window bridges (Fixes 1-5) ──────────────────────────────
window.spShowPlansMenu        = spShowPlansMenu;
window.spHidePlansMenu        = spHidePlansMenu;
window.spSwitchToPlan         = spSwitchToPlan;
window.spDeletePlan           = spDeletePlan;
window.spSaveCurrentPlanToLibrary = spSaveCurrentPlanToLibrary;
window.spLoadAllPlans         = spLoadAllPlans;
window.spShowExamDatePicker   = spShowExamDatePicker;
window.spSetExamDate          = spSetExamDate;
window.spClearExamDate        = spClearExamDate;
window.spUpdateExamDateUI     = spUpdateExamDateUI;
window.spUpdateDailySchedule  = spUpdateDailySchedule;
window.spCheckAdaptiveReorder = spCheckAdaptiveReorder;
window.spOpenVisualTutor      = spOpenVisualTutor;
window.spRenderPlan           = spRenderPlanPatched;   // override with patched version
window.spExamFinish           = spExamFinishPatched;   // override with patched version
window.spSavePlanToSidebar    = spSavePlanToSidebarAndLibrary; // override

window.spSrsUpdate            = spSrsUpdate;
window.spSrsLoad              = spSrsLoad;
window.spSrsGetDueToday       = spSrsGetDueToday;
window.spUpdateSrsPanel       = spUpdateSrsPanel;
window.spExportIcal           = spExportIcal;
window.spConfidenceGet        = spConfidenceGet;
window.spConfidenceBadge      = spConfidenceBadge;

// Close plans menu on outside click
document.addEventListener('click', e => {
  const menu = document.getElementById('sp-plans-menu');
  const btn  = document.getElementById('btn-switch-plan');
  if (menu && menu.style.display !== 'none' && !menu.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
    menu.style.display = 'none';
  }
}, true);

// Handle Visual Tutor tab click via data-action delegation
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action="spOpenVisualTutor"]');
  if (el) spOpenVisualTutor();
});
