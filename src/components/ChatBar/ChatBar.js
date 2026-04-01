// @ts-nocheck
/**
 * src/components/ChatBar/ChatBar.js — Unified chat input bar
 *
 * Single component used by both Workspace and Home screens.
 * Renders: optional chip row → textarea + send → optional footer (attach / voice / think).
 *
 * @param {HTMLElement} container     — where to mount
 * @param {object}      options
 * @param {string}      [options.placeholder='Ask anything…']
 * @param {boolean}     [options.showChips=false]
 * @param {Array<{label:string, icon?:string, onClick?:function}>} [options.chips]
 * @param {boolean}     [options.showAttach=false]
 * @param {boolean}     [options.showVoice=false]
 * @param {boolean}     [options.showDeepThink=false]
 * @param {function}    [options.onSend]        — (message:string, thinkMode:string) => void
 * @param {function}    [options.onChip]        — (chipLabel:string) => void
 * @param {function}    [options.onAttach]      — (event) => void
 * @param {function}    [options.onVoice]       — () => void
 * @param {function}    [options.onThinkToggle] — (event) => void
 * @returns {ChatBarHandle}
 */

// ── SVG icons ────────────────────────────────────────────────────────────────

const SEND_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

const ATTACH_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;

const MIC_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`;

const CHEVRON_SVG = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`;

