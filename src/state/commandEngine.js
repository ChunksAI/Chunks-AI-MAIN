// @ts-nocheck
/**
 * src/state/commandEngine.js — Universal Command Engine
 *
 * Provides a central handler for natural language commands across all screens.
 * Detects intent via lightweight regex/keyword matching and executes actions
 * by delegating to existing functions (wsGoToPage, wsMakeFlashcard, showScreen,
 * etc.) rather than rebuilding them.
 *
 * Exports:
 *   detectIntent(input)               — parse intent from raw text
 *   handleCommand(input, context)     — execute intent; returns true if handled
 *   getSmartSuggestions(context)      — dynamic suggestions based on context
 *   getGlobalContext()                — current context snapshot
 *   updateContext(patch)              — update global context
 */

import { getWeakAreas, getAllProgress } from '../lib/progressTracker.js';

// ── Global context ────────────────────────────────────────────────────────────

const _ctx = {
  topic:   null,   // last known study topic
  page:    null,   // current PDF page number
  docId:   null,   // current book/doc id
  screen:  null,   // current screen name
};

export function getGlobalContext() { return { ..._ctx }; }

export function updateContext(patch) {
  if (patch && typeof patch === 'object') Object.assign(_ctx, patch);
}

// ── Intent patterns ───────────────────────────────────────────────────────────

const _INTENTS = [
  // Navigation: "go to page 23" / "page 23" / "open page 23"
  {
    type: 'GOTO_PAGE',
    re: /(?:go\s+to\s+page|open\s+page|jump\s+to\s+page|page)\s+(\d+)/i,
    extract: m => ({ page: parseInt(m[1], 10) }),
  },
  // Create flashcards: "create flashcards for entropy" / "make flashcards on X"
  {
    type: 'CREATE_FLASHCARD',
    re: /(?:create|make|generate|build)\s+flashcards?\s+(?:for|on|about|from)\s+(.+)/i,
    extract: m => ({ topic: m[1].trim().slice(0, 120) }),
  },
  // Flashcards without explicit topic: "create flashcards" / "make me flashcards"
  {
    type: 'CREATE_FLASHCARD',
    re: /(?:create|make|generate|build)\s+(?:me\s+)?flashcards?(?:\s+(?:now|please))?$/i,
    extract: () => ({}),
  },
  // Quiz: "quiz me on entropy" / "quiz me" / "test me on X"
  {
    type: 'QUIZ',
    re: /(?:quiz|test)\s+me\s+(?:on|about)\s+(.+)/i,
    extract: m => ({ topic: m[1].trim().slice(0, 120) }),
  },
  {
    type: 'QUIZ',
    re: /(?:quiz|test)\s+me(?:\s+(?:now|please))?$/i,
    extract: () => ({}),
  },
  // Summarize: "summarize this" / "summarize the current page"
  {
    type: 'SUMMARIZE',
    re: /^(?:summarize|summarise|give me a summary of?|tldr)\s*(.*)$/i,
    extract: m => ({ topic: m[1].trim() || null }),
  },
  // Explain: "explain entropy" / "explain this"
  {
    type: 'EXPLAIN',
    re: /^explain(?:\s+(?:to\s+me\s+)?(?:what|how|why|this|the\s+)?)?\s*(.*)$/i,
    extract: m => ({ topic: m[1].trim() || null }),
  },
  // Review flashcards: "review flashcards on entropy" / "study flashcards"
  {
    type: 'REVIEW_FLASHCARDS',
    re: /(?:review|study|practice)\s+flashcards?\s*(?:on|for|about)?\s*(.*)$/i,
    extract: m => ({ topic: m[1].trim() || null }),
  },
  // Go to flashcards screen: "open flashcards" / "show my decks"
  {
    type: 'SHOW_FLASHCARDS',
    re: /(?:open|show|go\s+to)\s+(?:my\s+)?(?:flashcards?|decks?)(?:\s+screen)?$/i,
    extract: () => ({}),
  },
  // Go to exam: "start exam" / "open exam"
  {
    type: 'START_EXAM',
    re: /(?:start|open|go\s+to)\s+(?:an?\s+)?exam(?:\s+screen)?$/i,
    extract: () => ({}),
  },
];

// ── Intent detection ──────────────────────────────────────────────────────────

/**
 * Detect structured intent from natural-language input.
 * @param {string} input
 * @returns {{ type: string, [key: string]: any } | null}
 */
export function detectIntent(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  for (const pattern of _INTENTS) {
    const m = trimmed.match(pattern.re);
    if (m) {
      return { type: pattern.type, ...pattern.extract(m) };
    }
  }
  return null;
}

// ── System feedback overlay ───────────────────────────────────────────────────

function _showSystemFeedback(text) {
  let el = document.getElementById('ce-system-feedback');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ce-system-feedback';
    el.style.cssText = [
      'position:fixed',
      'bottom:80px',
      'left:50%',
      'transform:translateX(-50%) translateY(10px)',
      'background:var(--surface-3,#1e1e2e)',
      'border:1px solid var(--border-sm,#333)',
      'border-radius:var(--r-pill,999px)',
      'padding:8px 18px',
      'font-size:12px',
      'color:var(--text-2,#ccc)',
      'font-family:var(--font-body,sans-serif)',
      'pointer-events:none',
      'opacity:0',
      'transition:opacity 0.2s ease, transform 0.2s ease',
      'z-index:9999',
      'white-space:nowrap',
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = text;
  // Force reflow then animate in
  void el.offsetWidth;
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(el._tm);
  el._tm = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(10px)';
  }, 2200);
}

// ── Command execution ─────────────────────────────────────────────────────────

