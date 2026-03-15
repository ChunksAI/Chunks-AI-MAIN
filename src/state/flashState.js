/**
 * src/state/flashState.js — Task 17
 *
 * Flash screen state engine.
 * Owns all flashcard UI logic: generation, deck rendering, study session,
 * card flipping, SM-2 ratings, session completion, and keyboard shortcuts.
 *
 * Depends on (all available on window by the time this runs):
 *   window.FlashcardDB  — flashcardDb.js (Task 33)
 *   window.API_BASE     — api.js (Task 10)
 *   window._showToast   — Toast.js (Task 20)
 *
 * Window exports (referenced by index.html action router):
 *   _fcGenerateFromBar()
 *   _fcNext(rating)
 *   _fcFlip()
 *   _fcRestartDeck()
 *   _fcStudyHardOnly()
 *   _fcCreateNew()
 *   _fcExitStudy()
 *   _fcCloseCompleteModal()
 *   _fcStartDeck(deck)
 *   _fcRenderDeckList()
 *   wsMakeFlashcard(el)
 */

// ── Live session state ────────────────────────────────────────────────────────

let _fcDeck            = [];
let _fcIndex           = 0;
let _fcFlipped         = false;
let _fcStats           = { easy: 0, ok: 0, hard: 0, skipped: 0 };
let _fcRatings         = [];
let _fcCurrentDeckMeta = null;
let _fcHardOnly        = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function _el(id) { return document.getElementById(id); }

function _fcShowView(view) {
  const home  = _el('fc-home');
  const study = _el('fc-study');
  if (!home || !study) return;
  home.style.display  = view === 'home'  ? '' : 'none';
  study.style.display = view === 'study' ? '' : 'none';
}

function _fcSetGenBusy(busy, topic) {
  const btn     = _el('fc-gen-btn');
  const loading = _el('fc-gen-loading');
  const genCard = document.querySelector('.fc-gen-card');
  if (btn)     btn.disabled = busy;
  if (loading) loading.style.display = busy ? '' : 'none';
  if (genCard) genCard.style.display = busy ? 'none' : '';
  const lt = _el('fc-loading-topic');
  if (lt && topic) lt.textContent = topic;
}

function _fcShowError(msg) {
  const el = _el('fc-gen-error');
  if (!el) return;
  el.textContent    = msg;
  el.style.display  = msg ? '' : 'none';
}

// ── Deck list rendering ───────────────────────────────────────────────────────



// ── Accent color system ───────────────────────────────────────────────────────
// Unlocked by streak milestones. Stored in localStorage.
// Applying changes --fc-accent on :root — one variable changes everything.

const ACCENT_KEY = 'chunks_fc_accent_v1';

const FC_ACCENTS = [
  {
    id:       'gold',
    name:     'Gold',
    color:    '#e8ac2e',
    emoji:    '⭐',
    unlocksAt: 0,
    label:    'Default',
  },
  {
    id:       'ocean',
    name:     'Ocean',
    color:    '#2dd4bf',
    emoji:    '🌊',
    unlocksAt: 0,
    label:    '3-day streak',
  },
  {
    id:       'violet',
    name:     'Violet',
    color:    '#8b7cf8',
    emoji:    '💜',
    unlocksAt: 0,
    label:    '7-day streak',
  },
  {
    id:       'crimson',
    name:     'Crimson',
    color:    '#f87171',
    emoji:    '❤️',
    unlocksAt: 0,
    label:    '14-day streak',
  },
  {
    id:       'sunrise',
    name:     'Sunrise',
    color:    '#fb923c',
    emoji:    '🌅',
    unlocksAt: 0,
    label:    '30-day streak',
  },
  {
    id:       'cherry',
    name:     'Cherry',
    color:    '#f472b6',
    emoji:    '🌸',
    unlocksAt: 0,
    label:    '60-day streak',
  },
];

function _fcGetSavedAccent() {
  return localStorage.getItem(ACCENT_KEY) || 'gold';
}

function _fcApplyAccent(id) {
  const accent = FC_ACCENTS.find(a => a.id === id) || FC_ACCENTS[0];
  document.documentElement.style.setProperty('--fc-accent', accent.color);
  localStorage.setItem(ACCENT_KEY, id);
}

function _fcGetUnlockedAccents() {
  const streak = _fcGetStreak();
  const current = streak.current || 0;
  return FC_ACCENTS.filter(a => a.unlocksAt <= current);
}

// Check if new accent was just unlocked and notify
function _fcCheckNewAccentUnlock(prevStreak, newStreak) {
  const newUnlocks = FC_ACCENTS.filter(
    a => a.unlocksAt > 0 && a.unlocksAt <= newStreak && a.unlocksAt > prevStreak
  );
  newUnlocks.forEach(accent => {
    setTimeout(() => {
      window._showToast?.(accent.emoji, `New accent unlocked: ${accent.name}! Tap your streak to customize.`, 'var(--fc-accent)');
    }, 1500);
  });
}

