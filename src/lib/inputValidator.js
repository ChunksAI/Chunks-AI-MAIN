// @ts-nocheck
/**
 * src/lib/inputValidator.js — Input validation & sanitisation before API calls
 *
 * Validates text length, removes control characters, and ensures inputs
 * are safe before being sent to the backend.  This is a defence-in-depth
 * layer — the backend also validates, but catching problems early avoids
 * wasted round-trips and provides instant user feedback.
 *
 * Usage:
 *   import { validateChatInput, sanitizeText } from './inputValidator.js';
 *   const result = validateChatInput(text);
 *   if (!result.ok) showToast('⚠', result.reason);
 */

// ── Control character stripper ───────────────────────────────────────────────

// eslint-disable-next-line no-control-regex
const _CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Strip dangerous control characters from text while preserving
 * tabs (\x09), newlines (\x0A), and carriage returns (\x0D).
 *
 * @param {string} text
 * @returns {string}
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text.replace(_CONTROL_CHARS, '').trim();
}

// ── Chat input validation ────────────────────────────────────────────────────

const MAX_CHAT_LENGTH = 20_000;  // matches backend _GEN_MAX_LEN for non-exam

/**
 * Validate a chat message before sending to /ask.
 *
 * @param {string} text
 * @returns {{ ok: boolean, text?: string, reason?: string }}
 */
export function validateChatInput(text) {
  if (!text || typeof text !== 'string') {
    return { ok: false, reason: 'Message cannot be empty.' };
  }
  const cleaned = sanitizeText(text);
  if (!cleaned) {
    return { ok: false, reason: 'Message cannot be empty.' };
  }
  if (cleaned.length > MAX_CHAT_LENGTH) {
    return { ok: false, reason: `Message is too long (${cleaned.length.toLocaleString()} chars). Maximum is ${MAX_CHAT_LENGTH.toLocaleString()}.` };
  }
  return { ok: true, text: cleaned };
}

// ── File content validation ──────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 50;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);

/**
 * Validate a file before upload.
 *
 * @param {File} file
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateFileUpload(file) {
  if (!file) {
    return { ok: false, reason: 'No file selected.' };
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return { ok: false, reason: `File is too large (max ${MAX_FILE_SIZE_MB} MB).` };
  }
  if (ALLOWED_MIME_TYPES.size && !ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, reason: 'Unsupported file type. Please upload a PDF, TXT, MD, or DOCX file.' };
  }
  return { ok: true };
}
