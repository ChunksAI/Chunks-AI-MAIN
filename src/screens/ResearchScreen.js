/**
 * src/screens/ResearchScreen.js — Research screen
 *
 * Owns all JavaScript for the Research / Paper Builder screen:
 *   - State engine (RS object, _save, _load, _layer, _blankState)
 *   - Setup form binding and research start (outline generation)
 *   - Show/restore research view
 *   - Outline tree rendering with drag-and-drop reordering
 *   - Layer editor: steps, contenteditable para, word count, autosave
 *   - Paragraph generation (SSE streaming + /ask fallback)
 *   - Accept / undo / clear / history
 *   - Sources panel (current layer + previous layers)
 *   - Paper search (via /ask endpoint → AI-generated JSON paper array)
 *   - Full paper renderer (all accepted layers assembled)
 *   - References panel (APA-style, copy-all)
 *   - PDF export (jsPDF)
 *   - Tab switching (Write / Search Papers / Full Paper)
 *   - Stats bar, search chips, milestone overlay, autosave indicator
 *
 * All functions are exposed on `window.*` so the monolith's HTML event
 * attributes and navigation.js hooks continue to work without modification.
 *
 * The static HTML (`#screen-research`) remains in index.html until Task 38.
 *
 * Task 28 — extracted from monolith lines 6695–8995
 */

// ── Constants ──────────────────────────────────────────────────────────────

const LS_KEY = 'chunks_research_v1';

const S2_API    = 'https://api.semanticscholar.org/graph/v1/paper/search';
const S2_FIELDS = 'title,authors,year,journal,externalIds,abstract,citationCount,openAccessPdf';

// ── Default outline structure (17 layers total) ────────────────────────────

const DEFAULT_OUTLINE = [
  { id: 'intro',   num: 'I',   title: 'Introduction',                open: true,
    layers: [
      { id: 'intro-bg',      name: 'Background of the Study' },
      { id: 'intro-global',  name: 'Global Problem'          },
      { id: 'intro-local',   name: 'Local Problem'           },
      { id: 'intro-gap',     name: 'Research Gap'            },
      { id: 'intro-purpose', name: 'Purpose of the Study'    },
    ]
  },
  { id: 'rrl',    num: 'II',  title: 'Review of Related Literature', open: false,
    layers: [
      { id: 'rrl-theory',   name: 'Theoretical Framework'    },
      { id: 'rrl-global',   name: 'Related Studies (Global)' },
      { id: 'rrl-local',    name: 'Related Studies (Local)'  },
    ]
  },
  { id: 'method', num: 'III', title: 'Methodology',                  open: false,
    layers: [
      { id: 'method-design',   name: 'Research Design'          },
      { id: 'method-sample',   name: 'Participants & Sampling'  },
      { id: 'method-collect',  name: 'Data Collection'          },
      { id: 'method-analysis', name: 'Data Analysis'            },
    ]
  },
  { id: 'results', num: 'IV', title: 'Results & Discussion',         open: false,
    layers: [
      { id: 'results-findings', name: 'Key Findings'   },
      { id: 'results-interp',   name: 'Interpretation' },
      { id: 'results-impl',     name: 'Implications'   },
    ]
  },
  { id: 'conclusion', num: 'V', title: 'Conclusion',                 open: false,
    layers: [
      { id: 'conc-summary', name: 'Summary'         },
      { id: 'conc-rec',     name: 'Recommendations' },
    ]
  },
];

// ── Word targets per layer ─────────────────────────────────────────────────

const WORD_TARGETS = {
  'Background of the Study': 220, 'Global Problem': 180, 'Local Problem': 180,
  'Research Gap': 160, 'Purpose of the Study': 150, 'Theoretical Framework': 200,
  'Related Studies (Global)': 220, 'Related Studies (Local)': 200,
  'Research Design': 180, 'Participants & Sampling': 170, 'Data Collection': 170,
  'Data Analysis': 160, 'Key Findings': 200, 'Interpretation': 180,
  'Implications': 160, 'Summary': 150, 'Recommendations': 150,
};

const LAYER_CHECKLISTS = {
  'Background of the Study': ['Introduce the broad topic clearly','Explain why it matters at a global scale','Give 2–3 recent statistics or facts','Cite at least 2 academic sources','End with a transition toward the problem'],
  'Global Problem': ['State the problem with data/statistics','Reference global studies (2018–present)','Show scale: how many people/countries affected?','Cite at least 2 international sources'],
  'Local Problem': ['Narrow from global to local context','Use Philippine or regional statistics','Reference local studies or government reports','Show how the global problem exists locally'],
  'Research Gap': ['State what existing studies have NOT addressed','Use phrases like "however", "despite this", "limited studies"','Reference at least 1–2 studies that fall short','Connect the gap directly to your study'],
  'Purpose of the Study': ['Use action verbs: determine, explore, examine, assess','State the specific objectives (1–3 items)','Mention who benefits from this research','Keep it concise — 1 paragraph maximum'],
  'Theoretical Framework': ['Name the theory/model and its author','Explain the core idea in 2–3 sentences','Show how it relates to your research problem','Cite the original source of the theory'],
  'Related Studies (Global)': ['Group studies by theme, not by author','Compare and contrast different findings','Use synthesis: "Similarly…", "In contrast…"','Cite at least 3 international studies'],
  'Related Studies (Local)': ['Focus on Philippine or regional studies','Note similarities and gaps vs global studies','Use recent studies (within 10 years preferred)','At least 2–3 local sources required'],
  'Research Design': ['Name the design (descriptive, correlational, etc.)','Justify WHY this design fits your questions','Mention quantitative/qualitative/mixed','Reference a methodologist who defines this design'],
  'Participants & Sampling': ['State who your participants are (age, school, role)','Give the exact number or target sample size','Name the sampling technique (purposive, random, etc.)','Justify why this sampling method is appropriate'],
  'Data Collection': ['Name your instrument (survey, interview, test)','State who validated it (if applicable)','Describe the procedure step by step','Note any ethical considerations (consent, etc.)'],
  'Data Analysis': ['Name the statistical test(s) you will use','Match the test to your research design','If qualitative: state your analysis approach (thematic, etc.)','Mention the software used (SPSS, R, NVivo, etc.)'],
  'Key Findings': ['Present results in order of importance','Use specific numbers and percentages','Reference your data tables/figures if applicable','Answer each research objective directly'],
  'Interpretation': ['Explain what each finding MEANS','Connect findings back to your theoretical framework','Compare with previous studies (agree/disagree)','Use hedging language where appropriate'],
  'Implications': ['Practical: what should teachers/policymakers do?','Theoretical: how does this extend the literature?','Who are the specific beneficiaries?','Be concrete — avoid vague statements'],
  'Summary': ['Restate purpose in 1–2 sentences','Summarize methodology briefly','Highlight 2–3 key findings','Do NOT introduce new information here'],
  'Recommendations': ['Give specific, actionable recommendations','Target different stakeholders (teachers, admin, future researchers)','Suggest at least 1 area for future research','Connect each recommendation to a finding'],
};

// ── State ──────────────────────────────────────────────────────────────────

function _blankState() {
  return {
    title:    '',
    problem:  '',
    field:    '',
    type:     'Quantitative Research',
    started:  false,
    activeLayerId: 'intro-bg',
    layers:  {},
    outline: DEFAULT_OUTLINE,
  };
}

let RS = _blankState();
let _stageTimerHandle = null;

// ── Persist ────────────────────────────────────────────────────────────────

export function _save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(RS));
    _flashAutosave();
  } catch (e) { console.warn('Save failed', e); }
}

export function _load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      RS = Object.assign(_blankState(), parsed);
      if (!RS.outline || RS.outline.length !== DEFAULT_OUTLINE.length) {
        RS.outline = DEFAULT_OUTLINE;
      }
    }
  } catch (e) {
    console.warn('Load failed, using blank state', e);
    RS = _blankState();
  }
}

export function _layer(id) {
  if (!RS.layers[id]) {
    RS.layers[id] = { status: 'pending', paragraph: '', sources: [], isEdited: false, history: [] };
  }
  return RS.layers[id];
}

// ── Autosave flash indicator ───────────────────────────────────────────────

let _saveTimer = null;
function _flashAutosave() {
  const el = document.getElementById('autosave-indicator');
  if (!el) return;
  el.style.opacity = '1';
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

// ── Setup form ─────────────────────────────────────────────────────────────

export function _bindSetupForm() {
  const fields = [
    ['research-title-input',   'title'],
    ['research-problem-input', 'problem'],
    ['research-field-input',   'field'],
    ['research-type-input',    'type'],
  ];
  fields.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = RS[key] || '';
    el.addEventListener('input',  () => { RS[key] = el.value; _save(); });
    el.addEventListener('change', () => { RS[key] = el.value; _save(); });
  });
}

// ── Research start (outline generation) ───────────────────────────────────

