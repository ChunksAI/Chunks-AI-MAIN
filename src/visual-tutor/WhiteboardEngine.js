/**
 * src/visual-tutor/WhiteboardEngine.js
 *
 * Whiteboard-style SVG animation engine.
 * Shapes draw themselves stroke by stroke, then fill with color, then labels fade in.
 *
 * Architecture:
 *   WhiteboardEngine   — main controller, owns the SVG, sequences steps
 *   DrawStep           — one animated element (path, circle, text, arrow)
 *   Whiteboard         — concept definition format
 *
 * Each step runs after the previous completes:
 *   1. stroke-dashoffset animates from full-length → 0  (line draws itself)
 *   2. fill opacity animates 0 → 1                      (color floods in)
 *   3. label opacity animates 0 → 1                     (text fades in)
 */

// ── Easing ────────────────────────────────────────────────────────────────────

const ease = {
  outCubic:  t => 1 - Math.pow(1-t, 3),
  outQuart:  t => 1 - Math.pow(1-t, 4),
  inOutSine: t => -(Math.cos(Math.PI*t) - 1) / 2,
  linear:    t => t,
};

// ── WhiteboardEngine ──────────────────────────────────────────────────────────

class WhiteboardEngine {
  /**
   * @param {HTMLElement} container  — the vt-canvas-area div
   * @param {object}      concept    — a WHITEBOARD_CONCEPTS entry
   * @param {function}    onStep     — (stepIndex, text) called when each step starts
   * @param {function}    onDone     — called when all steps finish
   */
  constructor(container, concept, onStep, onDone) {
    this.container = container;
    this.concept   = concept;
    this.onStep    = onStep;
    this.onDone    = onDone;
    this.stepIdx   = 0;
    this.rafId     = null;
    this._stopped  = false;

    // Build SVG
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', '0 0 440 340');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.style.cssText = 'display:block;overflow:visible;';

    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '440');
    bg.setAttribute('height', '340');
    bg.setAttribute('fill', 'var(--surface-1, #13161b)');
    this.svg.appendChild(bg);

    // Defs for markers (arrowheads)
    this.defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    this.svg.appendChild(this.defs);
    this._buildMarkers();

    container.innerHTML = '';
    container.appendChild(this.svg);
  }

  _buildMarkers() {
    const colors = {
      white:   '#e8edf2',
      green:   '#2ecc71',
      yellow:  '#f1c40f',
      blue:    '#3498db',
      teal:    '#1abc9c',
      orange:  '#e67e22',
      red:     '#e74c3c',
      purple:  '#9b59b6',
      gray:    '#95a5a6',
    };
    Object.entries(colors).forEach(([name, color]) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id',          `wb-arrow-${name}`);
      marker.setAttribute('viewBox',     '0 0 10 10');
      marker.setAttribute('refX',        '9');
      marker.setAttribute('refY',        '5');
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight','6');
      marker.setAttribute('orient',      'auto-start-reverse');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d',    'M1 1L9 5L1 9');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '1.8');
      path.setAttribute('stroke-linecap', 'round');
      marker.appendChild(path);
      this.defs.appendChild(marker);
    });

    // ── Glow filters for biological detail ──────────────────────────────────
    const glows = [
      { id: 'wb-glow-purple', color: '155,89,182',  blur: 3 },
      { id: 'wb-glow-orange', color: '230,126,34',  blur: 3 },
      { id: 'wb-glow-blue',   color: '52,152,219',  blur: 3 },
      { id: 'wb-glow-green',  color: '46,204,113',  blur: 3 },
      { id: 'wb-glow-soft',   color: '200,214,229', blur: 2 },
    ];
    glows.forEach(({ id, color, blur }) => {
      const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.setAttribute('id', id);
      filter.setAttribute('x', '-50%'); filter.setAttribute('y', '-50%');
      filter.setAttribute('width', '200%'); filter.setAttribute('height', '200%');
      const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
      fe.setAttribute('in', 'SourceGraphic');
      fe.setAttribute('stdDeviation', blur);
      filter.appendChild(fe);
      this.defs.appendChild(filter);
    });
  }

  start() {
    this._stopped = false;
    this._runStep();
  }

  stop() {
    this._stopped = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  _runStep() {
    if (this._stopped) return;
    const steps = this.concept.steps;
    if (this.stepIdx >= steps.length) {
      this.onDone?.();
      return;
    }

    const step = steps[this.stepIdx];
    this.onStep?.(this.stepIdx, step.narration);

    // Draw all elements in this step sequentially
    this._animateElements(step.elements, 0, () => {
      // After all elements in step done, pause then next step
      setTimeout(() => {
        this.stepIdx++;
        this._runStep();
      }, step.pauseAfter ?? 500);
    });
  }

  _animateElements(elements, idx, onAllDone) {
    if (this._stopped) return;
    if (idx >= elements.length) { onAllDone(); return; }

    const el = elements[idx];
    const next = () => {
      const delay = el.delayAfter ?? 80;
      setTimeout(() => this._animateElements(elements, idx+1, onAllDone), delay);
    };

    switch (el.type) {
      case 'path':      this._animatePath(el, next);      break;
      case 'circle':    this._animateCircle(el, next);    break;
      case 'ellipse':   this._animateEllipse(el, next);   break;
      case 'line':      this._animateLine(el, next);      break;
      case 'text':      this._animateText(el, next);      break;
      case 'label':     this._animateLabel(el, next);     break;
      case 'arrow':     this._animateArrow(el, next);     break;
      case 'group':     this._animateGroup(el, next);     break;
      // New high-detail types:
      case 'taperpath': this._animateTaperPath(el, next); break;
      case 'glow':      this._animateGlow(el, next);      break;
      default:          next(); break;
    }
  }

  // ── Core animators ──────────────────────────────────────────────────────────

  _animatePath(el, done) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d',            el.d);
    path.setAttribute('fill',         'none');
    path.setAttribute('stroke',       el.stroke || '#e8edf2');
    path.setAttribute('stroke-width', el.strokeWidth || 2);
    path.setAttribute('stroke-linecap',  'round');
    path.setAttribute('stroke-linejoin', 'round');
    if (el.strokeDash) path.setAttribute('stroke-dasharray', el.strokeDash);
    if (el.opacity != null) path.style.opacity = el.opacity;
    if (el.filter) path.setAttribute('filter', el.filter);
    if (el.transform) path.setAttribute('transform', el.transform);
    this.svg.appendChild(path);

    const len = path.getTotalLength() || 300;
    path.setAttribute('stroke-dasharray',  len);
    path.setAttribute('stroke-dashoffset', len);

    const drawDur  = el.drawDuration  ?? 800;
    const fillDur  = el.fillDuration  ?? 500;
    const fillColor = el.fill || 'none';

    this._raf(drawDur, ease.outCubic, t => {
      path.setAttribute('stroke-dashoffset', len * (1-t));
    }, () => {
      if (fillColor === 'none') { done(); return; }
      // Fill phase
      path.setAttribute('fill', fillColor);
      path.style.fillOpacity = '0';
      this._raf(fillDur, ease.outCubic, t => {
        path.style.fillOpacity = t;
      }, done);
    });
  }

  _animateCircle(el, done) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', el.cx);
    circle.setAttribute('cy', el.cy);
    circle.setAttribute('r',  el.r);
    circle.setAttribute('fill',         'none');
    circle.setAttribute('stroke',       el.stroke || '#e8edf2');
    circle.setAttribute('stroke-width', el.strokeWidth || 2);
    if (el.opacity != null) circle.style.opacity = el.opacity;
    if (el.filter) circle.setAttribute('filter', el.filter);
    if (el.transform) circle.setAttribute('transform', el.transform);
    this.svg.appendChild(circle);

    const circumference = 2 * Math.PI * (el.r || 30);
    circle.setAttribute('stroke-dasharray',  circumference);
    circle.setAttribute('stroke-dashoffset', circumference);

    const drawDur   = el.drawDuration ?? 700;
    const fillDur   = el.fillDuration ?? 500;
    const fillColor = el.fill || 'none';

    this._raf(drawDur, ease.outCubic, t => {
      circle.setAttribute('stroke-dashoffset', circumference * (1-t));
    }, () => {
      if (fillColor === 'none') { done(); return; }
      circle.setAttribute('fill', fillColor);
      circle.style.fillOpacity = '0';
      this._raf(fillDur, ease.outCubic, t => {
        circle.style.fillOpacity = t;
      }, done);
    });
  }

  _animateEllipse(el, done) {
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ellipse.setAttribute('cx', el.cx);
    ellipse.setAttribute('cy', el.cy);
    ellipse.setAttribute('rx', el.rx);
    ellipse.setAttribute('ry', el.ry);
    ellipse.setAttribute('fill',         'none');
    ellipse.setAttribute('stroke',       el.stroke || '#e8edf2');
    ellipse.setAttribute('stroke-width', el.strokeWidth || 2);
    if (el.transform) ellipse.setAttribute('transform', el.transform);
    if (el.opacity != null) ellipse.style.opacity = el.opacity;
    if (el.filter) ellipse.setAttribute('filter', el.filter);
    this.svg.appendChild(ellipse);

    const circumference = 2 * Math.PI * Math.sqrt((el.rx*el.rx + el.ry*el.ry)/2);
    ellipse.setAttribute('stroke-dasharray',  circumference);
    ellipse.setAttribute('stroke-dashoffset', circumference);

    const drawDur   = el.drawDuration ?? 700;
    const fillDur   = el.fillDuration ?? 500;
    const fillColor = el.fill || 'none';

    this._raf(drawDur, ease.outCubic, t => {
      ellipse.setAttribute('stroke-dashoffset', circumference * (1-t));
    }, () => {
      if (fillColor === 'none') { done(); return; }
      ellipse.setAttribute('fill', fillColor);
      ellipse.style.fillOpacity = '0';
      this._raf(fillDur, ease.outCubic, t => {
        ellipse.style.fillOpacity = t;
      }, done);
    });
  }

  _animateLine(el, done) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', el.x1); line.setAttribute('y1', el.y1);
    line.setAttribute('x2', el.x2); line.setAttribute('y2', el.y2);
    line.setAttribute('stroke',       el.stroke || '#e8edf2');
    line.setAttribute('stroke-width', el.strokeWidth || 1.5);
    line.setAttribute('stroke-linecap', 'round');
    if (el.strokeDash) line.setAttribute('stroke-dasharray', el.strokeDash);
    if (el.marker) line.setAttribute('marker-end', `url(#wb-arrow-${el.marker})`);
    this.svg.appendChild(line);

    const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
    const len = Math.sqrt(dx*dx + dy*dy) || 100;
    line.setAttribute('stroke-dasharray',  len);
    line.setAttribute('stroke-dashoffset', len);

    this._raf(el.drawDuration ?? 500, ease.outCubic, t => {
      line.setAttribute('stroke-dashoffset', len*(1-t));
    }, done);
  }

  _animateArrow(el, done) {
    // Arrow = animated path with arrowhead marker
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d',            el.d);
    path.setAttribute('fill',         'none');
    path.setAttribute('stroke',       el.stroke || '#e8edf2');
    path.setAttribute('stroke-width', el.strokeWidth || 2.5);
    path.setAttribute('stroke-linecap',  'round');
    path.setAttribute('stroke-linejoin', 'round');
    const markerColor = el.markerColor || 'white';
    path.setAttribute('marker-end', `url(#wb-arrow-${markerColor})`);
    this.svg.appendChild(path);

    const len = path.getTotalLength() || 100;
    path.setAttribute('stroke-dasharray',  len);
    path.setAttribute('stroke-dashoffset', len);

    this._raf(el.drawDuration ?? 600, ease.outCubic, t => {
      path.setAttribute('stroke-dashoffset', len*(1-t));
    }, done);
  }

  _animateText(el, done) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x',           el.x);
    text.setAttribute('y',           el.y);
    text.setAttribute('text-anchor', el.anchor || 'middle');
    text.setAttribute('font-size',   el.size || 11);
    text.setAttribute('font-family', 'var(--font-body, sans-serif)');
    text.setAttribute('font-weight', el.weight || '400');
    text.setAttribute('fill',        el.color || '#c8d6e5');
    text.style.opacity = '0';
    text.textContent = el.text;
    this.svg.appendChild(text);

    this._raf(el.duration ?? 400, ease.outCubic, t => {
      text.style.opacity = t;
    }, done);
  }

  _animateLabel(el, done) {
    // Label = rounded rect background + text
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.style.opacity = '0';
    this.svg.appendChild(g);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const pad = { x: 8, y: 5 };
    const w   = (el.text.length * (el.size || 10) * 0.58) + pad.x * 2;
    const h   = (el.size || 10) + pad.y * 2;
    const ax  = el.anchor === 'end'   ? el.x - w
              : el.anchor === 'start' ? el.x
              : el.x - w/2;
    bg.setAttribute('x',      ax);
    bg.setAttribute('y',      el.y - (el.size || 10) - pad.y + 2);
    bg.setAttribute('width',  w);
    bg.setAttribute('height', h);
    bg.setAttribute('rx',     5);
    bg.setAttribute('fill',   el.bgColor || 'rgba(30,35,45,0.85)');
    g.appendChild(bg);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x',           el.x);
    text.setAttribute('y',           el.y);
    text.setAttribute('text-anchor', el.anchor || 'middle');
    text.setAttribute('font-size',   el.size || 10);
    text.setAttribute('font-family', 'var(--font-body, sans-serif)');
    text.setAttribute('font-weight', el.weight || '600');
    text.setAttribute('fill',        el.color || '#e8edf2');
    text.textContent = el.text;
    g.appendChild(text);

    this._raf(el.duration ?? 350, ease.outCubic, t => {
      g.style.opacity = t;
    }, done);
  }

  _animateGroup(el, done) {
    // Animate a group of elements in parallel
    let completed = 0;
    const total = el.elements.length;
    if (!total) { done(); return; }
    el.elements.forEach(child => {
      this._animateElements([child], 0, () => {
        completed++;
        if (completed >= total) done();
      });
    });
  }

  // ── Tapered path — organic stroke width variation ──────────────────────────
  // el.d            SVG path data
  // el.stroke       stroke color
  // el.widths       array of stroke-widths, evenly distributed along path
  // el.drawDuration ms
  _animateTaperPath(el, done) {
    // We simulate taper by layering multiple clipped paths at different widths,
    // or more practically by drawing the path with a gradient stroke-width via
    // multiple overlapping slightly-offset lines. For SVG compatibility we use
    // the simpler approach: draw the path normally then overlay a thinner highlight.
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    if (el.opacity != null) g.style.opacity = el.opacity;
    this.svg.appendChild(g);

    const widths = el.widths || [el.strokeWidth || 3, (el.strokeWidth || 3) * 0.4];
    const alphas = el.alphas || [1, 0.35];
    const color  = el.stroke || '#e8edf2';
    const paths  = [];

    widths.forEach((w, i) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', el.d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', color);
      p.setAttribute('stroke-width', w);
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      p.style.opacity = alphas[i] ?? 1;
      if (el.filter) p.setAttribute('filter', el.filter);
      g.appendChild(p);
      paths.push(p);
    });

    // Fill phase
    const fillColor = el.fill || 'none';
    const drawDur   = el.drawDuration ?? 800;
    const fillDur   = el.fillDuration ?? 500;

    // Use first path length for dashoffset animation
    const len = paths[0].getTotalLength() || 300;
    paths.forEach(p => {
      p.setAttribute('stroke-dasharray', len);
      p.setAttribute('stroke-dashoffset', len);
    });

    this._raf(drawDur, ease.outCubic, t => {
      paths.forEach(p => p.setAttribute('stroke-dashoffset', len * (1-t)));
    }, () => {
      if (fillColor === 'none') { done(); return; }
      paths[0].setAttribute('fill', fillColor);
      paths[0].style.fillOpacity = '0';
      this._raf(fillDur, ease.outCubic, t => {
        paths[0].style.fillOpacity = t;
      }, done);
    });
  }

  // ── Glow element — blurred duplicate beneath a path for luminescence ────────
  // Draws a blurred copy of a path to simulate biological luminescence/glow.
  _animateGlow(el, done) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', el.d);
    path.setAttribute('fill', el.fill || 'none');
    path.setAttribute('stroke', el.stroke || '#e8edf2');
    path.setAttribute('stroke-width', el.strokeWidth || 6);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('filter', el.filter || 'url(#wb-glow-soft)');
    path.style.opacity = el.opacity ?? 0.45;
    this.svg.appendChild(path);

    const len = path.getTotalLength() || 200;
    path.setAttribute('stroke-dasharray', len);
    path.setAttribute('stroke-dashoffset', len);

    this._raf(el.drawDuration ?? 600, ease.outCubic, t => {
      path.setAttribute('stroke-dashoffset', len * (1-t));
    }, done);
  }

  // ── RAF helper ──────────────────────────────────────────────────────────────

  _raf(duration, easeFn, onProgress, onComplete) {
    const start = performance.now();
    const tick  = (now) => {
      if (this._stopped) return;
      const t = Math.min(1, (now - start) / duration);
      onProgress(easeFn(t));
      if (t < 1) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        onComplete?.();
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }
}

