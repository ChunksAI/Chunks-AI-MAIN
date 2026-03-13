/**
 * src/utils/render.js — Rendering utilities
 *
 * Centralises every function that converts raw AI text → safe HTML.
 * All callers should import from here instead of relying on globals.
 *
 * Exports
 * ───────
 *  renderMath(tex, display)     KaTeX renderer with plain-text fallback
 *  sanitize(html)               DOMPurify wrapper with KaTeX/SVG allow-list
 *  homeMarkdown(text)           Home-chat markdown (math + tables + lists)
 *  wsRender(text)               Workspace renderer (+ page-jump chips)
 *  spExplainMarkdown(text)      Study-plan explain-drawer renderer
 *
 * Task 12 — extracted from monolith:
 *   _renderMath    → line 3496
 *   homeMarkdown   → line 3519
 *   _sanitizeCfg + sanitize + DOMPurify hook → lines 4313–4369
 *   wsRender       → line 4372
 *   _spExplainMarkdown → line 12874
 */

// ── Math renderer ──────────────────────────────────────────────────────────

/**
 * Render a TeX string using KaTeX (loaded via CDN).
 * Falls back to a human-readable plain-text form if KaTeX isn't available
 * or throws.
 *
 * @param {string}  tex     - Raw TeX source (without delimiters)
 * @param {boolean} display - true → display (block) mode, false → inline
 * @returns {string} HTML string
 */
export function renderMath(tex, display) {
  if (window.katex) {
    try {
      return window.katex.renderToString(tex, {
        displayMode:  display,
        throwOnError: false,
        trust:        false,
      });
    } catch (_) { /* fall through to plain-text */ }
  }
  // Readable plain-text fallback
  const clean = tex.trim()
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g,             '√($1)')
    .replace(/\\pm/g, '±').replace(/\\cdot/g, '·')
    .replace(/\{([^}]+)\}/g, '$1')
    .replace(/\\([a-zA-Z]+)/g, '$1');
  return display
    ? `<div class="ai-eq">${clean}</div>`
    : `<code style="color:var(--gold);background:var(--gold-muted);border:1px solid var(--gold-border);padding:1px 5px;border-radius:4px;font-size:0.92em;">${clean}</code>`;
}

// Keep legacy global for inline script blocks not yet migrated
window._renderMath = renderMath;

// ── DOMPurify sanitiser ────────────────────────────────────────────────────

/** DOMPurify allow-list — permits KaTeX SVG/MathML output and page-jump chips */
const _sanitizeCfg = {
  ALLOWED_TAGS: [
    'p','br','strong','em','b','i','u','s',
    'h1','h2','h3','h4','h5','h6',
    'ul','ol','li',
    'table','thead','tbody','tr','th','td',
    'pre','code','blockquote','hr',
    'span','div','a',
    // KaTeX renders into SVG + MathML
    'svg','path','line','rect','circle','ellipse','polygon','polyline',
    'defs','use','g','text','tspan','clipPath','mask','pattern',
    'linearGradient','radialGradient','stop','symbol','desc','title',
    'math','mrow','mi','mn','mo','mfrac','msup','msub','msubsup',
    'msqrt','mroot','mover','munder','munderover','mtable','mtr','mtd',
    'mtext','mspace','menclose','mstyle','merror','mpadded','mphantom',
    'semantics','annotation',
  ],
  ALLOWED_ATTR: [
    'class','style','id',
    // SVG / KaTeX attributes
    'viewBox','xmlns','width','height','fill','stroke','stroke-width',
    'stroke-linecap','stroke-linejoin','d','points','x','y','x1','y1',
    'x2','y2','cx','cy','r','rx','ry','transform','opacity',
    'stop-color','stop-opacity','gradientUnits','gradientTransform',
    'offset','clip-path','mask',
    // Table / link
    'colspan','rowspan','href','target','rel',
    // Page-jump chips added back via afterSanitizeAttributes hook below
  ],
  FORBID_ATTR: [
    'onerror','onload','onmouseover','onfocus','onblur',
    'onmouseenter','onmouseleave','onkeydown','onkeyup',
    'formaction','action','xlink:href',
  ],
  FORCE_BODY:       true,
  ALLOW_DATA_ATTR:  false,
};

// Re-allow onclick only on workspace page-jump chips we generated ourselves
// (identified by the data-ws-chip marker set by wsRender).
// Wrapped in DOMContentLoaded so the deferred DOMPurify CDN script has loaded.
document.addEventListener('DOMContentLoaded', () => {
  if (typeof DOMPurify === 'undefined') return;
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.hasAttribute('data-ws-chip')) {
      const page = parseInt(node.getAttribute('data-ws-chip'), 10);
      if (!isNaN(page)) node.setAttribute('onclick', `wsGoToPage(${page})`);
    }
  });
});

