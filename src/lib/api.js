/**
 * src/lib/api.js — Chunks AI API client
 *
 * Single source of truth for every fetch() call to the Railway backend.
 * All callers import the named functions below; no raw fetch() to API_BASE
 * should remain in screen or component modules after Phase 2.
 *
 * Backend endpoints
 * ─────────────────
 *  POST /ask                  → { success, answer, sources?, is_relevant?, similarity? }
 *  POST /generate-flashcards  → { success, flashcards: [{front,back}] }
 *  GET  /pdf/:bookId          → binary PDF stream (ArrayBuffer)
 *  POST /api/stream-layer     → SSE stream of { token } objects
 *  GET  /api/config           → { supabaseUrl, supabaseAnonKey }
 *  POST /api/bug-report       → { ok }
 *  GET  /api/paper-search     → { papers: [...] }
 *
 * Task 10 — extracted from monolith.
 * Replaces the inline API_BASE constant + ad-hoc fetch() calls scattered
 * across every script block.
 */

// ── Base URL ───────────────────────────────────────────────────────────────
// Override at deploy time by setting window.CHUNKS_BACKEND_URL before this
// module is imported (e.g. via a tiny inline <script> in index.html).
export const API_BASE = (
  window.CHUNKS_BACKEND_URL || 'https://chunks-ai-main-production.up.railway.app'
).replace(/\/$/, '');

// Expose on window so legacy inline script blocks can still read it until
// Phase 5 completes and all callers are migrated to imports.
window.API_BASE = API_BASE;

// ── Internal helpers ───────────────────────────────────────────────────────

/** Shared JSON POST — throws on non-ok status. */
async function _post(path, body, signal) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.error || `Server error ${res.status}`), { status: res.status, data: err });
  }
  return res.json();
}

