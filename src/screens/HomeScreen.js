
// @ts-nocheck
/**
 * src/screens/HomeScreen.js — Dashboard (replaces general AI chat)
 *
 * Owns:
 *   • #screen-home HTML injection (replaces data-home-screen placeholder)
 *   • Personalized greeting (date + time-of-day phrase)
 *   • Dashboard: stats row, recent activities, quick actions, what's new, feedback
 *
 * Backward-compat stubs (kept so appBridge / other modules don\'t break):
 *   homeRestoreLanding, _homeMountLatestSession, window._homeMountSession
 */

import { lsGet } from '../utils/storage.js';

// ── What\'s New feed ───────────────────────────────────────────────────────────
// Update this array to change the What\'s New panel. badge: \'new\' | \'tip\' | \'fix\'
export const _HOME_NEWS = [
  { badge: 'new',  text: 'Smart Notes panel added to workspace',          date: '2 days ago' },
  { badge: 'tip',  text: 'Use Deep Think mode for complex problems',       date: '5 days ago' },
  { badge: 'new',  text: 'Study plans now track per-concept mastery',      date: '1 week ago' },
  { badge: 'fix',  text: 'Flashcard sync across devices improved',         date: '2 weeks ago' },
  { badge: 'tip',  text: 'Upload a PDF from the home screen to start studying', date: '3 weeks ago' },
];

// ── HTML template ─────────────────────────────────────────────────────────────

const HOME_HTML = /* html */`
<div class="screen active" id="screen-home">

  <aside class="sidebar" data-sidebar-screen="home"></aside>

  <main class="home-main">

    <!-- Mobile topbar: logo + avatar (hidden on desktop via CSS) -->
    <div class="mobile-home-topbar" style="display:none;">
      <div class="mht-logo-row">
        <svg width="26" height="26" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="display:block;flex-shrink:0;overflow:hidden;">
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/>
          <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
        </svg>
        <span class="mht-logo-text">Chunks</span>
      </div>
      <div class="mht-right">
        <div class="mht-search-btn" title="Search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
        <div class="mht-avatar" onclick="toggleProfileDropdown(event)" title="Profile"></div>
      </div>
    </div>

    <div class="home-glow"></div>

    <!-- Scrollable content -->
    <div class="home-scroll-area" id="home-scroll-area">

      <!-- Dashboard landing — shown when chat history is empty -->
      <div id="home-landing">

        <!-- Personalized greeting -->
        <div class="home-greeting" id="home-greeting">
          <p class="home-greeting-date" id="home-greeting-date"></p>
          <h1 class="home-greeting-h1">Good morning, <span class="home-greeting-name" id="home-greeting-name">there</span> 👋</h1>
        </div>

        <!-- Recent Activity (populated by _renderHomeActivities) -->
        <div id="home-activities-section"></div>

        <!-- Two-column: What\'s New + Feedback -->
        <div class="hd-two-col">
          <div class="hd-panel" id="hd-whats-new"></div>
          <div class="hd-panel" id="hd-feedback"></div>
        </div>

      </div><!-- end home-landing -->

    </div><!-- end home-scroll-area -->

  </main>
</div>
`;

// ── Greeting helpers ──────────────────────────────────────────────────────────

const _DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const _MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function _greetingPhrase() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function _greetingDate() {
  const now = new Date();
  return `${_DAYS[now.getDay()]}, ${_MONTHS[now.getMonth()]} ${now.getDate()}`;
}

function _updateGreeting() {
  const dateEl = document.getElementById('home-greeting-date');
  const h1El   = document.querySelector('.home-greeting-h1');
  if (dateEl) dateEl.textContent = _greetingDate();
  if (h1El) {
    const firstText = h1El.firstChild;
    if (firstText && firstText.nodeType === Node.TEXT_NODE) {
      firstText.textContent = `${_greetingPhrase()}, `;
    }
  }
  const user   = window._currentUser;
  const nameEl = document.getElementById('home-greeting-name');
  if (nameEl && user) {
    const firstName = (user.name || user.email || '').split(/\s+|@/)[0];
    if (firstName) nameEl.textContent = firstName;
  }
}

