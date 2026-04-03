
// @ts-nocheck
/**
 * src/components/CanvasPanel.jsx — Canvas Panel island
 *
 * Displays structured AI-generated visual content ("artifacts") in the
 * Canvas workspace tab.
 *
 * State:
 *  • activeArtifact  — null (empty state) | artifact object
 *  • regenerating    — boolean, true while the mock regenerate animation runs
 *  • simplifying     — boolean, true while the AI simplify request is in flight
 *  • contentKey      — increments on each new artifact so the fade-in replays
 *
 * Supported artifact types:
 *
 *  visual_explanation:
 *  {
 *    type: "visual_explanation",
 *    title: string,
 *    steps: [{ heading, text, visual }]
 *  }
 *
 *  timeline:
 *  {
 *    type: "timeline",
 *    title: string,
 *    steps: [{ label, text, icon }]
 *  }
 *  diagram:
 *  {
 *    type: "diagram",
 *    title: string,
 *    svg: string,       // raw SVG markup; element ids match labels[].id
 *    labels: [{ id, name, description }]
 *  }
 *
 *  compare:
 *  {
 *    type: "compare",
 *    title: string,
 *    items: [{ name, color, attributes: [{ label, value }] }],
 *    key_difference: string
 *  }
 *
 *  • window.canvas.setArtifact(artifact)  — set/replace the active artifact
 *  • window.canvas.clearArtifact()        — reset to empty state
 *
 * Mount helper exported at the bottom is called from WorkspaceScreen.js.
 */

import { h, render } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { API_BASE, _getAuthHeader } from '../lib/api.js';
import { sanitize } from '../utils/render.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Stagger delay between consecutive step card fade-in animations (ms). */
const CARD_ANIM_STAGGER_MS = 60;

/** Duration of the mock regenerate animation (ms). */
const REGEN_DURATION_MS = 900;

// ── LoadingState ─────────────────────────────────────────────────────────────

/** Number of skeleton cards shown while the AI generates the visual explanation. */
const SKELETON_CARD_COUNT = 4;

/**
 * Skeleton loading placeholder shown on the Canvas panel while the backend
 * is generating the real visual explanation.  Displays the derived topic title
 * immediately (so the user knows what's coming) and 4 shimmer cards in place
 * of the actual step content.
 */
function LoadingState({ title }) {
  return h('div', { class: 'cvp-visual-explanation' },
    h('div', { class: 'cvp-ve-hero' },
      h('div', { class: 'cvp-ve-hero-badge' },
        h('svg', {
          width: '13', height: '13', viewBox: '0 0 24 24',
          fill: 'none', stroke: 'currentColor',
          'stroke-width': '2.5', 'stroke-linecap': 'round',
        },
          h('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' }),
        ),
        'Visual Explanation',
      ),
      h('h2', { class: 'cvp-ve-title' }, title),
      h('p', { class: 'cvp-ve-meta' }, 'Generating…'),
    ),
    h('ol', { class: 'cvp-ve-grid' },
      Array.from({ length: SKELETON_CARD_COUNT }, (_, i) =>
        h('li', {
          class: 'cvp-ve-card cvp-skel-card',
          key: i,
          style: `animation-delay:${i * CARD_ANIM_STAGGER_MS}ms`,
        },
          h('div', { class: 'cvp-ve-visual-box', 'aria-hidden': 'true' },
            h('span', { class: 'cvp-skel-emoji' }),
          ),
          h('div', { class: 'cvp-ve-card-body' },
            h('div', { class: 'cvp-ve-card-top' },
              h('span', { class: 'cvp-skel-badge' }),
            ),
            h('span', { class: 'cvp-skel-heading' }),
            h('p', { class: 'cvp-skel-text' }),
            h('p', { class: 'cvp-skel-text cvp-skel-text--short' }),
          ),
        )
      )
    ),
  );
}

// ── VisualExplanationRenderer ────────────────────────────────────────────────

/**
 * Small right-pointing arrow shown between two cards in the same row.
 * Communicates that the step on the left flows into the step on the right.
 */
