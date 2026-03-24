/**
 * src/state/studyplan/mastery.js — Mastery tracking
 */

import { sp, SP_WEIGHTS } from './state.js';
import { $qs, $qsa, addClass } from '../domHelpers.js';
import { ChunksDB } from '../../lib/chunksDb.js';

export function spMasteryGet(idx) {
  if (!sp.mastery[idx]) sp.mastery[idx] = { explain: 0, flash: 0, pq: 0, exam: 0 };
  return sp.mastery[idx];
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
  if (!sp.drawerConcept || !sp.currentPlan) return;
  const idx = sp.currentPlan.concepts.indexOf(sp.drawerConcept);
  if (idx < 0) return;
  const m = spMasteryGet(idx);
  m[activityKey] = Math.max(m[activityKey], score);
  const total = spMasteryScore(idx);
  spMasteryUpdateNode(idx, total);
  if (total >= 80) spMasteryUnlockNext(idx);
  // Dynamic import to avoid circular dep with panel.js
  import('./panel.js').then(({ spUpdatePanel }) => spUpdatePanel());
  try { localStorage.setItem('sp_active_mastery', JSON.stringify(sp.mastery)); } catch (_) {}
  if (sp.activePlanId && sp.allPlans[sp.activePlanId]) {
    ChunksDB?.studyPlan?.save(sp.activePlanId, {
      ...sp.allPlans[sp.activePlanId],
      mastery: { ...sp.mastery },
    }).catch(() => {});
  }
  try {
    if (sp.activePlanId && sp.allPlans[sp.activePlanId]) {
      sp.allPlans[sp.activePlanId].mastery = { ...sp.mastery };
      localStorage.setItem('sp_all_plans', JSON.stringify(sp.allPlans));
    }
  } catch (_) {}
}

export function spMasteryUpdateNode(idx, masteryPct) {
  const node = $qs(`.sp-node[data-concept-id="${idx + 1}"]`);
  if (!node) return;
  const bar    = $qs('.sp-mastery-bar-fill', node);
  const pctEl  = $qs('.sp-mastery-pct', node);
  const bullet = $qs('.sp-node-bullet', node);
  const badge  = $qs('.sp-node-status-badge', node);
  const card   = $qs('.sp-node-card', node);
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
  $qsa('.sp-activity-chip.available', node).forEach(chip => {
    chip.className = 'sp-activity-chip done';
    chip.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> ${chip.textContent.trim()}`;
  });
}

export function spMasteryUnlockNext(idx) {
  if (!sp.currentPlan) return;
  const nextIdx  = idx + 1;
  if (nextIdx >= sp.currentPlan.concepts.length) return;
  const nextNode = $qs(`.sp-node[data-concept-id="${nextIdx + 1}"]`);
  if (!nextNode) return;
  const bullet = $qs('.sp-node-bullet', nextNode);
  if (!bullet || !bullet.classList.contains('locked')) return;

  bullet.className = 'sp-node-bullet ready';
  bullet.innerHTML = `<span style="font-size:13px;">${nextIdx + 1}</span>`;

  const badge = $qs('.sp-node-status-badge', nextNode);
  if (badge) { badge.className = 'sp-node-status-badge ready'; badge.textContent = 'Ready'; }
  const card = $qs('.sp-node-card', nextNode);
  if (card) addClass(card, 'active-card');
  const bar = $qs('.sp-mastery-bar-fill', nextNode);
  if (bar) bar.style.background = 'var(--violet)';

  const actIcons = {
    'AI Explain':    `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>`,
    'Flashcards':    `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>`,
    "Practice Q's":  `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    'Mini Exam':     `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    'Visual Tutor':  `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="2"/><path d="M8 21h8m-4-4v4"/></svg>`,
  };
  $qsa('.sp-activity-chip.locked-chip', nextNode).forEach(chip => {
    const txt = chip.textContent.trim();
    chip.className = 'sp-activity-chip available';
    chip.innerHTML = (actIcons[txt] || '') + ' ' + txt;
  });

  const concept = sp.currentPlan.concepts[nextIdx];
  if (typeof wsShowToast === 'function') wsShowToast('🔓', `"${concept?.title}" unlocked!`, 'var(--gold)');
}
