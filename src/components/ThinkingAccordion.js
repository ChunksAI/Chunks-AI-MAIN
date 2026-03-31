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
 *   handle.update({ steps?, elapsed?, tags?, isStreaming? })
 *   handle.unmount()
 *
 * Example:
 *   import { createThinkingAccordion } from './ThinkingAccordion.js';
 *
 *   const container = document.createElement('div');
 *   parentEl.appendChild(container);
 *   const accordion = createThinkingAccordion(container, {
 *     steps: [{ title: 'Understanding the question', description: '…', done: true }],
 *     elapsed: 12,
 *     tags: ['logic', 'recall'],
 *     isStreaming: false,
 *   });
 *
 *   // Later: update content
 *   accordion.update({ elapsed: 30, isStreaming: false });
 */

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_THINKING_STEPS   = 8;   // cap per-response to keep the UI readable
const MAX_DESCRIPTION_LEN  = 300; // chars per step description
const MAX_TITLE_LEN        = 100; // chars per step title
const MAX_TAGS             = 3;   // skill pills shown in footer

/**
 * Parse raw `<think>...</think>` content (or plain prose) into structured
 * reasoning steps.  Splits on blank lines; the first sentence of each block
 * becomes the step title and the remainder becomes the description.
 *
 * @param {string} raw
 * @returns {{ title: string, description: string, done: boolean }[]}
 */
export function parseThinkingSteps(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const paras = raw.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return paras.slice(0, MAX_THINKING_STEPS).map((para, i, arr) => {
    const lines = para.split('\n').map(l => l.trim()).filter(Boolean);
    // First sentence (up to first .!?) as title, rest as description
    const firstLine = lines[0] || '';
    const sentenceEnd = firstLine.search(/[.!?]/);
    const title =
      sentenceEnd !== -1
        ? firstLine.slice(0, sentenceEnd + 1).trim()
        : firstLine;
    const descParts = [];
    if (sentenceEnd !== -1 && firstLine.slice(sentenceEnd + 1).trim()) {
      descParts.push(firstLine.slice(sentenceEnd + 1).trim());
    }
    descParts.push(...lines.slice(1));
    const description = descParts.join(' ').trim().slice(0, MAX_DESCRIPTION_LEN);
    return {
      title:       title.slice(0, MAX_TITLE_LEN),
      description,
      done:        i < arr.length - 1, // last step may be in-progress
    };
  });
}

/**
 * Infer skill tags from parsed steps or raw thinking text.
 *
 * @param {{ title: string, description: string }[]} steps
 * @param {string} [raw]
 * @returns {string[]}
 */
export function inferThinkingTags(steps, raw = '') {
  const text = (steps.map(s => `${s.title} ${s.description}`).join(' ') + ' ' + raw).toLowerCase();
  const candidates = [
    { tag: 'logic',     pattern: /\blogic|deduc|infer|reasoning\b/ },
    { tag: 'recall',    pattern: /\brecall|remember|memor|retriev\b/ },
    { tag: 'structure', pattern: /\bstructur|organiz|format|outlin\b/ },
    { tag: 'analysis',  pattern: /\banalyz|analys|break.?down|examin\b/ },
    { tag: 'math',      pattern: /\bequat|formula|calculat|deriv|math\b/ },
    { tag: 'synthesis', pattern: /\bsynth|combin|integrat|summar\b/ },
  ];
  const found = candidates.filter(c => c.pattern.test(text)).map(c => c.tag);
  // Always return at least one tag when thinking mode is active
  return found.length > 0 ? found.slice(0, MAX_TAGS) : ['reasoning'];
}

/**
 * Mount a ThinkingAccordion island into `container`.
 *
 * @param {HTMLElement} container   DOM element to mount into (Preact owns it)
 * @param {object}      [options]
 * @param {{ title: string, description: string, done: boolean }[]} [options.steps]
 * @param {number}      [options.elapsed]      seconds
 * @param {string[]}    [options.tags]
 * @param {boolean}     [options.isStreaming]
 * @returns {{ update(patch: object): void, unmount(): void }}
 */
export function createThinkingAccordion(container, {
  steps       = [],
  elapsed     = 0,
  tags        = [],
  isStreaming  = false,
} = {}) {
  return mountIsland(ThinkingAccordionIsland, container, { steps, elapsed, tags, isStreaming });
}
