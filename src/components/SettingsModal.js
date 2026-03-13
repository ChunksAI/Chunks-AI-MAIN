/**
 * src/components/SettingsModal.js — Settings Modal component
 *
 * Owns all JavaScript for the settings modal:
 *   - open / close with focus-trap
 *   - left-nav page switching (settingsNav)
 *   - custom dropdown open/close/select logic
 *   - font-size picker (settingsFontSize)
 *   - accent color picker (settingsSelectAccent, applyAccentColor)
 *   - voice picker + preview (settingsSelectVoice, settingsPlayVoice)
 *   - toggle persistence (settingsToggleChanged)
 *   - default book + study mode selects
 *   - data controls: save history, improve data, clearAllHistory, clearPdfCache
 *   - ARIA init for all settings dropdowns
 *   - restore persisted settings on load
 *
 * The static HTML (`#settings-modal`) remains in index.html until Task 36/38.
 *
 * Exports
 * ───────
 *   openSettings(page?)
 *   closeSettings()
 *   settingsFontSize(size, btn)
 *   settingsNav(page, el)
 *   settingsDropdown(btn)
 *   settingsSelect(optionEl)
 *   settingsSelectAccent(optionEl, color, name)
 *   settingsSelectVoice(optionEl)
 *   settingsPlayVoice()
 *   settingsToggleChanged(checkbox, key)
 *   settingsSelectDefaultBook(optionEl)
 *   settingsSelectStudyMode(optionEl)
 *   applyAccentColor(color)
 *   dataToggleSaveHistory(checkbox)
 *   dataToggleImprove(checkbox)
 *   clearAllHistory()
 *   clearPdfCache()
 *
 * window globals set
 * ──────────────────
 *   window.openSettings, window.closeSettings
 *   window.settingsFontSize, window.settingsNav
 *   window.settingsDropdown, window.settingsSelect
 *   window.settingsSelectAccent, window.settingsSelectVoice
 *   window.settingsPlayVoice, window.settingsToggleChanged
 *   window.settingsSelectDefaultBook, window.settingsSelectStudyMode
 *   window.applyAccentColor
 *   window.dataToggleSaveHistory, window.dataToggleImprove
 *   window.clearAllHistory, window.clearPdfCache
 *
 * Task 24 — extracted from monolith:
 *   openSettings / closeSettings / _settingsFocusRelease  → line 4289
 *   _restoreSettings IIFE                                 → line 4339
 *   _initDropdownAria IIFE                                → line 4440
 *   settingsNav / backdrop listener                       → line 4791
 *   settingsDropdown / settingsSelect                     → line 4811
 *   applyAccentColor / _hexToRgb / settingsSelectAccent   → line 4833
 *   settingsSelectVoice / settingsPlayVoice               → line 4926
 *   settingsToggleChanged / settingsSelectDefaultBook
 *     / settingsSelectStudyMode                           → line 4958
 *   dataToggleSaveHistory / dataToggleImprove             → line ~5020
 *   clearAllHistory / clearPdfCache / _updateCacheSizeLabel → line 5030
 */

// ── State ──────────────────────────────────────────────────────────────────

let _settingsFocusRelease = null;
let _openDropdownBtn      = null;

// ── Page index map (left-nav order) ────────────────────────────────────────

const PAGE_MAP = {
  general: 0, notifications: 1, personalization: 2,
  apps: 3, data: 4, security: 5, parental: 6, account: 7,
};

// ── Open / Close ───────────────────────────────────────────────────────────

export function openSettings(page) {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.classList.add('active');

  if (page) {
    const navItems = modal.querySelectorAll('.settings-nav-item');
    navItems.forEach(n => { n.classList.remove('active'); n.removeAttribute('aria-current'); });
    modal.querySelectorAll('.settings-page').forEach(p => p.classList.remove('active'));

    const idx = PAGE_MAP[page] ?? 0;
    navItems[idx]?.classList.add('active');
    navItems[idx]?.setAttribute('aria-current', 'page');
    document.getElementById('settings-page-' + page)?.classList.add('active');
  }

  if (typeof window.trapFocus === 'function') {
    _settingsFocusRelease = window.trapFocus(modal);
  }
}

