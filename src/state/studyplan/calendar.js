// @ts-nocheck
/**
 * src/state/studyplan/calendar.js — Exam date, daily schedule, adaptive reorder
 */

import { sp } from './state.js';
import { $el, hide, show, setText, setHtml } from '../domHelpers.js';
import { spMasteryScore, spMasteryGet, spMasteryUpdateNode } from './mastery.js';
import { spRenderPlan } from './rendering.js';
import { spUpdateReminderUI } from './notifications.js';
import { lsSet, lsGet, lsRemove } from '../../utils/storage.js';

export function spShowExamDatePicker() {
  const picker = $el('sp-exam-date-picker');
  const setBtn = $el('sp-set-exam-date-btn');
  if (!picker) return;
  picker.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
  if (setBtn) setBtn.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
  const input = $el('sp-exam-date-input');
  if (input && sp.examDate) input.value = sp.examDate;
}

export function spSetExamDate(val) {
  if (!val) return;
  const parts = val.split('-');
  if (parts.length !== 3 || parts[0].length !== 4 || parseInt(parts[0], 10) < 2020) return;
  const examEndOfDay = new Date(val + 'T00:00:00').setHours(23,59,59,999);
  if (examEndOfDay < Date.now()) {
    if (typeof wsShowToast === 'function') wsShowToast('📅', 'That date has already passed', 'rgba(248,113,113,0.3)');
    return;
  }
  sp.examDate = val;
  try { lsSet('sp_exam_date_' + (sp.activePlanId || 'default'), val); } catch (e) {}
  if (sp.activePlanId && sp.allPlans[sp.activePlanId]) {
    sp.allPlans[sp.activePlanId].examDate = val;
    try { lsSet('sp_all_plans', sp.allPlans); } catch (e) {}
  }
  spUpdateExamDateUI();
  const picker = $el('sp-exam-date-picker');
  if (picker) hide(picker);
  const setBtn = $el('sp-set-exam-date-btn');
  if (setBtn) setBtn.style.display = 'flex';
  spUpdateDailySchedule();
  spUpdateReminderUI();
}

export function _spCheckAndExpireExamDate() {
  if (!sp.examDate) return;
  const examEndOfDay = new Date(sp.examDate + 'T00:00:00').setHours(23,59,59,999);
  if (examEndOfDay < Date.now()) {
    sp.examDate = null;
    try { lsRemove('sp_exam_date_' + (sp.activePlanId || 'default')); } catch (_) {}
    if (sp.activePlanId && sp.allPlans[sp.activePlanId]) {
      sp.allPlans[sp.activePlanId].examDate = null;
      try { lsSet('sp_all_plans', sp.allPlans); } catch (_) {}
    }
    window._chunksNotifications?.cancel?.();
    spUpdateExamDateUI();
    spUpdateReminderUI();
    spUpdateDailySchedule();
  }
}
// Global assignment removed — handled by globals.js

export function spClearExamDate() {
  sp.examDate = null;
  try { lsRemove('sp_exam_date_' + (sp.activePlanId || 'default')); } catch (e) {}
  if (sp.activePlanId && sp.allPlans[sp.activePlanId]) {
    sp.allPlans[sp.activePlanId].examDate = null;
    try { lsSet('sp_all_plans', sp.allPlans); } catch (e) {}
  }
  window._chunksNotifications?.cancel?.();
  spUpdateExamDateUI();
  spUpdateReminderUI();
}

export function spUpdateExamDateUI() {
  const display = $el('sp-exam-date-display');
  const setBtn  = $el('sp-set-exam-date-btn');
  const label   = $el('sp-exam-date-label');
  const daysEl  = $el('sp-exam-days-left');
  if (!display || !setBtn) return;
  if (sp.examDate) {
    const examMs = new Date(sp.examDate + 'T00:00:00').getTime();
    const nowMs  = new Date().setHours(0,0,0,0);
    const days   = Math.ceil((examMs - nowMs) / 86400000);
    if (label) setText(label, 'Exam: ' + new Date(sp.examDate + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }));
    if (daysEl) {
      if (days < 0)      setText(daysEl, '(past)');
      else if (days === 0) setText(daysEl, '(today!)');
      else if (days === 1) setText(daysEl, '(tomorrow)');
      else                 setText(daysEl, `(${days} days)`);
    }
    display.style.display = 'flex';
    hide(setBtn);
  } else {
    hide(display);
    setBtn.style.display  = 'flex';
  }
}

