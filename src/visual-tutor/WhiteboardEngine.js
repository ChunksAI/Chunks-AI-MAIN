/**
 * src/visual-tutor/WhiteboardEngine.js  — v2
 *
 * Enhanced SVG animation engine with:
 *   • hand-drawn stroke jitter
 *   • gradient fills
 *   • line thickness variation
 *   • glow / luminescence effects
 *   • tapered organic strokes
 *   • graph, timeline, branch, container primitives
 *
 * Animation pipeline per element:
 *   1. stroke-dashoffset  0 → length   (line draws itself)
 *   2. fill opacity       0 → 1        (color floods in)
 *   3. label              0 → 1        (text fades in)
 */

// ── Easing ────────────────────────────────────────────────────────────────────

const ease = {
  outCubic:   t => 1 - Math.pow(1 - t, 3),
  outQuart:   t => 1 - Math.pow(1 - t, 4),
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
  inOutSine:  t => -(Math.cos(Math.PI * t) - 1) / 2,
  linear:     t => t,
};

// ── Jitter helper — adds subtle hand-drawn noise to a path ────────────────────

function jitterPath(d, amount = 1.2) {
  // Slightly offset each coordinate pair to simulate hand-drawn imperfection
  return d.replace(/(-?\d+\.?\d*)/g, (match, num, offset, str) => {
    // Only jitter coordinate numbers, not command letters
    const prev = str[offset - 1];
    if (prev && /[a-zA-Z,\s]/.test(prev)) {
      const n = parseFloat(num);
      const noise = (Math.random() - 0.5) * amount;
      return (n + noise).toFixed(2);
    }
    return match;
  });
}

// ── SVG namespace helper ───────────────────────────────────────────────────────

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
};

