// @ts-nocheck
/**
 * src/state/studyplan/notifications.js — Notifications + reminders
 */

import { sp } from './state.js';
import { $el, hide, show, setText } from '../domHelpers.js';

// ── Notifications helper — window._chunksNotifications ────────────────────
(function _initChunksNotifications() {
  const STORE_KEY   = 'chunks_reminder_schedule';
  const PREFS_KEY   = 'chunks_reminder_prefs';
  const ENABLED_KEY = 'chunks_reminder_enabled';

  function _swReg() {
    return navigator.serviceWorker?.controller || null;
  }

  function _pingSW() {
    const sw = _swReg();
    if (!sw) return;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const schedule = raw ? JSON.parse(raw) : [];
      sw.postMessage({ type: 'SCHEDULE_CHECK', schedule });
    } catch (_) {}
  }

  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'REMINDER_FIRED' && Array.isArray(e.data.firedAt)) {
        try {
          const raw = localStorage.getItem(STORE_KEY);
          if (!raw) return;
          const schedule = JSON.parse(raw);
          const firedSet = new Set(e.data.firedAt);
          schedule.forEach(r => { if (firedSet.has(r.fireAt)) r.fired = true; });
          localStorage.setItem(STORE_KEY, JSON.stringify(schedule));
        } catch (_) {}
      }
    });
  }

  let _exactHandle  = null;
  let _safetyHandle = null;

  function _startTick() {
    _armNextExact();
    if (_safetyHandle) return;
    _safetyHandle = setInterval(_pingSWAndCheckPage, 60_000);
  }

  function _stopTick() {
    if (_exactHandle)  { clearTimeout(_exactHandle);   _exactHandle  = null; }
    if (_safetyHandle) { clearInterval(_safetyHandle); _safetyHandle = null; }
  }

  function _armNextExact() {
    if (_exactHandle) { clearTimeout(_exactHandle); _exactHandle = null; }
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const schedule = JSON.parse(raw);
      const now = Date.now();
      const next = schedule
        .filter(r => !r.fired)
        .sort((a, b) => a.fireAt - b.fireAt)[0];
      if (!next) return;
      const delay = Math.max(0, next.fireAt - now);
      _exactHandle = setTimeout(() => {
        _pingSWAndCheckPage();
        _armNextExact();
      }, delay);
    } catch (_) {}
  }

  function _pingSWAndCheckPage() {
    _pingSW();
    _checkAndFirePage();
  }

  function _showNotification(title, body) {
    if (Notification.permission !== 'granted') return;
    const ctrl = navigator.serviceWorker?.controller;
    if (ctrl) {
      navigator.serviceWorker.ready
        .then(reg => reg.showNotification(title, {
          body,
          icon:     '/favicon-192x192.png',
          badge:    '/favicon-32x32.png',
          tag:      'chunks-daily-reminder',
          renotify: true,
          data:     { url: '/studyplan' },
          actions:  [
            { action: 'open',    title: 'Open Study Plan' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        }))
        .catch(() => new Notification(title, { body, icon: '/favicon-192x192.png' }));
    } else {
      try { new Notification(title, { body, icon: '/favicon-192x192.png' }); } catch (_) {}
    }
  }

  function _checkAndFirePage() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const schedule = JSON.parse(raw);
      const now = Date.now();
      let changed = false;
      (schedule || []).forEach(r => {
        if (r.fireAt <= now && !r.fired) {
          _showNotification(r.title || 'Chunks AI - Study Reminder', r.body || 'Time to study! Open your study plan.');
          r.fired = true;
          changed = true;
        }
      });
      if (changed) localStorage.setItem(STORE_KEY, JSON.stringify(schedule));
    } catch (_) {}
  }

  function _buildSchedule({ examDate, planTopic, hour, minute }) {
    const schedule = [];
    const now  = new Date();
    const exam = examDate ? new Date(examDate + 'T00:00:00') : null;
    for (let d = 0; d <= 30; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() + d);
      day.setHours(hour, minute, 0, 0);
      if (day.getTime() < now.getTime() - 60_000) continue;
      if (exam && day > exam) continue;
      const daysLeft = exam ? Math.ceil((exam - day) / 86400000) : null;
      const body = daysLeft != null
        ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} until your exam - keep going!`
        : `Time to study${planTopic ? ' ' + planTopic : ''}. Open your study plan.`;
      schedule.push({ fireAt: day.getTime(), fired: false, title: 'Chunks AI - Daily Reminder', body });
    }
    return schedule;
  }

  window._chunksNotifications = {
    enabled() {
      return localStorage.getItem(ENABLED_KEY) === '1';
    },

    prefs() {
      try {
        const p = localStorage.getItem(PREFS_KEY);
        return p ? JSON.parse(p) : { hour: 20, minute: 0 };
      } catch (_) { return { hour: 20, minute: 0 }; }
    },

    async request() {
      if (!('Notification' in window)) return 'denied';
      if (Notification.permission === 'granted') return 'granted';
      if (Notification.permission === 'denied')  return 'denied';
      return Notification.requestPermission();
    },

    schedule({ examDate, planTopic, hour = 20, minute = 0 }) {
      try {
        const prefs = { hour, minute, examDate, planTopic };
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
        localStorage.setItem(ENABLED_KEY, '1');
        const sched = _buildSchedule({ examDate, planTopic, hour, minute });
        localStorage.setItem(STORE_KEY, JSON.stringify(sched));
        _pingSWAndCheckPage();
        _startTick();
      } catch (_) {}
    },

    cancel() {
      try {
        localStorage.removeItem(STORE_KEY);
        localStorage.setItem(ENABLED_KEY, '0');
        _stopTick();
      } catch (_) {}
    },
  };

  if (localStorage.getItem(ENABLED_KEY) === '1') {
    try {
      const prefs = (() => { try { const p = localStorage.getItem(PREFS_KEY); return p ? JSON.parse(p) : null; } catch(_) { return null; } })();
      const examDate = prefs?.examDate;
      const examPassed = examDate
        ? new Date(examDate + 'T00:00:00').setHours(23,59,59,999) < Date.now()
        : false;
      if (examPassed) {
        localStorage.removeItem(STORE_KEY);
        localStorage.setItem(ENABLED_KEY, '0');
      } else {
        setTimeout(() => { _pingSWAndCheckPage(); _startTick(); }, 2000);
      }
    } catch (_) {}
  }
})();

// ── Daily reminder (push notifications) ────────────────────────────────────
export function spUpdateReminderUI() {
  const row = $el('sp-reminder-row');
  if (!row) return;
  row.style.display = sp.examDate ? 'flex' : 'none';
  if (!sp.examDate) return;

  const enabled = window._chunksNotifications?.enabled?.() || false;
  const btn     = $el('sp-reminder-btn');
  const label   = $el('sp-reminder-btn-label');
  const timeWrap = $el('sp-reminder-time-wrap');

  if (btn) {
    btn.style.borderColor = enabled ? 'var(--gold-border)' : 'var(--border-sm)';
    btn.style.color       = enabled ? 'var(--gold)'        : 'var(--text-3)';
    btn.style.background  = enabled ? 'var(--gold-muted)'  : 'var(--surface-2)';
  }
  if (label) setText(label, enabled ? '🔔 Daily reminder on' : 'Enable daily reminder');
  if (timeWrap) timeWrap.style.display = enabled ? 'flex' : 'none';

  const prefs = window._chunksNotifications?.prefs?.();
  if (prefs && $el('sp-reminder-time')) {
    const h = String(prefs.hour   || 20).padStart(2,'0');
    const m = String(prefs.minute || 0).padStart(2,'0');
    $el('sp-reminder-time').value = h + ':' + m;
  }
}

export async function spToggleReminder() {
  if (!sp.examDate) {
    if (typeof wsShowToast === 'function') wsShowToast('📅', 'Set an exam date first', 'var(--gold-border)');
    return;
  }
  if (!window._chunksNotifications) {
    if (typeof wsShowToast === 'function') wsShowToast('⚠', 'Notifications not available', '');
    return;
  }

  const enabled = window._chunksNotifications.enabled();

  if (enabled) {
    window._chunksNotifications.cancel();
    spUpdateReminderUI();
    if (typeof wsShowToast === 'function') wsShowToast('🔕', 'Daily reminders turned off', '');
    return;
  }

  const perm = await window._chunksNotifications.request();
  if (perm === 'denied') {
    if (typeof wsShowToast === 'function') wsShowToast('🚫', 'Notifications blocked — enable in browser settings', 'rgba(248,113,113,0.3)');
    return;
  }
  if (perm !== 'granted') return;

  const timeInput = $el('sp-reminder-time');
  const [h, m] = (timeInput?.value || '20:00').split(':').map(Number);

  window._chunksNotifications.schedule({
    examDate:  sp.examDate,
    planTopic: sp.currentPlan?.topic || 'your study plan',
    hour:   isNaN(h) ? 20 : h,
    minute: isNaN(m) ? 0  : m,
  });

  spUpdateReminderUI();
  if (typeof wsShowToast === 'function') wsShowToast('🔔', 'Daily reminders enabled!', 'var(--gold-border)');
}

export function spUpdateReminderTime(timeVal) {
  if (!timeVal || !window._chunksNotifications?.enabled?.()) return;
  const [h, m] = timeVal.split(':').map(Number);
  window._chunksNotifications.schedule({
    examDate:  sp.examDate,
    planTopic: sp.currentPlan?.topic || 'your study plan',
    hour:   isNaN(h) ? 20 : h,
    minute: isNaN(m) ? 0  : m,
  });
  if (typeof wsShowToast === 'function') wsShowToast('🔔', `Reminder time updated to ${timeVal}`, 'var(--gold-border)');
}
