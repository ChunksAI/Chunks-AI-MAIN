# YouTube InnerTube Client Version — 5-Minute Runbook

YouTube's InnerTube API silently rejects stale client versions with
HTTP **400** or **403**.  When this happens every YouTube ingestion in the
product fails until the client list is updated.

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

When `is_version_error` is `true` and `yt_status` is `400` or `403`, the
IOS primary client version needs to be bumped (or a new primary added).

### Manual check

```bash
# Quick smoke-test from a server that can reach YouTube (IOS client):
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://www.youtube.com/youtubei/v1/player \
  -H 'Content-Type: application/json' \
  -H 'X-YouTube-Client-Name: 5' \
  -H 'X-YouTube-Client-Version: 19.45.4' \
  -H 'User-Agent: com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X)' \
  -d '{
    "context": {
      "client": {
        "clientName": "IOS",
        "clientVersion": "19.45.4",
        "deviceMake": "Apple",
        "deviceModel": "iPhone16,2",
        "osName": "iPhone",
        "osVersion": "17.5.1.21F90",
        "hl": "en",
        "gl": "US"
      }
    },
    "videoId": "dQw4w9WgXcQ",
    "contentCheckOk": true,
    "racyCheckOk": true
  }'
# Expected: 200.  If you see 400 / 403, the IOS version is stale.
```

---

## How to fix it (< 5 minutes)

### Step 1 — Find a working version

Check the current accepted versions from one of these sources:

- **yt-dlp source**: <https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube.py>
  (search for `_IOS_CLIENT` or `IOS_CLIENT_VERSION`)
- **youtube-dl**: <https://github.com/ytdl-org/youtube-dl/blob/master/youtube_dl/extractor/youtube.py>

The version string looks like `'19.45.4'` (major.minor.patch).

### Step 2 — Update the client array

Edit `chunks-v2/lib/youtubeTranscript.ts` — the constant is near the top of
the "InnerTube API constants" section:

```typescript
export const INNERTUBE_CLIENTS: readonly { ... }[] = [
  {
    clientName:    'IOS',
    clientNameId:  5,
    clientVersion: '19.45.4',   // ← update to the NEW version here
    userAgent:     'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X)',
    extra: { deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '17.5.1.21F90' },
  },
  // ANDROID kept as fallback — update clientVersion and userAgent similarly if needed
  ...
];
```

**Always keep at least two entries** (IOS primary + ANDROID fallback).
Update both `clientVersion` and the matching `userAgent` string together.

### Step 3 — Deploy

```bash
# No backend restart needed — this is a Next.js client library change.
git add chunks-v2/lib/youtubeTranscript.ts
git commit -m "fix: bump InnerTube IOS clientVersion to <new version>"
git push
# Trigger your normal frontend deploy pipeline.
```

### Step 4 — Verify

Re-run the smoke-test from Step 1 with the new version.  Also trigger one
YouTube ingestion via the product UI and confirm the viewer opens successfully.

---

## Why this happens

YouTube's InnerTube API is internal.  Google occasionally rotates the set of
client versions it accepts without any public announcement.  The IOS client
is preferred as the primary because it does not currently require a
`poToken`/`visitorData` on public videos.  The `INNERTUBE_CLIENTS` array in
`youtubeTranscript.ts` is the single source of truth; keeping multiple clients
means a silent rotation only causes a brief bump (one extra HTTP round-trip)
rather than a total outage.

---

## Related files

| File | Purpose |
|---|---|
| `chunks-v2/lib/youtubeTranscript.ts` | `INNERTUBE_CLIENTS` array + retry logic |
| `chunks-v2/app/api/youtube/transcript/route.ts` | Next.js proxy; emits structured error logs; returns 502 on YouTube API errors |
| `backend/routes/youtube.py` | Chunking + caching; does not call YouTube |
