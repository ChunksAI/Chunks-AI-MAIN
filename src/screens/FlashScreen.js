/**
 * src/screens/FlashScreen.js — Flashcard screen
 *
 * Owns all JavaScript for the Flashcard screen:
 *   - Card rendering & flip state
 *   - Deck generation (from bar and from workspace)
 *   - Navigation: next card, complete modal, restart, create new
 *   - Skeleton loading overlay
 *   - Persistence: save/load decks & sessions (Supabase + localStorage fallback)
 *   - SRS (SM-2 simplified) rating logic
 *   - Sidebar deck list rendering
 *   - Screen init + Supabase auth hooks
 *
 * All functions are exposed on `window.*` so the monolith's HTML event
 * attributes and the navigation module's `_fcRenderDeckList` call continue
 * to work without modification.
 *
 * The static HTML (`#screen-flash`) remains in index.html until Task 38.
 *
 * Exports (also on window.*)
 * ──────────────────────────
 *   _fcRenderCard()
 *   _fcUpdateStats()
 *   _fcNext(rating)
 *   _fcShowCompleteModal()
 *   _fcRestartDeck()
 *   _fcCreateNew()
 *   _fcShowSkeleton(topic)
 *   _fcClearSkeleton()
 *   _fcGenerateFromBar()
 *   _fcSaveDeck(topic, cards)
 *   _fcLoadDecks()
 *   _fcLoadCards(deck)
 *   _fcRenderDeckList()
 *   _fcLoadDeckIntoStudy(deck)
 *   _fcSaveSession()
 *   _fcGetLastSession(deckId, deckName)
 *   _fcInitScreen()
 *   wsMakeFlashcard(btn, msgId, question)
 *
 * Task 27 — extracted from monolith lines 3534–3702, 6338–6692
 */

// ── Constants ──────────────────────────────────────────────────────────────

const FC_LS_KEY          = 'chunks_fc_decks_v1';
const FC_SESSIONS_LS_KEY = 'chunks_fc_sessions_v1';

// ── Card rendering ─────────────────────────────────────────────────────────

export function _fcRenderCard() {
  if (!window._fcDeck.length) return;
  const card  = window._fcDeck[window._fcIndex];
  const total = window._fcDeck.length;

  // Reset flip state (DOM class AND JS variable must both be reset)
  const wrap = document.getElementById('flashCard');
  if (wrap) wrap.classList.remove('flipped');
  window.cardFlipped = false;

  // Update front (support both field naming conventions)
  const qEl = document.getElementById('flash-question');
  if (qEl) qEl.textContent = card.front || card.question || '';

  // Update back with LaTeX inline rendering
  const aEl      = document.getElementById('flash-answer');
  const backText = card.back || card.answer || '';
  if (aEl) {
    aEl.innerHTML = (typeof sanitize === 'function' ? sanitize : (s) => s)(
      backText.replace(
        /\$([^$]+)\$/g,
        '<code style="font-family:var(--font-mono);font-size:12px;background:var(--surface-3);border:1px solid var(--border-xs);padding:1px 5px;border-radius:4px;color:var(--teal);">$1</code>'
      )
    );
  }

  // Update progress
  const countText = `${window._fcIndex + 1} / ${total}`;
  const countLabel = document.getElementById('flash-count-label');
  if (countLabel) countLabel.textContent = countText;
  const progressFill = document.getElementById('flash-progress-fill');
  if (progressFill) progressFill.style.width = `${((window._fcIndex + 1) / total) * 100}%`;
  // Sync mobile topbar badge
  const mobileCount = document.getElementById('flash-mobile-count');
  if (mobileCount) mobileCount.textContent = countText;

  // Update breadcrumb with deck topic
  const titleEl = document.getElementById('flash-deck-title');
  if (titleEl && window._fcDeckTopic) titleEl.textContent = window._fcDeckTopic;

  // Update hint
  const hint = document.getElementById('flipHint');
  if (hint) {
    hint.textContent = 'Click the card or press Space to reveal the answer';
    hint.style.opacity = '1';
  }

  // Disable rating buttons until the answer is revealed
  document.querySelectorAll('.flash-btn.hard, .flash-btn.ok, .flash-btn.easy').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.38';
    btn.style.pointerEvents = 'none';
  });

  _fcUpdateStats();
}

