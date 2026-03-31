/**
 * src/state/studyplan/patches.js — Override/patched versions of functions
 */

import { sp } from './state.js';
import { $el } from '../domHelpers.js';
import { spRenderPlan, spRenderRecentPlansSidebar } from './rendering.js';
import { spUpdateExamDateUI, spUpdateDailySchedule, spCheckAdaptiveReorder } from './calendar.js';
import { spSrsLoad, spUpdateSrsPanel, spExportIcal } from './srs.js';
import { spExamFinish } from './exam.js';
import { _spGenPlanId, spSaveCurrentPlanToLibrary, spLoadAllPlans } from './planLibrary.js';
import { lsGet, lsSet } from '../../utils/storage.js';

export function spSavePlanToSidebarAndLibrary(topic) {
  if (!sp.activePlanId) sp.activePlanId = _spGenPlanId();
  spSaveCurrentPlanToLibrary();
  if (!topic) return;
  let plans = [];
  try { plans = lsGet('sp_recent_plans', []); } catch (_) {}
  plans = plans.filter(p => p !== topic);
  plans.unshift(topic);
  plans = plans.slice(0, 6);
  lsSet('sp_recent_plans', plans);
  // Sync to Supabase so other devices see the updated sidebar list
  try { window.ChunksDB?.recentItems?.patch({ spRecentPlans: plans }); } catch (_) {}
  spRenderRecentPlansSidebar(plans);
}

export function spRenderPlanPatched(plan, sourceName) {
  spRenderPlan(plan, sourceName);
  setTimeout(() => {
    spUpdateExamDateUI();
    spUpdateDailySchedule();
    spLoadAllPlans();
    const detailCol = $el('sp-detail-col');
    if (detailCol && !$el('sp-daily-schedule')) {
      const schedDiv = document.createElement('div');
      schedDiv.id = 'sp-daily-schedule';
      schedDiv.style.display = 'none';
      detailCol.appendChild(schedDiv);
      spUpdateDailySchedule();
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
    setTimeout(() => spUpdateSrsPanel(), 150);
  }, 100);
}

export function spExamFinishPatched() {
  spExamFinish();
  setTimeout(() => spCheckAdaptiveReorder(), 500);
}
