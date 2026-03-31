/**
 * src/state/flash/streak.js — Streak, XP, freeze, legend systems
 */

import { $el, setText, setHtml, show, addClass, removeClass } from '../domHelpers.js';
import { STREAK_KEY, FREEZE_KEY, XP_KEY, LEGEND_KEY } from './state.js';
import { FC_ACCENTS, _fcCheckNewAccentUnlock } from './accent.js';
import { showToast } from '../../components/Toast.js';
import { _fcSound } from './session.js';
import { lsGet, lsSet } from '../../utils/storage.js';

// XP per rating
const XP_PER_RATING = { easy: 10, ok: 7, hard: 3, skipped: 0 };

// Multiplier by streak milestone (streak >= threshold → multiplier)
const XP_MULTIPLIERS = [
  { streak: 30, mult: 1.5, label: '×1.5 streak bonus' },
  { streak: 7,  mult: 1.2, label: '×1.2 streak bonus' },
  { streak: 0,  mult: 1.0, label: '' },
];

export function _fcGetXp() {
  return lsGet(XP_KEY, { total: 0, allTime: 0, lastSession: 0 });
}

export function _fcSaveXp(data) {
  lsSet(XP_KEY, data);
}

export function _fcXpMultiplier() {
  const streak = _fcGetStreak().current || 0;
  for (const m of XP_MULTIPLIERS) {
    if (streak >= m.streak) return m;
  }
  return XP_MULTIPLIERS[XP_MULTIPLIERS.length - 1];
}

export function _fcCalcSessionXp(stats) {
  const base = (stats.easy || 0) * XP_PER_RATING.easy
             + (stats.ok   || 0) * XP_PER_RATING.ok
             + (stats.hard || 0) * XP_PER_RATING.hard;
  const { mult } = _fcXpMultiplier();
  return { base, bonus: Math.round(base * mult) - base, total: Math.round(base * mult), mult };
}

export function _fcAwardXp(stats) {
  const { total: earned, base, bonus, mult } = _fcCalcSessionXp(stats);
  const xp = _fcGetXp();
  xp.lastSession = earned;
  xp.total       = (xp.total || 0) + earned;
  xp.allTime     = (xp.allTime || 0) + earned;
  _fcSaveXp(xp);
  return { earned, base, bonus, mult };
}

// Freeze token thresholds: earn 1 at day 14, earn another at day 30, max 2 held
const FREEZE_EARN_AT = [14, 30];

export function _fcGetFreeze() {
  return lsGet(FREEZE_KEY, { tokens: 0, lastEarned: null });
}

export function _fcSaveFreeze(data) {
  lsSet(FREEZE_KEY, data);
}

export function _fcCheckFreezeEarn(prevStreak, newStreak) {
  const freeze = _fcGetFreeze();
  const toEarn = FREEZE_EARN_AT.filter(n => n > prevStreak && n <= newStreak);
  if (toEarn.length === 0) return;
  const today = _fcTodayStr();
  const added = Math.min(toEarn.length, 2 - freeze.tokens);
  if (added <= 0) return;
  freeze.tokens     = Math.min(2, freeze.tokens + added);
  freeze.lastEarned = today;
  _fcSaveFreeze(freeze);
  setTimeout(() => {
    showToast?.('🛡️', `Streak freeze earned! You can miss 1 day without losing your streak. (${freeze.tokens}/2 held)`, 'var(--fc-accent)');
  }, 2000);
}

export function _fcTryUseFreeze(streak) {
  const freeze = _fcGetFreeze();
  if (freeze.tokens <= 0) return false;
  freeze.tokens--;
  _fcSaveFreeze(freeze);
  streak.lastStudyDate = _fcTodayStr();
  showToast?.('🛡️', 'Streak freeze used! Your streak is protected.', 'var(--violet)');
  return true;
}

export function _fcGetStreak() {
  return lsGet(STREAK_KEY, { current: 0, longest: 0, lastStudyDate: null });
}

export function _fcSaveStreak(data) {
  lsSet(STREAK_KEY, data);
}

