// @ts-nocheck
/**
 * src/components/ThinkingAccordion.jsx
 *
 * Reusable "Deep Thinking" accordion that shows the AI's reasoning steps.
 * Collapses to a single labelled row; expands to reveal each thought step
 * with title, description, completion state, elapsed time and skill tags.
 *
 * Usage (via ThinkingAccordion.js bridge):
 *   import { createThinkingAccordion } from './ThinkingAccordion.js';
 *   const handle = createThinkingAccordion(containerEl, { steps, elapsed, tags });
 *   handle.update({ steps: newSteps, elapsed: 42 });
 */

import { h, Fragment } from 'preact';
import { useState, useCallback, useImperativeHandle } from 'preact/hooks';
import { forwardRef } from 'preact/compat';

// ── Brain icon (inline SVG, matches the design images) ───────────────────────
const _BrainIcon = () => h('svg', {
  width: 20, height: 20, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  'aria-hidden': 'true',
},
  h('path', { d: 'M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z' }),
  h('path', { d: 'M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z' }),
);

// ── Chevron icon ─────────────────────────────────────────────────────────────
const _Chevron = ({ up }) => h('svg', {
  width: 14, height: 14, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  class: `ta-chevron-icon${up ? ' ta-chevron-up' : ''}`,
  'aria-hidden': 'true',
},
  h('polyline', { points: up ? '18 15 12 9 6 15' : '6 9 12 15 18 9' }),
);

// ── Tag colour map ────────────────────────────────────────────────────────────
const _TAG_COLORS = {
  logic:     'var(--violet)',
  recall:    'var(--teal)',
  structure: 'var(--gold)',
  analysis:  'var(--violet)',
  reasoning: 'var(--teal)',
  math:      'var(--gold)',
  synthesis: 'var(--teal)',
};

function _tagColor(tag) {
  return _TAG_COLORS[tag.toLowerCase()] || 'var(--text-3)';
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * ThinkingAccordionIsland
 *
 * Props (initial):
 *   steps      — [{title:string, description:string, done:boolean}]
 *   elapsed    — number (seconds shown in footer)
 *   tags       — string[] (skill pills shown in footer)
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
  const [elapsed,     setElapsed]     = useState(initElapsed);
  const [tags,        setTags]        = useState(initTags);
  const [isStreaming, setIsStreaming]  = useState(initStreaming);
  // Auto-open when streaming so steps appear immediately as they are added
  const [open,        setOpen]        = useState(initStreaming);

  const update = useCallback((patch = {}) => {
    if (patch.steps       !== undefined) setSteps(patch.steps);
    if (patch.elapsed     !== undefined) setElapsed(patch.elapsed);
    if (patch.tags        !== undefined) setTags(patch.tags);
    if (patch.isStreaming !== undefined) setIsStreaming(patch.isStreaming);
    if (patch.open        !== undefined) setOpen(patch.open);
  }, []);

  useImperativeHandle(ref, () => ({ update }), [update]);

  const toggle = useCallback(() => setOpen(o => !o), []);

  return h(Fragment, null,
    // ── Outer wrapper ───────────────────────────────────────────────────
    h('div', { class: 'ta-wrap' },

      // ── Mini header bar ("• Deep thinking …") ─────────────────────
      h('div', { class: 'ta-header' },
        h('span', { class: `ta-header-dot${isStreaming ? ' ta-header-dot--spin' : ''}`, 'aria-hidden': 'true' }),
        h('span', { class: 'ta-header-label' },
          'Deep thinking',
          isStreaming && h('span', { class: 'ta-ellipsis', 'aria-hidden': 'true' }, ' …'),
        ),
      ),

      // ── Collapsible row ────────────────────────────────────────────
      h('button', {
        class: `ta-accordion${open ? ' ta-accordion--open' : ''}`,
        onClick: toggle,
        'aria-expanded': String(open),
        type: 'button',
      },
        h('span', { class: 'ta-acc-icon', 'aria-hidden': 'true' }, h(_BrainIcon)),
        h('div', { class: 'ta-acc-text' },
          h('span', { class: 'ta-acc-title' }, 'Reasoning through this'),
          h('span', { class: 'ta-acc-sub' }, open ? 'Tap to hide' : 'Tap to see thought process'),
        ),
        h(_Chevron, { up: open }),
      ),

      // ── Expanded body ──────────────────────────────────────────────
      open && h('div', { class: 'ta-body', role: 'region' },
        steps.length === 0
          ? h('p', { class: 'ta-empty' }, isStreaming ? 'Thinking…' : 'No reasoning steps available.')
          : h(Fragment, null,
              steps.map((step, i) =>
                h('div', { class: 'ta-step', key: i },
                  h('span', {
                    class: `ta-step-dot${step.status === 'done' ? ' done' : step.status === 'active' ? ' active' : ''}`,
                    'aria-hidden': 'true',
                  }),
                  h('div', { class: 'ta-step-content' },
                    h('div', { class: 'ta-step-title' }, step.title),
                    step.description &&
                      h('div', { class: 'ta-step-desc' }, step.description),
                    step.status === 'active' &&
                      h('span', { class: 'ta-step-progress', 'aria-label': 'in progress' }, '• •'),
                  ),
                ),
              ),
              h('div', { class: 'ta-footer' },
                h('span', { class: 'ta-elapsed' },
                  isStreaming ? `Thinking for ${elapsed}s` : `Thought for ${elapsed}s`,
                ),
                tags.length > 0 && h('span', { class: 'ta-tags' },
                  tags.map(t =>
                    h('span', {
                      class: 'ta-tag',
                      key: t,
                      style: `--tag-color:${_tagColor(t)}`,
                    }, t),
                  ),
                ),
              ),
            ),
      ),
    ),
  );
});