export function _fcUpdateStats() {
  const easy    = document.getElementById('stat-easy');
  const ok      = document.getElementById('stat-ok');
  const hard    = document.getElementById('stat-hard');
  const skipped = document.getElementById('stat-skipped');
  if (easy)    easy.textContent    = window._fcStats.easy    || 0;
  if (ok)      ok.textContent      = window._fcStats.ok      || 0;
  if (hard)    hard.textContent    = window._fcStats.hard    || 0;
  if (skipped) skipped.textContent = window._fcStats.skipped || 0;
}

// ── Card navigation ────────────────────────────────────────────────────────

export function _fcNext(rating) {
  if (!window._fcDeck.length) return;

  // Record per-card rating for session sync
  const card           = window._fcDeck[window._fcIndex];
  const resolvedRating = (rating && ['easy', 'ok', 'hard'].includes(rating)) ? rating : 'skipped';
  window._fcCardRatings.push({
    front:   card.front || card.question || '',
    card_id: card.id || null,
    rating:  resolvedRating,
  });

  if (resolvedRating !== 'skipped') {
    window._fcStats[resolvedRating] = (window._fcStats[resolvedRating] || 0) + 1;
  } else {
    window._fcStats.skipped = (window._fcStats.skipped || 0) + 1;
  }
  window._fcIndex++;

  // Deck finished — show completion modal instead of looping
  if (window._fcIndex >= window._fcDeck.length) {
    _fcShowCompleteModal();
    return;
  }
  _fcRenderCard();
}

export function _fcShowCompleteModal() {
  const total = window._fcDeck.length;
  const easy  = window._fcStats.easy  || 0;
  const ok    = window._fcStats.ok    || 0;
  const hard  = window._fcStats.hard  || 0;

  const easyEl    = document.getElementById('fc-modal-easy');
  const okEl      = document.getElementById('fc-modal-ok');
  const hardEl    = document.getElementById('fc-modal-hard');
  const subtitleEl = document.getElementById('fc-complete-subtitle');

  if (easyEl)    easyEl.textContent    = easy;
  if (okEl)      okEl.textContent      = ok;
  if (hardEl)    hardEl.textContent    = hard;
  if (subtitleEl) subtitleEl.textContent =
    `You reviewed all ${total} card${total !== 1 ? 's' : ''} in "${window._fcDeckTopic || 'this deck'}".`;

  const modal = document.getElementById('fc-complete-modal');
  if (modal) modal.style.display = 'flex';

  // Persist session progress (fire-and-forget — don't block the modal)
  _fcSaveSession().catch(e => console.warn('[FC] Session save failed:', e));
}

export function _fcRestartDeck() {
  const modal = document.getElementById('fc-complete-modal');
  if (modal) modal.style.display = 'none';
  window._fcIndex       = 0;
  window._fcStats       = { easy: 0, ok: 0, hard: 0, skipped: 0 };
  window._fcCardRatings = [];
  _fcUpdateStats();
  _fcRenderCard();
}

