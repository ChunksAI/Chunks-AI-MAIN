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

import { mountIsland }             from '../preact/bridge.js';
import { ThinkingAccordionIsland } from './ThinkingAccordion.jsx';

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_THINKING_STEPS  = 8;   // cap per-response to keep the UI readable
const MAX_DESCRIPTION_LEN = 300; // chars per step description
const MAX_TAGS            = 3;   // skill pills shown in footer
const TYPEWRITER_SPEED_MS = 18;  // ms per word while animating

// Timing constants for the natural-feeling inter-step pause
const BASE_PAUSE_MS   = 200;   // minimum pause between steps (ms)
const PAUSE_PER_CHAR  = 2;     // extra ms added per character of description
const MAX_PAUSE_MS    = 1200;  // ceiling on the content-length pause
const MAX_JITTER_MS   = 150;   // random extra delay so timing feels organic

// ── Private helpers ───────────────────────────────────────────────────────────

/** Derive a human-readable label for a reasoning chunk. */
function _inferStepLabel(text) {
  const t = text.toLowerCase();
  if (/what\b|how\b|why\b|understand|question|asking/i.test(t))              return 'Understanding the question';
  if (/recall|remember|know\b|defined|definition|means\b/i.test(t))          return 'Recalling key concepts';
  if (/gravity|formula|equation|f\s*=|g\s*=|weight|mass|force|calculat|convert|multipl|divid/i.test(t))
                                                                              return 'Applying the formula';
  if (/therefore|so the|thus\b|answer\b|result\b|conclud|would be|=\s*\d/i.test(t))
                                                                              return 'Reaching a conclusion';
  if (/check\b|verify|confirm|make sure|correct|double/i.test(t))            return 'Verifying the answer';
  if (/step|first\b|next\b|then\b|finally/i.test(t))                        return 'Working through the steps';
  if (/example|instance|such as|imagine|like\b/i.test(t))                    return 'Building an example';
  if (/structur|explain\b|present\b|response\b/i.test(t))                   return 'Structuring the response';
  return 'Reasoning through this';
}

/** Derive a skill tag for a reasoning chunk. */
function _inferStepTag(text) {
  const t = text.toLowerCase();
  if (/\d+\.?\d*\s*[*\/+\-]\s*\d|formula|equation|calculat|=\s*\d|math|number/i.test(t)) return 'math';
  if (/recall|remember|fact\b|definition|know that/i.test(t))      return 'recall';
  if (/structur|organiz|format\b|present|explain/i.test(t))        return 'structure';
  if (/verify|check\b|confirm|correct/i.test(t))                   return 'verify';
  if (/analyz|compar|contrast|evaluat/i.test(t))                    return 'analysis';
  return 'logic';
}

/**
 * Typewrite `text` into an element word by word.
 * Calls `onUpdate(partial)` on each word; resolves when complete.
 * Registers the internal interval in `intervals` for cleanup.
 */
function _typewriter(text, onUpdate, intervals, isCancelled) {
  return new Promise(resolve => {
    const words = text.split(' ');
    let i = 0;
    let partial = '';
    const id = setInterval(() => {
      if (isCancelled()) {
        clearInterval(id);
        const ix = intervals.indexOf(id);
        if (ix !== -1) intervals.splice(ix, 1);
        resolve();
        return;
      }
      if (i < words.length) {
        partial += (i === 0 ? '' : ' ') + words[i];
        i++;
        onUpdate(partial);
      } else {
        clearInterval(id);
        const ix = intervals.indexOf(id);
        if (ix !== -1) intervals.splice(ix, 1);
        resolve();
      }
    }, TYPEWRITER_SPEED_MS);
    intervals.push(id);
  });
}

/**
 * Reveal steps one at a time with typewriter effect.
 * Each step fades in, then its description types in word by word, then the next
 * step begins.  A live elapsed counter ticks up every second until all steps
 * are shown, then the accordion is finalised with the actual `finalElapsed` value.
 */
