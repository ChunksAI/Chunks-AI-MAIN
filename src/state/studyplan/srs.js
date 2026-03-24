/**
 * src/state/studyplan/srs.js — Spaced Repetition System + iCal + confidence
 */

import { sp, SRS_MIN_INTERVAL, SRS_EASE_DEFAULT } from './state.js';
import { $el, hide, setText, setHtml } from '../domHelpers.js';
import { spMasteryScore } from './mastery.js';
import { lsGet, lsSet } from '../../utils/storage.js';

export function spSrsUpdate(conceptIdx, examScore) {
  if (!sp.srsSchedule[conceptIdx]) {
    sp.srsSchedule[conceptIdx] = { nextReview: Date.now(), interval: SRS_MIN_INTERVAL, ease: SRS_EASE_DEFAULT, reviews: 0 };
  }
  const s = sp.srsSchedule[conceptIdx];
  const grade = examScore >= 90 ? 5 : examScore >= 80 ? 4 : examScore >= 70 ? 3 : examScore >= 60 ? 2 : 1;
  if (grade >= 3) {
    s.interval = s.reviews === 0 ? 1 : s.reviews === 1 ? 3 : Math.round(s.interval * s.ease);
    s.ease = Math.max(1.3, s.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  } else {
    s.interval = SRS_MIN_INTERVAL;
    s.ease = Math.max(1.3, s.ease - 0.2);
  }
  s.nextReview = Date.now() + s.interval * 86400000;
  s.reviews++;
  s.lastScore = examScore;
  try {
    lsSet('sp_srs_' + (sp.activePlanId || 'default'), sp.srsSchedule);
  } catch(e) {}
  spUpdateSrsPanel();
}

export function spSrsLoad() {
  try {
    const parsed = lsGet('sp_srs_' + (sp.activePlanId || 'default'));
    if (parsed) sp.srsSchedule = parsed;
  } catch(e) {}
}

export function spSrsGetDueToday() {
  if (!sp.currentPlan) return [];
  const now = Date.now();
  return sp.currentPlan.concepts.reduce((due, concept, idx) => {
    const s = sp.srsSchedule[idx];
    if (s && s.nextReview <= now + 86400000) {
      due.push({ idx, concept, overdue: s.nextReview < now, daysUntil: Math.ceil((s.nextReview - now) / 86400000) });
    }
    return due;
  }, []);
}

export function spUpdateSrsPanel() {
  const el = $el('sp-srs-panel');
  if (!el || !sp.currentPlan) return;
  const due = spSrsGetDueToday();
  if (due.length === 0) { hide(el); return; }
  el.style.display = 'block';
  setHtml(el, `
    <div class="sp-detail-section-title" style="margin-top:16px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2" stroke-linecap="round" style="margin-right:4px;"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="M12 8v4l3 3"/></svg>
      Review Due (${due.length})
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${due.slice(0,3).map(d => `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:${d.overdue ? 'rgba(139,124,248,0.07)' : 'var(--surface-1)'};border:1px solid ${d.overdue ? 'var(--violet-border)' : 'var(--border-xs)'};border-radius:var(--r-md);cursor:pointer;" onclick="spOpenExplainDrawer(_spCurrentPlan.concepts[${d.idx}],'exam')">
          <div style="width:6px;height:6px;border-radius:50%;background:${d.overdue ? 'var(--violet)' : 'var(--text-4)'};flex-shrink:0;"></div>
          <div style="flex:1;overflow:hidden;">
            <div style="font-size:11px;font-weight:600;color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.concept.title}</div>
            <div style="font-size:10px;color:${d.overdue ? 'var(--violet)' : 'var(--text-4)'};">${d.overdue ? 'Overdue' : 'Due today'} · last ${sp.srsSchedule[d.idx]?.lastScore ?? '—'}%</div>
          </div>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>`).join('')}
      ${due.length > 3 ? `<div style="font-size:10px;color:var(--text-4);padding:4px 0;">+${due.length-3} more due</div>` : ''}
    </div>`);
}

export function spExportIcal() {
  if (!sp.currentPlan || !sp.examDate) {
    if (typeof wsShowToast === 'function') wsShowToast('📅', 'Set an exam date first to export calendar', 'var(--gold-border)');
    return;
  }
  const concepts = sp.currentPlan.concepts;
  const examMs   = new Date(sp.examDate + 'T00:00:00').getTime();
  const nowMs    = new Date().setHours(0,0,0,0);
  const daysLeft = Math.max(1, Math.ceil((examMs - nowMs) / 86400000));
  const remaining = concepts.filter((c, i) => spMasteryScore(i) < 80);
  const totalMins = remaining.reduce((s, c) => s + (c.estimatedMinutes || 30), 0);
  const minsPerDay = Math.ceil(totalMins / daysLeft);
  const pad = n => String(n).padStart(2, '0');
  const toIcalDate = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  };
  const toIcalDateTime = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };
  const uid = () => Math.random().toString(36).slice(2) + '@chunks-ai';
  const CRLF = '\r\n';
  let events = [];
  let dayOffset = 0;
  remaining.forEach((concept, i) => {
    const sessionMs = nowMs + dayOffset * 86400000;
    const startMs   = sessionMs + 9 * 3600000;
    const endMs     = startMs + (concept.estimatedMinutes || 30) * 60000;
    events.push([
      'BEGIN:VEVENT',
      `UID:${uid()}`,
      `DTSTART:${toIcalDateTime(startMs)}`,
      `DTEND:${toIcalDateTime(endMs)}`,
      `SUMMARY:Study: ${concept.title}`,
      `DESCRIPTION:Critical Path · ${sp.currentPlan.topic}\nEstimated: ${concept.estimatedMinutes||30} min`,
      `CATEGORIES:STUDY`,
      'END:VEVENT',
    ].join(CRLF));
    if ((i + 1) % Math.max(1, Math.ceil(minsPerDay / (concept.estimatedMinutes || 30))) === 0) dayOffset++;
  });
  events.push([
    'BEGIN:VEVENT',
    `UID:${uid()}`,
    `DTSTART;VALUE=DATE:${toIcalDate(examMs)}`,
    `DTEND;VALUE=DATE:${toIcalDate(examMs + 86400000)}`,
    `SUMMARY:📝 EXAM: ${sp.currentPlan.topic}`,
    `DESCRIPTION:Final exam for ${sp.currentPlan.topic}\nPrepared with Chunks AI Critical Path`,
    `CATEGORIES:EXAM`,
    'END:VEVENT',
  ].join(CRLF));
  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    "PRODID:-//Chunks AI//Study Plan//EN",
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${sp.currentPlan.topic} Study Plan`,
    ...events,
    'END:VCALENDAR',
  ].join(CRLF);
  const blob = new Blob([ical], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (sp.currentPlan.topic || 'study-plan').replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.ics';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  if (typeof wsShowToast === 'function') wsShowToast('📅', 'Calendar exported — import into Google Calendar or Apple Calendar', 'var(--gold-border)');
}

export function spConfidenceGet(conceptIdx) {
  const s = sp.srsSchedule[conceptIdx];
  if (!s || !s.reviews) return null;
  return s.lastScore || null;
}

export function spConfidenceBadge(conceptIdx) {
  const score = spConfidenceGet(conceptIdx);
  if (score === null) return '';
  if (score >= 90) return '<span style="font-size:9px;padding:1px 6px;border-radius:var(--r-pill);background:rgba(52,211,153,0.12);color:var(--green);font-family:var(--font-mono);">confident</span>';
  if (score >= 70) return '<span style="font-size:9px;padding:1px 6px;border-radius:var(--r-pill);background:rgba(232,172,46,0.12);color:var(--gold);font-family:var(--font-mono);">learning</span>';
  return '<span style="font-size:9px;padding:1px 6px;border-radius:var(--r-pill);background:rgba(248,113,113,0.12);color:var(--red);font-family:var(--font-mono);">review</span>';
}