export function _fcCreateNew() {
  const modal = document.getElementById('fc-complete-modal');
  if (modal) modal.style.display = 'none';
  const input = document.getElementById('fc-gen-input');
  if (input) {
    input.value = '';
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ── Skeleton overlay ───────────────────────────────────────────────────────

export function _fcShowSkeleton(topic) {
  const front = document.getElementById('flash-face-front');
  const back  = document.getElementById('flash-face-back');
  const card  = document.getElementById('flashCard');
  const hint  = document.getElementById('flipHint');

  if (front) front.innerHTML = `
    <span class="flash-tag">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      Generating…
    </span>
    <div style="display:flex;flex-direction:column;gap:10px;width:100%;margin-top:12px;">
      <div class="skeleton-line" style="height:13px;width:85%;animation-delay:0s;"></div>
      <div class="skeleton-line" style="height:13px;width:65%;animation-delay:0.1s;"></div>
      <div class="skeleton-line" style="height:13px;width:75%;animation-delay:0.2s;"></div>
    </div>
    <div style="margin-top:auto;font-size:11px;color:var(--text-4);">Building deck for "${topic}"…</div>`;

  if (back) back.innerHTML = `
    <span class="flash-tag" style="color:var(--gold);background:var(--gold-muted);border-color:var(--gold-border);">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
      Answer
    </span>
    <div style="display:flex;flex-direction:column;gap:10px;width:100%;margin-top:12px;">
      <div class="skeleton-line" style="height:13px;width:90%;animation-delay:0.05s;"></div>
      <div class="skeleton-line" style="height:13px;width:70%;animation-delay:0.15s;"></div>
    </div>`;

  if (card) { card.style.pointerEvents = 'none'; card.classList.remove('flipped'); }
  if (hint) hint.style.opacity = '0';
}

export function _fcClearSkeleton() {
  const front = document.getElementById('flash-face-front');
  const back  = document.getElementById('flash-face-back');

  if (front) front.innerHTML = `
    <span class="flash-tag" id="flash-tag-front">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      <span id="flash-tag-text">Question</span>
    </span>
    <p class="flash-q" id="flash-question"></p>
    <div class="flash-source" id="flash-source-front" style="opacity:0;"></div>`;

  if (back) back.innerHTML = `
    <span class="flash-tag" style="color:var(--gold);background:var(--gold-muted);border-color:var(--gold-border);">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
      Answer
    </span>
    <div class="flash-a" id="flash-answer">—</div>`;

  const card = document.getElementById('flashCard');
  if (card) card.style.pointerEvents = '';
  const hint = document.getElementById('flipHint');
  if (hint) hint.style.opacity = '1';
}

// ── Deck generation ────────────────────────────────────────────────────────

export async function _fcGenerateFromBar() {
  const input = document.getElementById('fc-gen-input') || document.querySelector('.gen-input');
  const topic = input?.value?.trim();
  if (!topic) return;
  const btn = document.getElementById('gen-btn') || document.querySelector('.gen-btn');
  if (btn) { btn.textContent = 'Generating…'; btn.disabled = true; }

  _fcShowSkeleton(topic);

  try {
    const res = await fetch(`${window.API_BASE}/generate-flashcards`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ topic, bookId: window._wsBookId || null, count: 10 }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    if (!data.success || !data.flashcards?.length) throw new Error(data.error || 'No cards returned');

    window._fcDeck          = data.flashcards;
    window._fcDeckTopic     = topic;
    window._fcCurrentDeckId = null;
    window._fcIndex         = 0;
    window._fcStats         = { easy: 0, ok: 0, hard: 0, skipped: 0 };
    window._fcCardRatings   = [];
    _fcClearSkeleton();
    _fcUpdateStats();
    _fcRenderCard();
    if (input) input.value = '';
    if (typeof window.wsShowToast === 'function') {
      window.wsShowToast('🃏', `${data.flashcards.length} cards generated!`, 'var(--gold-border)');
    }

    await _fcSaveDeck(topic, data.flashcards);

  } catch (e) {
    console.error('Flashcard generation error:', e);
    _fcClearSkeleton();
    const front = document.getElementById('flash-face-front');
    if (front) {
      front.innerHTML = `
        <span class="flash-tag" id="flash-tag-front">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          <span id="flash-tag-text">Question</span>
        </span>
        <p class="flash-q" id="flash-question">Generation failed. Try again.</p>
        <div class="flash-source" id="flash-source-front" style="opacity:0;"></div>`;
    }
    if (typeof window.wsShowToast === 'function') {
      window.wsShowToast('⚠', `Generation failed: ${e.message}`, '#f87171');
    }
  } finally {
    if (btn) { btn.textContent = 'Generate with AI'; btn.disabled = false; }
  }
}

/** Called from the workspace "Make Flashcard" button. */
export async function wsMakeFlashcard(btn, msgId, question) {
  if (btn.classList.contains('loading')) return;
  btn.classList.add('loading');
  btn.innerHTML = `<div class="hc-thinking" style="display:inline-flex;gap:3px;"><span></span><span></span><span></span></div> Generating…`;

  const topic = (question || document.getElementById(msgId)?.querySelector('.ai-text')?.innerText?.slice(0, 120) || 'this topic').trim();

  try {
    const res = await fetch(`${window.API_BASE}/generate-flashcards`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ topic, bookId: window._wsBookId || 'atkins', count: 10 }),
    });
    const data = await res.json();
    if (!data.success || !data.flashcards?.length) throw new Error(data.error || 'No cards returned');

    window._fcDeck          = data.flashcards;
    window._fcDeckTopic     = topic;
    window._fcCurrentDeckId = null;
    window._fcIndex         = 0;
    window._fcStats         = { easy: 0, ok: 0, hard: 0, skipped: 0 };
    window._fcCardRatings   = [];
    _fcClearSkeleton();
    _fcRenderCard();

    if (typeof window.wsShowToast === 'function') {
      window.wsShowToast('🃏', `${data.flashcards.length} flashcards generated!`, 'var(--gold-border)');
    }
    setTimeout(() => window.showScreen && window.showScreen('flash'), 600);

    await _fcSaveDeck(topic, data.flashcards);

  } catch (e) {
    if (typeof window.wsShowToast === 'function') {
      window.wsShowToast('⚠', 'Could not generate flashcards', '#f87171');
    }
    console.error(e);
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg> Make Flashcard`;
  }
}

// ── Persistence: decks ─────────────────────────────────────────────────────

export async function _fcSaveDeck(topic, cards) {
  const deck = {
    id:         crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
    name:       topic,
    card_count: cards.length,
    cards,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // ALWAYS write to localStorage immediately — instant cache that survives refresh
  _fcSaveDeckLocal(deck);

  // Then attempt Supabase if logged in
  if (window.ChunksDB?.isLoggedIn()) {
    const { data: deckRow, error: deckErr } = await window.ChunksDB.insert('fc_decks', {
      name:       deck.name,
      card_count: deck.card_count,
    });
    if (deckErr || !deckRow) {
      console.warn('[FC] Deck insert failed, localStorage copy retained', deckErr);
    } else {
      window._fcCurrentDeckId = deckRow.id;
      _fcPatchLocalDeckId(deck.name, deckRow.id);
      const cardRows = cards.map(c => ({
        deck_id: deckRow.id,
        front:   c.question || c.front || '',
        back:    c.answer   || c.back  || '',
      }));
      await Promise.all(cardRows.map(r => window.ChunksDB.insert('fc_cards', r)));
      console.log('[FC] Deck saved to Supabase:', deckRow.id);
    }
  }

  await _fcRenderDeckList();
}

function _fcSaveDeckLocal(deck) {
  const decks    = window.ChunksDB.lsGet(FC_LS_KEY, []);
  const filtered = decks.filter(d => d.name !== deck.name);
  filtered.unshift(deck);
  window.ChunksDB.lsSet(FC_LS_KEY, filtered.slice(0, 30));
}

function _fcPatchLocalDeckId(name, supabaseId) {
  const decks   = window.ChunksDB.lsGet(FC_LS_KEY, []);
  const patched = decks.map(d => d.name === name ? { ...d, id: supabaseId } : d);
  window.ChunksDB.lsSet(FC_LS_KEY, patched);
}

export async function _fcLoadDecks() {
  const localDecks = window.ChunksDB.lsGet(FC_LS_KEY, []);

  if (window.ChunksDB?.isLoggedIn()) {
    try {
      const { data, error } = await window.ChunksDB.get('fc_decks', {
        order: { col: 'created_at', asc: false },
        limit: 30,
      });
      if (!error && data?.length) {
        const sbNames  = new Set(data.map(d => d.name));
        const localOnly = localDecks.filter(d => !sbNames.has(d.name));
        const merged   = [...data, ...localOnly];
        // Write-back cache so next refresh is instant
        window.ChunksDB.lsSet(FC_LS_KEY, merged.slice(0, 30));
        return merged;
      }
    } catch (e) {
      console.warn('[FC] Supabase deck load error:', e.message);
    }
    return localDecks;
  }

  return localDecks;
}

export async function _fcLoadCards(deck) {
  if (window.ChunksDB?.isLoggedIn()) {
    const deckId = deck.id;
    const { data, error } = await window.ChunksDB.get('fc_cards', { eq: { deck_id: deckId } });
    if (!error && data?.length) {
      // Write-back: cache cards onto the deck in localStorage
      const decks   = window.ChunksDB.lsGet(FC_LS_KEY, []);
      const patched = decks.map(d => d.id === deckId ? { ...d, cards: data } : d);
      window.ChunksDB.lsSet(FC_LS_KEY, patched);
      return data;
    }
  }
  return deck.cards || [];
}

// ── Sidebar deck list ──────────────────────────────────────────────────────

export async function _fcRenderDeckList() {
  const list  = document.getElementById('fc-saved-decks-list');
  const count = document.getElementById('fc-deck-count');
  if (!list) return;

  list.innerHTML = '<div class="recent-empty" style="font-size:11px;color:var(--text-4);padding:6px 8px;">Loading…</div>';
  const decks = await _fcLoadDecks();
  if (count) count.textContent = decks.length ? `${decks.length}` : '';

  if (!decks.length) {
    list.innerHTML = '<div class="recent-empty">No saved decks yet</div>';
    return;
  }

  // Load last session for each deck in parallel
  const lastSessions = await Promise.all(
    decks.map(d => _fcGetLastSession(d.id, d.name).catch(() => null))
  );

  list.innerHTML = '';
  decks.forEach((deck, i) => {
    const last = lastSessions[i];

    let scorePill = '';
    if (last && last.total > 0) {
      const pct   = Math.round(((last.easy + last.ok) / last.total) * 100);
      const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--red)';
      const ago   = _fcTimeAgo(last.studied_at);
      scorePill  = `<span style="font-size:9px;padding:1px 6px;border-radius:var(--r-pill);background:${color}22;color:${color};border:1px solid ${color}44;flex-shrink:0;">${pct}%</span>`;
      scorePill += `<span style="font-size:9px;color:var(--text-4);flex-shrink:0;">${ago}</span>`;
    }

    const item = document.createElement('div');
    item.className = 'recent-item';
    item.style.cssText = 'cursor:pointer;display:flex;flex-direction:column;gap:3px;padding:6px 8px;border-radius:8px;transition:background 0.1s;';
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;color:var(--violet);"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${deck.name || 'Untitled'}</span>
        <span style="font-size:10px;color:var(--text-4);flex-shrink:0;">${deck.card_count || '?'}</span>
      </div>
      ${scorePill ? `<div style="display:flex;align-items:center;gap:5px;padding-left:19px;">${scorePill}</div>` : ''}`;
    item.onclick      = () => _fcLoadDeckIntoStudy(deck);
    item.onmouseenter = () => { item.style.background = 'var(--surface-2)'; };
    item.onmouseleave = () => { item.style.background = ''; };
    list.appendChild(item);
  });
}