export async function _researchStart() {
  const title   = document.getElementById('research-title-input')?.value.trim();
  const problem = document.getElementById('research-problem-input')?.value.trim() || '';
  const field   = document.getElementById('research-field-input')?.value.trim() || '';
  const type    = document.getElementById('research-type-input')?.value || 'Quantitative Research';

  if (!title) {
    const inp = document.getElementById('research-title-input');
    inp?.focus();
    inp.style.borderColor = 'var(--red)';
    inp.style.boxShadow   = '0 0 0 2px rgba(248,113,113,0.15)';
    setTimeout(() => { inp.style.borderColor = ''; inp.style.boxShadow = ''; }, 1800);
    return;
  }

  RS.title   = title;
  RS.problem = problem;
  RS.field   = field;
  RS.type    = type;

  const btn      = document.getElementById('generate-outline-btn');
  const btnText  = document.getElementById('generate-outline-btn-text');
  const progress = document.getElementById('outline-gen-progress');
  const statusEl = document.getElementById('gen-status-text');
  const barEl    = document.getElementById('gen-progress-bar');
  const preview  = document.getElementById('gen-outline-preview');

  btn.disabled      = true;
  btn.style.opacity = '0.6';
  progress.style.display = 'block';

  const stages = [
    { pct: 15, text: 'Analyzing your research topic…' },
    { pct: 35, text: 'Identifying key sections for ' + type + '…' },
    { pct: 55, text: 'Generating layers and sub-topics…' },
    { pct: 75, text: 'Structuring your research outline…' },
    { pct: 90, text: 'Almost ready…' },
  ];
  let stageIdx = 0;
  if (_stageTimerHandle) { clearInterval(_stageTimerHandle); _stageTimerHandle = null; }
  _stageTimerHandle = setInterval(() => {
    if (stageIdx >= stages.length) return;
    const s = stages[stageIdx++];
    statusEl.textContent   = s.text;
    barEl.style.width      = s.pct + '%';
  }, 800);

  try {
    const prompt = `Generate a structured research paper outline as raw JSON only. No explanation, no markdown, no backticks — just the JSON array.\n\nResearch Title: ${title}\nResearch Problem/Objective: ${problem || '(not specified)'}\nField/Discipline: ${field || '(not specified)'}\nPaper Type: ${type}\n\nReturn ONLY a JSON array like this:\n[\n  {\n    "id": "intro",\n    "title": "Introduction",\n    "layers": [\n      { "id": "intro_background", "name": "Background of the Study" },\n      { "id": "intro_global", "name": "Global Problem" }\n    ]\n  }\n]\n\nRules:\n- 4 to 6 sections appropriate for ${type}\n- Each section has 2 to 5 layers (sub-sections)\n- IDs are unique snake_case strings\n- Layer names are specific and academic (e.g. "Background of the Study", "Research Gap", "Theoretical Framework")\n- Tailor sections and layers to the field and topic provided\n- For Quantitative Research: Introduction, Review of Related Literature, Methodology, Results and Discussion, Conclusion\n- For Qualitative Research: Introduction, Literature Review, Research Design, Findings and Analysis, Conclusion\n- For Literature Review: Introduction, Scope and Coverage, Thematic Analysis, Synthesis, Conclusion\n- For Case Study: Introduction, Background of Case, Analysis, Discussion, Conclusion\n- For Mixed Methods: Introduction, Literature Review, Quantitative Methods, Qualitative Methods, Integrated Findings, Conclusion\n- Output ONLY the JSON array — nothing before or after it`;

    const response = await fetch(window.API_BASE + '/ask', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ question: prompt, mode: 'study', complexity: 7, bookId: 'none', history: [] }),
    });
    if (!response.ok) throw new Error('API error: ' + response.status);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Backend returned failure');
    const raw = (data.answer || '').trim();

    const parsed = _extractJsonArray(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid outline structure');

    clearInterval(_stageTimerHandle); _stageTimerHandle = null;
    barEl.style.width    = '100%';
    statusEl.textContent = '✓ Outline generated!';

    preview.style.display = 'block';
    preview.innerHTML = parsed.map((sec, i) => {
      const roman = ['I','II','III','IV','V','VI','VII','VIII'][i] || (i + 1);
      return `<span style="color:var(--text-1);font-weight:600;">${roman}. ${sec.title}</span>\n` +
        sec.layers.map(l => `  · ${l.name}`).join('\n');
    }).join('\n\n');

    RS.outline = parsed.map((sec, i) => ({
      id:     sec.id || 'section_' + i,
      num:    ['I','II','III','IV','V','VI','VII','VIII'][i] || String(i + 1),
      title:  sec.title,
      open:   i === 0,
      layers: (sec.layers || []).map(l => ({
        id:   l.id || sec.id + '_' + l.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/__+/g, '_'),
        name: l.name,
      })),
    }));

    const firstLayer = RS.outline[0]?.layers[0];
    if (firstLayer) {
      RS.activeLayerId = firstLayer.id;
      _layer(firstLayer.id).status = 'active';
    }
    RS.started = true;
    _save();
    await new Promise(r => setTimeout(r, 1200));
    _showResearchView();

  } catch (err) {
    console.error('Outline generation failed:', err);
    clearInterval(_stageTimerHandle); _stageTimerHandle = null;
    const errMsg = err?.message || String(err);
    statusEl.textContent  = '⚠ ' + errMsg;
    statusEl.style.color  = 'var(--red)';
    barEl.style.width     = '100%';
    barEl.style.background = 'var(--red)';

    RS.outline = DEFAULT_OUTLINE.map(s => ({ ...s, layers: s.layers.map(l => ({ ...l })) }));
    const firstLayer = RS.outline[0]?.layers[0];
    if (firstLayer) {
      RS.activeLayerId = firstLayer.id;
      _layer(firstLayer.id).status = 'active';
    }
    RS.started = true;
    _save();
    await new Promise(r => setTimeout(r, 1600));
    _showResearchView();
  } finally {
    btn.disabled      = false;
    btn.style.opacity = '1';
  }
}

function _extractJsonArray(str) {
  str = str.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = str.indexOf('[');
  const end   = str.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON array found in response');
  let candidate = str.slice(start, end + 1);
  candidate = candidate.replace(/,\s*([}\]])/g, '$1');
  candidate = candidate.replace(/'([^'\n]*)'/g, '"$1"');
  candidate = candidate.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  return JSON.parse(candidate);
}

export function _researchBackToSetup() {
  if (_stageTimerHandle) { clearInterval(_stageTimerHandle); _stageTimerHandle = null; }
  document.getElementById('research-view-main').style.display  = 'none';
  document.getElementById('research-setup-view').style.display = 'flex';
  document.getElementById('research-topbar').style.display     = 'none';
}

// ── Show / restore research view ───────────────────────────────────────────

export function _showResearchView() {
  document.getElementById('research-setup-view').style.display  = 'none';
  document.getElementById('research-view-main').style.display   = 'flex';
  document.getElementById('research-view-main').style.flex      = '1';
  document.getElementById('research-view-main').style.overflow  = 'hidden';
  document.getElementById('research-topbar').style.display      = 'flex';
  document.getElementById('research-paper-title').textContent   = RS.title || 'Untitled Research';
  const rmb = document.getElementById('research-mobile-badge');
  if (rmb) rmb.style.display = 'flex';
  _renderOutline();
  _renderLayerEditor(RS.activeLayerId);
  _renderSourcesPanel();
  _updateStats();
  _updateSearchChips();
}

export function _updateSearchChips() {
  const allLayers   = RS.outline.flatMap(s => s.layers);
  const activeLayer = allLayers.find(l => l.id === RS.activeLayerId);
  const field       = RS.field || '';
  const layerName   = activeLayer?.name || '';
  const titleWords  = (RS.title || '')
    .toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)
    .filter(w => w.length > 3 && !['among','between','effects','study','research','impact','role','relationship','analysis'].includes(w))
    .slice(0, 3);
  const chip1 = titleWords.join(' ') || 'academic performance students';
  const chip2 = field ? `${field.toLowerCase()} ${titleWords[0] || ''}`.trim() : (titleWords[0] || '') + ' systematic review';
  const chip3 = layerName ? layerName.toLowerCase() : titleWords.slice(1).join(' ') || 'higher education';
  [chip1, chip2, chip3].forEach((text, i) => {
    const el = document.getElementById('search-chip-' + (i + 1));
    if (el && text) el.textContent = text;
  });
}

// ── Outline tree ───────────────────────────────────────────────────────────

export function _renderOutline() {
  const container = document.querySelector('.research-outline-scroll');
  if (!container) return;
  container.innerHTML = '';

  const allLayers  = RS.outline.flatMap(s => s.layers);
  const totalLayers = allLayers.length;
  const doneLayers  = allLayers.filter(l => _layer(l.id).status === 'done').length;
  document.getElementById('outline-done-counter').textContent = `${doneLayers} / ${totalLayers} done`;

  const romanNums = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

  RS.outline.forEach((section, si) => {
    const secLayers = section.layers;
    const isOpen    = section.open;
    const secEl     = document.createElement('div');
    secEl.className = 'ro-section' + (isOpen ? ' open' : '');
    secEl.dataset.sid = section.id;

    const pips = secLayers.map(l => {
      const st = _layer(l.id).status;
      return `<div class="ro-pip${st === 'done' ? ' filled' : ''}"></div>`;
    }).join('');

    const isSecActive = secLayers.some(l => _layer(l.id).status === 'active');

    secEl.innerHTML = `
      <div class="ro-section-header${isSecActive ? ' active' : ''}" onclick="_toggleSection('${section.id}')">
        <span class="ro-section-num">${romanNums[si] || section.num}</span>
        <span>${section.title}</span>
        <div class="ro-progress">${pips}</div>
        <svg class="ro-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
      </div>
      <div class="ro-layers">
        ${secLayers.map(layer => {
          const st       = _layer(layer.id).status;
          const isActive = layer.id === RS.activeLayerId;
          const wc       = _layer(layer.id).paragraph ? _wordCount(_layer(layer.id).paragraph) : 0;
          const tgt      = _wordTarget(layer.name);
          const wcBadge  = wc > 0 ? `<span style="font-family:var(--font-mono);font-size:9px;color:${wc >= tgt ? 'var(--teal)' : 'var(--text-4)'};margin-left:auto;flex-shrink:0;">${wc}w</span>` : '';
          return `<div class="ro-layer ${st === 'done' ? 'done' : ''} ${isActive ? 'active' : ''}"
            data-lid="${layer.id}"
            data-sid="${section.id}"
            draggable="true"
            onclick="_researchSelectLayer(this,'${layer.name}','${section.title}','${layer.id}')"
            style="display:flex;align-items:center;gap:4px;"
          ><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${layer.name}</span>${wcBadge}</div>`;
        }).join('')}
      </div>`;

    container.appendChild(secEl);
  });
}

// ── Drag-and-drop (attached once to #screen-research) ─────────────────────

let _dragSrcId  = null;
let _dragSrcSid = null;

(function _initDragDrop() {
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('screen-research');
    if (!root) return;

    root.addEventListener('dragstart', e => {
      const el = e.target.closest('.ro-layer[draggable]');
      if (!el) return;
      _dragSrcId  = el.dataset.lid;
      _dragSrcSid = el.dataset.sid;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    root.addEventListener('dragend', () => {
      root.querySelectorAll('.ro-layer').forEach(l => l.classList.remove('dragging', 'drag-over'));
    });

    root.addEventListener('dragover', e => {
      const target = e.target.closest('.ro-layer[draggable]');
      if (!target) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      root.querySelectorAll('.ro-layer').forEach(l => l.classList.remove('drag-over'));
      if (target.dataset.lid !== _dragSrcId) target.classList.add('drag-over');
    });

    root.addEventListener('drop', e => {
      e.preventDefault();
      const target = e.target.closest('.ro-layer[draggable]');
      if (!target || !_dragSrcId || target.dataset.lid === _dragSrcId) return;
      const srcSec = RS.outline.find(s => s.id === _dragSrcSid);
      const dstSec = RS.outline.find(s => s.id === target.dataset.sid);
      if (!srcSec || !dstSec) return;
      const srcIdx = srcSec.layers.findIndex(l => l.id === _dragSrcId);
      const dstIdx = dstSec.layers.findIndex(l => l.id === target.dataset.lid);
      if (srcIdx === -1 || dstIdx === -1) return;
      const [moved] = srcSec.layers.splice(srcIdx, 1);
      dstSec.layers.splice(dstIdx, 0, moved);
      _save();
      _renderOutline();
      _showToast('⇅', `Moved "${moved.name}"`, 'var(--text-3)');
    });
  });
})();

export function _toggleSection(sectionId) {
  const sec = RS.outline.find(s => s.id === sectionId);
  if (sec) { sec.open = !sec.open; _save(); }
  const el = document.querySelector(`.ro-section[data-sid="${sectionId}"]`);
  if (el) el.classList.toggle('open', sec?.open);
}

// ── Layer editor ───────────────────────────────────────────────────────────

export function _researchSelectLayer(el, name, section, layerId) {
  RS.activeLayerId = layerId;
  _save();
  _renderLayerEditor(layerId);
  _renderSourcesPanel();
  document.querySelectorAll('.ro-layer').forEach(l => l.classList.remove('active'));
  el.classList.add('active');
}

export function _renderLayerEditor(layerId) {
  const allLayers = RS.outline.flatMap(s => s.layers);
  const layerObj  = allLayers.find(l => l.id === layerId);
  if (!layerObj) return;
  const sectionObj = RS.outline.find(s => s.layers.some(l => l.id === layerId));
  const ls         = _layer(layerId);

  const crumb  = document.querySelector('.layer-section-crumb');
  const title  = document.querySelector('.layer-title');
  const descEl = document.getElementById('layer-desc-text') || document.querySelector('.layer-desc');
  if (crumb)  crumb.innerHTML = `<span>${sectionObj?.title || ''}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg><span style="color:var(--gold);">${layerObj.name}</span>`;
  if (title)  title.textContent = layerObj.name;
  if (descEl) descEl.textContent = _layerHint(layerObj.name);

  const tipList   = document.getElementById('layer-tip-checklist');
  const tipTarget = document.getElementById('layer-tip-target');
  if (tipList) {
    tipList.innerHTML = _layerChecklist(layerObj.name).map(t =>
      `<div style="display:flex;align-items:flex-start;gap:6px;"><span style="color:var(--gold);flex-shrink:0;margin-top:1px;">·</span><span>${t}</span></div>`
    ).join('');
  }
  if (tipTarget) tipTarget.textContent = `Target: ~${_wordTarget(layerObj.name)} words`;

  const stepsEl = document.getElementById('layer-steps-container') || document.querySelector('.layer-steps');
  if (!stepsEl) return;
  stepsEl.innerHTML = _buildLayerSteps(layerId, layerObj, ls);
  _bindLayerStepActions(layerId);
}

