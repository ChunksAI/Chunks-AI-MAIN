/**
 * src/visual-tutor/WhiteboardEngine.js  — v3
 *
 * "Professor Drawing Live" upgrade:
 *   • Moving gold pen-cursor dot that tracks the tip of every stroke
 *   • Visible hand-drawn jitter (2.8 px default, was 1.0)
 *   • 3-layer stroke pressure simulation (shadow + main + highlight)
 *   • Slower, more deliberate draw durations
 *   • Dot-grid whiteboard background
 *   • Inter-element stagger increased (120 ms default, was 80 ms)
 *   • Text types character-by-character
 *   • All existing element types preserved — zero breaking changes
 */

// ── Easing ────────────────────────────────────────────────────────────────────

const ease = {
  outCubic:   t => 1 - Math.pow(1 - t, 3),
  outQuart:   t => 1 - Math.pow(1 - t, 4),
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
  inOutSine:  t => -(Math.cos(Math.PI * t) - 1) / 2,
  linear:     t => t,
};

// ── Jitter helper — visible hand-drawn noise ──────────────────────────────────

function jitterPath(d, amount) {
  const amt = amount !== undefined ? amount : 2.8;
  return d.replace(/(-?\d+\.?\d*)/g, function(match, num, offset, str) {
    const prev = str[offset - 1];
    if (prev && /[a-zA-Z,\s]/.test(prev)) {
      const n = parseFloat(num);
      const noise = (Math.random() - 0.5) * amt * 2;
      return (n + noise).toFixed(2);
    }
    return match;
  });
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => {
  const e = document.createElementNS(NS, tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
};

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '200,214,229';
}

function _lighten(hex, amount) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return hex;
  const lerp = v => Math.round(v + (255 - v) * amount);
  return 'rgb(' + lerp(parseInt(r[1],16)) + ',' + lerp(parseInt(r[2],16)) + ',' + lerp(parseInt(r[3],16)) + ')';
}

// ── WhiteboardEngine ──────────────────────────────────────────────────────────

export class WhiteboardEngine {
  constructor(container, concept, onStep, onDone, options) {
    options = options || {};
    this.container    = container;
    this.concept      = concept;
    this.onStep       = onStep;
    this.onDone       = onDone;
    this.stepIdx      = 0;
    this.rafId        = null;
    this._stopped     = false;
    this.jitter       = options.jitter !== false;
    this.jitterAmt    = options.jitterAmount !== undefined ? options.jitterAmount : 2.8;
    this._gradientIdx = 0;

    // v3 feature flags (all on by default)
    this._penCursor      = options.penCursor      !== false;
    this._pressureStroke = options.pressureStroke !== false;
    this._dotGrid        = options.dotGrid        !== false;

    const vb = options.viewBox || '0 0 440 340';
    const parts = vb.split(' ').map(Number);
    this._vw = parts[2];
    this._vh = parts[3];

    // Build SVG
    this.svg = el('svg', { viewBox: vb, width: '100%', height: '100%' });
    this.svg.style.cssText = 'display:block;overflow:visible;';
    this.svg.appendChild(el('rect', { width: this._vw, height: this._vh, fill: 'var(--surface-1, #13161b)' }));

    this.defs = el('defs');
    this.svg.appendChild(this.defs);
    this._buildMarkers();
    this._buildFilters();

    if (this._dotGrid)   this._buildDotGrid();
    this._penDot  = null;
    this._penGlow = null;
    if (this._penCursor) this._buildPenCursor();

    container.innerHTML = '';
    container.appendChild(this.svg);
  }

  // ── Dot-grid background ───────────────────────────────────────────────────

  _buildDotGrid() {
    const spacing = 22;
    const g = el('g', { opacity: '0.04' });
    for (let x = spacing; x < this._vw; x += spacing) {
      for (let y = spacing; y < this._vh; y += spacing) {
        g.appendChild(el('circle', { cx: x, cy: y, r: '1', fill: '#9898ae' }));
      }
    }
    this.svg.appendChild(g);
  }

  // ── Pen cursor ────────────────────────────────────────────────────────────

  _buildPenCursor() {
    this._penGlow = el('circle', { r: '10', fill: 'none', stroke: '#e8ac2e', 'stroke-width': '1', opacity: '0' });
    this.svg.appendChild(this._penGlow);
    this._penDot = el('circle', { r: '4.5', fill: '#e8ac2e', stroke: 'rgba(232,172,46,0.3)', 'stroke-width': '3', opacity: '0' });
    this.svg.appendChild(this._penDot);
  }

  _movePen(x, y, visible) {
    if (!this._penDot) return;
    const show = visible !== false;
    this._penDot.setAttribute('cx', x);
    this._penDot.setAttribute('cy', y);
    this._penDot.style.opacity  = show ? '1' : '0';
    if (this._penGlow) {
      this._penGlow.setAttribute('cx', x);
      this._penGlow.setAttribute('cy', y);
      this._penGlow.style.opacity = show ? '0.35' : '0';
    }
    // Always keep pen on top
    this.svg.appendChild(this._penDot);
    if (this._penGlow) this.svg.appendChild(this._penGlow);
  }

  _hidePen() { this._movePen(0, 0, false); }

  // ── Markers & filters ─────────────────────────────────────────────────────