/**
 * Attempt to execute a natural-language command.
 * Returns true if an intent was detected and executed; false otherwise.
 *
 * @param {string}  input    — raw user input
 * @param {Object}  [ctxOverride] — optional context override { topic, page, docId, screen }
 * @returns {boolean}
 */
export function handleCommand(input, ctxOverride) {
  const intent = detectIntent(input);
  if (!intent) return false;

  const ctx = { ..._ctx, ...(ctxOverride || {}) };

  switch (intent.type) {
    case 'GOTO_PAGE': {
      const page = intent.page;
      if (!page) return false;
      _showSystemFeedback(`📍 Opening Page ${page}…`);
      if (typeof window.wsGoToPage === 'function') {
        window.wsGoToPage(page);
      }
      return true;
    }

    case 'CREATE_FLASHCARD': {
      const topic = intent.topic || ctx.topic || null;
      _showSystemFeedback(`🧠 Creating flashcards…`);
      if (typeof window.wsGenerateFlashcardsInChat === 'function') {
        window.wsGenerateFlashcardsInChat(topic);
      }
      return true;
    }

    case 'QUIZ': {
      const topic = intent.topic || ctx.topic;
      _showSystemFeedback('📝 Opening quiz…');
      if (topic) {
        // Navigate to exam screen with topic in context
        try { sessionStorage.setItem('chunks_nav_topic', topic); } catch (_) {}
      }
      if (typeof window.showScreen === 'function') window.showScreen('exam');
      return true;
    }

    case 'REVIEW_FLASHCARDS': {
      const topic = intent.topic || ctx.topic;
      _showSystemFeedback('📚 Opening flashcards…');
      if (topic) {
        try { sessionStorage.setItem('chunks_nav_topic', topic); } catch (_) {}
      }
      if (typeof window.showScreen === 'function') window.showScreen('flash');
      return true;
    }

    case 'SHOW_FLASHCARDS': {
      _showSystemFeedback('📚 Opening flashcards…');
      if (typeof window.showScreen === 'function') window.showScreen('flash');
      return true;
    }

    case 'START_EXAM': {
      _showSystemFeedback('📝 Opening exam…');
      if (typeof window.showScreen === 'function') window.showScreen('exam');
      return true;
    }

    // SUMMARIZE and EXPLAIN: fall through to the normal chat flow so the user
    // message appears in the conversation and the AI responds with formatted text.
    case 'SUMMARIZE':
    case 'EXPLAIN':
      return false;

    default:
      return false;
  }
}

// ── Smart suggestions ─────────────────────────────────────────────────────────

/**
 * Generate dynamic context-aware suggestions.
 *
 * @param {Object} [ctxOverride] — optional { topic, page, screen }
 * @returns {Array<{ text: string, action: string, icon: string }>}
 */
export function getSmartSuggestions(ctxOverride) {
  const ctx    = { ..._ctx, ...(ctxOverride || {}) };
  const weak   = getWeakAreas();
  const suggestions = [];

  // 1. Weak area reminders (highest priority)
  if (weak.length > 0) {
    const top = weak[0];
    const displayTopic = _capitalize(top.topic);
    suggestions.push({
      text:   `Review flashcards on ${displayTopic}`,
      action: `wsSetInput('Review flashcards on ${_esc(top.topic)}')`,
      icon:   '⚡',
    });
    suggestions.push({
      text:   `Quiz me on ${displayTopic}`,
      action: `wsSetInput('Quiz me on ${_esc(top.topic)}')`,
      icon:   '📝',
    });
  }

  // 2. Current page suggestions
  if (ctx.page && ctx.page > 0) {
    suggestions.push({
      text:   `Generate flashcards from page ${ctx.page}`,
      action: `wsSetInput('Create flashcards for the content on page ${ctx.page}')`,
      icon:   '🃏',
    });
  }

  // 3. Screen-contextual suggestions
  if (ctx.screen === 'workspace' || !ctx.screen) {
    suggestions.push({
      text:   'Summarize the current page',
      action: `wsSetInput('Summarize the current page')`,
      icon:   '📄',
    });
    suggestions.push({
      text:   'Explain this in more detail',
      action: `wsSetInput('Explain this in more detail')`,
      icon:   '💡',
    });
  }

  if (ctx.screen === 'flash') {
    suggestions.push({
      text:   'Start a quiz',
      action: `showScreen('exam')`,
      icon:   '📝',
    });
  }

  // 4. Post-exam fallback
  if (ctx.screen === 'exam') {
    suggestions.push({
      text:   'Review flashcards',
      action: `showScreen('flash')`,
      icon:   '📚',
    });
  }

  // 5. Always-available fallback
  if (suggestions.length < 2) {
    suggestions.push({
      text:   'Generate flashcards on this topic',
      action: `wsGenerateFlashcardsInChat()`,
      icon:   '🃏',
    });
    suggestions.push({
      text:   'Explain this equation in detail',
      action: `wsSetInput('Explain this equation in detail')`,
      icon:   '💡',
    });
  }

  return suggestions.slice(0, 4);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function _esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ── Context sync from workspace state ────────────────────────────────────────
// Called by workspace/chat.js and navigation after each action to keep
// _ctx in sync with the actual app state.

export function syncContextFromWorkspace() {
  try {
    const page  = window.ws?.currentPage ?? null;
    const docId = window.ws?.bookId      ?? null;
    const topic = sessionStorage.getItem('chunks_nav_topic') || null;
    const screen = sessionStorage.getItem('chunks_last_screen') || null;
    Object.assign(_ctx, { page, docId, topic, screen });
  } catch (_) {}
}

// ── Window bridge ─────────────────────────────────────────────────────────────

export const CommandEngine = {
  detectIntent,
  handleCommand,
  getSmartSuggestions,
  getGlobalContext,
  updateContext,
  syncContextFromWorkspace,
};
