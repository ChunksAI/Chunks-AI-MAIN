// @ts-nocheck
/**
 * src/state/workspace/voice.js — Voice input (STT) and read-aloud (TTS)
 *
 * Uses only built-in browser Web Speech APIs — no API key required.
 *
 * Speech-to-text  : SpeechRecognition API  (Chrome, Edge, Safari 17+)
 * Text-to-speech  : SpeechSynthesis API    (all modern browsers)
 *
 * Public API:
 *   wsToggleVoiceInput()            — start/stop microphone recording
 *   wsReadAloud(text, msgId)        — speak an AI response aloud
 *   wsStopReading()                 — cancel any ongoing TTS
 *   wsListenPdf()                   — read current PDF page / slide aloud
 *   wsStopListenPdf()               — stop PDF listening
 *   wsListenPdfSetRate(rate)        — change playback speed (0.5 – 2.0)
 *   wsVoiceSupported()              — true if STT is available
 *   wsTtsSupported()                — true if TTS is available
 */

import { $el, addClass, removeClass } from '../domHelpers.js';
import { wsAutoResize } from './chat.js';
import { showToast } from '../../components/Toast.js';

// ── State ─────────────────────────────────────────────────────────────────────

let _recognition = null;       // SpeechRecognition instance
let _isListening = false;      // whether mic is active
let _currentUtterance = null;  // active SpeechSynthesisUtterance
let _readingMsgId = null;      // ID of the message currently being read
let _isListeningPdf = false;   // whether PDF/slide reader is active
let _isPausedPdf = false;      // whether reader is paused
let _keepAliveTimer = null;    // Chrome TTS keep-alive interval
let _listenRate = 1.0;         // current TTS playback rate

// Slide-by-slide reading state
let _slideReadQueue = [];       // array of slide indices to read
let _slideReadIdx = 0;          // current position in queue
let _highlightedWordEl = null;  // currently highlighted .tts-word span
let _ttsWordSpans = [];         // [{el, charStart}]

// ── STT helpers ───────────────────────────────────────────────────────────────

export function wsVoiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function wsTtsSupported() {
  return 'speechSynthesis' in window;
}

function _getMicBtn() {
  return document.getElementById('ws-mic-btn');
}

function _setMicState(listening) {
  _isListening = listening;
  const btn = _getMicBtn();
  if (!btn) return;
  if (listening) {
    addClass(btn, 'mic-active');
    btn.title = 'Stop recording';
    btn.setAttribute('aria-label', 'Stop recording');
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <rect x="9" y="9" width="6" height="6" rx="1"/>
        <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" opacity="0.35"/>
      </svg>`;
  } else {
    removeClass(btn, 'mic-active');
    btn.title = 'Voice input';
    btn.setAttribute('aria-label', 'Voice input');
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
        <line x1="8" y1="22" x2="16" y2="22"/>
      </svg>`;
  }
}

export function wsToggleVoiceInput() {
  if (!wsVoiceSupported()) {
    showToast('\u{1F3A4}', 'Voice input requires Chrome, Edge or Safari 17+', 'var(--red)');
    return;
  }
  // SpeechRecognition requires HTTPS (or localhost)
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    showToast('\u{1F3A4}', 'Voice input requires a secure (HTTPS) connection', 'var(--red)');
    return;
  }
  if (_isListening) {
    _stopRecognition();
  } else {
    _startRecognition();
  }
}

function _startRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  _recognition = new SpeechRecognition();
  _recognition.continuous = true;   // keep listening until explicitly stopped
  _recognition.interimResults = true;
  _recognition.lang = navigator.language || 'en-US';

  const inp = $el('ws-chat-input');
  let committedText = inp ? inp.value : '';

  _recognition.onstart = () => {
    _setMicState(true);
    showToast('\u{1F3A4}', 'Listening\u2026 speak now', '');
  };

  _recognition.onresult = (event) => {
    let interim = '';
    let newFinal = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) newFinal += t;
      else interim += t;
    }
    if (newFinal) committedText += newFinal;
    if (inp) {
      inp.value = committedText + interim;
      wsAutoResize(inp);
    }
  };

  _recognition.onerror = (e) => {
    _setMicState(false);
    if (e.error === 'not-allowed' || e.error === 'permission-denied') {
      showToast('\u{1F3A4}', 'Microphone access denied \u2014 check browser permissions', 'var(--red)');
    } else if (e.error === 'network') {
      showToast('\u{1F3A4}', 'Speech recognition needs internet access', 'var(--red)');
    } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
      showToast('\u{1F3A4}', `Voice input error: ${e.error}`, 'var(--red)');
    }
  };

  _recognition.onend = () => {
    _setMicState(false);
    _recognition = null;
    if (inp) {
      // Strip trailing interim — keep only committed text
      inp.value = committedText;
      wsAutoResize(inp);
      inp.focus();
    }
  };

  try {
    _recognition.start();
  } catch (e) {
    _setMicState(false);
    showToast('\u{1F3A4}', 'Could not start microphone: ' + e.message, 'var(--red)');
  }
}