async function _animateSteps(steps, finalElapsed, tags, handle, intervals, container, isCancelled) {
  const _wait = ms => new Promise(res => setTimeout(res, ms));

  // Live elapsed counter
  let liveElapsed = 0;
  const timerId = setInterval(() => {
    liveElapsed++;
    if (!isCancelled()) handle.update({ elapsed: liveElapsed });
  }, 1000);
  intervals.push(timerId);

  const revealed = []; // accumulates steps as they complete

  for (let i = 0; i < steps.length; i++) {
    if (isCancelled()) break;

    const step = steps[i];

    // 1. Append step with empty description and pulsing dot
    revealed.push({ title: step.title, description: '', status: 'active' });
    handle.update({ steps: [...revealed] });

    // Scroll newest step into view after a short paint delay
    await _wait(50);
    if (!isCancelled()) {
      container.querySelector('.ta-step:last-child')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 2. Brief pause so the fade-in CSS transition completes before typing starts
    await _wait(250);
    if (isCancelled()) break;

    // 3. Typewrite description word by word
    if (step.description) {
      await _typewriter(
        step.description,
        partial => {
          if (isCancelled()) return;
          revealed[i] = { ...revealed[i], description: partial };
          handle.update({ steps: [...revealed] });
        },
        intervals,
        isCancelled,
      );
    }
    if (isCancelled()) break;

    // 4. Mark step done — dot turns solid purple
    revealed[i] = { ...revealed[i], status: 'done' };
    handle.update({ steps: [...revealed] });

    // 5. Natural pause before the next step (longer for denser content)
    if (i < steps.length - 1) {
      const pauseMs = Math.min(BASE_PAUSE_MS + step.description.length * PAUSE_PER_CHAR, MAX_PAUSE_MS);
      const jitter  = Math.random() * MAX_JITTER_MS;
      await _wait(pauseMs + jitter);
    }
  }

  // Finalise — stop the timer, flip isStreaming off, set real elapsed + tags
  clearInterval(timerId);
  const tix = intervals.indexOf(timerId);
  if (tix !== -1) intervals.splice(tix, 1);

  if (!isCancelled()) {
    revealed.forEach(s => { s.status = 'done'; });
    handle.update({ isStreaming: false, elapsed: finalElapsed, steps: [...revealed], tags });
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse raw `<think>...</think>` content (or plain prose) into structured
 * reasoning steps.  Splits on blank lines and numbered list markers first;
 * falls back to sentence-level grouping so single-paragraph content still
 * produces multiple meaningful steps.
 *
 * @param {string} raw
 * @returns {{ id: string, title: string, description: string, status: string, tag: string }[]}
 */
export function parseThinkingSteps(raw) {
  // Guard — if truly empty, return nothing (caller decides fallback)
  if (!raw || typeof raw !== 'string' || raw.trim().length < 10) return [];

  // 1. Try paragraph breaks or numbered-list markers first
  let chunks = raw
    .split(/\n{2,}|\n(?=\d+\.\s)/)
    .map(s => s.replace(/\n/g, ' ').trim())
    .filter(s => s.length > 15);

  // 2. If no paragraph breaks produced multiple chunks, try sentence grouping
  if (chunks.length <= 1) {
    const sentences = raw
      .replace(/\n/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 10);

    if (sentences.length > 1) {
      // Group into clusters of 2-3 sentences
      chunks = [];
      for (let i = 0; i < sentences.length; i += 2) {
        chunks.push(sentences.slice(i, i + 2).join(' '));
      }
    }
  }

  // 3. If still only one chunk, use it as-is
  if (chunks.length === 0) {
    const text = raw.trim();
    if (text.length === 0) return [];
    chunks = [text];
  }

  return chunks.slice(0, MAX_THINKING_STEPS).map((chunk, i) => ({
    id:          String(i + 1),
    title:       _inferStepLabel(chunk),
    description: chunk.slice(0, MAX_DESCRIPTION_LEN),
    status:      'done',
    tag:         _inferStepTag(chunk),
  }));
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
  return found.length > 0 ? found.slice(0, MAX_TAGS) : ['reasoning'];
}

/**
 * Mount a ThinkingAccordion island into `container` and play the sequential
 * step-reveal animation.  Steps appear one at a time with a typewriter effect;
 * a live elapsed counter ticks up until all steps are shown.
 *
 * @param {HTMLElement} container   DOM element to mount into (Preact owns it)
 * @param {object}      [options]
 * @param {{ title: string, description: string }[]} [options.steps]
 * @param {number}      [options.elapsed]      final seconds (shown after animation)
 * @param {string[]}    [options.tags]
 * @param {boolean}     [options.isStreaming]  unused by caller — bridge manages it
 * @returns {{ update(patch: object): void, unmount(): void }}
 */
export function createThinkingAccordion(container, {
  steps      = [],
  elapsed    = 0,
  tags       = [],
} = {}) {
  const hasSteps = steps.length > 0;

  // Mount the Preact shell with empty steps; animation fills them in
  const handle = mountIsland(ThinkingAccordionIsland, container, {
    steps:       [],
    elapsed:     0,
    tags:        [],
    isStreaming: hasSteps,
  });

  const _intervals = [];
  let   _cancelled = false;

  const _origUnmount = handle.unmount?.bind(handle) ?? (() => {});
  handle.unmount = () => {
    _cancelled = true;
    _intervals.forEach(id => clearInterval(id));
    _origUnmount();
  };

  if (hasSteps) {
    // Store the animation promise so callers can await completion before
    // rendering the AI response (think-first, then respond behaviour).
    handle.animationDone = _animateSteps(
      steps, elapsed, tags, handle, _intervals, container, () => _cancelled,
    ).then(() => {
      // Auto-collapse once all steps have been revealed so the thinking block
      // is neatly tucked away before the AI response starts rendering.
      if (!_cancelled) handle.update({ open: false });
    });
  } else {
    // No content to animate — show finalised state immediately
    handle.update({ isStreaming: false, elapsed, tags });
    handle.animationDone = Promise.resolve();
  }

  return handle;
}