function _fcOpenAccentPicker() {
  // Remove existing picker
  const existing = document.getElementById('fc-accent-picker');
  if (existing) { existing.remove(); return; }

  const unlocked   = _fcGetUnlockedAccents();
  const savedId    = _fcGetSavedAccent();
  const streak     = _fcGetStreak();
  const curStreak  = streak.current || 0;

  const picker = document.createElement('div');
  picker.id = 'fc-accent-picker';
  picker.className = 'fc-accent-picker';
  picker.innerHTML = `
    <div class="fc-accent-picker-header">
      <span>Card accent color</span>
      <button onclick="document.getElementById('fc-accent-picker').remove()" style="background:none;border:none;color:var(--text-4);cursor:pointer;padding:2px;line-height:0;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="fc-accent-grid">
      ${FC_ACCENTS.map(a => {
        const isUnlocked = a.unlocksAt <= curStreak;
        const isActive   = a.id === savedId;
        return `
        <button
          class="fc-accent-swatch ${isActive ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}"
          style="--swatch-color:${a.color};"
          onclick="${isUnlocked ? `window._fcSelectAccent('${a.id}')` : ''}"
          title="${isUnlocked ? a.name : 'Locked — ' + a.label}"
        >
          <div class="fc-accent-dot" style="background:${a.color};"></div>
          <span class="fc-accent-name">${a.name}</span>
          <span class="fc-accent-req">${isUnlocked ? (isActive ? '✓ Active' : 'Unlocked') : '🔒 ' + a.label}</span>
        </button>`;
      }).join('')}
    </div>
  `;

  // Insert inside a wrapper so position:absolute works correctly
  const widget = _el('fc-streak-widget');
  // Insert below fc-hero-top at full width
  const heroTop = document.querySelector('.fc-hero-top');
  if (heroTop) {
    heroTop.after(picker);
  } else if (widget) {
    widget.after(picker);
  } else {
    document.querySelector('.fc-hero')?.appendChild(picker);
  }

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!picker.contains(e.target) && e.target.id !== 'fc-streak-widget') {
        picker.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 10);
}

function _fcSelectAccent(id) {
  _fcApplyAccent(id);
  // Update active state in picker
  document.querySelectorAll('.fc-accent-swatch').forEach(el => {
    el.classList.toggle('active', el.querySelector('.fc-accent-name')?.textContent === FC_ACCENTS.find(a => a.id === id)?.name);
  });
  document.querySelectorAll('.fc-accent-swatch .fc-accent-req').forEach((el, i) => {
    const a = FC_ACCENTS[i];
    if (a.unlocksAt <= (_fcGetStreak().current || 0)) {
      el.textContent = a.id === id ? '✓ Active' : 'Unlocked';
    }
  });
}

// Apply saved accent on init — just sets the CSS variable
function _fcInitAccent() {
  _fcApplyAccent(_fcGetSavedAccent());
}

// Called after deck list renders so the widget is in DOM
function _fcBindAccentWidget() {
  const widget = _el('fc-streak-widget');
  if (!widget || widget.dataset.accentBound) return;
  widget.dataset.accentBound = '1';
  widget.style.cursor = 'pointer';
  widget.title = 'Tap to change accent color';
  widget.addEventListener('click', _fcOpenAccentPicker);
}

window._fcOpenAccentPicker = _fcOpenAccentPicker;
window._fcSelectAccent     = _fcSelectAccent;
window._fcInitAccent       = _fcInitAccent;
window._fcCheckNewAccentUnlock = _fcCheckNewAccentUnlock;
window.FC_ACCENTS          = FC_ACCENTS;

// ── Streak engine ─────────────────────────────────────────────────────────────
// localStorage key: chunks_fc_streak_v1
// Shape: { current, longest, lastStudyDate }

const STREAK_KEY = 'chunks_fc_streak_v1';

function _fcGetStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    return raw ? JSON.parse(raw) : { current: 0, longest: 0, lastStudyDate: null };
  } catch (e) {
    return { current: 0, longest: 0, lastStudyDate: null };
  }
}

function _fcSaveStreak(data) {
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(data)); } catch (e) {}
}

function _fcTodayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function _fcYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Called whenever a study session completes or any cards are rated
function _fcRecordStudyDay() {
  const today     = _fcTodayStr();
  const yesterday = _fcYesterdayStr();
  const streak    = _fcGetStreak();

  if (streak.lastStudyDate === today) {
    _fcRenderStreak();
    return;
  }

  const prevStreak = streak.current || 0;

  if (streak.lastStudyDate === yesterday) {
    streak.current++;
  } else {
    streak.current = 1;
  }

  streak.lastStudyDate = today;
  streak.longest = Math.max(streak.longest, streak.current);
  _fcSaveStreak(streak);
  _fcRenderStreak();

  // Check if new accent color was just unlocked
  _fcCheckNewAccentUnlock(prevStreak, streak.current);

  // Celebrate milestones
  const milestones = [3, 7, 14, 30, 60, 100];
  if (milestones.includes(streak.current)) {
    _fcShowStreakMilestone(streak.current);
  }
}

function _fcRenderStreak() {
  const streak      = _fcGetStreak();
  const today       = _fcTodayStr();
  const yesterday   = _fcYesterdayStr();
  const countEl     = _el('fc-streak-count');
  const statusEl    = _el('fc-streak-status');
  const fireEl      = _el('fc-streak-fire');
  const widgetEl    = _el('fc-streak-widget');

  if (!countEl) return;

  countEl.textContent = streak.current;

  // Check if studied today
  const studiedToday = streak.lastStudyDate === today;
  const studiedYest  = streak.lastStudyDate === yesterday;
  const neverStudied = !streak.lastStudyDate;

  if (streak.current === 0 || neverStudied) {
    if (statusEl) statusEl.textContent = 'Start your streak today!';
    if (fireEl)   fireEl.style.opacity = '0.35';
    if (widgetEl) widgetEl.classList.remove('fc-streak-active', 'fc-streak-danger');
  } else if (studiedToday) {
    if (statusEl) statusEl.textContent = '✓ Studied today';
    if (fireEl)   fireEl.style.opacity = '1';
    if (widgetEl) {
      widgetEl.classList.add('fc-streak-active');
      widgetEl.classList.remove('fc-streak-danger');
    }
  } else if (studiedYest) {
    if (statusEl) statusEl.textContent = '⚠ Study today to keep it!';
    if (fireEl)   fireEl.style.opacity = '0.6';
    if (widgetEl) {
      widgetEl.classList.add('fc-streak-danger');
      widgetEl.classList.remove('fc-streak-active');
    }
  } else {
    // Streak already broken
    if (statusEl) statusEl.textContent = 'Streak lost — start again!';
    if (fireEl)   fireEl.style.opacity = '0.2';
    if (widgetEl) widgetEl.classList.remove('fc-streak-active', 'fc-streak-danger');
    // Auto-reset broken streak display
    if (streak.current > 0 && streak.lastStudyDate !== today && streak.lastStudyDate !== yesterday) {
      streak.current = 0;
      _fcSaveStreak(streak);
      countEl.textContent = '0';
    }
  }

  // Update longest streak tooltip
  if (widgetEl && streak.longest > 0) {
    widgetEl.title = `Best streak: ${streak.longest} days`;
  }
}

