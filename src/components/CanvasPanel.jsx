
// @ts-nocheck
/**
 * src/components/CanvasPanel.jsx — Visual Canvas Engine
 *
 * A full-featured drawing canvas for visual learners, mounted as a
 * Preact island inside the workspace's "Canvas" tab.
 *
 * Features:
 *  • Tools: Pen, Highlighter, Eraser, Line, Arrow, Rectangle, Circle, Text
 *  • Color palette + custom color picker
 *  • Stroke width presets (thin / medium / thick / extra-thick)
 *  • Undo / Redo with up to 50 history snapshots
 *  • Clear canvas, Export PNG (download)
 *  • Background modes: plain, grid, dots, lined — perfect for students
 *  • Auto-saves per book/document to localStorage
 *  • Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y/Ctrl+Shift+Z redo, Escape → select pen
 *
 * Mount helper exported at the bottom, called from WorkspaceScreen.js.
 */

import { h, render } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_KEY_PREFIX  = 'chunks-canvas-v1-';
const MAX_HISTORY        = 50;

const TOOLS = ['pen', 'highlighter', 'eraser', 'line', 'arrow', 'rect', 'circle', 'text'];

const PALETTE = [
  '#ffffff', // white
  '#f87171', // red
  '#fb923c', // orange
  '#facc15', // yellow
  '#4ade80', // green
  '#34d399', // teal
  '#60a5fa', // blue
  '#a78bfa', // purple
  '#f472b6', // pink
  '#94a3b8', // slate
  '#1e293b', // dark
  '#e8ac2e', // gold (brand)
];

const SIZE_PRESETS = [
  { label: '1×', value: 2 },
  { label: '2×', value: 4 },
  { label: '4×', value: 8 },
  { label: '8×', value: 16 },
];

const BG_MODES = [
  { id: 'plain',  label: 'Plain' },
  { id: 'grid',   label: 'Grid' },
  { id: 'dots',   label: 'Dots' },
  { id: 'lined',  label: 'Lined' },
];

