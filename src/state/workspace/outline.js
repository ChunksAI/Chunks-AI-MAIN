/**
 * src/state/workspace/outline.js — Outline / TOC panel
 */

import { ws, _wsBookOutlines } from './state.js';
import { wsGoToPage } from './pdf.js';
import { $el, setHtml } from '../domHelpers.js';

// ── Outline panel ─────────────────────────────────────────────────────────

export function togglePdfOutline() {
  const panel = $el('ws-outline-panel');
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

export async function _wsBuildOutline(pdfDoc, bookId) {
  const container = $el('ws-outline-items');
  container.innerHTML = '';
  ws.outlineFlat = [];
  let items = [];

  try {
    const outline = await pdfDoc.getOutline();
    if (outline && outline.length > 0) {
      const flatten = async (nodes, level) => {
        for (const node of nodes) {
          let page = null;
          try {
            if (node.dest) {
              const dest = typeof node.dest === 'string' ? await pdfDoc.getDestination(node.dest) : node.dest;
              if (dest) page = await pdfDoc.getPageIndex(dest[0]) + 1;
            }
          } catch (_) {}
          items.push({ title: node.title, page: page || 1, level });
          if (node.items && node.items.length && level < 1) await flatten(node.items, level + 1);
        }
      };
      await flatten(outline, 0);
    }
  } catch (e) { console.warn('TOC extraction failed:', e); }

  if (!items.length) items = _wsBookOutlines[bookId] || [];
  if (!items.length) {
    setHtml(container, '<div style="padding:8px 14px;font-size:11px;color:var(--text-4);">No contents available</div>');
    return;
  }

  items.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = 'outline-item' + (item.level > 0 ? ' sub' : '');
    el.innerHTML = `<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.title}</span><span class="outline-pg">${item.page}</span>`;
    el.dataset.page = item.page;
    el.addEventListener('click', () => { wsGoToPage(item.page); _wsSetActiveOutlineItem(idx); });
    container.appendChild(el);
    ws.outlineFlat.push({ ...item, el });
  });

  _wsUpdateOutlineActive(1);
}

export function _wsSetActiveOutlineItem(idx) {
  ws.outlineFlat.forEach((item, i) => item.el.classList.toggle('active', i === idx));
  ws.outlineFlat[idx]?.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export function _wsUpdateOutlineActive(currentPage) {
  if (!ws.outlineFlat.length) return;
  let activeIdx = 0;
  for (let i = 0; i < ws.outlineFlat.length; i++) {
    if (ws.outlineFlat[i].page <= currentPage) activeIdx = i;
    else break;
  }
  _wsSetActiveOutlineItem(activeIdx);
}