// ── Compat stubs ────────────────────────────────────────────────────────────

/** Refresh dashboard when navigating back to home. */
export function homeRestoreLanding() {
  _renderHomeActivities();
}

/** No-op — home sessions are not restored into a separate chat view. */
export function _homeMountLatestSession() {}

// Expose _mountSession as a no-op for sidebar recent-item clicks.
window._homeMountSession = function() {};

window._homeMarkNavTime = function() {};

function _hdRenderWhatsNew() {
  const el = document.getElementById('hd-whats-new');
  if (!el) return;
  const BADGE_COLOR = { new: 'var(--violet)', tip: 'var(--gold)', fix: 'var(--teal)' };
  const items = _HOME_NEWS.map(item => {
    const color = BADGE_COLOR[item.badge] || 'var(--text-4)';
    return `<div class="hd-news-item">
      <span class="hd-news-badge" style="color:${color};background:color-mix(in srgb,${color} 14%,transparent);">${item.badge.charAt(0).toUpperCase() + item.badge.slice(1)}</span>
      <span class="hd-news-text">${item.text}</span>
      <span class="hd-news-date">${item.date}</span>
    </div>`;
  }).join('');
  el.innerHTML = `
    <p class="hd-section-label">WHAT\'S NEW</p>
    <div class="hd-news-list">${items}</div>`;
}

function _hdSaveFeedback(rating, tagsSet) {
  try {
    const existing = JSON.parse(localStorage.getItem('chunks_home_feedback_v1') || '[]');
    existing.push({ rating, tags: Array.from(tagsSet), date: new Date().toISOString() });
    if (existing.length > 30) existing.splice(0, existing.length - 30);
    localStorage.setItem('chunks_home_feedback_v1', JSON.stringify(existing));
  } catch (_) {}
  const confirm = document.getElementById('hd-feedback-confirm');
  if (confirm) confirm.style.display = 'block';
}

const _HD_FEEDBACK_TAGS = [
  'Easy to use', 'Helpful AI', 'Too slow',
  'Missing features', 'Love it', 'Needs more content',
];

