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
 * InnerTube client descriptors tried in order.  This is the built-in default
 * fallback used when no remote client list is configured or when the remote
 * fetch fails.
 *
 * YouTube silently rejects stale client versions with HTTP 400 or 403 and
 * increasingly requires a `poToken`/`visitorData` for the ANDROID client on
 * many videos.  The IOS client currently works without a poToken and is
 * therefore the preferred primary.  ANDROID is kept as a fallback.  WEB is
 * tried last; it requires `visitorData` which is fetched lazily via
 * {@link _getVisitorData}.
 *
 * Both `X-YouTube-Client-Name` and `X-YouTube-Client-Version` request headers
 * are required by the current InnerTube backend in addition to the matching
 * fields in the JSON body.
 *
 * To update versions (see docs/YOUTUBE_CLIENT_VERSION_RUNBOOK.md):
 *   1. Prepend a new entry to this array (or update an existing version).
 *   2. Remove entries that have been consistently rejected for > 30 days.
 *   3. Keep `clientVersion` and `userAgent` version strings in sync.
 */
export const INNERTUBE_CLIENTS: readonly {
  clientName: 'IOS' | 'ANDROID' | 'WEB';
  /**
   * Numeric client-name sent as the X-YouTube-Client-Name header.
   * IOS=5, ANDROID=3, WEB=1.
   */
  clientNameId: 5 | 3 | 1;
  clientVersion: string;
  userAgent: string;
  /** Extra fields merged into the InnerTube context.client object. */
  extra?: Record<string, unknown>;
}[] = [
  {
    clientName:    'IOS',
    clientNameId:  5,
    clientVersion: '19.45.4',
    userAgent:     'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X)',
    extra: { deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '17.5.1.21F90' },
  },
  {
    clientName:    'ANDROID',
    clientNameId:  3,
    clientVersion: '19.44.38',
    userAgent:     'com.google.android.youtube/19.44.38 (Linux; U; Android 14) gzip',
    extra: { androidSdkVersion: 34, osName: 'Android', osVersion: '14' },
  },
  {
    // WEB client.  Requires visitorData — fetched lazily by _getVisitorData()
    // and injected at request time by fetchYouTubeTranscript().
    clientName:    'WEB',
    clientNameId:  1,
    clientVersion: '2.20240709.00.00',
    userAgent:     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  },
];

// ─── visitorData (required by WEB client) ────────────────────────────────────

const _VD_TTL_MS = 6 * 60 * 60 * 1_000; // 6 hours
let _vdCache: { data: string; fetchedAt: number } | null = null;

/**
 * Fetch a YouTube visitor-data token, required for WEB-client requests.
 * Cached for 6 h; returns null on any failure.
 */
async function _getVisitorData(): Promise<string | null> {
  const now = Date.now();
  if (_vdCache && now - _vdCache.fetchedAt < _VD_TTL_MS) return _vdCache.data;
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/visitor_id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20240709.00.00', hl: 'en', gl: 'US' } },
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const json = await res.json() as Record<string, unknown>;
    const vd =
      ((json?.responseContext as Record<string, unknown>)?.visitorData as string | undefined) ?? null;
    if (vd) _vdCache = { data: vd, fetchedAt: now };
    return vd;
  } catch {
    return null;
  }
}

// ─── Remote client-list config (INNERTUBE_CLIENTS_URL) ───────────────────────

/** A single InnerTube client descriptor (possibly from remote config). */
type ClientDescriptor = {
  clientName: string;
  clientNameId: number;
  clientVersion: string;
  userAgent: string;
  extra?: Record<string, unknown>;
};

const _CL_TTL_MS = 6 * 60 * 60 * 1_000; // 6 hours
let _clCache: { data: ClientDescriptor[]; fetchedAt: number } | null = null;

function _isValidClientList(val: unknown): val is ClientDescriptor[] {
  return (
    Array.isArray(val) &&
    val.length > 0 &&
    val.every(
      (c) =>
        c !== null &&
        typeof c === 'object' &&
        typeof (c as Record<string, unknown>).clientName === 'string' &&
        typeof (c as Record<string, unknown>).clientNameId === 'number' &&
        typeof (c as Record<string, unknown>).clientVersion === 'string' &&
        typeof (c as Record<string, unknown>).userAgent === 'string',
    )
  );
}