function _fcShowStreakMilestone(days) {
  const messages = {
    3:   "🔥 3-day streak! You're building a habit!",
    7:   "🔥 One week streak! Incredible consistency!",
    14:  "🔥 Two weeks! You're unstoppable!",
    30:  "🏆 30-day streak! You are a studying machine!",
    60:  "🏆 60 days! Absolute legend!",
    100: "🏆 100-DAY STREAK! Hall of fame!",
  };
  const msg = messages[days] || `🔥 ${days}-day streak!`;
  window._showToast?.('🔥', msg, 'var(--gold)');
  // Also play a special sound
  setTimeout(() => window._fcSound?.combo(), 200);
}

window._fcRecordStudyDay = _fcRecordStudyDay;
window._fcRenderStreak   = _fcRenderStreak;

// ── Medical library loader ────────────────────────────────────────────────────

async function _fcLoadLibraryDecks() {
  try {
    const sb = await window._getChunksSb?.();
    if (!sb) return [];
    const { data, error } = await sb
      .from('fc_decks')
      .select('*')
      .eq('is_library', true)
      .order('system', { ascending: true })
      .limit(200);
    if (error || !data) return [];
    return data;
  } catch (e) { return []; }
}

// ── Mastery storage ──────────────────────────────────────────────────────────
// Simple localStorage key: chunks_fc_mastery_v1
// Shape: { [deck_id]: { easy, ok, hard, total, pct, lastStudied } }
// Written after every session. Read on deck list render. Always works.

const MASTERY_KEY = 'chunks_fc_mastery_v1';

function _fcGetMasteryStore() {
  try {
    return JSON.parse(localStorage.getItem(MASTERY_KEY) || '{}');
  } catch (e) { return {}; }
}

function _fcSaveMastery(deckId, stats, total) {
  const store = _fcGetMasteryStore();
  const easy  = stats.easy    || 0;
  const ok    = stats.ok      || 0;
  const hard  = stats.hard    || 0;
  const rated = easy + ok + hard;
  // Always use the latest session result — no blending
  const pct   = rated > 0 ? Math.min(100, Math.round(((easy + ok) / rated) * 100)) : 0;

  store[deckId] = { easy, ok, hard, rated, total, pct, lastStudied: new Date().toISOString() };
  try { localStorage.setItem(MASTERY_KEY, JSON.stringify(store)); } catch (e) {}
  return store[deckId];
}

async function _fcLoadMasteryMap(deckIds) {
  if (!deckIds.length) return {};
  const store = _fcGetMasteryStore();
  const map   = {};
  deckIds.forEach(id => {
    if (store[id]) map[id] = store[id];
  });
  return map;
}

