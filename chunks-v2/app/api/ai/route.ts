/**
 * app/api/ai/route.ts
 *
 * Thin server-to-server proxy.  The browser posts a task payload here; this
 * route forwards the request (including the Authorization header) to the
 * FastAPI backend, which performs:
 *
 *   • Real Supabase JWT verification — a fake token cannot escalate to the
 *     authenticated rate-limit tier.
 *   • Redis-backed rate limiting (20 req/min for verified users, 5 req/min
 *     for guests) that persists across restarts and is shared across every
 *     worker / serverless instance.
 *   • OpenRouter proxying with the server-only OPENROUTER_API_KEY (never
 *     exposed to the browser).
 *
 * Supported tasks (handled by FastAPI POST /api/ai):
 *   { task: "fbd",              question, aiText? }
 *   { task: "research-summary", title,    abstract? }
 *
 * Error status codes
 * ──────────────────
 * - 429  Rate limit exceeded (from backend)
 * - 503  Backend not configured / model env var missing
 * - 504  OpenRouter timed out
 * - 502  OpenRouter / backend unreachable
 */

import { NextRequest, NextResponse } from 'next/server';

const _BACKEND_BASE = (
  process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'https://api.chunks.online'
).replace(/\/$/, '');

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Read the body up front so the stream is not forwarded in a half-consumed
  // state (which can cause fetch errors in some Node.js / Edge runtimes).
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  const authHeader = req.headers.get('authorization');

  let upstream: Response;
  try {
    upstream = await fetch(`${_BACKEND_BASE}/api/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: rawBody,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return NextResponse.json({ error: 'AI service timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to reach AI service' }, { status: 502 });
  }

  // Stream the backend response body back to the browser, preserving status.
  const data = await upstream.json() as unknown;
  return NextResponse.json(data, { status: upstream.status });
}