function _stopRecognition() {
  if (_recognition) {
    try { _recognition.stop(); } catch (_) {}
    _recognition = null;
  }
  _setMicState(false);
}

// ── TTS helpers ───────────────────────────────────────────────────────────────

/**
 * Strip Markdown/HTML markup so TTS reads clean prose.
 */
function _stripMarkup(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function _getChosenVoice() {
  try {
    const name = localStorage.getItem('chunks_setting_voice');
    if (!name) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.name.toLowerCase().includes(name.toLowerCase())) || null;
  } catch (_) { return null; }
}

// ── Chrome SpeechSynthesis keep-alive ─────────────────────────────────────────
// Chrome pauses/stops synthesis after ~15 s of tab inactivity or on long texts.
// Periodically pause+resume to reset the internal timeout.

function _startKeepAlive() {
  _stopKeepAlive();
  // Chrome's internal TTS timeout is ~15 s; reset it at 14 s to be safe
  // while minimising unnecessary pause/resume interruptions.
  _keepAliveTimer = setInterval(() => {
    if (!wsTtsSupported()) return;
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 14_000);
}

function _stopKeepAlive() {
  if (_keepAliveTimer) {
    clearInterval(_keepAliveTimer);
    _keepAliveTimer = null;
  }
}

export function wsStopReading() {
  _stopKeepAlive();
  if (wsTtsSupported()) window.speechSynthesis.cancel();
  _currentUtterance = null;
  if (_readingMsgId) {
    _updateReadBtn(_readingMsgId, false);
    _readingMsgId = null;
  }
}

function _updateReadBtn(msgId, playing) {
  const btn = document.querySelector(`#${msgId} .ws-read-aloud-btn`);
  if (!btn) return;
  if (playing) {
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop`;
    btn.setAttribute('aria-pressed', 'true');
  } else {
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg> Read`;
    btn.setAttribute('aria-pressed', 'false');
  }
}

export function wsReadAloud(text, msgId) {
  if (!wsTtsSupported()) {
    showToast('\u{1F50A}', 'Text-to-speech is not supported in this browser', '');
    return;
  }

  // Toggle off if already reading this message
  if (_readingMsgId === msgId && window.speechSynthesis.speaking) {
    wsStopReading();
    return;
  }

  wsStopReading();
  _readingMsgId = msgId;

  const clean = _stripMarkup(text);
  if (!clean) return;

  const utter = new SpeechSynthesisUtterance(clean);
  utter.rate = _listenRate;
  const voice = _getChosenVoice();
  if (voice) utter.voice = voice;

  utter.onstart = () => {
    _updateReadBtn(msgId, true);
    _startKeepAlive();
  };
  utter.onend   = () => {
    _stopKeepAlive();
    _currentUtterance = null;
    if (_readingMsgId === msgId) {
      _readingMsgId = null;
      _updateReadBtn(msgId, false);
    }
  };
  utter.onerror = (e) => {
    _stopKeepAlive();
    if (e.error !== 'interrupted' && e.error !== 'canceled') {
      showToast('\u{1F50A}', `Could not read aloud: ${e.error}`, 'var(--red)');
    }
    _currentUtterance = null;
    _readingMsgId = null;
    _updateReadBtn(msgId, false);
  };

  _currentUtterance = utter;
  window.speechSynthesis.speak(utter);
}

// ── Listen controls bar ────────────────────────────────────────────────────────

const LISTEN_BAR_ID = 'ws-listen-controls-bar';

function _ensureListenBar() {
  if (document.getElementById(LISTEN_BAR_ID)) return;
  const bar = document.createElement('div');
  bar.id = LISTEN_BAR_ID;
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Listen controls');
  bar.style.cssText = [
    'display:none;',
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:900;',
    'background:var(--surface-1);border:1px solid var(--border-md);border-radius:40px;',
    'padding:8px 16px;gap:8px;align-items:center;',
    'box-shadow:0 8px 32px rgba(0,0,0,0.45);backdrop-filter:blur(12px);',
    'font-family:var(--font-body);font-size:12px;color:var(--text-2);',
    'user-select:none;',
  ].join('');

  bar.innerHTML = `
    <button id="listen-bar-playpause"
      title="Pause reading"
      onclick="window._wsListenBarPlayPause()"
      style="background:none;border:none;cursor:pointer;color:var(--text-1);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background 120ms;"
      onmouseenter="this.style.background='var(--surface-2)'" onmouseleave="this.style.background='none'">
      <svg id="listen-bar-playpause-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
      </svg>
    </button>
    <div style="display:flex;align-items:center;gap:4px;">
      <span style="font-size:11px;color:var(--text-3);">Speed</span>
      <select id="listen-bar-speed"
        onchange="window._wsListenBarSetSpeed(this.value)"
        style="background:var(--surface-2);border:1px solid var(--border-sm);border-radius:6px;color:var(--text-1);font-size:11px;padding:2px 6px;cursor:pointer;outline:none;">
        <option value="0.5">0.5\u00d7</option>
        <option value="0.75">0.75\u00d7</option>
        <option value="1" selected>1\u00d7</option>
        <option value="1.25">1.25\u00d7</option>
        <option value="1.5">1.5\u00d7</option>
        <option value="2">2\u00d7</option>
      </select>
    </div>
    <div style="width:1px;height:18px;background:var(--border-sm);margin:0 2px;"></div>
    <button
      title="Stop reading"
      onclick="wsStopListenPdf()"
      style="background:none;border:none;cursor:pointer;color:var(--text-3);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background 120ms;"
      onmouseenter="this.style.background='var(--surface-2)'" onmouseleave="this.style.background='none'">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="2"/>
      </svg>
    </button>`;

  document.body.appendChild(bar);
}

function _showListenBar() {
  _ensureListenBar();
  const bar = document.getElementById(LISTEN_BAR_ID);
  if (bar) bar.style.display = 'flex';
  // Sync speed selector to current rate
  const sel = document.getElementById('listen-bar-speed');
  if (sel) sel.value = String(_listenRate);
  _setListenBarPaused(false);
}

function _hideListenBar() {
  const bar = document.getElementById(LISTEN_BAR_ID);
  if (bar) bar.style.display = 'none';
}

function _setListenBarPaused(paused) {
  const icon = document.getElementById('listen-bar-playpause-icon');
  const btn  = document.getElementById('listen-bar-playpause');
  if (!icon || !btn) return;
  if (paused) {
    // Show play icon
    icon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"/>`;
    btn.title = 'Resume reading';
  } else {
    // Show pause icon
    icon.innerHTML = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
    btn.title = 'Pause reading';
  }
}

// Global callbacks for inline onclick handlers in the controls bar HTML
window._wsListenBarPlayPause = function() {
  if (!wsTtsSupported()) return;
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    _isPausedPdf = false;
    _setListenBarPaused(false);
    _startKeepAlive();
  } else if (window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
    _isPausedPdf = true;
    _setListenBarPaused(true);
    _stopKeepAlive();
  }
};