async function _fcRenderDeckList() {
  const grid    = _el('fc-deck-grid');
  const empty   = _el('fc-empty-state');
  const counter = _el('fc-total-decks');
  if (!grid) return;

  const [userDecks, libraryDecks] = await Promise.all([
    window.FlashcardDB.fcLoadDecks(),
    _fcLoadLibraryDecks(),
  ]);

  // Load mastery data for user decks
  const deckIds = userDecks.filter(d => d.id).map(d => d.id);
  const masteryMap = await _fcLoadMasteryMap(deckIds);

  window._fcDecksCache   = userDecks;
  window._fcLibraryCache = libraryDecks;
  window._fcMasteryMap   = masteryMap;

  // Render streak widget then bind accent picker
  _fcRenderStreak();
  _fcBindAccentWidget();

  if (counter) counter.textContent = userDecks.length ? `${userDecks.length} deck${userDecks.length !== 1 ? 's' : ''}` : '';

  // Sidebar count + mini list
  const sideCount = _el('fc-deck-count');
  if (sideCount) sideCount.textContent = userDecks.length ? `${userDecks.length}` : '';

  const sideList = _el('fc-saved-decks-list');
  if (sideList) {
    sideList.innerHTML = userDecks.slice(0, 8).map((d, i) => `
      <div class="recent-item" onclick="_fcStartDeck(window._fcDecksCache[${i}])" title="${d.name}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.5;"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${d.name}</span>
        <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-4);flex-shrink:0;">${d.card_count || (d.cards && d.cards.length) || 0}</span>
      </div>`).join('');
  }

  // Build HTML: user decks + library sections
  let html = '';

  // User's own decks
  if (!userDecks.length && !libraryDecks.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  if (userDecks.length) {
    html += userDecks.map((d, i) => _fcDeckCardHTML(d, i, '_fcDecksCache', masteryMap[d.id])).join('');
  }

  // Medical library sections grouped by system — collapsible
  if (libraryDecks.length) {
    const bySystem = {};
    libraryDecks.forEach(d => {
      const sys = d.system || 'Medical Library';
      if (!bySystem[sys]) bySystem[sys] = [];
      bySystem[sys].push(d);
    });

    const systemCount = Object.keys(bySystem).length;
    html += `<div class="fc-library-divider">
      <span class="fc-library-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        Medical Library
      </span>
      <span class="fc-library-count">${libraryDecks.length} decks · ${systemCount} systems</span>
    </div>`;

    Object.entries(bySystem).forEach(([system, decks], sysIdx) => {
      const sysId  = 'fc-sys-' + system.replace(/\s+/g, '-').toLowerCase();
      const isOpen = sysIdx === 0;
      html += '<div class="fc-system-group">';
      html += '<button class="fc-system-toggle ' + (isOpen ? 'open' : '') + '" onclick="var el=document.getElementById(\'' + sysId + '\');var open=el.style.display!==\'none\';el.style.display=open?\'none\':\'grid\';this.classList.toggle(\'open\',!open);">';
      html += '<span class="fc-system-toggle-name">' + system + '</span>';
      html += '<span class="fc-system-toggle-meta">' + decks.length + ' deck' + (decks.length !== 1 ? 's' : '') + '</span>';
      html += '<svg class="fc-system-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>';
      html += '</button>';
      html += '<div id="' + sysId + '" class="fc-deck-grid fc-deck-grid-sub" style="display:' + (isOpen ? 'grid' : 'none') + '">';
      html += decks.map(function(d) {
        const globalIdx = libraryDecks.indexOf(d);
        return _fcDeckCardHTML(d, globalIdx, '_fcLibraryCache');
      }).join('');
      html += '</div></div>';
    });
  }

  grid.innerHTML = html;
}

function _fcDeckCardHTML(d, i, cacheKey, mastery) {
  const count     = d.card_count || (d.cards && d.cards.length) || 0;
  const created   = d.created_at
    ? new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const isLibrary = !!d.is_library;

  // Mastery bar
  const hasMastery = mastery && mastery.total > 0;
  const pct        = hasMastery ? mastery.pct : 0;
  const mastColor  = pct >= 80 ? 'var(--teal)' : pct >= 50 ? 'var(--gold)' : 'var(--violet)';
  const mastLabel  = hasMastery ? (pct === 100 ? '✓ Mastered' : pct + '% mastered') : '';
  const masteryBar = hasMastery ? (
    '<div class="fc-deck-mastery">' +
    '<div class="fc-deck-mastery-bar">' +
    '<div class="fc-deck-mastery-fill" style="width:' + pct + '%;background:' + mastColor + ';"></div>' +
    '</div>' +
    '<span class="fc-deck-mastery-label" style="color:' + mastColor + ';">' + mastLabel + '</span>' +
    '</div>'
  ) : '';

  const deleteBtn = isLibrary ? '' : (
    '<button class="fc-deck-delete" title="Delete deck" onclick="event.stopPropagation();_fcDeleteDeck(\'' + d.id + '\',\'' + d.name.replace(/'/g, "\'") + '\')">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
    '</button>'
  );

  const iconHtml = pct === 100
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>';

  const iconStyle = pct === 100 ? 'background:rgba(45,212,191,0.15);border-color:rgba(45,212,191,0.3);color:var(--teal);' : '';

  return (
    '<div class="fc-deck-card' + (isLibrary ? ' library' : '') + '" onclick="_fcStartDeck(window.' + cacheKey + '[' + i + '])">' +
    '<div class="fc-deck-card-inner">' +
    '<div class="fc-deck-icon" style="' + iconStyle + '">' + iconHtml + '</div>' +
    '<div class="fc-deck-info">' +
    '<div class="fc-deck-name">' + d.name + '</div>' +
    '<div class="fc-deck-meta">' +
    '<span>' + count + ' card' + (count !== 1 ? 's' : '') + '</span>' +
    (created ? '<span class="fc-meta-dot">·</span><span>' + created + '</span>' : '') +
    '</div>' +
    masteryBar +
    '</div>' +
    '<button class="fc-deck-start" onclick="event.stopPropagation();_fcStartDeck(window.' + cacheKey + '[' + i + '])">' +
    (pct === 100 ? 'Review' : 'Study') +
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>' +
    '</button>' +
    deleteBtn +
    '</div></div>'
  );
}



// ── Delete deck ───────────────────────────────────────────────────────────────

async function _fcDeleteDeck(deckId, deckName) {
  const confirmed = await new Promise(resolve => {
    if (window.showConfirmModal) {
      window.showConfirmModal({
        title:        'Delete deck?',
        desc:         `"${deckName}" and all its cards will be permanently deleted.`,
        confirmLabel: 'Delete',
        onConfirm:    () => resolve(true),
      });
      // resolve false if modal is dismissed without confirming
      const orig = window.closeConfirmModal;
      window.closeConfirmModal = function() {
        resolve(false);
        window.closeConfirmModal = orig;
        orig();
      };
    } else {
      resolve(confirm(`Delete "${deckName}"?`));
    }
  });
  if (!confirmed) return;

  // Remove from localStorage
  const decks    = window.FlashcardDB.FC_LS_KEY
    ? JSON.parse(localStorage.getItem(window.FlashcardDB.FC_LS_KEY) || '[]')
    : [];
  const filtered = decks.filter(d => d.id !== deckId);
  localStorage.setItem(window.FlashcardDB.FC_LS_KEY, JSON.stringify(filtered));

  // Remove from Supabase using ChunksDB.remove
  try {
    if (window.ChunksDB?.isLoggedIn()) {
      // Delete cards first (foreign key), then deck
      const sb = await window._getChunksSb?.();
      if (sb) {
        await sb.from('fc_cards').delete().eq('deck_id', deckId);
      }
      await window.ChunksDB.remove('fc_decks', deckId);
    }
  } catch (e) {
    console.warn('[flashState] delete error:', e.message);
  }

  window._showToast?.('✓', `"${deckName}" deleted`, 'var(--text-3)');
  _fcRenderDeckList();
}

// ── PDF upload → flashcard deck ───────────────────────────────────────────────

function _fcOpenPdfUpload() {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = '.pdf,.pptx,.docx';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) _fcProcessUploadedFile(file);
  };
  input.click();
}

