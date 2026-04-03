// @ts-nocheck
/**
 * src/components/ThinkingAccordion.jsx
 *
 * Reusable "Deep Thinking" accordion that shows the AI's reasoning steps.
 * Collapsed by default — header shows "Thinking…" (+ pulsing dot) while the
 * model is reasoning, or "Thought for X seconds" when done.
 * Expanded body lists step labels with document icons; a ✓ Done row caps the
 * list when reasoning is complete.
 *
 * Usage (via ThinkingAccordion.js bridge):
 *   import { createThinkingAccordion } from './ThinkingAccordion.js';
 *   const handle = createThinkingAccordion(containerEl, { thinkingText, elapsed, isStreaming });
 *   handle.update({ steps: ['Step A', 'Step B'], open: true });
 */

import { h } from 'preact';
import { useState, useCallback, useImperativeHandle } from 'preact/hooks';
import { forwardRef } from 'preact/compat';

// ── Done icon (circle checkmark) ─────────────────────────────────────────────
const _DoneIcon = () => h('svg', {
  width: 14, height: 14, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  'aria-hidden': 'true',
},
  h('circle', { cx: 12, cy: 12, r: 10 }),
  h('polyline', { points: '9 12 11 14 15 10' }),
);

// ── Document icon (shown beside each step) ────────────────────────────────────
const _DocIcon = () => h('svg', {
  width: 13, height: 13, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  'aria-hidden': 'true',
  style: { flexShrink: 0, color: 'var(--text-4)' },
},
  h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
  h('polyline', { points: '14 2 14 8 20 8' }),
);

// ── Chevron ───────────────────────────────────────────────────────────────────
const _Chevron = ({ up }) => h('svg', {
  width: 12, height: 12, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  'aria-hidden': 'true',
},
  h('polyline', { points: up ? '18 15 12 9 6 15' : '6 9 12 15 18 9' }),
);

/** Returns the elapsed-time label shown after thinking completes. */
function _elapsedLabel(seconds) {
  return seconds < 10 ? 'Thought for a few seconds' : `Thought for ${seconds} seconds`;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * ThinkingAccordionIsland
 *
 * Props (initial):
 *   steps        — string[]  (step labels extracted from thinking content)
 *   elapsed      — number    (seconds, used for header label when done)
 *   isStreaming  — boolean   (animates header dot while AI is still thinking)
 *
 * Imperative handle (via ref):
 *   update({ steps?, elapsed?, isStreaming?, open? }) — partial state update
 */
export const ThinkingAccordionIsland = forwardRef(function ThinkingAccordionIsland(
  { steps: initSteps = [], elapsed: initElapsed = 0, isStreaming: initStreaming = false },
  ref,
) {
  const [steps,       setSteps]       = useState(initSteps);
  const [elapsed,     setElapsed]     = useState(initElapsed);
  const [isStreaming, setIsStreaming]  = useState(initStreaming);
  // Always collapsed by default — user must click to expand
  const [open,        setOpen]        = useState(false);

  const update = useCallback((patch = {}) => {
    if (patch.steps       !== undefined) setSteps(patch.steps);
    if (patch.elapsed     !== undefined) setElapsed(patch.elapsed);
    if (patch.isStreaming !== undefined) setIsStreaming(patch.isStreaming);
    if (patch.open        !== undefined) setOpen(patch.open);
  }, []);

  useImperativeHandle(ref, () => ({ update }), [update]);

  const toggle = useCallback(() => setOpen(o => !o), []);

  const summary = isStreaming ? 'Thinking…' : _elapsedLabel(elapsed);

  return h('div', { class: 'ta-wrap' },

    // ── Collapsible header ─────────────────────────────────────────────
    h('button', {
      class: 'ta-header-btn',
      onClick: toggle,
      'aria-expanded': String(open),
      type: 'button',
    },
      isStreaming && h('span', { class: 'ta-stream-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'ta-summary' }, summary),
      h(_Chevron, { up: open }),
    ),

    // ── Expanded body ──────────────────────────────────────────────────
    open && h('div', { class: 'ta-steps-body' },
      isStreaming
        // While AI is still thinking: three pulsing dots
        ? h('div', { class: 'ta-steps-waiting', 'aria-label': 'Thinking' },
            h('span', { class: 'ta-wait-dot' }),
            h('span', { class: 'ta-wait-dot' }),
            h('span', { class: 'ta-wait-dot' }),
          )
        // After thinking: step-by-step labels with document icons
        : steps.length > 0 && h('ul', { class: 'ta-steps-list', role: 'list' },
            steps.map((step, i) =>
              h('li', { key: step + i, class: 'ta-step-item' },
                h(_DocIcon),
                h('span', { class: 'ta-step-label' }, step),
              ),
            ),
            // ✓ Done row at the bottom of the list
            h('li', { class: 'ta-step-done' },
              h(_DoneIcon),
              h('span', null, 'Done'),
            ),
          ),
    ),
  );
});