export function _fcTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function _fcYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function _fcRecordStudyDay() {
  const today     = _fcTodayStr();
  const yesterday = _fcYesterdayStr();
  const streak    = _fcGetStreak();

  if (streak.lastStudyDate === today) {
    _fcRenderStreak();
    return;
  }

  const prevStreak = streak.current || 0;

  if (streak.lastStudyDate === yesterday) {
    streak.current++;
  } else if (streak.lastStudyDate && streak.lastStudyDate !== today) {
    const saved = _fcTryUseFreeze(streak);
    if (saved) {
      streak.current = streak.current || 1;
    } else {
      streak.current = 1;
    }
  } else {
    streak.current = 1;
  }

  streak.lastStudyDate = today;
  streak.longest = Math.max(streak.longest, streak.current);
  _fcSaveStreak(streak);
  _fcRenderStreak();

  _fcCheckNewAccentUnlock(prevStreak, streak.current);
  _fcCheckFreezeEarn(prevStreak, streak.current);

  const milestones = [3, 7, 14, 30, 60, 100];
  if (milestones.includes(streak.current)) {
    _fcShowStreakMilestone(streak.current);
  }
}

export function _fcNextMilestone(current) {
  const milestones = [3, 7, 14, 30, 60, 100];
  return milestones.find(m => m > current) || null;
}

export function _fcStreakMilestones() {
  const streak  = _fcGetStreak();
  const current = streak.current || 0;
  const MILESTONES = [3, 7, 14, 30, 60, 100];
  return MILESTONES.map(day => ({
    day,
    theme: (['Ocean','Ember','Violet','Lava','Aurora','Legend'])[MILESTONES.indexOf(day)] || '',
    unlocked: current >= day,
  }));
}

