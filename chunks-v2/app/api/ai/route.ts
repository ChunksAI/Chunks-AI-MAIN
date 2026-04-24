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
 * - 503  OPENROUTER_API_KEY or task model env var missing
 * - 504  OpenRouter call timed out (AbortError)
 * - 502  OpenRouter unreachable (other network error)
 *
 * Adding a new task
 * ─────────────────
 * Add a new `case` to the switch below.  The handler receives the validated
 * body and returns { model, messages, max_tokens } for the OpenRouter call.
 */

import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FBD_TIMEOUT_MS = 15_000;

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
    // AbortError means AbortSignal.timeout fired → 504 Gateway Timeout.
    // Any other network-level error → 502 Bad Gateway.
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'AI service timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to reach AI service' }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: 'AI service error' }, { status: upstream.status });
  }

  const data = (await upstream.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? '';
  return NextResponse.json({ content: [{ text }] });
}