// ── WhiteboardEngine ──────────────────────────────────────────────────────────
  /**
   * @param {HTMLElement} container   — the vt-canvas-area div
   * @param {object}      concept     — { steps: [...] }
   * @param {function}    onStep      — (stepIndex, narration, totalSteps)
   * @param {function}    onDone      — called when all steps finish
   * @param {object}      [options]
   * @param {boolean}     [options.jitter=true]       — hand-drawn wobble
   * @param {number}      [options.jitterAmount=1.0]  — wobble intensity
   * @param {string}      [options.viewBox]           — override default viewBox
   */
  constructor(container, concept, onStep, onDone, options = {}) {
    this.container    = container;
    this.concept      = concept;
    this.onStep       = onStep;
    this.onDone       = onDone;
    this.stepIdx      = 0;
    this.rafId        = null;
    this._stopped     = false;
    this.jitter       = options.jitter !== false;
    this.jitterAmt    = options.jitterAmount ?? 1.0;
    this._gradientIdx = 0;

    const vb = options.viewBox || '0 0 440 340';
    const [, , vw, vh] = vb.split(' ').map(Number);
    this._vw = vw;
    this._vh = vh;

    // ── Build SVG ──────────────────────────────────────────────────────────
    this.svg = el('svg', { viewBox: vb, width: '100%', height: '100%' });
    this.svg.style.cssText = 'display:block;overflow:visible;';

    // Background
    this.svg.appendChild(el('rect', { width: vw, height: vh, fill: 'var(--surface-1, #13161b)' }));

    // Defs
    this.defs = el('defs');
    this.svg.appendChild(this.defs);
    this._buildMarkers();
    this._buildFilters();

    container.innerHTML = '';
    container.appendChild(this.svg);
  }

  // ── Markers & filters ──────────────────────────────────────────────────────

  _buildMarkers() {
    const colors = {
      white:  '#e8edf2', green:  '#2ecc71', yellow: '#f1c40f',
      blue:   '#3498db', teal:   '#1abc9c', orange: '#e67e22',
      red:    '#e74c3c', purple: '#9b59b6', gray:   '#95a5a6',
    };
    Object.entries(colors).forEach(([name, color]) => {
      const m = el('marker', {
        id: `wb-arrow-${name}`,
        viewBox: '0 0 10 10', refX: '9', refY: '5',
        markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse',
      });
      const p = el('path', { d: 'M1 1L9 5L1 9', fill: 'none', stroke: color, 'stroke-width': '1.8', 'stroke-linecap': 'round' });
      m.appendChild(p);
      this.defs.appendChild(m);
    });
  }

  _buildFilters() {
    const glows = [
      { id: 'wb-glow-purple', color: '155,89,182',  blur: 3 },
      { id: 'wb-glow-orange', color: '230,126,34',  blur: 3 },
      { id: 'wb-glow-blue',   color: '52,152,219',  blur: 3 },
      { id: 'wb-glow-green',  color: '46,204,113',  blur: 3 },
      { id: 'wb-glow-red',    color: '231,76,60',   blur: 3 },
      { id: 'wb-glow-yellow', color: '241,196,15',  blur: 3 },
      { id: 'wb-glow-soft',   color: '200,214,229', blur: 2 },
    ];
    glows.forEach(({ id, blur }) => {
      const f = el('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%' });
      const fe = el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: blur });
      f.appendChild(fe);
      this.defs.appendChild(f);
    });
  }

  /** Create a linear gradient and return its id */
  _makeGradient(stops, x1 = '0%', y1 = '0%', x2 = '0%', y2 = '100%') {
    const id = `wb-grad-${++this._gradientIdx}`;
    const g  = el('linearGradient', { id, x1, y1, x2, y2 });
    stops.forEach(({ offset, color, opacity = 1 }) => {
      const s = el('stop', { offset });
      s.style.stopColor   = color;
      s.style.stopOpacity = opacity;
      g.appendChild(s);
    });
    this.defs.appendChild(g);
    return id;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start()  { this._stopped = false; this._runStep(); }
  stop()   { this._stopped = true; if (this.rafId) cancelAnimationFrame(this.rafId); }
  replay() { this.stepIdx = 0; this.svg.querySelectorAll(':not(defs):not(rect):not(marker):not(filter)').forEach(n => n.remove()); this.start(); }

  _runStep() {
    if (this._stopped) return;
    const steps = this.concept.steps;
    if (this.stepIdx >= steps.length) { this.onDone?.(); return; }

    const step = steps[this.stepIdx];
    this.onStep?.(this.stepIdx, step.narration, steps.length);

    this._animElements(step.elements || [], 0, () => {
      setTimeout(() => { this.stepIdx++; this._runStep(); }, step.pauseAfter ?? 500);
    });
  }

  _animElements(elements, idx, onAllDone) {
    if (this._stopped) return;
    if (idx >= elements.length) { onAllDone(); return; }

    const item = elements[idx];
    const next = () => {
      const delay = item.delayAfter ?? 80;
      setTimeout(() => this._animElements(elements, idx + 1, onAllDone), delay);
    };

    switch (item.type) {
      case 'path':        this._animPath(item, next);       break;
      case 'circle':      this._animCircle(item, next);     break;
      case 'ellipse':     this._animEllipse(item, next);    break;
      case 'line':        this._animLine(item, next);       break;
      case 'arrow':       this._animArrow(item, next);      break;
      case 'text':        this._animText(item, next);       break;
      case 'label':       this._animLabel(item, next);      break;
      case 'taperpath':   this._animTaperPath(item, next);  break;
      case 'glow':        this._animGlow(item, next);       break;
      case 'group':       this._animGroup(item, next);      break;
      // ── v2 primitives ──────────────────────────────────────────────────
      case 'graph':       this._animGraph(item, next);      break;
      case 'timeline':    this._animTimeline(item, next);   break;
      case 'branch':      this._animBranch(item, next);     break;
      case 'container':   this._animContainer(item, next);  break;
      case 'particle_flow': this._animParticleFlow(item, next); break;
      default:            next(); break;
    }
  }

  // ── Core animators ─────────────────────────────────────────────────────────

  _animPath(item, done) {
    const d = this.jitter ? jitterPath(item.d, this.jitterAmt) : item.d;

    // Support gradient fills
    let fillAttr = item.fill || 'none';
    if (item.gradient) {
      const gid = this._makeGradient(item.gradient.stops, ...( item.gradient.dir || ['0%','0%','0%','100%']));
      fillAttr = `url(#${gid})`;
    }

    const path = el('path', {
      d,
      fill:             'none',
      stroke:           item.stroke || '#e8edf2',
      'stroke-width':   item.strokeWidth || 2,
      'stroke-linecap': 'round',
      'stroke-linejoin':'round',
    });
    if (item.strokeDash)  path.setAttribute('stroke-dasharray', item.strokeDash);
    if (item.opacity != null) path.style.opacity = item.opacity;
    if (item.filter)      path.setAttribute('filter', item.filter);
    if (item.transform)   path.setAttribute('transform', item.transform);
    this.svg.appendChild(path);

    const len = (()=>{ try { return path.getTotalLength() || 300; } catch { return 300; }})();
    path.setAttribute('stroke-dasharray',  len);
    path.setAttribute('stroke-dashoffset', len);

    const drawDur = item.drawDuration ?? 800;
    const fillDur = item.fillDuration ?? 500;

    this._raf(drawDur, ease.outCubic, t => path.setAttribute('stroke-dashoffset', len * (1 - t)), () => {
      if (fillAttr === 'none') { done(); return; }
      path.setAttribute('fill', fillAttr);
      path.style.fillOpacity = '0';
      this._raf(fillDur, ease.outCubic, t => path.style.fillOpacity = t, done);
    });
  }

  _animCircle(item, done) {
    const circle = el('circle', {
      cx:             item.cx,
      cy:             item.cy,
      r:              item.r,
      fill:           'none',
      stroke:         item.stroke || '#e8edf2',
      'stroke-width': item.strokeWidth || 2,
    });
    if (item.opacity != null) circle.style.opacity = item.opacity;
    if (item.filter)          circle.setAttribute('filter', item.filter);
    if (item.transform)       circle.setAttribute('transform', item.transform);
    this.svg.appendChild(circle);

    const circ = 2 * Math.PI * (item.r || 30);
    circle.setAttribute('stroke-dasharray',  circ);
    circle.setAttribute('stroke-dashoffset', circ);

    let fillAttr = item.fill || 'none';
    if (item.gradient) {
      const gid = this._makeGradient(item.gradient.stops, ...(item.gradient.dir || ['0%','0%','0%','100%']));
      fillAttr = `url(#${gid})`;
    }

    const drawDur = item.drawDuration ?? 700;
    const fillDur = item.fillDuration ?? 400;

    this._raf(drawDur, ease.outCubic, t => circle.setAttribute('stroke-dashoffset', circ * (1 - t)), () => {
      if (fillAttr === 'none') { done(); return; }
      circle.setAttribute('fill', fillAttr);
      circle.style.fillOpacity = '0';
      this._raf(fillDur, ease.outCubic, t => circle.style.fillOpacity = t, done);
    });
  }

  _animEllipse(item, done) {
    const e = el('ellipse', {
      cx:             item.cx,
      cy:             item.cy,
      rx:             item.rx,
      ry:             item.ry,
      fill:           'none',
      stroke:         item.stroke || '#e8edf2',
      'stroke-width': item.strokeWidth || 2,
    });
    if (item.transform)       e.setAttribute('transform', item.transform);
    if (item.opacity != null) e.style.opacity = item.opacity;
    if (item.filter)          e.setAttribute('filter', item.filter);
    this.svg.appendChild(e);

    const a = item.rx, b = item.ry;
    const perim = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    e.setAttribute('stroke-dasharray',  perim);
    e.setAttribute('stroke-dashoffset', perim);

    let fillAttr = item.fill || 'none';
    if (item.gradient) {
      const gid = this._makeGradient(item.gradient.stops, ...(item.gradient.dir || ['0%','0%','0%','100%']));
      fillAttr = `url(#${gid})`;
    }

    const drawDur = item.drawDuration ?? 700;
    const fillDur = item.fillDuration ?? 400;

    this._raf(drawDur, ease.outCubic, t => e.setAttribute('stroke-dashoffset', perim * (1 - t)), () => {
      if (fillAttr === 'none') { done(); return; }
      e.setAttribute('fill', fillAttr);
      e.style.fillOpacity = '0';
      this._raf(fillDur, ease.outCubic, t => e.style.fillOpacity = t, done);
    });
  }

  _animLine(item, done) {
    const line = el('line', {
      x1: item.x1, y1: item.y1, x2: item.x2, y2: item.y2,
      stroke:           item.stroke || '#e8edf2',
      'stroke-width':   item.strokeWidth || 1.5,
      'stroke-linecap': 'round',
    });
    if (item.strokeDash) line.setAttribute('stroke-dasharray', item.strokeDash);
    if (item.marker)     line.setAttribute('marker-end', `url(#wb-arrow-${item.marker})`);
    this.svg.appendChild(line);

    const dx = item.x2 - item.x1, dy = item.y2 - item.y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 100;
    line.setAttribute('stroke-dasharray',  len);
    line.setAttribute('stroke-dashoffset', len);
    this._raf(item.drawDuration ?? 400, ease.outCubic, t => line.setAttribute('stroke-dashoffset', len * (1 - t)), done);
  }

  _animArrow(item, done) {
    const d = this.jitter ? jitterPath(item.d, this.jitterAmt * 0.5) : item.d;
    const path = el('path', {
      d,
      fill:             'none',
      stroke:           item.stroke || '#e8edf2',
      'stroke-width':   item.strokeWidth || 2.5,
      'stroke-linecap': 'round',
      'stroke-linejoin':'round',
      'marker-end':     `url(#wb-arrow-${item.markerColor || 'white'})`,
    });
    this.svg.appendChild(path);

    const len = (()=>{ try { return path.getTotalLength() || 100; } catch { return 100; }})();
    path.setAttribute('stroke-dasharray',  len);
    path.setAttribute('stroke-dashoffset', len);
    this._raf(item.drawDuration ?? 500, ease.outCubic, t => path.setAttribute('stroke-dashoffset', len * (1 - t)), done);
  }

  _animText(item, done) {
    const t = el('text', {
      x:             item.x,
      y:             item.y,
      'text-anchor': item.anchor || 'middle',
      'font-size':   item.size || 11,
      'font-family': 'var(--font-body, system-ui, sans-serif)',
      'font-weight': item.weight || '400',
      fill:          item.color || '#c8d6e5',
    });
    t.style.opacity = '0';
    t.textContent   = item.text;
    this.svg.appendChild(t);
    this._raf(item.duration ?? 400, ease.outCubic, v => t.style.opacity = v, done);
  }

  _animLabel(item, done) {
    const g   = el('g');
    g.style.opacity = '0';
    this.svg.appendChild(g);

    const pad = { x: 9, y: 5 };
    const w   = (item.text.length * (item.size || 10) * 0.6) + pad.x * 2;
    const h   = (item.size || 10) + pad.y * 2;
    const ax  = item.anchor === 'end'   ? item.x - w
              : item.anchor === 'start' ? item.x
              : item.x - w / 2;

    const bg = el('rect', {
      x: ax, y: item.y - (item.size || 10) - pad.y + 2,
      width: w, height: h, rx: 5,
      fill: item.bgColor || 'rgba(18,22,30,0.88)',
    });
    g.appendChild(bg);

    const t = el('text', {
      x:             item.x,
      y:             item.y,
      'text-anchor': item.anchor || 'middle',
      'font-size':   item.size || 10,
      'font-family': 'var(--font-body, system-ui, sans-serif)',
      'font-weight': item.weight || '600',
      fill:          item.color || '#e8edf2',
    });
    t.textContent = item.text;
    g.appendChild(t);

    this._raf(item.duration ?? 350, ease.outCubic, v => g.style.opacity = v, done);
  }

  _animGroup(item, done) {
    let completed = 0;
    const total   = item.elements?.length || 0;
    if (!total) { done(); return; }
    item.elements.forEach(child => {
      this._animElements([child], 0, () => { if (++completed >= total) done(); });
    });
  }

  _animTaperPath(item, done) {
    const widths = item.widths || [item.strokeWidth || 4, (item.strokeWidth || 4) * 0.3];
    const alphas = item.alphas || [1, 0.3];
    const color  = item.stroke || '#e8edf2';
    const g      = el('g');
    if (item.opacity != null) g.style.opacity = item.opacity;
    this.svg.appendChild(g);

    const paths = widths.map((w, i) => {
      const d = this.jitter ? jitterPath(item.d, this.jitterAmt * (1 - i * 0.3)) : item.d;
      const p = el('path', {
        d, fill: 'none', stroke: color,
        'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      });
      p.style.opacity = alphas[i] ?? 1;
      if (item.filter) p.setAttribute('filter', item.filter);
      g.appendChild(p);
      return p;
    });

    const len = (()=>{ try { return paths[0].getTotalLength() || 300; } catch { return 300; }})();
    paths.forEach(p => { p.setAttribute('stroke-dasharray', len); p.setAttribute('stroke-dashoffset', len); });

    const fillColor = item.fill || 'none';
    const drawDur   = item.drawDuration ?? 800;
    const fillDur   = item.fillDuration ?? 400;

    this._raf(drawDur, ease.outCubic, t => paths.forEach(p => p.setAttribute('stroke-dashoffset', len * (1 - t))), () => {
      if (fillColor === 'none') { done(); return; }
      paths[0].setAttribute('fill', fillColor);
      paths[0].style.fillOpacity = '0';
      this._raf(fillDur, ease.outCubic, t => paths[0].style.fillOpacity = t, done);
    });
  }

  _animGlow(item, done) {
    const path = el('path', {
      d:              item.d,
      fill:           item.fill || 'none',
      stroke:         item.stroke || '#e8edf2',
      'stroke-width': item.strokeWidth || 6,
      'stroke-linecap':'round',
      'stroke-linejoin':'round',
      filter:         item.filter || 'url(#wb-glow-soft)',
    });
    path.style.opacity = item.opacity ?? 0.45;
    this.svg.appendChild(path);

    const len = (()=>{ try { return path.getTotalLength() || 200; } catch { return 200; }})();
    path.setAttribute('stroke-dasharray',  len);
    path.setAttribute('stroke-dashoffset', len);
    this._raf(item.drawDuration ?? 600, ease.outCubic, t => path.setAttribute('stroke-dashoffset', len * (1 - t)), done);
  }

  // ── v2 Primitives ──────────────────────────────────────────────────────────

  /**
   * GRAPH — auto-draws axes + labelled data line/bars
   * item: { x, y, w, h, xLabel, yLabel, color, data:[{label,value}], style:'line'|'bar' }
   */
  _animGraph(item, done) {
    const { x = 40, y = 40, w = 360, h = 220 } = item;
    const data   = item.data || [];
    const color  = item.color || '#3498db';
    const style  = item.style || 'line';
    const g      = el('g');
    g.style.opacity = '0';
    this.svg.appendChild(g);

    // Axes
    const ax = el('path', {
      d: `M${x} ${y} L${x} ${y + h} L${x + w} ${y + h}`,
      fill: 'none', stroke: '#4a5568', 'stroke-width': '1.5', 'stroke-linecap': 'round',
    });
    g.appendChild(ax);

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const stepW  = w / Math.max(data.length - 1, 1);

    if (style === 'line') {
      const pts = data.map((d, i) => {
        const px = x + i * stepW;
        const py = y + h - (d.value / maxVal) * h * 0.88;
        return `${px},${py}`;
      });
      const linePath = el('path', {
        d: `M${pts.join(' L')}`,
        fill: 'none', stroke: color, 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      });
      g.appendChild(linePath);

      // Dots
      data.forEach((d, i) => {
        const px = x + i * stepW;
        const py = y + h - (d.value / maxVal) * h * 0.88;
        g.appendChild(el('circle', { cx: px, cy: py, r: 4, fill: color, stroke: 'var(--surface-1,#13161b)', 'stroke-width': 2 }));

        // x labels
        const lbl = el('text', { x: px, y: y + h + 16, 'text-anchor': 'middle', 'font-size': 9, fill: '#8899aa', 'font-family': 'var(--font-body,sans-serif)' });
        lbl.textContent = d.label;
        g.appendChild(lbl);
      });
    } else {
      // Bar chart
      const barW = stepW * 0.55;
      data.forEach((d, i) => {
        const px  = x + i * stepW - barW / 2;
        const bh  = (d.value / maxVal) * h * 0.88;
        const py  = y + h - bh;
        const bar = el('rect', { x: px, y: py, width: barW, height: bh, fill: color, rx: 3, opacity: 0.85 });
        g.appendChild(bar);
        const lbl = el('text', { x: px + barW / 2, y: y + h + 14, 'text-anchor': 'middle', 'font-size': 9, fill: '#8899aa', 'font-family': 'var(--font-body,sans-serif)' });
        lbl.textContent = d.label;
        g.appendChild(lbl);
      });
    }

    // Axis labels
    if (item.xLabel) {
      const xl = el('text', { x: x + w / 2, y: y + h + 30, 'text-anchor': 'middle', 'font-size': 10, fill: '#8899aa', 'font-family': 'var(--font-body,sans-serif)' });
      xl.textContent = item.xLabel;
      g.appendChild(xl);
    }
    if (item.yLabel) {
      const yl = el('text', { x: x - 28, y: y + h / 2, 'text-anchor': 'middle', 'font-size': 10, fill: '#8899aa', 'font-family': 'var(--font-body,sans-serif)', transform: `rotate(-90 ${x - 28} ${y + h / 2})` });
      yl.textContent = item.yLabel;
      g.appendChild(yl);
    }

    this._raf(item.duration ?? 700, ease.outCubic, v => g.style.opacity = v, done);
  }

  /**
   * TIMELINE — horizontal time ribbon with events
   * item: { y, color, events:[{label,text,x}] }
   */
  _animTimeline(item, done) {
    const y      = item.y ?? 170;
    const color  = item.color || '#f1c40f';
    const events = item.events || [];
    const g      = el('g');
    this.svg.appendChild(g);

    // Spine
    const minX = Math.min(...events.map(e => e.x ?? 60));
    const maxX = Math.max(...events.map(e => e.x ?? 380));
    const spine = el('line', {
      x1: minX - 20, y1: y, x2: maxX + 20, y2: y,
      stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round',
    });
    const spineLen = (maxX - minX) + 40;
    spine.setAttribute('stroke-dasharray',  spineLen);
    spine.setAttribute('stroke-dashoffset', spineLen);
    g.appendChild(spine);

    this._raf(item.drawDuration ?? 600, ease.outCubic, t => spine.setAttribute('stroke-dashoffset', spineLen * (1 - t)), () => {
      let completed = 0;
      if (!events.length) { done(); return; }

      events.forEach((ev, i) => {
        const ex    = ev.x ?? (60 + i * 80);
        const above = i % 2 === 0;
        const ly    = above ? y - 18 : y + 18;
        const ty    = above ? y - 28 : y + 38;

        setTimeout(() => {
          // Dot
          const dot = el('circle', { cx: ex, cy: y, r: 5, fill: color, stroke: 'var(--surface-1,#13161b)', 'stroke-width': 2 });
          dot.style.opacity = '0';
          g.appendChild(dot);
          this._raf(200, ease.outCubic, v => dot.style.opacity = v, () => {});

          // Label
          const lbl = el('text', { x: ex, y: ly, 'text-anchor': 'middle', 'font-size': 9, fill: color, 'font-family': 'var(--font-body,sans-serif)', 'font-weight': '600' });
          lbl.textContent = ev.label || '';
          lbl.style.opacity = '0';
          g.appendChild(lbl);
          this._raf(300, ease.outCubic, v => lbl.style.opacity = v, () => {});

          // Description
          const txt = el('text', { x: ex, y: ty, 'text-anchor': 'middle', 'font-size': 8, fill: '#8899aa', 'font-family': 'var(--font-body,sans-serif)' });
          txt.textContent = ev.text || '';
          txt.style.opacity = '0';
          g.appendChild(txt);
          this._raf(350, ease.outCubic, v => txt.style.opacity = v, () => {
            if (++completed >= events.length) done();
          });
        }, i * (item.eventDelay ?? 220));
      });
    });
  }

  /**
   * BRANCH — mind-map style branching from a center node
   * item: { cx, cy, label, color, branches:[{label, color, subBranches:[...]}] }
   */
  _animBranch(item, done) {
    const cx      = item.cx ?? this._vw / 2;
    const cy      = item.cy ?? this._vh / 2;
    const color   = item.color || '#9b59b6';
    const branches= item.branches || [];
    const g       = el('g');
    this.svg.appendChild(g);

    // Center node
    const centerR = item.r ?? 28;
    const cCircle = el('circle', { cx, cy, r: centerR, fill: 'none', stroke: color, 'stroke-width': 2.5 });
    const cc = 2 * Math.PI * centerR;
    cCircle.setAttribute('stroke-dasharray', cc);
    cCircle.setAttribute('stroke-dashoffset', cc);
    g.appendChild(cCircle);

    this._raf(400, ease.outCubic, t => cCircle.setAttribute('stroke-dashoffset', cc * (1 - t)), () => {
      cCircle.setAttribute('fill', item.fill || 'rgba(155,89,182,0.15)');

      const cLabel = el('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', 'font-size': 11, fill: color, 'font-family': 'var(--font-body,sans-serif)', 'font-weight': '600' });
      cLabel.style.opacity = '0';
      cLabel.textContent = item.label || '';
      g.appendChild(cLabel);
      this._raf(300, ease.outCubic, v => cLabel.style.opacity = v, () => {});

      let completed = 0;
      if (!branches.length) { done(); return; }

      const angleStep = (2 * Math.PI) / branches.length;

      branches.forEach((branch, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const radius= item.radius ?? 100;
        const bx    = cx + Math.cos(angle) * radius;
        const by    = cy + Math.sin(angle) * radius;
        const bColor= branch.color || color;
        const bR    = 20;

        setTimeout(() => {
          // Connecting line
          const line = el('line', { x1: cx + Math.cos(angle) * (centerR + 4), y1: cy + Math.sin(angle) * (centerR + 4), x2: bx, y2: by, stroke: bColor, 'stroke-width': 1.5, 'stroke-linecap': 'round' });
          const llen = Math.sqrt((bx - cx) ** 2 + (by - cy) ** 2);
          line.setAttribute('stroke-dasharray', llen);
          line.setAttribute('stroke-dashoffset', llen);
          g.appendChild(line);
          this._raf(350, ease.outCubic, t => line.setAttribute('stroke-dashoffset', llen * (1 - t)), () => {});

          // Branch node
          const bNode = el('circle', { cx: bx, cy: by, r: bR, fill: 'none', stroke: bColor, 'stroke-width': 2 });
          const bc = 2 * Math.PI * bR;
          bNode.setAttribute('stroke-dasharray', bc);
          bNode.setAttribute('stroke-dashoffset', bc);
          g.appendChild(bNode);
          this._raf(300, ease.outCubic, t => bNode.setAttribute('stroke-dashoffset', bc * (1 - t)), () => {
            bNode.setAttribute('fill', `rgba(${hexToRgb(bColor)},0.12)`);
          });

          const bLabel = el('text', { x: bx, y: by + 4, 'text-anchor': 'middle', 'font-size': 9, fill: bColor, 'font-family': 'var(--font-body,sans-serif)', 'font-weight': '600' });
          bLabel.style.opacity = '0';
          bLabel.textContent = branch.label || '';
          g.appendChild(bLabel);
          this._raf(300, ease.outCubic, v => bLabel.style.opacity = v, () => {
            if (++completed >= branches.length) done();
          });
        }, i * 180);
      });
    });
  }

  /**
   * CONTAINER — rounded rect with title + internal region
   * item: { x, y, w, h, label, color, rx }
   */
  _animContainer(item, done) {
    const color  = item.color || '#1abc9c';
    const rect   = el('rect', {
      x: item.x ?? 40, y: item.y ?? 40,
      width: item.w ?? 360, height: item.h ?? 260,
      rx: item.rx ?? 12,
      fill: 'none', stroke: color, 'stroke-width': item.strokeWidth || 1.5,
      'stroke-dasharray': item.strokeDash || 'none',
    });

    const perim = 2 * ((item.w ?? 360) + (item.h ?? 260));
    rect.setAttribute('stroke-dasharray',  perim);
    rect.setAttribute('stroke-dashoffset', perim);
    this.svg.appendChild(rect);

    this._raf(item.drawDuration ?? 700, ease.outCubic, t => rect.setAttribute('stroke-dashoffset', perim * (1 - t)), () => {
      rect.setAttribute('fill', item.fill || `rgba(${hexToRgb(color)},0.04)`);
      rect.style.fillOpacity = '0';
      this._raf(item.fillDuration ?? 400, ease.outCubic, t => rect.style.fillOpacity = t, () => {
        if (!item.label) { done(); return; }
        const lbl = el('text', {
          x:             (item.x ?? 40) + 14,
          y:             (item.y ?? 40) + 18,
          'text-anchor': 'start',
          'font-size':   item.labelSize || 11,
          fill:          color,
          'font-family': 'var(--font-body,sans-serif)',
          'font-weight': '600',
        });
        lbl.textContent = item.label;
        lbl.style.opacity = '0';
        this.svg.appendChild(lbl);
        this._raf(350, ease.outCubic, v => lbl.style.opacity = v, done);
      });
    });
  }

  /**
   * PARTICLE_FLOW — animated moving dots along a path
   * item: { d, count, color, speed, size }
   */
  _animParticleFlow(item, done) {
    const count = item.count ?? 8;
    const color = item.color || '#3498db';
    const size  = item.size  ?? 4;
    const speed = item.speed ?? 2000;
    const g     = el('g');
    this.svg.appendChild(g);

    // Draw the path itself (faintly)
    const track = el('path', { d: item.d, fill: 'none', stroke: color, 'stroke-width': 1, 'stroke-linecap': 'round', opacity: 0.2 });
    g.appendChild(track);

    // Animated particles
    for (let i = 0; i < count; i++) {
      const dot = el('circle', { r: size, fill: color });
      dot.style.opacity = '0.8';
      g.appendChild(dot);

      const offset    = (i / count) * 100;
      const animEl    = document.createElementNS(NS, 'animateMotion');
      animEl.setAttribute('dur', `${speed}ms`);
      animEl.setAttribute('repeatCount', 'indefinite');
      animEl.setAttribute('begin', `${-(offset / 100) * speed}ms`);

      const mpath = document.createElementNS(NS, 'mpath');
      // Inline the path
      const flowPath = el('path', { d: item.d, id: `pf-${Date.now()}-${i}` });
      this.defs.appendChild(flowPath);
      mpath.setAttribute('href', `#pf-${Date.now()}-${i}`);
      mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#pf-${Date.now()}-${i}`);
      animEl.appendChild(mpath);
      dot.appendChild(animEl);
    }

    // Fade in the group
    g.style.opacity = '0';
    this._raf(400, ease.outCubic, v => g.style.opacity = v, done);
  }

  // ── RAF helper ─────────────────────────────────────────────────────────────

  _raf(duration, easeFn, onProgress, onComplete) {
    const start = performance.now();
    const tick  = now => {
      if (this._stopped) return;
      const t = Math.min(1, (now - start) / duration);
      onProgress(easeFn(t));
      if (t < 1) { this.rafId = requestAnimationFrame(tick); }
      else        { onComplete?.(); }
    };
    this.rafId = requestAnimationFrame(tick);
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '200,214,229';
}