function _fcTimeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export async function _fcLoadDeckIntoStudy(deck) {
  const cards = await _fcLoadCards(deck);
  if (!cards.length) {
    if (typeof window.wsShowToast === 'function') {
      window.wsShowToast('⚠', 'No cards found in this deck', '#f87171');
    }
    return;
  }
  window._fcDeck = cards.map(c => ({
    id:    c.id    || null,
    front: c.front || c.question || '',
    back:  c.back  || c.answer  || '',
  }));
  window._fcCurrentDeckId = deck.id || null;
  window._fcDeckTopic     = deck.name;
  window._fcIndex         = 0;
  window._fcStats         = { easy: 0, ok: 0, hard: 0, skipped: 0 };
  window._fcCardRatings   = [];
  _fcUpdateStats();
  _fcRenderCard();
  if (typeof window.wsShowToast === 'function') {
    window.wsShowToast('🃏', `Loaded "${deck.name}"`, 'var(--violet-border)');
  }
}

// ── SRS (SM-2 simplified) ──────────────────────────────────────────────────

function _fcRatingToSRS(rating, prev = {}) {
  const ease  = prev.ease_factor   ?? 2.5;
  const reps  = prev.repetitions   ?? 0;
  const inter = prev.interval_days ?? 1;
  if (rating === 'easy') return {
    ease_factor:   Math.min(ease + 0.15, 3.0),
    interval_days: Math.max(Math.round(inter * 2), 2),
    repetitions:   reps + 1,
    last_reviewed: new Date().toISOString(),
    next_review:   new Date(Date.now() + Math.max(Math.round(inter * 2), 2) * 86400000).toISOString(),
  };
  if (rating === 'ok') return {
    ease_factor:   ease,
    interval_days: Math.max(Math.round(inter * 1.5), 1),
    repetitions:   reps + 1,
    last_reviewed: new Date().toISOString(),
    next_review:   new Date(Date.now() + Math.max(Math.round(inter * 1.5), 1) * 86400000).toISOString(),
  };
  // hard
  return {
    ease_factor:   Math.max(ease - 0.2, 1.3),
    interval_days: 1,
    repetitions:   reps + 1,
    last_reviewed: new Date().toISOString(),
    next_review:   new Date(Date.now() + 86400000).toISOString(),
  };
}

