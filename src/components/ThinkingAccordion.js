// @ts-nocheck
/**
 * src/components/ThinkingAccordion.js
 *
 * Vanilla-JS bridge for the ThinkingAccordion Preact island.
 *
 * Public API:
 *   createThinkingAccordion(container, options) → handle
 *
 * The returned handle exposes:
 *   handle.update({ thinkingText?, elapsed?, isStreaming?, open? })
 *   handle.unmount()
 *   handle.animationDone  — Promise that resolves immediately (no animation)
 *
 * Example:
 *   import { createThinkingAccordion } from './ThinkingAccordion.js';
 *
 *   const container = document.createElement('div');
 *   parentEl.appendChild(container);
 *   const accordion = createThinkingAccordion(container, {
 *     thinkingText: '<raw think content>',
 *     elapsed: 12,
 *     isStreaming: false,
 *   });
 *
 *   // Later: update content
 *   accordion.update({ elapsed: 30, isStreaming: false });
 */

import { mountIsland }             from '../preact/bridge.js';
import { ThinkingAccordionIsland } from './ThinkingAccordion.jsx';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Mount a ThinkingAccordion island into `container`.
 *
 * @param {HTMLElement} container   DOM element to mount into (Preact owns it)
 * @param {object}      [options]
 * @param {string}      [options.thinkingText]  Raw <think> content to display
 * @param {number}      [options.elapsed]       Seconds elapsed while thinking
 * @param {boolean}     [options.isStreaming]   Whether AI is still reasoning
 * @returns {{ update(patch: object): void, unmount(): void, animationDone: Promise<void> }}
 */
export function createThinkingAccordion(container, {
  thinkingText = '',
  elapsed      = 0,
  isStreaming   = false,
} = {}) {
  const handle = mountIsland(ThinkingAccordionIsland, container, {
    thinkingText,
    elapsed,
    isStreaming,
  });

  if (!isStreaming) {
    // Auto-collapse once done so the thinking block is neatly tucked away
    handle.update({ open: false });
  }

  // No animation to wait for — resolve immediately
  handle.animationDone = Promise.resolve();

  return handle;
}

/**
 * @deprecated No longer used — kept as a no-op stub so existing imports don't break.
 */
export function parseThinkingSteps() { return []; }

/**
 * @deprecated No longer used — kept as a no-op stub so existing imports don't break.
 */
export function inferThinkingTags() { return []; }