function _layerHint(name) {
  const hints = {
    'Background of the Study': 'Introduce your topic broadly — what is it, why does it matter globally? Aim for 2–3 paragraphs with at least 2 recent sources.',
    'Global Problem':           'Present the problem at a worldwide scale. Use statistics and cite global studies to establish the severity of the issue.',
    'Local Problem':            'Narrow down to your country, institution, or community. Show how the global problem manifests locally with local studies.',
    'Research Gap':             'Identify what is missing in existing literature. What has not been studied yet? This justifies your paper\'s existence.',
    'Purpose of the Study':     'State clearly what your study aims to achieve. Use action verbs: "This study aims to determine, explore, examine…"',
    'Theoretical Framework':    'Present the theory or model that underpins your study. Explain how it connects to your research problem.',
    'Related Studies (Global)': 'Summarize and synthesize relevant international studies. Group by themes, not by author.',
    'Related Studies (Local)':  'Summarize local studies related to your topic. Highlight similarities and differences with global studies.',
    'Research Design':          'Describe the overall approach: quantitative, qualitative, or mixed. Justify why this design suits your research questions.',
    'Participants & Sampling':  'Describe who your participants are, how many, and how you will select them. Justify your sampling method.',
    'Data Collection':          'Describe your instruments (survey, interview, test) and procedure for gathering data.',
    'Data Analysis':            'Explain the statistical tests or qualitative methods you will use to analyze your data.',
    'Key Findings':             'Present your main results clearly. Use data, tables, or quotes to support your findings.',
    'Interpretation':           'Explain what your findings mean in context. Connect back to your theoretical framework.',
    'Implications':             'Discuss practical and theoretical implications of your findings for the field.',
    'Summary':                  'Briefly restate the purpose, methods, and key findings of your study.',
    'Recommendations':          'Suggest future research directions and practical actions based on your findings.',
  };
  return hints[name] || `Write the "${name}" section of your research paper. The AI will help you find relevant sources and generate a structured paragraph.`;
}

function _layerChecklist(name) {
  return LAYER_CHECKLISTS[name] || ['Write clearly and formally','Cite your sources using (Author, Year)','Aim for 150–200 words','Stay focused on the section topic'];
}

function _wordTarget(name) { return WORD_TARGETS[name] || 180; }

export function _toggleTip() {
  const card = document.getElementById('layer-tip-card');
  const btn  = document.getElementById('layer-tip-toggle');
  if (!card) return;
  const show = card.style.display === 'none';
  card.style.display = show ? 'block' : 'none';
  if (btn) btn.textContent = show ? 'Hide tips' : 'Show tips';
}

function _buildLayerSteps(layerId, layerObj, ls) {
  const isDone   = ls.status === 'done';
  const hasPara  = !!ls.paragraph;

  const sourcesHtml = ls.sources.length > 0
    ? ls.sources.map((s, i) => `
        <div class="paper-card selected" data-source-idx="${i}">
          <div class="paper-check"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#090900" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div class="paper-meta">
            <div class="paper-title">${_esc(s.title)}</div>
            <div class="paper-authors">${_esc(s.authors)}</div>
            <div class="paper-journal">${_esc(s.journal)} <span class="paper-year">${s.year}</span></div>
          </div>
        </div>`).join('')
    : `<div style="font-size:12px;color:var(--text-4);padding:10px 0;">No sources attached yet — go to <strong style="color:var(--text-3);">Search Papers</strong> tab to find and attach sources to this layer.</div>`;

  const editorLabel = isDone ? '✓ Accepted' : ls.isEdited ? '✎ Edited' : hasPara ? '✦ AI Generated' : '✏ Write here';
  const editorColor = isDone ? 'var(--teal)' : ls.isEdited ? 'var(--gold)' : hasPara ? 'var(--violet)' : 'var(--text-4)';
  const placeholder = ls.sources.length > 0
    ? `Start writing the "${layerObj.name}" section, or click Generate with AI below…`
    : `Start writing the "${layerObj.name}" section here…`;

  const paraHtml = `
    <div class="unified-editor" id="layer-para-${layerId}" style="border:1px solid var(--border-xs);border-radius:var(--r-sm);background:var(--surface-2);overflow:hidden;transition:border-color 0.2s;">
      <div class="editor-toolbar" style="display:flex;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid var(--border-xs);background:var(--surface-1);">
        <span style="font-size:9px;color:${editorColor};font-family:var(--font-mono);letter-spacing:0.04em;flex:1;">${editorLabel}</span>
        <span id="word-count-${layerId}" style="font-size:9px;color:var(--text-4);font-family:var(--font-mono);">${hasPara ? _wordCount(ls.paragraph) : 0} words</span>
        <span id="autosave-dot-${layerId}" style="font-size:9px;color:var(--text-4);font-family:var(--font-mono);opacity:0;transition:opacity 0.3s;margin-left:4px;">✓ saved</span>
        ${hasPara ? `<button onclick="_showHistory('${layerId}')" title="Version history" style="background:transparent;border:none;color:var(--text-4);cursor:pointer;padding:2px 5px;font-size:10px;font-family:var(--font-mono);border-radius:3px;transition:color 0.15s;" onmouseenter="this.style.color='var(--violet)'" onmouseleave="this.style.color='var(--text-4)'">⧖</button>` : ''}
        ${!isDone ? `
        <button onclick="_clearParagraph('${layerId}')" title="Clear" style="background:transparent;border:none;color:var(--text-4);cursor:pointer;padding:2px 4px;font-size:11px;line-height:1;border-radius:3px;" onmouseenter="this.style.color='var(--red)'" onmouseleave="this.style.color='var(--text-4)'">✕</button>
        ` : ''}
      </div>
      <div
        id="para-text-${layerId}"
        contenteditable="${isDone ? 'false' : 'true'}"
        spellcheck="true"
        data-placeholder="${placeholder}"
        style="min-height:120px;padding:14px 16px;font-size:13px;color:var(--text-1);line-height:1.9;outline:none;caret-color:var(--gold);white-space:pre-wrap;word-break:break-word;${isDone ? 'color:var(--text-2);' : ''}"
      >${hasPara ? ls.paragraph.replace(/<[^>]*>/g, ' ').trim() : ''}</div>
      ${!isDone ? `
      <div style="padding:4px 10px 0;background:var(--surface-1);">
        <div style="height:2px;background:var(--border-xs);border-radius:1px;overflow:hidden;">
          <div id="wc-bar-${layerId}" style="height:100%;width:0%;background:var(--gold);border-radius:1px;transition:width 0.4s;"></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:5px 10px 6px;border-top:none;background:var(--surface-1);">
        <span style="font-size:10px;color:var(--text-4);">⌘↵ accept · Tab indent</span>
        <div style="flex:1;"></div>
        ${hasPara ? `<button class="btn-sec-research" style="font-size:11px;padding:5px 12px;" onclick="_acceptLayer('${layerId}')">Accept & Continue →</button>` : ''}
      </div>` : `
      <div style="padding:6px 10px;border-top:1px solid var(--border-xs);background:var(--surface-1);display:flex;align-items:center;gap:8px;">
        <span style="font-size:10px;color:var(--teal);">✓ Accepted</span>
        <div style="flex:1;"></div>
        <button class="btn-sec-research" style="font-size:10px;padding:3px 10px;" onclick="_undoAccept('${layerId}')">↩ Undo</button>
      </div>`}
    </div>
    ${!hasPara && !isDone && ls.sources.length > 0 ? `
    <div style="margin-top:8px;padding:10px 14px;background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:var(--r-sm);display:flex;align-items:center;gap:8px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span style="font-size:11px;color:var(--gold);">${ls.sources.length} source${ls.sources.length > 1 ? 's' : ''} attached — generate or write manually above</span>
    </div>` : ''}`;

  return `
    <!-- Step 1: Sources -->
    <div class="layer-step ${isDone ? 'done-step' : 'active-step'}" id="step1-${layerId}">
      <div class="step-head">
        <div class="step-num">${isDone ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' : '1'}</div>
        <div class="step-label">Attach Academic Sources</div>
        <span class="step-badge ${isDone ? 'done' : ls.sources.length ? 'active' : 'pending'}">${ls.sources.length ? ls.sources.length + ' attached' : 'None yet'}</span>
      </div>
      <div class="step-body">
        <div class="paper-list" id="attached-sources-${layerId}">${sourcesHtml}</div>
        <div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap;">
          <button class="btn-sec-research" style="font-size:11px;" onclick="switchResearchTab('search', document.querySelectorAll('.research-tab')[1])">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:4px;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            ${ls.sources.length ? 'Add More Sources' : 'Search for Sources'}
          </button>
          ${ls.sources.length > 0 && !isDone ? `
          <button onclick="document.getElementById('step2-${layerId}').classList.add('active-step');document.getElementById('btn-generate-${layerId}')?.scrollIntoView({behavior:'smooth',block:'nearest'})" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:var(--r-pill);background:var(--gold);border:none;color:#090900;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font-body);">
            Write Paragraph
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#090900" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>` : ''}
        </div>
      </div>
    </div>

    <!-- Step 2: Paragraph -->
    <div class="layer-step ${hasPara ? (isDone ? 'done-step' : 'active-step') : (ls.sources.length > 0 && !isDone ? 'active-step' : '')}" id="step2-${layerId}">
      <div class="step-head">
        <div class="step-num">${isDone && hasPara ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' : '2'}</div>
        <div class="step-label">Write Paragraph</div>
        <span class="step-badge ${hasPara ? (isDone ? 'done' : 'active') : 'pending'}">${hasPara ? (isDone ? 'Accepted' : 'Ready') : 'Pending'}</span>
      </div>
      <div class="step-body">
        ${paraHtml}
        ${!isDone ? `
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
          ${hasPara ? `
          <div id="regen-box-${layerId}" style="display:none;flex-direction:column;gap:6px;padding:10px 12px;background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-sm);">
            <div style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);letter-spacing:0.04em;">INSTRUCTIONS FOR AI</div>
            <textarea
              id="regen-instruction-${layerId}"
              placeholder="e.g. Make it more formal, add more citations, focus on Philippine context, shorten to 150 words…"
              style="width:100%;min-height:60px;background:var(--surface-2);border:1px solid var(--border-xs);border-radius:var(--r-sm);padding:8px 10px;font-size:12px;color:var(--text-1);font-family:var(--font-body);resize:vertical;outline:none;line-height:1.6;transition:border-color 0.15s;box-sizing:border-box;"
              onfocus="this.style.borderColor='var(--gold-border)'"
              onblur="this.style.borderColor='var(--border-xs)'"
              onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();_generateParagraph('${layerId}')}"
            ></textarea>
            <div style="display:flex;gap:8px;align-items:center;">
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${['More formal','Shorter','Add more citations','More local context','Expand with examples'].map(s =>
                  `<span onclick="document.getElementById('regen-instruction-${layerId}').value='${s}'" style="font-size:10px;padding:2px 8px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-xs);color:var(--text-3);cursor:pointer;font-family:var(--font-body);">${s}</span>`
                ).join('')}
              </div>
              <div style="flex:1;"></div>
              <button onclick="document.getElementById('regen-box-${layerId}').style.display='none'" style="font-size:10px;background:transparent;border:none;color:var(--text-4);cursor:pointer;font-family:var(--font-body);">Cancel</button>
              <button class="btn-primary-research" id="btn-generate-${layerId}" onclick="_generateParagraph('${layerId}')" style="font-size:11px;padding:6px 14px;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Regenerate
              </button>
            </div>
          </div>
          <div id="regen-trigger-${layerId}" class="layer-actions">
            <button class="btn-sec-research" style="font-size:11px;" onclick="
              document.getElementById('regen-box-${layerId}').style.display='flex';
              document.getElementById('regen-trigger-${layerId}').style.display='none';
              document.getElementById('regen-instruction-${layerId}').focus();">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:4px;"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
              Regenerate with Instructions
            </button>
          </div>` : `
          <div class="layer-actions">
            <button class="btn-primary-research" id="btn-generate-${layerId}" onclick="_generateParagraph('${layerId}')">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Generate with AI
            </button>
          </div>`}
        </div>` : ''}
      </div>
    </div>

    <!-- Step 3: Review -->
    <div class="layer-step ${isDone ? 'done-step' : ''}" id="step3-${layerId}">
      <div class="step-head">
        <div class="step-num">${isDone ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' : '3'}</div>
        <div class="step-label">Review & Accept</div>
        <span class="step-badge ${isDone ? 'done' : 'pending'}">${isDone ? 'Complete' : 'Pending'}</span>
      </div>
    </div>`;
}

function _bindLayerStepActions(layerId) {
  const paraEl   = document.getElementById(`para-text-${layerId}`);
  const editorEl = document.getElementById(`layer-para-${layerId}`);
  const layerObj = RS.outline.flatMap(s => s.layers).find(l => l.id === layerId);
  if (layerObj) _layer(layerId).name = layerObj.name;

  if (paraEl && !paraEl.getAttribute('data-bound')) {
    paraEl.setAttribute('data-bound', '1');
    let saveTimer;
    let lastSaved = '';

    paraEl.addEventListener('input', () => {
      const text   = paraEl.innerText || '';
      const wc     = _wordCount(text);
      const target = _wordTarget(_layer(layerId).name || '');
      const wcEl   = document.getElementById(`word-count-${layerId}`);
      const barEl  = document.getElementById(`wc-bar-${layerId}`);
      if (wcEl) { wcEl.textContent = wc + ' words'; wcEl.style.color = wc >= target ? 'var(--teal)' : 'var(--text-4)'; }
      if (barEl) {
        const pct = Math.min(100, Math.round(wc / target * 100));
        barEl.style.width      = pct + '%';
        barEl.style.background = wc >= target ? 'var(--teal)' : 'var(--gold)';
      }
      const dot = document.getElementById(`autosave-dot-${layerId}`);
      if (dot) { dot.textContent = '…'; dot.style.opacity = '1'; dot.style.color = 'var(--text-4)'; }
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const newText = paraEl.innerText.trim();
        if (newText === lastSaved) return;
        lastSaved = newText;
        const ls = _layer(layerId);
        ls.paragraph = newText;
        ls.isEdited  = ls.paragraph !== '';
        _save();
        _updateStats();
        _renderFullPaper();
        if (dot) { dot.textContent = '✓ saved'; dot.style.color = 'var(--teal)'; dot.style.opacity = '1'; setTimeout(() => { dot.style.opacity = '0'; }, 1800); }
      }, 800);
    });

    paraEl.addEventListener('focus', () => { if (editorEl) editorEl.style.borderColor = 'var(--gold-border)'; });
    paraEl.addEventListener('blur',  () => { if (editorEl) editorEl.style.borderColor = 'var(--border-xs)'; });
    paraEl.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '    '); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); const ls = _layer(layerId); if (ls.paragraph) _acceptLayer(layerId); }
    });
    lastSaved = (paraEl.innerText || '').trim();
    if (lastSaved) {
      const wc     = _wordCount(lastSaved);
      const target = _wordTarget(layerObj?.name || '');
      const wcEl2  = document.getElementById(`word-count-${layerId}`);
      const barEl2 = document.getElementById(`wc-bar-${layerId}`);
      if (wcEl2) { wcEl2.textContent = wc + ' words'; wcEl2.style.color = wc >= target ? 'var(--teal)' : 'var(--text-4)'; }
      if (barEl2) { barEl2.style.width = Math.min(100, Math.round(wc / target * 100)) + '%'; barEl2.style.background = wc >= target ? 'var(--teal)' : 'var(--gold)'; }
    }
  }

  document.querySelectorAll(`#attached-sources-${layerId} .paper-card`).forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.sourceIdx);
      _layer(layerId).sources.splice(idx, 1);
      _save();
      _renderLayerEditor(layerId);
      _renderSourcesPanel();
      _updateStats();
    });
  });
}