// ── Persistence: sessions ──────────────────────────────────────────────────

export async function _fcSaveSession() {
  const total   = window._fcDeck.length;
  const easy    = window._fcStats.easy    || 0;
  const ok      = window._fcStats.ok      || 0;
  const hard    = window._fcStats.hard    || 0;
  const skipped = window._fcStats.skipped || 0;

  const session = {
    id:        crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
    deck_id:   window._fcCurrentDeckId || null,
    deck_name: window._fcDeckTopic || 'Untitled',
    easy, ok, hard, skipped, total,
    studied_at: new Date().toISOString(),
  };

  // Always save aggregate to localStorage — sidebar pill reads from here
  _fcSaveSessionLocal(session);

  // Upsert per-card SRS data into fc_progress (only for cards with a Supabase id)
  if (window.ChunksDB?.isLoggedIn() && window._fcCurrentDeckId) {
    const ratableCards = window._fcCardRatings.filter(r => r.card_id && r.rating !== 'skipped');
    if (ratableCards.length) {
      try {
        await Promise.all(ratableCards.map(r => {
          const srs = _fcRatingToSRS(r.rating);
          return window.ChunksDB.upsert('fc_progress', {
            card_id: r.card_id,
            deck_id: window._fcCurrentDeckId,
            ...srs,
          }, 'user_id,card_id');
        }));
        console.log(`[FC] Progress upserted for ${ratableCards.length} cards`);
      } catch (e) {
        console.warn('[FC] Progress upsert error:', e.message);
      }
    }
  }

  _fcRenderDeckList().catch(() => {});
}

