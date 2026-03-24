/**
 * src/state/studyplan/explain.js — AI explain drawer + stream + drawer tabs
 */

import { sp } from './state.js';
import { $el, $qsa, hide, show, setText, setHtml, addClass, removeClass } from '../domHelpers.js';
import { API_BASE, _getAuthHeader } from '../../lib/api.js';
import { _aiParams } from './generation.js';
import { spMasteryRecord } from './mastery.js';
import { isGuest, showLoginWall } from '../../lib/guestLimits.js';

export function spOpenExplainDrawer(concept, startTab) {
  const drawer   = $el('sp-explain-drawer');
  const overlay  = $el('sp-explain-overlay');
  const titleEl  = $el('sp-explain-title');
  const bodyEl   = $el('sp-explain-body');
  const chipWrap = $el('sp-explain-chips');

  sp.drawerConcept = concept;
  sp.fcDeck = []; sp.fcIndex = 0; sp.fcStats = { easy: 0, ok: 0, hard: 0 };
  sp.pqQuestions = []; sp.pqIndex = 0; sp.pqScore = 0;
  sp.examQuestions = []; sp.examIndex = 0; sp.examAnswers = [];
  clearInterval(sp.examTimerHandle);

  spDrawerTab(startTab || 'explain');
  setText(titleEl, concept.title);
  setHtml(bodyEl, '<div class="sp-explain-spinner"></div>');
  setHtml(chipWrap, '');

  if (concept.keyTerms?.length) {
    concept.keyTerms.forEach(t => {
      const c = document.createElement('span');
      c.className = 'sp-explain-term-chip'; c.textContent = t;
      chipWrap.appendChild(c);
    });
  }

  addClass(drawer, 'open');
  addClass(overlay, 'open');
  sp.explainFocusRelease = typeof trapFocus === 'function' ? trapFocus(drawer) : null;

  if (!startTab || startTab === 'explain') _spStreamExplain(concept, bodyEl);
}

export function spCloseExplainDrawer() {
  removeClass($el('sp-explain-drawer'), 'open');
  removeClass($el('sp-explain-overlay'), 'open');
  if (sp.explainAbortCtrl) { sp.explainAbortCtrl.abort(); sp.explainAbortCtrl = null; }
  if (sp.explainFocusRelease) { sp.explainFocusRelease(); sp.explainFocusRelease = null; }
}

export async function _spStreamExplain(concept, bodyEl) {
  if (sp.explainAbortCtrl) sp.explainAbortCtrl.abort();
  sp.explainAbortCtrl = new AbortController();

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
      method: 'POST', signal: sp.explainAbortCtrl.signal,
      headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} },
      body: JSON.stringify({ question: prompt, mode: 'study', task_type: 'study_plan_explain', ...(() => { const p = _aiParams(7); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] }),
    });
    if (resp.status === 429) { const _d = await resp.json().catch(()=>({})); if (_d.guest_limited && isGuest?.() && typeof showLoginWall === 'function') { showLoginWall(_d.feature||'workspace'); return; } throw Object.assign(new Error('Server busy'), { _is429: true }); }
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

export async function spDrawerTab(tab) {
  $qsa('.sp-drawer-tab').forEach(t => { t.classList.remove('active'); t.classList.remove('sp-drawer-tab-locked'); });
  $el('sp-tab-' + tab)?.classList.add('active');
  ['explain','flash','pq','exam'].forEach(v => {
    const el = $el('sp-view-' + v);
    if (el) el.style.display = v === tab ? 'flex' : 'none';
  });
  $el('sp-explain-chips').style.display = tab === 'explain' ? '' : 'none';

  const tabMeta = {
    explain: { label:'AI Explain',    color:'#e8ac2e', bg:'var(--gold-muted)',        border:'var(--gold-border)',          svg:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e8ac2e" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>` },
    flash:   { label:'Flashcards',    color:'#8b7cf8', bg:'var(--violet-muted)',       border:'var(--violet-border)',        svg:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b7cf8" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>` },
    pq:      { label:"Practice Q's",  color:'#2dd4bf', bg:'var(--teal-muted)',         border:'rgba(45,212,191,0.25)',       svg:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>` },
    exam:    { label:'Mini Exam',     color:'#f87171', bg:'rgba(248,113,113,0.08)',    border:'rgba(248,113,113,0.25)',      svg:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>` },
  };
  const m = tabMeta[tab] || tabMeta.explain;
  const eyebrow = $el('sp-drawer-eyebrow');
  const icon    = $el('sp-drawer-icon');
  if (eyebrow) eyebrow.textContent   = m.label;
  if (icon)    { icon.innerHTML = m.svg; icon.style.background = m.bg; icon.style.borderColor = m.border; }

  if (tab === 'flash') {
    const { spFcGenerate, spFcShowDeck } = await import('./flashcards.js');
    if (sp.fcDeck.length === 0) spFcGenerate(); else spFcShowDeck();
  } else if (tab === 'pq') {
    const { spPqGenerate, spPqShowCurrent } = await import('./practiceQuestions.js');
    if (sp.pqQuestions.length === 0) spPqGenerate(); else spPqShowCurrent();
  } else if (tab === 'exam') {
    const { spExamGenerate, spExamShowCurrent } = await import('./exam.js');
    if (sp.examQuestions.length === 0) spExamGenerate(); else spExamShowCurrent();
  }
}
