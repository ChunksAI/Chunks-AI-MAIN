/**
 * app/api/ai/route.ts
 *
 * Task-based server-side AI proxy.  The browser sends a task name plus
 * task-specific payload — never a raw model ID, messages array, or max_tokens.
 * Model selection and prompt construction happen entirely server-side.
 *
 * Keeps OPENROUTER_API_KEY and FBD_MODEL server-only (never exposed to the
 * browser).
 *
 * Security
 * ────────
 * - Rate-limited per IP + auth digest: 20 req/min (authenticated), 5 req/min (guest).
 * - Origin check: in production, the Origin header must match APP_URL (or a
 *   localhost origin) to reject cross-site drive-by calls.
 * - Auth forwarding: callers should include `Authorization: Bearer <token>` so
 *   authenticated users get the more generous rate-limit tier.
 * - Structured request logging for every invocation.
 *
 * Supported tasks
 * ───────────────
 * POST /api/ai  { task: "fbd", question: string, aiText: string }
 *   → { content: [{ text: string }] }
 *
 * POST /api/ai  { task: "research-summary", title: string, abstract: string }
 *   → { content: [{ text: string }] }
 *
 * Validation rules (fbd task)
 * ───────────────────────────
 * - question: required, 1–1000 chars (trimmed)
 * - aiText:   optional, 0–2500 chars (trimmed)
 * - FBD_MODEL env var must be set; returns 503 otherwise (silently ignored
 *   by the frontend so chat is never disrupted).
 *
 * Error status codes
 * ──────────────────
 * - 429  Rate limit exceeded
 * - 403  Origin not allowed (production only)
 * - 503  OPENROUTER_API_KEY or task model env var missing
 * - 504  OpenRouter call timed out (AbortError)
 * - 502  OpenRouter unreachable (other network error)
 *
 * Adding a new task
 * ─────────────────
 * Add a new `case` to the switch below.  The handler receives the validated
 * body and returns { model, messages, max_tokens } for the OpenRouter call.
 */

import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FBD_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Sliding-window rate limiter
// Two tiers:
//   • Authenticated (Authorization header present): 20 req/min
//   • Guest (no Authorization header):              5 req/min
// Keyed by IP + sha256(Authorization)[:32] — same pattern as youtube/transcript.
// ---------------------------------------------------------------------------
const _RL_WINDOW_MS = 60_000;
const _RL_MAX_AUTH = 20;
const _RL_MAX_GUEST = 5;
const _rlBuckets = new Map<string, number[]>();

function _isRateLimited(request: NextRequest): boolean {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const auth = request.headers.get('authorization') ?? '';
  const authDigest = auth ? createHash('sha256').update(auth).digest('hex').slice(0, 32) : '';
  const bucketKey = `${ip}:${authDigest}`;
  const limit = authDigest ? _RL_MAX_AUTH : _RL_MAX_GUEST;
  const now = Date.now();
  const cutoff = now - _RL_WINDOW_MS;
  const timestamps = (_rlBuckets.get(bucketKey) ?? []).filter((t) => t > cutoff);
  if (timestamps.length >= limit) {
    _rlBuckets.set(bucketKey, timestamps);
    return true;
  }
  timestamps.push(now);
  _rlBuckets.set(bucketKey, timestamps);
  return false;
}

// ---------------------------------------------------------------------------
// Origin check (production only)
// Rejects requests whose Origin header doesn't match APP_URL.
// Localhost origins are always allowed (dev / internal tooling).
// ---------------------------------------------------------------------------
const _APP_URL = (process.env.APP_URL ?? '').replace(/\/$/, '');

function _isOriginAllowed(request: NextRequest): boolean {
  // Only enforce in production when APP_URL is explicitly configured.
  if (process.env.NODE_ENV !== 'production' || !_APP_URL) return true;
  const origin = request.headers.get('origin') ?? '';
  if (!origin) {
    // No Origin header — allow server-to-server calls (e.g. internal proxies).
    return true;
  }
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    return true;
  }
  return origin === _APP_URL;
}

// ---------------------------------------------------------------------------
// Structured request logging
// ---------------------------------------------------------------------------
function _logRequest(opts: {
  task: string;
  ip: string;
  authenticated: boolean;
  durationMs: number;
  status: number;
}): void {
  console.log(
    JSON.stringify({
      event: 'ai_route_request',
      task: opts.task,
      ip: opts.ip,
      authenticated: opts.authenticated,
      duration_ms: opts.durationMs,
      status: opts.status,
      ts: new Date().toISOString(),
    }),
  );
}

/**
 * Build the OpenRouter request for the "research-summary" task.
 * Produces a 3–4 sentence student-friendly summary of a paper.
 * Model: RESEARCH_SUMMARY_MODEL env var, falling back to FBD_MODEL.
 */