function _hdRenderFeedback() {
  const el = document.getElementById('hd-feedback');
  if (!el) return;

  // Hide widget if rated within the last 3 days
  try {
    const prev = JSON.parse(localStorage.getItem('chunks_home_feedback_v1') || '[]');
    if (prev.length > 0) {
      const last = prev[prev.length - 1];
      const daysSince = (Date.now() - new Date(last.date).getTime()) / 86400000;
      if (daysSince < 3) {
        el.innerHTML = `
          <p class="hd-section-label">HOW\'S YOUR STUDY SESSION GOING?</p>
          <div class="hd-feedback-thanks">Thanks for your feedback! ✨</div>`;
        return;
      }
    }
  } catch (_) {}

  el.innerHTML = `
    <p class="hd-section-label">HOW\'S YOUR STUDY SESSION GOING?</p>
    <p class="hd-feedback-q">Rate today\'s experience</p>
    <div class="hd-stars" id="hd-stars-row">
      ${[1,2,3,4,5].map(n => `<button class="hd-star" data-star="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}
    </div>
    <div class="hd-tag-chips" id="hd-tag-chips">
      ${_HD_FEEDBACK_TAGS.map(t => `<button class="hd-tag-chip" data-tag="${t}">${t}</button>`).join('')}
    </div>
    <div class="hd-feedback-confirm" id="hd-feedback-confirm" style="display:none;">Thanks! 🎉</div>`;

  let selectedRating = 0;
  const selectedTags = new Set();

  el.querySelectorAll('.hd-star').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRating = parseInt(btn.dataset.star, 10);
      el.querySelectorAll('.hd-star').forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.star, 10) <= selectedRating);
      });
      _hdSaveFeedback(selectedRating, selectedTags);
    });
    btn.addEventListener('mouseenter', () => {
      const n = parseInt(btn.dataset.star, 10);
      el.querySelectorAll('.hd-star').forEach(s => {
        s.classList.toggle('hover', parseInt(s.dataset.star, 10) <= n);
      });
    });
  });
  el.querySelector('.hd-stars')?.addEventListener('mouseleave', () => {
    el.querySelectorAll('.hd-star').forEach(s => s.classList.remove('hover'));
  });

  el.querySelectorAll('.hd-tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      if (selectedTags.has(tag)) { selectedTags.delete(tag); chip.classList.remove('active'); }
      else                       { selectedTags.add(tag);    chip.classList.add('active');    }
      if (selectedRating > 0) _hdSaveFeedback(selectedRating, selectedTags);
    });
  });
}

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mountHomeScreen() {
  const placeholder = document.querySelector('[data-home-screen]');
  if (!placeholder) {
    console.warn('[HomeScreen] placeholder [data-home-screen] not found');
    return;
  }
  placeholder.outerHTML = HOME_HTML;
  _updateGreeting();
  _renderHomeActivities();
  _hdRenderWhatsNew();
  _hdRenderFeedback();
}

// ── Recent Activities ─────────────────────────────────────────────────────────

export function _renderHomeActivities() {
  const container = document.getElementById('home-activities-section');
  if (!container) return;

  const _esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // ── 1. Last read book ───────────────────────────────────────────────────────
  let lastBook = null;
  try {
    const bpAll   = JSON.parse(localStorage.getItem('chunks_book_progress_v1') || '{}');
    const entries = Object.entries(bpAll);
    if (entries.length > 0) {
      entries.sort((a, b) => (b[1].lastOpened || '') > (a[1].lastOpened || '') ? 1 : -1);
      const [bookId, prog] = entries[0];
      const meta = (window.wsBookMeta || {})[bookId];
      if (prog.lastPage) {
        const pct = prog.totalPages ? Math.min(100, Math.round((prog.lastPage / prog.totalPages) * 100)) : 0;
        lastBook = { bookId, title: meta?.name || bookId, lastPage: prog.lastPage, totalPages: prog.totalPages || 0, pct, lastOpened: prog.lastOpened || null };
      }
    }
  } catch (_) {}

  // ── 2. Most recent study plan ───────────────────────────────────────────────
  let lastPlan = null;
  try {
    const allPlans = lsGet('sp_all_plans') || {};
    const entries  = Object.entries(allPlans);
    if (entries.length > 0) {
      entries.sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0));
      const [planId, plan] = entries[0];
      const topic = plan.topic || plan.plan?.title || '';
      if (topic) {
        const n = plan.plan?.concepts?.length || 0;
        const mastery = plan.mastery || {};
        const MASTERY_WEIGHTS = { explain: 10, flash: 20, pq: 35, exam: 35 };
        const scores = Array.from({ length: n }, (_, i) => {
          const m = mastery[i] || {};
          return Math.min(100, Math.round(
            ((m.explain || 0) / 100) * MASTERY_WEIGHTS.explain +
            ((m.flash   || 0) / 100) * MASTERY_WEIGHTS.flash   +
            ((m.pq      || 0) / 100) * MASTERY_WEIGHTS.pq      +
            ((m.exam    || 0) / 100) * MASTERY_WEIGHTS.exam
          ));
        });
        const barPct = n > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / n) : 0;
        lastPlan = { planId, topic, barPct };
      }
    }
  } catch (_) {}

  // ── 3. Most recently studied or created flashcard deck ─────────────────────
  let lastDeck = null;
  try {
    const decks        = lsGet('chunks_fc_decks_v1')   || [];
    const masteryStore = lsGet('chunks_fc_mastery_v1') || {};
    const deckEntries  = Object.entries(masteryStore);
    if (deckEntries.length > 0) {
      deckEntries.sort((a, b) => (b[1].lastStudied || '').localeCompare(a[1].lastStudied || ''));
      const [deckId, stats] = deckEntries[0];
      const deck = decks.find(d => d.id === deckId);
      if (deck) lastDeck = { deckId, name: deck.name, pct: stats.pct || 0, cardCount: deck.card_count || 0 };
    }
    if (!lastDeck && decks.length > 0) {
      const sorted = decks.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      const d = sorted[0];
      if (d?.name) lastDeck = { deckId: d.id, name: d.name, pct: 0, cardCount: d.card_count || 0 };
    }
  } catch (_) {}

  // ── No activity at all → show new-user empty state ─────────────────────────
  if (!lastBook && !lastPlan && !lastDeck) {
    container.innerHTML = `
      <p class="prompts-label">Recent activity</p>
      <div class="ra-grid">
        <div class="ra-new-card ra-new-empty" onclick="homeStartNew()">
          <div class="ra-new-plus">+</div>
          <div class="ra-new-empty-label">Start something new</div>
          <div class="ra-new-empty-sub">Upload a book, create a deck,<br>or start a plan</div>
        </div>
      </div>`;
    return;
  }

  // ── Build rich activity cards ───────────────────────────────────────────────
  let richCards = '';

  const _iconBook  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
  const _iconPlan  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
  const _iconFlash = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;

  if (lastBook) {
    richCards += `
      <div class="ra-new-card book" data-ra-action="book" data-ra-id="${_esc(lastBook.bookId)}">
        <div class="ra-card-banner book">
          <div class="ra-icon book">${_iconBook}</div>
        </div>
        <div class="ra-body">
          <span class="ra-new-type">Textbook</span>
          <div class="ra-new-title">${_esc(lastBook.title)}</div>
          <div class="ra-new-sub">Page ${lastBook.lastPage}${lastBook.totalPages ? ` of ${lastBook.totalPages}` : ''}</div>
          <button class="ra-new-btn">Continue →</button>
        </div>
      </div>`;
  }

  if (lastPlan) {
    richCards += `
      <div class="ra-new-card plan" data-ra-action="plan" data-ra-id="${_esc(lastPlan.planId)}">
        <div class="ra-card-banner plan">
          <div class="ra-icon plan">${_iconPlan}</div>
        </div>
        <div class="ra-body">
          <span class="ra-new-type">Study Plan</span>
          <div class="ra-new-title">${_esc(lastPlan.topic)}</div>
          <div class="ra-new-sub">Mastery: ${lastPlan.barPct}%</div>
          <button class="ra-new-btn">Resume →</button>
        </div>
      </div>`;
  }

  if (lastDeck) {
    const deckSub = lastDeck.cardCount
      ? `${lastDeck.cardCount} cards · ${lastDeck.pct}% mastered`
      : 'Flashcards';
    richCards += `
      <div class="ra-new-card flash" data-ra-action="flash" data-ra-id="${_esc(lastDeck.deckId)}">
        <div class="ra-card-banner flash">
          <div class="ra-icon flash">${_iconFlash}</div>
        </div>
        <div class="ra-body">
          <span class="ra-new-type">Flashcards</span>
          <div class="ra-new-title">${_esc(lastDeck.name)}</div>
          <div class="ra-new-sub">${_esc(deckSub)}</div>
          <button class="ra-new-btn">Review →</button>
        </div>
      </div>`;
  }

  richCards += `
    <div class="ra-new-card ra-new-empty" onclick="homeStartNew()">
      <div class="ra-new-plus">+</div>
      <div class="ra-new-empty-label">Start something new</div>
      <div class="ra-new-empty-sub">Upload a book, create a deck,<br>or start a plan</div>
    </div>`;

  container.innerHTML = `
    <p class="prompts-label">Continue where you left off</p>
    <div class="ra-grid">${richCards}</div>`;

  // Wire click handlers for rich cards
  container.querySelectorAll('.ra-new-card').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.raAction;
      const id     = el.dataset.raId;
      if (action === 'book') {
        if (typeof window.selectBook === 'function') window.selectBook(id);
      } else if (action === 'plan') {
        if (typeof window.showScreen === 'function') window.showScreen('studyplan');
        setTimeout(() => { if (typeof window.spSwitchToPlan === 'function') window.spSwitchToPlan(id); }, 100);
      } else if (action === 'flash') {
        if (typeof window.showScreen === 'function') window.showScreen('flash');
      }
    });
  });

  if (lastBook) _injectPdfThumb(lastBook.bookId).catch(() => {});
}

// ── Time-ago helper ───────────────────────────────────────────────────────────
function _timeAgo(isoString) {
  if (!isoString) return '';
  const diff  = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 2)   return 'Just now';
  if (mins  < 60)  return `${mins} min ago`;
  if (hours < 24)  return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days  === 1) return '1 day ago';
  if (days  < 7)   return `${days} days ago`;
  if (days  < 30)  return `${Math.floor(days / 7)} week${days >= 14 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

// ── PDF first-page thumbnail generator ───────────────────────────────────────
async function _injectPdfThumb(bookId) {
  const wrap = document.getElementById(`ra-thumb-${bookId}`);
  if (!wrap) return;

  const SESS_KEY   = `ra_pdf_thumb_v1_${bookId}`;
  const API_BASE   = window.API_BASE || 'https://api.chunks.online';
  const CACHE_NAME = 'chunks-pdf-v1';
  const pdfUrl     = `${API_BASE}/pdf/${bookId}`;

  const cached = sessionStorage.getItem(SESS_KEY);
  if (cached) { _applyThumb(wrap, cached); return; }

  let pdfData = null;
  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(pdfUrl);
      if (match) pdfData = await match.arrayBuffer();
    }
  } catch (_) {}

  if (!pdfData) return;

  try {
    let pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      pdfjsLib = window.pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const pdf      = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const page     = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const thumbW   = 360;
    const scale    = thumbW / viewport.width;
    const vp       = page.getViewport({ scale });
    const canvas   = wrap.querySelector('.ra-pdf-canvas');
    canvas.width   = vp.width;
    canvas.height  = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    try { sessionStorage.setItem(SESS_KEY, dataUrl); } catch (_) {}
    _applyThumb(wrap, dataUrl);
  } catch (_) {}
}