export function closeSettings() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.classList.remove('active');
  if (_settingsFocusRelease) { _settingsFocusRelease(); _settingsFocusRelease = null; }
}

// ── Left-nav page switching ────────────────────────────────────────────────

export function settingsNav(page, el) {
  document.querySelectorAll('.settings-nav-item').forEach(n => {
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });
  document.querySelectorAll('.settings-page').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  el.setAttribute('aria-current', 'page');
  document.getElementById('settings-page-' + page)?.classList.add('active');
  if (page === 'data') _updateCacheSizeLabel();
}

// ── Font size ──────────────────────────────────────────────────────────────

export function settingsFontSize(size, btn) {
  const map = { small: '11px', medium: '13px', large: '15px' };
  if (!map[size]) return;
  document.documentElement.style.setProperty('--chat-font-size', map[size]);
  document.querySelectorAll('.font-size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  try { localStorage.setItem('chunks-chat-font-size', size); } catch (e) {}
}

// Restore font-size immediately (before DOMContentLoaded if possible)
(function _restoreFontSize() {
  try {
    const s   = localStorage.getItem('chunks-chat-font-size');
    const map = { small: '11px', medium: '13px', large: '15px' };
    if (s && map[s]) {
      document.documentElement.style.setProperty('--chat-font-size', map[s]);
      const sync = () => {
        document.querySelectorAll('.font-size-btn').forEach(b => b.classList.remove('active'));
        const t = document.querySelector(`.font-size-btn[onclick*="'${s}'"]`);
        if (t) t.classList.add('active');
      };
      document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', sync)
        : sync();
    }
  } catch (e) {}
})();

// ── Custom dropdown logic ──────────────────────────────────────────────────

export function settingsDropdown(btn) {
  const menu   = btn.nextElementSibling;
  const isOpen = menu.classList.contains('open');

  // Close any other open menus first
  document.querySelectorAll('.settings-select-menu.open').forEach(m => {
    m.classList.remove('open');
    m.previousElementSibling?.setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('.settings-select-btn.open').forEach(b => b.classList.remove('open'));

  if (!isOpen) {
    menu.classList.add('open');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    _openDropdownBtn = btn;
  } else {
    btn.setAttribute('aria-expanded', 'false');
    _openDropdownBtn = null;
  }
}

export function settingsSelect(optionEl) {
  const menu  = optionEl.closest('.settings-select-menu');
  const btn   = menu.previousElementSibling;
  const label = btn.querySelector('span');

  menu.querySelectorAll('.settings-select-option').forEach(o => {
    o.classList.remove('selected');
    o.setAttribute('aria-selected', 'false');
  });
  optionEl.classList.add('selected');
  optionEl.setAttribute('aria-selected', 'true');

  const text = optionEl.textContent.replace('✓', '').trim();
  label.textContent = text;

  const key = menu.dataset.settingKey;
  if (key) { try { localStorage.setItem('chunks_setting_' + key, text); } catch (e) {} }

  menu.classList.remove('open');
  btn.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
}

// ── Accent color ───────────────────────────────────────────────────────────

function _hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3 ? h.split('').map(c => c + c).join('') : h,
    16
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function applyAccentColor(color) {
  const root = document.documentElement;
  // Guard against the string "undefined" being stored from a prior bug
  if (color === 'undefined' || color === 'null') color = null;
  if (!color || color === '#888') {
    ['--gold', '--gold-bright', '--gold-muted', '--gold-glow', '--gold-border',
     '--accent', '--accent-dim', '--accent-glow'].forEach(v => root.style.removeProperty(v));
  } else {
    const [r, g, b] = _hexToRgb(color);
    root.style.setProperty('--gold',        color);
    root.style.setProperty('--gold-bright', color);
    root.style.setProperty('--gold-muted',  `rgba(${r},${g},${b},0.10)`);
    root.style.setProperty('--gold-glow',   `rgba(${r},${g},${b},0.20)`);
    root.style.setProperty('--gold-border', `rgba(${r},${g},${b},0.22)`);
    root.style.setProperty('--accent',      color);
    root.style.setProperty('--accent-dim',  `rgba(${r},${g},${b},0.12)`);
    root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.25)`);
  }
}

export function settingsSelectAccent(optionEl, color, name) {
  const menu = optionEl.closest('.settings-select-menu');
  const btn  = menu.previousElementSibling;

  menu.querySelectorAll('.settings-select-option').forEach(o => o.classList.remove('selected'));
  optionEl.classList.add('selected');

  applyAccentColor(color);

  const dot = document.getElementById('accent-dot');
  const displayColor = color === '#888' ? 'var(--text-3)' : color;
  if (dot) dot.style.background = displayColor;

  btn.querySelector('span').innerHTML =
    `<span style="display:inline-flex;align-items:center;gap:7px;">` +
    `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${displayColor};flex-shrink:0;"></span>` +
    `${name}</span>`;

  try {
    localStorage.setItem('chunks_setting_accent',       name);
    localStorage.setItem('chunks_setting_accent_color', color);
  } catch (e) {}

  menu.classList.remove('open');
  btn.classList.remove('open');
}

// ── Voice picker ───────────────────────────────────────────────────────────

export function settingsSelectVoice(optionEl) {
  settingsSelect(optionEl);
  const voice = optionEl.textContent.trim();
  const lbl   = document.getElementById('voice-label');
  if (lbl) lbl.textContent = voice;
  try { localStorage.setItem('chunks_setting_voice', voice); } catch (e) {}
}

export function settingsPlayVoice() {
  const btn   = document.getElementById('voice-play-btn');
  const voice = document.getElementById('voice-label')?.textContent || 'Maple';
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(`Hi, I'm ${voice}, your Chunks AI study assistant.`);
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Playing`;
    utter.onend = () => {
      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play`;
    };
  } else {
    window.wsShowToast?.('🔊', 'Voice preview not supported in this browser', '');
  }
}

// ── Toggles ────────────────────────────────────────────────────────────────

export function settingsToggleChanged(checkbox, key) {
  const val = checkbox.checked;
  try { localStorage.setItem('chunks_setting_' + key, val ? '1' : '0'); } catch (e) {}
  if (key === 'followups') {
    document.querySelectorAll('.followups').forEach(el => {
      el.style.display = val ? '' : 'none';
    });
  }
  window.wsShowToast?.(`${val ? '✓' : '✕'}`, `${key.replace(/-/g, ' ')} ${val ? 'enabled' : 'disabled'}`, '');
}

// ── Personalization selects ────────────────────────────────────────────────

export function settingsSelectDefaultBook(optionEl) {
  settingsSelect(optionEl);
  const bookId = optionEl.dataset.bookId;
  if (bookId) {
    try { localStorage.setItem('chunks_default_book', bookId); } catch (e) {}
    window.wsShowToast?.('📚', `Default book set to ${optionEl.textContent.trim()}`, '');
  }
}

export function settingsSelectStudyMode(optionEl) {
  settingsSelect(optionEl);
  const mode = optionEl.dataset.mode;
  if (mode) {
    try { localStorage.setItem('chunks_study_mode', mode); } catch (e) {}
    window.wsShowToast?.('✓', `Study mode: ${optionEl.textContent.trim()}`, '');
  }
}

// ── Data controls ──────────────────────────────────────────────────────────

export function dataToggleSaveHistory(checkbox) {
  const enabled = checkbox.checked;
  try { localStorage.setItem('chunks_save_history', enabled ? '1' : '0'); } catch (e) {}
  if (!enabled) {
    try {
      localStorage.removeItem('chunks_recent');
      Object.keys(localStorage)
        .filter(k => k.startsWith('chunks_session_') || k.startsWith('chunks_ws_session_'))
        .forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('chunks_active_home_session');
      localStorage.removeItem('chunks_active_ws_book');
      localStorage.removeItem('chunks_active_recent_id');
    } catch (e) {}
    // Update in-memory state if globals exist
    if (window._recentItems !== undefined) window._recentItems = [];
    if (typeof window._renderAllRecent === 'function') window._renderAllRecent();
  }
  window.wsShowToast?.(enabled ? '✓' : '✕',
    `Chat history ${enabled ? 'will be saved' : 'disabled — history cleared'}`, '');
}

export function dataToggleImprove(checkbox) {
  const enabled = checkbox.checked;
  try { localStorage.setItem('chunks_improve_data', enabled ? '1' : '0'); } catch (e) {}
  window.wsShowToast?.(enabled ? '✓' : '✕',
    `Usage data sharing ${enabled ? 'enabled' : 'disabled'}`, '');
}

export function clearAllHistory() {
  window.showConfirmModal?.({
    title: 'Clear your chat history — are you sure?',
    desc: 'This will permanently delete all saved conversations and cannot be undone.',
    confirmLabel: 'Confirm deletion',
    onConfirm: () => {
      try {
        Object.keys(localStorage)
          .filter(k =>
            k.startsWith('chunks_session_') ||
            k.startsWith('chunks_ws_session_') ||
            k === 'chunks_recent' ||
            k === 'chunks_active_home_session' ||
            k === 'chunks_active_ws_book' ||
            k === 'chunks_active_recent_id' ||
            k === 'chunks_home_session'
          )
          .forEach(k => localStorage.removeItem(k));
      } catch (e) {}

      // Reset in-memory globals (defined later in monolith — guard with typeof)
      if (window._recentItems !== undefined)  window._recentItems   = [];
      if (window._activeRecentId !== undefined) window._activeRecentId = null;
      if (window.homeHistory !== undefined)    window.homeHistory    = [];
      if (window._homeSessionId !== undefined) window._homeSessionId = null;
      if (window._wsChatHistory !== undefined) window._wsChatHistory = [];
      if (typeof window._renderAllRecent === 'function') window._renderAllRecent();

      const chatHist   = document.getElementById('home-chat-history');
      const homeLanding = document.getElementById('home-landing');
      const homeHero   = document.querySelector('.home-hero');
      const homeBar    = document.getElementById('home-input-bar');
      const homeScroll = document.getElementById('home-scroll-area');
      if (chatHist)    chatHist.innerHTML = '';
      if (homeLanding) homeLanding.style.display = '';
      if (homeHero)    homeHero.style.display = '';
      if (homeBar)     homeBar.style.display = 'none';
      if (homeScroll)  homeScroll.style.justifyContent = 'center';

      closeSettings();
      setTimeout(() => window.showSimpleNotif?.('Chat history cleared'), 200);
    },
  });
}

export async function clearPdfCache() {
  if (!('caches' in window)) {
    window.wsShowToast?.('⚠', 'Cache API not supported in this browser', '');
    return;
  }
  window.showConfirmModal?.({
    title: 'Clear cached textbooks — are you sure?',
    desc: 'Textbooks will be re-downloaded the next time you open them in Workspace.',
    confirmLabel: 'Confirm deletion',
    onConfirm: async () => {
      await caches.delete('chunks-pdf-v1');
      _updateCacheSizeLabel();
      closeSettings();
      setTimeout(() => window.showSimpleNotif?.('PDF cache cleared'), 200);
    },
  });
}

async function _updateCacheSizeLabel() {
  const el = document.getElementById('cache-size-label');
  if (!el || !('caches' in window)) return;
  try {
    const cache = await caches.open('chunks-pdf-v1');
    const keys  = await cache.keys();
    if (keys.length === 0) {
      el.textContent = 'No textbooks cached yet.';
    } else {
      let totalBytes = 0;
      for (const req of keys) {
        const res = await cache.match(req);
        const buf = await res.clone().arrayBuffer();
        totalBytes += buf.byteLength;
      }
      const mb = (totalBytes / 1048576).toFixed(1);
      el.textContent = `${keys.length} textbook${keys.length > 1 ? 's' : ''} cached — ${mb} MB`;
    }
  } catch (e) {
    el.textContent = 'Textbooks cached locally for fast loading.';
  }
}

// ── Restore persisted settings on load ────────────────────────────────────

function _restoreSettings() {
  function applySelect(key, value) {
    const menu = document.querySelector(`.settings-select-menu[data-setting-key="${key}"]`);
    if (!menu || !value) return;
    const btn   = menu.previousElementSibling;
    const match = Array.from(menu.querySelectorAll('.settings-select-option'))
      .find(o => o.textContent.replace('✓', '').trim() === value);
    if (!match) return;
    menu.querySelectorAll('.settings-select-option').forEach(o => o.classList.remove('selected'));
    match.classList.add('selected');
    btn.querySelector('span').textContent = value;
  }

  // Accent color (special: dot + CSS vars)
  const accentName  = localStorage.getItem('chunks_setting_accent');
  const accentColor = localStorage.getItem('chunks_setting_accent_color');
  // Clean up corrupted "undefined" values left by a prior bug
  if (accentName === 'undefined' || accentColor === 'undefined') {
    localStorage.removeItem('chunks_setting_accent');
    localStorage.removeItem('chunks_setting_accent_color');
  } else if (accentName && accentColor) {
    applyAccentColor(accentColor);
    const menu = document.querySelector('.settings-select-menu[data-setting-key="accent"]');
    if (menu) {
      const btn   = menu.previousElementSibling;
      const match = Array.from(menu.querySelectorAll('.settings-select-option'))
        .find(o => o.textContent.trim() === accentName);
      if (match) {
        menu.querySelectorAll('.settings-select-option').forEach(o => o.classList.remove('selected'));
        match.classList.add('selected');
        const dot        = document.getElementById('accent-dot');
        const displayColor = accentColor === '#888' ? 'var(--text-3)' : accentColor;
        if (dot) dot.style.background = displayColor;
        btn.querySelector('span').innerHTML =
          `<span style="display:inline-flex;align-items:center;gap:7px;">` +
          `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${displayColor};flex-shrink:0;"></span>` +
          `${accentName}</span>`;
      }
    }
  }

  // Voice
  const voice = localStorage.getItem('chunks_setting_voice');
  if (voice) {
    applySelect('voice', voice);
    const lbl = document.getElementById('voice-label');
    if (lbl) lbl.textContent = voice;
  }

  // Plain text dropdowns
  applySelect('appearance',      localStorage.getItem('chunks_setting_appearance'));
  applySelect('language',        localStorage.getItem('chunks_setting_language'));
  applySelect('spoken-language', localStorage.getItem('chunks_setting_spoken-language'));

  // Default book (matched by data-book-id)
  const savedBook = localStorage.getItem('chunks_default_book');
  if (savedBook) {
    const bookMenu = document.getElementById('default-book-menu');
    if (bookMenu) {
      const match = bookMenu.querySelector(`[data-book-id="${savedBook}"]`);
      if (match) {
        bookMenu.querySelectorAll('.settings-select-option').forEach(o => o.classList.remove('selected'));
        match.classList.add('selected');
        const btn = bookMenu.previousElementSibling;
        if (btn) btn.querySelector('span').textContent = match.textContent.trim();
      }
    }
  }

  // Study mode (matched by data-mode)
  const savedMode = localStorage.getItem('chunks_study_mode');
  if (savedMode) {
    const modeMenu = document.getElementById('study-mode-menu');
    if (modeMenu) {
      const match = modeMenu.querySelector(`[data-mode="${savedMode}"]`);
      if (match) {
        modeMenu.querySelectorAll('.settings-select-option').forEach(o => o.classList.remove('selected'));
        match.classList.add('selected');
        const btn = modeMenu.previousElementSibling;
        if (btn) btn.querySelector('span').textContent = match.textContent.trim();
      }
    }
  }

  // Toggles
  const followups = localStorage.getItem('chunks_setting_followups');
  if (followups !== null) {
    const el = document.getElementById('toggle-followups');
    if (el) el.checked = followups !== '0';
  }
  const autoFlash = localStorage.getItem('chunks_setting_auto-flash');
  if (autoFlash !== null) {
    const el = document.getElementById('toggle-auto-flash');
    if (el) el.checked = autoFlash === '1';
  }

  // Data controls
  if (localStorage.getItem('chunks_save_history') === '0') {
    const el = document.getElementById('toggle-save-history');
    if (el) el.checked = false;
  }
  if (localStorage.getItem('chunks_improve_data') === '0') {
    const el = document.getElementById('toggle-improve-data');
    if (el) el.checked = false;
  }
}

// ── ARIA init for settings dropdowns ──────────────────────────────────────

function _initDropdownAria() {
  document.querySelectorAll('.settings-select-menu').forEach(menu => {
    if (!menu.getAttribute('role')) menu.setAttribute('role', 'listbox');
    menu.querySelectorAll('.settings-select-option').forEach(opt => {
      opt.setAttribute('role', 'option');
      opt.setAttribute('aria-selected', opt.classList.contains('selected') ? 'true' : 'false');
      if (!opt.hasAttribute('tabindex')) opt.setAttribute('tabindex', '0');
    });
    const btn = menu.previousElementSibling;
    if (btn && btn.classList.contains('settings-select-btn') && !btn.getAttribute('role')) {
      btn.setAttribute('role', 'combobox');
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('tabindex', '0');
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); settingsDropdown(this); }
      });
    }
  });
}

