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
 *   wsListenPdf()                   — read current PDF page aloud, word by word
 *   wsStopListenPdf()               — stop PDF listening
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
let _isListeningPdf = false;   // whether PDF reader is active

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
    showToast('🎤', 'Voice input requires Chrome, Edge or Safari 17+', 'var(--red)');
    return;
  }
  // SpeechRecognition requires HTTPS (or localhost)
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    showToast('🎤', 'Voice input requires a secure (HTTPS) connection', 'var(--red)');
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
    showToast('🎤', 'Listening… speak now', '');
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
      showToast('🎤', 'Microphone access denied — check browser permissions', 'var(--red)');
    } else if (e.error === 'network') {
      showToast('🎤', 'Speech recognition needs internet access', 'var(--red)');
    } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
      showToast('🎤', `Voice input error: ${e.error}`, 'var(--red)');
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
    showToast('🎤', 'Could not start microphone: ' + e.message, 'var(--red)');
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

export function wsStopReading() {
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
    showToast('🔊', 'Text-to-speech is not supported in this browser', '');
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
  utter.rate = 0.95;
  const voice = _getChosenVoice();
  if (voice) utter.voice = voice;

  utter.onstart = () => { _updateReadBtn(msgId, true); };
  utter.onend   = () => {
    _currentUtterance = null;
    if (_readingMsgId === msgId) {
      _readingMsgId = null;
      _updateReadBtn(msgId, false);
    }
  };
  utter.onerror = (e) => {
    if (e.error !== 'interrupted' && e.error !== 'canceled') {
      showToast('🔊', `Could not read aloud: ${e.error}`, 'var(--red)');
    }
    _currentUtterance = null;
    _readingMsgId = null;
    _updateReadBtn(msgId, false);
  };

  _currentUtterance = utter;
  window.speechSynthesis.speak(utter);
}

// ── PDF Listen — reads current page text aloud ────────────────────────────────

function _setListenBtnState(active) {
  _isListeningPdf = active;
  const btn = document.getElementById('ws-listen-btn');
  if (!btn) return;
  if (active) {
    btn.classList.add('listen-active');
    btn.title = 'Stop listening';
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
  if (wsTtsSupported()) window.speechSynthesis.cancel();
  _currentUtterance = null;
  _setListenBtnState(false);
}

/**
 * Read the current PDF page (or user-doc text) aloud.
 * Reads the extracted text for the current page from ws.pdfDoc (via PDF.js)
 * or from ws.userDocText for user-uploaded docs.
 */
export async function wsListenPdf() {
  if (!wsTtsSupported()) {
    showToast('🔊', 'Text-to-speech is not supported in this browser', '');
    return;
  }

  // Toggle off if already reading
  if (_isListeningPdf && window.speechSynthesis.speaking) {
    wsStopListenPdf();
    return;
  }

  wsStopListenPdf();

  // Get ws state from global (avoids circular import)
  const wsState = window.ws || (typeof ws !== 'undefined' ? ws : null);
  if (!wsState) {
    showToast('🔊', 'No document open', '');
    return;
  }

  let textToRead = '';

  if (wsState.pdfDoc) {
    // Real PDF — extract text from the current page via PDF.js
    try {
      const pageNum = wsState.currentPage || 1;
      const page = await wsState.pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      textToRead = content.items.map(it => it.str).join(' ').trim();
      if (!textToRead) {
        showToast('🔊', 'No readable text on this page', '');
        return;
      }
      showToast('🔊', `Reading page ${pageNum}…`, '');
    } catch (e) {
      showToast('🔊', 'Could not extract page text', 'var(--red)');
      return;
    }
  } else if (wsState.userDocText) {
    // User-uploaded doc / YouTube transcript — read the full text
    textToRead = _stripMarkup(wsState.userDocText);
    if (!textToRead) { showToast('🔊', 'No text found in this document', ''); return; }
    showToast('🔊', 'Reading document…', '');
  } else {
    showToast('🔊', 'Open a document first', '');
    return;
  }

  const utter = new SpeechSynthesisUtterance(textToRead);
  utter.rate = 0.92;
  const voice = _getChosenVoice();
  if (voice) utter.voice = voice;

  _setListenBtnState(true);

  utter.onend = () => {
    _currentUtterance = null;
    _setListenBtnState(false);
  };
  utter.onerror = (e) => {
    if (e.error !== 'interrupted' && e.error !== 'canceled') {
      showToast('🔊', `Read error: ${e.error}`, 'var(--red)');
    }
    _currentUtterance = null;
    _setListenBtnState(false);
  };

  _currentUtterance = utter;
  window.speechSynthesis.speak(utter);
}
