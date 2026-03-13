/**
 * src/screens/ExamScreen.js — Exam / Quiz screen
 *
 * Owns all JavaScript for the Exam screen:
 *   - Source material: PDF upload (PDF.js lazy-loaded), notes input, drag-drop
 *   - Scan mode selection: quick / smart / deep
 *   - Question-type selection: MCQ, True/False, situational, CBL, mixed
 *   - Difficulty selection: easy / medium / hard
 *   - Generation pipelines:
 *       A — Quick  (single /ask call)
 *       B — Smart  (full-coverage single call)
 *       C — Deep Scan (chunk → concept extract → per-concept generation)
 *   - Quiz engine: render, select, skip, next, timer, finish
 *   - Results + review list
 *   - Recent-exam sidebar (localStorage snapshots)
 *   - Retry / new-topic helpers
 *   - Sidebar init hook: window.initExamSidebar
 *
 * All functions exposed via window.* so monolith HTML event attributes
 * and navigation.js hooks work without modification.
 *
 * Task 29 — extracted from monolith lines 9003–10175
 */

// ── Source-material state ──────────────────────────────────────────────────

let _examSourceText  = '';
let _examSourceLabel = '';
let _examSourceTab   = 'pdf';
let _pdfjsLibExam    = null;

// ── Quiz state ─────────────────────────────────────────────────────────────

let _examQuestions   = [];
let _examIdx         = 0;
let _examAnswers     = [];
let _examTimerSec    = 0;
let _examTimerHandle = null;
let _examStartTime   = 0;
let _examTopic       = '';
let _examType        = 'mcq';
let _examDiff        = 'medium';
let _examStreakBest  = 0;
let _examStreakCur   = 0;
let _examScanMode    = 'quick';

// ── Source tab toggle ──────────────────────────────────────────────────────