export function _fcFlameSvg(current, state) {
  let baseColor, tipColor, opacity;
  if (state === 'dead')        { baseColor = '#555'; tipColor = '#777'; opacity = 0.25; }
  else if (state === 'danger') { baseColor = '#ef4444'; tipColor = '#fca5a5'; opacity = 0.7; }
  else if (state === 'none')   { baseColor = '#f97316'; tipColor = '#fbbf24'; opacity = 0.35; }
  else {
    if (current >= 30)      { baseColor = '#dc2626'; tipColor = '#fb923c'; }
    else if (current >= 14) { baseColor = '#ea580c'; tipColor = '#fbbf24'; }
    else if (current >= 7)  { baseColor = '#f97316'; tipColor = '#fde047'; }
    else                    { baseColor = '#f97316'; tipColor = '#fbbf24'; }
    opacity = 1;
  }

  if (current === 0 || state === 'none') {
    return `<svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:${opacity}">
      <path d="M14 28C9 28 6 24 6 20c0-3 1.5-5.5 3-7.5 0 2.5 1.5 4 3 4-1-2.5 1-6.5 3-8.5 0 3.5 2 5.5 4 6-0.5-1.5 0-3 1-4 1.5 2.5 2 5.5 2 8 0 4-3 10-8 10z" fill="${baseColor}"/>
    </svg>`;
  } else if (current < 3) {
    return `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:${opacity}">
      <path d="M14 32C8 32 4 26.5 4 21c0-4 2-7 4.5-10 0 3.5 2 5.5 3.5 5.5-1.5-3.5 1.5-8.5 4-11.5 0 4.5 2.5 7 5.5 8-1-2.5 0.5-4.5 1.5-6C25 10 24 14.5 24 18c0 8-4 14-10 14z" fill="${baseColor}"/>
      <path d="M14 32C10 32 8 28 8 25c0-2.5 1-4.5 2.5-6 0 2 1 3.5 2.5 4C12 21 13 18 14 16c1 3 3 5 3 8 0 3.5-1.5 8-3 8z" fill="${tipColor}" opacity="0.8"/>
    </svg>`;
  } else if (current < 7) {
    return `<svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:${opacity}">
      <path d="M16 38C9 38 4 31 4 24c0-5 2.5-9 5-12.5 0 4 2 7 4.5 7-2-4.5 2-10.5 5-14.5 0 5.5 3 8.5 6 9.5-1-3 0.5-5.5 2-7.5 3 4 2.5 9 2.5 12.5 0 9-4.5 19.5-9 19.5z" fill="${baseColor}"/>
      <path d="M16 38C11 38 9 33 9 29c0-3.5 1.5-6 3-8 0 3 1.5 5 3 5-1-3.5 1-7.5 3-10 0.5 3.5 2.5 6 2.5 8.5 0 4-1.5 10.5-2.5 13.5z" fill="${tipColor}" opacity="0.85"/>
    </svg>`;
  } else if (current < 14) {
    return `<svg width="34" height="48" viewBox="0 0 34 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:${opacity}">
      <path d="M17 44C9 44 3 36 3 28c0-6.5 3-11 6-15.5 0 5 2.5 8.5 5.5 8.5-2.5-6 2.5-13 6-18 0 6.5 3.5 10.5 7 11.5-1.5-3.5 0.5-7 2.5-9 3.5 5 3 11 3 15 0 11-5.5 23.5-13 23.5z" fill="${baseColor}"/>
      <path d="M17 44C12 44 9 38 9 33c0-4 2-7.5 4-10 0.5 3.5 2 6 3.5 6-1.5-4.5 1.5-9 3.5-12 1 4.5 3 7.5 3 10.5 0 5-1.5 12.5-3 12.5z" fill="${tipColor}" opacity="0.9"/>
      <ellipse cx="17" cy="44" rx="5" ry="2" fill="${baseColor}" opacity="0.3"/>
    </svg>`;
  } else {
    return `<svg width="36" height="52" viewBox="0 0 36 52" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:${opacity}">
      <ellipse cx="18" cy="49" rx="9" ry="3" fill="${baseColor}" opacity="0.2"/>
      <path d="M18 47C9 47 2 38 2 29c0-8 4-13.5 7.5-19 0 6 3 10.5 7 10.5-3-7.5 3-16 7.5-22.5 0 8 4.5 13 8.5 14.5-2-4.5 0.5-8.5 3-11 4 6 3.5 13 3.5 18 0 13.5-6.5 27.5-13.5 27.5z" fill="${baseColor}"/>
      <path d="M18 47C12 47 9 40 9 34.5c0-5 2.5-9.5 5-12.5 0.5 4.5 2.5 7.5 4 7.5-2-5.5 2-11 4.5-14.5 1 5.5 3.5 9 3.5 13 0 6-2 13.5-3.5 19z" fill="${tipColor}" opacity="0.9"/>
      <path d="M18 47C15 47 14 43 14 40c0-3 1-5.5 2.5-7.5C17 35 18 37 18 39c0-2 1.5-4.5 2.5-6.5 0.5 3 1 5 1 7C21.5 43 20 47 18 47z" fill="white" opacity="0.35"/>
      <ellipse cx="18" cy="49" rx="6" ry="2" fill="${baseColor}" opacity="0.15"/>
    </svg>`;
  }
}

