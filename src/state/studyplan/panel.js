// @ts-nocheck
/**
 * src/state/studyplan/panel.js — Live panel/donut update
 */

import { sp } from './state.js';
import { $el, $qs, setHtml, setText } from '../domHelpers.js';
import { spMasteryScore, spMasteryGet } from './mastery.js';

export function spUpdatePanel() {
  if (!sp.currentPlan) return;
  const concepts = sp.currentPlan.concepts;
  const total    = concepts.length;
  const CIRC     = 301.6;
  let nMastered = 0, nInProg = 0, nReady = 0, nLocked = 0, totalMastery = 0;
  concepts.forEach((c, i) => {
    const score = spMasteryScore(i);
    totalMastery += score;
    if (score >= 80) nMastered++;
    else if (score > 0) nInProg++;
    else {
      const node   = $qs(`.sp-node[data-concept-id="${i + 1}"]`);
      const bullet = $qs('.sp-node-bullet', node);
      if (bullet?.classList.contains('locked')) nLocked++; else nReady++;
    }
  });
  const avgMastery = total > 0 ? Math.round(totalMastery / total) : 0;

  const ringArc = $el('sp-ring-arc');
  const ringPct = $el('sp-ring-pct');
  const RING_CIRC = 150.8;
  if (ringArc) { ringArc.setAttribute('stroke-dashoffset', RING_CIRC - (avgMastery / 100) * RING_CIRC); ringArc.setAttribute('stroke', avgMastery >= 80 ? 'var(--green)' : avgMastery > 0 ? 'var(--gold)' : 'var(--text-4)'); }
  if (ringPct) setText(ringPct, avgMastery + '%');

  const statsRow = $el('sp-stats-row-chips');
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
  const dMastered    = $el('sp-donut-mastered');
  const dInProg      = $el('sp-donut-inprogress');
  const dPct         = $el('sp-donut-pct');
  if (dMastered) { dMastered.setAttribute('stroke-dashoffset', CIRC - masteredArc); dMastered.setAttribute('transform', `rotate(${masteredRot} 60 60)`); }
  if (dInProg)   { dInProg.setAttribute('stroke-dashoffset', CIRC - inProgArc);   dInProg.setAttribute('transform', `rotate(${inProgRot} 60 60)`); }
  if (dPct) setText(dPct, avgMastery + '%');

  const leg = (id, n) => { const el = $el(id); if (el) el.textContent = n + ' / ' + total; };
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
  const scoreEl = $el('sp-readiness-score');
  const barEl   = $el('sp-readiness-bar');
  const noteEl  = $el('sp-readiness-note');
  if (scoreEl) { setText(scoreEl, forecast + '%'); scoreEl.style.color = forecast >= 80 ? 'var(--green)' : forecast >= 60 ? 'var(--gold)' : 'var(--red)'; }
  if (barEl)   { barEl.style.width = forecast + '%'; barEl.style.background = forecast >= 80 ? 'var(--green)' : forecast >= 60 ? 'var(--gold)' : 'var(--red)'; }
  if (noteEl) {
    if (forecast >= 80) { setText(noteEl, "You're on track for a great exam result. Keep it up!"); }
    else {
      let worstIdx = -1, worstScore = 999;
      concepts.forEach((c, i) => { const s = spMasteryScore(i); if (s < 80 && s < worstScore) { worstScore = s; worstIdx = i; } });
      setText(noteEl, `Focus on "${worstIdx >= 0 ? concepts[worstIdx].title : 'remaining concepts'}" to push your forecast above 80%.`);
    }
  }

  const upNextEl = $el('sp-upcoming-list');
  if (upNextEl) {
    const items = spGetUpNextItems(concepts);
    if (items.length === 0) { setHtml(upNextEl, '<div style="font-size:12px;color:var(--text-4);padding:8px 0;">All concepts mastered! 🎉</div>'); }
    else {
      const iconSvg = { explain:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e8ac2e" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>`, flash:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b7cf8" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>`, pq:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`, exam:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>` };
      const iconBg  = { explain:'background:var(--gold-muted);border:1px solid var(--gold-border)', flash:'background:var(--violet-muted);border:1px solid var(--violet-border)', pq:'background:var(--teal-muted);border:1px solid rgba(45,212,191,0.25)', exam:'background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25)' };
      setHtml(upNextEl, items.map(item => `
        <div class="sp-upcoming-item" onclick="spOpenExplainDrawer(_spCurrentPlan.concepts[${item.conceptIdx}], '${item.tab}')" style="cursor:pointer;">
          <div class="sp-upcoming-icon" style="${iconBg[item.tab] || ''}">${iconSvg[item.tab] || ''}</div>
          <div class="sp-upcoming-info"><div class="sp-upcoming-title">${item.title}</div><div class="sp-upcoming-sub">${item.sub}</div></div>
          <svg class="sp-upcoming-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>`).join(''));
    }
  }

  const timeEl  = $el('sp-time-remaining');
  const timeSub = $el('sp-time-sub');
  if (timeEl && sp.currentPlan) {
    const remainingMins = concepts.reduce((sum, c, i) => sum + (spMasteryScore(i) < 80 ? (c.estimatedMinutes || 30) : 0), 0);
    if (remainingMins === 0) { setText(timeEl, 'All done! 🎉'); if (timeSub) setText(timeSub, "You've mastered all concepts."); }
    else {
      const hrs = (remainingMins / 60).toFixed(1);
      setText(timeEl, `~${hrs} hrs remaining`);
      if (timeSub) setText(timeSub, remainingMins < 60 ? `About ${remainingMins} minutes of study left.` : `At a steady pace, you'll finish in ${hrs} hours.`);
    }
  }
}

export function spGetUpNextItems(concepts) {
  const items = [], SUBS = { explain: () => 'Start · AI Explanation', flash: () => 'Reinforce with flashcards', pq: () => 'Practice Questions', exam: () => 'Take Mini Exam' };
  for (let i = 0; i < concepts.length && items.length < 3; i++) {
    const score  = spMasteryScore(i);
    if (score >= 80) continue;
    const node   = $qs(`.sp-node[data-concept-id="${i + 1}"]`);
    const bullet = $qs('.sp-node-bullet', node);
    if (bullet?.classList.contains('locked') && i > 0) continue;
    const m = spMasteryGet(i);
    for (const act of ['exam','pq','flash','explain']) {
      if ((m[act] || 0) < 80 && items.length < 3) { items.push({ conceptIdx: i, title: concepts[i].title, sub: SUBS[act](concepts[i]), tab: act }); break; }
    }
  }
  return items;
}
