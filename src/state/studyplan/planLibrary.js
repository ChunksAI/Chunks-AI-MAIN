/**
 * src/state/studyplan/planLibrary.js — Multi-plan management
 */

import { sp, SP_WEIGHTS } from './state.js';
import { $el, hide, setHtml } from '../domHelpers.js';
import { spMasteryScore, spMasteryUpdateNode } from './mastery.js';
import { spRenderPlan, spShowEmpty, spRenderRecentPlansSidebar } from './rendering.js';
import { spSrsLoad, spUpdateSrsPanel } from './srs.js';
import { spUpdateExamDateUI, spUpdateDailySchedule, _spCheckAndExpireExamDate } from './calendar.js';
import { spUpdateReminderUI } from './notifications.js';

export function _spGenPlanId() {
  return 'plan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

export function spSaveCurrentPlanToLibrary() {
  if (!sp.currentPlan) return;
  const id = sp.activePlanId || _spGenPlanId();
  sp.activePlanId = id;
  sp.allPlans[id] = {
    plan: sp.currentPlan,
    mastery: { ...sp.mastery },
    savedAt: Date.now(),
    topic: sp.currentPlan.topic,
    examDate: sp.examDate || null,
  };
  try {
    localStorage.setItem('sp_all_plans', JSON.stringify(sp.allPlans));
    localStorage.setItem('sp_active_plan_id', id);
    localStorage.setItem('sp_active_plan', JSON.stringify(sp.currentPlan));
    localStorage.setItem('sp_active_mastery', JSON.stringify(sp.mastery));
  } catch (e) { console.warn('Could not save plan library:', e); }
  window.ChunksDB?.studyPlan?.save(id, sp.allPlans[id]).catch(() => {});
}

export function spLoadAllPlans() {
  try {
    const raw = localStorage.getItem('sp_all_plans');
    if (raw) sp.allPlans = JSON.parse(raw);
    sp.activePlanId = localStorage.getItem('sp_active_plan_id') || null;
    const dateRaw = localStorage.getItem('sp_exam_date_' + sp.activePlanId);
    if (dateRaw) sp.examDate = dateRaw;
  } catch (e) {}
}

export function spShowPlansMenu() {
  spLoadAllPlans();
  const overlay = $el('sp-plans-modal-overlay');
  const list = $el('sp-plans-menu-list');
  const countEl = $el('sp-plans-modal-count');
  if (!overlay || !list) return;
  const searchEl = $el('sp-plans-search');
  if (searchEl) searchEl.value = '';
  const entries = Object.entries(sp.allPlans).sort((a, b) => b[1].savedAt - a[1].savedAt);
  if (countEl) countEl.textContent = entries.length ? `${entries.length} plan${entries.length !== 1 ? 's' : ''}` : '';
  if (entries.length === 0) {
    setHtml(list, `
      <div class="sp-plans-empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="color:var(--text-4);margin-bottom:10px;"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        <div style="font-size:13px;color:var(--text-3);font-weight:500;">No saved plans yet</div>
        <div style="font-size:11px;color:var(--text-4);margin-top:4px;">Create your first study plan to get started</div>
      </div>`);
  } else {
    setHtml(list, _spRenderPlanCards(entries));
  }
  overlay.style.display = 'flex';
}

function _spRenderPlanCards(entries) {
  let activeMastery = null;
  try {
    const raw = localStorage.getItem('sp_active_mastery');
    if (raw) activeMastery = JSON.parse(raw);
  } catch (_) {}

  return entries.map(([id, entry]) => {
    const isActive = id === sp.activePlanId;
    const n = entry.plan?.concepts?.length || 0;
    const masteryData = isActive && activeMastery ? activeMastery : (entry.mastery || {});
    const W = { explain: 10, flash: 20, pq: 35, exam: 35 };
    const conceptScores = Array.from({ length: n }, (_, i) => {
      const m = masteryData[i] || {};
      return Math.min(100, Math.round(
        ((m.explain || 0) / 100) * W.explain +
        ((m.flash   || 0) / 100) * W.flash   +
        ((m.pq      || 0) / 100) * W.pq      +
        ((m.exam    || 0) / 100) * W.exam
      ));
    });
    const mastered    = conceptScores.filter(s => s >= 80).length;
    const barPct = n > 0 ? Math.round(conceptScores.reduce((a, b) => a + b, 0) / n) : 0;
    const savedDate = entry.savedAt ? new Date(entry.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const barColor = barPct >= 80 ? 'var(--green, #4caf50)' : barPct >= 20 ? 'var(--gold)' : 'var(--text-4)';

    return `
      <div class="sp-plan-card${isActive ? ' active' : ''}" onclick="spSwitchToPlan('${id}');spHidePlansMenu();" role="button" tabindex="0" onkeydown="if(event.key==='Enter')this.click()">
        <div class="sp-plan-card-left">
          <div class="sp-plan-card-icon${isActive ? ' active' : ''}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
        </div>
        <div class="sp-plan-card-body">
          <div class="sp-plan-card-title">${entry.topic || 'Untitled'}</div>
          <div class="sp-plan-card-meta">
            <span>${n} concept${n !== 1 ? 's' : ''}</span>
            ${savedDate ? `<span>·</span><span>${savedDate}</span>` : ''}
            ${isActive ? `<span class="sp-plan-card-active-badge">Active</span>` : ''}
          </div>
          <div class="sp-plan-card-bar-wrap">
            <div class="sp-plan-card-bar-track">
              <div class="sp-plan-card-bar-fill" style="width:${barPct}%;background:${barColor};"></div>
            </div>
            <span class="sp-plan-card-bar-pct" style="color:${barPct > 0 ? barColor : 'var(--text-4)'};">${barPct}%</span>
          </div>
        </div>
        <button class="sp-plan-card-delete" onclick="event.stopPropagation();spDeletePlan('${id}');" title="Delete plan">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>`;
  }).join('');
}

export function spFilterPlansMenu(query) {
  spLoadAllPlans();
  const list = $el('sp-plans-menu-list');
  if (!list) return;
  const entries = Object.entries(sp.allPlans).sort((a, b) => b[1].savedAt - a[1].savedAt);
  const q = query.toLowerCase().trim();
  const filtered = q ? entries.filter(([, e]) => (e.topic || '').toLowerCase().includes(q)) : entries;
  if (filtered.length === 0) {
    setHtml(list, `<div class="sp-plans-empty-state"><div style="font-size:12px;color:var(--text-4);">No plans match "${query}"</div></div>`);
  } else {
    setHtml(list, _spRenderPlanCards(filtered));
  }
}

export function spHidePlansMenu() {
  const overlay = $el('sp-plans-modal-overlay');
  if (overlay) hide(overlay);
}

export function spSwitchToPlan(id) {
  spLoadAllPlans();
  const entry = sp.allPlans[id];
  if (!entry || !entry.plan) return;
  sp.currentPlan = entry.plan;
  try {
    const activeId = localStorage.getItem('sp_active_plan_id');
    if (activeId === id) {
      const raw = localStorage.getItem('sp_active_mastery');
      sp.mastery = raw ? (JSON.parse(raw) || {}) : (entry.mastery || {});
    } else {
      sp.mastery = entry.mastery || {};
    }
  } catch (_) {
    sp.mastery = entry.mastery || {};
  }
  sp.activePlanId = id;
  if (typeof window.setActivePlan === 'function') window.setActivePlan(id);
  sp.examDate = entry.examDate || null;
  _spCheckAndExpireExamDate();
  try {
    localStorage.setItem('sp_active_plan_id', id);
    localStorage.setItem('sp_active_plan', JSON.stringify(entry.plan));
    localStorage.setItem('sp_active_mastery', JSON.stringify(sp.mastery));
  } catch (e) {}
  spRenderPlan(entry.plan, entry.plan.topic || 'Plan');
  entry.plan.concepts.forEach((_, idx) => spMasteryUpdateNode(idx, spMasteryScore(idx)));
  spSrsLoad();
  spUpdateExamDateUI();
  spUpdateDailySchedule();
  spUpdateReminderUI();
  setTimeout(() => spUpdateSrsPanel(), 200);
  if (typeof wsShowToast === 'function') wsShowToast('📚', `Switched to "${entry.topic}"`, 'var(--gold-border)');
}

export function spDeletePlan(id) {
  const deletedTopic = sp.allPlans[id]?.topic;
  delete sp.allPlans[id];
  try { localStorage.setItem('sp_all_plans', JSON.stringify(sp.allPlans)); } catch (e) {}
  window.ChunksDB?.studyPlan?.remove(id).catch(() => {});
  if (deletedTopic) {
    try {
      let recentPlans = JSON.parse(localStorage.getItem('sp_recent_plans') || '[]');
      recentPlans = recentPlans.filter(p => p !== deletedTopic);
      localStorage.setItem('sp_recent_plans', JSON.stringify(recentPlans));
    } catch (e) {}
  }
  if (sp.activePlanId === id) {
    sp.activePlanId = null;
    sp.currentPlan = null;
    sp.mastery = {};
    localStorage.removeItem('sp_active_plan');
    localStorage.removeItem('sp_active_mastery');
    localStorage.removeItem('sp_active_plan_id');
    if (typeof window.setActivePlan === 'function') window.setActivePlan(null);
    spShowEmpty();
  }
  if (typeof window._renderRecentPlansAllSidebars === 'function') {
    window._renderRecentPlansAllSidebars();
  }
  spShowPlansMenu();
}
