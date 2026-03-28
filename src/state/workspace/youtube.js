// @ts-nocheck
/**
 * src/state/workspace/youtube.js — YouTube transcript ingestion
 *
 * Fetches a YouTube transcript from the backend (/ingest-youtube), stores
 * the result in IndexedDB in the same "slides" format as PPT files, then
 * opens it in the workspace viewer so the user can chat with the video.
 *
 * Public API:
 *   wsPromptYouTube()   — opens the URL-entry overlay
 *   wsCloseYouTube()    — closes the overlay
 *   wsIngestYouTube()   — reads the input, calls backend, saves doc
 */

import { API_BASE, _getAuthHeader } from '../../lib/api.js';
import { saveDoc } from '../../lib/userDocDb.js';
import { wsShowToast } from './chat.js';
import { $el, addClass, removeClass } from '../domHelpers.js';

// ── Overlay HTML (injected once into document.body) ───────────────────────────

const OVERLAY_ID = 'yt-ingest-overlay';

function _ensureOverlay() {
  if (document.getElementById(OVERLAY_ID)) return;

  const el = document.createElement('div');
  el.id = OVERLAY_ID;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Import YouTube video');
  el.style.cssText = [
    'position:fixed;inset:0;z-index:1200;',
    'display:none;align-items:center;justify-content:center;',
    'background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);',
  ].join('');

  el.innerHTML = `
    <div style="
      background:var(--surface-1);
      border:1px solid var(--border-md);
      border-radius:var(--r-xl,16px);
      padding:28px 28px 24px;
      width:min(480px,92vw);
      box-shadow:0 24px 64px rgba(0,0,0,0.5);
      position:relative;
    ">
      <button onclick="wsCloseYouTube()"
        style="position:absolute;top:14px;right:14px;background:none;border:none;cursor:pointer;color:var(--text-3);padding:4px;border-radius:6px;line-height:1;"
        aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
        <div style="width:36px;height:36px;border-radius:10px;background:#ff000020;border:1px solid #ff000040;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff4444">
            <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
            <polygon fill="white" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
          </svg>
        </div>
        <div>
          <div style="font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--text-1);">Import YouTube Video</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px;">Paste a YouTube URL to study its transcript with AI</div>
        </div>
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:12px;color:var(--text-2);margin-bottom:6px;font-weight:500;">YouTube URL</label>
        <input id="yt-url-input" type="url" autocomplete="off" spellcheck="false"
          placeholder="https://www.youtube.com/watch?v=..."
          style="
            width:100%;box-sizing:border-box;
            background:var(--surface-2);border:1px solid var(--border-md);border-radius:var(--r-md,8px);
            padding:10px 12px;font-size:13px;color:var(--text-1);font-family:var(--font-body);
            outline:none;transition:border-color 120ms;
          "
          onkeydown="if(event.key==='Enter')wsIngestYouTube()"
        />
      </div>

      <div id="yt-ingest-status" style="display:none;font-size:12px;color:var(--text-3);margin-bottom:12px;"></div>

      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="wsCloseYouTube()"
          style="padding:8px 16px;border-radius:var(--r-md,8px);border:1px solid var(--border-md);background:var(--surface-2);color:var(--text-2);font-size:13px;cursor:pointer;font-family:var(--font-body);">
          Cancel
        </button>
        <button id="yt-ingest-btn" onclick="wsIngestYouTube()"
          style="padding:8px 18px;border-radius:var(--r-md,8px);border:none;background:#ff4444;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-body);transition:opacity 120ms;">
          Import
        </button>
      </div>
    </div>`;

  document.body.appendChild(el);

  // Close on backdrop click
  el.addEventListener('click', e => { if (e.target === el) wsCloseYouTube(); });
}

// ── Public helpers ─────────────────────────────────────────────────────────────

export function wsPromptYouTube() {
  _ensureOverlay();
  const overlay = document.getElementById(OVERLAY_ID);
  overlay.style.display = 'flex';
  const input = document.getElementById('yt-url-input');
  if (input) { input.value = ''; input.focus(); }
  const status = document.getElementById('yt-ingest-status');
  if (status) status.style.display = 'none';
}

export function wsCloseYouTube() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.style.display = 'none';
}

export async function wsIngestYouTube() {
  const input = document.getElementById('yt-url-input');
  const btn   = document.getElementById('yt-ingest-btn');
  const status = document.getElementById('yt-ingest-status');
  if (!input) return;

  const url = input.value.trim();
  if (!url) { input.focus(); return; }

  const _setStatus = (msg) => {
    if (!status) return;
    status.textContent = msg;
    status.style.display = msg ? 'block' : 'none';
  };

  if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }
  _setStatus('Fetching transcript…');

  try {
    const headers = { 'Content-Type': 'application/json' };
    const authH = await _getAuthHeader();
    Object.assign(headers, authH);

    const res = await fetch(`${API_BASE}/ingest-youtube`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    });

    const json = await res.json();

    if (!json.success) {
      _setStatus('⚠ ' + (json.error || 'Import failed'));
      if (btn) { btn.disabled = false; btn.textContent = 'Import'; }
      return;
    }

    _setStatus('Saving to library…');

    // Build a synthetic File from the transcript text so saveDoc can store it
    const { title, slides, transcript, video_id } = json;
    // Store video_id alongside slides so the viewer can embed the player
    const storedText = JSON.stringify({ video_id, slides });
    const blob = new Blob([transcript], { type: 'text/plain' });
    // Use .ytx extension so userDocs.js routes to the transcript viewer
    const safeName = title.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80);
    const file = new File([blob], `${safeName}.ytx`, { type: 'text/plain' });

    const { data: meta, error: saveErr } = await saveDoc(file, storedText, slides.length);
    if (saveErr || !meta) throw new Error(saveErr || 'Could not save document');

    wsCloseYouTube();
    wsShowToast('▶', `"${title}" imported`, 'var(--violet-border)');

    // Auto-open the transcript in the workspace
    if (typeof selectUserDoc === 'function') selectUserDoc(meta.id);
    if (typeof libRenderMyDocs === 'function') await libRenderMyDocs();

  } catch (err) {
    console.error('[wsIngestYouTube] error:', err);
    _setStatus('⚠ ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Import'; }
  }
}
