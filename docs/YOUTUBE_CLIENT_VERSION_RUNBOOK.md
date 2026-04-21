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
  "error": "YouTube player API returned HTTP 400 for all 3 client version(s) tried",
  "ts": "2026-04-20T21:00:00.000Z"
}
```

Create an alert on **`event = youtube_transcript_fetch_failed` AND
`is_version_error = true`** in your log pipeline (Datadog, CloudWatch
Logs Insights, Loki, etc.).

When `is_version_error` is `true` and `yt_status` is `400` or `403`, the
IOS primary client version needs to be bumped (or a new primary added).

### Threshold alert

When 5 or more `is_version_error` events occur within any 10-minute window,
the route emits an additional structured log line (at most once per window):

```json
{
  "event": "youtube_version_error_threshold",
  "count": 5,
  "window_secs": 600
}
```

If `SENTRY_DSN` is set **and** `@sentry/nextjs` is installed, a Sentry
`captureMessage` with level `error` and the same fields as tags is also fired.

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

### Option A — Remote config (zero-downtime)

Set the `INNERTUBE_CLIENTS_URL` environment variable to a URL that serves a
JSON array with the same shape as `INNERTUBE_CLIENTS`.  The server will pick
up a fresh list within 6 hours (or on the next cold start).

```json
[
  {
    "clientName": "IOS",
    "clientNameId": 5,
    "clientVersion": "19.46.0",
    "userAgent": "com.google.ios.youtube/19.46.0 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X)",
    "extra": { "deviceMake": "Apple", "deviceModel": "iPhone16,2", "osName": "iPhone", "osVersion": "17.5.1.21F90" }
  },
  {
    "clientName": "ANDROID",
    "clientNameId": 3,
    "clientVersion": "19.45.0",
    "userAgent": "com.google.android.youtube/19.45.0 (Linux; U; Android 14) gzip",
    "extra": { "androidSdkVersion": 34, "osName": "Android", "osVersion": "14" }
  }
]
```

Required fields per entry: `clientName` (string), `clientNameId` (number),
`clientVersion` (string), `userAgent` (string).  `extra` is optional.

When `INNERTUBE_CLIENTS_URL` is not set, the built-in `INNERTUBE_CLIENTS`
array in `lib/youtubeTranscript.ts` is used.

### Option B — Code change

#### Step 1 — Find a working version

Check the current accepted versions from one of these sources:

- **yt-dlp source**: <https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube.py>
  (search for `_IOS_CLIENT` or `IOS_CLIENT_VERSION`)
- **youtube-dl**: <https://github.com/ytdl-org/youtube-dl/blob/master/youtube_dl/extractor/youtube.py>

The version string looks like `'19.45.4'` (major.minor.patch).

#### Step 2 — Update the client array

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

#### Step 3 — Deploy

```bash
# No backend restart needed — this is a Next.js client library change.
git add chunks-v2/lib/youtubeTranscript.ts
git commit -m "fix: bump InnerTube IOS clientVersion to <new version>"
git push
# Trigger your normal frontend deploy pipeline.
```

#### Step 4 — Verify

Re-run the smoke-test from the manual check section with the new version.
Also trigger one YouTube ingestion via the product UI and confirm the viewer
opens successfully.

---

## Why this happens

YouTube's InnerTube API is internal.  Google occasionally rotates the set of
client versions it accepts without any public announcement.  The IOS client
is preferred as the primary because it does not currently require a
`poToken`/`visitorData` on public videos.  The `INNERTUBE_CLIENTS` array in
`youtubeTranscript.ts` is the single source of truth; keeping multiple clients
means a silent rotation only causes a brief bump (one extra HTTP round-trip)
rather than a total outage.  The WEB client is tried last; it requires a
`visitorData` token which is fetched lazily and cached for 6 h.

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `INNERTUBE_CLIENTS_URL` | (unset) | URL of a JSON array of client descriptors; refreshed every 6 h |
| `TRANSCRIPT_HMAC_SECRET` | (unset) | HMAC key for signing transcript payloads (dev/test: disabled) |
| `SENTRY_DSN` | (unset) | When set (and `@sentry/nextjs` is installed), threshold alerts are also sent to Sentry |

---

## Related files

| File | Purpose |
|---|---|
| `chunks-v2/lib/youtubeTranscript.ts` | `INNERTUBE_CLIENTS` built-in default, `getInnerTubeClients()` remote-config loader, retry logic |
| `chunks-v2/app/api/youtube/transcript/route.ts` | Next.js proxy; emits structured error logs; version-error threshold alerting; returns 502 on YouTube API errors |
| `backend/routes/youtube.py` | Chunking + caching; does not call YouTube |