async function _fetchRemoteClients(): Promise<ClientDescriptor[] | null> {
  const url = process.env.INNERTUBE_CLIENTS_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) {
      console.warn(`[youtubeTranscript] INNERTUBE_CLIENTS_URL fetch failed: HTTP ${res.status}`);
      return null;
    }
    const json: unknown = await res.json();
    if (!_isValidClientList(json)) {
      console.warn('[youtubeTranscript] INNERTUBE_CLIENTS_URL response has invalid shape; using built-in defaults');
      return null;
    }
    return json;
  } catch (err) {
    console.warn('[youtubeTranscript] INNERTUBE_CLIENTS_URL fetch error; using built-in defaults:', err);
    return null;
  }
}

/**
 * Returns the current InnerTube client list.
 *
 * If `INNERTUBE_CLIENTS_URL` is set and the cached copy is fresh (≤ 6 h),
 * the remote list is returned.  Otherwise the request is re-fetched and the
 * result cached.  On any fetch or parse failure the built-in
 * {@link INNERTUBE_CLIENTS} array is returned and a warning is logged.
 */
export async function getInnerTubeClients(): Promise<readonly ClientDescriptor[]> {
  const now = Date.now();
  if (_clCache && now - _clCache.fetchedAt < _CL_TTL_MS) return _clCache.data;
  const remote = await _fetchRemoteClients();
  if (remote) {
    _clCache = { data: remote, fetchedAt: now };
    return remote;
  }
  return INNERTUBE_CLIENTS;
}

// Fire-and-forget initial fetch at module load so the first real request hits
// the cache rather than waiting for a network round-trip.
void _fetchRemoteClients().then((data) => {
  if (data) _clCache = { data, fetchedAt: Date.now() };
});

/**
 * A custom error thrown when the InnerTube player API rejects every client
 * version in {@link INNERTUBE_CLIENTS}.  The `ytStatus` property
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch and parse a YouTube video's transcript via the InnerTube API.
 *
 * This function is intended to be called **server-side only** (e.g. from a
 * Next.js API route).  Direct browser calls may fail on certain networks or
 * regions due to CORS restrictions or YouTube policy changes.
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

  // ── 1. Fetch player data via InnerTube API (with client rotation) ────────────
  //
  // YouTube silently rotates the set of accepted client versions.  On HTTP 400
  // or 403 we try the next entry in the client list.  Any other non-2xx
  // status code is treated as a non-version-related failure and the loop is
  // broken immediately.
  let playerData: Record<string, unknown> | null = null;
  let lastStatus = 0;

  const clients = await getInnerTubeClients();

  for (const c of clients) {
    // WEB client requires visitorData for most videos.  Fetch it lazily and
    // include it in the request context and the X-Goog-Visitor-Id header.
    const visitorData = c.clientName === 'WEB' ? await _getVisitorData() : null;

    const playerRes = await fetch(INNERTUBE_PLAYER_URL, {
      method: 'POST',
      headers: {
        'Content-Type':             'application/json',
        'User-Agent':               c.userAgent,
        // X-YouTube-Client-Name and X-YouTube-Client-Version are required by
        // the current InnerTube backend in addition to the JSON body fields.
        'X-YouTube-Client-Name':    String(c.clientNameId),
        'X-YouTube-Client-Version': c.clientVersion,
        'Origin':                   'https://www.youtube.com',
        ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName:    c.clientName,
            clientVersion: c.clientVersion,
            hl: 'en',
            gl: 'US',
            ...(visitorData ? { visitorData } : {}),
            ...c.extra,
          },
        },
        videoId,
        // Unlocks captions for age-gated / region-restricted videos on
        // mobile clients (IOS and ANDROID).
        contentCheckOk: true,
        racyCheckOk:    true,
      }),
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
      `YouTube player API returned HTTP ${lastStatus} for all ${clients.length} client version(s) tried`,
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
