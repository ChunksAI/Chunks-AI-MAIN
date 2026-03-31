/**
 * src/lib/bookProgress.js
 *
 * Tracks per-book study activity in the in-memory store.
 * Falls back gracefully when the user is not logged in.
 */

import { lsGet as _lsGet, lsSet as _lsSet } from '../utils/storage.js';

const BOOK_PROGRESS_KEY = 'chunks_book_progress_v1';

function _loadAll() {
  return _lsGet(BOOK_PROGRESS_KEY, {});
}

function _saveAll(data) {
  _lsSet(BOOK_PROGRESS_KEY, data);
}

/** Called when a book is opened via selectBook() */
export function trackBookOpen(bookId) {
  if (!bookId) return;
  const all = _loadAll();
  const prev = all[bookId] || {};
  all[bookId] = {
    ...prev,
    lastOpened: new Date().toISOString(),
    openCount:  (prev.openCount || 0) + 1,
  };
  _saveAll(all);
}

/** Called on page change — saves last read page */
export function trackBookPage(bookId, page, totalPages) {
  if (!bookId || !page) return;
  const all = _loadAll();
  const prev = all[bookId] || {};
  all[bookId] = {
    ...prev,
    lastPage:   page,
    totalPages: totalPages || prev.totalPages || 0,
  };
  _saveAll(all);
}

/** Returns progress object for a single book, or null if never opened */
export function getBookProgress(bookId) {
  const all = _loadAll();
  return all[bookId] || null;
}

/** Returns all progress data */
export function getAllBookProgress() {
  return _loadAll();
}

/** Human-readable "last studied" label */
export function formatLastStudied(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7)   return `${days}d ago`;
  if (days < 30)  return `${Math.floor(days/7)}w ago`;
  return `${Math.floor(days/30)}mo ago`;
}

/** 0–100 read progress percentage */
export function calcReadPct(progress) {
  if (!progress || !progress.lastPage || !progress.totalPages) return 0;
  return Math.min(100, Math.round((progress.lastPage / progress.totalPages) * 100));
}

export const _bookProgress = { trackBookOpen, trackBookPage, getBookProgress, getAllBookProgress };