  _buildMarkers() {
    const colors = {
      white: '#e8edf2', green: '#2ecc71', yellow: '#f1c40f',
      blue: '#3498db', teal: '#1abc9c', orange: '#e67e22',
      red: '#e74c3c', purple: '#9b59b6', gray: '#95a5a6',
    };
    Object.entries(colors).forEach(([name, color]) => {
      const m = el('marker', { id: 'wb-arrow-' + name, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' });
      m.appendChild(el('path', { d: 'M1 1L9 5L1 9', fill: 'none', stroke: color, 'stroke-width': '1.8', 'stroke-linecap': 'round' }));
      this.defs.appendChild(m);
    });
  }

  _buildFilters() {
    [
      { id: 'wb-glow-purple', blur: 3 },
      { id: 'wb-glow-orange', blur: 3 },
      { id: 'wb-glow-blue',   blur: 3 },
      { id: 'wb-glow-green',  blur: 3 },
      { id: 'wb-glow-red',    blur: 3 },
      { id: 'wb-glow-yellow', blur: 3 },
      { id: 'wb-glow-soft',   blur: 2 },
    ].forEach(({ id, blur }) => {
      const f = el('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%' });
      f.appendChild(el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: blur }));
      this.defs.appendChild(f);
    });
  }

  _makeGradient(stops, x1, y1, x2, y2) {
    x1 = x1 || '0%'; y1 = y1 || '0%'; x2 = x2 || '0%'; y2 = y2 || '100%';
    const id = 'wb-grad-' + (++this._gradientIdx);
    const g  = el('linearGradient', { id, x1, y1, x2, y2 });
    stops.forEach(function(s) {
      const stop = el('stop', { offset: s.offset });
      stop.style.stopColor   = s.color;
      stop.style.stopOpacity = s.opacity !== undefined ? s.opacity : 1;
      g.appendChild(stop);
    });
    this.defs.appendChild(g);
    return id;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start()  { this._stopped = false; this._runStep(); }
  stop()   { this._stopped = true; if (this.rafId) cancelAnimationFrame(this.rafId); this._hidePen(); }
  replay() {
    this.stepIdx = 0;
    const keep = new Set(['defs', 'rect', 'marker', 'filter', 'linearGradient', 'radialGradient', 'feGaussianBlur']);
    Array.from(this.svg.childNodes).forEach(n => {
      if (n.nodeType === 1 && !keep.has(n.tagName.toLowerCase())) n.remove();
    });
    if (this._penCursor) this._buildPenCursor();
    this.start();
  }

  _runStep() {
    if (this._stopped) return;
    const steps = this.concept.steps;
    if (this.stepIdx >= steps.length) { this._hidePen(); this.onDone && this.onDone(); return; }

    const step = steps[this.stepIdx];
    this.onStep && this.onStep(this.stepIdx, step.narration, steps.length);
    this._animElements(step.elements || [], 0, () => {
      setTimeout(() => { this.stepIdx++; this._runStep(); }, step.pauseAfter !== undefined ? step.pauseAfter : 700);
    });
  }

  _animElements(elements, idx, onAllDone) {
    if (this._stopped) return;
    if (idx >= elements.length) { onAllDone(); return; }

    const item = elements[idx];
    const self = this;
    const next = function() {
      const delay = item.delayAfter !== undefined ? item.delayAfter : 120;
      setTimeout(function() { self._animElements(elements, idx + 1, onAllDone); }, delay);
    };

    switch (item.type) {
      case 'path':          this._animPath(item, next);          break;
      case 'circle':        this._animCircle(item, next);        break;
      case 'ellipse':       this._animEllipse(item, next);       break;
      case 'line':          this._animLine(item, next);          break;
      case 'arrow':         this._animArrow(item, next);         break;
      case 'text':          this._animText(item, next);          break;
      case 'label':         this._animLabel(item, next);         break;
      case 'taperpath':     this._animTaperPath(item, next);     break;
      case 'glow':          this._animGlow(item, next);          break;
      case 'group':         this._animGroup(item, next);         break;
      case 'graph':         this._animGraph(item, next);         break;
      case 'timeline':      this._animTimeline(item, next);      break;
      case 'branch':        this._animBranch(item, next);        break;
      case 'container':     this._animContainer(item, next);     break;
      case 'particle_flow': this._animParticleFlow(item, next);  break;
      default:              next(); break;
    }
  }

  // ── PATH — 3-layer pressure + live pen cursor ─────────────────────────────

  _animPath(item, done) {
    const d = this.jitter ? jitterPath(item.d, this.jitterAmt) : item.d;

    let fillAttr = item.fill || 'none';
    if (item.gradient) {
      const dir = item.gradient.dir || ['0%','0%','0%','100%'];
      const gid = this._makeGradient(item.gradient.stops, dir[0], dir[1], dir[2], dir[3]);
      fillAttr = 'url(#' + gid + ')';
    }

    const strokeColor = item.stroke || '#e8edf2';
    const strokeW     = item.strokeWidth || 2;
    const drawDur     = item.drawDuration !== undefined ? item.drawDuration : 1000;
    const fillDur     = item.fillDuration !== undefined ? item.fillDuration : 550;

    // Layer 1: shadow underdrawing
    let shadow = null;
    if (this._pressureStroke) {
      shadow = el('path', { d, fill: 'none', stroke: strokeColor, 'stroke-width': strokeW * 0.55, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.22' });
    }

    // Layer 2: main
    const path = el('path', { d, fill: 'none', stroke: strokeColor, 'stroke-width': strokeW, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    if (item.strokeDash)       path.setAttribute('stroke-dasharray', item.strokeDash);
    if (item.opacity != null)  path.style.opacity = item.opacity;
    if (item.filter)           path.setAttribute('filter', item.filter);
    if (item.transform)        path.setAttribute('transform', item.transform);

    // Layer 3: highlight sheen
    let sheen = null;
    if (this._pressureStroke) {
      const d2 = this.jitter ? jitterPath(item.d, this.jitterAmt * 0.4) : item.d;
      sheen = el('path', { d: d2, fill: 'none', stroke: _lighten(strokeColor, 0.35), 'stroke-width': strokeW * 0.35, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.18' });
    }

    if (shadow) this.svg.appendChild(shadow);
    this.svg.appendChild(path);
    if (sheen)  this.svg.appendChild(sheen);

    let len;
    try { len = path.getTotalLength() || 300; } catch(e) { len = 300; }

    const layers = [shadow, path, sheen];
    const applyDash = val => layers.forEach(l => {
      if (l) { l.setAttribute('stroke-dasharray', len); l.setAttribute('stroke-dashoffset', val); }
    });
    applyDash(len);

    let startPt;
    try { startPt = path.getPointAtLength(0); } catch(e) { startPt = {x:0,y:0}; }
    this._movePen(startPt.x, startPt.y);

    const self = this;
    this._raf(drawDur, ease.outCubic, function(t) {
      applyDash(len * (1 - t));
      if (self._penDot) {
        try { const pt = path.getPointAtLength(len * t); self._movePen(pt.x, pt.y); } catch(e) {}
      }
    }, function() {
      if (fillAttr === 'none') { done(); return; }
      path.setAttribute('fill', fillAttr);
      path.style.fillOpacity = '0';
      self._raf(fillDur, ease.outCubic, function(t) { path.style.fillOpacity = t; }, done);
    });
  }

  // ── CIRCLE ────────────────────────────────────────────────────────────────

  _animCircle(item, done) {
    const circle = el('circle', { cx: item.cx, cy: item.cy, r: item.r, fill: 'none', stroke: item.stroke || '#e8edf2', 'stroke-width': item.strokeWidth || 2 });
    if (item.opacity != null) circle.style.opacity = item.opacity;
    if (item.filter)          circle.setAttribute('filter', item.filter);
    if (item.transform)       circle.setAttribute('transform', item.transform);
    this.svg.appendChild(circle);

    const r    = parseFloat(item.r) || 30;
    const cx   = parseFloat(item.cx) || 0;
    const cy   = parseFloat(item.cy) || 0;
    const circ = 2 * Math.PI * r;
    circle.setAttribute('stroke-dasharray',  circ);
    circle.setAttribute('stroke-dashoffset', circ);

    let fillAttr = item.fill || 'none';
    if (item.gradient) {
      const dir = item.gradient.dir || ['0%','0%','0%','100%'];
      fillAttr = 'url(#' + this._makeGradient(item.gradient.stops, dir[0], dir[1], dir[2], dir[3]) + ')';
    }

    this._movePen(cx, cy - r);
    const drawDur = item.drawDuration !== undefined ? item.drawDuration : 800;
    const fillDur = item.fillDuration !== undefined ? item.fillDuration : 450;
    const self = this;

    this._raf(drawDur, ease.outCubic, function(t) {
      circle.setAttribute('stroke-dashoffset', circ * (1 - t));
      if (self._penDot) {
        const angle = -Math.PI / 2 + t * 2 * Math.PI;
        self._movePen(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      }
    }, function() {
      if (fillAttr === 'none') { done(); return; }
      circle.setAttribute('fill', fillAttr);
      circle.style.fillOpacity = '0';
      self._raf(fillDur, ease.outCubic, function(t) { circle.style.fillOpacity = t; }, done);
    });
  }

  // ── ELLIPSE ───────────────────────────────────────────────────────────────

  _animEllipse(item, done) {
    const e = el('ellipse', { cx: item.cx, cy: item.cy, rx: item.rx, ry: item.ry, fill: 'none', stroke: item.stroke || '#e8edf2', 'stroke-width': item.strokeWidth || 2 });
    if (item.transform)       e.setAttribute('transform', item.transform);
    if (item.opacity != null) e.style.opacity = item.opacity;
    if (item.filter)          e.setAttribute('filter', item.filter);
    this.svg.appendChild(e);

    const rx = parseFloat(item.rx) || 30, ry = parseFloat(item.ry) || 20;
    const cx = parseFloat(item.cx) || 0,  cy = parseFloat(item.cy) || 0;
    const perim = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    e.setAttribute('stroke-dasharray',  perim);
    e.setAttribute('stroke-dashoffset', perim);

    let fillAttr = item.fill || 'none';
    if (item.gradient) {
      const dir = item.gradient.dir || ['0%','0%','0%','100%'];
      fillAttr = 'url(#' + this._makeGradient(item.gradient.stops, dir[0], dir[1], dir[2], dir[3]) + ')';
    }

    this._movePen(cx, cy - ry);
    const drawDur = item.drawDuration !== undefined ? item.drawDuration : 800;
    const fillDur = item.fillDuration !== undefined ? item.fillDuration : 450;
    const self = this;

    this._raf(drawDur, ease.outCubic, function(t) {
      e.setAttribute('stroke-dashoffset', perim * (1 - t));
      if (self._penDot) {
        const angle = -Math.PI / 2 + t * 2 * Math.PI;
        self._movePen(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
      }
    }, function() {
      if (fillAttr === 'none') { done(); return; }
      e.setAttribute('fill', fillAttr);
      e.style.fillOpacity = '0';
      self._raf(fillDur, ease.outCubic, function(t) { e.style.fillOpacity = t; }, done);
    });
  }

  // ── LINE ──────────────────────────────────────────────────────────────────

  _animLine(item, done) {
    const line = el('line', { x1: item.x1, y1: item.y1, x2: item.x2, y2: item.y2, stroke: item.stroke || '#e8edf2', 'stroke-width': item.strokeWidth || 1.5, 'stroke-linecap': 'round' });
    if (item.strokeDash) line.setAttribute('stroke-dasharray', item.strokeDash);
    if (item.marker)     line.setAttribute('marker-end', 'url(#wb-arrow-' + item.marker + ')');
    this.svg.appendChild(line);

    const dx = item.x2 - item.x1, dy = item.y2 - item.y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 100;
    line.setAttribute('stroke-dasharray',  len);
    line.setAttribute('stroke-dashoffset', len);
    this._movePen(item.x1, item.y1);
    const self = this;

    this._raf(item.drawDuration !== undefined ? item.drawDuration : 500, ease.outCubic, function(t) {
      line.setAttribute('stroke-dashoffset', len * (1 - t));
      self._movePen(item.x1 + dx * t, item.y1 + dy * t);
    }, done);
  }

  // ── ARROW ─────────────────────────────────────────────────────────────────

  _animArrow(item, done) {
    const d = this.jitter ? jitterPath(item.d, this.jitterAmt * 0.5) : item.d;
    const path = el('path', { d, fill: 'none', stroke: item.stroke || '#e8edf2', 'stroke-width': item.strokeWidth || 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'marker-end': 'url(#wb-arrow-' + (item.markerColor || 'white') + ')' });
    this.svg.appendChild(path);

    let len; try { len = path.getTotalLength() || 100; } catch(e) { len = 100; }
    path.setAttribute('stroke-dasharray',  len);
    path.setAttribute('stroke-dashoffset', len);

    let startPt; try { startPt = path.getPointAtLength(0); } catch(e) { startPt = {x:0,y:0}; }
    this._movePen(startPt.x, startPt.y);
    const self = this;

    this._raf(item.drawDuration !== undefined ? item.drawDuration : 600, ease.outCubic, function(t) {
      path.setAttribute('stroke-dashoffset', len * (1 - t));
      if (self._penDot) { try { const pt = path.getPointAtLength(len * t); self._movePen(pt.x, pt.y); } catch(e) {} }
    }, done);
  }

  // ── TEXT — character-by-character typewriter ──────────────────────────────

  _animText(item, done) {
    // If item.duration is set and very short, fall back to opacity fade
    if (item.duration != null && item.duration < 200) {
      const t = el('text', { x: item.x, y: item.y, 'text-anchor': item.anchor || 'middle', 'font-size': item.size || 11, 'font-family': 'var(--font-body, system-ui, sans-serif)', 'font-weight': item.weight || '400', fill: item.color || '#c8d6e5' });
      t.style.opacity = '0';
      t.textContent = item.text;
      this.svg.appendChild(t);
      this._raf(item.duration, ease.outCubic, function(v) { t.style.opacity = v; }, done);
      return;
    }

    const t = el('text', { x: item.x, y: item.y, 'text-anchor': item.anchor || 'middle', 'font-size': item.size || 11, 'font-family': 'var(--font-body, system-ui, sans-serif)', 'font-weight': item.weight || '400', fill: item.color || '#c8d6e5' });
    t.textContent = '';
    this.svg.appendChild(t);

    const fullText  = item.text || '';
    const charDelay = item.charDelay !== undefined ? item.charDelay : 26;
    const fontSize  = parseFloat(item.size || 11);
    const charWidth = fontSize * 0.55;
    const startX    = item.anchor === 'middle' ? parseFloat(item.x) - (fullText.length * charWidth) / 2
                    : item.anchor === 'end'    ? parseFloat(item.x) - fullText.length * charWidth
                    : parseFloat(item.x);
    const penY = parseFloat(item.y) - fontSize * 0.3;

    this._movePen(startX, penY);

    let charIdx = 0;
    const self = this;
    const typeNext = function() {
      if (self._stopped) return;
      if (charIdx >= fullText.length) { done(); return; }
      t.textContent += fullText[charIdx];
      self._movePen(startX + (charIdx + 1) * charWidth, penY);
      charIdx++;
      setTimeout(typeNext, charDelay);
    };
    typeNext();
  }

  // ── LABEL ─────────────────────────────────────────────────────────────────

  _animLabel(item, done) {
    const g = el('g');
    g.style.opacity = '0';
    this.svg.appendChild(g);

    const pad = { x: 9, y: 5 };
    const w   = (item.text.length * (item.size || 10) * 0.6) + pad.x * 2;
    const h   = (item.size || 10) + pad.y * 2;
    const ax  = item.anchor === 'end'   ? item.x - w
              : item.anchor === 'start' ? item.x
              : item.x - w / 2;

    g.appendChild(el('rect', { x: ax, y: item.y - (item.size || 10) - pad.y + 2, width: w, height: h, rx: 5, fill: item.bgColor || 'rgba(18,22,30,0.88)' }));
    const t = el('text', { x: item.x, y: item.y, 'text-anchor': item.anchor || 'middle', 'font-size': item.size || 10, 'font-family': 'var(--font-body, system-ui, sans-serif)', 'font-weight': item.weight || '600', fill: item.color || '#e8edf2' });
    t.textContent = item.text;
    g.appendChild(t);

    this._raf(item.duration !== undefined ? item.duration : 350, ease.outCubic, function(v) { g.style.opacity = v; }, done);
  }

  // ── GROUP ─────────────────────────────────────────────────────────────────

  _animGroup(item, done) {
    let completed = 0;
    const total = item.elements ? item.elements.length : 0;
    if (!total) { done(); return; }
    const self = this;
    item.elements.forEach(function(child) {
      self._animElements([child], 0, function() { if (++completed >= total) done(); });
    });
  }

  // ── TAPERPATH ─────────────────────────────────────────────────────────────

  _animTaperPath(item, done) {
    const widths = item.widths || [item.strokeWidth || 4, (item.strokeWidth || 4) * 0.3];
    const alphas = item.alphas || [1, 0.3];
    const color  = item.stroke || '#e8edf2';
    const g      = el('g');
    if (item.opacity != null) g.style.opacity = item.opacity;
    this.svg.appendChild(g);

    const paths = widths.map((w, i) => {
      const d = this.jitter ? jitterPath(item.d, this.jitterAmt * (1 - i * 0.3)) : item.d;
      const p = el('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      p.style.opacity = alphas[i] !== undefined ? alphas[i] : 1;
      if (item.filter) p.setAttribute('filter', item.filter);
      g.appendChild(p);
      return p;
    });

    let len; try { len = paths[0].getTotalLength() || 300; } catch(e) { len = 300; }
    paths.forEach(p => { p.setAttribute('stroke-dasharray', len); p.setAttribute('stroke-dashoffset', len); });

    let startPt; try { startPt = paths[0].getPointAtLength(0); } catch(e) { startPt = {x:0,y:0}; }
    this._movePen(startPt.x, startPt.y);

    const fillColor = item.fill || 'none';
    const drawDur   = item.drawDuration !== undefined ? item.drawDuration : 1000;
    const fillDur   = item.fillDuration !== undefined ? item.fillDuration : 450;
    const self = this;

    this._raf(drawDur, ease.outCubic, function(t) {
      paths.forEach(p => p.setAttribute('stroke-dashoffset', len * (1 - t)));
      if (self._penDot) { try { const pt = paths[0].getPointAtLength(len * t); self._movePen(pt.x, pt.y); } catch(e) {} }
    }, function() {
      if (fillColor === 'none') { done(); return; }
      paths[0].setAttribute('fill', fillColor);
      paths[0].style.fillOpacity = '0';
      self._raf(fillDur, ease.outCubic, function(t) { paths[0].style.fillOpacity = t; }, done);
    });
  }

  // ── GLOW ──────────────────────────────────────────────────────────────────

  _animGlow(item, done) {
    const path = el('path', { d: item.d, fill: item.fill || 'none', stroke: item.stroke || '#e8edf2', 'stroke-width': item.strokeWidth || 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: item.filter || 'url(#wb-glow-soft)' });
    path.style.opacity = item.opacity !== undefined ? item.opacity : 0.45;
    this.svg.appendChild(path);

    let len; try { len = path.getTotalLength() || 200; } catch(e) { len = 200; }
    path.setAttribute('stroke-dasharray',  len);
    path.setAttribute('stroke-dashoffset', len);
    this._raf(item.drawDuration !== undefined ? item.drawDuration : 700, ease.outCubic, function(t) { path.setAttribute('stroke-dashoffset', len * (1 - t)); }, done);
  }

  // ── GRAPH — bars animate individually, line drawn by pen ─────────────────

  _animGraph(item, done) {
    const x = item.x !== undefined ? item.x : 40;
    const y = item.y !== undefined ? item.y : 40;
    const w = item.w !== undefined ? item.w : 360;
    const h = item.h !== undefined ? item.h : 220;
    const data   = item.data || [];
    const color  = item.color || '#3498db';
    const style  = item.style || 'line';
    const g      = el('g');
    this.svg.appendChild(g);

    // Draw axes with pen
    const axPath = el('path', { d: 'M' + x + ' ' + y + ' L' + x + ' ' + (y+h) + ' L' + (x+w) + ' ' + (y+h), fill: 'none', stroke: '#4a5568', 'stroke-width': '1.5', 'stroke-linecap': 'round' });
    const axLen = h + w;
    axPath.setAttribute('stroke-dasharray', axLen);
    axPath.setAttribute('stroke-dashoffset', axLen);
    g.appendChild(axPath);
    this._movePen(x, y);

    const self = this;
    this._raf(450, ease.outCubic, function(t) {
      axPath.setAttribute('stroke-dashoffset', axLen * (1 - t));
    }, function() {
      const maxVal = Math.max.apply(null, data.map(d => d.value).concat([1]));
      const stepW  = w / Math.max(data.length - 1, 1);

      if (style === 'bar') {
        const barW = (w / Math.max(data.length, 1)) * 0.6;
        let completed = 0;
        data.forEach(function(d, i) {
          const bh  = (d.value / maxVal) * h * 0.88;
          const px  = x + i * (w / data.length) + (w / data.length - barW) / 2;
          const py  = y + h - bh;
          const bar = el('rect', { x: px, y: y + h, width: barW, height: 0, fill: color, rx: 3, opacity: '0.85' });
          g.appendChild(bar);
          const lbl = el('text', { x: px + barW / 2, y: y + h + 14, 'text-anchor': 'middle', 'font-size': 9, fill: '#8899aa', 'font-family': 'var(--font-body,sans-serif)' });
          lbl.textContent = d.label; lbl.style.opacity = '0';
          g.appendChild(lbl);

          setTimeout(function() {
            self._movePen(px + barW / 2, py);
            self._raf(500, ease.outCubic, function(t) {
              const bht = bh * t;
              bar.setAttribute('y', y + h - bht);
              bar.setAttribute('height', bht);
            }, function() {
              self._raf(200, ease.outCubic, function(v) { lbl.style.opacity = v; }, function() {
                if (++completed >= data.length) { self._addGraphLabels(g, item, x, y, w, h); done(); }
              });
            });
          }, i * 160);
        });

      } else {
        const pts = data.map(function(d, i) {
          return { px: x + i * stepW, py: y + h - (d.value / maxVal) * h * 0.88 };
        });

        let dStr;
        if (style === 'curve' && pts.length > 2) {
          dStr = 'M' + pts[0].px + ',' + pts[0].py;
          pts.slice(1).forEach(function(p, i) {
            const prev = pts[i];
            const cpx = (prev.px + p.px) / 2;
            dStr += ' C' + cpx + ',' + prev.py + ' ' + cpx + ',' + p.py + ' ' + p.px + ',' + p.py;
          });
        } else {
          dStr = 'M' + pts.map(p => p.px + ',' + p.py).join(' L');
        }

        const linePath = el('path', { d: dStr, fill: 'none', stroke: color, 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
        g.appendChild(linePath);
        let ll; try { ll = linePath.getTotalLength() || 300; } catch(e) { ll = 300; }
        linePath.setAttribute('stroke-dasharray', ll);
        linePath.setAttribute('stroke-dashoffset', ll);
        self._movePen(pts[0].px, pts[0].py);

        self._raf(item.duration !== undefined ? item.duration : 900, ease.outCubic, function(t) {
          linePath.setAttribute('stroke-dashoffset', ll * (1 - t));
          if (self._penDot) { try { const pt = linePath.getPointAtLength(ll * t); self._movePen(pt.x, pt.y); } catch(e) {} }
        }, function() {
          pts.forEach(function(p, i) {
            const dot = el('circle', { cx: p.px, cy: p.py, r: 4, fill: color, stroke: 'var(--surface-1,#13161b)', 'stroke-width': 2 });
            dot.style.opacity = '0';
            g.appendChild(dot);
            setTimeout(function() { self._raf(200, ease.outElastic, function(v) { dot.style.opacity = v; }, function() {}); }, i * 60);
            const lbl = el('text', { x: p.px, y: y + h + 16, 'text-anchor': 'middle', 'font-size': 9, fill: '#8899aa', 'font-family': 'var(--font-body,sans-serif)' });
            lbl.textContent = data[i].label; lbl.style.opacity = '0';
            g.appendChild(lbl);
            setTimeout(function() { self._raf(250, ease.outCubic, function(v) { lbl.style.opacity = v; }, function() {}); }, i * 60 + 100);
          });
          self._addGraphLabels(g, item, x, y, w, h);
          setTimeout(done, pts.length * 60 + 350);
        });
      }
    });
  }

  _addGraphLabels(g, item, x, y, w, h) {
    const self = this;
    if (item.xLabel) {
      const xl = el('text', { x: x + w / 2, y: y + h + 30, 'text-anchor': 'middle', 'font-size': 10, fill: '#8899aa', 'font-family': 'var(--font-body,sans-serif)' });
      xl.textContent = item.xLabel; xl.style.opacity = '0';
      g.appendChild(xl);
      self._raf(300, ease.outCubic, function(v) { xl.style.opacity = v; }, function() {});
    }
    if (item.yLabel) {
      const yl = el('text', { x: x - 28, y: y + h / 2, 'text-anchor': 'middle', 'font-size': 10, fill: '#8899aa', 'font-family': 'var(--font-body,sans-serif)', transform: 'rotate(-90 ' + (x-28) + ' ' + (y + h/2) + ')' });
      yl.textContent = item.yLabel; yl.style.opacity = '0';
      g.appendChild(yl);
      self._raf(300, ease.outCubic, function(v) { yl.style.opacity = v; }, function() {});
    }
  }

  // ── TIMELINE ──────────────────────────────────────────────────────────────

  _animTimeline(item, done) {
    const y      = item.y !== undefined ? item.y : 170;
    const color  = item.color || '#f1c40f';
    const events = item.events || [];
    const g      = el('g');
    this.svg.appendChild(g);

    const xs     = events.map(e => e.x !== undefined ? e.x : 60);
    const minX   = xs.length ? Math.min.apply(null, xs) : 60;
    const maxX   = xs.length ? Math.max.apply(null, xs) : 380;
    const spine  = el('line', { x1: minX - 20, y1: y, x2: maxX + 20, y2: y, stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round' });
    const spineLen = (maxX - minX) + 40;
    spine.setAttribute('stroke-dasharray',  spineLen);
    spine.setAttribute('stroke-dashoffset', spineLen);
    g.appendChild(spine);
    this._movePen(minX - 20, y);

    const self = this;
    this._raf(item.drawDuration !== undefined ? item.drawDuration : 700, ease.outCubic, function(t) {
      spine.setAttribute('stroke-dashoffset', spineLen * (1 - t));
      self._movePen(minX - 20 + spineLen * t, y);
    }, function() {
      let completed = 0;
      if (!events.length) { done(); return; }

      events.forEach(function(ev, i) {
        const ex    = ev.x !== undefined ? ev.x : (60 + i * 80);
        const above = i % 2 === 0;
        const ly    = above ? y - 18 : y + 18;
        const ty    = above ? y - 28 : y + 38;

        setTimeout(function() {
          const dot = el('circle', { cx: ex, cy: y, r: 5, fill: color, stroke: 'var(--surface-1,#13161b)', 'stroke-width': 2 });
          dot.style.opacity = '0';
          g.appendChild(dot);
          self._movePen(ex, y);
          self._raf(200, ease.outElastic, function(v) { dot.style.opacity = v; }, function() {});

          const lbl = el('text', { x: ex, y: ly, 'text-anchor': 'middle', 'font-size': 9, fill: color, 'font-family': 'var(--font-body,sans-serif)', 'font-weight': '600' });
          lbl.textContent = ev.label || ''; lbl.style.opacity = '0';
          g.appendChild(lbl);
          self._raf(300, ease.outCubic, function(v) { lbl.style.opacity = v; }, function() {});

          const txt = el('text', { x: ex, y: ty, 'text-anchor': 'middle', 'font-size': 8, fill: '#8899aa', 'font-family': 'var(--font-body,sans-serif)' });
          txt.textContent = ev.text || ''; txt.style.opacity = '0';
          g.appendChild(txt);
          self._raf(350, ease.outCubic, function(v) { txt.style.opacity = v; }, function() {
            if (++completed >= events.length) done();
          });
        }, i * (item.eventDelay !== undefined ? item.eventDelay : 250));
      });
    });
  }

  // ── BRANCH ────────────────────────────────────────────────────────────────

  _animBranch(item, done) {
    const cx      = item.cx !== undefined ? item.cx : this._vw / 2;
    const cy      = item.cy !== undefined ? item.cy : this._vh / 2;
    const color   = item.color || '#9b59b6';
    const branches= item.branches || [];
    const g       = el('g');
    this.svg.appendChild(g);

    const centerR = item.r !== undefined ? item.r : 28;
    const cCircle = el('circle', { cx, cy, r: centerR, fill: 'none', stroke: color, 'stroke-width': 2.5 });
    const cc = 2 * Math.PI * centerR;
    cCircle.setAttribute('stroke-dasharray',  cc);
    cCircle.setAttribute('stroke-dashoffset', cc);
    g.appendChild(cCircle);
    this._movePen(cx, cy - centerR);

    const self = this;
    this._raf(400, ease.outCubic, function(t) {
      cCircle.setAttribute('stroke-dashoffset', cc * (1 - t));
      const angle = -Math.PI / 2 + t * 2 * Math.PI;
      self._movePen(cx + Math.cos(angle) * centerR, cy + Math.sin(angle) * centerR);
    }, function() {
      cCircle.setAttribute('fill', item.fill || 'rgba(155,89,182,0.15)');
      const cLabel = el('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', 'font-size': 11, fill: color, 'font-family': 'var(--font-body,sans-serif)', 'font-weight': '600' });
      cLabel.style.opacity = '0'; cLabel.textContent = item.label || '';
      g.appendChild(cLabel);
      self._raf(300, ease.outCubic, function(v) { cLabel.style.opacity = v; }, function() {});

      let completed = 0;
      if (!branches.length) { done(); return; }
      const angleStep = (2 * Math.PI) / branches.length;

      branches.forEach(function(branch, i) {
        const angle  = -Math.PI / 2 + i * angleStep;
        const radius = item.radius !== undefined ? item.radius : 100;
        const bx     = cx + Math.cos(angle) * radius;
        const by     = cy + Math.sin(angle) * radius;
        const bColor = branch.color || color;
        const bR     = 20;

        setTimeout(function() {
          const lx1 = cx + Math.cos(angle) * (centerR + 4);
          const ly1 = cy + Math.sin(angle) * (centerR + 4);
          const line = el('line', { x1: lx1, y1: ly1, x2: bx, y2: by, stroke: bColor, 'stroke-width': 1.5, 'stroke-linecap': 'round' });
          const llen = Math.sqrt((bx - lx1) ** 2 + (by - ly1) ** 2);
          line.setAttribute('stroke-dasharray', llen); line.setAttribute('stroke-dashoffset', llen);
          g.appendChild(line);
          self._movePen(lx1, ly1);
          self._raf(350, ease.outCubic, function(t) {
            line.setAttribute('stroke-dashoffset', llen * (1 - t));
            self._movePen(lx1 + (bx - lx1) * t, ly1 + (by - ly1) * t);
          }, function() {});

          const bNode = el('circle', { cx: bx, cy: by, r: bR, fill: 'none', stroke: bColor, 'stroke-width': 2 });
          const bc = 2 * Math.PI * bR;
          bNode.setAttribute('stroke-dasharray', bc); bNode.setAttribute('stroke-dashoffset', bc);
          g.appendChild(bNode);
          self._raf(300, ease.outCubic, function(t) { bNode.setAttribute('stroke-dashoffset', bc * (1 - t)); }, function() { bNode.setAttribute('fill', 'rgba(' + hexToRgb(bColor) + ',0.12)'); });

          const bLabel = el('text', { x: bx, y: by + 4, 'text-anchor': 'middle', 'font-size': 9, fill: bColor, 'font-family': 'var(--font-body,sans-serif)', 'font-weight': '600' });
          bLabel.style.opacity = '0'; bLabel.textContent = branch.label || '';
          g.appendChild(bLabel);
          self._raf(300, ease.outCubic, function(v) { bLabel.style.opacity = v; }, function() { if (++completed >= branches.length) done(); });
        }, i * 200);
      });
    });
  }

  // ── CONTAINER ─────────────────────────────────────────────────────────────

  _animContainer(item, done) {
    const color = item.color || '#1abc9c';
    const rx = item.x !== undefined ? item.x : 40;
    const ry = item.y !== undefined ? item.y : 40;
    const rw = item.w !== undefined ? item.w : 360;
    const rh = item.h !== undefined ? item.h : 260;

    const rect = el('rect', { x: rx, y: ry, width: rw, height: rh, rx: item.rx !== undefined ? item.rx : 12, fill: 'none', stroke: color, 'stroke-width': item.strokeWidth || 1.5 });
    const perim = 2 * (rw + rh);
    rect.setAttribute('stroke-dasharray',  perim);
    rect.setAttribute('stroke-dashoffset', perim);
    this.svg.appendChild(rect);
    this._movePen(rx, ry);

    const self = this;
    this._raf(item.drawDuration !== undefined ? item.drawDuration : 800, ease.outCubic, function(t) {
      rect.setAttribute('stroke-dashoffset', perim * (1 - t));
      const dist = perim * t;
      let px = rx, py = ry;
      if      (dist < rw)          { px = rx + dist; }
      else if (dist < rw + rh)     { px = rx + rw; py = ry + (dist - rw); }
      else if (dist < 2*rw + rh)   { px = rx + rw - (dist - rw - rh); py = ry + rh; }
      else                          { px = rx; py = ry + rh - (dist - 2*rw - rh); }
      self._movePen(px, py);
    }, function() {
      rect.setAttribute('fill', item.fill || 'rgba(' + hexToRgb(color) + ',0.04)');
      rect.style.fillOpacity = '0';
      self._raf(item.fillDuration !== undefined ? item.fillDuration : 450, ease.outCubic, function(t) { rect.style.fillOpacity = t; }, function() {
        if (!item.label) { done(); return; }
        const lbl = el('text', { x: rx + 14, y: ry + 18, 'text-anchor': 'start', 'font-size': item.labelSize || 11, fill: color, 'font-family': 'var(--font-body,sans-serif)', 'font-weight': '600' });
        lbl.textContent = item.label; lbl.style.opacity = '0';
        self.svg.appendChild(lbl);
        self._raf(350, ease.outCubic, function(v) { lbl.style.opacity = v; }, done);
      });
    });
  }

  // ── PARTICLE_FLOW ─────────────────────────────────────────────────────────

  _animParticleFlow(item, done) {
    const count = item.count !== undefined ? item.count : 8;
    const color = item.color || '#3498db';
    const size  = item.size  !== undefined ? item.size : 4;
    const speed = item.speed !== undefined ? item.speed : 2000;
    const g     = el('g');
    this.svg.appendChild(g);

    g.appendChild(el('path', { d: item.d, fill: 'none', stroke: color, 'stroke-width': 1, 'stroke-linecap': 'round', opacity: 0.2 }));

    for (let i = 0; i < count; i++) {
      const dot   = el('circle', { r: size, fill: color });
      dot.style.opacity = '0.8';
      g.appendChild(dot);
      const animEl = document.createElementNS(NS, 'animateMotion');
      animEl.setAttribute('dur', speed + 'ms');
      animEl.setAttribute('repeatCount', 'indefinite');
      animEl.setAttribute('begin', (-(i / count) * speed) + 'ms');
      const flowId   = 'pf-' + Date.now() + '-' + i;
      const flowPath = el('path', { d: item.d, id: flowId });
      this.defs.appendChild(flowPath);
      const mpath = document.createElementNS(NS, 'mpath');
      mpath.setAttribute('href', '#' + flowId);
      mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + flowId);
      animEl.appendChild(mpath);
      dot.appendChild(animEl);
    }

    g.style.opacity = '0';
    this._raf(400, ease.outCubic, function(v) { g.style.opacity = v; }, done);
  }

  // ── RAF helper ─────────────────────────────────────────────────────────────

  _raf(duration, easeFn, onProgress, onComplete) {
    const start = performance.now();
    const self  = this;
    const tick  = function(now) {
      if (self._stopped) return;
      const t = Math.min(1, (now - start) / duration);
      onProgress(easeFn(t));
      if (t < 1) { self.rafId = requestAnimationFrame(tick); }
      else        { if (onComplete) onComplete(); }
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