/**
 * Sanitise an HTML string using DOMPurify.
 * Passes through unchanged if DOMPurify hasn't loaded yet (CDN timing edge case).
 *
 * @param {string} html
 * @returns {string}
 */
export function sanitize(html) {
  if (typeof DOMPurify === 'undefined') return html;
  return DOMPurify.sanitize(html, _sanitizeCfg);
}

// Legacy global
window.sanitize = sanitize;

// ── Shared math-extraction helper ──────────────────────────────────────────

/**
 * Extract all math spans from a text string, replacing them with NUL
 * placeholder tokens so subsequent HTML escaping doesn't mangle backslashes.
 * Returns the mutated string and a `math` array for later restoration.
 *
 * @internal
 */
function _extractMath(text) {
  const math = [];
  let t = text;
  const push = (content, type) => { math.push({ type, content }); return `\x00M${math.length - 1}\x00`; };

  t = t.replace(/\\\[([\s\S]+?)\\\]/g,          (_, m) => push(m, 'display'));
  t = t.replace(/\\\(([^]*?)\\\)/g,             (_, m) => push(m, 'inline'));
  t = t.replace(/\$\$([\s\S]+?)\$\$/g,          (_, m) => push(m, 'display'));
  t = t.replace(/(?<!\w)\$([^$\n]+?)\$(?!\w)/g, (_, m) => push(m, 'inline'));
  return { t, math };
}

/** Restore math placeholders to rendered KaTeX/fallback HTML. @internal */
function _restoreMath(html, math) {
  return html.replace(/\x00M(\d+)\x00/g, (_, i) => {
    const m = math[+i];
    return renderMath(m.content, m.type === 'display');
  });
}

// ── homeMarkdown ───────────────────────────────────────────────────────────

/**
 * Convert AI response text to safe HTML for the home-screen chat.
 * Handles math, code blocks, headers, bold/italic, lists, tables, blockquotes.
 *
 * @param {string} text - Raw AI response
 * @returns {string}   Sanitised HTML
 */
