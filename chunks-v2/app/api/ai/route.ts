/**
 * app/api/ai/route.ts
 *
 * Thin server-side proxy to the Anthropic Messages API.
 * Keeps ANTHROPIC_API_KEY server-only (never exposed to the browser).
 *
 * POST /api/ai
 * Request body: { model: string; messages: AnthropicMessage[]; max_tokens?: number }
 * Response:     { content: [{ text: string }] }  (subset of Anthropic response)
 */

import { NextRequest, NextResponse } from 'next/server';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
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
    upstream = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ model, messages, max_tokens }),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to reach AI service' }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: 'AI service error' }, { status: upstream.status });
  }

  const data = await upstream.json() as { content?: Array<{ text?: string }> };
  return NextResponse.json(data);
}
