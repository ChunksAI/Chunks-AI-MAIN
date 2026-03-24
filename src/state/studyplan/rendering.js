/**
 * src/state/studyplan/rendering.js — Plan rendering, node building, stats, views
 */

import { sp } from './state.js';
import { $el, $qs, $qsa, hide, show, setText, setHtml, addClass, removeClass } from '../domHelpers.js';
import { spMasteryScore } from './mastery.js';
import { spConfidenceBadge } from './srs.js';
import { spClearUpload } from './input.js';
import { setActivePlan, _renderRecentPlansAllSidebars } from '../../components/Sidebar.js';

export async function spRenderPlan(plan, sourceName) {
  const n = plan.concepts.length;
  setText($qs('.sp-plan-header-eyebrow'), `Study Plan · ${plan.subject || sourceName}`);
  setText($qs('.sp-plan-header-title'), plan.topic);
  setText($qs('.sp-plan-header-sub'), `${n} core concepts · ~${plan.estimatedHours} hrs to mastery`);

  const pathEl = $qs('.sp-path');
  pathEl.innerHTML = '';
  plan.concepts.forEach((concept, idx) => {
    pathEl.appendChild(spBuildNode(concept, idx + 1, idx === 0 ? 'ready' : 'locked', n));
  });

  spUpdateStats(plan.concepts, []);
  const { spUpdatePanel } = await import('./panel.js');
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

  const chatShortcut = (status !== 'locked' && !isLast) ? `
    <button
      class="sp-chat-shortcut-btn"
      data-concept-chat="${(concept.title || '').replace(/"/g, '&quot;')}"
      style="
        margin-top:10px;
        width:100%;
        padding:7px 12px;
        border-radius:var(--r-md);
        background:transparent;
        border:1px dashed var(--border-md);
        color:var(--text-3);
        font-size:11px;
        font-weight:600;
        cursor:pointer;
        font-family:var(--font-body);
        display:flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        transition:background 0.15s,border-color 0.15s,color 0.15s;
      "
      onmouseenter="this.style.background='var(--surface-3)';this.style.borderColor='var(--violet-border)';this.style.color='var(--violet)'"
      onmouseleave="this.style.background='transparent';this.style.borderColor='var(--border-md)';this.style.color='var(--text-3)'"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      Study this in Chat
    </button>` : '';

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
      ${chatShortcut}
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
  const row = $qs('.sp-stats-row');
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
  $qsa('.sp-donut-center-pct').forEach(el => el.textContent = pct + '%');
  const locked = n - nMastered - 1;
  const legendCounts = $qsa('.sp-legend-count');
  if (legendCounts.length >= 4) {
    legendCounts[0].textContent = `${nMastered} / ${n}`;
    legendCounts[1].textContent = `0 / ${n}`;
    legendCounts[2].textContent = `1 / ${n}`;
    legendCounts[3].textContent = `${locked} / ${n}`;
  }
  if (concepts.length > 0 && $qs('.sp-upcoming-title'))
    setText($qs('.sp-upcoming-title'), concepts[0].title);
}

// ── View helpers ───────────────────────────────────────────────────────────

export function spShowEmpty() {
  $el('sp-empty-state').style.display  = 'flex';
  hide($el('sp-active-state'));
  $el('toggle-empty')?.classList.add('active-view');
  $el('toggle-plan')?.classList.remove('active-view');
  const btn = $el('sp-generate-btn');
  if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  const newBtn = $el('btn-new-plan');
  if (newBtn) hide(newBtn);
  if (typeof setActivePlan === 'function') setActivePlan(null);
  if (typeof spClearUpload === 'function') spClearUpload();
}

export function spShowPlan() {
  hide($el('sp-empty-state'));
  $el('sp-active-state').style.display = 'flex';
  $el('toggle-plan')?.classList.add('active-view');
  $el('toggle-empty')?.classList.remove('active-view');
  const newBtn = $el('btn-new-plan');
  if (newBtn) show(newBtn);
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
  if (sp.currentPlan) {
    try {
      localStorage.setItem('sp_active_plan', JSON.stringify(sp.currentPlan));
      localStorage.setItem('sp_active_mastery', JSON.stringify(sp.mastery));
    } catch (e) {
      console.warn('Could not persist study plan to localStorage:', e);
    }
  }
}

export function spRenderRecentPlansSidebar(plans) {
  if (typeof _renderRecentPlansAllSidebars === 'function') {
    _renderRecentPlansAllSidebars();
  }
}

// Restore recent plans on load
(function() {
  try {
    if (typeof _renderRecentPlansAllSidebars === 'function') {
      _renderRecentPlansAllSidebars();
    } else {
      setTimeout(() => { _renderRecentPlansAllSidebars?.(); }, 200);
    }
  } catch (_) {}
})();

export function animateBars() {
  $qsa('.sp-mastery-bar-fill').forEach(bar => {
    const target = bar.style.width;
    bar.style.width = '0%';
    requestAnimationFrame(() => { setTimeout(() => { bar.style.width = target; }, 80); });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $el('toggle-plan')?.addEventListener('click', () => {
    if (!sp.currentPlan) return;
    setTimeout(animateBars, 100);
  });
});
