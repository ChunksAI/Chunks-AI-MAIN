/**
 * src/state/studyplan/input.js — Tab switching, PDF upload, validation
 */

import { sp } from './state.js';
import { $el, hide, show, setText, setHtml } from '../domHelpers.js';

export function spSwitchTab(tab) {
  sp.activeTab = tab;
  ['upload','topic','notes'].forEach(t => {
    const tabEl = $el('sp-tab-'+t);
    const srcEl = $el('sp-src-'+t);
    if (tabEl) tabEl.classList.toggle('active', t === tab);
    if (srcEl) srcEl.style.display = t === tab ? '' : 'none';
  });
  spHideValidationError();
}

export function spSetDepth(d) {
  sp.activeDepth = d;
  ['intro','mid','adv','exam'].forEach(v => {
    const btn = $el('sp-depth-'+v);
    if (btn) btn.classList.toggle('active-chip', v === d);
  });
}

export function spUpdateNotesCount() {
  const len = ($el('sp-notes-input').value || '').length;
  setText($el('sp-notes-count'), len.toLocaleString() + ' chars');
}

export function spShowValidationError(msg) {
  const el = $el('sp-validation-error');
  setText($el('sp-validation-msg'), msg);
  el.style.display = 'flex';
  el.classList.remove('sp-shake');
  void el.offsetWidth;
  el.classList.add('sp-shake');
}

export function spHideValidationError() {
  hide($el('sp-validation-error'));
}

export function spValidateInputs() {
  if (sp.activeTab === 'upload') {
    if (!sp.pdfText) { spShowValidationError('Please upload a PDF file first.'); return false; }
  } else if (sp.activeTab === 'topic') {
    const val = ($el('sp-topic-input').value || '').trim();
    if (!val) { spShowValidationError('Please enter a topic or subject.'); $el('sp-topic-input').focus(); return false; }
  } else if (sp.activeTab === 'notes') {
    const val = ($el('sp-notes-input').value || '').trim();
    if (val.length < 50) { spShowValidationError('Please paste at least 50 characters of notes.'); $el('sp-notes-input').focus(); return false; }
  }
  spHideValidationError();
  return true;
}

// ── PDF upload + extraction ────────────────────────────────────────────────

export function spDragOver(e) {
  e.preventDefault();
  $el('sp-upload-idle').style.borderColor = 'var(--gold)';
  $el('sp-upload-idle').style.background  = 'var(--gold-muted)';
}
export function spDragLeave(_e) {
  $el('sp-upload-idle').style.borderColor = '';
  $el('sp-upload-idle').style.background  = '';
}
export function spDrop(e) {
  e.preventDefault();
  spDragLeave(e);
  const file = e.dataTransfer.files[0];
  if (file) spHandleFileSelect(file);
}

export function spClearUpload() {
  sp.pdfText = ''; sp.pdfFileName = ''; sp.pdfPageCount = 0;
  $el('sp-file-input').value = '';
  show($el('sp-upload-idle'));
  hide($el('sp-upload-attached'));
  hide($el('sp-extract-status'));
  hide($el('sp-extract-done'));
  spHideValidationError();
}

export async function spHandleFileSelect(file) {
  if (!file) return;
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) { spShowValidationError('Only PDF files are supported right now.'); return; }
  if (file.size > 30 * 1024 * 1024) { spShowValidationError('File is too large. Please use a PDF under 30 MB.'); return; }

  sp.pdfFileName = file.name;
  sp.pdfText     = '';

  hide($el('sp-upload-idle'));
  show($el('sp-upload-attached'));
  setText($el('sp-file-name'), file.name);
  setText($el('sp-file-pages'), '');
  hide($el('sp-extract-done'));
  $el('sp-extract-status').style.display = 'flex';
  setText($el('sp-extract-msg'), 'Reading PDF…');
  spHideValidationError();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const _pdfjs = await (typeof _loadPdfJs === 'function' ? _loadPdfJs() : Promise.reject(new Error('PDF.js not loaded')));
    const pdf = await _pdfjs.getDocument({ data: arrayBuffer }).promise;
    sp.pdfPageCount = pdf.numPages;
    setText($el('sp-file-pages'), `${sp.pdfPageCount} pages`);
    setText($el('sp-extract-msg'), `Extracting text (0 / ${sp.pdfPageCount} pages)…`);

    const pageTexts = [];
    for (let i = 1; i <= sp.pdfPageCount; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map(item => item.str).join(' '));
      setText($el('sp-extract-msg'), `Extracting text (${i} / ${sp.pdfPageCount} pages)…`);
    }

    sp.pdfText = pageTexts.join('\n\n').replace(/\s{3,}/g, ' ').trim();
    if (sp.pdfText.length > 40000) sp.pdfText = sp.pdfText.slice(0, 40000) + '…';

    hide($el('sp-extract-status'));
    $el('sp-extract-done').style.display = 'flex';
    setText($el('sp-extract-chars'), sp.pdfText.length.toLocaleString());
  } catch (err) {
    console.error('PDF extraction error:', err);
    hide($el('sp-extract-status'));
    spShowValidationError('Could not read this PDF: ' + (err?.message || String(err)) + '. Try a different file.');
    spClearUpload();
  }
}