function HArrow() {
  return h('div', { class: 'cvp-ve-h-arrow', 'aria-hidden': 'true' },
    h('svg', { width: '20', height: '20', viewBox: '0 0 20 20', fill: 'none' },
      h('line', { x1: '2', y1: '10', x2: '14', y2: '10', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' }),
      h('polyline', { points: '10,6 14,10 10,14', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }),
    ),
  );
}

/**
 * Snake connector shown between rows.
 * A CSS-drawn right-side-down + bottom-left path with a downward arrowhead
 * at the left end, visualising the row-wrap flow (col-2 of row N → col-1 of row N+1).
 */
function SnakeConnector() {
  return h('div', { class: 'cvp-ve-snake-connector', 'aria-hidden': 'true' },
    h('span', { class: 'cvp-ve-snake-tip' }),
  );
}

/**
 * Renders a visual_explanation artifact as a responsive 2-column snake-flow layout.
 *
 * Steps are grouped into rows of two. Within each row a horizontal arrow (→)
 * is placed between the cards. Between consecutive rows a snake connector
 * (right ↓ + bottom ← + arrowhead ↓) shows the wrap-around flow direction.
 *
 * Cards fade in sequentially via CSS animation-delay based on their index.
 * Hovering a card lifts it slightly (translateY + stronger shadow).
 *
 * On screens ≤ 480 px the arrows and connectors are hidden and cards stack
 * vertically; the numbered step badges still convey the sequence.
 */
function VisualExplanationRenderer({ artifact }) {
  const { title, steps = [] } = artifact;

  // Group steps into rows of 2 for the snake layout
  const rows = [];
  for (let i = 0; i < steps.length; i += 2) {
    rows.push(steps.slice(i, i + 2));
  }

  return h('div', { class: 'cvp-visual-explanation' },

    /* ── Hero header ──────────────────────────────────────── */
    h('div', { class: 'cvp-ve-hero' },
      h('div', { class: 'cvp-ve-hero-badge' },
        h('svg', {
          width: '13', height: '13', viewBox: '0 0 24 24',
          fill: 'none', stroke: 'currentColor',
          'stroke-width': '2.5', 'stroke-linecap': 'round',
        },
          h('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' }),
        ),
        'Visual Explanation',
      ),
      h('h2', { class: 'cvp-ve-title' }, title),
      h('p', { class: 'cvp-ve-meta' },
        `${steps.length} step${steps.length !== 1 ? 's' : ''}`
      ),
    ),

    /* ── Snake flow ───────────────────────────────────────── */
    h('div', { class: 'cvp-ve-flow' },
      ...rows.flatMap((row, rowIdx) => {
        const isLastRow = rowIdx === rows.length - 1;
        const baseIdx = rowIdx * 2;

        const rowEl = h('div', { class: 'cvp-ve-row', key: `row-${rowIdx}` },
          ...row.flatMap((step, colIdx) => {
            const idx = baseIdx + colIdx;
            const isLastInRow = colIdx === row.length - 1;
            return [
              /* Step card */
              h('div', {
                class: 'cvp-ve-card',
                key: `card-${idx}`,
                style: `animation-delay:${idx * CARD_ANIM_STAGGER_MS}ms`,
              },
                h('div', { class: 'cvp-ve-visual-box', 'aria-hidden': 'true' },
                  step.visual
                    ? h('span', { class: 'cvp-ve-visual-emoji' }, step.visual)
                    : h('span', { class: 'cvp-ve-visual-fallback' }, idx + 1),
                ),
                h('div', { class: 'cvp-ve-card-body' },
                  h('div', { class: 'cvp-ve-card-top' },
                    h('span', { class: 'cvp-ve-step-badge' }, `Step ${idx + 1}`),
                  ),
                  h('strong', { class: 'cvp-ve-heading' }, step.heading),
                  h('p', { class: 'cvp-ve-text' }, step.text),
                ),
              ),
              /* Horizontal arrow between the two cards in this row */
              !isLastInRow && h(HArrow, { key: `harrow-${idx}` }),
            ];
          })
        );

        return isLastRow
          ? [rowEl]
          : [rowEl, h(SnakeConnector, { key: `snake-${rowIdx}` })];
      })
    ),
  );
}

// ── TimelineRenderer ──────────────────────────────────────────────────────────

/** Stagger delay between consecutive timeline step animations (ms). */
const TIMELINE_STAGGER_MS = 80;

/**
 * Renders a timeline artifact as a vertical connected step list.
 *
 * Layout (left → right per step):
 *   • Gutter — numbered circle (emoji icon or step number) + connecting line
 *   • Body   — bold label + explanation text
 *
 * Steps fade in sequentially via CSS animation-delay. The last step
 * receives a finish marker (gold circle) instead of the connecting line.
 */
function TimelineRenderer({ artifact }) {
  const { title, steps = [] } = artifact;

  return h('div', { class: 'cvp-timeline' },

    /* ── Hero header ──────────────────────────────────────── */
    h('div', { class: 'cvp-tl-hero' },
      h('div', { class: 'cvp-tl-hero-badge' },
        h('svg', {
          width: '13', height: '13', viewBox: '0 0 24 24',
          fill: 'none', stroke: 'currentColor',
          'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        },
          h('line', { x1: '8', y1: '6', x2: '21', y2: '6' }),
          h('line', { x1: '8', y1: '12', x2: '21', y2: '12' }),
          h('line', { x1: '8', y1: '18', x2: '21', y2: '18' }),
          h('line', { x1: '3', y1: '6', x2: '3.01', y2: '6' }),
          h('line', { x1: '3', y1: '12', x2: '3.01', y2: '12' }),
          h('line', { x1: '3', y1: '18', x2: '3.01', y2: '18' }),
        ),
        'Timeline',
      ),
      h('h2', { class: 'cvp-tl-title' }, title),
      h('p', { class: 'cvp-tl-meta' },
        `${steps.length} step${steps.length !== 1 ? 's' : ''}`
      ),
    ),

    /* ── Step list ────────────────────────────────────────── */
    h('ol', { class: 'cvp-tl-list' },
      steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return h('li', {
          class: `cvp-tl-step${isLast ? ' cvp-tl-step--last' : ''}`,
          key: i,
          style: `animation-delay:${i * TIMELINE_STAGGER_MS}ms`,
        },

          /* Left gutter: line + circle */
          h('div', { class: 'cvp-tl-gutter', 'aria-hidden': 'true' },
            h('div', {
              class: `cvp-tl-circle${isLast ? ' cvp-tl-circle--finish' : ''}`,
            },
              isLast
                ? h('span', { class: 'cvp-tl-finish-star' }, '★')
                : step.icon
                  ? h('span', { class: 'cvp-tl-icon' }, step.icon)
                  : h('span', { class: 'cvp-tl-num' }, i + 1),
            ),
            !isLast && h('div', { class: 'cvp-tl-line' }),
          ),

          /* Right body: label + text */
          h('div', { class: 'cvp-tl-body' },
            h('strong', { class: 'cvp-tl-label' }, step.label),
            h('p', { class: 'cvp-tl-text' }, step.text),
          ),
        );
      })
    ),
  );
}