function _applyThumb(wrap, dataUrl) {
  const canvas      = wrap.querySelector('.ra-pdf-canvas');
  const placeholder = wrap.querySelector('.ra-pdf-thumb-placeholder');
  const badge       = wrap.querySelector('.ra-pdf-page-badge');
  if (canvas) {
    if (dataUrl && !canvas.width) {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.className = 'ra-pdf-canvas';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      canvas.replaceWith(img);
    } else {
      canvas.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    }
  }
  if (placeholder) placeholder.style.display = 'none';
  if (badge) badge.style.opacity = '1';
}

// ── Misc exports ──────────────────────────────────────────────────────────────

export function homeStartNew() {
  window.openLibraryModal?.();
}

// ── Auto-mount ────────────────────────────────────────────────────────────────
mountHomeScreen();

// ── Guest mode banner ─────────────────────────────────────────────────────────
(function _mountGuestBanner() {
  if (sessionStorage.getItem('chunks_guest_mode') !== '1') return;
  const landing = document.getElementById('home-landing');
  if (!landing || document.getElementById('home-guest-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'home-guest-banner';
  banner.style.cssText = 'display:flex;align-items:center;gap:10px;background:color-mix(in srgb,var(--gold,#f59e0b) 10%,var(--surface-2,#1e1e2e));border:1px solid color-mix(in srgb,var(--gold,#f59e0b) 25%,transparent);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--text-2,#aaa);margin:12px auto 0;max-width:560px;width:calc(100% - 32px);';
  banner.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;opacity:.7"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg><span>You\'re in guest mode. <a href="#" onclick="sessionStorage.removeItem(\'chunks_guest_mode\');window.openAuthModal?.();return false;" style="color:var(--gold,#f59e0b);text-decoration:none;font-weight:500;">Sign in</a> to keep your history.</span>`;
  landing.appendChild(banner);
})();

console.log('[HomeScreen] module loaded \u2726');