// ── Paragraph generation (SSE streaming) ──────────────────────────────────

export function _generateParagraph(layerId) {
  const ls  = _layer(layerId);
  const btn = document.getElementById(`btn-generate-${layerId}`);
  if (!btn) return;

  btn.disabled  = true;
  btn.innerHTML = `<span style="display:inline-flex;gap:3px;align-items:center;"><span style="width:4px;height:4px;border-radius:50%;background:#090900;animation:blink 1s ease-in-out infinite;"></span><span style="width:4px;height:4px;border-radius:50%;background:#090900;animation:blink 1s ease-in-out 0.2s infinite;"></span><span style="width:4px;height:4px;border-radius:50%;background:#090900;animation:blink 1s ease-in-out 0.4s infinite;"></span></span> Writing…`;

  const allLayers  = RS.outline.flatMap(s => s.layers);
  const layerObj   = allLayers.find(l => l.id === layerId);
  const sectionObj = RS.outline.find(s => s.layers.some(l => l.id === layerId));

  const prevLayers = allLayers
    .filter(l => l.id !== layerId && _layer(l.id).status === 'done' && _layer(l.id).paragraph)
    .slice(-3)
    .map(l => ({ name: l.name, paragraph: _layer(l.id).paragraph.replace(/<[^>]*>/g, ' ').trim() }));

  const instrEl     = document.getElementById(`regen-instruction-${layerId}`);
  const instruction = instrEl?.value?.trim() || '';

  const payload = {
    title: RS.title, problem: RS.problem, field: RS.field, type: RS.type,
    section:   sectionObj?.title || '',
    layerName: layerObj?.name || layerId,
    sources:   ls.sources,
    prevLayers,
    instruction,
  };

  if (ls.paragraph) _pushHistory(layerId, ls.paragraph);
  ls.paragraph = '';
  ls.isEdited  = false;
  _renderLayerEditor(layerId);

  const paraEl   = document.getElementById(`para-text-${layerId}`);
  const btnAfter = document.getElementById(`btn-generate-${layerId}`);
  if (btnAfter) { btnAfter.disabled = true; btnAfter.innerHTML = `<span style="display:inline-flex;gap:3px;align-items:center;"><span style="width:4px;height:4px;border-radius:50%;background:#090900;animation:blink 1s ease-in-out infinite;"></span><span style="width:4px;height:4px;border-radius:50%;background:#090900;animation:blink 1s ease-in-out 0.2s infinite;"></span><span style="width:4px;height:4px;border-radius:50%;background:#090900;animation:blink 1s ease-in-out 0.4s infinite;"></span></span> Writing…`; }

  let streamedText = '';
  if (paraEl) {
    paraEl.contentEditable = 'false';
    paraEl.textContent     = '';
    paraEl.appendChild(Object.assign(document.createElement('span'), { className: 'stream-cursor', textContent: '▋' }));
  }

  fetch(window.API_BASE + '/api/stream-layer', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  .then(resp => {
    if (!resp.ok) throw new Error(`Stream error ${resp.status}`);
    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    function pump() {
      return reader.read().then(({ done, value }) => {
        if (done) { _onStreamDone(layerId, streamedText); return; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('event: done'))  { _onStreamDone(layerId, streamedText); reader.cancel(); return; }
          if (line.startsWith('event: error')) continue;
          if (!line.startsWith('data: '))      continue;
          try {
            const obj   = JSON.parse(line.slice(6));
            const token = obj.token || '';
            if (!token) continue;
            streamedText += token;
            if (paraEl) {
              paraEl.textContent = streamedText;
              paraEl.appendChild(Object.assign(document.createElement('span'), { className: 'stream-cursor', textContent: '▋' }));
              paraEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              const wcEl = document.getElementById(`word-count-${layerId}`);
              if (wcEl) wcEl.textContent = _wordCount(streamedText) + ' words';
            }
          } catch (_) {}
        }
        return pump();
      });
    }
    return pump();
  })
  .catch(err => {
    console.error('Stream failed, falling back to /ask:', err);
    _generateParagraphFallback(layerId, payload);
  });
}

function _onStreamDone(layerId, text) {
  const ls = _layer(layerId);
  ls.paragraph = text.trim();
  ls.isEdited  = false;
  _save();
  _renderLayerEditor(layerId);
  _renderSourcesPanel();
  _updateStats();
  _showToast('✦', 'Paragraph written!', 'var(--violet)');
  const instrEl = document.getElementById(`regen-instruction-${layerId}`);
  if (instrEl) instrEl.value = '';
}