export function examSrcTab(btn) {
  document.querySelectorAll('.exam-src-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _examSourceTab = btn.dataset.tab;
  document.getElementById('exam-src-pdf').style.display   = _examSourceTab === 'pdf'   ? '' : 'none';
  document.getElementById('exam-src-notes').style.display = _examSourceTab === 'notes' ? '' : 'none';
  if (_examSourceTab === 'pdf')   examClearNotes();
  if (_examSourceTab === 'notes') examClearSource(null, true);
}

// ── PDF.js lazy loader ─────────────────────────────────────────────────────

function _loadPdfJsExam() {
  return new Promise((resolve, reject) => {
    if (_pdfjsLibExam) return resolve(_pdfjsLibExam);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      _pdfjsLibExam = window.pdfjsLib;
      _pdfjsLibExam.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(_pdfjsLibExam);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
}

// ── Drag & drop ────────────────────────────────────────────────────────────

export function examDragOver(e) {
  e.preventDefault();
  document.getElementById('exam-upload-zone').classList.add('drag-over');
}
export function examDragLeave() {
  document.getElementById('exam-upload-zone').classList.remove('drag-over');
}
export function examDrop(e) {
  e.preventDefault();
  document.getElementById('exam-upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') _examProcessPdf(file);
}

// ── File input handler ─────────────────────────────────────────────────────

export function examHandlePdfFile(input) {
  const file = input.files[0];
  if (file) _examProcessPdf(file);
  input.value = '';
}

// ── Core PDF extraction ────────────────────────────────────────────────────

async function _examProcessPdf(file) {
  const zone     = document.getElementById('exam-upload-zone');
  const idle     = document.getElementById('exam-upload-idle');
  const attached = document.getElementById('exam-upload-attached');
  const statusEl = document.getElementById('exam-extract-status');
  const nameEl   = document.getElementById('exam-file-name');
  const pagesEl  = document.getElementById('exam-file-pages');

  nameEl.textContent = file.name.length > 38 ? file.name.slice(0, 36) + '…' : file.name;
  pagesEl.textContent = '';
  statusEl.innerHTML = '<div class="exam-extract-spinner"></div><span>Extracting text…</span>';
  idle.style.display     = 'none';
  attached.style.display = '';
  zone.classList.add('has-file');

  try {
    const lib      = await _loadPdfJsExam();
    const arrayBuf = await file.arrayBuffer();
    const pdfDoc   = await lib.getDocument({ data: arrayBuf }).promise;
    const numPages = pdfDoc.numPages;
    pagesEl.textContent = numPages + ' page' + (numPages !== 1 ? 's' : '');

    const maxPages = Math.min(numPages, 40);
    let fullText = '';
    for (let p = 1; p <= maxPages; p++) {
      const page    = await pdfDoc.getPage(p);
      const content = await page.getTextContent();
      fullText += content.items.map(i => i.str).join(' ') + '\n';
    }
    fullText = fullText.trim();
    if (!fullText) throw new Error('No text found — the PDF may be scanned/image-based.');

    _examSourceText  = fullText.slice(0, 60000);
    _examSourceLabel = file.name.replace(/\.pdf$/i, '');
    _examToggleScanMode(true);

    const charCount  = _examSourceText.length.toLocaleString();
    const truncated  = fullText.length > 28000;
    statusEl.innerHTML =
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' +
      '<span style="color:var(--green);">Ready — ' + charCount + ' chars extracted' + (truncated ? ' (first 40 pages)' : '') + '</span>';

  } catch (err) {
    _examSourceText  = '';
    _examSourceLabel = '';
    statusEl.innerHTML =
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<span style="color:var(--red);">' + err.message + '</span>';
  }
}

// ── Clear PDF / notes ──────────────────────────────────────────────────────

export function examClearSource(e, silent) {
  if (e) e.stopPropagation();
  _examSourceText  = '';
  _examSourceLabel = '';
  document.getElementById('exam-upload-idle').style.display     = '';
  document.getElementById('exam-upload-attached').style.display = 'none';
  document.getElementById('exam-upload-zone').classList.remove('has-file');
  document.getElementById('exam-pdf-file').value = '';
  _examToggleScanMode(false);
}

export function examClearNotes() {
  const notesEl = document.getElementById('exam-notes-input');
  if (notesEl) notesEl.value = '';
  document.getElementById('exam-notes-count').textContent = '0 chars';
  _examSourceText  = '';
  _examSourceLabel = '';
  _examToggleScanMode(false);
}

// ── Type / difficulty / scan-mode selectors ───────────────────────────────

export function examSelectType(btn) {
  document.querySelectorAll('#exam-type-grid .exam-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _examType = btn.dataset.type;
  const sitHint = document.getElementById('exam-situational-hint');
  if (sitHint) sitHint.style.display = _examType === 'situational' ? '' : 'none';
  const cblHint = document.getElementById('exam-cbl-hint');
  if (cblHint) cblHint.style.display = _examType === 'cbl' ? '' : 'none';
}

export function examSelectDiff(btn) {
  btn.closest('div').querySelectorAll('.exam-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _examDiff = btn.dataset.diff;
}

export function examSelectScanMode(card) {
  document.querySelectorAll('.exam-scan-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  _examScanMode = card.dataset.mode;
  const countLabel = document.getElementById('exam-count-label');
  const deepNote   = document.getElementById('exam-deep-note');
  if (_examScanMode === 'deep') {
    if (countLabel) countLabel.textContent = 'Max Questions (cap)';
    if (deepNote)   deepNote.style.display = '';
  } else {
    if (countLabel) countLabel.textContent = 'Number of Questions';
    if (deepNote)   deepNote.style.display = 'none';
  }
}

function _examToggleScanMode(hasSource) {
  const field = document.getElementById('exam-scan-mode-field');
  if (field) field.style.display = hasSource ? '' : 'none';
  if (!hasSource) {
    document.querySelectorAll('.exam-scan-card').forEach(c => c.classList.remove('active'));
    const first = document.querySelector('.exam-scan-card[data-mode="quick"]');
    if (first) first.classList.add('active');
    _examScanMode = 'quick';
    const countLabel = document.getElementById('exam-count-label');
    if (countLabel) countLabel.textContent = 'Number of Questions';
    const deepNote = document.getElementById('exam-deep-note');
    if (deepNote) deepNote.style.display = 'none';
  }
}

// ── View switcher ──────────────────────────────────────────────────────────

function _examShow(view) {
  ['exam-setup', 'exam-loading', 'exam-quiz', 'exam-results'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === view ? 'block' : 'none';
  });
}

// ── Shared API call helper ─────────────────────────────────────────────────

async function _examCallAPI(prompt, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(window.API_BASE + '/ask', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: prompt, mode: 'generate', complexity: 6, bookId: 'none', history: [] }),
      });
      if (resp.status === 429) {
        const wait = 2000 * (attempt + 1);
        if (attempt < retries) { await new Promise(r => setTimeout(r, wait)); continue; }
        throw new Error('Server is busy — please wait a moment and try again.');
      }
      if (resp.status === 504 || resp.status === 502 || resp.status === 503) {
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
        throw new Error('Server timeout (504) — Railway may be cold-starting, please try again.');
      }
      if (!resp.ok) throw new Error('Server error ' + resp.status);
      const data = await resp.json();
      const rawAnswer = data.answer || data.response || data.text || data.content || data.result || '';
      const answer    = typeof rawAnswer === 'string' ? rawAnswer : String(rawAnswer ?? '');
      if (!answer && attempt < retries) {
        console.warn('[API] Empty answer, retrying...', JSON.stringify(data).slice(0, 200));
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return answer.trim();
    } catch (err) {
      if (attempt < retries && (err.message.includes('fetch') || err.message.includes('network'))) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

// ── Question parser ────────────────────────────────────────────────────────

function _examParseQuestions(raw) {
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const s = cleaned.indexOf('[');
  const e = cleaned.lastIndexOf(']');
  if (s < 0 || e < 0) {
    console.warn('No question array found in:', raw.slice(0, 300));
    throw new Error('No question array found — the AI returned an unexpected format. Please try again.');
  }
  let jsonStr = cleaned.slice(s, e + 1)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
    .replace(/:\s*'([^']*)'/g, ': "$1"');
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    const objects = [];
    const objRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    let m;
    while ((m = objRegex.exec(jsonStr)) !== null) {
      try { objects.push(JSON.parse(m[0])); } catch {}
    }
    if (objects.length) { parsed = objects; }
    else {
      console.warn('Parse failed. Raw:', raw.slice(0, 500));
      throw new Error('Could not parse questions — please try again.');
    }
  }
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('No questions returned.');
  return parsed;
}

// ── Deep-scan progress UI ──────────────────────────────────────────────────

function _deepSetStage(stage) {
  const order = ['chunk', 'extract', 'generate'];
  const idx   = order.indexOf(stage);
  order.forEach((s, i) => {
    const el = document.getElementById('stage-' + s);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (i < idx)  el.classList.add('done');
    if (i === idx) el.classList.add('active');
  });
}

function _deepSetProgress(pct, stepText) {
  const bar    = document.getElementById('exam-deep-bar');
  const pctEl  = document.getElementById('exam-deep-pct');
  const textEl = document.getElementById('exam-deep-step-text');
  if (bar)    bar.style.width      = pct + '%';
  if (pctEl)  pctEl.textContent    = Math.round(pct) + '%';
  if (textEl) textEl.textContent   = stepText;
}

// ── Text chunker ───────────────────────────────────────────────────────────

function _examChunkText(text, wordsPerChunk = 250) {
  const words  = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push({ idx: chunks.length + 1, text: words.slice(i, i + wordsPerChunk).join(' ') });
  }
  return chunks;
}

function _examLabeledSource(text, wordsPerChunk = 250) {
  const chunks = _examChunkText(text, wordsPerChunk);
  const total  = chunks.length;
  return chunks.map(c => `[BLOCK ${c.idx} of ${total}]\n${c.text}`).join('\n\n');
}

// ── Batch helper ───────────────────────────────────────────────────────────

async function _examBatchedGenerate(prompt, totalCount) {
  const BATCH = 10;
  if (totalCount <= BATCH) {
    const raw = await _examCallAPI(prompt);
    return _examParseQuestions(raw);
  }
  let all = [];
  const numBatches = Math.ceil(totalCount / BATCH);
  for (let bi = 0; bi < numBatches; bi++) {
    const batchCount  = Math.min(BATCH, totalCount - all.length);
    const batchPrompt = prompt.replace(/Generate exactly \d+ /, `Generate exactly ${batchCount} `);
    const raw = await _examCallAPI(batchPrompt);
    all = all.concat(_examParseQuestions(raw));
    if (bi < numBatches - 1) await new Promise(r => setTimeout(r, 700));
  }
  return all;
}

// ── Pipeline A — Quick ─────────────────────────────────────────────────────

async function _examRunQuick(topic, sourceText, count, typeLabel) {
  let prompt;
  if (sourceText) {
    const topicClause = topic ? ` Focus specifically on: "${topic}".` : '';
    const labeledSrc  = _examLabeledSource(sourceText);
    if (typeLabel === 'situational') {
      prompt = `You are creating a situational exam from the following source material.${topicClause}\nGenerate exactly ${count} situational exam questions. Difficulty: ${_examDiff}.\nEach question must: (1) open with a realistic scenario drawn from the source material (2-4 sentences), (2) ask what the BEST action or decision is, (3) have exactly 4 plausible options labeled A-D where only one is clearly best.\nBase scenarios ONLY on content in the source. Include a 1-2 sentence explanation for the correct answer.\nEach question MUST include a "ref" field citing the [BLOCK X of Y] it came from (e.g. "ref": "Block 3").\nOutput ONLY a raw JSON array with no markdown:\n[{"q":"SCENARIO: ...\\n\\nQuestion: What should you do?","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]\n\nSOURCE MATERIAL (labeled by block):\n---\n${labeledSrc.slice(0, 55000)}\n---`;
    } else if (typeLabel === 'case-based-learning') {
      prompt = `You are a rigorous medical educator. Create Case-Based Learning (CBL) questions from the following source material.${topicClause}\nGenerate exactly ${count} clinical vignette questions. Base each case ONLY on content from the source.\nVary the question focus: diagnosis, next best step, mechanism, and treatment.\n\nDIFFICULTY RULES — apply strictly based on: ${_examDiff}\n- easy:   Common textbook presentations. Classic symptoms, obvious vitals, straightforward distractors.\n- medium: Slightly atypical presentations. One or two misleading findings.\n- hard:   USMLE Step 2 CK level. Zebra diagnoses, red herrings, subtle vitals, plausible distractors, next-best-step focus.\nEach question MUST include a "ref" field citing the block it came from.\nOutput ONLY a raw JSON array — no markdown:\n[{"case":{"patient":"...","chief_complaint":"...","history":"...","vitals":{"BP":"...","HR":"...","RR":"...","Temp":"...","SpO2":"..."},"findings":"...","tag":"Diagnosis|Next Best Step|Treatment|Mechanism"},"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]\n\nSOURCE MATERIAL (labeled by block):\n---\n${labeledSrc.slice(0, 55000)}\n---`;
    } else {
      prompt = `You are creating an exam from the following source material.${topicClause}\nGenerate exactly ${count} ${typeLabel} exam questions. Difficulty: ${_examDiff}.\nBase your questions ONLY on the content provided. Rules: MCQ has 4 options labeled A-D. True/False options are exactly ["True","False"]. One correct answer each. Include a 1-2 sentence explanation per question.\nEach question MUST include a "ref" field citing the [BLOCK X of Y] it came from (e.g. "ref": "Block 3").\nOutput ONLY a raw JSON array with no markdown:\n[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]\n\nSOURCE MATERIAL (labeled by block):\n---\n${labeledSrc.slice(0, 55000)}\n---`;
    }
  } else {
    if (typeLabel === 'situational') {
      prompt = `Generate exactly ${count} situational exam questions about: "${topic}". Difficulty: ${_examDiff}.\nEach question must: (1) open with a realistic, specific real-world scenario (2-4 sentences), (2) ask what the BEST action or decision is, (3) have exactly 4 options labeled A-D where only one is clearly best.\nInclude a 1-2 sentence explanation for the correct answer.\nOutput ONLY a raw JSON array with no markdown:\n[{"q":"SCENARIO: ...\\n\\nQuestion: What should you do?","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]`;
    } else if (typeLabel === 'case-based-learning') {
      prompt = `You are a rigorous medical educator writing Case-Based Learning (CBL) exam questions about: "${topic}".\nGenerate exactly ${count} clinical vignette questions. Vary the focus: mix diagnosis, next best step, mechanism, and treatment questions.\n\nDIFFICULTY RULES — apply strictly based on: ${_examDiff}\n- easy:   Common textbook presentations.\n- medium: Slightly atypical presentations, plausible distractors.\n- hard:   USMLE Step 2 CK level. Zebra diagnoses, red herrings, subtle findings, next-best-step focus.\nOutput ONLY a raw JSON array — no markdown, no extra fields:\n[{"case":{"patient":"...","chief_complaint":"...","history":"...","vitals":{"BP":"...","HR":"...","RR":"...","Temp":"...","SpO2":"..."},"findings":"...","tag":"Diagnosis|Next Best Step|Treatment|Mechanism"},"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]`;
    } else {
      prompt = `Generate exactly ${count} ${typeLabel} exam questions about: "${topic}". Difficulty: ${_examDiff}.\nRules: MCQ has 4 options labeled A-D. True/False options are exactly ["True","False"]. One correct answer each. Include a 1-2 sentence explanation per question.\nOutput ONLY a raw JSON array with no markdown:\n[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]`;
    }
  }
  return await _examBatchedGenerate(prompt, count);
}

// ── Pipeline B — Smart ─────────────────────────────────────────────────────

async function _examRunSmart(topic, sourceText, count, typeLabel) {
  let prompt;
  if (sourceText) {
    const topicClause = topic ? ` Topic focus: "${topic}".` : '';
    const labeledSrc  = _examLabeledSource(sourceText);
    if (typeLabel === 'situational') {
      prompt = `You are a thorough situational exam writer.${topicClause}\nRead the ENTIRE source material below (labeled by block) from start to finish.\nIdentify real-world scenarios, cases, decisions, and practical applications across ALL blocks.\nGenerate up to ${count} situational exam questions distributed evenly across blocks.\nEach question must: (1) open with a 2-4 sentence realistic scenario, (2) ask what the BEST action is, (3) have 4 plausible options labeled A-D where only one is clearly best.\nDifficulty: ${_examDiff}. Include a 1-2 sentence explanation per question.\nEach question MUST include a "ref" field citing the block it came from (e.g. "ref": "Block 3").\nOutput ONLY a raw JSON array with no markdown:\n[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]\n\nSOURCE MATERIAL (labeled by block):\n---\n${labeledSrc.slice(0, 55000)}\n---`;
    } else {
      prompt = `You are a thorough exam writer.${topicClause}\nRead the ENTIRE source material below (labeled by block) from start to finish.\nIdentify EVERY distinct concept across ALL blocks — do not skip any block.\nGenerate up to ${count} ${typeLabel} exam questions covering the FULL document evenly across all blocks.\nDifficulty: ${_examDiff}.\nRules: MCQ has 4 options labeled A-D. True/False options are exactly ["True","False"]. One correct answer each. Include a 1-2 sentence explanation per question.\nEach question MUST include a "ref" field citing the block it came from (e.g. "ref": "Block 3").\nOutput ONLY a raw JSON array with no markdown:\n[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]\n\nSOURCE MATERIAL (labeled by block):\n---\n${labeledSrc.slice(0, 55000)}\n---`;
    }
  } else {
    if (typeLabel === 'situational') {
      prompt = `You are a thorough situational exam writer. Generate exactly ${count} situational exam questions about: "${topic}".\nDifficulty: ${_examDiff}. Cover a broad range of real-world scenarios — vary the settings, roles, and complications.\nEach question must: (1) open with a 2-4 sentence realistic scenario, (2) ask what the BEST action is, (3) have 4 plausible options labeled A-D where only one is clearly best. Include a 1-2 sentence explanation per question.\nOutput ONLY a raw JSON array with no markdown:\n[{"q":"SCENARIO: ...\\n\\nQuestion: What should you do?","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]`;
    } else if (typeLabel === 'case-based-learning') {
      prompt = `You are a rigorous medical educator writing Case-Based Learning (CBL) questions about: "${topic}".\nGenerate exactly ${count} clinical vignette questions distributed across diagnosis, next best step, mechanism, and treatment.\n\nDIFFICULTY RULES — apply strictly based on: ${_examDiff}\n- easy:   Common textbook presentations.\n- medium: Atypical presentations, plausible distractors.\n- hard:   USMLE Step 2 CK level. Zebra diagnoses, red herrings, subtle findings, management focus.\nOutput ONLY a raw JSON array — no markdown:\n[{"case":{"patient":"...","chief_complaint":"...","history":"...","vitals":{"BP":"...","HR":"...","RR":"...","Temp":"...","SpO2":"..."},"findings":"...","tag":"Diagnosis|Next Best Step|Treatment|Mechanism"},"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]`;
    } else {
      prompt = `You are a thorough exam writer. Generate exactly ${count} ${typeLabel} exam questions about: "${topic}".\nDifficulty: ${_examDiff}. Cover a broad range of subtopics — do not focus only on the most obvious concepts.\nRules: MCQ has 4 options labeled A-D. True/False options are exactly ["True","False"]. One correct answer each. Include a 1-2 sentence explanation per question.\nOutput ONLY a raw JSON array with no markdown:\n[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]`;
    }
  }
  return await _examBatchedGenerate(prompt, count);
}

// ── Pipeline C — Deep Scan ─────────────────────────────────────────────────

async function _examRunDeepScan(topic, sourceText, maxCount, typeLabel) {
  const deepProg = document.getElementById('exam-deep-progress');
  if (deepProg) deepProg.style.display = '';

  // Stage 1: Chunk
  _deepSetStage('chunk');
  _deepSetProgress(5, 'Splitting document into sections…');
  await new Promise(r => setTimeout(r, 120));

  const chunks = _examChunkText(sourceText, 500);
  _deepSetProgress(10, `Split into ${chunks.length} sections`);

  // Stage 2: Extract concepts
  _deepSetStage('extract');
  const topicClause = topic ? ` The overall subject is: "${topic}".` : '';
  const allConcepts = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk      = chunks[i];
    const blockLabel = `Block ${chunk.idx} of ${chunks.length}`;
    const prompt     = `Extract the 4-6 most important, distinct, testable concepts from this passage.${topicClause}\nReturn ONLY a JSON array of objects, no markdown:\n[{"concept":"short concept string max 12 words","ref":"${blockLabel}"}]\n\nPASSAGE (${blockLabel}):\n---\n${chunk.text}\n---`;
    try {
      const raw = await _examCallAPI(prompt);
      const s = raw.indexOf('['), e = raw.lastIndexOf(']');
      if (s >= 0 && e >= 0) {
        const arr = JSON.parse(raw.slice(s, e + 1));
        if (Array.isArray(arr)) {
          arr.forEach(item => {
            if (typeof item === 'string')              allConcepts.push({ concept: item.trim(), ref: blockLabel });
            else if (item && typeof item.concept === 'string') allConcepts.push({ concept: item.concept.trim(), ref: item.ref || blockLabel });
          });
        }
      }
    } catch (err) { console.warn('Concept extract error:', err.message); }

    const pct = 10 + ((i + 1) / chunks.length) * 55;
    _deepSetProgress(pct, `Scanned ${i + 1} of ${chunks.length} sections — ${allConcepts.length} concepts found`);
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 700));
  }

  if (!allConcepts.length) throw new Error('Could not extract concepts from the document. Try Smart or Quick mode.');

  // Deduplicate
  const seen   = new Set();
  const unique = allConcepts.filter(c => {
    const key = c.concept.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const hardCap = maxCount <= 10 ? 80 : maxCount;
  const capped  = unique.slice(0, hardCap);
  _deepSetProgress(68, `${capped.length} unique concepts identified — generating questions…`);

  // Stage 3: Generate questions
  _deepSetStage('generate');
  const BATCH_SIZE = 10;
  const batches    = [];
  for (let b = 0; b < capped.length; b += BATCH_SIZE) batches.push(capped.slice(b, b + BATCH_SIZE));

  let allQuestions = [];
  for (let bi = 0; bi < batches.length; bi++) {
    const batch     = batches[bi];
    const batchList = batch.map((c, i) => `${allQuestions.length + i + 1}. [${c.ref}] ${c.concept}`).join('\n');
    const batchPct  = 65 + Math.round(((bi + 1) / batches.length) * 30);
    _deepSetProgress(batchPct, `Generating questions ${allQuestions.length + 1}–${allQuestions.length + batch.length} of ${capped.length}…`);

    const topicLine = topic ? `The subject is: "${topic}".` : '';
    let batchPrompt;
    if (typeLabel === 'situational') {
      batchPrompt = `You are a precise situational exam writer. ${topicLine}\nGenerate exactly ${batch.length} situational exam questions — one per concept listed below.\nFor each concept, create a realistic 2-4 sentence scenario, then ask what the BEST action is.\nProvide 4 plausible options labeled A-D. Difficulty: ${_examDiff}. Include a 1-2 sentence explanation per question.\nEach question MUST include the "ref" value from its concept entry.\nOutput ONLY a raw JSON array with no markdown:\n[{"q":"SCENARIO: ...\\n\\nQuestion: What should you do?","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]\n\nCONCEPTS:\n${batchList}`;
    } else if (typeLabel === 'case-based-learning') {
      batchPrompt = `You are a rigorous medical educator. ${topicLine}\nGenerate exactly ${batch.length} Case-Based Learning questions — one per concept below. Difficulty: ${_examDiff}.\nFor each concept create a clinical vignette then ask ONE focused question (diagnosis, next best step, mechanism, or treatment).\nEach question MUST include the "ref" value from its concept entry.\nOutput ONLY a raw JSON array — no markdown:\n[{"case":{"patient":"...","chief_complaint":"...","history":"...","vitals":{"BP":"...","HR":"...","RR":"...","Temp":"...","SpO2":"..."},"findings":"...","tag":"Diagnosis|Next Best Step|Treatment|Mechanism"},"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]\n\nCONCEPTS:\n${batchList}`;
    } else {
      batchPrompt = `You are a precise exam writer. ${topicLine}\nGenerate exactly ${batch.length} ${typeLabel} exam questions — one per concept listed below. Difficulty: ${_examDiff}.\nRules: MCQ has 4 options labeled A-D. True/False options are exactly ["True","False"]. One correct answer. Include a 1-2 sentence explanation.\nEach question MUST include the "ref" value from its concept entry.\nOutput ONLY a raw JSON array with no markdown:\n[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]\n\nCONCEPTS:\n${batchList}`;
    }

    const batchRaw = await _examCallAPI(batchPrompt);
    allQuestions   = allQuestions.concat(_examParseQuestions(batchRaw));
    if (bi < batches.length - 1) await new Promise(r => setTimeout(r, 700));
  }

  _deepSetProgress(98, 'Finalizing exam…');
  await new Promise(r => setTimeout(r, 200));
  _deepSetProgress(100, 'Done!');
  document.getElementById('stage-generate')?.classList.replace('active', 'done');
  return allQuestions;
}

// ── Main entry point ───────────────────────────────────────────────────────

export async function examStart() {
  const topic = document.getElementById('exam-topic-input').value.trim();
  const errEl = document.getElementById('exam-error');
  errEl.style.display = 'none';

  // Resolve notes source
  const notesVal = (document.getElementById('exam-notes-input')?.value || '').trim();
  if (_examSourceTab === 'notes' && notesVal) {
    _examSourceText  = notesVal.slice(0, 60000);
    _examSourceLabel = 'your notes';
  }

  if (!topic && !_examSourceText) {
    errEl.textContent   = 'Please enter a topic or upload source material.';
    errEl.style.display = 'block';
    return;
  }

  const count   = parseInt(document.getElementById('exam-count-input').value) || 10;
  const timeSec = parseInt(document.getElementById('exam-time-input').value)  || 0;
  _examTopic    = topic || _examSourceLabel || 'Uploaded document';
  _examTimerSec = timeSec;

  document.getElementById('exam-start-btn').disabled = true;
  document.getElementById('exam-loading-topic').textContent = _examTopic;
  document.getElementById('exam-loading-text').textContent  =
    _examScanMode === 'deep'  ? 'Deep scanning your document…' :
    _examScanMode === 'smart' ? 'Analyzing full content…'      :
    'Generating your exam…';

  const deepProg = document.getElementById('exam-deep-progress');
  if (deepProg) deepProg.style.display = 'none';
  ['chunk', 'extract', 'generate'].forEach(s => {
    const el = document.getElementById('stage-' + s);
    if (el) el.classList.remove('active', 'done');
  });

  _examShow('exam-loading');

  const typeLabel = {
    mcq:          'multiple-choice',
    truefalse:    'true/false',
    situational:  'situational',
    cbl:          'case-based-learning',
    mixed:        'mixed (include a variety: multiple-choice, true/false, and situational)',
  }[_examType];

  try {
    let questions;
    if (_examScanMode === 'deep' && _examSourceText) {
      questions = await _examRunDeepScan(topic, _examSourceText, count, typeLabel);
    } else if (_examScanMode === 'smart') {
      questions = await _examRunSmart(topic, _examSourceText, count, typeLabel);
    } else {
      questions = await _examRunQuick(topic, _examSourceText, count, typeLabel);
    }

    _examQuestions  = questions;
    _examIdx        = 0;
    _examAnswers    = new Array(questions.length).fill(null);
    _examStreakBest = 0;
    _examStreakCur  = 0;
    _examStartTime  = Date.now();
    _examShow('exam-quiz');
    _examRenderQuestion();
    if (_examTimerSec > 0) _examStartTimer();
    else document.getElementById('exam-timer-display').style.display = 'none';

  } catch (err) {
    _examShow('exam-setup');
    errEl.textContent   = err.message;
    errEl.style.display = 'block';
  } finally {
    document.getElementById('exam-start-btn').disabled = false;
  }
}

// ── Question renderer ──────────────────────────────────────────────────────

function _examRenderQuestion() {
  const q     = _examQuestions[_examIdx];
  const total = _examQuestions.length;

  document.getElementById('exam-q-label').textContent = `Question ${_examIdx + 1} of ${total}`;
  document.getElementById('exam-q-num').textContent   = `QUESTION ${_examIdx + 1}`;

  // Source-block reference badge
  const refEl     = document.getElementById('exam-q-ref');
  const refTextEl = document.getElementById('exam-q-ref-text');
  if (refEl && refTextEl) {
    if (q.ref) { refTextEl.textContent = q.ref; refEl.style.display = ''; }
    else        { refEl.style.display = 'none'; }
  }

  // Remove stale scenario block
  document.getElementById('exam-q-scenario')?.remove();

  const rawQ      = q.q || '';
  const cblCard   = document.getElementById('exam-cbl-card');
  const cblVitals = document.getElementById('exam-cbl-vitals');
  const cblBody   = document.getElementById('exam-cbl-body');
  const cblTag    = document.getElementById('exam-cbl-tag');
  const qTextEl   = document.getElementById('exam-q-text');

  if (q.case && typeof q.case === 'object') {
    // CBL clinical vignette card
    const c = q.case;
    if (cblTag) cblTag.textContent = c.tag || 'Clinical Case';
    if (cblVitals) {
      const vitals = c.vitals || {};
      const VITAL_LABELS = { BP: 'BP', HR: 'HR', RR: 'RR', Temp: 'Temp', SpO2: 'SpO₂' };
      cblVitals.innerHTML = Object.entries(vitals).map(([k, v]) => {
        const isAbn = (k === 'HR'   && (parseInt(v) < 60 || parseInt(v) > 100))   ||
                      (k === 'RR'   && (parseInt(v) < 12 || parseInt(v) > 20))    ||
                      (k === 'SpO2' && parseInt(v) < 95)                          ||
                      (k === 'Temp' && (parseFloat(v) < 36.5 || parseFloat(v) > 37.5));
        return `<div class="exam-cbl-vital-item"><span class="exam-cbl-vital-label">${VITAL_LABELS[k] || k}</span><span class="exam-cbl-vital-value${isAbn ? ' abnormal' : ''}">${v || '—'}</span></div>`;
      }).join('');
    }
    if (cblBody) {
      const patientLine = c.patient        ? '<strong>' + c.patient + '</strong> — '   : '';
      const cc          = c.chief_complaint ? '<strong>CC:</strong> ' + c.chief_complaint + '<br>' : '';
      const hx          = c.history        ? c.history + '<br>'                        : '';
      const pe          = c.findings       ? '<strong>Findings:</strong> ' + c.findings : '';
      cblBody.innerHTML = patientLine + cc + hx + pe;
    }
    if (cblCard) cblCard.style.display = '';
    document.getElementById('exam-cbl-qtype')?.remove();
    const badge = document.createElement('div');
    badge.id        = 'exam-cbl-qtype';
    badge.className = 'exam-cbl-q-type';
    badge.textContent = '🩺 ' + (q.case.tag || 'Clinical Question');
    qTextEl.parentNode.insertBefore(badge, qTextEl);
    qTextEl.textContent = rawQ;

  } else {
    if (cblCard) cblCard.style.display = 'none';
    document.getElementById('exam-cbl-qtype')?.remove();

    // Situational: split SCENARIO from question stem
    const qHeader       = document.querySelector('.exam-q-header');
    const scenarioMatch = rawQ.match(/^SCENARIO:\s*([\s\S]+?)\n\n(?:Question:\s*)?([\s\S]+)$/i);
    if (scenarioMatch) {
      const scenarioEl      = document.createElement('div');
      scenarioEl.id         = 'exam-q-scenario';
      scenarioEl.className  = 'exam-q-scenario';
      scenarioEl.innerHTML  = '<strong>📋 Scenario</strong>' + scenarioMatch[1].trim();
      qHeader.insertBefore(scenarioEl, qTextEl);
      qTextEl.textContent = scenarioMatch[2].trim();
    } else {
      qTextEl.textContent = rawQ;
    }
  }

  document.getElementById('exam-progress-fill').style.width = (_examIdx / total * 100) + '%';
  document.getElementById('exam-score-live').textContent    = _examAnswers.filter(a => a && a.correct).length + ' correct';

  // Render options
  const optEl  = document.getElementById('exam-options');
  optEl.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D', 'E'];
  q.options.forEach((opt, i) => {
    const letter = q.options.length === 2 ? (i === 0 ? 'T' : 'F') : letters[i];
    const btn    = document.createElement('button');
    btn.className = 'exam-option';
    btn.innerHTML = '<span class="opt-letter">' + letter + '</span><span class="opt-text">' + opt.replace(/^[A-DF]\.\s*/, '') + '</span>';
    btn.addEventListener('click', () => _examSelect(i, btn));
    const prev = _examAnswers[_examIdx];
    if (prev !== null) {
      btn.disabled = true;
      const correctText = q.answer.replace(/^[A-DF]\.\s*/, '').trim().toLowerCase();
      const optText     = opt.replace(/^[A-DF]\.\s*/, '').trim().toLowerCase();
      if (i === prev.selected) btn.classList.add(prev.correct ? 'correct' : 'wrong');
      if (!prev.correct && optText === correctText) btn.classList.add('correct');
    }
    optEl.appendChild(btn);
  });

  const fb  = document.getElementById('exam-feedback');
  fb.className = 'exam-feedback';
  fb.innerHTML = '';
  const prev = _examAnswers[_examIdx];
  if (prev !== null) _examShowFeedback(prev.correct, q.explanation);

  const nextBtn = document.getElementById('exam-next-btn');
  const skipBtn = document.getElementById('exam-skip-btn');
  nextBtn.disabled     = prev === null;
  nextBtn.textContent  = _examIdx === total - 1 ? 'Finish' : 'Next';
  skipBtn.style.display = prev === null ? 'inline-block' : 'none';
  document.getElementById('exam-answered-hint').textContent =
    prev ? '' : `${_examAnswers.filter(a => a !== null).length} of ${total} answered`;
}

// ── Answer selection ───────────────────────────────────────────────────────

function _examSelect(idx, btn) {
  if (_examAnswers[_examIdx] !== null) return;
  const q      = _examQuestions[_examIdx];
  const chosen = q.options[idx].replace(/^[A-DF]\.\s*/, '').trim().toLowerCase();
  const ansLetter = q.answer.replace(/^([A-D])[\.\s].*/, '$1').trim();
  const letters   = ['A', 'B', 'C', 'D', 'E'];
  let isCorrect = letters[idx] === ansLetter;
  if (!isCorrect) isCorrect = chosen === q.answer.replace(/^[A-DF]\.\s*/, '').trim().toLowerCase();
  if (q.options.length === 2) {
    isCorrect = (idx === 0 && /^(true|t)$/i.test(q.answer)) ||
                (idx === 1 && /^(false|f)$/i.test(q.answer)) ||
                isCorrect;
  }
  _examAnswers[_examIdx] = { selected: idx, correct: isCorrect, skipped: false };
  if (isCorrect) { _examStreakCur++; _examStreakBest = Math.max(_examStreakBest, _examStreakCur); }
  else _examStreakCur = 0;

  document.querySelectorAll('#exam-options .exam-option').forEach((o, i) => {
    o.disabled = true;
    if (i === idx) o.classList.add(isCorrect ? 'correct' : 'wrong');
    const oText = q.options[i].replace(/^[A-DF]\.\s*/, '').trim().toLowerCase();
    if (!isCorrect && oText === q.answer.replace(/^[A-DF]\.\s*/, '').trim().toLowerCase()) o.classList.add('correct');
  });
  _examShowFeedback(isCorrect, q.explanation);
  document.getElementById('exam-next-btn').disabled = false;
  document.getElementById('exam-skip-btn').style.display = 'none';
  document.getElementById('exam-score-live').textContent = _examAnswers.filter(a => a && a.correct).length + ' correct';
}

function _examShowFeedback(ok, explanation) {
  const fb = document.getElementById('exam-feedback');
  fb.className = 'exam-feedback show ' + (ok ? 'correct-fb' : 'wrong-fb');
  const sanitizeFn = typeof window.sanitize === 'function' ? window.sanitize : s => s;
  fb.innerHTML = sanitizeFn('<strong>' + (ok ? '✓ Correct!' : '✗ Incorrect') + '</strong>' + (explanation ? ' — ' + explanation : ''));
}

export function examSkip() {
  _examAnswers[_examIdx] = { selected: -1, correct: false, skipped: true };
  _examStreakCur = 0;
  examNext();
}

export function examNext() {
  if (_examAnswers[_examIdx] === null) return;
  if (_examIdx < _examQuestions.length - 1) {
    _examIdx++;
    const card = document.getElementById('exam-q-card');
    card.style.animation = 'none';
    requestAnimationFrame(() => { card.style.animation = ''; });
    _examRenderQuestion();
  } else {
    _examFinish();
  }
}

// ── Timer ──────────────────────────────────────────────────────────────────

function _examStartTimer() {
  document.getElementById('exam-timer-display').style.display = 'flex';
  _examTimerHandle = setInterval(() => {
    _examTimerSec--;
    const m  = String(Math.floor(_examTimerSec / 60)).padStart(2, '0');
    const s  = String(_examTimerSec % 60).padStart(2, '0');
    const el = document.getElementById('exam-timer-text');
    if (el) el.textContent = m + ':' + s;
    if (_examTimerSec <= 60) document.getElementById('exam-timer-display')?.classList.add('warn');
    if (_examTimerSec <= 0) { clearInterval(_examTimerHandle); _examFinish(); }
  }, 1000);
}

// ── Finish + results ───────────────────────────────────────────────────────

function _examFinish() {
  clearInterval(_examTimerHandle);
  const elapsed = Math.round((Date.now() - _examStartTime) / 1000);
  const correct = _examAnswers.filter(a => a && a.correct).length;
  const total   = _examQuestions.length;
  const pct     = Math.round(correct / total * 100);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const ring = document.getElementById('score-ring');
  ring.textContent = pct + '%';
  ring.className   = 'exam-score-ring ' + (pct >= 60 ? 'pass' : 'fail');
  document.getElementById('results-topic-title').textContent = _examTopic;
  document.getElementById('results-headline').textContent =
    pct === 100 ? '🏆 Perfect Score!' : pct >= 80 ? '🎉 Excellent work!' : pct >= 60 ? '✓ Passing grade!' : '📚 Keep studying!';
  document.getElementById('results-subline').textContent =
    pct >= 60 ? 'Review the answers below to reinforce what you learned.' : 'Study the explanations and try again — you\'ve got this.';
  document.getElementById('stat-correct').textContent    = correct;
  document.getElementById('stat-wrong').textContent      = total - correct;
  document.getElementById('stat-time-taken').textContent = mm + ':' + ss;
  document.getElementById('stat-streak').textContent     = _examStreakBest;

  _renderReviewList();

  // Save snapshot
  const snapId = Date.now();
  const recent = JSON.parse(localStorage.getItem('exam_recent') || '[]');
  recent.unshift({ id: snapId, topic: _examTopic, score: pct, date: new Date().toLocaleDateString(), count: total, correct, type: _examType, diff: _examDiff, timeTaken: mm + ':' + ss });
  const trimmed = recent.slice(0, 5);
  localStorage.setItem('exam_recent', JSON.stringify(trimmed));
  localStorage.setItem('exam_snap_' + snapId, JSON.stringify({ questions: _examQuestions, answers: _examAnswers, topic: _examTopic, type: _examType, diff: _examDiff }));
  trimmed.forEach((r, i) => { if (i >= 5 && r.id) localStorage.removeItem('exam_snap_' + r.id); });

  _examLoadRecent();
  _examShow('exam-results');
}

function _renderReviewList() {
  const reviewEl = document.getElementById('exam-review-list');
  if (!reviewEl) return;
  const letters = ['A', 'B', 'C', 'D', 'E'];
  reviewEl.innerHTML = _examQuestions.map((q, i) => {
    const ans  = _examAnswers[i];
    const ok   = ans && ans.correct;
    const skip = ans && ans.skipped;
    const isTF = q.options && q.options.length === 2;

    let chosenDisplay = 'Skipped';
    if (!skip && ans && ans.selected >= 0) {
      const letter = isTF ? (ans.selected === 0 ? 'T' : 'F') : letters[ans.selected];
      const text   = q.options[ans.selected].replace(/^[A-DF]\.\s*/, '');
      chosenDisplay = letter + '. ' + text;
    }

    const correctLetter  = (q.answer || '').replace(/^([A-DF])\..*/, '$1').trim();
    const correctOpt     = q.options?.find(o => o.trim().toUpperCase().startsWith(correctLetter + '.') || o.trim().toUpperCase().startsWith(correctLetter + ' '));
    const correctText    = correctOpt ? correctOpt.replace(/^[A-DF]\.\s*/, '') : q.answer;
    const correctDisplay = correctLetter + '. ' + correctText;
    const border         = ok ? 'border-color:rgba(45,212,191,0.3)' : 'border-color:rgba(248,113,113,0.2)';

    return '<div class="exam-review-item" style="' + border + '">' +
      '<div class="exam-review-q">' + (i + 1) + '. ' + q.q + '</div>' +
      '<div class="exam-review-answer">' +
        '<span class="exam-review-label">Your answer:</span> <span class="exam-review-val ' + (ok ? 'c' : 'w') + '">' + (skip ? 'Skipped' : chosenDisplay) + '</span>' +
        (!ok ? '<span class="exam-review-label" style="margin-left:8px;">Correct:</span> <span class="exam-review-val c">' + correctDisplay + '</span>' : '') +
      '</div>' +
      (q.explanation ? '<div class="exam-review-explanation">' + q.explanation + '</div>' : '') +
      '</div>';
  }).join('');
}

// ── Recent-exam sidebar ────────────────────────────────────────────────────

function _examLoadRecent() {
  const list = document.getElementById('exam-recent-list');
  if (!list) return;
  const recent = JSON.parse(localStorage.getItem('exam_recent') || '[]');
  if (!recent.length) {
    list.innerHTML = '<div style="padding:8px 12px;font-size:11px;color:var(--text-4);">No exams yet</div>';
    return;
  }
  list.innerHTML = recent.slice(0, 5).map(r => {
    const scoreColor = r.score >= 60 ? 'var(--teal)' : '#f87171';
    const countLabel = r.count ? '(' + String(r.count).padStart(2, '0') + ') ' : '';
    return '<div style="padding:5px 12px;font-size:11px;color:var(--text-3);display:flex;justify-content:space-between;gap:8px;cursor:pointer;border-radius:var(--r-sm);" ' +
      'onmouseenter="this.style.background=\'var(--surface-2)\'" onmouseleave="this.style.background=\'transparent\'" ' +
      'onclick="_examLoadSnap(\'' + r.id + '\')">' +
      '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;"><span style="color:var(--text-4);">' + countLabel + '</span>' + r.topic + '</span>' +
      '<span style="flex-shrink:0;color:' + scoreColor + ';">' + r.score + '%</span>' +
      '</div>';
  }).join('');
}

function _examShowResults() {
  const correct = _examAnswers.filter(a => a && a.correct).length;
  const total   = _examQuestions.length;
  const pct     = Math.round(correct / total * 100);
  const ring    = document.getElementById('score-ring');
  if (ring) { ring.textContent = pct + '%'; ring.className = 'exam-score-ring ' + (pct >= 60 ? 'pass' : 'fail'); }
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('results-topic-title', _examTopic);
  set('results-headline',    pct === 100 ? '🏆 Perfect Score!' : pct >= 80 ? '🎉 Excellent work!' : pct >= 60 ? '✓ Passing grade!' : '📚 Keep studying!');
  set('results-subline',     pct >= 60 ? 'Review the answers below to reinforce what you learned.' : 'Study the explanations and try again — you\'ve got this.');
  set('stat-correct',        correct);
  set('stat-wrong',          total - correct);
  set('stat-time-taken',     '--:--');
  set('stat-streak',         _examStreakBest);
  _renderReviewList();
  _examShow('exam-results');
}

function _examLoadSnap(id) {
  if (!id) return;
  const raw = localStorage.getItem('exam_snap_' + id);
  if (!raw) {
    const recent = JSON.parse(localStorage.getItem('exam_recent') || '[]');
    const entry  = recent.find(r => String(r.id) === String(id));
    if (entry) document.getElementById('exam-topic-input').value = entry.topic;
    _examShow('exam-setup');
    return;
  }
  try {
    const snap      = JSON.parse(raw);
    _examQuestions  = snap.questions;
    _examAnswers    = snap.answers;
    _examTopic      = snap.topic;
    _examType       = snap.type || 'mcq';
    _examDiff       = snap.diff || 'medium';
    _examStreakBest = 0;
    _examStreakCur  = 0;
    _examShowResults();
  } catch {
    _examShow('exam-setup');
  }
}

// ── Retry / new topic / abort ──────────────────────────────────────────────

export function examRetry() {
  const topicEl = document.getElementById('exam-topic-input');
  if (topicEl) topicEl.value = _examTopic;
  document.querySelectorAll('#exam-type-grid .exam-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === _examType);
  });
  document.querySelectorAll('[data-diff]').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === _examDiff);
  });
  examStart();
}

