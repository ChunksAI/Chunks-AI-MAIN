/**
 * app/api/youtube/transcript/route.ts
 *
 * Server-side proxy for fetching YouTube transcripts.
 *
 * The browser cannot call YouTube directly due to CSP and CORS restrictions.
 * This route runs fetchYouTubeTranscript() on the server (where neither
 * constraint applies) and returns the result to the client.
 *
 * GET /api/youtube/transcript?url=<YouTube URL or 11-char video ID>
 *
 * Response shape: FetchTranscriptResult
 *   { entries: TranscriptEntry[], title: string, videoId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchYouTubeTranscript } from '@/lib/youtubeTranscript';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing required parameter: url' }, { status: 400 });
  }

  try {
    const result = await fetchYouTubeTranscript(url);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch transcript';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