// ── DiagramRenderer ───────────────────────────────────────────────────────────

/**
 * Renders a diagram artifact: injects raw SVG full-width, wires up click
 * delegation to select labelled parts, shows an info card for the selection,
 * and renders a legend of all parts below the diagram.
 *
 * Interaction model:
 *   • Click a labelled SVG element (matched by id) → select it, show card
 *   • Click again or "Clear selection" → deselect
 *   • Highlighted element gets data-dg-selected="true" → CSS accent fill
 *   • Legend items are also clickable
 */
function DiagramRenderer({ artifact }) {
  const { title, svg = '', labels = [] } = artifact;
  const [selectedId, setSelectedId] = useState(null);
  const svgWrapRef = useRef(null);

  // id → label lookup built once (or when labels change)
  const labelMap = useMemo(() => {
    const m = {};
    labels.forEach(l => { m[l.id] = l; });
    return m;
  }, [labels]);

  // Inject SVG markup and attach click delegation whenever svg/labels change
  useEffect(() => {
    const wrap = svgWrapRef.current;
    if (!wrap) return;

    wrap.innerHTML = sanitize(svg);

    // Ensure the injected SVG is always centered and fills its container
    const svgEl = wrap.querySelector('svg');
    if (svgEl) {
      if (!svgEl.getAttribute('preserveAspectRatio')) {
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
      svgEl.setAttribute('width', '100%');
      svgEl.removeAttribute('height');
    }

    function handleClick(e) {
      let el = e.target;
      // Walk up the DOM tree to find an element whose id is a known label
      while (el && el !== wrap) {
        if (el.id && Object.prototype.hasOwnProperty.call(labelMap, el.id)) {
          setSelectedId(prev => (prev === el.id ? null : el.id));
          return;
        }
        el = el.parentElement;
      }
      // Click on unlabelled area — deselect
      setSelectedId(null);
    }

    wrap.addEventListener('click', handleClick);
    return () => wrap.removeEventListener('click', handleClick);
  }, [svg, labelMap]);

  // Sync highlight attribute on the SVG element whenever selectedId changes
  useEffect(() => {
    const wrap = svgWrapRef.current;
    if (!wrap) return;
    wrap.querySelectorAll('[data-dg-selected]').forEach(el => {
      el.removeAttribute('data-dg-selected');
    });
    if (selectedId) {
      const el = wrap.querySelector('#' + CSS.escape(selectedId));
      if (el) el.setAttribute('data-dg-selected', 'true');
    }
  }, [selectedId]);

  const selectedLabel = selectedId ? labelMap[selectedId] : null;

  return h('div', { class: 'cvp-diagram' },

    /* ── Hero header ──────────────────────────────────────── */
    h('div', { class: 'cvp-dg-hero' },
      h('div', { class: 'cvp-dg-hero-badge' },
        h('svg', {
          width: '13', height: '13', viewBox: '0 0 24 24',
          fill: 'none', stroke: 'currentColor',
          'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        },
          h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }),
          h('circle', { cx: '8.5', cy: '8.5', r: '1.5' }),
          h('polyline', { points: '21 15 16 10 5 21' }),
        ),
        'Diagram',
      ),
      h('h2', { class: 'cvp-dg-title' }, title),
      h('p', { class: 'cvp-dg-meta' },
        `${labels.length} labelled part${labels.length !== 1 ? 's' : ''} — tap to explore`
      ),
    ),

    /* ── SVG area ─────────────────────────────────────────── */
    h('div', { class: 'cvp-dg-svg-wrap' },
      h('div', { class: 'cvp-dg-svg', ref: svgWrapRef }),
    ),

    /* ── Info card for selected part ──────────────────────── */
    selectedLabel
      ? h('div', { class: 'cvp-dg-info' },
          h('div', { class: 'cvp-dg-info-top' },
            h('strong', { class: 'cvp-dg-info-name' }, selectedLabel.name),
            h('button', {
              class: 'cvp-dg-clear',
              onClick: () => setSelectedId(null),
              title: 'Clear selection',
            }, '✕'),
          ),
          h('p', { class: 'cvp-dg-info-desc' }, selectedLabel.description),
        )
      : null,

    /* ── Legend ───────────────────────────────────────────── */
    labels.length > 0 && h('div', { class: 'cvp-dg-legend' },
      h('p', { class: 'cvp-dg-legend-heading' }, 'Parts'),
      h('ul', { class: 'cvp-dg-legend-list' },
        labels.map(l =>
          h('li', {
            key: l.id,
            class: `cvp-dg-legend-item${selectedId === l.id ? ' cvp-dg-legend-item--active' : ''}`,
            onClick: () => setSelectedId(prev => (prev === l.id ? null : l.id)),
            role: 'button',
            tabIndex: 0,
          },
            h('span', { class: 'cvp-dg-legend-dot', 'aria-hidden': 'true' }),
            h('span', { class: 'cvp-dg-legend-name' }, l.name),
          )
        )
      ),
    ),
  );
}

