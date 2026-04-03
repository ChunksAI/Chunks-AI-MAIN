// @ts-nocheck
/**
 * src/components/ThinkingAccordion.jsx
 *
 * Reusable "Deep Thinking" accordion that shows the AI's reasoning steps.
 * Claude-style: a collapsible header summarising the steps, expanding to a
 * clean list of step titles + a "Done" row when complete.
 *
 * Usage (via ThinkingAccordion.js bridge):
 *   import { createThinkingAccordion } from './ThinkingAccordion.js';
 *   const handle = createThinkingAccordion(containerEl, { steps, elapsed, tags });
 *   handle.update({ steps: newSteps, elapsed: 42 });
 */

import { h } from 'preact';
import { useState, useCallback, useImperativeHandle } from 'preact/hooks';
import { forwardRef } from 'preact/compat';

// ── Step icon (document with lines) ──────────────────────────────────────────
const _StepIcon = () => h('svg', {
  width: 15, height: 15, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  'aria-hidden': 'true',
},
  h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
  h('polyline', { points: '14 2 14 8 20 8' }),
  h('line', { x1: '16', y1: '13', x2: '8', y2: '13' }),
  h('line', { x1: '16', y1: '17', x2: '8', y2: '17' }),
);

// ── Done icon (circle checkmark) ──────────────────────────────────────────────
const _DoneIcon = () => h('svg', {
  width: 15, height: 15, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  'aria-hidden': 'true',
},
  h('circle', { cx: 12, cy: 12, r: 10 }),
  h('polyline', { points: '9 12 11 14 15 10' }),
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

// ── Component ────────────────────────────────────────────────────────────────

/**
 * ThinkingAccordionIsland
 *
 * Props (initial):
 *   steps      — [{title:string, status:string}]
 *   elapsed    — number (unused visually, kept for bridge API compat)
 *   tags       — string[] (unused visually, kept for bridge API compat)
 *   isStreaming — boolean (animates header dot while AI is still thinking)
 *
 * Imperative handle (via ref):
 *   update({ steps?, elapsed?, tags?, isStreaming? }) — partial state update
 */
export const ThinkingAccordionIsland = forwardRef(function ThinkingAccordionIsland(
  { steps: initSteps = [], elapsed: initElapsed = 0, tags: initTags = [], isStreaming: initStreaming = false },
  ref,
) {
  const [steps,       setSteps]       = useState(initSteps);
  const [isStreaming, setIsStreaming]  = useState(initStreaming);
  // Auto-open when streaming so steps appear immediately
  const [open,        setOpen]        = useState(initStreaming);

  const update = useCallback((patch = {}) => {
    if (patch.steps       !== undefined) setSteps(patch.steps);
    if (patch.isStreaming !== undefined) setIsStreaming(patch.isStreaming);
    if (patch.open        !== undefined) setOpen(patch.open);
  }, []);

  useImperativeHandle(ref, () => ({ update }), [update]);

  const toggle = useCallback(() => setOpen(o => !o), []);

  // Header summary: join first few step titles, truncate with ellipsis
  const summary = steps.length > 0
    ? steps.slice(0, 4).map(s => s.title).join(', ') + (steps.length > 4 ? ', …' : '')
    : isStreaming ? 'Thinking…' : 'Reasoning steps';

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

    // ── Expanded step list ─────────────────────────────────────────────
    open && h('div', { class: 'ta-list', role: 'list' },
      steps.length === 0
        ? h('p', { class: 'ta-empty' }, 'Thinking…')
        : steps.map((step, i) =>
            h('div', { class: 'ta-list-item', key: i, role: 'listitem' },
              h('span', { class: 'ta-item-icon', 'aria-hidden': 'true' }, h(_StepIcon)),
              h('span', { class: 'ta-item-title' }, step.title),
            ),
          ),
      !isStreaming && steps.length > 0 && h('div', { class: 'ta-list-item ta-done-item', role: 'listitem' },
        h('span', { class: 'ta-item-icon ta-done-icon', 'aria-hidden': 'true' }, h(_DoneIcon)),
        h('span', { class: 'ta-item-title ta-done-title' }, 'Done'),
      ),
    ),
  );
});
