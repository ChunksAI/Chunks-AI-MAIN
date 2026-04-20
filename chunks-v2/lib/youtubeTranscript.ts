/**
 * lib/youtubeTranscript.ts — YouTube transcript fetcher via InnerTube API.
 *
 * Fetches a video's caption track via YouTube's internal InnerTube API.
 * This module is intended to be called **server-side only** (e.g. from a
 * Next.js API route) — direct browser calls may fail on certain networks or
 * regions due to CORS restrictions or YouTube policy changes.
 *
 * Call flow:
 *   fetchYouTubeTranscript(urlOrId)
 *     → POST /youtubei/v1/player (InnerTube, ANDROID client context)
 *     → extract captionTracks from JSON response
 *     → select best caption track
 *     → fetch caption XML (baseUrl from player response)
 *     → parse <text> nodes
 *     → return { entries, title, videoId }
 */

export interface TranscriptEntry {
  text: string;
  start: number;
  duration: number;
}

export interface FetchTranscriptResult {
  entries: TranscriptEntry[];
  title: string;
  videoId: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const VIDEO_ID_RE = /(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/;

function extractVideoId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  // Accept a bare 11-character video ID directly
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(VIDEO_ID_RE);
  return m ? m[1] : null;
}

/**
 * Decode HTML entities and strip any XML tags from a caption text node.
 * YouTube sometimes wraps text in <font> or <b> tags and HTML-encodes
 * characters like &amp; and &#39;.
 *
 * Uses a single-pass lookup so that encoded entities are never double-decoded
 * (e.g. &amp;lt; → &lt;, not <).
 */
function decodeCaption(raw: string): string {
  const ENTITIES: Record<string, string> = {
    '&amp;':  '&',
    '&lt;':   '<',
    '&gt;':   '>',
    '&quot;': '"',
    '&#39;':  "'",
    '&#x27;': "'",
  };
  return raw
    .replace(/<[^>]*>/g, '')  // strip XML/HTML tags before entity decoding
    .replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (entity) => ENTITIES[entity] ?? entity)
    .trim();
}

/**
 * Parse YouTube's timed-text XML into TranscriptEntry objects.
 * Each entry looks like:
 *   <text start="0.5" dur="2.3">Hello &amp; world</text>
 *
 * Caption text in YouTube's timed-text format never contains literal '<'
 * (it is encoded as \u003c / &lt;), so [^<]* is safe and efficient.
 */
function parseCaptionXml(xml: string): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  const RE = /<text\s[^>]*\bstart="([^"]+)"[^>]*\bdur="([^"]+)"[^>]*>([^<]*)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(xml)) !== null) {
    const text = decodeCaption(m[3]);
    if (text) {
      entries.push({
        text,
        start: parseFloat(m[1]),
        duration: parseFloat(m[2]),
      });
    }
  }
  return entries;
}

// ─── InnerTube API constants ───────────────────────────────────────────────────

/**
 * YouTube's internal InnerTube player endpoint.  No API key is required for
 * public videos when using the ANDROID client context.
 */
const INNERTUBE_PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player';

/**
 * InnerTube ANDROID client versions tried in order.
 *
 * YouTube silently rejects stale client versions with HTTP 400 or 403.
 * Keeping multiple versions lets the library automatically fall back while the
 * primary entry is updated.
 *
 * To bump the version (see docs/YOUTUBE_CLIENT_VERSION_RUNBOOK.md):
 *   1. Prepend the new version string to this array.
 *   2. Remove versions that have been consistently rejected for > 30 days.
 *   3. Update the matching User-Agent string if it embeds a version number.
 */
export const INNERTUBE_CLIENT_VERSIONS: readonly string[] = [
  '19.09.37',
  '17.31.35',
];

/**
 * A custom error thrown when the InnerTube player API rejects every client
 * version in {@link INNERTUBE_CLIENT_VERSIONS}.  The `ytStatus` property
 * carries the last HTTP status code returned by YouTube so callers can log
 * structured alerts (e.g. tag the status code in Sentry / a log pipeline).
 */
