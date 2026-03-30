// @ts-nocheck
/**
 * src/state/workspace/attachments.js — Attachment system (workspace + home)
 */

import { ws } from './state.js';
import { wsChatSend, _wsAsk, wsAutoResize, wsScrollBottom } from './chat.js';
import { $el, $qsa, removeClass, addClass } from '../domHelpers.js';
import { escapeHtml } from '../../lib/escapeHtml.js';

export let _uploadedPdfFile = null;
export let _uploadedPdfName = null;

// ── Close all attachment menus ────────────────────────────────────────────

export function _closeAllAttachMenus() {
  $qsa('.attach-menu').forEach(m => removeClass(m, 'open'));
  $qsa('.think-menu').forEach(m => removeClass(m, 'open'));
}
document.addEventListener('click', e => {
  if (!e.target.closest('.chat-plus-wrap') && !e.target.closest('.ask-plus-wrap') && !e.target.closest('.chat-think-wrap')) _closeAllAttachMenus();
});

// ── Shared helpers ────────────────────────────────────────────────────────

export function _buildThumb(att, removeFn) {
  const wrap = document.createElement('div');
  wrap.className = 'attach-thumb';
  if (att.type === 'image') {
    const img = document.createElement('img');
    img.src = att.dataUrl; img.alt = att.name;
    wrap.appendChild(img);
  } else {
    const label = document.createElement('div');
    label.className = 'attach-thumb-pdf';
    label.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${att.name.slice(0,8)}</span>`;
    wrap.appendChild(label);
  }
  const rm = document.createElement('button');
  rm.className = 'attach-remove'; rm.innerHTML = '✕';
  rm.onclick = removeFn;
  wrap.appendChild(rm);
  return wrap;
}

export function _readFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ── Workspace attachments ─────────────────────────────────────────────────

export function wsToggleAttachMenu(e) {
  e.stopPropagation();
  const menu = $el('ws-attach-menu');
  const isOpen = menu.classList.contains('open');
  _closeAllAttachMenus();
  if (!isOpen) addClass(menu, 'open');
}
export function wsAttachTrigger(type) {
  _closeAllAttachMenus();
  $el(type === 'image' ? 'ws-attach-image' : 'ws-attach-pdf').click();
}
export async function wsHandleAttach(input, type) {
  const file = input.files[0]; if (!file) return;
  input.value = '';
  const dataUrl = await _readFile(file);
  ws.attachments.push({ type, file, dataUrl, name: file.name });
  _wsRenderPreview();
}
export function _wsRenderPreview() {
  const strip = $el('ws-attach-preview');
  strip.innerHTML = '';
  strip.style.display = ws.attachments.length ? 'flex' : 'none';
  ws.attachments.forEach((att, i) => {
    strip.appendChild(_buildThumb(att, () => { ws.attachments.splice(i, 1); _wsRenderPreview(); }));
  });
}

// Patch wsChatSend to include attachments
const _origWsChatSend = wsChatSend;
window.wsChatSend = async function() {
  if (ws.typing) return;
  const inp = $el('ws-chat-input');
  const question = inp.value.trim();
  if (!question && !ws.attachments.length) return;
  inp.placeholder = 'Ask a follow-up about Chapter 3…';

  const selQuote = ws.selectedText
    ? `<div style="margin-bottom:7px;padding:7px 10px;border-left:2px solid var(--gold);background:var(--gold-muted);border-radius:0 6px 6px 0;font-size:11px;color:var(--text-3);line-height:1.5;font-style:italic;">"${escapeHtml(ws.selectedText.slice(0,160))}${ws.selectedText.length>160?'…':''}"</div>`
    : '';

  let bubbleHtml = question ? escapeHtml(question) : '';
  if (ws.attachments.length) {
    bubbleHtml += ws.attachments.map(a =>
      a.type === 'image'
        ? `<img src="${a.dataUrl}" style="max-width:180px;max-height:140px;border-radius:8px;display:block;margin-top:6px;">`
        : `<div style="display:inline-flex;align-items:center;gap:6px;background:var(--surface-3);border:1px solid var(--border-md);border-radius:8px;padding:6px 10px;font-size:12px;margin-top:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>${a.name}</div>`
    ).join('');
  }

  const msgs = $el('ws-messages');
  const d = document.createElement('div');
  d.className = 'msg msg-user';
  d.innerHTML = `<div class="bubble-user">${selQuote}${bubbleHtml}</div>`;
  msgs.appendChild(d); wsScrollBottom();

  let fullQuestion = question;
  if (ws.attachments.length) {
    fullQuestion += `\n[Attached: ${ws.attachments.map(a => `"${a.name}" (${a.type})`).join(', ')}]`;
  }

  inp.value = ''; wsAutoResize(inp); inp.focus();
  ws.chatHistory.push({ role: 'user', content: fullQuestion });
  ws.attachments = []; _wsRenderPreview();
  await _wsAsk(fullQuestion);
};

// ── Home attachments ──────────────────────────────────────────────────────

export function homeToggleAttachMenu(e, slot) {
  e.stopPropagation();
  const id = slot === 'bottom' ? 'home-attach-menu-bottom' : 'home-attach-menu';
  const menu = $el(id);
  const isOpen = menu.classList.contains('open');
  _closeAllAttachMenus();
  if (!isOpen) addClass(menu, 'open');
}
export function homeAttachTrigger(type, slot) {
  _closeAllAttachMenus();
  const id = type === 'image'
    ? `home-attach-image${slot === 'bottom' ? '-bottom' : ''}`
    : `home-attach-pdf${slot === 'bottom' ? '-bottom' : '-new'}`;
  $el(id)?.click();
}
export async function homeHandleAttach(input, type, slot) {
  const file = input.files[0]; if (!file) return;
  input.value = '';
  const dataUrl = await _readFile(file);
  ws.homeAttachments.push({ type, file, dataUrl, name: file.name });
  _homeRenderPreview();
  if (type === 'pdf') {
    const name = file.name.replace(/\.pdf$/i, '');
    _uploadedPdfFile = file; _uploadedPdfName = name;
    if (typeof homeSetInput === 'function') homeSetInput(`Summarize "${name}" for me`);
  }
}
export function _homeRenderPreview() {
  ['home-attach-preview', 'home-attach-preview-bottom'].forEach(id => {
    const strip = $el(id); if (!strip) return;
    strip.innerHTML = '';
    strip.style.display = ws.homeAttachments.length ? 'flex' : 'none';
    ws.homeAttachments.forEach((att, i) => {
      strip.appendChild(_buildThumb(att, () => { ws.homeAttachments.splice(i, 1); _homeRenderPreview(); }));
    });
  });
}
