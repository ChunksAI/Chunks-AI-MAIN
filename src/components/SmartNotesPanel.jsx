
// @ts-nocheck
/**
 * src/components/SmartNotesPanel.jsx — Smart Notes Panel island + Sticky Strip island
 *
 * SmartNotesPanel:
 *  • Auto-save indicator ("Saved" / "Saving…") with debounce
 *  • Format toolbar: Bold, Italic, Underline, Highlight, Bullet, Heading, Pin Sticky
 *  • Clip from AI banner (dismissable, clips a formatted block)
 *  • ContentEditable notes area with lined/ruled aesthetic + per-page Map storage
 *  • Send to AI bar — shows selected text, activates Ask AI
 *
 * StickyStrip:
 *  • 36px column on right edge of the PDF panel
 *  • Colored pins (yellow / green) per page
 *  • Clicking a pin opens a Patrick-Hand textarea popup
 *  • "+" button adds a new sticky; stickies are page-specific
 *
 * Both components poll window.ws.currentPage every 300 ms to react to
 * page navigation without requiring a global event system.
 *
 * Mount helpers exported at the bottom are called from WorkspaceScreen.js.
 */

import { h, Fragment, render } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

// ── Storage keys + constants ────────────────────────────────────────────────

const NOTES_KEY    = 'chunks-ai-notes-v2';
const STICKIES_KEY = 'chunks-ai-stickies-v1';
const SAVE_DELAY   = 600; // ms debounce before writing to localStorage
const PIN_COLORS   = ['#fbbf24', '#34d399']; // yellow, green

// ── Supabase helpers (lazy-loaded) ──────────────────────────────────────────

/** @returns {Promise<import('@supabase/supabase-js').SupabaseClient|null>} */
async function _sb() {
  try {
    const { getSupabaseClient } = await import('../lib/supabase.js');
    return await getSupabaseClient();
  } catch (_) { return null; }
}

function _uid() {
  return window._currentUser?.id || null;
}

function _isLoggedIn() {
  return !!_uid();
}

// ── Supabase sticky_notes sync layer ────────────────────────────────────────

/**
 * Load all sticky notes for the current document from Supabase.
 * Returns a Map<pageNumber, Array<sticky>> or null if unavailable.
 */
async function loadStickiesFromSupabase(documentId) {
  if (!_isLoggedIn() || !documentId) return null;
  const sb = await _sb();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('sticky_notes')
      .select('*')
      .eq('user_id', _uid())
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });
    if (error || !data) return null;
    const map = new Map();
    for (const row of data) {
      const pg = row.page_number || 1;
      const arr = map.get(pg) || [];
      arr.push({ id: row.id, color: row.color || '#fbbf24', text: row.content || '' });
      map.set(pg, arr);
    }
    return map;
  } catch (_) { return null; }
}

/**
 * Upsert a single sticky note to Supabase (fire-and-forget).
 */
async function upsertStickyToSupabase(sticky, documentId, pageNumber) {
  if (!_isLoggedIn() || !documentId) return;
  // Skip numeric IDs (created as guest via Date.now()) — they can't be Supabase UUIDs.
  // These will be synced on next full load from Supabase.
  if (typeof sticky.id === 'number') return;
  const sb = await _sb();
  if (!sb) return;
  try {
    await sb.from('sticky_notes').upsert({
      id:          sticky.id,
      user_id:     _uid(),
      document_id: documentId,
      page_number: pageNumber,
      content:     sticky.text || '',
      color:       sticky.color || 'yellow',
    }, { onConflict: 'id' });
  } catch (_) {}
}

/**
 * Delete a sticky note from Supabase (fire-and-forget).
 */
async function deleteStickyFromSupabase(stickyId) {
  if (!_isLoggedIn() || typeof stickyId !== 'string') return;
  const sb = await _sb();
  if (!sb) return;
  try {
    await sb.from('sticky_notes').delete()
      .eq('id', stickyId)
      .eq('user_id', _uid());
  } catch (_) {}
}

// ── Storage helpers (localStorage fallback) ─────────────────────────────────

function loadNotesMap() {
  try { return new Map(JSON.parse(localStorage.getItem(NOTES_KEY) || '[]')); }
  catch (_) { return new Map(); }
}

function saveNotesMap(map) {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify([...map])); }
  catch (_) {}
}