export class YouTubeApiError extends Error {
  /** The last HTTP status code returned by the YouTube InnerTube API. */
  readonly ytStatus: number;

  constructor(message: string, ytStatus: number) {
    super(message);
    this.name = 'YouTubeApiError';
    this.ytStatus = ytStatus;
  }
}

/** Build an InnerTube ANDROID client context object for the given version. */
function _buildInnerTubeContext(clientVersion: string) {
  return {
    client: {
      clientName: 'ANDROID',
      clientVersion,
      androidSdkVersion: 30,
      hl: 'en',
      gl: 'US',
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch and parse a YouTube video's transcript via the InnerTube API.
 *
 * Can be called from the browser or server-side — the InnerTube player
 * endpoint and YouTube caption XML URLs support CORS.
 *
 * @param urlOrId  A full YouTube URL or a bare 11-character video ID.
 * @returns        The parsed transcript entries along with the video title
 *                 and the canonical video ID.
 * @throws         An Error with a descriptive message if the video ID cannot
 *                 be extracted, the player API call fails, or no caption tracks
 *                 are available for the video.
 */
export async function fetchYouTubeTranscript(urlOrId: string): Promise<FetchTranscriptResult> {
  const videoId = extractVideoId(urlOrId);
  if (!videoId) {
    throw new Error('Could not extract a video ID from that URL');
  }

  // ── 1. Fetch player data via InnerTube API (with client-version rotation) ───
  //
  // YouTube silently rotates the set of accepted client versions.  On HTTP 400
  // or 403 we try the next version in INNERTUBE_CLIENT_VERSIONS.  Any other
  // non-2xx status code is treated as a non-version-related failure and the
  // loop is broken immediately.
  let playerData: Record<string, unknown> | null = null;
  let lastStatus = 0;

  for (const version of INNERTUBE_CLIENT_VERSIONS) {
    const playerRes = await fetch(INNERTUBE_PLAYER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: _buildInnerTubeContext(version), videoId }),
      signal: AbortSignal.timeout(10_000),
    });

    if (playerRes.ok) {
      playerData = await playerRes.json() as Record<string, unknown>;
      break;
    }

    lastStatus = playerRes.status;
    // Only retry on version-rejection codes (400, 403).
    // 429 (rate-limit), 5xx (server error), etc. are not version problems.
    if (playerRes.status !== 400 && playerRes.status !== 403) break;
  }

  if (!playerData) {
    throw new YouTubeApiError(
      `YouTube player API returned HTTP ${lastStatus} for all ${INNERTUBE_CLIENT_VERSIONS.length} client version(s) tried`,
      lastStatus,
    );
  }

  // ── 2. Extract video title ─────────────────────────────────────────────────
  const title: string =
    (playerData?.videoDetails as Record<string, unknown>)?.title as string ??
    `YouTube — ${videoId}`;

  // ── 3. Select best caption track ──────────────────────────────────────────
  type CaptionTrack = { baseUrl: string; languageCode: string; kind?: string };
  const captionTracks: CaptionTrack[] =
    (
      (playerData?.captions as Record<string, unknown>)
        ?.playerCaptionsTracklistRenderer as Record<string, unknown>
    )?.captionTracks as CaptionTrack[] ?? [];

  if (!captionTracks.length) {
    throw new Error('No transcript available for this video');
  }

  // Prefer English manual (kind !== 'asr'), then English auto-generated, then any
  const track: CaptionTrack =
    captionTracks.find(t => t.kind !== 'asr' && t.languageCode?.startsWith('en')) ??
    captionTracks.find(t => t.languageCode?.startsWith('en')) ??
    captionTracks[0];

  // ── 4. Fetch the caption XML ───────────────────────────────────────────────
  const xmlRes = await fetch(track.baseUrl, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!xmlRes.ok) {
    throw new Error(`Failed to fetch caption track — HTTP ${xmlRes.status}`);
  }

  const xml = await xmlRes.text();

  // ── 5. Parse and return ───────────────────────────────────────────────────
  const entries = parseCaptionXml(xml);
  return { entries, title, videoId };
}
