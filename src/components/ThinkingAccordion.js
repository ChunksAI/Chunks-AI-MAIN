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
 *   handle.update({ steps?, elapsed?, isStreaming?, open? })
 *   handle.unmount()
 *   handle.animationDone  — Promise that resolves after step-reveal animation
 *                           (and auto-collapse) completes, so callers can await
 *                           it before starting the AI-response typewriter.
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
 *   await accordion.animationDone; // waits for step-reveal + collapse
 */

import { mountIsland }             from '../preact/bridge.js';
import { ThinkingAccordionIsland } from './ThinkingAccordion.jsx';

// ── Step parsing ──────────────────────────────────────────────────────────────

/**
 * Extract short step labels from raw thinking text.
 *
 * Splits the text into paragraphs, takes the first meaningful sentence of each
 * paragraph, strips markdown, and returns up to MAX_STEPS labels.
 *
 * @param {string} text  Raw <think> content from the model.
 * @returns {string[]}   Array of concise step label strings.
 */
export function parseThinkingSteps(text) {
  if (!text || typeof text !== 'string') return [];

  const MAX_STEPS     = 7;
  const MAX_LABEL_LEN = 60;
  const MIN_LABEL_LEN = 4;

  // Split into non-empty paragraphs
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const steps = [];
  for (const para of paragraphs) {
    // Take the first line of the paragraph
    let line = para.split('\n')[0].trim();

    // Strip common markdown formatting
    line = line
      .replace(/^#{1,6}\s+/, '')          // headings
      .replace(/^\d+\.\s+/, '')           // numbered lists
      .replace(/^[-*•]\s+/, '')           // bullet lists
      .replace(/\*\*(.*?)\*\*/g, '$1')    // bold
      .replace(/\*(.*?)\*/g, '$1')        // italic
      .replace(/`([^`]+)`/g, '$1')        // inline code
      .trim();

    // Truncate at the first sentence boundary (. ! ?) if it falls early enough
    const sentEnd = line.search(/[.!?]/);
    if (sentEnd > MIN_LABEL_LEN && sentEnd < MAX_LABEL_LEN) {
      line = line.slice(0, sentEnd);
    } else if (line.length > MAX_LABEL_LEN) {
      line = line.slice(0, MAX_LABEL_LEN - 1) + '…';
    }

    line = line.trim();
    if (line.length >= MIN_LABEL_LEN) {
      steps.push(line);
    }

    if (steps.length >= MAX_STEPS) break;
  }

  return steps;
}

// ── Public API ────────────────────────────────────────────────────────────────

const STEP_REVEAL_MS  = 140;  // delay between each step appearing
const DONE_PAUSE_MS   = 400;  // pause after last step before collapsing
const COLLAPSE_LAG_MS = 200;  // extra lag after collapse before resolving

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
  const steps = isStreaming ? [] : parseThinkingSteps(thinkingText);

  const handle = mountIsland(ThinkingAccordionIsland, container, {
    steps: [],
    elapsed,
    isStreaming,
  });

  if (!isStreaming && steps.length > 0) {
    // ── Animated step reveal ─────────────────────────────────────────────────
    // 1. Expand the accordion so the user sees steps appearing.
    // 2. Reveal steps one by one at STEP_REVEAL_MS intervals.
    // 3. Pause briefly after the last step (shows ✓ Done row).
    // 4. Collapse the accordion.
    // 5. Resolve animationDone so the caller can start the typewriter.
    handle.animationDone = new Promise(resolve => {
      // Small initial delay so the mount has settled before opening
      const startTimer = setTimeout(() => {
        handle.update({ open: true });

        let i = 0;
        const revealNext = () => {
          if (i < steps.length) {
            handle.update({ steps: steps.slice(0, i + 1) });
            i++;
            setTimeout(revealNext, STEP_REVEAL_MS);
          } else {
            // All steps shown — pause, then collapse
            setTimeout(() => {
              handle.update({ open: false });
              setTimeout(resolve, COLLAPSE_LAG_MS);
            }, DONE_PAUSE_MS);
          }
        };

        revealNext();
      }, 80);

      // Safety: if the handle is unmounted early (e.g. user aborts), resolve
      // so the Promise doesn't hang. We expose a cancel hook via the timer ref.
      handle._revealTimer = startTimer;
    });
  } else {
    // No steps to animate — accordion stays collapsed immediately
    handle.update({ open: false });
    handle.animationDone = Promise.resolve();
  }

  return handle;
}

/**
 * @deprecated No longer used — kept as a no-op stub so existing imports don't break.
 */
export function inferThinkingTags() { return []; }