async function _fcProcessUploadedFile(file) {
  const topicName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

  // Show loading state
  _fcSetGenBusy(true, topicName);
  _fcShowError('');

  try {
    // Step 1: Upload and extract text from file
    window._showToast?.('⏳', `Extracting text from ${file.name}…`, 'var(--text-3)');

    const formData = new FormData();
    formData.append('file', file);

    const uploadRes = await fetch(`${window.API_BASE}/upload-document`, {
      method: 'POST',
      body:   formData,
    });
    const uploadData = await uploadRes.json();

    if (!uploadRes.ok || !uploadData.success) {
      throw new Error(uploadData.error || 'Failed to extract text from file');
    }

    const slides = uploadData.slides || [];
    if (!slides.length) throw new Error('No readable content found in file');

    // Step 2: Generate flashcards from extracted content
    window._showToast?.('⚡', 'Generating flashcards from your file…', 'var(--gold)');

    const matRes = await fetch(`${window.API_BASE}/generate-study-materials`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ slides, type: 'flashcards' }),
    });
    const matData = await matRes.json();

    if (!matRes.ok || !matData.success) {
      throw new Error(matData.error || 'Failed to generate flashcards');
    }

    // Step 3: Parse the flashcard text into front/back pairs
    const rawText = matData.materials?.flashcards || '';
    const cards   = _fcParseUploadedCards(rawText);

    if (!cards.length) throw new Error('Could not parse flashcards from file');

    // Step 4: Save deck
    const deck = await window.FlashcardDB.fcSaveDeck(topicName, cards);
    _fcSetGenBusy(false);

    window._showToast?.('✦', `${cards.length} cards created from "${file.name}"`, 'var(--gold)');
    await _fcRenderDeckList();
    _fcStartDeck(deck);

  } catch (err) {
    _fcSetGenBusy(false);
    _fcShowError(err.message || 'Upload failed. Please try again.');
    console.error('[flashState] upload error:', err);
  }
}

function _fcParseUploadedCards(rawText) {
  const cards = [];
  // Parse CARD N / Q: / A: format from /generate-study-materials
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
  // Fallback: try FRONT/BACK format
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
  return cards.slice(0, 50); // cap at 50
}

// ── Generation ────────────────────────────────────────────────────────────────

async function _fcGenerateFromBar() {
  const topicEl = _el('fc-topic-input');
  const countEl = _el('fc-count-input');
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
    const res  = await fetch(`${window.API_BASE}/generate-flashcards`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
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

    const deck = await window.FlashcardDB.fcSaveDeck(topic, cards);

    topicEl.value = '';
    _fcSetGenBusy(false);
    window._showToast?.('✦', `${cards.length} cards created — "${topic}"`, 'var(--gold)');

    await _fcRenderDeckList();
    _fcStartDeck(deck);

  } catch (err) {
    _fcSetGenBusy(false);
    _fcShowError(err.message || 'Generation failed. Please try again.');
    console.error('[flashState] generate error:', err);
  }
}

// ── Start a study session ─────────────────────────────────────────────────────

async function _fcStartDeck(deck, hardOnly) {
  if (!deck) return;

  const cards = await window.FlashcardDB.fcLoadCards(deck);
  if (!cards.length) {
    window._showToast?.('!', 'This deck has no cards.', 'var(--text-3)');
    return;
  }

  let studyCards = hardOnly
    ? cards.filter((_, i) => _fcRatings[i]?.rating === 'hard')
    : [...cards];

  if (hardOnly && !studyCards.length) {
    window._showToast?.('✓', 'No hard cards to review!', 'var(--teal)');
    return;
  }

  // Shuffle cards every session — Fisher-Yates
  for (let i = studyCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [studyCards[i], studyCards[j]] = [studyCards[j], studyCards[i]];
  }

  _fcDeck            = studyCards;
  _fcIndex           = 0;
  _fcFlipped         = false;
  _fcHardOnly        = !!hardOnly;
  _fcStats           = { easy: 0, ok: 0, hard: 0, skipped: 0 };
  _fcRatings         = [];
  _fcCurrentDeckMeta = { id: deck.id, name: deck.name };

  _fcShowView('study');
  _fcRenderCard();

  const nameEl = _el('fc-deck-name-label');
  if (nameEl) nameEl.textContent = deck.name;

  _fcBindKeyboard();
}

// ── Card rendering ────────────────────────────────────────────────────────────

