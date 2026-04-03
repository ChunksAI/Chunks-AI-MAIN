
// @ts-nocheck
/**
 * src/state/workspace/attachments.js — Attachment system (workspace + home)
 */

import { ws } from './state.js';
import { wsChatSend, _wsAsk, wsAutoResize, wsScrollBottom, wsStopGeneration } from './chat.js';
import { $el, $qsa, removeClass, addClass } from '../domHelpers.js';
import { showToast } from '../../components/Toast.js';

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

// ── File validation ───────────────────────────────────────────────────────

const _MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const _MAX_PDF_BYTES   = 50 * 1024 * 1024; // 50 MB
const _ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const _ALLOWED_PDF_TYPES   = ['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

/**
 * Validate an attachment file before reading it.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
function _validateFile(file, type) {
  if (!file) return { ok: false, reason: 'No file selected.' };
  const allowed = type === 'image' ? _ALLOWED_IMAGE_TYPES : _ALLOWED_PDF_TYPES;
  if (!allowed.includes(file.type)) {
    return {
      ok: false,
      reason: type === 'image'
        ? 'Unsupported image format. Please upload a JPEG, PNG, GIF, or WebP file.'
        : 'Unsupported file type. Please upload a PDF, TXT, MD, or DOCX file.',
    };
  }
  const maxBytes = type === 'image' ? _MAX_IMAGE_BYTES : _MAX_PDF_BYTES;
  if (file.size > maxBytes) {
    const maxMB = maxBytes / (1024 * 1024);
    return { ok: false, reason: `File is too large. Maximum size is ${maxMB} MB.` };
  }
  return { ok: true };
}

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
  const check = _validateFile(file, type);
  if (!check.ok) { showToast('⚠', check.reason, 'var(--red)'); return; }
  try {
    const dataUrl = await _readFile(file);
    ws.attachments.push({ type, file, dataUrl, name: file.name });
    _wsRenderPreview();
  } catch (e) {
    showToast('⚠', 'Could not read file. Please try again.', 'var(--red)');
  }
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
  if (ws.typing) { wsStopGeneration(); return; }
  const inp = $el('ws-chat-input');
  const question = inp.value.trim();
  if (!question && !ws.attachments.length) return;
  inp.placeholder = 'Ask a follow-up about Chapter 3…';

  const selQuote = ws.selectedText
    ? `<div style="margin-bottom:7px;padding:7px 10px;border-left:2px solid var(--gold);background:var(--gold-muted);border-radius:0 6px 6px 0;font-size:11px;color:var(--text-3);line-height:1.5;font-style:italic;">"${ws.selectedText.slice(0,160).replace(/&/g,'&amp;').replace(/</g,'&lt;')}${ws.selectedText.length>160?'…':''}"</div>`
    : '';

  const textHtml = question ? question.replace(/&/g,'&amp;').replace(/</g,'&lt;') : '';
  let attachHtml = '';
  if (ws.attachments.length) {
    attachHtml = ws.attachments.map(a =>
      a.type === 'image'
        ? `<div class="chat-img-wrap" onclick="openImgLightbox(this)"><img src="${a.dataUrl}" alt="${a.name.replace(/"/g,'&quot;')}"></div>`
        : `<div style="display:inline-flex;align-items:center;gap:6px;background:var(--surface-3);border:1px solid var(--border-md);border-radius:8px;padding:6px 10px;font-size:12px;margin-top:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>${a.name}</div>`
    ).join('');
  }

  const msgs = $el('ws-messages');
  // Remove the welcome state when the first real message is appended (mirrors wsAppendUser)
  const welcome = document.getElementById('ws-welcome-state');
  if (welcome) welcome.remove();
  // Attachments bubble first (separate bubble), then text bubble below — matches Claude.ai / ChatGPT layout
  let firstBubble = null;
  if (attachHtml) {
    const attachBubble = document.createElement('div');
    attachBubble.className = 'msg msg-user';
    attachBubble.innerHTML = `<div class="bubble-user">${attachHtml}</div>`;
    msgs.appendChild(attachBubble);
    firstBubble = attachBubble;
  }
  if (textHtml || selQuote) {
    const d = document.createElement('div');
    d.className = 'msg msg-user';
    d.innerHTML = `<div class="bubble-user">${selQuote}${textHtml}</div>`;
    msgs.appendChild(d);
    if (!firstBubble) firstBubble = d;
  }
  if (firstBubble) {
    wsScrollBottom();
  }

  // Extract image for vision API; only append text metadata for non-image files
  const imageAtt = ws.attachments.find(a => a.type === 'image') || null;
  let fullQuestion = question;
  const textAtts = ws.attachments.filter(a => a.type !== 'image');
  if (textAtts.length) {
    fullQuestion += `\n[Attached: ${textAtts.map(a => `"${a.name}" (${a.type})`).join(', ')}]`;
  }

  inp.value = ''; wsAutoResize(inp); inp.focus();
  ws.chatHistory.push({
    role: 'user',
    content: fullQuestion,
    ...(imageAtt ? { imageDataUrl: imageAtt.dataUrl } : {}),
  });
  ws.attachments = []; _wsRenderPreview();
  await _wsAsk(fullQuestion, imageAtt ? { dataUrl: imageAtt.dataUrl, mimeType: imageAtt.file.type } : null);
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
  const check = _validateFile(file, type);
  if (!check.ok) { showToast('⚠', check.reason, 'var(--red)'); return; }
  try {
    const dataUrl = await _readFile(file);
    ws.homeAttachments.push({ type, file, dataUrl, name: file.name });
    _homeRenderPreview();
    if (type === 'pdf') {
      const name = file.name.replace(/\.pdf$/i, '');
      _uploadedPdfFile = file; _uploadedPdfName = name;
      if (typeof homeSetInput === 'function') homeSetInput(`Summarize "${name}" for me`);
    }
  } catch (e) {
    showToast('⚠', 'Could not read file. Please try again.', 'var(--red)');
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

// ── Image lightbox ────────────────────────────────────────────────────────

let _lightboxEl  = null;
let _lightboxKey = null;

export function openImgLightbox(wrapEl) {
  const img = wrapEl instanceof HTMLElement ? wrapEl.querySelector('img') : null;
  if (!img) return;
  closeImgLightbox(); // clean up any existing lightbox + listener

  const overlay = document.createElement('div');
  overlay.className = 'img-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const full = document.createElement('img');
  full.src = img.src;
  full.alt = img.alt || '';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'img-lightbox-close';
  closeBtn.setAttribute('aria-label', 'Close image preview');
  closeBtn.innerHTML = '✕';
  closeBtn.onclick = e => { e.stopPropagation(); closeImgLightbox(); };

  overlay.appendChild(full);
  overlay.appendChild(closeBtn);
  overlay.onclick = () => closeImgLightbox();

  document.body.appendChild(overlay);
  _lightboxEl = overlay;

  _lightboxKey = e => { if (e.key === 'Escape') closeImgLightbox(); };
  document.addEventListener('keydown', _lightboxKey);
}

export function closeImgLightbox() {
  if (_lightboxKey) { document.removeEventListener('keydown', _lightboxKey); _lightboxKey = null; }
  if (_lightboxEl)  { _lightboxEl.remove(); _lightboxEl = null; }
}

// Expose to inline onclick handlers
window.openImgLightbox  = openImgLightbox;
window.closeImgLightbox = closeImgLightbox;

// ── Paste-image support ───────────────────────────────────────────────────

/**
 * Intercept paste events on workspace and home chat inputs.
 * When the clipboard contains an image, add it to the relevant attachments
 * array and render the preview strip — exactly like choosing a file.
 */
document.addEventListener('paste', async e => {
  const items = e.clipboardData?.items;
  if (!items) return;

  let imageItem = null;
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) { imageItem = item; break; }
  }
  if (!imageItem) return;

  const target = e.target;
  const wsInput    = document.getElementById('ws-chat-input');
  const homeInput  = document.getElementById('home-ask-input');
  const homeInputB = document.getElementById('home-ask-input-bottom');

  const isWsTarget   = target === wsInput;
  const isHomeTarget = target === homeInput || target === homeInputB;
  if (!isWsTarget && !isHomeTarget) return;

  e.preventDefault(); // don't paste the image as text

  const file = imageItem.getAsFile();
  if (!file) return;

  const check = _validateFile(file, 'image');
  if (!check.ok) { showToast('⚠', check.reason, 'var(--red)'); return; }

  try {
    const dataUrl = await _readFile(file);
    const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const att = { type: 'image', file, dataUrl, name: file.name || `pasted-image.${ext}` };
    if (isWsTarget) {
      ws.attachments.push(att);
      _wsRenderPreview();
    } else {
      ws.homeAttachments.push(att);
      _homeRenderPreview();
    }
    showToast('🖼', 'Image pasted — press Send to analyze', 'var(--teal)');
  } catch (_) {
    showToast('⚠', 'Could not read pasted image.', 'var(--red)');
  }
});