export function homeMarkdown(text) {
  let { t, math } = _extractMath(text);

  // HTML escape
  t = t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Code blocks
  t = t.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) => `<pre><code>${c.trim()}</code></pre>`);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  t = t.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  t = t.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  t = t.replace(/^# (.+)$/gm,   '<h2>$1</h2>');

  // Bold / italic
  t = t.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  t = t.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g,         '<em>$1</em>');

  t = t.replace(/^---$/gm, '<hr>');
  t = t.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Collapse blank lines between consecutive list items
  t = t.replace(/(^(\d+)\. .+$)((\n\n+|\n)(^\d+\. .+$))+/gm, b => b.replace(/\n{2,}/g, '\n'));
  t = t.replace(/(^[-*] .+$)((\n\n+|\n)(^[-*] .+$))+/gm,    b => b.replace(/\n{2,}/g, '\n'));

  // Numbered lists
  t = t.replace(/((?:^\d+\. .+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });
  // Bullet lists
  t = t.replace(/((?:^[-*] .+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[-*] /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Tables
  t = _renderTable(t);

  // Paragraphs
  t = t.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (!block) return '';
    if (/^<(h[123]|ul|ol|pre|blockquote|hr|table)/.test(block)) return block;
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return _restoreMath(t, math);
}

// Legacy global
window.homeMarkdown = homeMarkdown;

// ── wsRender ───────────────────────────────────────────────────────────────

/**
 * Convert AI response text to safe HTML for the workspace chat.
 * Same as homeMarkdown but also converts "📖 Page N" references into
 * clickable page-jump chips (via data-ws-chip, restored by DOMPurify hook).
 *
 * @param {string} raw - Raw AI response
 * @returns {string}   Sanitised HTML
 */
export function wsRender(raw) {
  let { t: s, math } = _extractMath(raw);

  // HTML escape
  s = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Inline markdown + page-jump chips
  s = s
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>')
    .replace(/`([^`]+)`/g,         '<code>$1</code>')
    .replace(/📖 Page (\d+)/g,
      (_, pg) => `<span data-ws-chip="${pg}" style="cursor:pointer;color:var(--gold);font-family:var(--font-mono);font-size:11px;background:var(--gold-muted);border:1px solid var(--gold-border);padding:1px 6px;border-radius:4px;">📖 p.${pg}</span>`);

  // Tables
  s = _renderTable(s);

  // Block-level: collapse blank lines between consecutive list items
  const rawLines = s.split('\n');
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const cur  = rawLines[i].trim();
    const next = (rawLines[i + 1] || '').trim();
    if (!cur && (/^\d+\. /.test(next) || /^[-*•] /.test(next))) continue;
    lines.push(rawLines[i]);
  }

  let html = '', inUl = false, inOl = false;
  const closeList = () => {
    if (inUl) { html += '</ul>'; inUl = false; }
    if (inOl) { html += '</ol>'; inOl = false; }
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) { closeList(); continue; }

    if (/^#{1,3} /.test(t)) {
      closeList();
      const lvl = t.match(/^(#+)/)[1].length;
      const txt = t.replace(/^#+\s/, '');
      html += lvl === 1 ? `<p><strong style="font-size:1.1em">${txt}</strong></p>`
            : lvl === 2 ? `<p><strong>${txt}</strong></p>`
            :             `<p><em><strong>${txt}</strong></em></p>`;
      continue;
    }
    if (/^[-*•] /.test(t)) {
      if (inOl) { html += '</ol>'; inOl = false; }
      if (!inUl) { html += '<ul>'; inUl = true; }
      html += `<li>${t.replace(/^[-*•] /, '')}</li>`; continue;
    }
    if (/^\d+\. /.test(t)) {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (!inOl) { html += '<ol>'; inOl = true; }
      html += `<li>${t.replace(/^\d+\.\s+/, '')}</li>`; continue;
    }
    if (/^<(table|\/table|tr|th|td)/.test(t)) { closeList(); html += t; continue; }
    closeList();
    html += `<p>${t}</p>`;
  }
  closeList();

  html = _restoreMath(html, math);
  html = html.replace(/<p>\s*<\/p>/g, '');
  return sanitize(html);
}

// Legacy global
window.wsRender = wsRender;

// ── spExplainMarkdown ──────────────────────────────────────────────────────

/**
 * Tokenising markdown renderer for the study-plan explain drawer.
 * Produces tightly-styled headings (inline style, no global class deps)
 * and passes output through sanitize().
 *
 * @param {string} text - Raw AI response
 * @returns {string}   Sanitised HTML
 */
export function spExplainMarkdown(text) {
  let t = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function inlineFormat(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/`([^`]+)`/g,     '<code style="font-family:var(--font-mono);font-size:12px;background:var(--surface-3);padding:1px 5px;border-radius:4px;color:var(--teal);">$1</code>');
  }

  const lines  = t.split('\n');
  const tokens = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (/^[-*]{3,}$/.test(line)) { i++; continue; }           // dividers

    if (/^#{1,3} /.test(line)) {
      const level   = line.match(/^(#+)/)[1].length;
      const content = line.replace(/^#+\s+/, '');
      tokens.push({ type: 'heading', level, content });
      i++; continue;
    }

    if (/^[-•*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-•*] /.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-•*] /, ''));
        i++;
      }
      tokens.push({ type: 'ul', items }); continue;
    }

    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\. /, ''));
        i++;
      }
      tokens.push({ type: 'ol', items }); continue;
    }

    if (!line) { i++; continue; }

    const paraLines = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || /^#{1,3} /.test(l) || /^[-•*] /.test(l) || /^\d+\. /.test(l) || /^[-*]{3,}$/.test(l)) break;
      paraLines.push(l);
      i++;
    }
    if (paraLines.length) tokens.push({ type: 'p', content: paraLines.join(' ') });
  }

  const html = tokens.map(tok => {
    if (tok.type === 'heading') {
      const sizes = { 1: '16px', 2: '15px', 3: '14px' };
      const sz = sizes[tok.level] || '14px';
      return `<h4 style="font-family:var(--font-head);font-size:${sz};font-weight:700;color:var(--text-1);margin:20px 0 6px;letter-spacing:-0.01em;">${inlineFormat(tok.content)}</h4>`;
    }
    if (tok.type === 'ul') return '<ul>' + tok.items.map(l => `<li>${inlineFormat(l)}</li>`).join('') + '</ul>';
    if (tok.type === 'ol') return '<ol>' + tok.items.map(l => `<li>${inlineFormat(l)}</li>`).join('') + '</ol>';
    if (tok.type === 'p')  return `<p>${inlineFormat(tok.content)}</p>`;
    return '';
  }).join('');

  return sanitize(html);
}

// Legacy global
window._spExplainMarkdown = spExplainMarkdown;

// ── Internal table renderer (shared) ──────────────────────────────────────

/** @internal — converts markdown table syntax to HTML <table> */
function _renderTable(s) {
  return s.replace(/((?:^\|.+\|[ \t]*\n)+)/gm, tb => {
    const rows = tb.trim().split('\n').filter(r => r.trim());
    let out = '<table>';
    let hdr = true;
    for (const row of rows) {
      if (/^\|[-:\s|]+\|$/.test(row.trim())) { hdr = false; continue; }
      const cells = row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
      const tag   = hdr ? 'th' : 'td';
      out += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
      if (hdr) hdr = false;
    }
    return out + '</table>';
  });
}