export function _fcRenderStreak() {
  const streak    = _fcGetStreak();
  const today     = _fcTodayStr();
  const yesterday = _fcYesterdayStr();
  const countEl   = $el('fc-streak-count');
  const statusEl  = $el('fc-streak-status');
  const fireEl    = $el('fc-streak-fire');
  const widgetEl  = $el('fc-streak-widget');

  if (!countEl) return;

  setText(countEl, streak.current);

  const studiedToday = streak.lastStudyDate === today;
  const studiedYest  = streak.lastStudyDate === yesterday;
  const neverStudied = !streak.lastStudyDate;

  let flameState = 'none';

  if (streak.current === 0 || neverStudied) {
    setText(statusEl, 'Start your streak today!');
    removeClass(widgetEl, 'fc-streak-active', 'fc-streak-danger');
    flameState = 'none';
  } else if (studiedToday) {
    setText(statusEl, '✓ Studied today');
    addClass(widgetEl, 'fc-streak-active');
    removeClass(widgetEl, 'fc-streak-danger');
    flameState = 'active';
  } else if (studiedYest) {
    setText(statusEl, '⚠ Study today to keep it!');
    addClass(widgetEl, 'fc-streak-danger');
    removeClass(widgetEl, 'fc-streak-active');
    flameState = 'danger';
  } else {
    setText(statusEl, 'Streak lost — start again!');
    removeClass(widgetEl, 'fc-streak-active', 'fc-streak-danger');
    flameState = 'dead';
    if (streak.current > 0) {
      streak.current = 0;
      _fcSaveStreak(streak);
      setText(countEl, '0');
    }
  }

  setHtml(fireEl, _fcFlameSvg(streak.current, flameState));

  const nextM = _fcNextMilestone(streak.current);
  const prevM = (() => {
    const milestones = [0, 3, 7, 14, 30, 60, 100];
    for (let i = milestones.length - 1; i >= 0; i--) {
      if (milestones[i] <= streak.current) return milestones[i];
    }
    return 0;
  })();

  const progBar  = $el('fc-streak-prog-bar');
  const progNext = $el('fc-streak-next-label');
  if (progBar && nextM) {
    const pct = Math.round(((streak.current - prevM) / (nextM - prevM)) * 100);
    progBar.style.width = pct + '%';
  }
  if (progNext && nextM) {
    const nextAccent = FC_ACCENTS.find(a => a.unlocksAt === nextM);
    setText(progNext, nextAccent
      ? `${nextM} days → ${nextAccent.name} theme`
      : `${nextM} days`);
  } else if (progNext && !nextM) {
    setText(progNext, 'Max milestone reached!');
  }

  const longestEl = $el('fc-streak-longest');
  const freezeEl  = $el('fc-streak-freeze');
  setText(longestEl, streak.longest || 0);
  if (freezeEl) {
    const freeze = _fcGetFreeze();
    setText(freezeEl, freeze.tokens > 0 ? `🛡️ ×${freeze.tokens}` : '—');
    freezeEl.style.color = freeze.tokens > 0 ? 'var(--violet)' : '';
  }

  const xpEl = $el('fc-streak-xp');
  if (xpEl) {
    const xp = _fcGetXp();
    setText(xpEl, (xp.total || 0).toLocaleString());
  }

  if (_fcIsLegend()) {
    addClass(widgetEl, 'fc-streak-legend');
    const badge = $el('fc-legend-badge');
    show(badge);
  }

  const { mult, label } = _fcXpMultiplier();
  if (mult > 1 && progNext) {
    const existing = progNext.textContent;
    if (!existing.includes('XP')) {
      setText(progNext, label + (existing ? ' · ' + existing : ''));
    }
  }

  if (widgetEl && streak.longest > 0) {
    widgetEl.title = `Best streak: ${streak.longest} days`;
  }
}

export function _fcShowStreakMilestone(days) {
  const messages = {
    3:   "🔥 3-day streak! You're building a habit!",
    7:   "🔥 One week streak! Incredible consistency! XP multiplier ×1.2 unlocked!",
    14:  "🔥 Two weeks! You're unstoppable! Streak freeze earned.",
    30:  "🏆 30-day streak! You are a studying machine! XP multiplier ×1.5 + hard card boost unlocked!",
    60:  "🏆 60 days! Absolute legend!",
    100: "🏆 100-DAY STREAK! Hall of fame! Legend badge earned!",
  };
  const msg = messages[days] || `🔥 ${days}-day streak!`;
  showToast?.('🔥', msg, 'var(--gold)');
  setTimeout(() => _fcSound?.combo(), 200);

  if (days >= 100) {
    _fcAwardLegendBadge();
  }
}

export function _fcIsLegend() {
  return lsGet(LEGEND_KEY, false) === true || lsGet(LEGEND_KEY, false) === '1';
}

export function _fcAwardLegendBadge() {
  lsSet(LEGEND_KEY, '1');
  const widget = $el('fc-streak-widget');
  addClass(widget, 'fc-streak-legend');
  const badge = $el('fc-legend-badge');
  show(badge);
}

export function _fcHardBoostActive() {
  return (_fcGetStreak().current || 0) >= 30;
}