function _fcSaveSessionLocal(session) {
  const sessions = window.ChunksDB.lsGet(FC_SESSIONS_LS_KEY, []);
  const filtered = sessions.filter(s => s.deck_id !== session.deck_id && s.deck_name !== session.deck_name);
  filtered.unshift(session);
  window.ChunksDB.lsSet(FC_SESSIONS_LS_KEY, filtered.slice(0, 100));
}

export async function _fcGetLastSession(deckId, deckName) {
  // 1. localStorage first (fastest, works offline)
  const sessions = window.ChunksDB.lsGet(FC_SESSIONS_LS_KEY, []);
  const local    = sessions.find(s => s.deck_id === deckId || s.deck_name === deckName);
  if (local) return local;

  // 2. Cross-device fallback: derive score from fc_progress rows
  if (window.ChunksDB?.isLoggedIn() && deckId) {
    try {
      const { data, error } = await window.ChunksDB.get('fc_progress', {
        eq:    { deck_id: deckId },
        limit: 100,
      });
      if (!error && data?.length) {
        const total  = data.length;
        const easy   = data.filter(c => c.ease_factor >= 2.5 && c.repetitions > 0).length;
        const hard   = data.filter(c => c.ease_factor <  2.5 && c.repetitions > 0).length;
        const latest = data.reduce((a, b) =>
          (a.last_reviewed || '') > (b.last_reviewed || '') ? a : b, data[0]);
        return {
          deck_id:    deckId,
          deck_name:  deckName,
          easy, ok: 0, hard, skipped: 0, total,
          studied_at: latest.last_reviewed || null,
        };
      }
    } catch (e) { /* silent */ }
  }
  return null;
}

