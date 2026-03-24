/**
 * src/state/flash/keyboard.js — Keyboard shortcuts
 */

import { $el } from '../domHelpers.js';
import { fc } from './state.js';
import { _fcFlip, _fcNext } from './session.js';
import { _fcExitStudy } from './completion.js';

export function _fcKeyHandler(e) {
  const study = $el('fc-study');
  if (!study || study.style.display === 'none') return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    _fcFlip();
    return;
  }
  if (fc.flipped) {
    if (e.key === '1') _fcNext('hard');
    if (e.key === '2') _fcNext('ok');
    if (e.key === '3') _fcNext('easy');
    if (e.key === 'ArrowRight') _fcNext('ok');
    if (e.key === 'Escape') _fcExitStudy();
  }
}

export function _fcBindKeyboard() {
  document.addEventListener('keydown', _fcKeyHandler);
}

export function _fcRemoveKeyboard() {
  document.removeEventListener('keydown', _fcKeyHandler);
}
