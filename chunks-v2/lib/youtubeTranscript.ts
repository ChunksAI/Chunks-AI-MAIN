/**
 * lib/youtubeTranscript.ts — Browser-side YouTube transcript fetcher.
 *
 * Fetches a video's caption track directly from YouTube without any server
 * involvement.  The browser parses the watch-page HTML to extract the
 * ytInitialPlayerResponse JSON, selects the best available English caption
 * track, fetches the caption XML, and returns an array of timed entries.
 *
 * Call flow:
 *   fetchYouTubeTranscript(urlOrId)
 *     → fetch youtube.com/watch page
 *     → extract ytInitialPlayerResponse
 *     → select best caption track
 *     → fetch caption XML
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch and parse a YouTube video's transcript in the browser (or in a
 * Next.js Server Component / Server Action where CORS does not apply).
 *
 * @param urlOrId  A full YouTube URL or a bare 11-character video ID.
 * @returns        The parsed transcript entries along with the video title
 *                 and the canonical video ID.
 * @throws         An Error with a descriptive message if the video ID cannot
 *                 be extracted, the player data cannot be parsed, or no
 *                 caption tracks are available.
 */
export async function fetchYouTubeTranscript(urlOrId: string): Promise<FetchTranscriptResult> {
  const videoId = extractVideoId(urlOrId);
  if (!videoId) {
    throw new Error('Could not extract a video ID from that URL');
  }

  // ── 1. Fetch the watch page ────────────────────────────────────────────────
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!pageRes.ok) {
    throw new Error(`YouTube watch page returned HTTP ${pageRes.status}`);
  }

  const html = await pageRes.text();

  // YouTube encodes '<' as '\u003c' in JSON to avoid breaking script tag parsers,
  // so [^<]* safely and efficiently captures the full JSON object without
  // crossing into adjacent script tags.
  const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{[^<]*\});/);
  if (!playerMatch) {
    throw new Error('Could not parse YouTube player data — the page format may have changed');
  }

  let playerData: Record<string, unknown>;
  try {
    playerData = JSON.parse(playerMatch[1]) as Record<string, unknown>;
  } catch {
    throw new Error('Failed to parse ytInitialPlayerResponse JSON');
  }

  // ── 3. Extract video title ─────────────────────────────────────────────────
  const title: string =
    (playerData?.videoDetails as Record<string, unknown>)?.title as string ??
    `YouTube — ${videoId}`;

  // ── 4. Select best caption track ──────────────────────────────────────────
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

  // ── 5. Fetch the caption XML ───────────────────────────────────────────────
  const xmlRes = await fetch(track.baseUrl, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!xmlRes.ok) {
    throw new Error(`Failed to fetch caption track — HTTP ${xmlRes.status}`);
  }

  const xml = await xmlRes.text();

  // ── 6. Parse and return ───────────────────────────────────────────────────
  const entries = parseCaptionXml(xml);
  return { entries, title, videoId };
}
