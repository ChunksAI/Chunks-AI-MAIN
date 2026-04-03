// @ts-nocheck
/**
 * src/components/ThinkingAccordion.jsx
 *
 * Reusable "Deep Thinking" accordion that shows the AI's raw reasoning text.
 * Collapsible header: "Thinking…" while streaming, elapsed label when done.
 * Body: scrollable raw <think> text; footer "Done" row when complete.
 *
 * Usage (via ThinkingAccordion.js bridge):
 *   import { createThinkingAccordion } from './ThinkingAccordion.js';
 *   const handle = createThinkingAccordion(containerEl, { thinkingText, elapsed, isStreaming });
 *   handle.update({ thinkingText: newText, elapsed: 42 });
 */

import { h } from 'preact';
import { useState, useCallback, useImperativeHandle } from 'preact/hooks';
import { forwardRef } from 'preact/compat';

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

/** Returns the elapsed-time label shown after thinking completes. */
function _elapsedLabel(seconds) {
  return seconds < 10 ? 'Thought for a few seconds' : `Thought for ${seconds} seconds`;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * ThinkingAccordionIsland
 *
 * Props (initial):
 *   thinkingText — string  (raw <think> content)
 *   elapsed      — number  (seconds, used for header label when done)
 *   isStreaming  — boolean (animates header dot while AI is still thinking)
 *
 * Imperative handle (via ref):
 *   update({ thinkingText?, elapsed?, isStreaming?, open? }) — partial state update
 */
export const ThinkingAccordionIsland = forwardRef(function ThinkingAccordionIsland(
  { thinkingText: initText = '', elapsed: initElapsed = 0, isStreaming: initStreaming = false },
  ref,
) {
  const [thinkingText, setThinkingText] = useState(initText);
  const [elapsed,      setElapsed]      = useState(initElapsed);
  const [isStreaming,  setIsStreaming]   = useState(initStreaming);
  // Auto-open when streaming so text appears immediately
  const [open,         setOpen]         = useState(initStreaming);

  const update = useCallback((patch = {}) => {
    if (patch.thinkingText !== undefined) setThinkingText(patch.thinkingText);
    if (patch.elapsed      !== undefined) setElapsed(patch.elapsed);
    if (patch.isStreaming  !== undefined) setIsStreaming(patch.isStreaming);
    if (patch.open         !== undefined) setOpen(patch.open);
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
    open && h('div', { class: 'ta-raw-text' },
      thinkingText
        ? h('pre', null, thinkingText)
        : h('pre', { style: { opacity: 0.45 } }, 'Thinking…'),
    ),

    // ── Footer "Done" row (only when not streaming) ────────────────────
    open && !isStreaming && h('div', { class: 'ta-footer-done' },
      h(_DoneIcon),
      'Done',
    ),
  );
});