async function _generateParagraphFallback(layerId, payload) {
  const allLayers  = RS.outline.flatMap(s => s.layers);
  const layerObj   = allLayers.find(l => l.id === layerId);
  const sectionObj = RS.outline.find(s => s.layers.some(l => l.id === layerId));
  const ls         = _layer(layerId);

  const sourceContext = ls.sources.length
    ? ls.sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.authors} (${s.year}), ${s.journal}`).join('\n')
    : '';

  const prevParagraphs = (payload.prevLayers || [])
    .map(p => `[${p.name}]:\n${p.paragraph}`).join('\n\n');

  const instrNote = payload.instruction ? `\n\nSPECIAL INSTRUCTION: ${payload.instruction}` : '';

  const prompt = `Write exactly ONE academic paragraph (150–250 words) for the "${layerObj?.name}" sub-section of Section ${sectionObj?.title || ''}.\n\nResearch title: "${RS.title}"\n${RS.problem ? 'Research problem: ' + RS.problem : ''}\n${RS.field ? 'Field: ' + RS.field : ''}\nPaper type: ${RS.type}\n\n${sourceContext ? 'Sources — cite as (Author, Year):\n' + sourceContext : 'No sources — write from general knowledge.'}\n${prevParagraphs ? '\nPrevious sections (maintain continuity, do not repeat):\n' + prevParagraphs : ''}${instrNote}\n\nOutput the paragraph text only. No heading, no label, no preamble.`;

  try {
    const resp = await fetch(window.API_BASE + '/ask', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ question: prompt, mode: 'study', complexity: 7, bookId: 'none', history: [] }),
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.error);
    let para = (data.answer || '').trim().replace(/^#{1,3}[^\n]*\n/gm, '').trim();
    ls.paragraph = para;
    ls.isEdited  = false;
    _save();
    _renderLayerEditor(layerId);
    _updateStats();
    _showToast('✦', 'Paragraph written!', 'var(--violet)');
  } catch (err) {
    const paraEl = document.getElementById(`para-text-${layerId}`);
    if (paraEl) paraEl.innerHTML = `<em style="color:var(--red);">⚠ ${_esc(err.message)}</em>`;
    const btnEl = document.getElementById(`btn-generate-${layerId}`);
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Retry'; }
  }
}

// ── Accept / undo / clear ──────────────────────────────────────────────────

export function _acceptLayer(layerId) {
  const ls = _layer(layerId);
  if (!ls.paragraph) return;
  ls.status = 'done';

  const allLayers   = RS.outline.flatMap(s => s.layers);
  const idx         = allLayers.findIndex(l => l.id === layerId);
  const acceptedName = allLayers[idx]?.name || 'Layer';
  const doneSoFar   = allLayers.filter(l => _layer(l.id).status === 'done').length;
  const total       = allLayers.length;

  let nextLayerId = null, nextLayerName = null, crossedSection = false;
  const currentSec = RS.outline.find(s => s.layers.some(l => l.id === layerId));

  for (let i = idx + 1; i < allLayers.length; i++) {
    if (_layer(allLayers[i].id).status !== 'done') {
      _layer(allLayers[i].id).status = 'active';
      nextLayerId   = allLayers[i].id;
      nextLayerName = allLayers[i].name;
      const nextSec = RS.outline.find(s => s.layers.some(l => l.id === nextLayerId));
      if (nextSec) { nextSec.open = true; crossedSection = nextSec !== currentSec; }
      RS.activeLayerId = nextLayerId;
      break;
    }
  }

  _save();
  _renderOutline();
  _renderSourcesPanel();
  _renderReferences();
  _updateStats();
  _renderFullPaper();

  const editorEl = document.getElementById('layer-steps-container');
  if (editorEl) {
    editorEl.style.transition = 'opacity 0.2s ease';
    editorEl.style.opacity    = '0';
    setTimeout(() => {
      _renderLayerEditor(RS.activeLayerId);
      editorEl.style.opacity = '1';
      const newLayerEl = document.querySelector(`[data-lid="${RS.activeLayerId}"]`);
      if (newLayerEl) {
        newLayerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        newLayerEl.style.transition = 'background 0.4s ease';
        newLayerEl.style.background = 'var(--gold-muted)';
        setTimeout(() => newLayerEl.style.background = '', 800);
      }
    }, 200);
  } else {
    _renderLayerEditor(RS.activeLayerId);
  }

  if (!nextLayerId) {
    _showMilestone('🎉', 'Paper Complete!', 'All layers accepted. Your research paper is ready.');
  } else if (doneSoFar === total - 1 && nextLayerId) {
    _showMilestone('✦', 'Almost there!', `Just ${total - doneSoFar} layer left — "${nextLayerName}"`);
  } else if (crossedSection) {
    const nextSec = RS.outline.find(s => s.layers.some(l => l.id === nextLayerId));
    _showToast('▶', `Moving to ${nextSec?.title || 'next section'}`, 'var(--violet)');
  } else {
    _showToast('✓', `"${acceptedName}" done — next: "${nextLayerName}"`, 'var(--teal)');
  }
}

export function _undoAccept(layerId) {
  _layer(layerId).status = 'active';
  RS.activeLayerId = layerId;
  _save();
  _renderOutline();
  _renderLayerEditor(layerId);
  _updateStats();
}

export function _clearParagraph(layerId) {
  const ls = _layer(layerId);
  if (ls.paragraph) _pushHistory(layerId, ls.paragraph);
  ls.paragraph = '';
  ls.isEdited  = false;
  _save();
  _renderLayerEditor(layerId);
  _updateStats();
}

// ── Milestone overlay ──────────────────────────────────────────────────────

export function _showMilestone(icon, title, message) {
  let el = document.getElementById('milestone-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'milestone-overlay';
    el.style.cssText = `position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(9,9,0,0.75);backdrop-filter:blur(6px);will-change:transform;z-index:9999;opacity:0;transition:opacity 0.3s ease;cursor:pointer;`;
    el.innerHTML = `
      <div style="text-align:center;padding:40px 56px;background:var(--surface-2);border:1px solid var(--border-md);border-radius:var(--r-lg);max-width:400px;">
        <div id="ms-icon" style="font-size:40px;margin-bottom:12px;"></div>
        <div id="ms-title" style="font-family:var(--font-head);font-size:22px;font-weight:800;color:var(--text-1);margin-bottom:8px;"></div>
        <div id="ms-msg" style="font-size:13px;color:var(--text-3);line-height:1.6;"></div>
        <div style="margin-top:20px;font-size:11px;color:var(--text-4);">click anywhere to continue</div>
      </div>`;
    el.addEventListener('click', () => _dismissMilestone());
    document.body.appendChild(el);
  }
  document.getElementById('ms-icon').textContent  = icon;
  document.getElementById('ms-title').textContent = title;
  document.getElementById('ms-msg').textContent   = message;
  requestAnimationFrame(() => el.style.opacity = '1');
  clearTimeout(el._timer);
  el._timer = setTimeout(_dismissMilestone, 3500);
}

export function _dismissMilestone() {
  const el = document.getElementById('milestone-overlay');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 300);
}

// ── Sources panel ──────────────────────────────────────────────────────────

export function _updateSourcesBanner() {
  const banner = document.getElementById('sources-ready-banner');
  const label  = document.getElementById('sources-ready-label');
  if (!banner) return;
  const count = (_layer(RS.activeLayerId).sources || []).length;
  if (count > 0) { banner.style.display = 'block'; label.textContent = `${count} source${count > 1 ? 's' : ''} attached to this layer — ready to write`; }
  else banner.style.display = 'none';
}

export function _switchCitTab(tab) {
  const srcPanel = document.getElementById('cit-panel-sources');
  const refPanel = document.getElementById('cit-panel-refs');
  const srcBtn   = document.getElementById('cit-tab-sources');
  const refBtn   = document.getElementById('cit-tab-refs');
  if (!srcPanel) return;
  if (tab === 'sources') {
    srcPanel.style.display = 'block'; refPanel.style.display = 'none';
    srcBtn.style.borderBottomColor = 'var(--gold)'; srcBtn.style.color = 'var(--text-1)';
    refBtn.style.borderBottomColor = 'transparent'; refBtn.style.color = 'var(--text-3)';
  } else {
    srcPanel.style.display = 'none'; refPanel.style.display = 'block';
    srcBtn.style.borderBottomColor = 'transparent'; srcBtn.style.color = 'var(--text-3)';
    refBtn.style.borderBottomColor = 'var(--gold)'; refBtn.style.color = 'var(--text-1)';
    _renderReferences();
  }
}

function _allUniqueSources() {
  const map = new Map();
  RS.outline.flatMap(s => s.layers).forEach(layer => {
    _layer(layer.id).sources.forEach(s => {
      if (!map.has(s.title)) map.set(s.title, { ...s, usedIn: [] });
      map.get(s.title).usedIn.push(layer.name);
    });
  });
  return [...map.values()];
}

function _citKey(source) {
  const firstAuthor = (source.authors || '').split(',')[0].trim().split(' ').pop();
  return `(${firstAuthor}, ${source.year})`;
}

export function _renderSourcesPanel() {
  const panel = document.getElementById('cit-panel-sources');
  if (!panel) return;
  panel.innerHTML = '';

  const currentLayerId = RS.activeLayerId;
  const currentSources = _layer(currentLayerId).sources;
  const allLayers      = RS.outline.flatMap(s => s.layers);
  const prevSources    = [];
  allLayers.forEach(l => {
    if (l.id !== currentLayerId && _layer(l.id).status === 'done') {
      _layer(l.id).sources.forEach(s => prevSources.push({ ...s, fromLayer: l.name }));
    }
  });

  const totalUnique = _allUniqueSources().length;
  const badge = document.getElementById('sources-count-badge');
  if (badge) badge.textContent = totalUnique;

  if (!currentSources.length && !prevSources.length) {
    panel.innerHTML = `<div style="padding:24px 8px;text-align:center;color:var(--text-4);font-size:12px;line-height:1.8;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.2" style="display:block;margin:0 auto 10px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>No sources yet.<br>Search for papers and attach them to this layer.</div>`;
    return;
  }

  if (currentSources.length) {
    panel.innerHTML += `<div style="font-size:10px;color:var(--gold);font-family:var(--font-mono);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--gold);display:inline-block;"></span>This Layer · ${currentSources.length}</div>`;
    currentSources.forEach((s, i) => {
      const key  = _citKey(s);
      const chip = document.createElement('div');
      chip.className = 'source-chip';
      chip.style.cssText += 'cursor:pointer;';
      chip.innerHTML = `
        <div class="source-chip-num">${i + 1}</div>
        <div class="source-chip-text" style="flex:1;min-width:0;">
          <div class="source-chip-title">${_esc(s.title)}</div>
          <div class="source-chip-meta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span>${_esc(s.authors.split(',')[0])} · ${s.year}</span>
            <span class="cite-tag" style="font-size:9px;">${_esc(key)}</span>
          </div>
        </div>
        <button title="Remove source" style="flex-shrink:0;background:transparent;border:none;color:var(--text-4);cursor:pointer;padding:2px 4px;font-size:12px;line-height:1;" data-remove="${i}">✕</button>`;
      chip.querySelector('[data-remove]').addEventListener('click', (e) => {
        e.stopPropagation();
        _layer(currentLayerId).sources.splice(i, 1);
        _save(); _renderSourcesPanel(); _renderLayerEditor(currentLayerId); _updateStats();
      });
      chip.addEventListener('click', () => _showSourceDetail(s));
      panel.appendChild(chip);
    });
  }

  if (prevSources.length) {
    const div = document.createElement('div');
    div.style.cssText = 'font-size:10px;color:var(--teal);font-family:var(--font-mono);letter-spacing:0.06em;text-transform:uppercase;margin:14px 0 8px;display:flex;align-items:center;gap:6px;';
    div.innerHTML = `<span style="width:5px;height:5px;border-radius:50%;background:var(--teal);display:inline-block;"></span>Previous Layers · ${prevSources.length}`;
    panel.appendChild(div);
    prevSources.forEach((s, i) => {
      const chip = document.createElement('div');
      chip.className = 'source-chip';
      chip.style.cursor = 'pointer';
      chip.innerHTML = `
        <div class="source-chip-num" style="background:rgba(45,212,191,0.1);border-color:rgba(45,212,191,0.3);color:var(--teal);">${currentSources.length + i + 1}</div>
        <div class="source-chip-text">
          <div class="source-chip-title">${_esc(s.title)}</div>
          <div class="source-chip-meta">${_esc(s.authors.split(',')[0])} · ${s.year} · <em>${_esc(s.fromLayer)}</em></div>
        </div>`;
      chip.addEventListener('click', () => _showSourceDetail(s));
      panel.appendChild(chip);
    });
  }

  if (totalUnique > 0) {
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top:14px;padding-top:10px;border-top:1px solid var(--border-xs);text-align:center;';
    footer.innerHTML = `<button onclick="_switchCitTab('refs')" style="background:transparent;border:none;color:var(--text-4);font-size:11px;cursor:pointer;font-family:var(--font-body);">View full reference list →</button>`;
    panel.appendChild(footer);
  }
}

