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

import { createHash, createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { fetchYouTubeTranscript, YouTubeApiError } from '@/lib/youtubeTranscript';

// ---------------------------------------------------------------------------
// Lightweight in-memory sliding-window rate limiter
// Keyed by (IP + first 16 chars of Authorization header hash) so every caller
// gets an independent bucket without storing the raw token.
// Limit: 10 requests per 60-second window.
// ---------------------------------------------------------------------------
const _RL_MAX = 10;
const _RL_WINDOW_MS = 60_000;
// Map<bucketKey, timestamps[]>
const _rlBuckets = new Map<string, number[]>();

function _isRateLimited(request: NextRequest): boolean {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const auth = request.headers.get('authorization') ?? '';
  // Hash the full Authorization header so each user gets their own independent
  // bucket, matching the per-user isolation approach used in the backend limiter.
  const authDigest = auth ? createHash('sha256').update(auth).digest('hex').slice(0, 32) : '';
  const bucketKey = `${ip}:${authDigest}`;
  const now = Date.now();
  const cutoff = now - _RL_WINDOW_MS;
  const timestamps = (_rlBuckets.get(bucketKey) ?? []).filter((t) => t > cutoff);
  if (timestamps.length >= _RL_MAX) {
    _rlBuckets.set(bucketKey, timestamps);
    return true;
  }
  timestamps.push(now);
  _rlBuckets.set(bucketKey, timestamps);
  return false;
}

const _HMAC_SECRET = process.env.TRANSCRIPT_HMAC_SECRET ?? '';
if (!_HMAC_SECRET) {
  // Log once at module load time so the missing secret is visible in server logs.
  console.warn(
    '[youtube/transcript] TRANSCRIPT_HMAC_SECRET is not set — ' +
      'transcript signature verification is DISABLED. ' +
      'Set this environment variable in production to prevent cache poisoning.',
  );
}

// ---------------------------------------------------------------------------
// Version-error threshold alerting
// Counts is_version_error events in a 10-min rolling window and emits a
// structured alert log (and optional Sentry capture) when >= 5 occur.
// The alert is rate-limited to once per 10-min window to avoid log spam.
// ---------------------------------------------------------------------------
const _VE_WINDOW_MS = 10 * 60 * 1_000; // 10 minutes
const _VE_THRESHOLD = 5;
const _veTimestamps: number[] = [];
let _veLastAlertAt = 0;

function _recordVersionError(): void {
  const now = Date.now();
  const cutoff = now - _VE_WINDOW_MS;
  // Purge timestamps outside the window (oldest are at the front).
  while (_veTimestamps.length > 0 && _veTimestamps[0] < cutoff) _veTimestamps.shift();
  _veTimestamps.push(now);
  if (_veTimestamps.length >= _VE_THRESHOLD && now - _veLastAlertAt >= _VE_WINDOW_MS) {
    _veLastAlertAt = now;
    const payload = { event: 'youtube_version_error_threshold', count: _veTimestamps.length, window_secs: 600 };
    console.error(JSON.stringify(payload));
    // Optionally forward to Sentry if the DSN is configured and the package is
    // available (it is NOT a required dependency — the import is best-effort).
    if (process.env.SENTRY_DSN) {
      // Use a variable to prevent TypeScript from statically resolving the
      // optional package, which may not be installed.
      const sentryPkg = '@sentry/nextjs';
      void import(
        /* webpackIgnore: true */
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        sentryPkg,
      )
        .then((Sentry: { captureMessage: (msg: string, opts: object) => void }) => {
          Sentry.captureMessage('youtube_version_error_threshold', {
            level: 'error',
            tags: payload,
          });
        })
        .catch(() => { /* Sentry not installed — skip */ });
    }
  }
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
  if (_isRateLimited(request)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before trying again.' },
      { status: 429 },
    );
  }

  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing required parameter: url' }, { status: 400 });
  }

  try {
    const result = await fetchYouTubeTranscript(url);
    const sig = _signTranscript(result.videoId, result.entries);
    return NextResponse.json({ ...result, sig });
  } catch (err) {
    const isYtApiError = err instanceof YouTubeApiError;
    const ytStatus = isYtApiError ? err.ytStatus : undefined;
    const message = err instanceof Error ? err.message : 'Failed to fetch transcript';

    // Emit a structured log entry so log-aggregation pipelines (Datadog,
    // CloudWatch, Loki, etc.) can alert on YouTube API failures.  The
    // `yt_status` field can be used as an alert tag / filter dimension.
    // When `is_version_error` is true, check INNERTUBE_CLIENTS
    // in lib/youtubeTranscript.ts — YouTube may have rotated its client API.
    // See docs/YOUTUBE_CLIENT_VERSION_RUNBOOK.md for the update procedure.
    console.error(
      JSON.stringify({
        event: 'youtube_transcript_fetch_failed',
        yt_status: ytStatus ?? null,
        // true only when every entry in INNERTUBE_CLIENTS was tried and rejected
        is_version_error: isYtApiError,
        error: message,
        ts: new Date().toISOString(),
      }),
    );

    if (isYtApiError) {
      _recordVersionError();
    }

    // Upstream YouTube failures are a bad-gateway problem (502), not an
    // internal server error (500).  Using the correct status code prevents
    // monitoring dashboards from firing "our server is down" alerts when
    // YouTube is the party at fault.
    const httpStatus = isYtApiError ? 502 : 500;
    return NextResponse.json(
      { error: message, ...(ytStatus !== undefined && { yt_status: ytStatus }) },
      { status: httpStatus },
    );
  }
}
