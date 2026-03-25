// @ts-nocheck
/**
 * src/lib/userDocDb.js — User Document Storage
 *
 * Stores user-uploaded PDFs and PPTs entirely in the browser via IndexedDB.
 * No backend required — documents never leave the device.
 *
 * Two object stores:
 *   "docs"  — metadata: { id, name, type, size, pageCount, uploadedAt, extractedText }
 *   "blobs" — raw file bytes: { id, data: ArrayBuffer }
 *
 * The extracted text (from PDF.js or pptx-parser) is stored alongside
 * metadata so the AI can answer questions without re-parsing on every open.
 *
 * Public API (all async, never throw — return { data, error }):
 *   saveDoc(file, extractedText, pageCount)  → { data: docMeta, error }
 *   listDocs()                               → { data: docMeta[], error }
 *   getDocBlob(id)                           → { data: ArrayBuffer, error }
 *   getDocMeta(id)                           → { data: docMeta, error }
 *   deleteDoc(id)                            → { error }
 */

import { isQuotaError, showStorageError } from '../components/StorageErrorBanner.js';

const DB_NAME    = 'chunks-user-docs';
const DB_VERSION = 1;

// ── IndexedDB migration registry ──────────────────────────────────────────────
// Each entry maps a *target* version to a function that upgrades the database
// FROM the previous version.  The onupgradeneeded handler steps through all
// needed migrations when the stored DB version is behind DB_VERSION.
//
// How to add a migration:
//  1. Bump DB_VERSION by 1.
//  2. Add a new entry here keyed by the new version number.
//  3. The function receives (db, transaction) — use them to create/alter
//     object stores or transform existing data.

/** @type {Record<number, (db: IDBDatabase, tx: IDBTransaction) => void>} */
const USERDOC_MIGRATIONS = {
  // ── v0 → v1: create docs + blobs stores ────────────────────────────────
  1: (db) => {
    if (!db.objectStoreNames.contains('docs')) {
      db.createObjectStore('docs', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('blobs')) {
      db.createObjectStore('blobs', { keyPath: 'id' });
    }
  },
};

let _db = null;

function _openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      const oldVersion = e.oldVersion || 0;
      for (let v = oldVersion + 1; v <= DB_VERSION; v++) {
        const migrateFn = USERDOC_MIGRATIONS[v];
        if (migrateFn) migrateFn(db, e.target.transaction);
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

function _tx(storeName, mode, fn) {
  return _openDb().then(db => new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req   = fn(store);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  }));
}

/** Generate a short unique id */
function _uid() {
  return `udoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Save a user document.
 * @param {File}   file          - the raw File object from <input type="file">
 * @param {string} extractedText - full text extracted from the document
 * @param {number} pageCount     - number of pages/slides
 * @returns {{ data: docMeta, error }}
 */
export async function saveDoc(file, extractedText = '', pageCount = 0) {
  try {
    const id  = _uid();
    const buf = await file.arrayBuffer();
    const meta = {
      id,
      name:          file.name,
      type:          file.type || (file.name.endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/pdf'),
      size:          file.size,
      pageCount,
      uploadedAt:    new Date().toISOString(),
      extractedText: extractedText.slice(0, 120_000), // cap at ~120k chars
    };

    await _tx('blobs', 'readwrite', s => s.put({ id, data: buf }));
    await _tx('docs',  'readwrite', s => s.put(meta));
    return { data: meta, error: null };
  } catch (e) {
    console.warn('[UserDocDb] saveDoc error:', e);
    if (isQuotaError(e)) showStorageError('quota');
    return { data: null, error: e.message };
  }
}

/**
 * List all stored document metadata (newest first).
 * @returns {{ data: docMeta[], error }}
 */
export async function listDocs() {
  try {
    const all = await _tx('docs', 'readonly', s => s.getAll());
    const sorted = (all || []).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    return { data: sorted, error: null };
  } catch (e) {
    console.warn('[UserDocDb] listDocs error:', e);
    return { data: [], error: e.message };
  }
}

/**
 * Get raw file bytes for rendering.
 * @param {string} id
 * @returns {{ data: ArrayBuffer, error }}
 */
export async function getDocBlob(id) {
  try {
    const row = await _tx('blobs', 'readonly', s => s.get(id));
    if (!row) return { data: null, error: 'Not found' };
    return { data: row.data, error: null };
  } catch (e) {
    console.warn('[UserDocDb] getDocBlob error:', e);
    return { data: null, error: e.message };
  }
}

/**
 * Get document metadata (includes extractedText).
 * @param {string} id
 * @returns {{ data: docMeta, error }}
 */
export async function getDocMeta(id) {
  try {
    const row = await _tx('docs', 'readonly', s => s.get(id));
    if (!row) return { data: null, error: 'Not found' };
    return { data: row, error: null };
  } catch (e) {
    console.warn('[UserDocDb] getDocMeta error:', e);
    return { data: null, error: e.message };
  }
}

/**
 * Delete a document (both blob and metadata).
 * @param {string} id
 * @returns {{ error }}
 */
export async function deleteDoc(id) {
  try {
    await _tx('blobs', 'readwrite', s => s.delete(id));
    await _tx('docs',  'readwrite', s => s.delete(id));
    return { error: null };
  } catch (e) {
    console.warn('[UserDocDb] deleteDoc error:', e);
    return { error: e.message };
  }
}
