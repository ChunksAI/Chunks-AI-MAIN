// @ts-nocheck
/**
 * src/state/flash/helpers.js — DOM helpers specific to flash
 */

import { $el, $qs, setText, setDisplay } from '../domHelpers.js';

export function _fcShowView(view) {
  const home  = $el('fc-home');
  const study = $el('fc-study');
  if (!home || !study) return;
  setDisplay(home,  view === 'home');
  setDisplay(study, view === 'study');
}

export function _fcSetGenBusy(busy, topic) {
  const btn     = $el('fc-gen-btn');
  const loading = $el('fc-gen-loading');
  const genCard = $qs('.fc-gen-card');
  if (btn) btn.disabled = busy;
  setDisplay(loading, busy);
  setDisplay(genCard, !busy);
  const lt = $el('fc-loading-topic');
  if (lt && topic) setText(lt, topic);
}

export function _fcShowError(msg) {
  const el = $el('fc-gen-error');
  if (!el) return;
  setText(el, msg);
  setDisplay(el, !!msg);
}