function _fcRenderCard() {
  const card = _fcDeck[_fcIndex];
  if (!card) return;

  _fcFlipped = false;
  const cardEl = _el('fc-card');
  if (cardEl) cardEl.classList.remove('fc-card--flipped');

  // Always hide tutor panel when moving to a new card
  const tutorPanel = _el('fc-tutor-panel');
  if (tutorPanel) {
    tutorPanel.style.display = 'none';
    const tutorText = _el('fc-tutor-text');
    const tutorLoading = _el('fc-tutor-loading');
    if (tutorText)    tutorText.textContent = '';
    if (tutorLoading) tutorLoading.style.display = '';
  }
  if (window._fcTutorAbort) {
    window._fcTutorAbort.abort();
    window._fcTutorAbort = null;
  }

  const q = _el('fc-card-question');
  const a = _el('fc-card-answer');
  if (q) q.textContent = card.front || card.question || '';
  if (a) a.textContent = card.back  || card.answer   || '';

  // Progress: show cards completed out of total (current card = current index + 1)
  const total   = _fcDeck.length;
  const current = _fcIndex + 1;
  const pct     = (current / total) * 100;

  const labelEl = _el('fc-card-label');
  const fillEl  = _el('fc-progress-fill');
  const statsEl = _el('fc-progress-stats');
  if (labelEl) labelEl.textContent = `Card ${current} of ${total}`;
  if (fillEl)  fillEl.style.width  = `${pct}%`;
  if (statsEl) {
    const { easy, ok, hard } = _fcStats;
    const rated = easy + ok + hard;
    statsEl.textContent = rated ? `${easy} easy · ${ok} ok · ${hard} hard` : '';
  }

  const hint    = _el('fc-pre-flip-hint');
  const ratings = _el('fc-rating-row');
  if (hint)    hint.style.display    = '';
  if (ratings) ratings.style.display = 'none';
}

function _fcFlip() {
  _fcFlipped = !_fcFlipped;

  // Subtle click on flip
  _fcSound.flip();

  const cardEl = _el('fc-card');
  if (cardEl) cardEl.classList.toggle('fc-card--flipped', _fcFlipped);

  const hint    = _el('fc-pre-flip-hint');
  const ratings = _el('fc-rating-row');
  if (hint)    hint.style.display    = _fcFlipped ? 'none' : '';
  if (ratings) ratings.style.display = _fcFlipped ? ''     : 'none';
}

// ── Advance ───────────────────────────────────────────────────────────────────


// ── Sound engine (Web Audio API) ──────────────────────────────────────────────

const _fcSound = (() => {
  let _ctx = null;
  let _muted = false;

  function _getCtx() {
    if (!_ctx) {
      try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e) { return null; }
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  // Core tone player
  function _play(type, freq, duration, volume = 0.3, freqEnd = null, delay = 0) {
    if (_muted) return;
    const ctx = _getCtx();
    if (!ctx) return;

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + delay + duration);

    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  }

  return {
    // ✓ Easy — bright ascending chime (two-tone like a win)
    easy() {
      _play('sine', 523, 0.12, 0.25);           // C5
      _play('sine', 784, 0.18, 0.3,  880, 0.1); // G5 → A5
      _play('sine', 1047, 0.22, 0.28, null, 0.22); // C6 sparkle
    },

    // ◐ Got it — soft neutral single tone
    ok() {
      _play('sine', 440, 0.15, 0.2, 466, 0); // A4 slight rise
    },

    // ✕ Hard — low soft thud, not punishing
    hard() {
      _play('triangle', 180, 0.18, 0.15, 140, 0);
      _play('sine',     220, 0.12, 0.12, null, 0.05);
    },

    // Every 5 cards — combo chime
    combo() {
      _play('sine', 523,  0.1,  0.2, null, 0);
      _play('sine', 659,  0.1,  0.2, null, 0.08);
      _play('sine', 784,  0.1,  0.2, null, 0.16);
      _play('sine', 1047, 0.18, 0.3, null, 0.24);
    },

    // Deck complete — full celebration fanfare
    complete() {
      _play('sine', 523,  0.12, 0.25, null, 0);
      _play('sine', 659,  0.12, 0.25, null, 0.1);
      _play('sine', 784,  0.12, 0.25, null, 0.2);
      _play('sine', 1047, 0.12, 0.25, null, 0.3);
      _play('sine', 1319, 0.3,  0.5,  null, 0.42);
    },

    // Flip card — subtle soft click
    flip() {
      _play('sine', 800, 0.04, 0.06, 600, 0);
    },

    mute()   { _muted = true;  },
    unmute() { _muted = false; },
    toggle() { _muted = !_muted; return _muted; },
    isMuted() { return _muted; },
  };
})();

window._fcSound = _fcSound;

function _fcNext(rating) {
  if (!_fcFlipped && rating !== 'skipped') {
    _fcFlip();
    return;
  }

  const card = _fcDeck[_fcIndex];
  _fcRatings.push({ card_id: card?.id || null, rating });
  if (rating !== 'skipped') _fcStats[rating] = (_fcStats[rating] || 0) + 1;

  // Play sound for rating
  if (rating === 'easy')    _fcSound.easy();
  else if (rating === 'ok') _fcSound.ok();
  else if (rating === 'hard') _fcSound.hard();

  // Combo sound every 5 rated cards
  const rated = (_fcStats.easy || 0) + (_fcStats.ok || 0) + (_fcStats.hard || 0);
  if (rated > 0 && rated % 5 === 0 && rating !== 'skipped') {
    setTimeout(() => _fcSound.combo(), 180);
  }

  // Show AI tutor explanation on Hard — don't advance yet
  if (rating === 'hard' && card) {
    _fcShowTutor(card);
    return;
  }

  _fcAdvance();
}

function _fcAdvance() {
  _fcIndex++;
  if (_fcIndex >= _fcDeck.length) {
    _fcFinishSession();
  } else {
    _fcRenderCard();
  }
}

function _fcDismissTutor() {
  const panel = _el('fc-tutor-panel');
  if (panel) {
    panel.style.display = 'none';
    panel.classList.remove('fc-tutor-visible');
  }
  // Cancel any in-flight request
  if (window._fcTutorAbort) {
    window._fcTutorAbort.abort();
    window._fcTutorAbort = null;
  }
  _fcAdvance();
}

