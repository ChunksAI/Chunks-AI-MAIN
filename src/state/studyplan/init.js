// @ts-nocheck
/**
 * src/state/studyplan/init.js — Activity chip delegation + spInitScreen
 */

import { sp } from './state.js';
import { $el } from '../domHelpers.js';
import { spMasteryScore, spMasteryUpdateNode } from './mastery.js';
import { spShowPlan, spRenderPlan } from './rendering.js';
import { spOpenExplainDrawer } from './explain.js';
import { spOpenVisualTutor } from './visualTutor.js';
import { spSrsLoad, spUpdateSrsPanel, spExportIcal } from './srs.js';
import { spUpdateExamDateUI, spUpdateDailySchedule, _spCheckAndExpireExamDate } from './calendar.js';
import { spLoadAllPlans } from './planLibrary.js';
import { spUpdateReminderUI } from './notifications.js';
import { spRenderPlanPatched } from './patches.js';
import { setActivePlan } from '../../components/Sidebar.js';
import { lsGet } from '../../utils/storage.js';

// ── Activity chip delegation ───────────────────────────────────────────────
document.addEventListener('click', e => {
  const chip = e.target.closest('.sp-activity-chip:not(.locked-chip):not(.done)');
  if (!chip) return;
  const node = chip.closest('.sp-node');
  if (!node) return;
  const conceptId = parseInt(node.dataset.conceptId, 10);
  if (!conceptId || !sp.currentPlan) return;
  const concept  = sp.currentPlan.concepts[conceptId - 1];
  if (!concept) return;
  const chipText = chip.textContent.trim();
  const tabMap   = { 'AI Explain': undefined, 'Flashcards': 'flash', "Practice Q's": 'pq', 'Mini Exam': 'exam' };
  if (chipText in tabMap) { spOpenExplainDrawer(concept, tabMap[chipText]); return; }
  if (chipText === 'Visual Tutor') { spOpenExplainDrawer(concept); setTimeout(() => spOpenVisualTutor(), 100); }
});

// ── spInitScreen (called by showScreen) ───────────────────────────────────
export function spInitScreen() {
  if (sp.currentPlan) {
    if (typeof spShowPlan === 'function') spShowPlan();
    if (sp.activePlanId && typeof setActivePlan === 'function') {
      setActivePlan(sp.activePlanId);
    }
    setTimeout(() => { spUpdateExamDateUI(); spUpdateDailySchedule(); spUpdateReminderUI(); }, 100);
    return;
  }
  spLoadAllPlans();
  try {
    const savedPlan    = lsGet('sp_active_plan');
    const savedMastery = lsGet('sp_active_mastery');
    if (savedPlan) {
      const plan = savedPlan;
      if (plan && Array.isArray(plan.concepts) && plan.concepts.length > 0) {
        sp.currentPlan = plan;
        sp.mastery     = savedMastery || {};
        const storedDate = localStorage.getItem('sp_exam_date_' + (sp.activePlanId || 'default'));
        if (storedDate) sp.examDate = storedDate;
        _spCheckAndExpireExamDate();
        spRenderPlanPatched(plan, plan.topic || 'Saved Plan');
        plan.concepts.forEach((_, idx) => {
          spMasteryUpdateNode(idx, spMasteryScore(idx));
        });
        const detailCol = $el('sp-detail-col');
        if (detailCol && !$el('sp-daily-schedule')) {
          const schedDiv = document.createElement('div');
          schedDiv.id = 'sp-daily-schedule';
          schedDiv.style.display = 'none';
          detailCol.appendChild(schedDiv);
        }
        if (detailCol && !$el('sp-srs-panel')) {
          const srsDiv = document.createElement('div');
          srsDiv.id = 'sp-srs-panel';
          srsDiv.style.display = 'none';
          detailCol.appendChild(srsDiv);
        }
        if (detailCol && !$el('sp-ical-btn')) {
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
        if (sp.activePlanId && typeof setActivePlan === 'function') {
          setActivePlan(sp.activePlanId);
        } else {
          const storedPlanId = localStorage.getItem('sp_active_plan_id');
          if (storedPlanId && typeof setActivePlan === 'function') {
            sp.activePlanId = storedPlanId;
            setActivePlan(storedPlanId);
          }
        }
        setTimeout(() => { spUpdateExamDateUI(); spUpdateDailySchedule(); spUpdateSrsPanel(); spUpdateReminderUI(); }, 200);
      }
    }
  } catch (e) {
    console.warn('Could not restore study plan from localStorage:', e);
  }
}
