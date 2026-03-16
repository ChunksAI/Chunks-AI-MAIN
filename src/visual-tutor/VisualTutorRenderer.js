/**
 * src/visual-tutor/VisualTutorRenderer.js  — v2
 *
 * Master coordinator for the Visual Tutor system.
 * Manages three rendering modes and wires them to the AI pipeline.
 *
 * Rendering modes:
 *   WHITEBOARD   — WhiteboardEngine SVG step-by-step drawing
 *   SIMULATION   — interactive HTML controls (sliders, toggles)
 *   PARTICLE     — CSS/SVG particle flows (legacy ParticleSystem)
 *
 * Usage:
 *   const renderer = new VisualTutorRenderer(canvasEl, chatCallback);
 *   renderer.ask("how does a neuron fire");
 *   renderer.replay();
 *   renderer.stop();
 */

import { WhiteboardEngine }                     from './WhiteboardEngine.js';
import { buildDiagramPrompt, buildIntroPrompt,
         parseBlueprint, detectDiagramType }    from './DiagramBlueprintGenerator.js';

// ── Constants ─────────────────────────────────────────────────────────────────

export const MODE = Object.freeze({
  WHITEBOARD:  'whiteboard',
  SIMULATION:  'simulation',
  PARTICLE:    'particle',
  IDLE:        'idle',
});

// Concepts that have dedicated simulations (interactive sliders / controls)
const SIMULATION_CONCEPTS = new Set([
  'osmosis','supply','demand','supply and demand','market equilibrium',
  'pendulum','wave','frequency','ohm','ohms law',
]);

// ── VisualTutorRenderer ───────────────────────────────────────────────────────