async function _fcShowTutor(card) {
  const panel   = _el('fc-tutor-panel');
  const loading = _el('fc-tutor-loading');
  const text    = _el('fc-tutor-text');
  if (!panel || !loading || !text) { _fcAdvance(); return; }

  // Show panel in loading state
  panel.style.display = '';
  loading.style.display = '';
  text.style.display = 'none';
  text.textContent = '';

  // Scroll panel into view smoothly
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);

  // Cancel previous request if any
  if (window._fcTutorAbort) window._fcTutorAbort.abort();
  window._fcTutorAbort = new AbortController();

  try {
    const prompt = `A student just marked this flashcard as HARD (they struggled with it).

Question: ${card.front || card.question || ''}
Correct Answer: ${card.back || card.answer || ''}

Give a brief, helpful explanation in 2-3 sentences:
1. Why the answer is correct (the key concept to remember)
2. What students commonly confuse or get wrong about this
3. One quick memory trick or mnemonic if possible

Be warm, encouraging, and concise. No bullet points — write naturally like a tutor talking to a student.`;

    const res = await fetch(`${window.API_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: window._fcTutorAbort.signal,
      body: JSON.stringify({
        question:   prompt,
        mode:       'study',
        complexity: 5,
        bookId:     'netter',
      }),
    });

    const data = await res.json();
    const explanation = data.answer || data.response || '';

    if (explanation) {
      loading.style.display = 'none';
      text.style.display = '';
      // Typewriter effect
      text.textContent = '';
      const words = explanation.split(' ');
      let i = 0;
      const typeInterval = setInterval(() => {
        if (i >= words.length) { clearInterval(typeInterval); return; }
        text.textContent += (i > 0 ? ' ' : '') + words[i];
        i++;
      }, 40);
    } else {
      _fcDismissTutor();
    }

  } catch (err) {
    if (err.name === 'AbortError') return;
    console.warn('[flashState] tutor error:', err.message);
    // Silently advance if AI call fails
    const panel = _el('fc-tutor-panel');
    if (panel) panel.style.display = 'none';
    _fcAdvance();
  }
}

// ── Session completion ────────────────────────────────────────────────────────

async function _fcFinishSession() {
  // Record study day for streak
  _fcRecordStudyDay();

  // Save mastery to localStorage immediately
  if (_fcCurrentDeckMeta?.id) {
    _fcSaveMastery(_fcCurrentDeckMeta.id, _fcStats, _fcDeck.length);
  }

  // Play celebration fanfare
  _fcSound.complete();

  try {
    await window.FlashcardDB.fcSaveSession({
      deckId:      _fcCurrentDeckMeta?.id   || null,
      deckName:    _fcCurrentDeckMeta?.name || 'Untitled',
      stats:       _fcStats,
      cardRatings: _fcRatings,
      deck:        _fcDeck,
    });
  } catch (e) {
    console.warn('[flashState] session save error:', e);
  }

  const { easy, ok, hard, skipped } = _fcStats;
  const total = _fcDeck.length;
  const score = total ? Math.min(100, Math.round(((easy + ok) / total) * 100)) : 0;

  // Fill stat numbers
  [['easy', easy], ['ok', ok], ['hard', hard], ['skipped', skipped]].forEach(([k, v]) => {
    const el = _el(`fc-stat-${k}`);
    if (el) el.textContent = v;
  });

  // Headline
  const emojiEl = _el('fc-complete-emoji');
  const titleEl = _el('fc-complete-title');
  const subEl   = _el('fc-complete-sub');
  if (score >= 80) {
    if (emojiEl) emojiEl.textContent = '🏆';
    if (titleEl) titleEl.textContent = 'Outstanding!';
    if (subEl)   subEl.textContent   = `You nailed ${score}% of this deck — incredible work.`;
  } else if (score >= 50) {
    if (emojiEl) emojiEl.textContent = '⚡';
    if (titleEl) titleEl.textContent = 'Good progress!';
    if (subEl)   subEl.textContent   = `${score}% solid — keep it up and you'll master it.`;
  } else {
    if (emojiEl) emojiEl.textContent = '💪';
    if (titleEl) titleEl.textContent = 'Keep studying!';
    if (subEl)   subEl.textContent   = `${score}% — every pass through gets easier.`;
  }

  // SRS note
  const srsEl  = _el('fc-modal-srs-note');
  const srsMsg = _el('fc-srs-message');
  if (hard > 0 && srsEl && srsMsg) {
    srsEl.style.display = '';
    srsMsg.textContent  = `${hard} hard card${hard !== 1 ? 's' : ''} will be prioritised in your next session.`;
  } else if (srsEl) {
    srsEl.style.display = 'none';
  }

  // Hard-only button
  const hardBtn = _el('fc-study-hard-btn');
  if (hardBtn) hardBtn.style.display = hard > 0 ? '' : 'none';

  _fcRemoveKeyboard();

  const modal = _el('fc-complete-modal');
  if (modal) modal.style.display = '';
}

// ── Modal actions ─────────────────────────────────────────────────────────────

function _fcRestartDeck() {
  _fcCloseCompleteModal();
  const deck = window._fcDecksCache?.find(d => d.id === _fcCurrentDeckMeta?.id);
  if (deck) _fcStartDeck(deck, false);
}

function _fcStudyHardOnly() {
  _fcCloseCompleteModal();
  const deck = window._fcDecksCache?.find(d => d.id === _fcCurrentDeckMeta?.id);
  if (deck) _fcStartDeck(deck, true);
}