function _showSourceDetail(s) {
  let el = document.getElementById('source-detail-popover');
  if (!el) {
    el = document.createElement('div');
    el.id = 'source-detail-popover';
    el.style.cssText = `position:fixed;z-index:9995;max-width:320px;background:var(--surface-3);border:1px solid var(--border-md);border-radius:var(--r-sm);padding:14px 16px;font-family:var(--font-body);font-size:12px;color:var(--text-2);box-shadow:0 8px 32px rgba(0,0,0,0.5);line-height:1.6;opacity:0;transform:translateY(4px);transition:opacity 0.15s,transform 0.15s;`;
    document.body.appendChild(el);
    document.addEventListener('click', (e) => { if (!el.contains(e.target)) _hideSourceDetail(); });
  }
  const key = _citKey(s);
  el.innerHTML = `
    <div style="font-weight:700;color:var(--text-1);margin-bottom:6px;line-height:1.4;">${_esc(s.title)}</div>
    <div style="color:var(--text-3);font-size:11px;margin-bottom:4px;">${_esc(s.authors)}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--teal);">${_esc(s.journal || '')}</span>
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-4);">${s.year}</span>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <span class="cite-tag" style="font-size:10px;padding:2px 7px;cursor:text;user-select:all;" title="Click to select">${_esc(key)}</span>
      <button onclick="_copyCiteKey('${key.replace(/'/g, "\\'")}',this)" style="background:var(--surface-2);border:1px solid var(--border-xs);color:var(--text-3);font-size:10px;padding:2px 8px;border-radius:var(--r-pill);cursor:pointer;font-family:var(--font-body);">Copy</button>
    </div>`;
  const panel = document.querySelector('.research-side');
  const rect  = panel ? panel.getBoundingClientRect() : { left: window.innerWidth - 340, top: 100 };
  el.style.left = (rect.left - 330) + 'px';
  el.style.top  = Math.min(rect.top + 60, window.innerHeight - 200) + 'px';
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
}

function _hideSourceDetail() {
  const el = document.getElementById('source-detail-popover');
  if (!el) return;
  el.style.opacity   = '0';
  el.style.transform = 'translateY(4px)';
}

export function _copyCiteKey(key, btn) {
  navigator.clipboard.writeText(key).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!'; btn.style.color = 'var(--teal)';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1500);
  }).catch(() => { btn.textContent = 'Failed'; setTimeout(() => btn.textContent = 'Copy', 1500); });
}

export function _renderReferences() {
  const panel = document.getElementById('cit-panel-refs');
  if (!panel) return;
  const sources = _allUniqueSources();
  if (!sources.length) { panel.innerHTML = `<div style="padding:24px 8px;text-align:center;color:var(--text-4);font-size:12px;line-height:1.8;">No sources attached yet.<br>Attach papers to your layers to build the reference list.</div>`; return; }
  sources.sort((a, b) => {
    const la = (a.authors || '').split(',')[0].trim().split(' ').pop().toLowerCase();
    const lb = (b.authors || '').split(',')[0].trim().split(' ').pop().toLowerCase();
    return la.localeCompare(lb);
  });
  let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;"><div style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);letter-spacing:0.06em;text-transform:uppercase;">${sources.length} source${sources.length !== 1 ? 's' : ''}</div><button onclick="_copyAllRefs()" style="font-size:10px;padding:3px 10px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-xs);color:var(--text-3);cursor:pointer;font-family:var(--font-body);">Copy All</button></div>`;
  sources.forEach((s, i) => {
    const key = _citKey(s);
    const apa = `${s.authors} (${s.year}). ${s.title}. ${s.journal ? s.journal + '.' : ''}`;
    html += `<div style="margin-bottom:12px;padding:10px 12px;background:var(--surface-2);border-radius:var(--r-sm);border:1px solid var(--border-xs);"><div style="display:flex;align-items:flex-start;gap:8px;"><span style="font-family:var(--font-mono);font-size:10px;color:var(--text-4);flex-shrink:0;margin-top:1px;">[${i+1}]</span><div style="flex:1;min-width:0;"><div style="font-size:11px;color:var(--text-2);line-height:1.6;">${_esc(apa)}</div><div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap;"><span class="cite-tag" style="font-size:9px;">${_esc(key)}</span><button onclick="_copyCiteKey('${key.replace(/'/g, "\\'")}',this)" style="background:transparent;border:none;color:var(--text-4);font-size:10px;cursor:pointer;font-family:var(--font-body);text-decoration:underline;">copy key</button>${s.usedIn?.length ? `<span style="font-size:9px;color:var(--text-4);">Used in: ${s.usedIn.map(n => _esc(n)).join(', ')}</span>` : ''}</div></div></div></div>`;
  });
  panel.innerHTML = (typeof sanitize === 'function' ? sanitize : s => s)(html);
}

export function _copyAllRefs() {
  const sources = _allUniqueSources();
  sources.sort((a, b) => {
    const la = (a.authors || '').split(',')[0].trim().split(' ').pop().toLowerCase();
    const lb = (b.authors || '').split(',')[0].trim().split(' ').pop().toLowerCase();
    return la.localeCompare(lb);
  });
  const text = sources.map((s, i) => `[${i+1}] ${s.authors} (${s.year}). ${s.title}. ${s.journal || ''}.`).join('\n\n');
  navigator.clipboard.writeText(text).then(() => _showToast('📋', 'References copied to clipboard', 'var(--teal)'));
}

// ── Version history ────────────────────────────────────────────────────────

function _pushHistory(layerId, text) {
  const ls = _layer(layerId);
  if (!ls.history) ls.history = [];
  if (ls.history.length && ls.history[ls.history.length - 1].text === text) return;
  ls.history.push({ text, ts: Date.now() });
  if (ls.history.length > 10) ls.history.shift();
  _save();
}

export function _showHistory(layerId) {
  const ls       = _layer(layerId);
  const versions = (ls.history || []).slice().reverse();
  if (!versions.length) { _showToast('○', 'No previous versions yet', 'var(--text-4)'); return; }
  let modal = document.getElementById('history-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'history-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9997;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div onclick="if(event.target===this)_closeHistory()" style="position:absolute;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);will-change:transform;"></div>
      <div style="position:relative;z-index:1;width:min(560px,90vw);max-height:75vh;background:var(--surface-2);border:1px solid var(--border-md);border-radius:var(--r-md);display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border-xs);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="font-family:var(--font-head);font-size:14px;font-weight:700;color:var(--text-1);">Version History</div>
          <button onclick="_closeHistory()" style="background:transparent;border:none;color:var(--text-4);cursor:pointer;font-size:16px;line-height:1;">✕</button>
        </div>
        <div id="history-list" style="flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px;"></div>
      </div>`;
    document.body.appendChild(modal);
  }
  const list = document.getElementById('history-list');
  list.innerHTML = versions.map((v, i) => {
    const d    = new Date(v.ts);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const wc   = _wordCount(v.text);
    const preview = v.text.slice(0, 160) + (v.text.length > 160 ? '…' : '');
    return `<div style="background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-sm);padding:12px 14px;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><div style="font-family:var(--font-mono);font-size:10px;color:var(--text-4);">Version ${versions.length - i} · ${date} ${time} · ${wc} words</div><button onclick="_restoreVersion('${layerId}',${versions.length - 1 - i})" style="font-size:10px;padding:2px 10px;border-radius:var(--r-pill);background:var(--gold-muted);border:1px solid var(--gold-border);color:var(--gold);cursor:pointer;font-family:var(--font-body);">Restore</button></div><div style="font-size:11px;color:var(--text-3);line-height:1.6;">${_esc(preview)}</div></div>`;
  }).join('');
  modal.style.display = 'flex';
}

export function _closeHistory() {
  const m = document.getElementById('history-modal');
  if (m) m.style.display = 'none';
}

export function _restoreVersion(layerId, historyIdx) {
  const ls = _layer(layerId);
  const v  = ls.history[historyIdx];
  if (!v) return;
  if (ls.paragraph) _pushHistory(layerId, ls.paragraph);
  ls.paragraph = v.text;
  ls.isEdited  = true;
  _save();
  _renderLayerEditor(layerId);
  _updateStats();
  _closeHistory();
  _showToast('↩', 'Version restored', 'var(--teal)');
}

// ── Stats bar ──────────────────────────────────────────────────────────────

export function _updateStats() {
  const allLayers = RS.outline.flatMap(s => s.layers);
  const total     = allLayers.length;
  const done      = allLayers.filter(l => _layer(l.id).status === 'done').length;
  const pct       = Math.round((done / total) * 100);
  const allSourceTitles = new Set();
  allLayers.forEach(l => _layer(l.id).sources.forEach(s => allSourceTitles.add(s.title)));
  let words = 0;
  allLayers.forEach(l => { if (_layer(l.id).paragraph) words += _wordCount(_layer(l.id).paragraph); });
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-sources', allSourceTitles.size);
  set('stat-layers',  done);
  set('stat-words',   words.toLocaleString());
  set('stat-pct',     pct + '%');
  set('research-progress-label', `${done} of ${total} layers complete`);
  set('outline-done-counter',    `${done} / ${total} done`);
  set('topbar-words', words.toLocaleString());
}

// ── Tab switching ──────────────────────────────────────────────────────────

export function switchResearchTab(name, clickedTab) {
  document.querySelectorAll('.research-tab').forEach(t => t.classList.remove('active'));
  clickedTab.classList.add('active');
  document.querySelectorAll('.research-tab-panel').forEach(p => { p.style.display = 'none'; });
  const target = document.getElementById('tab-' + name);
  if (target) { target.style.display = 'flex'; target.style.flex = '1'; target.style.flexDirection = 'column'; target.style.overflow = 'hidden'; }
  if (name === 'search') { setTimeout(() => document.getElementById('paper-search-input')?.focus(), 80); _updateSourcesBanner(); }
  if (name === 'paper')  _renderFullPaper();
}

// ── Paper search ───────────────────────────────────────────────────────────

let _searchAbortController = null;

