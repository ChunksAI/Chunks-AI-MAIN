/**
 * src/state/flash/generation.js — Card generation + PDF upload
 */

import { $el, createElement } from '../domHelpers.js';
import { _fcSetGenBusy, _fcShowError } from './helpers.js';
import { _fcRenderDeckList } from './decks.js';
import { _fcStartDeck } from './session.js';
import { showToast } from '../../components/Toast.js';
import { API_BASE, _getAuthHeader } from '../../lib/api.js';
import { FlashcardDB } from '../../lib/flashcardDb.js';
import { _getStudyMode } from '../../components/SettingsModal.js';

// ── PDF upload → flashcard deck ─────────────────────────────────────────────

export function _fcOpenPdfUpload() {
  const input = createElement('input');
  input.type   = 'file';
  input.accept = '.pdf,.pptx,.docx';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) _fcProcessUploadedFile(file);
  };
  input.click();
}

export async function _fcProcessUploadedFile(file) {
  const topicName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

  _fcSetGenBusy(true, topicName);
  _fcShowError('');

  try {
    showToast?.('⏳', `Extracting text from ${file.name}…`, 'var(--text-3)');

    const formData = new FormData();
    formData.append('file', file);

    const uploadRes = await fetch(`${API_BASE}/upload-document`, {
      method: 'POST',
      headers: { ...await _getAuthHeader?.() ?? {} },
      body:   formData,
    });
    const uploadData = await uploadRes.json();

    if (!uploadRes.ok || !uploadData.success) {
      throw new Error(uploadData.error || 'Failed to extract text from file');
    }

    const slides = uploadData.slides || [];
    if (!slides.length) throw new Error('No readable content found in file');

    showToast?.('⚡', 'Generating flashcards from your file…', 'var(--gold)');

    const matRes = await fetch(`${API_BASE}/generate-study-materials`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} },
      body:    JSON.stringify({ slides, type: 'flashcards' }),
    });
    const matData = await matRes.json();

    if (!matRes.ok || !matData.success) {
      throw new Error(matData.error || 'Failed to generate flashcards');
    }

    const rawText = matData.materials?.flashcards || '';
    const cards   = _fcParseUploadedCards(rawText);

    if (!cards.length) throw new Error('Could not parse flashcards from file');

    const deck = await FlashcardDB.fcSaveDeck(topicName, cards);
    _fcSetGenBusy(false);

    showToast?.('✦', `${cards.length} cards created from "${file.name}"`, 'var(--gold)');
    await _fcRenderDeckList();
    _fcStartDeck(deck);

  } catch (err) {
    _fcSetGenBusy(false);
    _fcShowError(err.message || 'Upload failed. Please try again.');
    console.error('[flashState] upload error:', err);
  }
}

export function _fcParseUploadedCards(rawText) {
  const cards = [];
  const blocks = rawText.split(/CARD\s+\d+/i).filter(b => b.trim());
  for (const block of blocks) {
    const qMatch = block.match(/Q:\s*(.+?)(?=A:|$)/si);
    const aMatch = block.match(/A:\s*(.+?)(?=CARD|$)/si);
    if (qMatch && aMatch) {
      const front = qMatch[1].trim();
      const back  = aMatch[1].trim();
      if (front && back) cards.push({ front, back });
    }
  }
  if (!cards.length) {
    const frontBackBlocks = rawText.split(/CARD\b/i).filter(b => b.trim());
    for (const block of frontBackBlocks) {
      const fMatch = block.match(/FRONT:\s*(.+?)(?=BACK:|$)/si);
      const bMatch = block.match(/BACK:\s*(.+?)(?=END|CARD|$)/si);
      if (fMatch && bMatch) {
        const front = fMatch[1].trim();
        const back  = bMatch[1].trim().replace(/\s*END\s*$/i, '').trim();
        if (front && back) cards.push({ front, back });
      }
    }
  }
  return cards.slice(0, 50);
}

// ── Settings helpers ────────────────────────────────────────────────────────

export function _aiParams(base) {
  const m = (typeof _getStudyMode === 'function' ? _getStudyMode() : null)
            || localStorage.getItem('chunks_study_mode') || 'balanced';
  const complexity = m === 'concise' ? Math.max(2, base - 2)
                   : m === 'detailed' ? Math.min(9, base + 2)
                   : base;
  const language    = localStorage.getItem('chunks_setting_language') || 'Auto-detect';
  const safeContent = localStorage.getItem('chunks_setting_safe-content') === '1';
  return { complexity, language, safe_content: safeContent };
}

// ── Generate from bar ───────────────────────────────────────────────────────

export async function _fcGenerateFromBar() {
  const topicEl = $el('fc-topic-input');
  const countEl = $el('fc-count-input');
  if (!topicEl) return;

  const topic = topicEl.value.trim();
  const count = parseInt(countEl?.value || '10', 10);

  if (!topic) {
    _fcShowError('Please enter a topic first.');
    topicEl.focus();
    return;
  }

  _fcShowError('');
  _fcSetGenBusy(true, topic);

  try {
    const res  = await fetch(`${API_BASE}/generate-flashcards`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...await _getAuthHeader?.() ?? {} },
      body:    JSON.stringify({ topic, count }),
    });
    const data = await res.json();

    if (!res.ok || !data.success || !data.flashcards?.length) {
      throw new Error(data.error || 'No flashcards returned');
    }

    const cards = data.flashcards.map(c => ({
      front: c.front || c.question || '',
      back:  c.back  || c.answer   || '',
    }));

    const deck = await FlashcardDB.fcSaveDeck(topic, cards);

    topicEl.value = '';
    _fcSetGenBusy(false);
    showToast?.('✦', `${cards.length} cards created — "${topic}"`, 'var(--gold)');

    await _fcRenderDeckList();
    _fcStartDeck(deck);

  } catch (err) {
    _fcSetGenBusy(false);
    _fcShowError(err.message || 'Generation failed. Please try again.');
    console.error('[flashState] generate error:', err);
  }
}