// ── Screen init ────────────────────────────────────────────────────────────

export async function _fcInitScreen() {
  await _fcRenderDeckList();
}

// ── Expose everything on window ────────────────────────────────────────────

// ── flipCard — called by data-action="flipCard" on the card & reveal button ──
export function flipCard() {
  const wrap = document.getElementById('flashCard');
  if (!wrap || wrap.style.pointerEvents === 'none') return; // generating — ignore
  if (window.cardFlipped) return; // already revealed

  wrap.classList.add('flipped');
  window.cardFlipped = true;

  const hint = document.getElementById('flipHint');
  if (hint) { hint.textContent = 'Rate how well you knew this'; hint.style.opacity = '1'; }

  // Enable rating buttons
  document.querySelectorAll('.flash-btn.hard, .flash-btn.ok, .flash-btn.easy').forEach(btn => {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
  });
}
window.flipCard = flipCard;

window._fcRenderCard        = _fcRenderCard;
window._fcUpdateStats       = _fcUpdateStats;
window._fcNext              = _fcNext;
window._fcShowCompleteModal = _fcShowCompleteModal;
window._fcRestartDeck       = _fcRestartDeck;
window._fcCreateNew         = _fcCreateNew;
window._fcShowSkeleton      = _fcShowSkeleton;
window._fcClearSkeleton     = _fcClearSkeleton;
window._fcGenerateFromBar   = _fcGenerateFromBar;
window._fcSaveDeck          = _fcSaveDeck;
window._fcLoadDecks         = _fcLoadDecks;
window._fcLoadCards         = _fcLoadCards;
window._fcRenderDeckList    = _fcRenderDeckList;
window._fcLoadDeckIntoStudy = _fcLoadDeckIntoStudy;
window._fcSaveSession       = _fcSaveSession;
window._fcGetLastSession    = _fcGetLastSession;
window._fcInitScreen        = _fcInitScreen;
window.wsMakeFlashcard      = wsMakeFlashcard;

// ── Auth hooks (DOMContentLoaded) ──────────────────────────────────────────
//
// These replace the two DOMContentLoaded listeners that lived at the bottom
// of the flashcard <script> block in the monolith.

document.addEventListener('DOMContentLoaded', () => {
  // 1. If flash screen is the landing screen after a refresh, render from
  //    localStorage immediately so the sidebar is never blank, then re-fetch
  //    from Supabase once auth is ready.
  if (sessionStorage.getItem('chunks_active_screen') === 'flash') {
    _fcRenderDeckList().catch(() => {});
    setTimeout(_fcInitScreen, 1400);
  }

  // 2. Hook Supabase auth state changes so the deck list refreshes after login
  const _waitForSb = setInterval(async () => {
    const sb = await (typeof window._getChunksSb === 'function'
      ? window._getChunksSb().catch(() => null)
      : Promise.resolve(null));
    if (!sb) return;
    clearInterval(_waitForSb);
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setTimeout(() => _fcRenderDeckList().catch(() => {}), 800);
      }
    });
  }, 200);
});