// Default chip icon (small circle)
const DEFAULT_CHIP_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/></svg>`;

// ── Component ────────────────────────────────────────────────────────────────

export function createChatBar(container, {
  placeholder   = 'Ask anything…',
  showChips     = false,
  chips         = [],
  showAttach    = false,
  showVoice     = false,
  showDeepThink = false,
  onSend        = () => {},
  onChip        = () => {},
  onAttach      = () => {},
  onVoice       = () => {},
  onThinkToggle = () => {},
} = {}) {
  // ── Card wrapper ──
  const card = document.createElement('div');
  card.className = 'chat-input-card';

  // ── Chips row (optional) ──
  let chipsRow = null;
  if (showChips && chips.length) {
    chipsRow = document.createElement('div');
    chipsRow.className = 'chat-action-chips';
    chips.forEach(chip => {
      const btn = document.createElement('button');
      btn.className = 'chat-action-chip';
      btn.type = 'button';
      const label  = typeof chip === 'string' ? chip : chip.label;
      const iconEl = typeof chip === 'object' && chip.icon ? chip.icon : DEFAULT_CHIP_SVG;
      btn.innerHTML = `${iconEl} ${_esc(label)}`;
      btn.addEventListener('click', () => {
        if (typeof chip === 'object' && chip.onClick) {
          chip.onClick();
        } else {
          onChip(label);
        }
      });
      chipsRow.appendChild(btn);
    });
    card.appendChild(chipsRow);
  }

  // ── Textarea row ──
  const textareaRow = document.createElement('div');
  textareaRow.className = 'chat-textarea-row';

  const textarea = document.createElement('textarea');
  textarea.className = 'chat-input-field';
  textarea.placeholder = placeholder;
  textarea.rows = 1;
  textarea.setAttribute('style', 'resize:none;max-height:120px;overflow-y:auto;font-family:var(--font-body);font-size:13px;color:var(--text-1);background:transparent;border:none;outline:none;flex:1;line-height:1.5;');
  textarea.addEventListener('input', _autoResize);
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _send(); }
  });

  const sendBtn = document.createElement('button');
  sendBtn.className = 'chat-send';
  sendBtn.type = 'button';
  sendBtn.innerHTML = SEND_SVG;
  sendBtn.addEventListener('click', _send);

  textareaRow.appendChild(textarea);
  textareaRow.appendChild(sendBtn);
  card.appendChild(textareaRow);

  // ── Footer row (optional) ──
  let footer      = null;
  let attachWrap  = null;
  let voiceBtn    = null;
  let thinkWrap   = null;
  let thinkBtn    = null;
  let thinkLabel  = null;
  let thinkDot    = null;
  let _thinkMode  = 'off';

  if (showAttach || showVoice || showDeepThink) {
    footer = document.createElement('div');
    footer.className = 'chat-input-footer';

    const left = document.createElement('div');
    left.className = 'chat-footer-left';

    if (showAttach) {
      attachWrap = document.createElement('div');
      attachWrap.className = 'chat-plus-wrap';
      attachWrap.style.position = 'relative';

      const attachBtn = document.createElement('button');
      attachBtn.className = 'chat-footer-btn';
      attachBtn.type = 'button';
      attachBtn.innerHTML = `${ATTACH_SVG} Attach`;
      attachBtn.addEventListener('click', e => onAttach(e));
      attachWrap.appendChild(attachBtn);
      left.appendChild(attachWrap);
    }

    if (showVoice) {
      voiceBtn = document.createElement('button');
      voiceBtn.className = 'chat-footer-btn mic-btn';
      voiceBtn.type = 'button';
      voiceBtn.innerHTML = `${MIC_SVG} Voice`;
      voiceBtn.addEventListener('click', () => onVoice());
      left.appendChild(voiceBtn);
    }

    const right = document.createElement('div');
    right.className = 'chat-footer-right';

    if (showDeepThink) {
      thinkWrap = document.createElement('div');
      thinkWrap.className = 'chat-think-wrap';
      thinkWrap.style.position = 'relative';

      thinkBtn = document.createElement('button');
      thinkBtn.className = 'chat-footer-btn chat-think-btn';
      thinkBtn.type = 'button';

      thinkDot = document.createElement('span');
      thinkDot.className = 'chat-think-dot';

      thinkLabel = document.createElement('span');
      thinkLabel.textContent = 'Think';

      const chevronSpan = document.createElement('span');
      chevronSpan.innerHTML = CHEVRON_SVG;
      chevronSpan.style.display = 'inline-flex';

      thinkBtn.appendChild(thinkDot);
      thinkBtn.appendChild(thinkLabel);
      thinkBtn.appendChild(chevronSpan);
      thinkBtn.addEventListener('click', e => onThinkToggle(e));

      thinkWrap.appendChild(thinkBtn);
      right.appendChild(thinkWrap);
    }

    footer.appendChild(left);
    footer.appendChild(right);
    card.appendChild(footer);
  }

  container.appendChild(card);

  // ── Internal helpers ──

  function _autoResize() {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  function _send() {
    const text = textarea.value.trim();
    if (!text) return;
    onSend(text, _thinkMode);
  }

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Public handle ──

  /** @typedef {ReturnType<typeof createChatBar>} ChatBarHandle */
  return {
    /** The outer card element */
    el: card,
    /** The textarea element */
    textarea,
    /** The send button */
    sendBtn,
    /** Chips row container (null if showChips=false) */
    chipsRow,
    /** Attach button wrapper — append your menu popup here (null if showAttach=false) */
    attachWrap,
    /** Voice button element (null if showVoice=false) */
    voiceBtn,
    /** Think button wrapper — append your think menu popup here (null if showDeepThink=false) */
    thinkWrap,
    /** Think toggle button (null if showDeepThink=false) */
    thinkBtn,

    /** Set the textarea value and auto-resize */
    setInput(text) { textarea.value = text; _autoResize(); },
    /** Get the current textarea value */
    getInput() { return textarea.value; },
    /** Focus the textarea */
    focus() { textarea.focus(); },
    /** Trigger auto-resize manually */
    autoResize: _autoResize,

    /** Update the Deep Think toggle visual state */
    setDeepThink(mode) {
      _thinkMode = mode;
      if (thinkBtn) thinkBtn.classList.toggle('active', mode !== 'off');
      if (thinkDot) thinkDot.style.background = mode !== 'off' ? 'var(--gold)' : '';
      if (thinkLabel) thinkLabel.textContent = mode === 'deep' ? 'Deep Think' : 'Think';
    },
    /** Get the current think mode */
    getDeepThink() { return _thinkMode; },

    /** Enable/disable the send button */
    setSendEnabled(enabled) { sendBtn.disabled = !enabled; },
    /** Remove the component from the DOM */
    destroy() { card.remove(); },
  };
}