function buildResearchSummaryRequest(
  body: Record<string, unknown>,
): { ok: true; req: OpenRouterRequest } | { ok: false; res: NextResponse } {
  const model = process.env.RESEARCH_SUMMARY_MODEL ?? process.env.FBD_MODEL;
  if (!model) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'Research summary model not configured' }, { status: 503 }),
    };
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const abstract = typeof body.abstract === 'string' ? body.abstract.trim() : '';

  if (!title && !abstract) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'title or abstract is required' }, { status: 400 }),
    };
  }
  if (title.length > 500) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'title exceeds 500 character limit' }, { status: 400 }),
    };
  }
  if (abstract.length > 4000) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'abstract exceeds 4000 character limit' }, { status: 400 }),
    };
  }

  const prompt =
    `You are a research assistant. In 3–4 sentences, summarize the key findings and contributions of this paper for a student.\n\n` +
    (title ? `Title: ${title}\n\n` : '') +
    (abstract ? `Abstract: ${abstract}` : '');

  return {
    ok: true,
    req: {
      model,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    },
  };
}

// ─── Task handlers ────────────────────────────────────────────────────────────

interface OpenRouterRequest {
  model: string;
  messages: { role: string; content: string }[];
  max_tokens: number;
}

/**
 * Build the OpenRouter request for the "fbd" task.
 * Returns null (with a NextResponse error) when the env var is missing or
 * inputs are invalid.
 */
function buildFbdRequest(
  body: Record<string, unknown>,
): { ok: true; req: OpenRouterRequest } | { ok: false; res: NextResponse } {
  const fbdModel = process.env.FBD_MODEL;
  if (!fbdModel) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'FBD model not configured' }, { status: 503 }),
    };
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const aiText = typeof body.aiText === 'string' ? body.aiText.trim() : '';

  if (!question) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'question is required' }, { status: 400 }),
    };
  }
  if (question.length > 1000) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'question exceeds 1000 character limit' }, { status: 400 }),
    };
  }
  if (aiText.length > 2500) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'aiText exceeds 2500 character limit' }, { status: 400 }),
    };
  }

  const prompt =
    `You are a physics diagram generator. Analyze the physics problem below and output ONLY a valid JSON object for a Free Body Diagram. Do NOT include any explanation or markdown fences — output raw JSON only.\n\n` +
    `Schema:\n` +
    `{\n` +
    `  "object": "box" | "ball" | "hanging_mass",\n` +
    `  "surface": "flat" | "incline" (optional),\n` +
    `  "inclineAngle": number (optional, 0–90 degrees),\n` +
    `  "forces": [\n` +
    `    { "label": string, "magnitude": number (Newtons), "angle": number (0=right 90=up 180=left 270=down), "color": "#hex" (optional) }\n` +
    `  ]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Always include Weight (angle=270) and Normal force (angle=90 for flat surface).\n` +
    `- Add Friction (angle=0 or 180), Tension, or Applied Force when mentioned.\n` +
    `- Estimate realistic magnitudes in Newtons if not explicitly given (Weight=100 for typical objects).\n` +
    `- Output ONLY the JSON object.\n\n` +
    `Physics problem:\n${question}\n\n` +
    (aiText ? `AI explanation (context):\n${aiText}` : '');

  return {
    ok: true,
    req: {
      model: fbdModel,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    },
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startMs = Date.now();
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const authenticated = Boolean(req.headers.get('authorization'));

  // ── Origin check ──────────────────────────────────────────────────────────
  if (!_isOriginAllowed(req)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  if (_isRateLimited(req)) {
    _logRequest({ task: 'unknown', ip, authenticated, durationMs: Date.now() - startMs, status: 429 });
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before trying again.' },
      { status: 429 },
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.json() as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }
    body = raw as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const task = typeof body.task === 'string' ? body.task : null;
  if (!task) {
    return NextResponse.json({ error: 'Missing required field: task' }, { status: 400 });
  }

  let orRequest: OpenRouterRequest;
  switch (task) {
    case 'fbd': {
      const result = buildFbdRequest(body);
      if (!result.ok) return result.res;
      orRequest = result.req;
      break;
    }
    case 'research-summary': {
      const result = buildResearchSummaryRequest(body);
      if (!result.ok) return result.res;
      orRequest = result.req;
      break;
    }
    default:
      return NextResponse.json({ error: `Unknown task: ${task}` }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(orRequest),
      signal: AbortSignal.timeout(FBD_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    // AbortSignal.timeout() throws a DOMException with name 'TimeoutError' in
    // modern runtimes (Node ≥ 18) and 'AbortError' in some older environments.
    // Check both names so the 504 is returned reliably.
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      _logRequest({ task, ip, authenticated, durationMs: Date.now() - startMs, status: 504 });
      return NextResponse.json({ error: 'AI service timed out' }, { status: 504 });
    }
    _logRequest({ task, ip, authenticated, durationMs: Date.now() - startMs, status: 502 });
    return NextResponse.json({ error: 'Failed to reach AI service' }, { status: 502 });
  }

  if (!upstream.ok) {
    _logRequest({ task, ip, authenticated, durationMs: Date.now() - startMs, status: upstream.status });
    return NextResponse.json({ error: 'AI service error' }, { status: upstream.status });
  }

  const data = (await upstream.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? '';
  _logRequest({ task, ip, authenticated, durationMs: Date.now() - startMs, status: 200 });
  return NextResponse.json({ content: [{ text }] });
}
