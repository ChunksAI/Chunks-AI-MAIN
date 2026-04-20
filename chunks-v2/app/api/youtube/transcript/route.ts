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
 * Response shape: FetchTranscriptResult + sig
 *   { entries: TranscriptEntry[], title: string, videoId: string, sig: string }
 *
 * `sig` is an HMAC-SHA256 over "videoId:entry_texts_joined_by_newline" using
 * the server-only TRANSCRIPT_HMAC_SECRET environment variable.  The backend
 * /api/youtube/process endpoint verifies this signature before trusting the
 * browser-supplied entries, preventing cache-poisoning attacks.
 */

import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { fetchYouTubeTranscript } from '@/lib/youtubeTranscript';

const _HMAC_SECRET = process.env.TRANSCRIPT_HMAC_SECRET ?? '';
if (!_HMAC_SECRET) {
  // Log once at module load time so the missing secret is visible in server logs.
  console.warn(
    '[youtube/transcript] TRANSCRIPT_HMAC_SECRET is not set — ' +
      'transcript signature verification is DISABLED. ' +
      'Set this environment variable in production to prevent cache poisoning.',
  );
}

/**
 * Compute an HMAC-SHA256 signature over the transcript content.
 * The message is "videoId:<all entry texts joined by newline>" encoded as UTF-8.
 * Returns an empty string when the secret is not configured (dev/test mode).
 */
function _signTranscript(
  videoId: string,
  entries: { text: string; start: number; duration: number }[],
): string {
  if (!_HMAC_SECRET) return '';
  const textBlob = entries.map((e) => e.text).join('\n');
  return createHmac('sha256', _HMAC_SECRET)
    .update(`${videoId}:${textBlob}`, 'utf8')
    .digest('hex');
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing required parameter: url' }, { status: 400 });
  }

  try {
    const result = await fetchYouTubeTranscript(url);
    const sig = _signTranscript(result.videoId, result.entries);
    return NextResponse.json({ ...result, sig });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch transcript';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