export function examNewTopic() {
  document.getElementById('exam-topic-input').value = '';
  _examShow('exam-setup');
}

export function examAbort() {
  clearInterval(_examTimerHandle);
  _examShow('exam-setup');
}

// ── Sidebar init hook (called by navigation.js) ────────────────────────────

export function initExamSidebar() {
  _examLoadRecent();
}

// ── Expose everything on window ────────────────────────────────────────────

window.examSrcTab          = examSrcTab;
window.examDragOver        = examDragOver;
window.examDragLeave       = examDragLeave;
window.examDrop            = examDrop;
window.examHandlePdfFile   = examHandlePdfFile;
window.examClearSource     = examClearSource;
window.examClearNotes      = examClearNotes;
window.examSelectType      = examSelectType;
window.examSelectDiff      = examSelectDiff;
window.examSelectScanMode  = examSelectScanMode;
window.examStart           = examStart;
window.examSkip            = examSkip;
window.examNext            = examNext;
window.examRetry           = examRetry;
window.examNewTopic        = examNewTopic;
window.examAbort           = examAbort;
window.initExamSidebar     = initExamSidebar;
// Private helpers referenced from inline HTML or other screens
window._examLoadSnap       = _examLoadSnap;
window._examLoadRecent     = _examLoadRecent;

// ── Boot ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Wire up notes textarea
  const notesEl = document.getElementById('exam-notes-input');
  if (notesEl) {
    notesEl.addEventListener('input', () => {
      const len = notesEl.value.length;
      document.getElementById('exam-notes-count').textContent = len.toLocaleString() + ' chars';
      _examSourceText  = notesEl.value.slice(0, 60000);
      _examSourceLabel = 'your notes';
      _examToggleScanMode(len > 0);
    });
  }
  _examLoadRecent();
});
