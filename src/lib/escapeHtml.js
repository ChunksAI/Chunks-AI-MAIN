// @ts-nocheck
/**
 * src/lib/escapeHtml.js — Shared HTML-escape utility
 *
 * Replaces all ad-hoc inline `.replace(/&/g,'&amp;')…` chains with a
 * single reusable function.  Handles the five HTML-special characters
 * recommended by OWASP.
 *
 * Usage:
 *   import { escapeHtml } from './escapeHtml.js';
 *   el.innerHTML = escapeHtml(userInput);
 */

/**
 * Escape HTML-special characters so the string is safe to embed in HTML.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
