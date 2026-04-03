
// @ts-nocheck
/**
 * src/components/CanvasPanel.jsx — Canvas Panel island
 *
 * Displays structured AI-generated visual content ("artifacts") in the
 * Canvas workspace tab.
 *
 * State:
 *  • activeArtifact — null (empty state) | artifact object
 *
 * Artifact format (visual_explanation):
 *  {
 *    type: "visual_explanation",
 *    title: string,
 *    steps: [{ heading, text, visual }]
 *  }
 *
 * External API (window.canvas):
 *  • window.canvas.setArtifact(artifact)  — set/replace the active artifact
 *  • window.canvas.clearArtifact()        — reset to empty state
 *
 * Mount helper exported at the bottom is called from WorkspaceScreen.js.
 */

import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Stagger delay between consecutive step card fade-in animations (ms). */
const CARD_ANIM_STAGGER_MS = 60;

// ── VisualExplanationRenderer ────────────────────────────────────────────────

/**
 * Renders a visual_explanation artifact as a responsive 2-column card grid.
 *
 * Card layout (top → bottom):
 *   1. Visual placeholder box — shows step.visual (emoji / icon) centred
 *      against a subtle gradient background; acts as the "image area"
 *   2. Step badge + heading row
 *   3. Descriptive text
 *
 * Cards fade in sequentially via CSS animation-delay based on their index.
 * Hovering a card lifts it slightly (translateY + stronger shadow).
 */
function VisualExplanationRenderer({ artifact }) {
  const { title, steps = [] } = artifact;

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

    /* ── Step grid ────────────────────────────────────────── */
    h('ol', { class: 'cvp-ve-grid' },
      steps.map((step, i) =>
        h('li', {
          class: 'cvp-ve-card',
          key: i,
          style: `animation-delay:${i * CARD_ANIM_STAGGER_MS}ms`,
        },
          /* Visual placeholder box */
          h('div', { class: 'cvp-ve-visual-box', 'aria-hidden': 'true' },
            step.visual
              ? h('span', { class: 'cvp-ve-visual-emoji' }, step.visual)
              : h('span', { class: 'cvp-ve-visual-fallback' }, i + 1),
          ),

          /* Card body */
          h('div', { class: 'cvp-ve-card-body' },
            h('div', { class: 'cvp-ve-card-top' },
              h('span', { class: 'cvp-ve-step-badge' }, `Step ${i + 1}`),
            ),
            h('strong', { class: 'cvp-ve-heading' }, step.heading),
            h('p', { class: 'cvp-ve-text' }, step.text),
          ),
        )
      )
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
        width: '32', height: '32', viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor',
        'stroke-width': '1.5', 'stroke-linecap': 'round',
      },
        h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }),
        h('path', { d: 'M3 9h18' }),
        h('path', { d: 'M9 21V9' }),
      )
    ),
    h('p', { class: 'cvp-empty-text' },
      'Ask something in chat to generate a visual explanation'
    ),
  );
}

// ── CanvasPanel ───────────────────────────────────────────────────────────────

function CanvasPanel({ artifactSignal }) {
  const [activeArtifact, setActiveArtifact] = useState(null);

  // Bridge: expose setActiveArtifact via the artifactSignal ref so the
  // mount helper can wire up window.canvas.setArtifact / clearArtifact.
  useEffect(() => {
    artifactSignal.current = setActiveArtifact;
  }, [artifactSignal]);

  return h('div', { class: 'cvp-root' },
    activeArtifact
      ? h('div', { class: 'cvp-content' },
          h(ArtifactRenderer, { artifact: activeArtifact }),
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

  render(h(CanvasPanel, { artifactSignal }), container);

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
  };
}
