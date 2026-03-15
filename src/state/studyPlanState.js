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
    'AI Explain':   `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>`,
    'Flashcards':   `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>`,
    "Practice Q's": `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    'Mini Exam':    `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
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
    const _sb = await (window._getChunksSb?.() ?? Promise.resolve(null));
    if (_sb) {
      const { data: _sess } = await _sb.auth.getSession();
      if (_sess?.session?.access_token) _authHeaders['Authorization'] = 'Bearer ' + _sess.session.access_token;
    }
  } catch (_) {}

  let _spAttempt = 0;
  const _spMaxAttempts = 3;

  const _spTryGenerate = async () => {
    const response = await fetch(API_BASE + '/ask', {
      method: 'POST', headers: _authHeaders,
      body: JSON.stringify({ question: fullPrompt, mode: 'generate', ...(() => { const p = _aiParams(7); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }),
    });
    if (response.status === 429) throw Object.assign(new Error('Server is busy — please wait a moment and try again.'), { noRetry: true });
    if (response.status >= 500) throw new Error('Server error ' + response.status + ' — please retry.');
    if (!response.ok) {
      let errMsg = 'Server error ' + response.status;
      try { const e = await response.json(); errMsg = e.error || errMsg; } catch (_) {}
      throw Object.assign(new Error(errMsg), { noRetry: response.status < 500 });
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
    spHideOverlay();
    spRenderPlan(plan, sourceName);
    spSavePlanToSidebar(plan.topic);
  };

  const _spRetry = async () => {
    try { await _spTryGenerate(); } catch (err) {
      if (!err.noRetry && _spAttempt < _spMaxAttempts) {
        _spAttempt++;
        await new Promise(r => setTimeout(r, 1500 * _spAttempt));
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
    'AI Explain':   `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>`,
    'Flashcards':   `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>`,
    "Practice Q's": `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    'Mini Exam':    `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  };
  const lockIcon  = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  const checkIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const activitiesHTML = ['AI Explain', 'Flashcards', "Practice Q's", 'Mini Exam'].map(act => {
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
        <span class="sp-node-status-badge ${effectiveStatus}">${statusLabel}</span>
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
}

export function spRenderRecentPlansSidebar(plans) {
  const section = document.getElementById('sp-recent-plans-section');
  const list    = document.getElementById('sp-recent-plans-list');
  if (!section || !list) return;
  if (!plans || plans.length === 0) { section.style.display = 'none'; return; }
  section.style.display = '';
  list.innerHTML = plans.map(p => `
    <div class="sidebar-item" role="button" tabindex="0" aria-label="${p}" style="cursor:pointer;font-size:12px;padding:6px 16px;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p}</span>
    </div>
  `).join('');
}

// Restore recent plans on load
(function() {
  try { spRenderRecentPlansSidebar(JSON.parse(localStorage.getItem('sp_recent_plans') || '[]')); } catch (_) {}
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: prompt, mode: 'study', ...(() => { const p = _aiParams(7); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }),
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    const res  = await fetch(API_BASE + '/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt, mode: 'study', ...(() => { const p = _aiParams(6); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }) });
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
  const prompt = `You are a tutor grading a student's short-answer response.\n\nQuestion: ${q.question}\nIdeal answer covers: ${q.ideal_answer}\nKey points to check: ${(q.key_points || []).join('; ')}\n\nStudent's answer: "${answer}"\n\nGrade the answer and respond ONLY as raw JSON (no markdown):\n{"correct": true/false, "score": 0-100, "feedback": "1-2 sentence explanation of what was right/wrong and the correct answer"}`;
  try {
    const res    = await fetch(API_BASE + '/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt, mode: 'study', ...(() => { const p = _aiParams(5); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }) });
    const data   = await res.json();
    const result = JSON.parse((data.answer || data.response || data.text || '').trim().replace(/```(?:json)?/g,'').trim());
    if (result.correct || result.score >= 60) _spPqScore++;
    const verdictEl = document.getElementById('sp-pq-verdict');
    const passed    = result.correct || result.score >= 60;
    verdictEl.style.background = passed ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)';
    verdictEl.style.borderLeft = `3px solid ${passed ? 'var(--green)' : 'var(--red)'}`;
    verdictEl.style.color      = passed ? 'var(--green)' : 'var(--red)';
    verdictEl.innerHTML = (passed ? '✓ Correct' : '✗ Incorrect') + `<span style="margin-left:auto;font-size:11px;font-family:var(--font-mono);opacity:0.8;">${result.score ?? (passed?100:0)}%</span>`;
    document.getElementById('sp-pq-explanation').textContent = result.feedback || '';
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
    const res  = await fetch(API_BASE + '/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt, mode: 'study', ...(() => { const p = _aiParams(7); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }) });
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
  if (chipText in tabMap) spOpenExplainDrawer(concept, tabMap[chipText]);
});

// ── spInitScreen (called by showScreen) ───────────────────────────────────

export function spInitScreen() {
  // Nothing to init on first open; plan generation triggers from button click.
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