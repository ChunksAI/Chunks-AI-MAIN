// @ts-nocheck
/**
 * src/state/flash/accent.js — Accent color system
 *
 * Unlocked by streak milestones. Stored in localStorage.
 * Applying changes --fc-accent on :root — one variable changes everything.
 */

import { $el, $qs, $qsa, setText, createElement } from '../domHelpers.js';
import { ACCENT_KEY } from './state.js';
import { _fcGetStreak } from './streak.js';
import { showToast } from '../../components/Toast.js';
import { lsGet as _lsGet, lsSet as _lsSet } from '../../utils/storage.js';

export const FC_ACCENTS = [
  {
    id:        'gold',
    name:      'Gold',
    color:     '#e8ac2e',
    emoji:     '⭐',
    unlocksAt: 0,
    label:     'Default',
  },
  {
    id:        'ocean',
    name:      'Ocean',
    color:     '#2dd4bf',
    emoji:     '🌊',
    unlocksAt: 3,
    label:     '3-day streak',
  },
  {
    id:        'violet',
    name:      'Violet',
    color:     '#8b7cf8',
    emoji:     '💜',
    unlocksAt: 7,
    label:     '7-day streak',
  },
  {
    id:        'crimson',
    name:      'Crimson',
    color:     '#f87171',
    emoji:     '❤️',
    unlocksAt: 14,
    label:     '14-day streak',
  },
  {
    id:        'sunrise',
    name:      'Sunrise',
    color:     '#fb923c',
    emoji:     '🌅',
    unlocksAt: 30,
    label:     '30-day streak',
  },
  {
    id:        'cherry',
    name:      'Cherry',
    color:     '#f472b6',
    emoji:     '🌸',
    unlocksAt: 60,
    label:     '60-day streak',
  },
];

export function _fcGetSavedAccent() {
  return _lsGet(ACCENT_KEY, 'gold');
}

export function _fcApplyAccent(id) {
  const accent = FC_ACCENTS.find(a => a.id === id) || FC_ACCENTS[0];
  document.documentElement.style.setProperty('--fc-accent', accent.color);
  _lsSet(ACCENT_KEY, id);
}

export function _fcGetUnlockedAccents() {
  const streak  = _fcGetStreak();
  const current = streak.current || 0;
  return FC_ACCENTS.filter(a => a.unlocksAt <= current);
}

export function _fcCheckNewAccentUnlock(prevStreak, newStreak) {
  const newUnlocks = FC_ACCENTS.filter(
    a => a.unlocksAt > 0 && a.unlocksAt <= newStreak && a.unlocksAt > prevStreak
  );
  newUnlocks.forEach(accent => {
    setTimeout(() => {
      showToast?.(accent.emoji, `New accent unlocked: ${accent.name}! Tap your streak to customize.`, 'var(--fc-accent)');
    }, 1500);
  });
}

export function _fcOpenAccentPicker() {
  const existing = $el('fc-accent-picker');
  if (existing) { existing.remove(); return; }

  const unlocked  = _fcGetUnlockedAccents();
  const savedId   = _fcGetSavedAccent();
  const streak    = _fcGetStreak();
  const curStreak = streak.current || 0;

  const picker = createElement('div', 'fc-accent-picker');
  picker.id = 'fc-accent-picker';
  picker.innerHTML = `
    <div class="fc-accent-picker-header">
      <span>Card accent color</span>
      <button class="fc-accent-close" style="background:none;border:none;color:var(--text-4);cursor:pointer;padding:2px;line-height:0;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="fc-accent-grid">
      ${FC_ACCENTS.map(a => {
        const isUnlocked = a.unlocksAt <= curStreak;
        const isActive   = a.id === savedId;
        return `
        <button
          class="fc-accent-swatch ${isActive ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}"
          style="--swatch-color:${a.color};"
          data-accent-id="${a.id}"
          data-accent-locked="${isUnlocked ? '0' : '1'}"
          title="${isUnlocked ? a.name : 'Locked — ' + a.label}"
        >
          <div class="fc-accent-dot" style="background:${a.color};"></div>
          <span class="fc-accent-name">${a.name}</span>
          <span class="fc-accent-req">${isUnlocked ? (isActive ? '✓ Active' : 'Unlocked') : '🔒 ' + a.label}</span>
        </button>`;
      }).join('')}
    </div>
  `;

  picker.querySelector('.fc-accent-close')
    ?.addEventListener('click', () => picker.remove());

  picker.querySelectorAll('.fc-accent-swatch[data-accent-id]').forEach(btn => {
    if (btn.dataset.accentLocked === '1') return;
    btn.addEventListener('click', () => _fcSelectAccent(btn.dataset.accentId));
  });

  const widget = $el('fc-streak-widget');
  if (widget) widget.after(picker);
  else $qs('.fc-hero')?.appendChild(picker);

  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!picker.contains(e.target) && e.target.id !== 'fc-streak-widget') {
        picker.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 10);
}

export function _fcSelectAccent(id) {
  _fcApplyAccent(id);
  $qsa('.fc-accent-swatch').forEach(el => {
    el.classList.toggle('active', el.querySelector('.fc-accent-name')?.textContent === FC_ACCENTS.find(a => a.id === id)?.name);
  });
  $qsa('.fc-accent-swatch .fc-accent-req').forEach((el, i) => {
    const a = FC_ACCENTS[i];
    if (a.unlocksAt <= (_fcGetStreak().current || 0)) {
      setText(el, a.id === id ? '✓ Active' : 'Unlocked');
    }
  });
}

export function _fcInitAccent() {
  _fcApplyAccent(_fcGetSavedAccent());
  const widget = $el('fc-streak-widget');
  if (widget) {
    widget.style.cursor = 'pointer';
    widget.title = 'Tap to customize accent color';
    widget.addEventListener('click', _fcOpenAccentPicker);
  }
}