export function spUpdateDailySchedule() {
  const el = $el('sp-daily-schedule');
  if (!el || !sp.currentPlan || !sp.examDate) {
    if (el) hide(el);
    return;
  }
  const concepts = sp.currentPlan.concepts;
  const examMs   = new Date(sp.examDate + 'T00:00:00').getTime();
  const nowMs    = new Date().setHours(0,0,0,0);
  const daysLeft = Math.ceil((examMs - nowMs) / 86400000);
  if (daysLeft <= 0) { hide(el); return; }
  const remaining = concepts.filter((c, i) => spMasteryScore(i) < 80);
  if (remaining.length === 0) { hide(el); return; }
  const totalMins = remaining.reduce((s, c) => s + (c.estimatedMinutes || 30), 0);
  const minsPerDay = Math.ceil(totalMins / daysLeft);
  el.style.display = 'block';
  setHtml(el, `
    <div class="sp-detail-section-title" style="margin-top:16px;">Daily Schedule</div>
    <div style="padding:12px 14px;background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-md);">
      <div style="font-size:12px;color:var(--text-2);line-height:1.6;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:var(--text-3);">Days until exam</span>
          <span style="font-weight:600;color:var(--text-1);">${daysLeft}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:var(--text-3);">Concepts remaining</span>
          <span style="font-weight:600;color:var(--text-1);">${remaining.length}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <span style="color:var(--text-3);">Study per day</span>
          <span style="font-weight:600;color:var(--gold);">${minsPerDay >= 60 ? (minsPerDay/60).toFixed(1)+'h' : minsPerDay+'min'}</span>
        </div>
        <div style="border-top:1px solid var(--border-xs);padding-top:8px;display:flex;flex-direction:column;gap:4px;">
          ${remaining.slice(0,4).map((c, i) => `
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;">
              <div style="width:5px;height:5px;border-radius:50%;background:var(--gold);flex-shrink:0;"></div>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-2);">${c.title}</span>
              <span style="color:var(--text-4);font-family:var(--font-mono);">${c.estimatedMinutes||30}m</span>
            </div>`).join('')}
          ${remaining.length > 4 ? `<div style="font-size:10px;color:var(--text-4);">+${remaining.length-4} more concepts</div>` : ''}
        </div>
      </div>
    </div>`);
}

export function spCheckAdaptiveReorder() {
  if (!sp.currentPlan || !sp.drawerConcept) return;
  const concepts = sp.currentPlan.concepts;
  const idx = concepts.indexOf(sp.drawerConcept);
  if (idx < 0 || idx >= concepts.length - 2) return;
  const examScore = spMasteryGet(idx)?.exam || 0;
  if (examScore < 50 && examScore > 0) {
    const insertAt = Math.min(idx + 2, concepts.length - 1);
    const clone = { ...concepts[idx], title: concepts[idx].title + ' (Review)', _isReview: true };
    const alreadyQueued = concepts.some(c => c._isReview && c.title.startsWith(concepts[idx].title));
    if (!alreadyQueued) {
      concepts.splice(insertAt, 0, clone);
      if (typeof wsShowToast === 'function') wsShowToast('🔁', `"${concepts[idx].title}" added for review after next concept`, 'var(--gold-border)');
      spRenderPlan(sp.currentPlan, sp.currentPlan.topic);
      sp.currentPlan.concepts.forEach((_, i) => spMasteryUpdateNode(i, spMasteryScore(i)));
    }
  }
}