// ── DOM-ready wiring ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Restore settings from localStorage
  try { _restoreSettings(); } catch (e) {}

  // ARIA attributes for all dropdowns
  try { _initDropdownAria(); } catch (e) {}

  // Initial cache size label
  _updateCacheSizeLabel();

  // Backdrop click closes the modal (but not while ConfirmModal is open)
  document.getElementById('settings-modal')?.addEventListener('click', function (e) {
    if (e.target === this && !document.getElementById('confirm-modal')?.classList.contains('active')) {
      closeSettings();
    }
  });

  // Close any open dropdown when clicking outside a select-wrap
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.settings-select-wrap')) {
      document.querySelectorAll('.settings-select-menu.open').forEach(m => m.classList.remove('open'));
      document.querySelectorAll('.settings-select-btn.open').forEach(b => b.classList.remove('open'));
    }
  });
});

// ── Window globals ─────────────────────────────────────────────────────────

window.openSettings              = openSettings;
window.closeSettings             = closeSettings;
window.settingsFontSize          = settingsFontSize;
window.settingsNav               = settingsNav;
window.settingsDropdown          = settingsDropdown;
window.settingsSelect            = settingsSelect;
window.settingsSelectAccent      = settingsSelectAccent;
window.settingsSelectVoice       = settingsSelectVoice;
window.settingsPlayVoice         = settingsPlayVoice;
window.settingsToggleChanged     = settingsToggleChanged;
window.settingsSelectDefaultBook = settingsSelectDefaultBook;
window.settingsSelectStudyMode   = settingsSelectStudyMode;
window.applyAccentColor          = applyAccentColor;
window.dataToggleSaveHistory     = dataToggleSaveHistory;
window.dataToggleImprove         = dataToggleImprove;
window.clearAllHistory           = clearAllHistory;
window.clearPdfCache             = clearPdfCache;