export class VisualTutorRenderer {
  /**
   * @param {HTMLElement} canvasContainer  — the .vt-canvas-area element
   * @param {object}      options
   * @param {function}    options.onNarration  — (text, stepIdx, total) → void
   * @param {function}    options.onTopic      — (topicName) → void
   * @param {function}    options.onComplete   — () → void
   * @param {function}    options.onError      — (err) → void
   * @param {function}    options.onModeChange — (mode) → void
   * @param {string}      options.apiBase      — backend base URL
   * @param {function}    options.getLanguage  — () → string
   * @param {function}    options.getSafeMode  — () → boolean
   */
  constructor(canvasContainer, options = {}) {
    this._container   = canvasContainer;
    this._opts        = options;
    this._mode        = MODE.IDLE;
    this._engine      = null;
    this._abort       = null;
    this._lastConcept = null;
    this._lastTopic   = '';
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  get mode()    { return this._mode; }
  get topic()   { return this._lastTopic; }

  /** Stop any running animation/fetch */
  stop() {
    this._abort?.abort();
    this._engine?.stop();
    this._engine = null;
  }

  /** Replay the last concept without re-fetching */
  replay() {
    if (!this._lastConcept) return;
    this._runWhiteboard(this._lastConcept, this._lastTopic);
  }

  /**
   * Main entry point — ask about any topic.
   * Decides mode, fetches AI, renders.
   * @param {string} question
   */
  async ask(question) {
    this.stop();
    this._abort = new AbortController();

    const q          = question.trim();
    const simKey     = q.toLowerCase().replace(/^(explain|show me|what is|how does|how do)\s+/i, '').trim();
    const topicName  = simKey.replace(/\b\w/g, c => c.toUpperCase());

    this._lastTopic = topicName;
    this._opts.onTopic?.(topicName);
    this._setMode(MODE.WHITEBOARD);
    this._showLoading(q);

    try {
      // ── Step 1: try simulation first ──────────────────────────────────────
      if (SIMULATION_CONCEPTS.has(simKey)) {
        const simMod = await this._tryLoadSimulation(simKey);
        if (simMod) {
          this._setMode(MODE.SIMULATION);
          this._renderSimulation(simMod, topicName);
          return;
        }
      }

      // ── Step 2: generate diagram blueprint ────────────────────────────────
      const hint       = detectDiagramType(q);
      const prompt     = buildDiagramPrompt(q, hint);
      const rawAnswer  = await this._fetch(prompt, 8);
      const concept    = parseBlueprint(rawAnswer);

      if (!concept) throw new Error('Could not parse diagram blueprint');

      this._lastConcept = concept;

      // ── Step 3: intro narration ───────────────────────────────────────────
      const intro = await this._fetch(buildIntroPrompt(q), 4).catch(() =>
        `Here's a detailed diagram of ${q}. I'll draw it step by step.`
      );
      this._opts.onNarration?.(intro, -1, concept.steps.length);

      // ── Step 4: render ────────────────────────────────────────────────────
      this._runWhiteboard(concept, topicName);

    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('[VisualTutorRenderer]', e);
      this._opts.onError?.(e);

      // Graceful fallback — plain text explanation
      const fallback = await this._fetch(
        `Explain "${q}" in 3-4 sentences. Be concrete and vivid. No bullet points.`, 5
      ).catch(() => '');
      if (fallback) this._opts.onNarration?.(fallback, -1, 0);
      this._showError(q);
    }
  }

  // ── Whiteboard rendering ───────────────────────────────────────────────────

  _runWhiteboard(concept, topicName) {
    this._setMode(MODE.WHITEBOARD);
    this._engine?.stop();

    this._engine = new WhiteboardEngine(
      this._container,
      concept,
      (idx, narration, total) => {
        this._opts.onTopic?.(`${topicName} — Step ${idx + 1} of ${total}`);
        if (narration) this._opts.onNarration?.(narration, idx, total);
      },
      () => {
        this._opts.onTopic?.(`${topicName} — complete`);
        this._opts.onComplete?.();
      },
      { jitter: true, jitterAmount: 0.8 }
    );
    this._engine.start();
  }

  // ── Simulation rendering ───────────────────────────────────────────────────

  _renderSimulation(simMod, topicName) {
    this._container.innerHTML = simMod.html;
    simMod.init?.(this._container);
    this._opts.onTopic?.(topicName);
    this._opts.onNarration?.(simMod.text, -1, 0);
  }

  async _tryLoadSimulation(key) {
    // Inline simulations — expand this map as you add more
    const sims = {
      'osmosis':           () => import(/* @vite-ignore */ './simulations/OsmosisSim.js'),
      'supply and demand': () => import(/* @vite-ignore */ './simulations/SupplyDemandSim.js'),
      'ohms law':          () => import(/* @vite-ignore */ './simulations/OhmsLawSim.js'),
    };
    const loader = sims[key];
    if (!loader) return null;
    try {
      const mod = await loader();
      return mod.default || mod;
    } catch { return null; }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  async _fetch(question, complexity = 5) {
    const apiBase = this._opts.apiBase || (typeof window !== 'undefined' ? window.API_BASE : undefined) || 'https://api.chunks.online';
    const res = await fetch(`${apiBase}/ask`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  this._abort?.signal,
      body:    JSON.stringify({
        question,
        mode:        'study',
        complexity,
        language:    this._opts.getLanguage?.() || localStorage.getItem('chunks_setting_language') || 'Auto-detect',
        safe_content:this._opts.getSafeMode?.() || localStorage.getItem('chunks_setting_safe-content') === '1',
      }),
    });
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    const data = await res.json();
    return data.answer || data.response || '';
  }

  _setMode(mode) {
    this._mode = mode;
    this._opts.onModeChange?.(mode);
  }

  _showLoading(q) {
    this._container.innerHTML =
      `<svg viewBox="0 0 440 340" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="440" height="340" fill="var(--surface-1,#13161b)"/>` +
      `<text x="220" y="152" text-anchor="middle" font-size="13" fill="var(--text-3,#c8d6e5)" font-family="var(--font-body,sans-serif)">Building diagram for:</text>` +
      `<text x="220" y="178" text-anchor="middle" font-size="14" fill="#60a5fa" font-family="var(--font-body,sans-serif)" font-weight="600">${q}</text>` +
      `<text x="220" y="204" text-anchor="middle" font-size="10" fill="var(--text-4,rgba(200,214,229,0.45))" font-family="var(--font-body,sans-serif)">Generating detailed animation...</text>` +
      `</svg>`;
  }

  _showError(q) {
    this._container.innerHTML =
      `<svg viewBox="0 0 440 340" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="440" height="340" fill="var(--surface-1,#13161b)"/>` +
      `<text x="220" y="165" text-anchor="middle" font-size="13" fill="var(--text-4,rgba(200,214,229,0.5))" font-family="var(--font-body,sans-serif)">See the explanation in the chat →</text>` +
      `</svg>`;
  }
}