function _fcCreateNew() {
  _fcCloseCompleteModal();
  _fcExitStudy();
  setTimeout(() => _el('fc-topic-input')?.focus(), 100);
}

function _fcCloseCompleteModal() {
  const modal = _el('fc-complete-modal');
  if (modal) modal.style.display = 'none';
}

function _fcExitStudy() {
  _fcRemoveKeyboard();
  _fcCloseCompleteModal();
  _fcShowView('home');
  _fcRenderDeckList();
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

function _fcKeyHandler(e) {
  const study = _el('fc-study');
  if (!study || study.style.display === 'none') return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    _fcFlip();
    return;
  }
  if (_fcFlipped) {
    if (e.key === '1') _fcNext('hard');
    if (e.key === '2') _fcNext('ok');
    if (e.key === '3') _fcNext('easy');
    if (e.key === 'ArrowRight') _fcNext('ok');
    if (e.key === 'Escape') _fcExitStudy();
  }
}

function _fcBindKeyboard()   { document.addEventListener('keydown', _fcKeyHandler); }
function _fcRemoveKeyboard() { document.removeEventListener('keydown', _fcKeyHandler); }

// ── Workspace integration ─────────────────────────────────────────────────────

async function wsMakeFlashcard(el) {
  const topic = el?.dataset?.topic || '';
  if (!topic) return;
  if (window.showScreen) window.showScreen('flash');
  const input = _el('fc-topic-input');
  if (input) {
    input.value = topic;
    setTimeout(() => _fcGenerateFromBar(), 200);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function _fcInit() {
  _fcInitAccent();
  _fcRenderDeckList();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _fcInit);
} else {
  _fcInit();
}

// ── Window exports ────────────────────────────────────────────────────────────


// ── Edit card ─────────────────────────────────────────────────────────────────

let _fcEditSide = 'front'; // 'front' or 'back'

function _fcOpenEditCard(side) {
  _fcEditSide = side;
  const card    = _fcDeck[_fcIndex];
  if (!card) return;

  const overlay  = _el('fc-edit-overlay');
  const textarea = _el('fc-edit-textarea');
  const label    = _el('fc-edit-label');
  if (!overlay || !textarea) return;

  const text = side === 'front'
    ? (card.front || card.question || '')
    : (card.back  || card.answer   || '');

  if (label) label.textContent = side === 'front' ? 'Edit question' : 'Edit answer';
  textarea.value = text;
  overlay.style.display = 'flex';
  setTimeout(() => textarea.focus(), 50);
}

function _fcCloseEditCard() {
  const overlay = _el('fc-edit-overlay');
  if (overlay) overlay.style.display = 'none';
}

async function _fcSaveEditCard() {
  const textarea = _el('fc-edit-textarea');
  if (!textarea) return;

  const newText = textarea.value.trim();
  if (!newText) return;

  const card = _fcDeck[_fcIndex];
  if (!card) return;

  // Update in-memory deck
  if (_fcEditSide === 'front') {
    card.front    = newText;
    card.question = newText;
    const q = _el('fc-card-question');
    if (q) q.textContent = newText;
  } else {
    card.back   = newText;
    card.answer = newText;
    const a = _el('fc-card-answer');
    if (a) a.textContent = newText;
  }

  // Update in localStorage deck cache
  try {
    const lsKey = window.FlashcardDB?.FC_LS_KEY;
    if (lsKey) {
      const decks = JSON.parse(localStorage.getItem(lsKey) || '[]');
      const deckIdx = decks.findIndex(d => d.id === _fcCurrentDeckMeta?.id);
      if (deckIdx >= 0 && decks[deckIdx].cards) {
        const cardIdx = decks[deckIdx].cards.findIndex(
          c => (c.front || c.question) === (_fcEditSide === 'front'
            ? (card.front || card.question)
            : '') || c.id === card.id
        );
        if (cardIdx >= 0) {
          decks[deckIdx].cards[cardIdx] = { ...decks[deckIdx].cards[cardIdx], ...card };
        }
        localStorage.setItem(lsKey, JSON.stringify(decks));
      }
    }
  } catch (e) {}

  // Update in Supabase if card has an ID
  if (card.id) {
    try {
      const sb = await window._getChunksSb?.();
      if (sb) {
        await sb.from('fc_cards').update({
          front: card.front || card.question || '',
          back:  card.back  || card.answer   || '',
        }).eq('id', card.id);
      }
    } catch (e) {
      console.warn('[flashState] card update error:', e.message);
    }
  }

  _fcCloseEditCard();
  window._showToast?.('✓', 'Card updated', 'var(--teal)');
}

window._fcOpenEditCard  = _fcOpenEditCard;
window._fcCloseEditCard = _fcCloseEditCard;
window._fcSaveEditCard  = _fcSaveEditCard;

window._fcDeleteDeck         = _fcDeleteDeck;
window._fcDismissTutor        = _fcDismissTutor;
window._fcOpenPdfUpload      = _fcOpenPdfUpload;
window._fcGenerateFromBar    = _fcGenerateFromBar;
window._fcNext               = _fcNext;
window._fcFlip               = _fcFlip;
window._fcRestartDeck        = _fcRestartDeck;
window._fcStudyHardOnly      = _fcStudyHardOnly;
window._fcCreateNew          = _fcCreateNew;
window._fcExitStudy          = _fcExitStudy;
window._fcCloseCompleteModal = _fcCloseCompleteModal;
window._fcStartDeck          = _fcStartDeck;
window._fcRenderDeckList     = _fcRenderDeckList;
window.wsMakeFlashcard       = wsMakeFlashcard;

console.log('[flashState] state engine ready ✦');