window._wsListenBarSetSpeed = function(val) {
  const rate = parseFloat(val);
  if (!isFinite(rate)) return;
  wsListenPdfSetRate(rate);
};

// ── PDF Listen — reads current page/slide text aloud ─────────────────────────

function _setListenBtnState(active) {
  _isListeningPdf = active;
  const btn = document.getElementById('ws-listen-btn');
  if (!btn) return;
  if (active) {
    btn.classList.add('listen-active');
    btn.title = 'Pause / stop listening';
    btn.setAttribute('aria-pressed', 'true');
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
      </svg>`;
  } else {
    btn.classList.remove('listen-active');
    btn.title = 'Listen to current page';
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      </svg>`;
  }
}

export function wsStopListenPdf() {
  _stopKeepAlive();
  if (wsTtsSupported()) window.speechSynthesis.cancel();
  _currentUtterance = null;
  _isPausedPdf = false;
  _slideReadQueue = [];
  _slideReadIdx = 0;
  _clearWordHighlight();
  _setListenBtnState(false);
  _hideListenBar();
}

/**
 * Change the TTS playback rate for the Listen function.
 * Persists in localStorage. If currently speaking, the new rate will apply
 * to the next utterance (rate cannot be changed mid-utterance in Web Speech API).
 */
export function wsListenPdfSetRate(rate) {
  const r = Math.max(0.5, Math.min(2.0, rate));
  _listenRate = r;
  try { localStorage.setItem('chunks_listen_rate', String(r)); } catch (_) {}
  // Sync speed selector in bar
  const sel = document.getElementById('listen-bar-speed');
  if (sel) sel.value = String(r);
}

