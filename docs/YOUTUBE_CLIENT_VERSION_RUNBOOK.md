# YouTube InnerTube Client Version — 5-Minute Runbook

YouTube's InnerTube API silently rejects stale ANDROID client versions with
HTTP **400** or **403**.  When this happens every YouTube ingestion in the
product fails until the version list is updated.

---

## How to detect the problem

### Alert signal

The Next.js proxy route `/api/youtube/transcript` emits a structured JSON log
line on every YouTube API failure:

```json
{
  "event": "youtube_transcript_fetch_failed",
  "yt_status": 400,
  "is_version_error": true,
  "error": "YouTube player API returned HTTP 400 for all 2 client version(s) tried",
  "ts": "2026-04-20T21:00:00.000Z"
}
```

Create an alert on **`event = youtube_transcript_fetch_failed` AND
`is_version_error = true`** in your log pipeline (Datadog, CloudWatch
Logs Insights, Loki, etc.).

### Manual check

```bash
# Quick smoke-test from a server that can reach YouTube:
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://www.youtube.com/youtubei/v1/player \
  -H 'Content-Type: application/json' \
  -d '{
    "context": {
      "client": {
        "clientName": "ANDROID",
        "clientVersion": "19.09.37",
        "androidSdkVersion": 30,
        "hl": "en",
        "gl": "US"
      }
    },
    "videoId": "dQw4w9WgXcQ"
  }'
# Expected: 200.  If you see 400 / 403, the version is stale.
```

---

## How to fix it (< 5 minutes)

### Step 1 — Find a working version

Check the current accepted versions from one of these sources:

- **yt-dlp source**: <https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube.py>
  (search for `_ANDROID_CLIENT` or `ANDROID_CLIENT_VERSION`)
- **youtube-dl**: <https://github.com/ytdl-org/youtube-dl/blob/master/youtube_dl/extractor/youtube.py>

The version string looks like `'19.09.37'` (major.minor.patch).

### Step 2 — Update the version array

Edit `chunks-v2/lib/youtubeTranscript.ts` — the constant is near the top of
the "InnerTube API constants" section:

```typescript
export const INNERTUBE_CLIENT_VERSIONS: readonly string[] = [
  '19.09.37',   // ← prepend the NEW version here
  '17.31.35',   // keep old versions as fallback for ~30 days, then remove
];
```

**Always prepend** the new version so it is tried first.  Keep at least one
older version as a fallback.  Remove versions that have been consistently
failing for more than 30 days.

### Step 3 — Deploy

```bash
# No backend restart needed — this is a Next.js client library change.
git add chunks-v2/lib/youtubeTranscript.ts
git commit -m "fix: bump InnerTube clientVersion to <new version>"
git push
# Trigger your normal frontend deploy pipeline.
```

### Step 4 — Verify

Re-run the smoke-test from Step 1 with the new version.  Also trigger one
YouTube ingestion via the product UI and confirm the viewer opens successfully.

---

## Why this happens

YouTube's InnerTube API is internal.  Google occasionally rotates the set of
ANDROID client versions it accepts without any public announcement.  The
`INNERTUBE_CLIENT_VERSIONS` array in `youtubeTranscript.ts` is the single
source of truth; keeping multiple versions means a silent rotation only causes
a brief bump (one extra HTTP round-trip) rather than a total outage.

---

## Related files

| File | Purpose |
|---|---|
| `chunks-v2/lib/youtubeTranscript.ts` | `INNERTUBE_CLIENT_VERSIONS` array + retry logic |
| `chunks-v2/app/api/youtube/transcript/route.ts` | Next.js proxy; emits structured error logs |
| `backend/routes/youtube.py` | Chunking + caching; does not call YouTube |
