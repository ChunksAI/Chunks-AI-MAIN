/**
 * src/state/flash/decks.js — Deck loading, rendering, management
 */

import { $el, setText, setHtml, show, hide, toggleClass } from '../domHelpers.js';
import { MASTERY_KEY } from './state.js';
import { _fcRenderStreak } from './streak.js';
import { _fcStartDeck } from './session.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { FlashcardDB } from '../../lib/flashcardDb.js';
import { showConfirmModal, closeConfirmModal } from '../../components/ConfirmModal.js';
import { ChunksDB } from '../../lib/chunksDb.js';
import { showToast } from '../../components/Toast.js';

export let _fcDecksCache = null;
export let _fcLibraryCache = null;
export let _fcMasteryMap = null;

// ── Cache lookup for dynamic data-deck-cache attributes ─────────────────────

const _fcCacheMap = { _fcDecksCache: () => _fcDecksCache, _fcLibraryCache: () => _fcLibraryCache };

function _fcGetCachedDeck(cacheKey, idx) {
  return _fcCacheMap[cacheKey]?.()?.[idx] ?? null;
}

// ── Medical library loader ──────────────────────────────────────────────────

async function _fcLoadLibraryDecks() {
  try {
    const sb = await getSupabaseClient?.();
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

// ── Mastery storage ─────────────────────────────────────────────────────────

export function _fcGetMasteryStore() {
  try {
    return JSON.parse(localStorage.getItem(MASTERY_KEY) || '{}');
  } catch (e) { return {}; }
}

export function _fcSaveMastery(deckId, stats, total) {
  const store = _fcGetMasteryStore();
  const easy  = stats.easy    || 0;
  const ok    = stats.ok      || 0;
  const hard  = stats.hard    || 0;
  const rated = easy + ok + hard;
  const pct   = rated > 0 ? Math.min(100, Math.round(((easy + ok) / rated) * 100)) : 0;

  store[deckId] = { easy, ok, hard, rated, total, pct, lastStudied: new Date().toISOString() };
  try { localStorage.setItem(MASTERY_KEY, JSON.stringify(store)); } catch (e) {}
  return store[deckId];
}

export async function _fcLoadMasteryMap(deckIds) {
  if (!deckIds.length) return {};
  const store = _fcGetMasteryStore();
  const map   = {};
  deckIds.forEach(id => {
    if (store[id]) map[id] = store[id];
  });
  return map;
}

// ── Deck list rendering ─────────────────────────────────────────────────────

export async function _fcRenderDeckList() {
  const grid    = $el('fc-deck-grid');
  const empty   = $el('fc-empty-state');
  const counter = $el('fc-total-decks');
  if (!grid) return;

  const [userDecks, libraryDecks] = await Promise.all([
    FlashcardDB.fcLoadDecks(),
    _fcLoadLibraryDecks(),
  ]);

  const deckIds    = userDecks.filter(d => d.id).map(d => d.id);
  const masteryMap = await _fcLoadMasteryMap(deckIds);

  _fcDecksCache   = userDecks;
  _fcLibraryCache = libraryDecks;
  _fcMasteryMap   = masteryMap;

  _fcRenderStreak();

  setText(counter, userDecks.length ? `${userDecks.length} deck${userDecks.length !== 1 ? 's' : ''}` : '');

  let html = '';

  if (!userDecks.length && !libraryDecks.length) {
    setHtml(grid, '');
    show(empty);
    return;
  }
  hide(empty);

  if (userDecks.length) {
    html += userDecks.map((d, i) => _fcDeckCardHTML(d, i, '_fcDecksCache', masteryMap[d.id])).join('');
  }

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
      html += '<button class="fc-system-toggle ' + (isOpen ? 'open' : '') + '" data-sys-id="' + sysId + '">';
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

  setHtml(grid, html);

  grid.addEventListener('click', function _deckGridClick(e) {
    const toggleBtn = e.target.closest('.fc-system-toggle[data-sys-id]');
    if (toggleBtn) {
      const sysId = toggleBtn.dataset.sysId;
      const el    = $el(sysId);
      if (el) {
        const isOpen = el.style.display !== 'none';
        el.style.display = isOpen ? 'none' : 'grid';
        toggleClass(toggleBtn, 'open', !isOpen);
      }
      return;
    }
    const deleteBtn = e.target.closest('.fc-deck-delete[data-deck-id]');
    if (deleteBtn) {
      e.stopPropagation();
      const deckId   = deleteBtn.dataset.deckId;
      const cacheKey = deleteBtn.dataset.deckCache;
      const idx      = parseInt(deleteBtn.dataset.deckIdx, 10);
      const deck     = _fcGetCachedDeck(cacheKey, idx);
      const deckName = deck?.name || deckId;
      _fcDeleteDeck(deckId, deckName);
      return;
    }
    const startBtn = e.target.closest('.fc-deck-start[data-deck-cache]');
    if (startBtn) {
      e.stopPropagation();
      const cacheKey = startBtn.dataset.deckCache;
      const idx      = parseInt(startBtn.dataset.deckIdx, 10);
      const deck     = _fcGetCachedDeck(cacheKey, idx);
      if (deck) _fcStartDeck(deck);
      return;
    }
    const card = e.target.closest('.fc-deck-card[data-deck-cache]');
    if (card) {
      const cacheKey = card.dataset.deckCache;
      const idx      = parseInt(card.dataset.deckIdx, 10);
      const deck     = _fcGetCachedDeck(cacheKey, idx);
      if (deck) _fcStartDeck(deck);
    }
  }, { once: false });
}

export function _fcDeckCardHTML(d, i, cacheKey, mastery) {
  const count     = d.card_count || (d.cards && d.cards.length) || 0;
  const created   = d.created_at
    ? new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const isLibrary = !!d.is_library;

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
    '<button class="fc-deck-delete" title="Delete deck" data-deck-id="' + d.id + '" data-deck-idx="' + i + '" data-deck-cache="' + cacheKey + '">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
    '</button>'
  );

  const iconHtml = pct === 100
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>';

  const iconStyle = pct === 100 ? 'background:rgba(45,212,191,0.15);border-color:rgba(45,212,191,0.3);color:var(--teal);' : '';

  return (
    '<div class="fc-deck-card' + (isLibrary ? ' library' : '') + '" data-deck-idx="' + i + '" data-deck-cache="' + cacheKey + '">' +
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
    '<button class="fc-deck-start" data-deck-idx="' + i + '" data-deck-cache="' + cacheKey + '">' +
    (pct === 100 ? 'Review' : 'Study') +
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>' +
    '</button>' +
    deleteBtn +
    '</div></div>'
  );
}

// ── Delete deck ─────────────────────────────────────────────────────────────

export async function _fcDeleteDeck(deckId, deckName) {
  const confirmed = await new Promise(resolve => {
    if (showConfirmModal) {
      showConfirmModal({
        title:        'Delete deck?',
        desc:         `"${deckName}" and all its cards will be permanently deleted.`,
        confirmLabel: 'Delete',
        onConfirm:    () => resolve(true),
      });
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

  const decks    = FlashcardDB.FC_LS_KEY
    ? JSON.parse(localStorage.getItem(FlashcardDB.FC_LS_KEY) || '[]')
    : [];
  const filtered = decks.filter(d => d.id !== deckId);
  localStorage.setItem(FlashcardDB.FC_LS_KEY, JSON.stringify(filtered));

  try {
    if (ChunksDB?.isLoggedIn()) {
      const sb = await getSupabaseClient?.();
      if (sb) {
        await sb.from('fc_cards').delete().eq('deck_id', deckId);
      }
      await ChunksDB.remove('fc_decks', deckId);
    }
  } catch (e) {
    console.warn('[flashState] delete error:', e.message);
  }

  showToast?.('✓', `"${deckName}" deleted`, 'var(--text-3)');
  _fcRenderDeckList();
}

export { _fcLoadLibraryDecks };