export async function _runPaperSearch() {
  const query     = document.getElementById('paper-search-input')?.value?.trim();
  const container = document.getElementById('paper-search-results');
  const emptyEl   = document.getElementById('paper-search-empty');
  if (!query) return;

  if (_searchAbortController) _searchAbortController.abort();
  _searchAbortController = new AbortController();

  if (emptyEl) emptyEl.style.display = 'none';
  container.querySelectorAll('.paper-card, #paper-no-results, #paper-searching').forEach(el => el.remove());

  const loadingEl = document.createElement('div');
  loadingEl.id    = 'paper-searching';
  loadingEl.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:4px 0;';
  loadingEl.innerHTML = [1, 2, 3].map(() => `<div style="background:var(--surface-2);border:1px solid var(--border-xs);border-radius:var(--r-sm);padding:14px 16px;display:flex;flex-direction:column;gap:8px;"><div style="height:12px;width:75%;background:var(--surface-3);border-radius:4px;animation:shimmer 1.4s ease-in-out infinite;"></div><div style="height:10px;width:50%;background:var(--surface-3);border-radius:4px;animation:shimmer 1.4s ease-in-out 0.15s infinite;"></div><div style="height:10px;width:35%;background:var(--surface-3);border-radius:4px;animation:shimmer 1.4s ease-in-out 0.3s infinite;"></div></div>`).join('');
  container.appendChild(loadingEl);

  try {
    const searchPrompt = `TASK: Generate a JSON array of 10 real published academic papers.\nTOPIC: ${query}\n\nIgnore any textbook context. Output ONLY a raw JSON array — no markdown fences, no explanation, no preamble.\n\n[\n  {\n    "title": "Full exact paper title",\n    "authors": "LastName, F., LastName, F.",\n    "year": 2022,\n    "journal": "Journal Name",\n    "abstract": "What this paper studied and its key finding in 1-2 sentences.",\n    "citationCount": 87\n  }\n]\n\n- 10 papers, all real and published\n- Prefer 2015–2024, mix of foundational and recent\n- citationCount: realistic ballpark number\n- Start your response with [ and end with ] — nothing else`;

    const resp = await fetch(window.API_BASE + '/ask', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  _searchAbortController.signal,
      body:    JSON.stringify({ question: searchPrompt, mode: 'study', complexity: 5, bookId: 'none', web_search: false, history: [] }),
    });
    if (!resp.ok) throw new Error(`Backend error ${resp.status}`);
    const backendData = await resp.json();
    if (!backendData.success) throw new Error(backendData.error || 'Search failed');
    const raw = (backendData.answer || '').trim();

    const parsedPapers = _extractJsonArray(raw);
    const papers = parsedPapers.filter(p => p.title && p.authors);
    loadingEl.remove();

    if (!papers.length) {
      const msg = document.createElement('div');
      msg.id = 'paper-no-results';
      msg.style.cssText = 'padding:40px;text-align:center;color:var(--text-4);font-size:12px;line-height:1.8;';
      msg.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.2" style="display:block;margin:0 auto 10px;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>No papers found for <strong style="color:var(--text-3);">"${_esc(query)}"</strong><br><span style="font-size:11px;">Try broader keywords or different terms</span>`;
      container.appendChild(msg);
      return;
    }
    _renderPaperResults(papers, container);

  } catch (err) {
    if (err.name === 'AbortError') return;
    loadingEl.remove();
    const errEl = document.createElement('div');
    errEl.id = 'paper-no-results';
    errEl.style.cssText = 'padding:24px;text-align:center;color:var(--red);font-size:12px;';
    errEl.innerHTML = `⚠ Search failed: ${_esc(err.message)}<br><span style="color:var(--text-4);font-size:11px;">Check your connection and try again</span>`;
    container.appendChild(errEl);
  }
}

function _renderPaperResults(papers, container) {
  const allLayers      = RS.outline.flatMap(s => s.layers);
  const activeLayer    = allLayers.find(l => l.id === RS.activeLayerId);
  const activeName     = activeLayer?.name || 'current layer';
  const attachedTitles = new Set(_layer(RS.activeLayerId).sources.map(s => s.title));

  papers.forEach(p => {
    const title    = p.title || 'Untitled';
    const authors  = Array.isArray(p.authors) ? p.authors.map(a => (typeof a === 'string' ? a : a.name)).join(', ') : (p.authors || 'Unknown authors');
    const year     = p.year || '—';
    const journal  = (typeof p.journal === 'object' ? p.journal?.name : p.journal) || '';
    const cites    = p.citationCount != null ? p.citationCount : null;
    const openPdf  = p.openAccessPdf?.url || null;
    const abstract = p.abstract || '';
    const isAttached = attachedTitles.has(title);

    const card = document.createElement('div');
    card.className    = 'paper-card' + (isAttached ? ' selected' : '');
    card.dataset.title = title;
    card.innerHTML = `
      <div class="paper-check">${isAttached ? `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#090900" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}</div>
      <div class="paper-meta">
        <div class="paper-title">${_esc(title)}</div>
        <div class="paper-authors">${_esc(authors)}</div>
        <div class="paper-journal" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${journal ? `<span>${_esc(journal)}</span>` : ''}
          <span class="paper-year">${year}</span>
          ${cites != null ? `<span style="font-size:10px;color:var(--text-4);">· ${cites.toLocaleString()} citations</span>` : ''}
          ${openPdf ? `<a href="${openPdf}" target="_blank" style="font-size:10px;color:var(--teal);text-decoration:none;" onclick="event.stopPropagation()">↗ Open PDF</a>` : ''}
        </div>
        ${abstract ? `<div class="paper-abstract" style="font-size:11px;color:var(--text-4);margin-top:6px;line-height:1.6;max-height:0;overflow:hidden;transition:max-height 0.3s ease;">${_esc(abstract.slice(0, 320))}${abstract.length > 320 ? '…' : ''}</div>` : ''}
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
          <button class="attach-btn" style="font-size:11px;padding:4px 12px;border-radius:var(--r-pill);border:1px solid;cursor:pointer;font-family:var(--font-body);transition:all 0.15s;">
            ${isAttached ? '✓ Attached' : '＋ Attach to ' + _esc(activeName)}
          </button>
          ${abstract ? `<button class="abstract-toggle" style="font-size:11px;padding:4px 10px;border-radius:var(--r-pill);background:transparent;border:1px solid var(--border-xs);color:var(--text-3);cursor:pointer;font-family:var(--font-body);">Abstract</button>` : ''}
        </div>
      </div>`;

    const attachBtn = card.querySelector('.attach-btn');
    _styleAttachBtn(attachBtn, isAttached, activeName);

    attachBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ls = _layer(RS.activeLayerId);
      const alreadyIn = ls.sources.some(s => s.title === title);
      if (alreadyIn) {
        ls.sources = ls.sources.filter(s => s.title !== title);
        card.classList.remove('selected');
        card.querySelector('.paper-check').innerHTML = '';
        _styleAttachBtn(attachBtn, false, activeName);
      } else {
        ls.sources.push({ title, authors, journal: journal || '', year: parseInt(year) || year });
        card.classList.add('selected');
        card.querySelector('.paper-check').innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#090900" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        _styleAttachBtn(attachBtn, true, activeName);
        _showToast('📎', `Attached to "${activeName}"`, 'var(--gold-border)');
      }
      _save(); _renderSourcesPanel(); _renderLayerEditor(RS.activeLayerId); _updateStats();
    });

    const abstractToggle = card.querySelector('.abstract-toggle');
    if (abstractToggle) {
      abstractToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const abstractEl = card.querySelector('.paper-abstract');
        const isOpen = abstractEl.style.maxHeight !== '0px' && abstractEl.style.maxHeight !== '';
        abstractEl.style.maxHeight = isOpen ? '0' : '200px';
        abstractToggle.textContent = isOpen ? 'Abstract' : 'Hide';
      });
    }
    container.appendChild(card);
  });
}

function _styleAttachBtn(btn, attached, layerName) {
  if (attached) {
    btn.style.cssText += 'background:var(--surface-3);border-color:var(--border-xs);color:var(--text-3);';
    btn.textContent = '✓ Attached';
  } else {
    btn.style.cssText += 'background:var(--gold-muted);border-color:var(--gold-border);color:var(--gold);';
    btn.textContent = '＋ Attach to ' + layerName;
  }
}

// ── New paper / reset ──────────────────────────────────────────────────────