function loadStickiesMap() {
  try { return new Map(JSON.parse(localStorage.getItem(STICKIES_KEY) || '[]')); }
  catch (_) { return new Map(); }
}

function saveStickiesMap(map) {
  try { localStorage.setItem(STICKIES_KEY, JSON.stringify([...map])); }
  catch (_) {}
}

// ── SVG helpers ─────────────────────────────────────────────────────────────

const IconBullet = () => h('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' },
  h('line', { x1: '9', y1: '6', x2: '20', y2: '6' }),
  h('line', { x1: '9', y1: '12', x2: '20', y2: '12' }),
  h('line', { x1: '9', y1: '18', x2: '20', y2: '18' }),
  h('circle', { cx: '4', cy: '6', r: '1.5', fill: 'currentColor', stroke: 'none' }),
  h('circle', { cx: '4', cy: '12', r: '1.5', fill: 'currentColor', stroke: 'none' }),
  h('circle', { cx: '4', cy: '18', r: '1.5', fill: 'currentColor', stroke: 'none' }),
);

const IconPin = () => h('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' },
  h('line', { x1: '12', y1: '17', x2: '12', y2: '22' }),
  h('path', { d: 'M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z' }),
);

const IconEdit = () => h('svg', { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' },
  h('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
  h('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' }),
);

// ════════════════════════════════════════════════════════════════════════════
// SmartNotesPanel
// ════════════════════════════════════════════════════════════════════════════

function SmartNotesPanel() {
  const notesRef    = useRef(null);
  const saveTimer   = useRef(null);
  const notesMapRef = useRef(loadNotesMap());

  const [page, setPage]           = useState(1);
  const [saveStatus, setSave]     = useState('saved'); // 'saved' | 'saving'
  const [clipBanner, setClip]     = useState(null);    // null | { text, page }
  const [selText, setSelText]     = useState('');
  const [fmts, setFmts]           = useState({ bold: false, italic: false, underline: false });

  // ── Page tracking (poll ws.currentPage) ──────────────────────────────────
  useEffect(() => {
    let lastPage = 1;
    const tick = () => {
      const p = (window.ws && window.ws.currentPage) || 1;
      if (p !== lastPage) {
        // Flush current content before switching
        if (notesRef.current) {
          notesMapRef.current.set(lastPage, notesRef.current.innerHTML);
          saveNotesMap(notesMapRef.current);
          document.dispatchEvent(new CustomEvent('ws:notes-saved', { detail: { page: lastPage } }));
        }
        lastPage = p;
        setPage(p);
      }
    };
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, []);

  // ── Load notes when page changes ─────────────────────────────────────────
  useEffect(() => {
    if (!notesRef.current) return;
    const html = notesMapRef.current.get(page) || '';
    notesRef.current.innerHTML = html;
  }, [page]);

  // ── Listen for Clip from AI custom event ─────────────────────────────────
  useEffect(() => {
    const handler = (e) => setClip({ text: e.detail.text, page: e.detail.page });
    document.addEventListener('ws:ai-answer', handler);
    return () => document.removeEventListener('ws:ai-answer', handler);
  }, []);

  // ── Track text selection inside the notes area ───────────────────────────
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && notesRef.current?.contains(sel.anchorNode)) {
        const txt = sel.toString().trim();
        setSelText(txt);
      } else {
        // Only clear if the focus is outside the notes area
        if (!notesRef.current?.contains(document.activeElement)) {
          setSelText('');
        }
      }
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  // ── Save helpers ──────────────────────────────────────────────────────────
  const doSave = useCallback(() => {
    if (!notesRef.current) return;
    notesMapRef.current.set(page, notesRef.current.innerHTML);
    saveNotesMap(notesMapRef.current);
    setSave('saved');
    document.dispatchEvent(new CustomEvent('ws:notes-saved', { detail: { page } }));
  }, [page]);

  const handleInput = useCallback(() => {
    setSave('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, SAVE_DELAY);
  }, [doSave]);

  // ── Update toolbar format state ───────────────────────────────────────────
  const updateFmts = useCallback(() => {
    setFmts({
      bold:      document.queryCommandState('bold'),
      italic:    document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    });
  }, []);

  // ── execCommand wrapper ───────────────────────────────────────────────────
  const fmt = useCallback((cmd) => {
    notesRef.current?.focus();
    if (cmd === 'highlight') {
      document.execCommand('backColor', false, '#fef08a');
    } else if (cmd === 'heading') {
      document.execCommand('formatBlock', false, 'H3');
    } else if (cmd === 'bullet') {
      document.execCommand('insertUnorderedList', false, null);
    } else {
      document.execCommand(cmd, false, null);
    }
    handleInput();
    updateFmts();
  }, [handleInput, updateFmts]);

  // ── Clip from AI action ───────────────────────────────────────────────────
  const clipToNotes = useCallback(() => {
    if (!clipBanner || !notesRef.current) return;
    const block = document.createElement('div');
    block.className = 'snp-clipped-block';
    const label = document.createElement('div');
    label.className = 'snp-clipped-label';
    label.textContent = `Clipped from AI · Page ${clipBanner.page}`;
    const body = document.createElement('p');
    body.style.margin = '0';
    body.textContent = clipBanner.text.slice(0, 400);
    block.appendChild(label);
    block.appendChild(body);
    notesRef.current.appendChild(block);
    notesRef.current.appendChild(document.createElement('p'));
    notesRef.current.focus();
    setClip(null);
    handleInput();
  }, [clipBanner, handleInput]);

  // ── Send to AI ────────────────────────────────────────────────────────────
  const sendToAI = useCallback(() => {
    if (!selText) return;
    if (typeof window.wsSetInput === 'function') window.wsSetInput(selText);
    if (typeof window.wsShowPanel === 'function') window.wsShowPanel('chat');
  }, [selText]);

  // ── Add sticky via format toolbar pin button ──────────────────────────────
  const pinSticky = useCallback(() => {
    document.dispatchEvent(new CustomEvent('ws:add-sticky', { detail: { page } }));
  }, [page]);

  // ─────────────────────────────────────────────────────────────────────────

  return h(Fragment, null,

    // ── Clip from AI banner ───────────────────────────────────────────────
    clipBanner && h('div', { class: 'snp-clip-banner' },
      h('span', { class: 'snp-clip-icon' }, '✨'),
      h('span', { class: 'snp-clip-text' },
        clipBanner.text.slice(0, 80) + (clipBanner.text.length > 80 ? '…' : ''),
      ),
      h('button', {
        class: 'snp-clip-action',
        onMouseDown: (e) => { e.preventDefault(); clipToNotes(); },
      }, 'Clip to notes'),
      h('button', {
        class: 'snp-clip-close',
        onMouseDown: (e) => { e.preventDefault(); setClip(null); },
      }, '✕'),
    ),

    // ── Format toolbar ────────────────────────────────────────────────────
    h('div', { class: 'snp-toolbar' },

      h('button', {
        class: `snp-tb-btn${fmts.bold ? ' snp-tb-on' : ''}`,
        title: 'Bold (Ctrl+B)',
        onMouseDown: (e) => { e.preventDefault(); fmt('bold'); },
      }, h('b', null, 'B')),

      h('button', {
        class: `snp-tb-btn${fmts.italic ? ' snp-tb-on' : ''}`,
        title: 'Italic (Ctrl+I)',
        onMouseDown: (e) => { e.preventDefault(); fmt('italic'); },
      }, h('i', null, 'I')),

      h('button', {
        class: `snp-tb-btn${fmts.underline ? ' snp-tb-on' : ''}`,
        title: 'Underline (Ctrl+U)',
        onMouseDown: (e) => { e.preventDefault(); fmt('underline'); },
      }, h('u', null, 'U')),

      h('button', {
        class: 'snp-tb-btn snp-tb-hl',
        title: 'Highlight',
        onMouseDown: (e) => { e.preventDefault(); fmt('highlight'); },
      }, 'HL'),

      h('div', { class: 'snp-tb-sep' }),

      h('button', {
        class: 'snp-tb-btn',
        title: 'Bullet list',
        onMouseDown: (e) => { e.preventDefault(); fmt('bullet'); },
      }, h(IconBullet)),

      h('button', {
        class: 'snp-tb-btn',
        title: 'Heading',
        onMouseDown: (e) => { e.preventDefault(); fmt('heading'); },
      }, 'H'),

      h('div', { class: 'snp-tb-sep' }),

      h('button', {
        class: 'snp-tb-btn snp-tb-pin',
        title: 'Add sticky note to PDF page',
        onMouseDown: (e) => { e.preventDefault(); pinSticky(); },
      }, h(IconPin)),

      // Auto-save indicator pushed to the right
      h('div', { class: 'snp-save-indicator' },
        h('span', { class: `snp-save-dot${saveStatus === 'saved' ? ' snp-dot-green' : ' snp-dot-amber'}` }),
        h('span', { class: 'snp-save-txt' }, saveStatus === 'saved' ? 'Saved' : 'Saving…'),
      ),
    ),

    // ── Notes area (contenteditable, lined aesthetic) ─────────────────────
    h('div', { class: 'snp-notes-wrap' },
      h('div', {
        ref: notesRef,
        class: 'snp-notes-area',
        contenteditable: 'true',
        spellcheck: 'true',
        'data-placeholder': 'Start typing your notes for this page…',
        onInput: handleInput,
        onKeyUp: updateFmts,
        onMouseUp: updateFmts,
        onClick: updateFmts,
      }),
    ),

    // ── Send to AI bar ────────────────────────────────────────────────────
    h('div', { class: 'snp-send-bar' },
      selText
        ? h(Fragment, null,
            h('div', { class: 'snp-send-preview' },
              `"${selText.slice(0, 55)}${selText.length > 55 ? '…' : ''}"`,
            ),
            h('button', { class: 'snp-send-btn', onClick: sendToAI }, 'Ask AI ↗'),
          )
        : h('div', { class: 'snp-send-hint' },
            h(IconEdit),
            ' Select text above to ask AI',
          ),
    ),
  );
}

// ════════════════════════════════════════════════════════════════════════════
// StickyStrip (mounted inside the PDF panel right edge)
// ════════════════════════════════════════════════════════════════════════════

function StickyStrip() {
  const stickiesMapRef = useRef(loadStickiesMap());
  const documentIdRef  = useRef(null);

  const [page, setPage]             = useState(1);
  const [stickies, setStickies]     = useState([]);
  const [openId, setOpenId]         = useState(null);
  const [popupText, setPopupText]   = useState('');

  // ── Resolve current document id ───────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      documentIdRef.current = window.ws?.bookId || null;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Load stickies from Supabase on mount (merge with localStorage) ────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const docId = window.ws?.bookId;
      if (!docId) return;
      const remote = await loadStickiesFromSupabase(docId);
      if (cancelled || !remote) return;
      // Merge remote into localStorage map
      for (const [pg, arr] of remote) {
        stickiesMapRef.current.set(pg, arr);
      }
      saveStickiesMap(stickiesMapRef.current);
      // Refresh current page stickies
      setStickies(stickiesMapRef.current.get(page) || []);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Page tracking ─────────────────────────────────────────────────────────
  useEffect(() => {
    let lastPage = 1;
    const tick = () => {
      const p = (window.ws && window.ws.currentPage) || 1;
      if (p !== lastPage) {
        lastPage = p;
        setPage(p);
        setOpenId(null); // close popup on page change
      }
    };
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, []);

  // ── Load stickies for current page ────────────────────────────────────────
  useEffect(() => {
    setStickies(stickiesMapRef.current.get(page) || []);
  }, [page]);

  // ── Listen for ws:add-sticky event (from notes panel Pin button) ──────────
  useEffect(() => {
    const handler = (e) => {
      const targetPage = (e.detail && e.detail.page) || page;
      const newSticky = {
        id: _isLoggedIn() ? crypto.randomUUID() : Date.now(),
        color: PIN_COLORS[Math.floor(Math.random() * PIN_COLORS.length)],
        text: '',
      };
      const current = stickiesMapRef.current.get(targetPage) || [];
      const updated = [...current, newSticky];
      stickiesMapRef.current.set(targetPage, updated);
      saveStickiesMap(stickiesMapRef.current);
      upsertStickyToSupabase(newSticky, documentIdRef.current, targetPage);
      if (targetPage === page) {
        setStickies(updated);
        setOpenId(newSticky.id);
        setPopupText('');
      }
    };
    document.addEventListener('ws:add-sticky', handler);
    return () => document.removeEventListener('ws:add-sticky', handler);
  }, [page]);

  // ── Add new sticky ────────────────────────────────────────────────────────
  const addSticky = useCallback(() => {
    const newSticky = {
      id: _isLoggedIn() ? crypto.randomUUID() : Date.now(),
      color: PIN_COLORS[stickies.length % PIN_COLORS.length],
      text: '',
    };
    const updated = [...stickies, newSticky];
    stickiesMapRef.current.set(page, updated);
    saveStickiesMap(stickiesMapRef.current);
    upsertStickyToSupabase(newSticky, documentIdRef.current, page);
    setStickies(updated);
    setOpenId(newSticky.id);
    setPopupText('');
  }, [stickies, page]);

  // ── Open a sticky popup ───────────────────────────────────────────────────
  const openSticky = useCallback((s) => {
    if (openId === s.id) {
      setOpenId(null);
    } else {
      setOpenId(s.id);
      setPopupText(s.text || '');
    }
  }, [openId]);

  // ── Save popup text ───────────────────────────────────────────────────────
  const savePopup = useCallback((id, text) => {
    const updated = stickies.map(s => s.id === id ? { ...s, text } : s);
    stickiesMapRef.current.set(page, updated);
    saveStickiesMap(stickiesMapRef.current);
    setStickies(updated);
    const sticky = updated.find(s => s.id === id);
    if (sticky) upsertStickyToSupabase(sticky, documentIdRef.current, page);
  }, [stickies, page]);

  // ── Delete a sticky ───────────────────────────────────────────────────────
  const deleteSticky = useCallback((id) => {
    const updated = stickies.filter(s => s.id !== id);
    stickiesMapRef.current.set(page, updated);
    saveStickiesMap(stickiesMapRef.current);
    setStickies(updated);
    setOpenId(null);
    deleteStickyFromSupabase(id);
  }, [stickies, page]);

  const openStickyData = stickies.find(s => s.id === openId);

  return h('div', { class: 'sticky-strip' },

    // Pins column
    h('div', { class: 'sticky-pins-col' },
      stickies.map(s =>
        h('button', {
          key: s.id,
          class: `sticky-pin${openId === s.id ? ' sticky-pin-open' : ''}`,
          style: { '--pin-color': s.color },
          title: s.text ? s.text.slice(0, 40) : 'Sticky note',
          onClick: () => openSticky(s),
        },
          h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: s.color, stroke: 'none' },
            h('path', { d: 'M12 2C8.69 2 6 4.69 6 8c0 5.25 6 14 6 14s6-8.75 6-14c0-3.31-2.69-6-6-6zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z' }),
          ),
        ),
      ),
      h('button', {
        class: 'sticky-add-btn',
        title: 'Add sticky note',
        onClick: addSticky,
      }, '+'),
    ),

    // Popup for open sticky
    openStickyData && h('div', { class: 'sticky-popup' },
      h('div', {
        class: 'sticky-popup-header',
        style: { background: openStickyData.color },
      },
        h('span', { class: 'sticky-popup-pg' }, `Page ${page}`),
        h('button', {
          class: 'sticky-popup-del',
          onMouseDown: (e) => { e.preventDefault(); deleteSticky(openId); },
          title: 'Delete sticky',
        }, '🗑'),
        h('button', {
          class: 'sticky-popup-close',
          onMouseDown: (e) => { e.preventDefault(); setOpenId(null); },
          title: 'Close',
        }, '✕'),
      ),
      h('textarea', {
        class: 'sticky-popup-ta',
        value: popupText,
        placeholder: 'Your sticky note…',
        onInput: (e) => {
          const v = e.target.value;
          setPopupText(v);
          savePopup(openId, v);
        },
        autofocus: true,
      }),
    ),
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Mount helpers
// ════════════════════════════════════════════════════════════════════════════

/**
 * Mount the SmartNotesPanel island into the given container.
 * Called from WorkspaceScreen.js after the HTML is injected.
 */
export function mountSmartNotesPanel(container) {
  const el = typeof container === 'string'
    ? document.querySelector(container)
    : container;
  if (!el) { console.warn('[SmartNotesPanel] container not found:', container); return; }
  render(h(SmartNotesPanel, null), el);
}

/**
 * Mount the StickyStrip island into the given container inside the PDF panel.
 */
export function mountStickyStrip(container) {
  const el = typeof container === 'string'
    ? document.querySelector(container)
    : container;
  if (!el) { console.warn('[StickyStrip] container not found:', container); return; }
  render(h(StickyStrip, null), el);
}
