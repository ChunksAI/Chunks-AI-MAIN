/**
 * app/api/ai/route.ts
 *
 * Thin server-side proxy to the OpenRouter chat completions API.
 * Keeps OPENROUTER_API_KEY server-only (never exposed to the browser).
 *
 * POST /api/ai
 * Request body: { model: string; messages: { role: string; content: string }[]; max_tokens?: number }
 * Response:     { content: [{ text: string }] }
 */

import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || !('model' in body) || !('messages' in body)) {
    return NextResponse.json({ error: 'Missing required fields: model, messages' }, { status: 400 });
  }

  const { model, messages, max_tokens = 300 } = body as {
    model: string;
    messages: unknown;
    max_tokens?: number;
  };

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens }),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to reach AI service' }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: 'AI service error' }, { status: upstream.status });
  }

  const data = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? '';
  return NextResponse.json({ content: [{ text }] });
}