// ── CompareRenderer ───────────────────────────────────────────────────────────

/** Maps the four allowed color tokens to their CSS variable pair. */
const COMPARE_COLORS = {
  purple: { bg: 'rgba(160,100,255,0.12)', border: 'rgba(160,100,255,0.35)', text: '#a064ff' },
  teal:   { bg: 'rgba(32,178,170,0.12)',  border: 'rgba(32,178,170,0.35)',  text: '#20b2aa' },
  amber:  { bg: 'rgba(245,166,35,0.12)',  border: 'rgba(245,166,35,0.35)',  text: '#f5a623' },
  coral:  { bg: 'rgba(255,99,71,0.12)',   border: 'rgba(255,99,71,0.35)',   text: '#ff6347' },
};

/**
 * Renders a compare artifact as a side-by-side column layout.
 *
 * Interaction model:
 *   • All items are displayed simultaneously — no selection needed
 *   • Rows where every item has a DIFFERENT value get a subtle accent background
 *   • "Key difference" card is pinned at the bottom
 *   • On narrow viewports CSS collapses columns to a single column
 */
function CompareRenderer({ artifact }) {
  const { title, items = [], key_difference = '' } = artifact;

  // Collect the full ordered list of attribute labels from the first item.
  // All items should share the same labels (enforced by the AI prompt).
  const rowLabels = (items[0]?.attributes || []).map(a => a.label);

  return h('div', { class: 'cvp-compare' },

    /* ── Hero header ──────────────────────────────────────── */
    h('div', { class: 'cvp-cmp-hero' },
      h('div', { class: 'cvp-cmp-hero-badge' },
        h('svg', {
          width: '13', height: '13', viewBox: '0 0 24 24',
          fill: 'none', stroke: 'currentColor',
          'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        },
          h('rect', { x: '2', y: '3', width: '20', height: '14', rx: '2' }),
          h('line', { x1: '12', y1: '3', x2: '12', y2: '17' }),
        ),
        'Compare',
      ),
      h('h2', { class: 'cvp-cmp-title' }, title),
      h('p', { class: 'cvp-cmp-meta' },
        `${items.length} items · ${rowLabels.length} attribute${rowLabels.length !== 1 ? 's' : ''}`
      ),
    ),

    /* ── Column grid ──────────────────────────────────────── */
    h('div', { class: `cvp-cmp-grid cvp-cmp-grid--${items.length}` },
      items.map((item) => {
        const palette = COMPARE_COLORS[item.color] || COMPARE_COLORS.purple;
        const attrMap = {};
        (item.attributes || []).forEach(a => { attrMap[a.label] = a.value; });

        return h('div', {
          key: item.name,
          class: 'cvp-cmp-col',
          style: `--cmp-bg:${palette.bg};--cmp-border:${palette.border};--cmp-text:${palette.text}`,
        },
          /* Column header */
          h('div', { class: 'cvp-cmp-col-header' }, item.name),
          /* Attribute rows */
          rowLabels.map(label => {
            // A row is "different" when not all items share the same value for this label
            const allValues = items.map(it =>
              ((it.attributes || []).find(a => a.label === label) || {}).value || ''
            );
            const isDiff = allValues.some(v => v !== allValues[0]);

            return h('div', {
              key: label,
              class: `cvp-cmp-row${isDiff ? ' cvp-cmp-row--diff' : ''}`,
            },
              h('span', { class: 'cvp-cmp-row-label' }, label),
              h('span', { class: 'cvp-cmp-row-value' }, attrMap[label] || '—'),
            );
          }),
        );
      })
    ),

    /* ── Key difference card ──────────────────────────────── */
    key_difference && h('div', { class: 'cvp-cmp-keydiff' },
      h('span', { class: 'cvp-cmp-keydiff-badge' }, '★ Key difference'),
      h('p', { class: 'cvp-cmp-keydiff-text' }, key_difference),
    ),
  );
}

// ── ArtifactRenderer ─────────────────────────────────────────────────────────

/**
 * Routes an artifact to the appropriate renderer based on artifact.type.
 * Renders an unknown-type notice for unrecognised types.
 */
function ArtifactRenderer({ artifact }) {
  if (artifact.type === 'visual_explanation') {
    return h(VisualExplanationRenderer, { artifact });
  }
  if (artifact.type === 'timeline') {
    return h(TimelineRenderer, { artifact });
  }
  if (artifact.type === 'diagram') {
    return h(DiagramRenderer, { artifact });
  }
  if (artifact.type === 'compare') {
    return h(CompareRenderer, { artifact });
  }
  return h('div', { class: 'cvp-unknown' },
    h('p', { class: 'cvp-unknown-text' },
      `Unknown artifact type: "${artifact.type}"`
    )
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState() {
  return h('div', { class: 'cvp-empty' },
    h('div', { class: 'cvp-empty-icon' },
      h('svg', {
        width: '28', height: '28', viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor',
        'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      },
        h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }),
        h('path', { d: 'M3 9h18' }),
        h('path', { d: 'M9 21V9' }),
      )
    ),
    h('p', { class: 'cvp-empty-heading' }, 'Visual Canvas'),
    h('p', { class: 'cvp-empty-text' },
      'Ask for a visual explanation in chat and it will appear here as an interactive card view.'
    ),
    h('div', { class: 'cvp-empty-hint' },
      h('span', { class: 'cvp-empty-hint-label' }, 'Try asking:'),
      h('button', {
        class: 'cvp-empty-prompt',
        onClick: () => {
          const inp = document.getElementById('ws-chat-input');
          if (inp) {
            inp.value = 'Explain photosynthesis visually';
            inp.focus();
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            if (typeof window.wsShowPanel === 'function') window.wsShowPanel('chat');
          }
        },
      }, '"Explain photosynthesis visually"'),
    ),
  );
}

// ── CanvasToolbar ─────────────────────────────────────────────────────────────

/**
 * Toolbar shown above the artifact content.
 *   • "← Chat"       — switches back to the chat panel
 *   • "✦ Simplify"   — calls AI to simplify the current artifact for beginners
 *   • "↻ Regenerate" — triggers a mock regenerate animation
 */
function CanvasToolbar({ onBackToChat, onSimplify, onRegenerate, regenerating, simplifying, showSimplify }) {
  const busy = regenerating || simplifying;
  return h('div', { class: 'cvp-toolbar' },
    h('button', {
      class: 'cvp-toolbar-btn cvp-btn-back',
      onClick: onBackToChat,
      title: 'Back to Chat',
    },
      h('svg', {
        width: '13', height: '13', viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor',
        'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      },
        h('polyline', { points: '15 18 9 12 15 6' }),
      ),
      'Chat',
    ),
    h('div', { class: 'cvp-toolbar-spacer' }),
    showSimplify && h('button', {
      class: `cvp-toolbar-btn cvp-btn-simplify${simplifying ? ' cvp-btn-simplify--loading' : ''}`,
      onClick: onSimplify,
      disabled: busy,
      title: 'Simplify this explanation for beginners',
    },
      h('svg', {
        class: 'cvp-simplify-icon',
        width: '13', height: '13', viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor',
        'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      },
        h('circle', { cx: '12', cy: '12', r: '3' }),
        h('path', { d: 'M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83' }),
      ),
      simplifying ? 'Simplifying…' : 'Simplify',
    ),
    h('button', {
      class: `cvp-toolbar-btn cvp-btn-regen${regenerating ? ' cvp-btn-regen--spinning' : ''}`,
      onClick: onRegenerate,
      disabled: busy,
      title: 'Regenerate explanation',
    },
      h('svg', {
        class: 'cvp-regen-icon',
        width: '13', height: '13', viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor',
        'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      },
        h('path', { d: 'M23 4v6h-6' }),
        h('path', { d: 'M1 20v-6h6' }),
        h('path', { d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' }),
      ),
      regenerating ? 'Regenerating…' : 'Regenerate',
    ),
  );
}

// ── CanvasPanel ───────────────────────────────────────────────────────────────

function CanvasPanel({ artifactSignal, loadingSignal }) {
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [loading, setLoading]               = useState(null); // { title } | null
  const [regenerating, setRegenerating]     = useState(false);
  const [simplifying, setSimplifying]       = useState(false);
  // Increments each time a new artifact is set so the fade-in animation replays
  const [contentKey, setContentKey]         = useState(0);
  const regenTimer  = useRef(null);
  const regenTimer2 = useRef(null);

  const artifactRef  = useRef(null);
  const simplifyCtrl = useRef(null); // AbortController for in-flight simplify request

  // Bridge: expose setActiveArtifact via the artifactSignal ref so the
  // mount helper can wire up window.canvas.setArtifact / clearArtifact.
  // Also wire up loadingSignal for the skeleton loading state.
  useEffect(() => {
    artifactSignal.current = (artifact) => {
      setLoading(null); // clear any loading skeleton when real artifact arrives
      artifactRef.current = artifact;
      setActiveArtifact(artifact);
      setContentKey(k => k + 1);
    };
    loadingSignal.current = ({ title }) => {
      setActiveArtifact(null);
      artifactRef.current = null;
      setLoading({ title });
    };
    return () => {
      if (regenTimer.current)  clearTimeout(regenTimer.current);
      if (regenTimer2.current) clearTimeout(regenTimer2.current);
      simplifyCtrl.current?.abort();
    };
  }, [artifactSignal, loadingSignal]);

  function handleBackToChat() {
    if (typeof window.wsShowPanel === 'function') window.wsShowPanel('chat');
  }

  function handleRegenerate() {
    if (regenerating || simplifying || !artifactRef.current) return;
    const snapshot = artifactRef.current;
    setRegenerating(true);
    regenTimer.current = setTimeout(() => {
      // Mock: briefly clear then restore artifact to replay the card animations
      setActiveArtifact(null);
      regenTimer2.current = setTimeout(() => {
        setActiveArtifact(snapshot);
        setContentKey(k => k + 1);
        setRegenerating(false);
      }, 120);
    }, REGEN_DURATION_MS);
  }

  async function handleSimplify() {
    if (regenerating || simplifying || !artifactRef.current) return;
    const artifact = artifactRef.current;

    // Diagram and compare artifacts don't have a steps array to simplify
    if (artifact.type === 'diagram' || artifact.type === 'compare') return;

    simplifyCtrl.current?.abort();
    simplifyCtrl.current = new AbortController();

    setSimplifying(true);
    try {
      const authHeader = await _getAuthHeader();

      // Build a compact summary of the artifact to keep the prompt tight.
      // Both artifact types have a 'steps' array; use whichever label field exists.
      const stepsSummary = (artifact.steps || [])
        .map((s, i) => `${i + 1}. ${s.heading || s.label}: ${s.text}`)
        .join('\n');
      const question = `Simplify this visual explanation further for beginners. Keep the same topic and the same format (${artifact.type}) but use simpler words, shorter sentences, and more everyday analogies.\n\nTopic: ${artifact.title}\n\nCurrent steps:\n${stepsSummary}`;

      const res = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        signal: simplifyCtrl.current.signal,
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          question,
          bookId: 'none',
          mode: 'visual_tutor',
          complexity: 3,
          history: [],
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const raw = (data.answer || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const candidate = JSON.parse(raw);
      const validTypes = ['visual_explanation', 'timeline'];
      if (candidate && validTypes.includes(candidate.type) && Array.isArray(candidate.steps)) {
        artifactRef.current = candidate;
        setActiveArtifact(candidate);
        setContentKey(k => k + 1);
      } else {
        throw new Error('Unexpected artifact format');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        if (typeof window.wsShowToast === 'function') {
          window.wsShowToast('Could not simplify — please try again.');
        }
      }
    } finally {
      setSimplifying(false);
    }
  }

  return h('div', { class: 'cvp-root' },
    activeArtifact
      ? h('div', { class: 'cvp-with-toolbar' },
          h(CanvasToolbar, {
            onBackToChat: handleBackToChat,
            onSimplify: handleSimplify,
            onRegenerate: handleRegenerate,
            regenerating,
            simplifying,
            showSimplify: activeArtifact?.type !== 'diagram' && activeArtifact?.type !== 'compare',
          }),
          h('div', { class: 'cvp-content', key: contentKey },
            h(ArtifactRenderer, { artifact: activeArtifact }),
          ),
        )
      : loading
        ? h('div', { class: 'cvp-with-toolbar' },
            h(CanvasToolbar, {
              onBackToChat: handleBackToChat,
              onSimplify: null,
              onRegenerate: null,
              regenerating: false,
              simplifying: false,
              showSimplify: false,
            }),
            h('div', { class: 'cvp-content' },
              h(LoadingState, { title: loading.title }),
            ),
          )
        : h(EmptyState, null),
  );
}

// ── Mount helper ──────────────────────────────────────────────────────────────

/**
 * Mount the CanvasPanel Preact island into the given container element.
 * Also wires up window.canvas.setArtifact() and window.canvas.clearArtifact()
 * so any part of the app can push an artifact to the Canvas panel.
 */
export function mountCanvasPanel(container) {
  if (!container) return;

  // A mutable ref shared between this scope and the component instance
  const artifactSignal = { current: null };
  const loadingSignal  = { current: null };

  render(h(CanvasPanel, { artifactSignal, loadingSignal }), container);

  // Expose the external API on window.canvas
  window.canvas = {
    setArtifact(artifact) {
      if (typeof artifactSignal.current === 'function') {
        artifactSignal.current(artifact);
      }
    },
    clearArtifact() {
      if (typeof artifactSignal.current === 'function') {
        artifactSignal.current(null);
      }
    },
    setLoading(title) {
      if (typeof loadingSignal.current === 'function') {
        loadingSignal.current({ title });
      }
    },
  };
}