export function _confirmNewPaper() {
  const done = RS.outline.flatMap(s => s.layers).filter(l => _layer(l.id).status === 'done').length;
  if (done === 0 && !RS.title) { _clearAndReset(); return; }
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);will-change:transform;';
  overlay.innerHTML = `
    <div style="background:var(--surface-2);border:1px solid var(--border-md);border-radius:var(--r-lg);padding:28px 32px;max-width:380px;width:90%;text-align:center;">
      <div style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--text-1);margin-bottom:8px;">Start a New Paper?</div>
      <div style="font-size:13px;color:var(--text-3);line-height:1.6;margin-bottom:24px;">This will clear <strong style="color:var(--text-1);">${done} accepted layer${done !== 1 ? 's' : ''}</strong> and all your sources. This cannot be undone.</div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button onclick="this.closest('div[style*=fixed]').remove()" style="padding:9px 20px;border-radius:var(--r-pill);background:transparent;border:1px solid var(--border-md);color:var(--text-2);font-size:13px;cursor:pointer;font-family:var(--font-body);">Cancel</button>
        <button onclick="_clearAndReset();this.closest('div[style*=fixed]').remove()" style="padding:9px 20px;border-radius:var(--r-pill);background:var(--red);border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font-body);">Yes, Start Over</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

export function _clearAndReset() {
  localStorage.removeItem(LS_KEY);
  RS = _blankState();
  ['research-title-input','research-problem-input','research-field-input'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('research-topbar').style.display    = 'none';
  document.getElementById('research-view-main').style.display = 'none';
  document.getElementById('research-setup-view').style.display = 'flex';
  _showToast('✓', 'Paper cleared. Ready to start fresh!', 'var(--teal)');
}

// ── Manual writing handlers ────────────────────────────────────────────────

let _manualDebounce = {};
export function _onManualInput(layerId, el) {
  const text = el.innerText || '';
  const wcEl = document.getElementById('manual-wc-' + layerId);
  if (wcEl) wcEl.textContent = _wordCount(text) + ' words';
  clearTimeout(_manualDebounce[layerId]);
  _manualDebounce[layerId] = setTimeout(() => {
    _layer(layerId).paragraph = text.trim();
    _layer(layerId).isEdited  = true;
    _save();
  }, 800);
}

export function _saveManualPara(layerId) {
  const el   = document.getElementById('manual-para-' + layerId);
  const text = (el?.innerText || '').trim();
  if (!text) { _showToast('⚠', 'Write something first!', 'var(--red)'); return; }
  _layer(layerId).paragraph = text;
  _layer(layerId).isEdited  = true;
  _acceptLayer(layerId);
}

// ── Full paper renderer ────────────────────────────────────────────────────

export function _renderFullPaper() {
  const body     = document.getElementById('full-paper-body');
  const subtitle = document.getElementById('full-paper-subtitle');
  if (!body) return;

  const allLayers = RS.outline.flatMap(s => s.layers);
  const total     = allLayers.length;
  const done      = allLayers.filter(l => _layer(l.id).status === 'done').length;
  const pct       = Math.round((done / total) * 100);
  if (subtitle) subtitle.innerHTML = `All accepted layers compiled — <span style="color:var(--gold);">${pct}% complete</span>`;

  let html = `
    <div style="text-align:center;margin-bottom:36px;padding-bottom:28px;border-bottom:1px solid var(--border-xs);">
      <div style="font-family:var(--font-head);font-size:20px;font-weight:800;color:var(--text-1);line-height:1.35;margin-bottom:10px;">${_esc(RS.title || 'Untitled Research')}</div>
      <div style="font-size:12px;color:var(--text-3);">${RS.field ? _esc(RS.field) + ' &nbsp;·&nbsp; ' : ''}<span style="color:var(--text-4);">${_esc(RS.type || '')} · ${new Date().getFullYear()}</span></div>
      ${RS.problem ? `<div style="margin-top:10px;font-size:12px;color:var(--text-4);font-style:italic;max-width:500px;margin-left:auto;margin-right:auto;">${_esc(RS.problem)}</div>` : ''}
    </div>`;

  const romanNums = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

  RS.outline.forEach((section, si) => {
    const secLayers  = section.layers;
    const doneLayers = secLayers.filter(l => _layer(l.id).status === 'done');
    const hasDone    = doneLayers.length > 0;
    const roman      = romanNums[si] || (si + 1);

    if (!hasDone && si > 0) {
      html += `<div style="padding:14px 16px;background:var(--surface-1);border:1px dashed var(--border-xs);border-radius:var(--r-sm);display:flex;align-items:center;gap:10px;opacity:0.45;margin-bottom:10px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="color:var(--text-4);flex-shrink:0;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg><span style="font-size:12px;color:var(--text-4);">Section ${roman} — ${_esc(section.title)} <span style="font-family:var(--font-mono);font-size:10px;">(0 / ${secLayers.length} layers)</span></span></div>`;
      return;
    }

    html += `<div style="margin-bottom:36px;">`;
    html += `<div style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-4);margin-bottom:4px;">Section ${roman}</div><div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--text-1);margin-bottom:20px;">${_esc(section.title)}</div>`;

    secLayers.forEach(layer => {
      const ls       = _layer(layer.id);
      const isDone   = ls.status === 'done';
      const isActive = layer.id === RS.activeLayerId;

      if (isDone) {
        const paraText      = (ls.paragraph || '').replace(/<[^>]*>/g, ' ').trim();
        const paraFormatted = paraText.replace(/\(([^)]{3,60}?,\s*\d{4}[a-z]?)\)/g,
          '<span style="display:inline-block;font-size:10px;background:var(--violet-muted);color:var(--violet);border:1px solid var(--violet-border);border-radius:3px;padding:0 5px;font-family:var(--font-mono);margin:0 2px;white-space:nowrap;">[$1]</span>');
        html += `<div style="margin-bottom:20px;"><div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;"><div style="width:6px;height:6px;border-radius:50%;background:var(--teal);flex-shrink:0;"></div><span style="font-size:10px;font-family:var(--font-mono);color:var(--teal);letter-spacing:0.06em;text-transform:uppercase;">${_esc(layer.name)}</span><button class="fp-edit-btn" data-layerid="${layer.id}" style="font-size:9px;padding:1px 7px;border-radius:var(--r-pill);background:transparent;border:1px solid var(--border-xs);color:var(--text-4);cursor:pointer;font-family:var(--font-body);margin-left:4px;">edit</button></div><p style="font-size:13px;color:var(--text-2);line-height:1.9;margin:0;">${paraFormatted}</p></div>`;
      } else if (isActive) {
        const hasPara = !!ls.paragraph;
        html += `<div style="margin-bottom:20px;"><div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;"><div style="width:6px;height:6px;border-radius:50%;background:var(--gold);box-shadow:0 0 6px rgba(232,172,46,0.4);flex-shrink:0;"></div><span style="font-size:10px;font-family:var(--font-mono);color:var(--gold);letter-spacing:0.06em;text-transform:uppercase;">${_esc(layer.name)}</span><span style="font-size:9px;font-family:var(--font-mono);color:var(--gold);background:var(--gold-muted);border:1px solid var(--gold-border);padding:1px 6px;border-radius:var(--r-pill);">Current Layer</span></div>${hasPara ? `<p style="font-size:13px;color:var(--text-1);line-height:1.9;margin:0;">${_esc(ls.paragraph.replace(/<[^>]*>/g,' ').trim())}</p>` : `<div style="padding:14px 16px;background:var(--surface-1);border:1px dashed var(--gold-border);border-radius:var(--r-sm);font-size:12px;color:var(--text-4);">Not written yet — <span style="color:var(--gold);cursor:pointer;" onclick="switchResearchTab('write',document.querySelectorAll('.research-tab')[0])">write this layer →</span></div>`}</div>`;
      } else {
        html += `<div style="padding:10px 14px;background:var(--surface-1);border:1px dashed var(--border-xs);border-radius:var(--r-sm);display:flex;align-items:center;gap:8px;margin-bottom:8px;opacity:0.55;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--text-4);flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span style="font-size:12px;color:var(--text-4);">${_esc(layer.name)} — <span style="color:var(--gold);cursor:pointer;" onclick="switchResearchTab('write',document.querySelectorAll('.research-tab')[0])">write →</span></span></div>`;
      }
    });
    html += `</div>`;
  });

  // References
  const allSources = [];
  const seenTitles = new Set();
  allLayers.forEach(l => { _layer(l.id).sources.forEach(s => { if (!seenTitles.has(s.title)) { seenTitles.add(s.title); allSources.push(s); } }); });
  if (allSources.length) {
    html += `<div style="margin-top:48px;padding-top:24px;border-top:1px solid var(--border-xs);"><div style="font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--text-1);margin-bottom:16px;">References</div><div style="display:flex;flex-direction:column;gap:8px;">${allSources.map((s, i) => `<div style="font-size:12px;color:var(--text-3);line-height:1.7;padding-left:24px;text-indent:-24px;"><span style="color:var(--text-4);font-family:var(--font-mono);font-size:10px;margin-right:6px;">[${i+1}]</span>${_esc(s.authors)} (${s.year}). ${_esc(s.title)}. <em>${_esc(s.journal || '')}</em>.</div>`).join('')}</div></div>`;
  }

  body.innerHTML = html;

  body.addEventListener('click', (e) => {
    const btn = e.target.closest('.fp-edit-btn');
    if (!btn) return;
    const layerId = btn.dataset.layerid;
    if (!layerId) return;
    RS.activeLayerId = layerId;
    const sec = RS.outline.find(s => s.layers.some(l => l.id === layerId));
    if (sec) sec.open = true;
    _save();
    _renderOutline();
    _renderLayerEditor(layerId);
    _renderSourcesPanel();
    switchResearchTab('write', document.querySelectorAll('.research-tab')[0]);
    setTimeout(() => { const el = document.querySelector(`[data-lid="${layerId}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
  });
}

// ── PDF export ─────────────────────────────────────────────────────────────

export function _exportPDF() {
  const allLayers = RS.outline.flatMap(s => s.layers);
  const done      = allLayers.filter(l => _layer(l.id).status === 'done');
  if (!done.length) { _showToast('⚠', 'Accept at least one layer before exporting', 'var(--red)'); return; }

  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) { _showToast('⚠', 'PDF library not loaded yet — try again in a second', 'var(--red)'); return; }
  const jsPDF_ = (window.jspdf?.jsPDF) || window.jsPDF;
  const doc    = new jsPDF_({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw = 210, ph = 297, ml = 25.4, mr = 25.4, mt = 25.4, mb = 25.4, tw = pw - ml - mr;
  let y = mt;

  const romanNums = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

  function checkPage(needed = 8) { if (y + needed > ph - mb) { doc.addPage(); y = mt; } }
  function addText(text, opts = {}) {
    const { size = 12, bold = false, italic = false, align = 'left', color = [0,0,0], indent = 0, lineH = 7 } = opts;
    doc.setFontSize(size);
    doc.setFont('times', bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal');
    doc.setTextColor(...color);
    const x = ml + indent, maxW = tw - indent;
    const lines = doc.splitTextToSize(text, maxW);
    lines.forEach(line => { checkPage(lineH); doc.text(line, align === 'center' ? pw / 2 : x, y, { align }); y += lineH; });
    return lines.length * lineH;
  }
  function stripHtml(str) { return (str || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim(); }

  y = mt + 20;
  addText((RS.title || 'Untitled Research Paper').toUpperCase(), { size: 14, bold: true, align: 'center', lineH: 8 });
  y += 6;
  if (RS.field || RS.type) addText([RS.field, RS.type].filter(Boolean).join(' / '), { size: 10, align: 'center', color: [80,80,80] });
  addText((RS.type || '') + ' · ' + new Date().getFullYear(), { size: 9, align: 'center', color: [120,120,120] });
  if (RS.problem) { y += 4; addText(stripHtml(RS.problem), { size: 10, italic: true, align: 'center', color: [100,100,100], lineH: 6 }); }
  y += 8; doc.setDrawColor(180,180,180); doc.setLineWidth(0.4); doc.line(ml, y, pw - mr, y); y += 10;

  RS.outline.forEach((section, si) => {
    const doneLayers = section.layers.filter(l => _layer(l.id).status === 'done');
    if (!doneLayers.length) return;
    checkPage(16);
    addText(`${romanNums[si] || si + 1}. ${section.title.toUpperCase()}`, { size: 12, bold: true, lineH: 7 });
    y += 2; doc.setDrawColor(200,200,200); doc.setLineWidth(0.3); doc.line(ml, y, pw - mr, y); y += 6;
    section.layers.forEach(layer => {
      const ls = _layer(layer.id);
      if (ls.status !== 'done' || !ls.paragraph) return;
      const paraText = stripHtml(ls.paragraph);
      if (!paraText) return;
      checkPage(14);
      addText(layer.name, { size: 11, bold: true, italic: true, lineH: 6 });
      y += 2;
      addText(paraText, { size: 11, indent: 12.7, lineH: 6.5 });
      y += 5;
    });
    y += 4;
  });

  const allSources2 = []; const seenTitles2 = new Set();
  allLayers.forEach(l => { _layer(l.id).sources.forEach(s => { if (!seenTitles2.has(s.title)) { seenTitles2.add(s.title); allSources2.push(s); } }); });
  if (allSources2.length) {
    checkPage(20); doc.setDrawColor(180,180,180); doc.setLineWidth(0.4); doc.line(ml, y, pw - mr, y); y += 8;
    addText('REFERENCES', { size: 12, bold: true, lineH: 7 }); y += 4;
    allSources2.forEach(s => {
      const ref = `${s.authors} (${s.year}). ${s.title}. ${s.journal || ''}.`;
      checkPage(10); doc.setFontSize(10); doc.setFont('times', 'normal'); doc.setTextColor(0, 0, 0);
      const lines = doc.splitTextToSize(ref, tw - 12.7);
      lines.forEach((line, li) => { checkPage(6); doc.text(line, li === 0 ? ml : ml + 12.7, y); y += 5.5; });
      y += 2;
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p); doc.setFontSize(9); doc.setFont('times', 'normal'); doc.setTextColor(150,150,150);
    doc.text(`${p} / ${totalPages}`, pw / 2, ph - 12, { align: 'center' });
    if (p > 1) { doc.text((RS.title || '').slice(0, 60), pw / 2, 12, { align: 'center' }); doc.setDrawColor(200,200,200); doc.setLineWidth(0.2); doc.line(ml, 14, pw - mr, 14); }
  }

  const filename = (RS.title || 'research-paper').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) + '.pdf';
  doc.save(filename);
  _showToast('⬇', 'PDF downloaded!', 'var(--teal)');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _wordCount(str) {
  return (str || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

function _showToast(icon, message, color) {
  // Delegates to global _showToast if available (set by Toast.js, Task 20)
  if (typeof window._showToast === 'function') {
    window._showToast(icon, message, color);
  }
}

export function _renderRecentList() {
  if (typeof window._renderAllRecent === 'function') window._renderAllRecent();
}

// ── Expose everything on window ────────────────────────────────────────────

window._save                = _save;
window._load                = _load;
window._layer               = _layer;
window.RS_getter            = () => RS;  // for debugging — RS is module-private
window._blankState          = _blankState;
window._bindSetupForm       = _bindSetupForm;
window._researchStart       = _researchStart;
window._researchBackToSetup = _researchBackToSetup;
window._showResearchView    = _showResearchView;
window._updateSearchChips   = _updateSearchChips;
window._renderOutline       = _renderOutline;
window._toggleSection       = _toggleSection;
window._researchSelectLayer = _researchSelectLayer;
window._renderLayerEditor   = _renderLayerEditor;
window._toggleTip           = _toggleTip;
window._generateParagraph   = _generateParagraph;
window._acceptLayer         = _acceptLayer;
window._undoAccept          = _undoAccept;
window._clearParagraph      = _clearParagraph;
window._showMilestone       = _showMilestone;
window._dismissMilestone    = _dismissMilestone;
window._updateSourcesBanner = _updateSourcesBanner;
window._switchCitTab        = _switchCitTab;
window._renderSourcesPanel  = _renderSourcesPanel;
window._copyCiteKey         = _copyCiteKey;
window._renderReferences    = _renderReferences;
window._copyAllRefs         = _copyAllRefs;
window._showHistory         = _showHistory;
window._closeHistory        = _closeHistory;
window._restoreVersion      = _restoreVersion;
window._updateStats         = _updateStats;
window.switchResearchTab    = switchResearchTab;
window._runPaperSearch      = _runPaperSearch;
window._confirmNewPaper     = _confirmNewPaper;
window._clearAndReset       = _clearAndReset;
window._onManualInput       = _onManualInput;
window._saveManualPara      = _saveManualPara;
window._renderFullPaper     = _renderFullPaper;
window._exportPDF           = _exportPDF;
window._renderRecentList    = _renderRecentList;

// ── Boot ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  _load();
  _bindSetupForm();
  _renderRecentList();
  if (RS.started) _showResearchView();
});