// ── Concept Library ───────────────────────────────────────────────────────────

const WHITEBOARD_CONCEPTS = {

  // ── PHOTOSYNTHESIS ──────────────────────────────────────────────────────────
  photosynthesis: {
    steps: [
      {
        narration: 'The leaf cell — a thin flat structure designed to capture sunlight.',
        pauseAfter: 400,
        elements: [
          // Leaf outline — large ellipse
          { type:'ellipse', cx:200, cy:168, rx:105, ry:82,
            stroke:'#2ecc71', strokeWidth:2.5, fill:'rgba(46,204,113,0.1)',
            drawDuration:1000, fillDuration:600 },
          // Leaf tip at top
          { type:'path', d:'M200 86 Q215 72 200 86', stroke:'#2ecc71', strokeWidth:1.5,
            drawDuration:200, delayAfter:0 },
          // Central vein
          { type:'line', x1:200, y1:88, x2:200, y2:248,
            stroke:'rgba(46,204,113,0.6)', strokeWidth:1.5, drawDuration:500 },
          // Side veins
          ...[-50,-30,-10,10,30,50].map((offset, i) => ({
            type: 'line',
            x1: 200, y1: 118 + i*22,
            x2: 200 + (i%2===0?1:-1) * 55, y2: 115 + i*22 + 12,
            stroke: 'rgba(46,204,113,0.4)', strokeWidth: 1,
            drawDuration: 220, delayAfter: 30,
          })),
          { type:'label', x:200, y:76, text:'Leaf Cell', size:11, color:'#2ecc71', duration:400 },
        ],
      },
      {
        narration: 'The chloroplast — the green powerhouse. Chlorophyll inside captures light energy.',
        pauseAfter: 400,
        elements: [
          // Chloroplast body
          { type:'ellipse', cx:200, cy:170, rx:36, ry:22,
            stroke:'#27ae60', strokeWidth:2, fill:'rgba(22,160,133,0.35)',
            drawDuration:700, fillDuration:500 },
          // Thylakoid stacks (grana) inside — small stacked lines
          ...[-12,-4,4,12].map(ox => ({
            type:'line', x1:200+ox, y1:158, x2:200+ox, y2:182,
            stroke:'rgba(22,160,133,0.8)', strokeWidth:2.5,
            drawDuration:200, delayAfter:40,
          })),
          { type:'label', x:200, y:202, text:'Chloroplast', size:10, color:'#27ae60', duration:350 },
        ],
      },
      {
        narration: 'Sunlight rays strike the leaf — providing the energy to power the reaction.',
        pauseAfter: 400,
        elements: [
          // 5 sunlight rays from top-left
          ...[[65,18,148,82],[55,28,138,98],[45,42,130,115],[55,55,130,132],[68,65,135,148]].map(
            ([x1,y1,x2,y2], i) => ({
              type:'line', x1, y1, x2, y2,
              stroke:'#f1c40f', strokeWidth: i===2 ? 2.5 : 1.8,
              drawDuration: 380, delayAfter: 60,
            })
          ),
          // Sun circle
          { type:'circle', cx:55, cy:30, r:18,
            stroke:'#f1c40f', strokeWidth:2.5, fill:'rgba(241,196,15,0.2)',
            drawDuration:500, fillDuration:400 },
          { type:'label', x:55, y:14, text:'Sunlight', size:9, color:'#f1c40f', duration:300 },
        ],
      },
      {
        narration: 'Water (H₂O) rises from the roots. Carbon dioxide (CO₂) enters through stomata.',
        pauseAfter: 400,
        elements: [
          // H2O arrow — from bottom left into leaf
          { type:'arrow', d:'M30 240 Q60 235 95 210',
            stroke:'#3498db', strokeWidth:2.5, markerColor:'blue',
            drawDuration:600 },
          { type:'label', x:24, y:258, text:'H₂O', size:11, color:'#3498db',
            anchor:'middle', weight:'700', duration:300 },
          // CO2 arrow — from left side into leaf
          { type:'arrow', d:'M20 168 Q55 168 94 168',
            stroke:'#95a5a6', strokeWidth:2, markerColor:'gray',
            drawDuration:600 },
          { type:'label', x:16, y:162, text:'CO₂', size:10, color:'#95a5a6',
            anchor:'middle', weight:'700', duration:300 },
        ],
      },
      {
        narration: 'Oxygen (O₂) exits the leaf. Glucose is produced for the plant to use as food.',
        pauseAfter: 400,
        elements: [
          // O2 arrow — exits top right
          { type:'arrow', d:'M306 128 Q340 115 380 105',
            stroke:'#1abc9c', strokeWidth:2.5, markerColor:'teal',
            drawDuration:600 },
          { type:'label', x:386, y:100, text:'O₂', size:11, color:'#1abc9c',
            anchor:'start', weight:'700', duration:300 },
          // Glucose arrow — exits right
          { type:'arrow', d:'M306 190 Q342 195 380 200',
            stroke:'#e67e22', strokeWidth:2.5, markerColor:'orange',
            drawDuration:600 },
          { type:'label', x:386, y:205, text:'Glucose', size:10, color:'#e67e22',
            anchor:'start', weight:'700', duration:300 },
          // Equation at bottom
          { type:'text', x:200, y:306, text:'6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂',
            size:9.5, color:'rgba(200,214,229,0.7)', duration:600 },
        ],
      },
    ],
  },

  // ── HEART ───────────────────────────────────────────────────────────────────
  heart: {
    steps: [
      {
        narration: 'The heart — a fist-sized muscle that beats 100,000 times a day without stopping.',
        pauseAfter: 400,
        elements: [
          // Heart shape via path
          { type:'path',
            d:'M220 130 C220 110 195 90 175 98 C155 106 148 128 148 148 C148 168 162 185 220 222 C278 185 292 168 292 148 C292 128 285 106 265 98 C245 90 220 110 220 130Z',
            stroke:'#e74c3c', strokeWidth:3, fill:'rgba(231,76,60,0.12)',
            drawDuration:1200, fillDuration:700 },
          { type:'label', x:220, y:80, text:'The Heart', size:13, color:'#e74c3c',
            weight:'700', duration:400 },
        ],
      },
      {
        narration: 'The septum divides the heart into two halves that never mix blood.',
        pauseAfter: 400,
        elements: [
          // Septum — vertical line
          { type:'line', x1:220, y1:115, x2:220, y2:210,
            stroke:'rgba(231,76,60,0.7)', strokeWidth:2,
            strokeDash:'4,3', drawDuration:500 },
          // Chamber labels
          { type:'label', x:188, y:165, text:'L', size:14, color:'#e74c3c',
            weight:'700', duration:300 },
          { type:'label', x:252, y:165, text:'R', size:14, color:'#922b21',
            weight:'700', duration:300 },
        ],
      },
      {
        narration: 'Oxygen-poor blood enters the RIGHT side from the body.',
        pauseAfter: 400,
        elements: [
          // Right atrium fill
          { type:'ellipse', cx:252, cy:148, rx:30, ry:38,
            stroke:'#5dade2', strokeWidth:1.5, fill:'rgba(93,173,226,0.2)',
            drawDuration:600, fillDuration:400 },
          // Arrow from body to right
          { type:'arrow', d:'M340 195 Q310 185 282 170',
            stroke:'#5dade2', strokeWidth:2.5, markerColor:'blue', drawDuration:500 },
          { type:'label', x:348, y:200, text:'From body', size:9, color:'#5dade2',
            anchor:'start', duration:300 },
        ],
      },
      {
        narration: 'The RIGHT side pumps blood to the lungs. Oxygenated blood returns to the LEFT.',
        pauseAfter: 400,
        elements: [
          // Pulmonary artery — to lungs
          { type:'arrow', d:'M262 116 Q275 85 295 65',
            stroke:'#5dade2', strokeWidth:2.5, markerColor:'blue', drawDuration:500 },
          { type:'label', x:302, y:58, text:'To lungs', size:9, color:'#5dade2',
            anchor:'start', duration:300 },
          // Pulmonary vein — from lungs
          { type:'arrow', d:'M158 65 Q172 85 180 116',
            stroke:'#e74c3c', strokeWidth:2.5, markerColor:'red', drawDuration:500 },
          { type:'label', x:145, y:58, text:'From lungs', size:9, color:'#e74c3c',
            anchor:'end', duration:300 },
          // Left chamber fill
          { type:'ellipse', cx:188, cy:148, rx:30, ry:38,
            stroke:'#e74c3c', strokeWidth:1.5, fill:'rgba(231,76,60,0.2)',
            drawDuration:600, fillDuration:400 },
        ],
      },
      {
        narration: 'The LEFT side pumps oxygenated blood powerfully out to the whole body via the aorta.',
        pauseAfter: 400,
        elements: [
          // Aorta — from left out to body
          { type:'arrow', d:'M165 116 Q140 88 118 65',
            stroke:'#e74c3c', strokeWidth:3, markerColor:'red', drawDuration:600 },
          { type:'label', x:110, y:58, text:'Aorta → body', size:9,
            color:'#e74c3c', anchor:'end', duration:300 },
          // Pulse rings
          ...[[30,0.4],[48,0.25],[66,0.13]].map(([r,op]) => ({
            type:'circle', cx:220, cy:162, r,
            stroke:`rgba(231,76,60,${op})`, strokeWidth:1.5,
            drawDuration:500, delayAfter:120,
          })),
          { type:'text', x:220, y:308,
            text:'100,000 beats per day — 35 million per year',
            size:9.5, color:'rgba(200,214,229,0.65)', duration:600 },
        ],
      },
    ],
  },

  // ── NEURON ──────────────────────────────────────────────────────────────────
  // Detailed anatomical neuron: soma with nucleus + nucleolus, branching dendrites
  // with sub-branches, long tapered axon, myelin sheaths, nodes of Ranvier,
  // synaptic terminal with end bulbs and neurotransmitter vesicles.
  // Canvas: 440 × 340.  Layout: soma at ~x80, axon runs to x~395, midline y~182.
  neuron: {
    steps: [
      // ── Step 1: Soma (cell body) ─────────────────────────────────────────
      {
        narration: 'The soma — the neuron\'s cell body. An irregular, slightly bulging shape housing the nucleus and controlling all cellular activity.',
        pauseAfter: 450,
        elements: [
          // Outer soma — organic, slightly non-circular blob via path
          { type:'path',
            d:'M80 182 C76 158 62 148 62 170 C62 148 70 128 82 122 C96 115 110 118 118 128 C126 138 126 150 122 158 C130 152 136 156 136 168 C136 182 130 196 122 198 C114 200 108 196 104 200 C100 204 98 212 92 212 C84 214 74 206 72 198 C68 190 68 182 80 182 Z',
            stroke:'#a569bd', strokeWidth:2.2,
            fill:'rgba(155,89,182,0.13)',
            drawDuration:1100, fillDuration:600 },

          // Nucleus — large, slightly offset ellipse
          { type:'ellipse', cx:96, cy:168, rx:22, ry:20,
            stroke:'#8e44ad', strokeWidth:1.8,
            fill:'rgba(142,68,173,0.28)',
            drawDuration:650, fillDuration:450 },

          // Nucleolus — small dense body inside nucleus
          { type:'circle', cx:100, cy:165, r:7,
            stroke:'#7d3c98', strokeWidth:1.4,
            fill:'rgba(125,60,152,0.55)',
            drawDuration:350, fillDuration:250 },

          // Nuclear envelope pore dots (5 evenly spaced)
          ...[ [84,151],[109,149],[118,162],[112,183],[82,180] ].map(([cx,cy]) => ({
            type:'circle', cx, cy, r:2.2,
            stroke:'#9b59b6', strokeWidth:1,
            fill:'rgba(155,89,182,0.5)',
            drawDuration:120, fillDuration:80, delayAfter:30,
          })),

          // Nissl body (rough ER) — short wavy lines in cytoplasm
          { type:'path', d:'M76 175 Q79 172 82 175 Q85 178 88 175',
            stroke:'rgba(180,140,220,0.5)', strokeWidth:1.3, drawDuration:200 },
          { type:'path', d:'M76 184 Q79 181 82 184 Q85 187 88 184',
            stroke:'rgba(180,140,220,0.5)', strokeWidth:1.3, drawDuration:200 },

          { type:'label', x:96, y:228, text:'Cell body (soma)', size:9,
            color:'#a569bd', duration:380 },
        ],
      },

      // ── Step 2: Dendrites ────────────────────────────────────────────────
      {
        narration: 'Dendrites radiate from the soma like branches — each subdividing into finer processes that receive incoming signals from thousands of other neurons.',
        pauseAfter: 450,
        elements: [
          // Primary dendrite 1 — upper left, curves upward
          { type:'path', d:'M80 140 Q58 118 44 100',
            stroke:'#8e44ad', strokeWidth:2.6, drawDuration:340 },
          // Sub-branches of dendrite 1
          { type:'path', d:'M60 120 Q46 108 38 96',
            stroke:'#8e44ad', strokeWidth:1.6, drawDuration:220, delayAfter:30 },
          { type:'path', d:'M60 120 Q56 105 52 94',
            stroke:'#8e44ad', strokeWidth:1.2, drawDuration:180, delayAfter:20 },
          { type:'path', d:'M44 100 Q36 90 30 82',
            stroke:'#8e44ad', strokeWidth:1.0, drawDuration:160, delayAfter:20 },
          { type:'path', d:'M44 100 Q40 88 38 78',
            stroke:'#8e44ad', strokeWidth:0.9, drawDuration:140, delayAfter:15 },
          // Dendritic spines (tiny protrusions)
          { type:'path', d:'M52 110 L48 104', stroke:'rgba(142,68,173,0.7)', strokeWidth:1, drawDuration:80 },
          { type:'path', d:'M38 96 L34 90',  stroke:'rgba(142,68,173,0.7)', strokeWidth:1, drawDuration:80 },

          // Primary dendrite 2 — upper middle
          { type:'path', d:'M90 128 Q82 104 78 82',
            stroke:'#8e44ad', strokeWidth:2.4, drawDuration:320 },
          { type:'path', d:'M82 104 Q74 92 66 82',
            stroke:'#8e44ad', strokeWidth:1.5, drawDuration:200, delayAfter:20 },
          { type:'path', d:'M82 104 Q86 92 86 80',
            stroke:'#8e44ad', strokeWidth:1.3, drawDuration:190, delayAfter:15 },
          { type:'path', d:'M66 82 Q60 72 56 62',  stroke:'rgba(142,68,173,0.65)', strokeWidth:1, drawDuration:140 },
          { type:'path', d:'M86 80 Q84 68 82 58',  stroke:'rgba(142,68,173,0.65)', strokeWidth:1, drawDuration:130 },

          // Primary dendrite 3 — upper right of soma
          { type:'path', d:'M112 130 Q118 108 124 90',
            stroke:'#8e44ad', strokeWidth:2.2, drawDuration:300 },
          { type:'path', d:'M124 90 Q120 76 118 62',
            stroke:'#8e44ad', strokeWidth:1.4, drawDuration:190, delayAfter:20 },
          { type:'path', d:'M124 90 Q130 78 136 68',
            stroke:'#8e44ad', strokeWidth:1.2, drawDuration:180, delayAfter:15 },

          // Primary dendrite 4 — left side
          { type:'path', d:'M66 168 Q44 162 26 154',
            stroke:'#8e44ad', strokeWidth:2.2, drawDuration:300 },
          { type:'path', d:'M44 162 Q28 152 16 142',
            stroke:'#8e44ad', strokeWidth:1.3, drawDuration:200, delayAfter:20 },
          { type:'path', d:'M44 162 Q30 170 18 172',
            stroke:'#8e44ad', strokeWidth:1.1, drawDuration:180, delayAfter:15 },

          // Primary dendrite 5 — lower left
          { type:'path', d:'M76 200 Q56 214 40 226',
            stroke:'#8e44ad', strokeWidth:2.0, drawDuration:280 },
          { type:'path', d:'M56 214 Q42 222 28 228',
            stroke:'#8e44ad', strokeWidth:1.2, drawDuration:180, delayAfter:20 },
          { type:'path', d:'M56 214 Q48 228 42 240',
            stroke:'#8e44ad', strokeWidth:1.0, drawDuration:160, delayAfter:15 },

          { type:'label', x:30, y:70, text:'Dendrites', size:9,
            color:'#8e44ad', anchor:'middle', duration:320 },
          { type:'text',  x:30, y:82, text:'(receive signals)',
            size:7.5, color:'rgba(142,68,173,0.65)', anchor:'middle', duration:260 },
        ],
      },

      // ── Step 3: Axon hillock + axon shaft ────────────────────────────────
      {
        narration: 'The axon hillock — where the soma tapers into the axon. This is the trigger zone where action potentials are initiated.',
        pauseAfter: 450,
        elements: [
          // Axon hillock — tapered funnel shape emerging from soma right side
          { type:'path',
            d:'M128 174 C136 172 144 170 152 170 C144 170 144 194 152 194 C144 194 136 192 128 190 Z',
            stroke:'#7d3c98', strokeWidth:1.8,
            fill:'rgba(125,60,152,0.2)',
            drawDuration:420, fillDuration:280 },
          { type:'text', x:140, y:210, text:'axon hillock',
            size:7.5, color:'rgba(155,89,182,0.7)', anchor:'middle', duration:250 },

          // Axon shaft — upper and lower boundaries (tube), tapers slightly
          // Upper boundary
          { type:'path', d:'M152 170 C200 168 260 167 340 166 C370 166 390 167 400 168',
            stroke:'#7d3c98', strokeWidth:2, drawDuration:900 },
          // Lower boundary
          { type:'path', d:'M152 194 C200 196 260 197 340 198 C370 198 390 197 400 196',
            stroke:'#7d3c98', strokeWidth:2, drawDuration:900 },

          // Axon interior — central highlight line
          { type:'path', d:'M152 182 L400 182',
            stroke:'rgba(180,140,220,0.22)', strokeWidth:3, drawDuration:700 },

          // Axoplasm fill (subtle)
          { type:'path', d:'M152 170 C200 168 340 166 400 168 L400 196 C340 198 200 196 152 194 Z',
            stroke:'none', strokeWidth:0,
            fill:'rgba(125,60,152,0.10)',
            drawDuration:1, fillDuration:500 },

          { type:'label', x:270, y:156, text:'Axon', size:10,
            color:'#9b59b6', duration:320 },
        ],
      },

      // ── Step 4: Myelin sheath + Nodes of Ranvier ─────────────────────────
      {
        narration: 'The myelin sheath — Schwann cells wrap the axon in fatty insulation. Gaps called Nodes of Ranvier between segments allow the signal to leap forward, reaching 120 m/s.',
        pauseAfter: 500,
        elements: [
          // 5 myelin segments — layered ellipses for 3D wrap appearance
          ...[168, 210, 252, 294, 336].map((cx, i) => [
            // Outer sheath wrap
            { type:'ellipse', cx, cy:182, rx:16, ry:14,
              stroke:'#d2b4de', strokeWidth:2.2,
              fill:'rgba(210,180,222,0.22)',
              drawDuration:280, fillDuration:200, delayAfter:30 },
            // Inner sheath layer (slightly smaller, more opaque)
            { type:'ellipse', cx, cy:182, rx:13, ry:11,
              stroke:'rgba(210,180,222,0.4)', strokeWidth:1,
              fill:'rgba(210,180,222,0.12)',
              drawDuration:160, fillDuration:120, delayAfter:25 },
            // Sheath wrap lines (lamellae)
            { type:'path', d:`M${cx-14} 176 Q${cx} 172 ${cx+14} 176`,
              stroke:'rgba(210,180,222,0.3)', strokeWidth:0.8, drawDuration:100 },
            { type:'path', d:`M${cx-14} 188 Q${cx} 192 ${cx+14} 188`,
              stroke:'rgba(210,180,222,0.3)', strokeWidth:0.8, drawDuration:100 },
          ]).flat(),

          // Nodes of Ranvier — constriction markers between segments
          ...[189, 231, 273, 315].map(x => [
            // Node constriction (narrowing)
            { type:'path', d:`M${x} 170 L${x} 194`,
              stroke:'rgba(230,126,34,0.55)', strokeWidth:1.2,
              strokeDash:'2,2', drawDuration:120, delayAfter:15 },
            // Node dot
            { type:'circle', cx:x, cy:182, r:2.8,
              stroke:'#e67e22', strokeWidth:1.2,
              fill:'rgba(230,126,34,0.6)',
              drawDuration:120, fillDuration:80, delayAfter:20 },
          ]).flat(),

          // Labels
          { type:'label', x:252, y:206, text:'Myelin sheath', size:8.5,
            color:'#d2b4de', duration:300 },
          { type:'text',  x:316, y:218, text:'Node of Ranvier',
            size:7.5, color:'rgba(230,126,34,0.75)', anchor:'middle', duration:260 },
          // Schwann cell nucleus (one visible bulge on segment 3)
          { type:'ellipse', cx:252, cy:168, rx:9, ry:5,
            stroke:'rgba(210,180,222,0.5)', strokeWidth:1,
            fill:'rgba(210,180,222,0.15)',
            drawDuration:200, fillDuration:150 },
          { type:'text', x:252, y:162, text:"Schwann cell nucleus",
            size:6.5, color:'rgba(210,180,222,0.55)', anchor:'middle', duration:200 },
        ],
      },

      // ── Step 5: Synaptic terminal ─────────────────────────────────────────
      {
        narration: 'The axon terminal — it fans into several synaptic end bulbs. Each bulb contains hundreds of vesicles loaded with neurotransmitters ready to cross the synaptic cleft.',
        pauseAfter: 450,
        elements: [
          // Axon end tapers
          { type:'path', d:'M400 168 C406 168 412 166 416 164',
            stroke:'#7d3c98', strokeWidth:1.8, drawDuration:220 },
          { type:'path', d:'M400 196 C406 196 412 198 416 200',
            stroke:'#7d3c98', strokeWidth:1.8, drawDuration:220 },

          // Three terminal branches
          { type:'path', d:'M408 182 C414 176 418 170 422 162',
            stroke:'#c0392b', strokeWidth:1.8, drawDuration:280 },
          { type:'path', d:'M408 182 C414 182 420 182 424 182',
            stroke:'#c0392b', strokeWidth:1.8, drawDuration:250 },
          { type:'path', d:'M408 182 C414 188 418 194 422 202',
            stroke:'#c0392b', strokeWidth:1.8, drawDuration:280 },

          // Terminal end bulbs — slightly irregular circles
          { type:'ellipse', cx:428, cy:158, rx:10, ry:9,
            stroke:'#e74c3c', strokeWidth:2,
            fill:'rgba(231,76,60,0.22)',
            drawDuration:350, fillDuration:250 },
          { type:'ellipse', cx:430, cy:182, rx:10, ry:9,
            stroke:'#e74c3c', strokeWidth:2,
            fill:'rgba(231,76,60,0.22)',
            drawDuration:350, fillDuration:250 },
          { type:'ellipse', cx:428, cy:206, rx:10, ry:9,
            stroke:'#e74c3c', strokeWidth:2,
            fill:'rgba(231,76,60,0.22)',
            drawDuration:350, fillDuration:250 },

          // Synaptic vesicles inside each bulb — small dense circles
          ...[ [424,154],[430,158],[426,162],   // bulb 1
               [426,178],[432,182],[428,186],   // bulb 2
               [424,202],[430,206],[426,210],   // bulb 3
          ].map(([cx,cy]) => ({
            type:'circle', cx, cy, r:2.5,
            stroke:'#f39c12', strokeWidth:1,
            fill:'rgba(243,156,18,0.75)',
            drawDuration:110, fillDuration:80, delayAfter:35,
          })),

          // Synaptic cleft — gap to postsynaptic membrane
          { type:'line', x1:440, y1:148, x2:440, y2:218,
            stroke:'rgba(200,214,229,0.18)', strokeWidth:1,
            strokeDash:'3,3', drawDuration:220 },

          { type:'label', x:428, y:224, text:'Synaptic terminal', size:8.5,
            color:'#e74c3c', duration:300 },
          { type:'text',  x:428, y:234, text:'(end bulbs + vesicles)',
            size:7, color:'rgba(231,76,60,0.6)', anchor:'middle', duration:240 },
        ],
      },

      // ── Step 6: Signal animation ──────────────────────────────────────────
      {
        narration: 'Action potential — a wave of electrical charge sweeps down the axon in milliseconds. The signal "jumps" between Nodes of Ranvier via saltatory conduction.',
        pauseAfter: 500,
        elements: [
          // Glow along axon (simulates depolarization wave)
          { type:'glow',
            d:'M152 182 L200 182', stroke:'rgba(255,220,60,0.9)',
            strokeWidth:7, filter:'url(#wb-glow-purple)',
            opacity:0.7, drawDuration:300, delayAfter:80 },
          { type:'glow',
            d:'M200 182 L250 182', stroke:'rgba(255,220,60,0.9)',
            strokeWidth:7, filter:'url(#wb-glow-purple)',
            opacity:0.7, drawDuration:300, delayAfter:80 },
          { type:'glow',
            d:'M250 182 L300 182', stroke:'rgba(255,220,60,0.9)',
            strokeWidth:7, filter:'url(#wb-glow-purple)',
            opacity:0.7, drawDuration:300, delayAfter:80 },
          { type:'glow',
            d:'M300 182 L350 182', stroke:'rgba(255,220,60,0.9)',
            strokeWidth:7, filter:'url(#wb-glow-purple)',
            opacity:0.7, drawDuration:300, delayAfter:80 },
          { type:'glow',
            d:'M350 182 L408 182', stroke:'rgba(255,220,60,0.9)',
            strokeWidth:7, filter:'url(#wb-glow-purple)',
            opacity:0.7, drawDuration:300, delayAfter:60 },

          // Visible signal arrow
          { type:'arrow', d:'M155 155 L395 155',
            stroke:'#f1c40f', strokeWidth:2,
            markerColor:'yellow', drawDuration:800 },
          { type:'label', x:272, y:146, text:'Action potential →', size:9,
            color:'#f1c40f', duration:350 },

          // Node-jump indicators
          ...[ [189, 182], [231, 182], [273, 182], [315, 182] ].map(([x, y]) => ({
            type:'circle', cx:x, cy:y, r:5,
            stroke:'#f1c40f', strokeWidth:1.5,
            fill:'rgba(241,196,15,0.35)',
            drawDuration:200, fillDuration:150, delayAfter:60,
          })),
          { type:'text', x:240, y:220, text:'"Saltatory conduction" — signal leaps node to node',
            size:7.5, color:'rgba(241,196,15,0.65)', anchor:'middle', duration:320 },

          // Neurotransmitter release at synapse (animated dots dispersing)
          ...[ [436,154],[440,158],[442,148],
               [436,178],[440,182],[442,172],
               [436,202],[440,206],[442,196] ].map(([cx,cy]) => ({
            type:'circle', cx, cy, r:2,
            stroke:'#f39c12', strokeWidth:1,
            fill:'rgba(243,156,18,0.9)',
            drawDuration:130, fillDuration:90, delayAfter:45,
          })),

          { type:'text', x:220, y:310,
            text:'Signal speed: up to 120 m/s via saltatory conduction',
            size:9, color:'rgba(200,214,229,0.6)', duration:500 },
        ],
      },
    ],
  },

  // ── OSMOSIS ─────────────────────────────────────────────────────────────────
  osmosis: {
    steps: [
      {
        narration: 'A semi-permeable membrane divides the container — only water molecules can pass through.',
        pauseAfter: 400,
        elements: [
          // Container border
          { type:'path', d:'M30 55 L30 285 L410 285 L410 55 L30 55',
            stroke:'rgba(200,214,229,0.3)', strokeWidth:1.5,
            drawDuration:800 },
          // Membrane — dashed vertical line
          { type:'line', x1:220, y1:55, x2:220, y2:285,
            stroke:'rgba(200,214,229,0.7)', strokeWidth:3,
            strokeDash:'8,5', drawDuration:700 },
          { type:'label', x:220, y:44, text:'Semi-permeable membrane',
            size:9, color:'rgba(200,214,229,0.75)', duration:350 },
          { type:'label', x:122, y:44, text:'High [water]',
            size:10, color:'#3498db', weight:'700', duration:300 },
          { type:'label', x:318, y:44, text:'Low [water]',
            size:10, color:'#e67e22', weight:'700', duration:300 },
        ],
      },
      {
        narration: 'High concentration side — many water molecules crowded together.',
        pauseAfter: 400,
        elements: [
          ...[
            [68,90],[95,130],[55,170],[80,215],[120,95],[105,160],[65,240],
            [140,130],[130,195],[85,260],[115,240],[145,80],[155,160],
          ].map(([cx,cy]) => ({
            type:'circle', cx, cy, r:9,
            stroke:'#3498db', strokeWidth:1.8, fill:'rgba(52,152,219,0.18)',
            drawDuration:180, fillDuration:120, delayAfter:40,
          })),
        ],
      },
      {
        narration: 'Low concentration side — fewer water molecules.',
        pauseAfter: 400,
        elements: [
          ...[
            [280,110],[320,175],[360,130],[290,230],[345,260],
          ].map(([cx,cy]) => ({
            type:'circle', cx, cy, r:9,
            stroke:'#5dade2', strokeWidth:1.8, fill:'rgba(93,173,226,0.18)',
            drawDuration:200, fillDuration:130, delayAfter:50,
          })),
        ],
      },
      {
        narration: 'Water flows from HIGH to LOW concentration — net movement through the membrane.',
        pauseAfter: 400,
        elements: [
          ...[90,125,162,198].map(y => ({
            type:'arrow', d:`M205 ${y} L235 ${y}`,
            stroke:'#2ecc71', strokeWidth:2.5, markerColor:'green',
            drawDuration:350, delayAfter:80,
          })),
          { type:'label', x:220, y:300,
            text:'Water: HIGH → LOW concentration until equilibrium',
            size:9.5, color:'rgba(200,214,229,0.7)', duration:500 },
        ],
      },
    ],
  },

  // ── DNA ─────────────────────────────────────────────────────────────────────
  dna: {
    steps: [
      {
        narration: 'The DNA double helix — two strands twisted around each other like a ladder.',
        pauseAfter: 400,
        elements: [
          // Left backbone
          { type:'path',
            d:'M168 30 C148 60 148 80 168 105 C188 130 188 150 168 175 C148 200 148 220 168 245 C188 270 188 290 168 310',
            stroke:'#9b59b6', strokeWidth:3, drawDuration:1000 },
          // Right backbone
          { type:'path',
            d:'M272 30 C292 60 292 80 272 105 C252 130 252 150 272 175 C292 200 292 220 272 245 C252 270 252 290 272 310',
            stroke:'#2980b9', strokeWidth:3, drawDuration:1000 },
          { type:'label', x:140, y:24, text:'Sugar-phosphate backbone',
            size:8.5, color:'#9b59b6', anchor:'middle', duration:350 },
        ],
      },
      {
        narration: 'Base pairs form the rungs — Adenine with Thymine, Guanine with Cytosine.',
        pauseAfter: 400,
        elements: [
          ...[
            [168,50,272,50,'#e74c3c','A','T'],
            [168,80,272,80,'#3498db','T','A'],
            [168,110,272,110,'#2ecc71','G','C'],
            [168,140,272,140,'#e67e22','C','G'],
            [168,170,272,170,'#e74c3c','A','T'],
            [168,200,272,200,'#3498db','T','A'],
            [168,228,272,228,'#2ecc71','G','C'],
            [168,258,272,258,'#e67e22','C','G'],
            [168,286,272,286,'#e74c3c','A','T'],
            [168,308,272,308,'#3498db','T','A'],
          ].flatMap(([x1,y1,x2,y2,color,la,lb]) => [
            { type:'line', x1, y1, x2, y2,
              stroke:color, strokeWidth:2,
              drawDuration:250, delayAfter:30 },
            { type:'text', x:x1-8, y:y1+4, text:la, size:8,
              color:color, anchor:'end', duration:150 },
            { type:'text', x:x2+8, y:y2+4, text:lb, size:8,
              color:color, anchor:'start', duration:150 },
          ]),
          { type:'label', x:220, y:326, text:'A-T and G-C always pair together',
            size:9, color:'rgba(200,214,229,0.7)', duration:400 },
        ],
      },
    ],
  },

  // ── MITOSIS ─────────────────────────────────────────────────────────────────
  mitosis: {
    steps: [
      {
        narration: 'One parent cell — about to divide into two identical daughter cells.',
        pauseAfter: 400,
        elements: [
          { type:'circle', cx:220, cy:168, r:88,
            stroke:'#16a085', strokeWidth:2.5, fill:'rgba(22,160,133,0.08)',
            drawDuration:1000, fillDuration:600 },
          // Nucleus
          { type:'circle', cx:220, cy:168, r:36,
            stroke:'#1abc9c', strokeWidth:2, fill:'rgba(26,188,156,0.2)',
            drawDuration:600, fillDuration:400 },
          { type:'label', x:220, y:68, text:'Parent cell', size:11,
            color:'#16a085', weight:'700', duration:350 },
        ],
      },
      {
        narration: 'Chromosomes duplicate — the DNA is copied so each daughter cell gets a full set.',
        pauseAfter: 400,
        elements: [
          ...[-24,-8,8,24].flatMap(ox => [
            { type:'ellipse', cx:220+ox, cy:160, rx:5, ry:14,
              stroke:'#e74c3c', strokeWidth:2, fill:'rgba(231,76,60,0.5)',
              drawDuration:300, fillDuration:200, delayAfter:60 },
          ]),
          { type:'label', x:220, y:188, text:'Chromosomes duplicated',
            size:9, color:'#e74c3c', duration:300 },
        ],
      },
      {
        narration: 'Spindle fibers attach to chromosomes and pull them to opposite poles.',
        pauseAfter: 400,
        elements: [
          // Left pole
          { type:'circle', cx:132, cy:168, r:7,
            stroke:'#f39c12', strokeWidth:2, fill:'rgba(243,156,18,0.4)',
            drawDuration:300, fillDuration:200 },
          // Right pole
          { type:'circle', cx:308, cy:168, r:7,
            stroke:'#f39c12', strokeWidth:2, fill:'rgba(243,156,18,0.4)',
            drawDuration:300, fillDuration:200 },
          // Spindle fibers
          ...[-24,-8,8,24].flatMap(ox => [
            { type:'line', x1:132, y1:168, x2:220+ox, y2:162,
              stroke:'rgba(243,156,18,0.5)', strokeWidth:1,
              drawDuration:300, delayAfter:30 },
            { type:'line', x1:308, y1:168, x2:220+ox, y2:162,
              stroke:'rgba(243,156,18,0.5)', strokeWidth:1,
              drawDuration:300, delayAfter:30 },
          ]),
          { type:'label', x:220, y:198, text:'Spindle fibers pulling chromosomes apart',
            size:9, color:'#f39c12', duration:350 },
        ],
      },
      {
        narration: 'Cell divides — two identical daughter cells, each with a complete set of chromosomes.',
        pauseAfter: 400,
        elements: [
          // Cleavage furrow
          { type:'line', x1:220, y1:88, x2:220, y2:248,
            stroke:'rgba(200,214,229,0.4)', strokeWidth:2,
            strokeDash:'6,4', drawDuration:400 },
          // Two new cells
          { type:'circle', cx:160, cy:168, r:56,
            stroke:'#16a085', strokeWidth:2, fill:'rgba(22,160,133,0.15)',
            drawDuration:700, fillDuration:500 },
          { type:'circle', cx:280, cy:168, r:56,
            stroke:'#16a085', strokeWidth:2, fill:'rgba(22,160,133,0.15)',
            drawDuration:700, fillDuration:500 },
          { type:'label', x:160, y:236, text:'Daughter cell 1',
            size:9, color:'#16a085', duration:300 },
          { type:'label', x:280, y:236, text:'Daughter cell 2',
            size:9, color:'#16a085', duration:300 },
          { type:'text', x:220, y:308,
            text:'Each daughter cell is genetically identical to the parent',
            size:9.5, color:'rgba(200,214,229,0.65)', duration:600 },
        ],
      },
    ],
  },

  // ── FREE BODY DIAGRAM — Block on surface ──────────────────────────────────
  fbd_block: {
    steps: [
      {
        narration: 'Every object in physics can be represented as a simple point or box. We draw ALL forces acting ON this object — nothing else.',
        pauseAfter: 500,
        elements: [
          // Ground line
          { type:'line', x1:100, y1:230, x2:340, y2:230,
            stroke:'rgba(200,214,229,0.4)', strokeWidth:2, drawDuration:600 },
          // Hatch marks on ground
          ...Array.from({length:8},(_,i)=>({
            type:'line', x1:108+i*32, y1:230, x2:100+i*32, y2:244,
            stroke:'rgba(200,214,229,0.25)', strokeWidth:1.5, drawDuration:120, delayAfter:0,
          })),
          // The block
          { type:'path', d:'M168 150 L272 150 L272 230 L168 230 Z',
            stroke:'#c8d6e5', strokeWidth:2.5, fill:'rgba(200,214,229,0.08)',
            drawDuration:900, fillDuration:600 },
          { type:'label', x:220, y:196, text:'Object (mass m)',
            size:10, color:'#c8d6e5', weight:'600', duration:350 },
          { type:'text', x:220, y:318,
            text:'FBD Rule: draw ONLY forces acting ON the object',
            size:9.5, color:'rgba(200,214,229,0.55)', duration:500 },
        ],
      },
      {
        narration: `Weight (W = mg) — gravity pulls the object straight DOWN toward Earth's center. It acts at the center of mass.`,
        pauseAfter: 500,
        elements: [
          // Weight arrow — downward from center
          { type:'arrow', d:'M220 190 L220 288',
            stroke:'#e74c3c', strokeWidth:3.5, markerColor:'red', drawDuration:600 },
          // Weight label with box
          { type:'label', x:220, y:308, text:'W = mg', size:12,
            color:'#e74c3c', weight:'700', bgColor:'rgba(231,76,60,0.12)', duration:400 },
          // Small dot at center of mass
          { type:'circle', cx:220, cy:190, r:4,
            stroke:'#e74c3c', strokeWidth:2, fill:'rgba(231,76,60,0.6)',
            drawDuration:250, fillDuration:200 },
          // Dimension annotation
          { type:'text', x:240, y:244, text:'↓ g = 9.8 m/s²',
            size:9, color:'rgba(231,76,60,0.7)', duration:350 },
        ],
      },
      {
        narration: 'Normal force (N) — the surface pushes back UP on the object. Equal and opposite to weight on a flat surface: N = mg.',
        pauseAfter: 500,
        elements: [
          // Normal arrow — upward from base
          { type:'arrow', d:'M220 230 L220 132',
            stroke:'#3498db', strokeWidth:3.5, markerColor:'blue', drawDuration:600 },
          // Normal label
          { type:'label', x:220, y:118, text:'N = mg', size:12,
            color:'#3498db', weight:'700', bgColor:'rgba(52,152,219,0.12)', duration:400 },
          // Right angle marker at base
          { type:'path', d:'M220 230 L232 230 L232 218',
            stroke:'rgba(52,152,219,0.5)', strokeWidth:1.5, drawDuration:300 },
          { type:'text', x:252, y:188, text:'⊥ to surface',
            size:9, color:'rgba(52,152,219,0.7)', duration:300 },
          // Balance indicator — show W and N cancel
          { type:'text', x:290, y:196, text:'↑N = ↓W',
            size:9, color:'rgba(200,214,229,0.5)', duration:400 },
        ],
      },
      {
        narration: 'Applied force (F) — a push or pull acting horizontally on the object. This causes acceleration: F = ma.',
        pauseAfter: 500,
        elements: [
          // Applied force arrow — horizontal from left
          { type:'arrow', d:'M72 190 L162 190',
            stroke:'#2ecc71', strokeWidth:3.5, markerColor:'green', drawDuration:600 },
          { type:'label', x:60, y:190, text:'F', size:14,
            color:'#2ecc71', weight:'700', anchor:'end', bgColor:'rgba(46,204,113,0.12)', duration:350 },
          { type:'text', x:60, y:208, text:'Applied',
            size:9, color:'rgba(46,204,113,0.7)', anchor:'middle', duration:300 },
          // Newton's 2nd law
          { type:'label', x:60, y:270, text:'F = ma',
            size:12, color:'#2ecc71', weight:'700',
            bgColor:'rgba(46,204,113,0.1)', anchor:'middle', duration:400 },
        ],
      },
      {
        narration: 'Friction (f) — opposes motion, acts opposite to the applied force. f = μN where μ is the coefficient of friction.',
        pauseAfter: 500,
        elements: [
          // Friction arrow — horizontal pointing left (opposing motion)
          { type:'arrow', d:'M278 190 L368 190',
            stroke:'#e67e22', strokeWidth:3.5, markerColor:'orange', drawDuration:600 },
          { type:'label', x:380, y:190, text:'f', size:14,
            color:'#e67e22', weight:'700', anchor:'start', bgColor:'rgba(230,126,34,0.12)', duration:350 },
          { type:'text', x:380, y:208, text:'Friction',
            size:9, color:'rgba(230,126,34,0.7)', anchor:'start', duration:300 },
          { type:'label', x:380, y:270, text:'f = μN',
            size:12, color:'#e67e22', weight:'700',
            bgColor:'rgba(230,126,34,0.1)', anchor:'start', duration:400 },
          // Rough surface indicator
          { type:'text', x:220, y:252, text:'μ = friction coefficient',
            size:9, color:'rgba(230,126,34,0.6)', duration:350 },
        ],
      },
      {
        narration: 'Net force = F − f. If F > f the object accelerates. If F = f it moves at constant velocity. If F < f it stays still.',
        pauseAfter: 500,
        elements: [
          // Net force summary box
          { type:'path', d:'M100 270 L340 270 L340 310 L100 310 Z',
            stroke:'rgba(200,214,229,0.2)', strokeWidth:1.5,
            fill:'rgba(200,214,229,0.05)', drawDuration:500, fillDuration:300 },
          { type:'text', x:220, y:284, text:'Net force: ΣF = F − f = ma',
            size:10.5, color:'#c8d6e5', duration:400 },
          { type:'text', x:220, y:302, text:'Acceleration: a = (F − f) / m',
            size:9.5, color:'rgba(200,214,229,0.7)', duration:400 },
        ],
      },
    ],
  },

  // ── FREE BODY DIAGRAM — Inclined plane ────────────────────────────────────
  fbd_incline: {
    steps: [
      {
        narration: 'An inclined plane — a surface tilted at angle θ. Forces are resolved into components parallel and perpendicular to the slope.',
        pauseAfter: 500,
        elements: [
          // Incline triangle
          { type:'path', d:'M80 260 L360 260 L360 120 Z',
            stroke:'rgba(200,214,229,0.4)', strokeWidth:2,
            fill:'rgba(200,214,229,0.05)', drawDuration:900, fillDuration:500 },
          // Hatch marks on incline surface
          ...Array.from({length:6},(_,i)=>({
            type:'line', x1:180+i*28, y1:218-i*21, x2:172+i*28, y2:230-i*21,
            stroke:'rgba(200,214,229,0.22)', strokeWidth:1.5, drawDuration:100, delayAfter:0,
          })),
          // Angle arc
          { type:'path', d:'M110 260 A30 30 0 0 0 137 241',
            stroke:'#f1c40f', strokeWidth:1.5, drawDuration:400 },
          { type:'label', x:128, y:268, text:'θ', size:12,
            color:'#f1c40f', weight:'700', duration:300 },
          // Block on incline
          { type:'path', d:'M218 165 L258 195 L240 218 L200 188 Z',
            stroke:'#c8d6e5', strokeWidth:2.5, fill:'rgba(200,214,229,0.1)',
            drawDuration:700, fillDuration:500 },
          { type:'label', x:228, y:192, text:'m', size:11,
            color:'#c8d6e5', weight:'600', duration:300 },
        ],
      },
      {
        narration: `Weight (mg) acts straight DOWN regardless of the slope — gravity always points to Earth's center.`,
        pauseAfter: 500,
        elements: [
          // Weight — straight down from block
          { type:'arrow', d:'M228 192 L228 285',
            stroke:'#e74c3c', strokeWidth:3, markerColor:'red', drawDuration:550 },
          { type:'label', x:246, y:250, text:'mg', size:12,
            color:'#e74c3c', weight:'700', anchor:'start', duration:350 },
        ],
      },
      {
        narration: 'Normal force (N) — perpendicular to the incline surface, not vertical. N = mg·cos θ.',
        pauseAfter: 500,
        elements: [
          // Normal — perpendicular to slope surface
          { type:'arrow', d:'M228 192 L196 148',
            stroke:'#3498db', strokeWidth:3, markerColor:'blue', drawDuration:550 },
          { type:'label', x:188, y:138, text:'N', size:12,
            color:'#3498db', weight:'700', anchor:'middle', duration:350 },
          { type:'label', x:158, y:180, text:'N = mg·cosθ', size:10,
            color:'#3498db', anchor:'middle', duration:350 },
        ],
      },
      {
        narration: 'Weight component parallel to slope (mg·sin θ) pulls the block DOWN the incline — this causes it to slide.',
        pauseAfter: 500,
        elements: [
          // Parallel component — down the slope
          { type:'arrow', d:'M228 192 L268 222',
            stroke:'#e74c3c', strokeWidth:2.5, markerColor:'red', drawDuration:500 },
          { type:'label', x:278, y:232, text:'mg·sinθ', size:10,
            color:'#e74c3c', anchor:'start', duration:350 },
          // Dashed construction lines
          { type:'line', x1:228, y1:285, x2:268, y2:222,
            stroke:'rgba(231,76,60,0.3)', strokeWidth:1.2,
            strokeDash:'5,4', drawDuration:300 },
          { type:'line', x1:228, y1:285, x2:196, y2:148,
            stroke:'rgba(52,152,219,0.3)', strokeWidth:1.2,
            strokeDash:'5,4', drawDuration:300 },
        ],
      },
      {
        narration: 'Friction (f = μN) acts UP the slope opposing motion. Net acceleration: a = g·sin θ − μg·cos θ.',
        pauseAfter: 500,
        elements: [
          // Friction — up the slope
          { type:'arrow', d:'M228 192 L188 162',
            stroke:'#e67e22', strokeWidth:2.5, markerColor:'orange', drawDuration:500 },
          { type:'label', x:178, y:152, text:'f = μN', size:10,
            color:'#e67e22', anchor:'end', duration:350 },
          // Summary
          { type:'path', d:'M68 290 L372 290 L372 326 L68 326 Z',
            stroke:'rgba(200,214,229,0.18)', strokeWidth:1.2,
            fill:'rgba(200,214,229,0.04)', drawDuration:400, fillDuration:250 },
          { type:'text', x:220, y:305, text:'a = g·sinθ − μg·cosθ = g(sinθ − μcosθ)',
            size:9.5, color:'#c8d6e5', duration:500 },
          { type:'text', x:220, y:320, text:'Object slides when: tanθ > μ',
            size:9, color:'rgba(200,214,229,0.6)', duration:400 },
        ],
      },
    ],
  },

  // ── FREE BODY DIAGRAM — Tension & pulley ─────────────────────────────────
  fbd_tension: {
    steps: [
      {
        narration: 'An Atwood machine — two masses connected by a string over a pulley. Used to study tension and acceleration.',
        pauseAfter: 500,
        elements: [
          // Pulley — circle at top
          { type:'circle', cx:220, cy:80, r:24,
            stroke:'#c8d6e5', strokeWidth:2.5, fill:'rgba(200,214,229,0.08)',
            drawDuration:700, fillDuration:400 },
          // Pulley center axle
          { type:'circle', cx:220, cy:80, r:6,
            stroke:'#c8d6e5', strokeWidth:2, fill:'rgba(200,214,229,0.4)',
            drawDuration:300, fillDuration:200 },
          // Ceiling mount
          { type:'line', x1:200, y1:56, x2:240, y2:56,
            stroke:'rgba(200,214,229,0.4)', strokeWidth:2.5, drawDuration:300 },
          ...Array.from({length:5},(_,i)=>({
            type:'line', x1:204+i*9, y1:56, x2:200+i*9, y2:44,
            stroke:'rgba(200,214,229,0.25)', strokeWidth:1.5, drawDuration:80, delayAfter:0,
          })),
          // Left string
          { type:'line', x1:198, y1:80, x2:148, y2:80,
            stroke:'#c8d6e5', strokeWidth:2, drawDuration:300 },
          { type:'line', x1:148, y1:80, x2:148, y2:155,
            stroke:'#c8d6e5', strokeWidth:2, drawDuration:400 },
          // Right string
          { type:'line', x1:242, y1:80, x2:292, y2:80,
            stroke:'#c8d6e5', strokeWidth:2, drawDuration:300 },
          { type:'line', x1:292, y1:80, x2:292, y2:155,
            stroke:'#c8d6e5', strokeWidth:2, drawDuration:400 },
          { type:'label', x:220, y:68, text:'Pulley', size:9,
            color:'rgba(200,214,229,0.6)', duration:300 },
        ],
      },
      {
        narration: 'Mass 1 (m₁) — the lighter mass. Tension T pulls it UP. Weight m₁g pulls it DOWN.',
        pauseAfter: 500,
        elements: [
          // Left block m1
          { type:'path', d:'M120 155 L176 155 L176 215 L120 215 Z',
            stroke:'#9b59b6', strokeWidth:2.5, fill:'rgba(155,89,182,0.12)',
            drawDuration:600, fillDuration:400 },
          { type:'label', x:148, y:191, text:'m₁', size:12,
            color:'#9b59b6', weight:'700', duration:300 },
          // T arrow up on m1
          { type:'arrow', d:'M148 155 L148 88',
            stroke:'#3498db', strokeWidth:3, markerColor:'blue', drawDuration:500 },
          { type:'label', x:130, y:118, text:'T', size:13,
            color:'#3498db', weight:'700', anchor:'end', duration:300 },
          // Weight arrow down on m1
          { type:'arrow', d:'M148 215 L148 278',
            stroke:'#e74c3c', strokeWidth:3, markerColor:'red', drawDuration:500 },
          { type:'label', x:130, y:250, text:'m₁g', size:11,
            color:'#e74c3c', weight:'700', anchor:'end', duration:300 },
        ],
      },
      {
        narration: 'Mass 2 (m₂) — the heavier mass. Same tension T pulls it UP. Greater weight m₂g pulls it DOWN.',
        pauseAfter: 500,
        elements: [
          // Right block m2 — bigger
          { type:'path', d:'M260 155 L324 155 L324 230 L260 230 Z',
            stroke:'#e67e22', strokeWidth:2.5, fill:'rgba(230,126,34,0.12)',
            drawDuration:600, fillDuration:400 },
          { type:'label', x:292, y:199, text:'m₂', size:12,
            color:'#e67e22', weight:'700', duration:300 },
          // T arrow up on m2 — same length as m1 (same tension)
          { type:'arrow', d:'M292 155 L292 88',
            stroke:'#3498db', strokeWidth:3, markerColor:'blue', drawDuration:500 },
          { type:'label', x:310, y:118, text:'T', size:13,
            color:'#3498db', weight:'700', anchor:'start', duration:300 },
          // Weight arrow down on m2 — longer (bigger mass)
          { type:'arrow', d:'M292 230 L292 308',
            stroke:'#e74c3c', strokeWidth:3.5, markerColor:'red', drawDuration:550 },
          { type:'label', x:310, y:272, text:'m₂g', size:11,
            color:'#e74c3c', weight:'700', anchor:'start', duration:300 },
          // Inequality indicator
          { type:'text', x:220, y:300, text:'m₂g > m₁g  →  m₂ accelerates downward',
            size:9.5, color:'rgba(200,214,229,0.65)', duration:400 },
        ],
      },
      {
        narration: `The system accelerates. Tension T is the same throughout the string. Equations come from Newton's 2nd law applied to each mass.`,
        pauseAfter: 500,
        elements: [
          // Motion arrows showing direction
          { type:'arrow', d:'M148 215 L148 250',
            stroke:'rgba(200,214,229,0.5)', strokeWidth:2, markerColor:'white', drawDuration:350 },
          { type:'text', x:115, y:240, text:'↑ rises',
            size:9, color:'rgba(200,214,229,0.5)', anchor:'end', duration:250 },
          { type:'arrow', d:'M292 230 L292 260',
            stroke:'rgba(200,214,229,0.5)', strokeWidth:2, markerColor:'white', drawDuration:350 },
          { type:'text', x:325, y:250, text:'↓ falls',
            size:9, color:'rgba(200,214,229,0.5)', anchor:'start', duration:250 },
          // Formula box
          { type:'path', d:'M68 280 L372 280 L372 332 L68 332 Z',
            stroke:'rgba(200,214,229,0.18)', strokeWidth:1.2,
            fill:'rgba(200,214,229,0.04)', drawDuration:400, fillDuration:250 },
          { type:'text', x:220, y:298, text:'a = (m₂ − m₁)g / (m₁ + m₂)',
            size:10.5, color:'#c8d6e5', duration:450 },
          { type:'text', x:220, y:316, text:'T = 2m₁m₂g / (m₁ + m₂)',
            size:10, color:'rgba(200,214,229,0.75)', duration:400 },
        ],
      },
    ],
  },

  // ── FREE BODY DIAGRAM — Circular motion ──────────────────────────────────
  fbd_circular: {
    steps: [
      {
        narration: 'Circular motion — an object moving in a circle at constant speed. The velocity direction constantly changes, so there must be a net inward force.',
        pauseAfter: 500,
        elements: [
          // Circular path
          { type:'circle', cx:220, cy:172, r:105,
            stroke:'rgba(200,214,229,0.25)', strokeWidth:1.5,
            drawDuration:900 },
          // Object on circle — top
          { type:'circle', cx:220, cy:67, r:14,
            stroke:'#c8d6e5', strokeWidth:2.5, fill:'rgba(200,214,229,0.12)',
            drawDuration:500, fillDuration:350 },
          { type:'label', x:220, y:67, text:'m', size:10,
            color:'#c8d6e5', weight:'600', duration:280 },
          // Center point
          { type:'circle', cx:220, cy:172, r:4,
            stroke:'#f1c40f', strokeWidth:2, fill:'rgba(241,196,15,0.6)',
            drawDuration:250, fillDuration:200 },
          { type:'label', x:228, y:178, text:'center', size:8,
            color:'rgba(241,196,15,0.7)', anchor:'start', duration:250 },
          // Radius line
          { type:'line', x1:220, y1:172, x2:220, y2:81,
            stroke:'rgba(241,196,15,0.4)', strokeWidth:1.2,
            strokeDash:'5,4', drawDuration:400 },
          { type:'label', x:232, y:128, text:'r', size:11,
            color:'rgba(241,196,15,0.7)', anchor:'start', duration:280 },
        ],
      },
      {
        narration: 'Velocity is always tangent to the circle — at the top, velocity points horizontally.',
        pauseAfter: 500,
        elements: [
          // Velocity arrow — tangent at top (pointing right)
          { type:'arrow', d:'M220 67 L310 67',
            stroke:'#2ecc71', strokeWidth:3, markerColor:'green', drawDuration:500 },
          { type:'label', x:316, y:62, text:'v', size:13,
            color:'#2ecc71', weight:'700', anchor:'start', duration:300 },
          { type:'text', x:316, y:78, text:'(tangential)',
            size:8, color:'rgba(46,204,113,0.65)', anchor:'start', duration:280 },
          // Velocity at right side
          { type:'arrow', d:'M325 172 L325 82',
            stroke:'rgba(46,204,113,0.45)', strokeWidth:2, markerColor:'green', drawDuration:450 },
          // Velocity at bottom
          { type:'arrow', d:'M220 277 L130 277',
            stroke:'rgba(46,204,113,0.45)', strokeWidth:2, markerColor:'green', drawDuration:450 },
          // Velocity at left
          { type:'arrow', d:'M115 172 L115 262',
            stroke:'rgba(46,204,113,0.45)', strokeWidth:2, markerColor:'green', drawDuration:450 },
        ],
      },
      {
        narration: 'Centripetal force — always points INWARD toward the center. This is the net force causing circular motion: Fc = mv²/r.',
        pauseAfter: 500,
        elements: [
          // Centripetal force arrow — inward from top object
          { type:'arrow', d:'M220 67 L220 142',
            stroke:'#e74c3c', strokeWidth:3.5, markerColor:'red', drawDuration:550 },
          { type:'label', x:238, y:108, text:'Fc', size:13,
            color:'#e74c3c', weight:'700', anchor:'start', duration:350 },
          { type:'text', x:258, y:122, text:'(centripetal)',
            size:8, color:'rgba(231,76,60,0.65)', anchor:'start', duration:280 },
          // Show inward arrows at multiple points
          { type:'arrow', d:'M325 172 L256 172',
            stroke:'rgba(231,76,60,0.5)', strokeWidth:2.5, markerColor:'red', drawDuration:380 },
          { type:'arrow', d:'M115 172 L184 172',
            stroke:'rgba(231,76,60,0.5)', strokeWidth:2.5, markerColor:'red', drawDuration:380 },
          { type:'arrow', d:'M220 277 L220 202',
            stroke:'rgba(231,76,60,0.5)', strokeWidth:2.5, markerColor:'red', drawDuration:380 },
        ],
      },
      {
        narration: `Centripetal acceleration points inward: ac = v²/r. By Newton's 2nd law: Fc = mac = mv²/r.`,
        pauseAfter: 500,
        elements: [
          // Formula box
          { type:'path', d:'M68 292 L372 292 L372 334 L68 334 Z',
            stroke:'rgba(200,214,229,0.18)', strokeWidth:1.2,
            fill:'rgba(200,214,229,0.04)', drawDuration:400, fillDuration:250 },
          { type:'text', x:220, y:308, text:'Fc = mv²/r = mω²r = mac',
            size:11, color:'#c8d6e5', duration:450 },
          { type:'text', x:220, y:325, text:'Period: T = 2πr/v = 2π/ω',
            size:9.5, color:'rgba(200,214,229,0.65)', duration:400 },
          // "No centripetal = straight line" note
          { type:'text', x:220, y:280, text:'Without Fc → object flies off in straight line (Newton 1st)',
            size:9, color:'rgba(200,214,229,0.5)', duration:400 },
        ],
      },
    ],
  },

  // ── FREE BODY DIAGRAM — Equilibrium ──────────────────────────────────────
  fbd_equilibrium: {
    steps: [
      {
        narration: 'Static equilibrium — an object at rest with zero net force and zero net torque. All forces balance perfectly.',
        pauseAfter: 500,
        elements: [
          // Beam/plank
          { type:'path', d:'M60 175 L380 175 L380 195 L60 195 Z',
            stroke:'#c8d6e5', strokeWidth:2, fill:'rgba(200,214,229,0.08)',
            drawDuration:700, fillDuration:500 },
          // Pivot triangle
          { type:'path', d:'M220 195 L248 240 L192 240 Z',
            stroke:'#f1c40f', strokeWidth:2, fill:'rgba(241,196,15,0.15)',
            drawDuration:500, fillDuration:350 },
          { type:'label', x:220, y:255, text:'Pivot', size:9,
            color:'rgba(241,196,15,0.7)', duration:280 },
        ],
      },
      {
        narration: 'Multiple forces act on the beam. Each creates a torque: τ = F × d (force × perpendicular distance from pivot).',
        pauseAfter: 500,
        elements: [
          // Force 1 — downward left
          { type:'arrow', d:'M110 175 L110 110',
            stroke:'#e74c3c', strokeWidth:3, markerColor:'red', drawDuration:480 },
          { type:'label', x:110, y:100, text:'F₁', size:12,
            color:'#e74c3c', weight:'700', duration:300 },
          // Force 2 — downward right
          { type:'arrow', d:'M330 175 L330 110',
            stroke:'#9b59b6', strokeWidth:3, markerColor:'red', drawDuration:480 },
          { type:'label', x:330, y:100, text:'F₂', size:12,
            color:'#9b59b6', weight:'700', duration:300 },
          // Distance annotations
          { type:'line', x1:110, y1:210, x2:220, y2:210,
            stroke:'rgba(231,76,60,0.4)', strokeWidth:1,
            strokeDash:'4,3', drawDuration:350 },
          { type:'text', x:165, y:224, text:'d₁', size:10,
            color:'rgba(231,76,60,0.65)', duration:250 },
          { type:'line', x1:220, y1:210, x2:330, y2:210,
            stroke:'rgba(155,89,182,0.4)', strokeWidth:1,
            strokeDash:'4,3', drawDuration:350 },
          { type:'text', x:275, y:224, text:'d₂', size:10,
            color:'rgba(155,89,182,0.65)', duration:250 },
        ],
      },
      {
        narration: 'Normal reaction at pivot (R) balances all downward forces: R = F₁ + F₂.',
        pauseAfter: 500,
        elements: [
          // Reaction force — upward from pivot
          { type:'arrow', d:'M220 195 L220 125',
            stroke:'#3498db', strokeWidth:3.5, markerColor:'blue', drawDuration:550 },
          { type:'label', x:238, y:155, text:'R', size:13,
            color:'#3498db', weight:'700', anchor:'start', duration:320 },
          { type:'label', x:238, y:170, text:'R = F₁ + F₂', size:10,
            color:'#3498db', anchor:'start', duration:320 },
        ],
      },
      {
        narration: 'Equilibrium conditions: ΣF = 0 (force balance) and Στ = 0 (torque balance). These give two equations to solve.',
        pauseAfter: 500,
        elements: [
          { type:'path', d:'M68 268 L372 268 L372 336 L68 336 Z',
            stroke:'rgba(200,214,229,0.18)', strokeWidth:1.2,
            fill:'rgba(200,214,229,0.04)', drawDuration:400, fillDuration:250 },
          { type:'text', x:220, y:284, text:'ΣFy = 0: R − F₁ − F₂ = 0',
            size:10.5, color:'#c8d6e5', duration:400 },
          { type:'text', x:220, y:302, text:'Στ = 0: F₁·d₁ = F₂·d₂  (moments balance)',
            size:10, color:'rgba(200,214,229,0.8)', duration:400 },
          { type:'text', x:220, y:320, text:'Principle of moments: clockwise = anticlockwise',
            size:9, color:'rgba(200,214,229,0.55)', duration:400 },
        ],
      },
    ],
  },


};

export { WhiteboardEngine, WHITEBOARD_CONCEPTS };