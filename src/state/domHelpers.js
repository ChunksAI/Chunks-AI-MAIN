/**
 * src/state/domHelpers.js — Data-driven DOM helpers
 *
 * Thin abstraction over raw DOM APIs. Every state module imports these
 * helpers instead of calling document.getElementById / querySelector / etc.
 * directly. This:
 *   1. Centralises DOM access — easy to mock in tests or swap for a
 *      virtual-DOM layer later.
 *   2. Null-guards every call — avoids scattered `if (el)` checks.
 *   3. Makes grep-able: search for `$el(` instead of raw DOM calls.
 */

/** getElementById shorthand */
export const $el = (id) => document.getElementById(id);

/** querySelector shorthand (optionally scoped to a root element) */
export const $qs = (sel, root = document) => root.querySelector(sel);

/** querySelectorAll shorthand (optionally scoped to a root element) */
export const $qsa = (sel, root = document) => root.querySelectorAll(sel);

/** Show an element (set display to default) */
export function show(el) { if (el) el.style.display = ''; }

/** Hide an element (set display to none) */
export function hide(el) { if (el) el.style.display = 'none'; }

/** Conditionally show/hide */
export function setDisplay(el, visible) { if (el) el.style.display = visible ? '' : 'none'; }

/** Safe textContent setter */
export function setText(el, text) { if (el) el.textContent = text; }

/** Safe innerHTML setter */
export function setHtml(el, html) { if (el) el.innerHTML = html; }

/** Safe classList.add */
export function addClass(el, ...cls) { if (el) el.classList.add(...cls); }

/** Safe classList.remove */
export function removeClass(el, ...cls) { if (el) el.classList.remove(...cls); }

/** Safe classList.toggle */
export function toggleClass(el, cls, force) {
  if (el) el.classList.toggle(cls, force);
}

/** Safe setAttribute */
export function setAttr(el, key, value) { if (el) el.setAttribute(key, value); }

/** Safe style setter (multiple properties) */
export function setStyles(el, styles) {
  if (!el) return;
  for (const [k, v] of Object.entries(styles)) el.style[k] = v;
}

/** Create an element with optional class and HTML content */
export function createElement(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html) el.innerHTML = html;
  return el;
}

/** Listen for a DOM event — returns a cleanup function */
export function on(el, event, handler, opts) {
  if (!el) return () => {};
  el.addEventListener(event, handler, opts);
  return () => el.removeEventListener(event, handler, opts);
}

/** Delegate events using closest() matching */
export function onDelegate(root, event, selector, handler) {
  const wrapper = (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  };
  root.addEventListener(event, wrapper, true);
  return () => root.removeEventListener(event, wrapper, true);
}