// ── Word highlighting helpers ─────────────────────────────────────────────────

function _clearWordHighlight() {
  if (_highlightedWordEl) {
    _highlightedWordEl.classList.remove('tts-highlight');
    _highlightedWordEl = null;
  }
  _ttsWordSpans = [];
}

/**
 * Build a list of {el, charStart} objects from .tts-word spans in containerEl,
 * mapping each span to its actual character offset in containerEl.textContent.
 * Uses the raw text content so positions match the SpeechSynthesisUtterance.
 */
function _buildWordSpanMap(containerEl) {
  _ttsWordSpans = [];
  if (!containerEl) return;
  const fullText = containerEl.textContent;
  const spans = containerEl.querySelectorAll('.tts-word');
  let searchFrom = 0;
  spans.forEach(span => {
    const word = span.textContent;
    if (!word) return;
    const idx = fullText.indexOf(word, searchFrom);
    if (idx === -1) return;
    _ttsWordSpans.push({ el: span, charStart: idx });
    searchFrom = idx + word.length;
  });
}

function _highlightWordAt(charIndex) {
  if (!_ttsWordSpans.length) return;
  // Find the last span whose charStart is <= charIndex
  let best = _ttsWordSpans[0];
  for (const s of _ttsWordSpans) {
    if (s.charStart <= charIndex) best = s;
    else break;
  }
  if (best.el === _highlightedWordEl) return;
  if (_highlightedWordEl) _highlightedWordEl.classList.remove('tts-highlight');
  best.el.classList.add('tts-highlight');
  _highlightedWordEl = best.el;
  // Scroll highlighted word into view (smooth, nearest block)
  best.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ── Slide-by-slide reading ────────────────────────────────────────────────────

/**
 * Speaks the slide at _slideReadQueue[_slideReadIdx] then advances.
 * Called recursively via onend until the queue is exhausted.
 */
function _readNextSlide() {
  if (!_isListeningPdf || _slideReadIdx >= _slideReadQueue.length) {
    wsStopListenPdf();
    return;
  }

  const wsState = window.ws || (typeof ws !== 'undefined' ? ws : null);
  const slideNum = _slideReadQueue[_slideReadIdx];
  _slideReadIdx++;

  // Update current page badge and scroll the card into view
  if (wsState) {
    wsState.currentPage = slideNum;
  }
  const card = document.getElementById(`ws-slide-card-${slideNum}`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Extract text from the slide card body
  const bodyEl = card ? card.querySelector('.ws-slide-body') : null;
  const rawText = bodyEl ? bodyEl.textContent.trim() : '';
  if (!rawText) {
    _readNextSlide();
    return;
  }

  _clearWordHighlight();
  if (bodyEl) _buildWordSpanMap(bodyEl);

  const utter = new SpeechSynthesisUtterance(rawText);
  utter.rate = _listenRate;
  const voice = _getChosenVoice();
  if (voice) utter.voice = voice;

  utter.onboundary = (e) => {
    if (e.name === 'word') _highlightWordAt(e.charIndex);
  };
  utter.onend = () => {
    _clearWordHighlight();
    _currentUtterance = null;
    if (_isListeningPdf) _readNextSlide();
  };
  utter.onerror = (e) => {
    if (e.error !== 'interrupted' && e.error !== 'canceled') {
      showToast('\u{1F50A}', `Read error: ${e.error}`, 'var(--red)');
    }
    _clearWordHighlight();
    _currentUtterance = null;
    wsStopListenPdf();
  };

  _currentUtterance = utter;
  window.speechSynthesis.speak(utter);
}

/**
 * Read the current PDF page (or user-doc slide) aloud.
 *
 * Slides mode — reads cards one-by-one from the current slide onward,
 *               with per-word highlighting and automatic page advance.
 * PDF mode    — extracts text from the current page via PDF.js and reads it.
 *
 * Click while active  → pause / resume (toggle)
 */
export async function wsListenPdf() {
  if (!wsTtsSupported()) {
    showToast('\u{1F50A}', 'Text-to-speech is not supported in this browser', '');
    return;
  }

  // Restore persisted rate on first use
  try {
    const saved = parseFloat(localStorage.getItem('chunks_listen_rate') || '');
    if (isFinite(saved)) _listenRate = Math.max(0.5, Math.min(2.0, saved));
  } catch (_) {}

  // ── Pause / Resume if already active ─────────────────────────────────────
  if (_isListeningPdf) {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      _isPausedPdf = false;
      _setListenBarPaused(false);
      _startKeepAlive();
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      _isPausedPdf = true;
      _setListenBarPaused(true);
      _stopKeepAlive();
    } else {
      wsStopListenPdf();
    }
    return;
  }

  wsStopListenPdf();

  const wsState = window.ws || (typeof ws !== 'undefined' ? ws : null);
  if (!wsState) {
    showToast('\u{1F50A}', 'No document open', '');
    return;
  }

  _setListenBtnState(true);

  // ── Slides mode (PPT / YouTube transcript) ───────────────────────────────
  if (!wsState.pdfDoc && wsState.pageContainers && wsState.pageContainers.length) {
    const startPage = wsState.currentPage || 1;
    const total = wsState.totalPages || wsState.pageContainers.length;
    _slideReadQueue = Array.from({ length: total - startPage + 1 }, (_, i) => i + startPage);
    _slideReadIdx = 0;
    _showListenBar();
    _startKeepAlive();
    showToast('\u{1F50A}', `Reading from slide ${startPage}\u2026`, '');
    _readNextSlide();
    return;
  }

  // ── PDF mode ─────────────────────────────────────────────────────────────
  if (wsState.pdfDoc) {
    let textToRead = '';
    try {
      const pageNum = wsState.currentPage || 1;
      const page = await wsState.pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      textToRead = content.items.map(it => it.str).join(' ').trim();
      if (!textToRead) {
        showToast('\u{1F50A}', 'No readable text on this page', '');
        _setListenBtnState(false);
        return;
      }
      showToast('\u{1F50A}', `Reading page ${pageNum}\u2026`, '');
    } catch (e) {
      showToast('\u{1F50A}', 'Could not extract page text', 'var(--red)');
      _setListenBtnState(false);
      return;
    }

    const utter = new SpeechSynthesisUtterance(textToRead);
    utter.rate = _listenRate;
    const voice = _getChosenVoice();
    if (voice) utter.voice = voice;

    _showListenBar();
    _startKeepAlive();

    utter.onend = () => {
      _stopKeepAlive();
      _currentUtterance = null;
      _setListenBtnState(false);
      _hideListenBar();
    };
    utter.onerror = (e) => {
      _stopKeepAlive();
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        showToast('\u{1F50A}', `Read error: ${e.error}`, 'var(--red)');
      }
      _currentUtterance = null;
      _setListenBtnState(false);
      _hideListenBar();
    };

    _currentUtterance = utter;
    window.speechSynthesis.speak(utter);
    return;
  }

  // ── userDocText fallback (legacy path for non-slide, non-PDF docs) ────────
  if (wsState.userDocText) {
    const textToRead = _stripMarkup(wsState.userDocText);
    if (!textToRead) {
      showToast('\u{1F50A}', 'No text found in this document', '');
      _setListenBtnState(false);
      return;
    }
    showToast('\u{1F50A}', 'Reading document\u2026', '');

    const utter = new SpeechSynthesisUtterance(textToRead);
    utter.rate = _listenRate;
    const voice = _getChosenVoice();
    if (voice) utter.voice = voice;

    _showListenBar();
    _startKeepAlive();

    utter.onend = () => {
      _stopKeepAlive();
      _currentUtterance = null;
      _setListenBtnState(false);
      _hideListenBar();
    };
    utter.onerror = (e) => {
      _stopKeepAlive();
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        showToast('\u{1F50A}', `Read error: ${e.error}`, 'var(--red)');
      }
      _currentUtterance = null;
      _setListenBtnState(false);
      _hideListenBar();
    };

    _currentUtterance = utter;
    window.speechSynthesis.speak(utter);
    return;
  }

  showToast('\u{1F50A}', 'Open a document first', '');
  _setListenBtnState(false);
}