/** Normalise the answer field — backend uses several key names. */
function _extractAnswer(data) {
  const raw = data.answer ?? data.response ?? data.text ?? data.content ?? data.result ?? '';
  return typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * askQuestion — general AI ask (used by home, workspace, research, study-plan).
 *
 * @param {object} opts
 * @param {string}   opts.question    - User question text
 * @param {string}   [opts.bookId]    - Textbook slug ('atkins', 'none', …)
 * @param {string}   [opts.mode]      - 'general' | 'study' | 'generate' | 'concise' | 'detailed'
 * @param {number}   [opts.complexity]- 1–10 (default 5)
 * @param {Array}    [opts.history]   - Prior turns [{ role, content }]
 * @param {boolean}  [opts.webSearch] - Pass web_search: true to backend
 * @param {AbortSignal} [opts.signal] - Optional abort signal
 * @returns {Promise<{ answer: string, sources: Array, isRelevant: boolean, similarity: number }>}
 */
export async function askQuestion({
  question,
  bookId     = 'none',
  mode       = 'study',
  complexity = 5,
  history    = [],
  webSearch  = false,
  signal,
} = {}) {
  const data = await _post('/ask', {
    question,
    bookId,
    mode,
    complexity,
    history,
    ...(webSearch ? { web_search: true } : {}),
  }, signal);

  return {
    answer:      _extractAnswer(data),
    sources:     data.sources     ?? [],
    isRelevant:  data.is_relevant ?? true,
    similarity:  data.similarity  ?? 1,
    raw:         data,               // pass-through for callers that inspect other fields
  };
}

/**
 * askWithRetry — resilient ask with exponential back-off.
 * Used by exam and study-plan generators that need 'generate' mode and
 * must survive Railway cold-starts and rate limits.
 *
 * @param {string} prompt
 * @param {object} [opts]
 * @param {string}  [opts.mode]      - default 'generate'
 * @param {number}  [opts.complexity]- default 6
 * @param {string}  [opts.bookId]    - default 'none'
 * @param {number}  [opts.retries]   - max extra attempts (default 3)
 * @returns {Promise<string>} trimmed answer text
 */
export async function askWithRetry(prompt, {
  mode       = 'generate',
  complexity = 6,
  bookId     = 'none',
  retries    = 3,
} = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt, mode, complexity, bookId, history: [] }),
      });

      if (resp.status === 429) {
        const wait = 2000 * (attempt + 1);
        if (attempt < retries) { await _sleep(wait); continue; }
        throw new Error('Server is busy — please wait a moment and try again.');
      }
      if (resp.status === 504 || resp.status === 502 || resp.status === 503) {
        if (attempt < retries) { await _sleep(1500 * (attempt + 1)); continue; }
        throw new Error('Server timeout — Railway may be cold-starting, please try again.');
      }
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);

      const data   = await resp.json();
      const answer = _extractAnswer(data);
      if (!answer && attempt < retries) {
        console.warn('[api] Empty answer, retrying…', JSON.stringify(data).slice(0, 200));
        await _sleep(1000);
        continue;
      }
      return answer;

    } catch (err) {
      const isNetwork = err.message.includes('fetch') || err.message.includes('network');
      if (attempt < retries && isNetwork) { await _sleep(1500 * (attempt + 1)); continue; }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * generateFlashcards — create AI flashcard deck for a topic.
 *
 * @param {object} opts
 * @param {string}  opts.topic   - Topic or concept title
 * @param {string}  [opts.bookId]- Textbook context slug (or null)
 * @param {number}  [opts.count] - Cards to generate (default 10)
 * @returns {Promise<Array<{ front: string, back: string }>>}
 */
export async function generateFlashcards({ topic, bookId = null, count = 10 } = {}) {
  const data = await _post('/generate-flashcards', { topic, bookId, count });
  if (!data.success || !data.flashcards?.length) {
    throw new Error(data.error || 'No flashcards returned');
  }
  return data.flashcards;
}

/**
 * fetchPdf — download a textbook PDF as an ArrayBuffer with progress.
 *
 * @param {string}   bookId          - Textbook slug
 * @param {function} [onProgress]    - Called with (loaded, total) bytes
 * @returns {Promise<Uint8Array>}
 */
export async function fetchPdf(bookId, onProgress) {
  const url = `${API_BASE}/pdf/${bookId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const contentLength = response.headers.get('Content-Length');
  const total  = contentLength ? parseInt(contentLength) : 0;
  const reader = response.body.getReader();
  const chunks = [];
  let loaded   = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (onProgress) onProgress(loaded, total);
  }

  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

/**
 * streamLayer — SSE-based streaming for research layer paragraph generation.
 *
 * @param {object}   payload      - Body forwarded to /api/stream-layer
 * @param {function} onToken      - Called with each streamed token string
 * @param {function} onDone       - Called when stream completes
 * @param {function} [onError]    - Called on error (receives Error)
 */
export function streamLayer(payload, onToken, onDone, onError) {
  fetch(`${API_BASE}/api/stream-layer`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  .then(resp => {
    if (!resp.ok) throw new Error(`Stream error ${resp.status}`);
    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    function pump() {
      return reader.read().then(({ done, value }) => {
        if (done) { onDone(); return; }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event: done'))  { onDone(); reader.cancel(); return; }
          if (line.startsWith('event: error')) continue;
          if (!line.startsWith('data: '))      continue;
          try {
            const obj   = JSON.parse(line.slice(6));
            const token = obj.token || '';
            if (token) onToken(token);
          } catch (_) { /* ignore malformed SSE lines */ }
        }
        return pump();
      });
    }
    return pump();
  })
  .catch(err => {
    if (onError) onError(err);
  });
}

/**
 * fetchConfig — load Supabase connection config from the backend.
 * Falls back through multiple backend URLs (prod + fallback).
 *
 * @returns {Promise<{ supabaseUrl: string, supabaseAnonKey: string } | null>}
 */
export async function fetchConfig() {
  const backends = [API_BASE, 'https://chemistry-app-production.up.railway.app'];
  for (const base of backends) {
    try {
      const fetchPromise   = fetch(`${base}/api/config`).then(r => r.json());
      const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000));
      const config = await Promise.race([fetchPromise, timeoutPromise]);
      if (config?.supabaseUrl && config?.supabaseAnonKey) return config;
    } catch (e) {
      console.warn('[api] Config fetch failed from', base, e.message);
    }
  }
  return null;
}

/**
 * submitBugReport — send a bug report to the backend.
 *
 * @param {object} opts
 * @param {string}  opts.category    - Bug category label
 * @param {string}  opts.description - User-supplied description
 * @param {object}  [opts.user]      - User object (email, id, …)
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<void>}
 */
export async function submitBugReport({ category, description, user, signal } = {}) {
  const res = await fetch(`${API_BASE}/api/bug-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, description, user }),
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) throw new Error('server error');
}

/**
 * searchPapers — AI-powered academic paper search.
 *
 * @param {string}      query
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>} raw answer text (JSON string of papers)
 */
export async function searchPapers(query, signal) {
  const url = new URL(`${API_BASE}/api/paper-search`);
  // Alternatively called via /ask with a structured prompt — keep both paths:
  const data = await _post('/ask', {
    question:   query,
    mode:       'study',
    complexity: 5,
    bookId:     'none',
    web_search: false,
    history:    [],
  }, signal);
  return _extractAnswer(data);
}

// ── Utility ────────────────────────────────────────────────────────────────
function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