// SVG icons as JSX-compatible strings (rendered via dangerouslySetInnerHTML)
const TOOL_ICONS = {
  pen:         `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
  highlighter: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`,
  eraser:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>`,
  line:        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="19" x2="19" y2="5"/></svg>`,
  arrow:       `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></svg>`,
  rect:        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
  circle:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/></svg>`,
  text:        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
};

const TOOL_LABELS = {
  pen: 'Pen', highlighter: 'Highlighter', eraser: 'Eraser',
  line: 'Line', arrow: 'Arrow', rect: 'Rectangle', circle: 'Circle', text: 'Text',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function _storageKey() {
  const bookId = window.ws?.selectedBook?.id || window.ws?.currentBookId || 'default';
  return CANVAS_KEY_PREFIX + bookId;
}

function _loadSaved() {
  try {
    const raw = localStorage.getItem(_storageKey());
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function _save(dataUrl, bgMode) {
  try {
    localStorage.setItem(_storageKey(), JSON.stringify({ dataUrl, bgMode, ts: Date.now() }));
  } catch (_) { /* quota — ignore */ }
}

/** Draw the background pattern onto a canvas context. */
function _drawBg(ctx, w, h, mode, isDark) {
  ctx.clearRect(0, 0, w, h);
  const bg   = isDark ? '#1a1a2e' : '#fafafa';
  const line = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  if (mode === 'grid') {
    ctx.strokeStyle = line;
    ctx.lineWidth = 0.5;
    const step = 24;
    for (let x = step; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = step; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  } else if (mode === 'dots') {
    ctx.fillStyle = line;
    const step = 24;
    for (let x = step; x < w; x += step) {
      for (let y = step; y < h; y += step) {
        ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (mode === 'lined') {
    ctx.strokeStyle = line;
    ctx.lineWidth = 0.5;
    const step = 28;
    for (let y = step; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }
}

/** Draw an arrowhead at (x2,y2) pointing from (x1,y1). */
function _arrowHead(ctx, x1, y1, x2, y2, size) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const s = size * 3;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - s * Math.cos(angle - Math.PI / 7), y2 - s * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2 - s * Math.cos(angle + Math.PI / 7), y2 - s * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}

// ── CanvasPanel component ─────────────────────────────────────────────────────

function CanvasPanel() {
  const canvasRef    = useRef(null);
  const bgCanvasRef  = useRef(null); // background layer (grid/dots/lined)
  const overlayRef   = useRef(null); // ephemeral overlay while drawing shapes

  const [tool,   setTool]   = useState('pen');
  const [color,  setColor]  = useState('#ffffff');
  const [size,   setSize]   = useState(4);
  const [bgMode, setBgMode] = useState('plain');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Internal drawing state (refs — not reactive)
  const drawing    = useRef(false);
  const lastPt     = useRef({ x: 0, y: 0 });
  const shapeStart = useRef({ x: 0, y: 0 });
  const history    = useRef([]);  // ImageData[]
  const redoStack  = useRef([]);  // ImageData[]
  const isDark     = useRef(document.documentElement.classList.contains('dark') ||
                            window.matchMedia('(prefers-color-scheme: dark)').matches);

  // ── Canvas setup ──────────────────────────────────────────────────────────

  const _ctx  = () => canvasRef.current?.getContext('2d');
  const _bctx = () => bgCanvasRef.current?.getContext('2d');
  const _octx = () => overlayRef.current?.getContext('2d');

  function _resize() {
    const wrap = canvasRef.current?.parentElement;
    if (!wrap) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (!w || !h) return;

    // Save current drawing
    const ctx = _ctx();
    let saved = null;
    if (ctx && canvasRef.current.width && canvasRef.current.height) {
      saved = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    [canvasRef, bgCanvasRef, overlayRef].forEach(ref => {
      if (ref.current) { ref.current.width = w; ref.current.height = h; }
    });

    // Redraw bg
    const bctx = _bctx();
    if (bctx) _drawBg(bctx, w, h, bgMode, isDark.current);

    // Restore drawing
    if (saved && ctx) ctx.putImageData(saved, 0, 0);
  }

  function _initFromSave() {
    const saved = _loadSaved();
    if (!saved?.dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const ctx = _ctx();
      if (ctx) ctx.drawImage(img, 0, 0);
    };
    img.src = saved.dataUrl;
    if (saved.bgMode) setBgMode(saved.bgMode);
  }

  useEffect(() => {
    // Initial resize + load saved
    _resize();
    setTimeout(_initFromSave, 50);

    const ro = new ResizeObserver(_resize);
    const wrap = canvasRef.current?.parentElement;
    if (wrap) ro.observe(wrap);

    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw bg whenever bgMode changes
  useEffect(() => {
    const bctx = _bctx();
    const c = bgCanvasRef.current;
    if (bctx && c) _drawBg(bctx, c.width, c.height, bgMode, isDark.current);
    // Auto-save whenever bg changes too
    _autoSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgMode]);

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  function _pushHistory() {
    const ctx = _ctx();
    const c = canvasRef.current;
    if (!ctx || !c) return;
    history.current.push(ctx.getImageData(0, 0, c.width, c.height));
    if (history.current.length > MAX_HISTORY) history.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  function undo() {
    if (!history.current.length) return;
    const ctx = _ctx();
    const c = canvasRef.current;
    if (!ctx || !c) return;
    redoStack.current.push(ctx.getImageData(0, 0, c.width, c.height));
    ctx.putImageData(history.current.pop(), 0, 0);
    setCanUndo(history.current.length > 0);
    setCanRedo(true);
    _autoSave();
  }

  function redo() {
    if (!redoStack.current.length) return;
    const ctx = _ctx();
    const c = canvasRef.current;
    if (!ctx || !c) return;
    history.current.push(ctx.getImageData(0, 0, c.width, c.height));
    ctx.putImageData(redoStack.current.pop(), 0, 0);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    _autoSave();
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === 'Escape') setTool('pen');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save ─────────────────────────────────────────────────────────────

  const _autoSave = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    try {
      const dataUrl = c.toDataURL('image/png');
      _save(dataUrl, bgMode);
    } catch (_) { /* tainted canvas — ignore */ }
  }, [bgMode]);

  // ── Drawing helpers ───────────────────────────────────────────────────────

  function _getPos(e) {
    const c = canvasRef.current || overlayRef.current;
    const r = c.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }

  function _applyTool(ctx) {
    if (tool === 'highlighter') {
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = 'multiply';
    } else if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = tool === 'highlighter' ? size * 3 : size;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }

  // ── Pointer events ────────────────────────────────────────────────────────

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const pt = _getPos(e);

    if (tool === 'text') {
      _handleTextTool(pt);
      return;
    }

    drawing.current  = true;
    lastPt.current   = pt;
    shapeStart.current = pt;

    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
      _pushHistory();
      const ctx = _ctx();
      _applyTool(ctx);
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
    }
  }

  function onPointerMove(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const pt = _getPos(e);

    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
      const ctx = _ctx();
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      lastPt.current = pt;
    } else {
      // Live preview on overlay
      const oc = overlayRef.current;
      const octx = _octx();
      octx.clearRect(0, 0, oc.width, oc.height);
      _applyTool(octx);
      _drawShape(octx, shapeStart.current, pt);
    }
  }

  function onPointerUp(e) {
    if (!drawing.current) return;
    drawing.current = false;
    e.preventDefault();
    const pt = _getPos(e);

    if (tool !== 'pen' && tool !== 'highlighter' && tool !== 'eraser' && tool !== 'text') {
      // Commit overlay to main canvas
      _pushHistory();
      const ctx = _ctx();
      _applyTool(ctx);
      _drawShape(ctx, shapeStart.current, pt);
      // Clear overlay
      const oc = overlayRef.current;
      _octx().clearRect(0, 0, oc.width, oc.height);
    }

    _autoSave();
  }

  function _drawShape(ctx, start, end) {
    const { x: x1, y: y1 } = start;
    const { x: x2, y: y2 } = end;
    ctx.beginPath();
    switch (tool) {
      case 'line':
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        break;
      case 'arrow':
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        _arrowHead(ctx, x1, y1, x2, y2, size);
        break;
      case 'rect': {
        const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
        const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
        ctx.strokeRect(rx, ry, rw, rh);
        break;
      }
      case 'circle': {
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
        const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }
  }

  // ── Text tool ─────────────────────────────────────────────────────────────

  function _handleTextTool(pt) {
    const input = document.createElement('textarea');
    input.className = 'canvas-text-input';
    const wrap = canvasRef.current.parentElement;
    Object.assign(input.style, {
      position:   'absolute',
      left:       pt.x + 'px',
      top:        pt.y + 'px',
      minWidth:   '120px',
      maxWidth:   '320px',
      background: 'transparent',
      border:     '1.5px dashed ' + color,
      color:      color,
      fontSize:   (size * 4 + 8) + 'px',
      fontFamily: 'var(--font-body)',
      padding:    '4px 6px',
      outline:    'none',
      resize:     'none',
      zIndex:     10,
      lineHeight: '1.4',
      overflow:   'hidden',
    });
    wrap.appendChild(input);
    input.focus();

    function commit() {
      const val = input.value.trim();
      if (val) {
        _pushHistory();
        const ctx = _ctx();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = color;
        ctx.font = `${size * 4 + 8}px var(--font-body, sans-serif)`;
        val.split('\n').forEach((line, i) => {
          ctx.fillText(line, pt.x + 6, pt.y + 16 + i * (size * 4 + 12));
        });
        _autoSave();
      }
      input.remove();
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { input.remove(); }
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function clearCanvas() {
    _pushHistory();
    const ctx = _ctx();
    const c = canvasRef.current;
    ctx.clearRect(0, 0, c.width, c.height);
    _autoSave();
  }

  function exportPng() {
    // Composite: bg + drawing
    const c = canvasRef.current;
    const bg = bgCanvasRef.current;
    const out = document.createElement('canvas');
    out.width  = c.width;
    out.height = c.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(bg, 0, 0);
    ctx.drawImage(c, 0, 0);
    const link = document.createElement('a');
    link.download = `chunks-canvas-${Date.now()}.png`;
    link.href = out.toDataURL('image/png');
    link.click();
  }

  // ── Cursor ────────────────────────────────────────────────────────────────

  function _cursorFor(t) {
    if (t === 'eraser') return 'cell';
    if (t === 'text')   return 'text';
    return 'crosshair';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    h('div', { class: 'canvas-panel-root' },
      // ── Top toolbar ──────────────────────────────────────────────────────
      h('div', { class: 'canvas-toolbar' },

        // Tool groups
        h('div', { class: 'canvas-tool-group' },
          TOOLS.map(t =>
            h('button', {
              key:       t,
              class:     `canvas-tool-btn${tool === t ? ' active' : ''}`,
              title:     TOOL_LABELS[t],
              onClick:   () => setTool(t),
              dangerouslySetInnerHTML: { __html: TOOL_ICONS[t] },
            })
          )
        ),

        h('div', { class: 'canvas-toolbar-sep' }),

        // Color palette
        h('div', { class: 'canvas-tool-group canvas-colors' },
          PALETTE.map(c =>
            h('button', {
              key:     c,
              class:   `canvas-color-swatch${color === c ? ' active' : ''}`,
              title:   c,
              style:   `background:${c};`,
              onClick: () => setColor(c),
            })
          ),
          // Custom color picker
          h('label', { class: 'canvas-color-custom', title: 'Custom colour' },
            h('input', {
              type:     'color',
              value:    color,
              onInput:  e => setColor(e.target.value),
              style:    'opacity:0;position:absolute;width:0;height:0;',
            }),
            h('span', {
              class: `canvas-color-swatch canvas-color-picker${!PALETTE.includes(color) ? ' active' : ''}`,
              style: `background:${color};`,
            }, '＋')
          )
        ),

        h('div', { class: 'canvas-toolbar-sep' }),

        // Stroke size
        h('div', { class: 'canvas-tool-group' },
          SIZE_PRESETS.map(p =>
            h('button', {
              key:     p.value,
              class:   `canvas-size-btn${size === p.value ? ' active' : ''}`,
              title:   `${p.label} stroke`,
              onClick: () => setSize(p.value),
            }, p.label)
          )
        ),

        h('div', { class: 'canvas-toolbar-sep' }),

        // Background mode
        h('div', { class: 'canvas-tool-group' },
          BG_MODES.map(m =>
            h('button', {
              key:     m.id,
              class:   `canvas-bg-btn${bgMode === m.id ? ' active' : ''}`,
              title:   `${m.label} background`,
              onClick: () => setBgMode(m.id),
            }, m.label)
          )
        ),

        h('div', { class: 'canvas-toolbar-sep' }),

        // Undo / Redo / Clear / Export
        h('div', { class: 'canvas-tool-group canvas-actions' },
          h('button', {
            class: 'canvas-action-btn',
            title: 'Undo (Ctrl+Z)',
            disabled: !canUndo,
            onClick: undo,
            dangerouslySetInnerHTML: { __html: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>` },
          }),
          h('button', {
            class: 'canvas-action-btn',
            title: 'Redo (Ctrl+Y)',
            disabled: !canRedo,
            onClick: redo,
            dangerouslySetInnerHTML: { __html: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>` },
          }),
          h('button', {
            class: 'canvas-action-btn canvas-clear-btn',
            title: 'Clear canvas',
            onClick: clearCanvas,
            dangerouslySetInnerHTML: { __html: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>` },
          }),
          h('button', {
            class: 'canvas-action-btn canvas-export-btn',
            title: 'Export as PNG',
            onClick: exportPng,
            dangerouslySetInnerHTML: { __html: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>` },
          })
        )
      ),

      // ── Canvas area ───────────────────────────────────────────────────────
      h('div', { class: 'canvas-area' },
        // Background pattern layer (non-interactive)
        h('canvas', { ref: bgCanvasRef, class: 'canvas-bg-layer', 'aria-hidden': 'true' }),
        // Main drawing layer
        h('canvas', {
          ref:           canvasRef,
          class:         'canvas-draw-layer',
          style:         `cursor:${_cursorFor(tool)};`,
          onMouseDown:   onPointerDown,
          onMouseMove:   onPointerMove,
          onMouseUp:     onPointerUp,
          onMouseLeave:  onPointerUp,
          onTouchStart:  onPointerDown,
          onTouchMove:   onPointerMove,
          onTouchEnd:    onPointerUp,
        }),
        // Overlay for shape preview
        h('canvas', {
          ref:   overlayRef,
          class: 'canvas-overlay-layer',
          style: 'pointer-events:none;',
        })
      )
    )
  );
}

// ── Mount helper ──────────────────────────────────────────────────────────────

export function mountCanvasPanel(container) {
  if (!container) return;
  render(h(CanvasPanel, null), container);
}
