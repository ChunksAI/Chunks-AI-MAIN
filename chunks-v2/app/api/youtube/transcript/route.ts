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

  // ── Step 1: Try InnerTube API ───────────────────────────────────────────────
  let innerTubeErr: Error | null = null;
  let innerTubeIsYtApiErr = false;
  let innerTubeYtStatus: number | undefined;

  try {
    const result = await fetchYouTubeTranscript(url);
    const sig = _signTranscript(result.videoId, result.entries);
    return NextResponse.json({ ...result, sig });
  } catch (err) {
    innerTubeErr = err instanceof Error ? err : new Error('Failed to fetch transcript');
    innerTubeIsYtApiErr = err instanceof YouTubeApiError;
    innerTubeYtStatus = innerTubeIsYtApiErr ? (err as YouTubeApiError).ytStatus : undefined;

    // Emit a structured log entry so log-aggregation pipelines (Datadog,
    // CloudWatch, Loki, etc.) can alert on YouTube API failures.  The
    // `yt_status` field can be used as an alert tag / filter dimension.
    // When `is_version_error` is true, check INNERTUBE_CLIENTS
    // in lib/youtubeTranscript.ts — YouTube may have rotated its client API.
    // See docs/YOUTUBE_CLIENT_VERSION_RUNBOOK.md for the update procedure.
    console.warn(
      JSON.stringify({
        event: 'youtube_transcript_innertube_failed',
        yt_status: innerTubeYtStatus ?? null,
        // true only when every entry in INNERTUBE_CLIENTS was tried and rejected
        is_version_error: innerTubeIsYtApiErr,
        error: innerTubeErr.message,
        ts: new Date().toISOString(),
      }),
    );

    if (innerTubeIsYtApiErr) {
      _recordVersionError();
    }
  }

  // ── Step 2: Fall back to the Python backend (youtube-transcript-api) ────────
  // The backend uses a different fetching mechanism (page-HTML scraping) that
  // may succeed for videos where the InnerTube mobile-client approach fails
  // (e.g. certain region restrictions, client-version rejections, or videos
  // that require a poToken).
  //
  // We extract the video ID from the URL first so we can call the backend
  // even when InnerTube returned an HTTP error and we never had playerData.
  const videoIdMatch =
    url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/) ??
    (/^[A-Za-z0-9_-]{11}$/.test(url.trim()) ? [null, url.trim()] : null);
  const videoId = videoIdMatch?.[1] ?? null;

  if (videoId) {
    try {
      const backendBase = (process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'https://api.chunks.online').replace(/\/$/, '');
      const authHeader = request.headers.get('authorization');
      const backendRes = await fetch(
        `${backendBase}/api/youtube/transcript?video_id=${encodeURIComponent(videoId)}`,
        {
          headers: {
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          signal: AbortSignal.timeout(20_000),
        },
      );

      if (backendRes.ok) {
        const backendData = (await backendRes.json()) as {
          success: boolean;
          video_id: string;
          title?: string;
          entries: { text: string; start: number; duration: number }[];
        };

        if (backendData.success && Array.isArray(backendData.entries) && backendData.entries.length > 0) {
          console.log(
            JSON.stringify({
              event: 'youtube_transcript_backend_fallback_success',
              video_id: videoId,
              entries: backendData.entries.length,
              ts: new Date().toISOString(),
            }),
          );
          const sig = _signTranscript(videoId, backendData.entries);
          return NextResponse.json({
            entries: backendData.entries,
            title: backendData.title ?? `YouTube \u2014 ${videoId}`,
            videoId,
            sig,
          });
        }
      }
    } catch (backendErr) {
      console.warn('[youtube/transcript] Backend fallback also failed:', backendErr);
    }
  }

  // ── Step 3: Both methods failed — return the original error ─────────────────
  console.error(
    JSON.stringify({
      event: 'youtube_transcript_fetch_failed',
      yt_status: innerTubeYtStatus ?? null,
      is_version_error: innerTubeIsYtApiErr,
      error: innerTubeErr?.message ?? 'Failed to fetch transcript',
      ts: new Date().toISOString(),
    }),
  );

  // Upstream YouTube failures are a bad-gateway problem (502), not an
  // internal server error (500).  Using the correct status code prevents
  // monitoring dashboards from firing "our server is down" alerts when
  // YouTube is the party at fault.
  const httpStatus = innerTubeIsYtApiErr ? 502 : 500;
  return NextResponse.json(
    {
      error: innerTubeErr?.message ?? 'Failed to fetch transcript',
      ...(innerTubeYtStatus !== undefined && { yt_status: innerTubeYtStatus }),
    },
    { status: httpStatus },
  );
}
