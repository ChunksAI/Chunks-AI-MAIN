/**
 * src/lib/examDb.js — Exam result persistence
 *
 * Saves each exam attempt to the Supabase `exams` table via ChunksDB.insert().
 * Each call creates a brand-new row — no overwriting of previous attempts.
 *
 * Table: exams  (id, user_id, document_id, questions, score, created_at)
 *   See: backend/migrations/003_exams.sql
 *
 * Exports:
 *   saveExamResult({ documentId, questions, score }) → Promise<{ data, error }>
 *   loadExamHistory(documentId)                      → Promise<Array>
 */

import { ChunksDB } from './chunksDb.js';

/**
 * Persist a completed exam attempt.
 * Silently no-ops when the user is not logged in (guests cannot save).
 *
 * @param {{ documentId: string, questions: Array, score: number }} result
 * @returns {Promise<{ data: Object|null, error: string|null }>}
 */
export async function saveExamResult({ documentId, questions, score }) {
  if (!ChunksDB.isLoggedIn()) return { data: null, error: null };

  return ChunksDB.insert('exams', {
    document_id: documentId || null,
    questions:   questions  || [],
    score:       typeof score === 'number' ? Math.round(score) : 0,
  });
}

/**
 * Load all past exam attempts for a document, newest first.
 * Returns an empty array when the user is not logged in.
 *
 * @param {string} documentId
 * @returns {Promise<Array>}
 */
export async function loadExamHistory(documentId) {
  if (!ChunksDB.isLoggedIn() || !documentId) return [];

  const { data } = await ChunksDB.get('exams', {
    eq:    { document_id: documentId },
    order: { col: 'created_at', asc: false },
  });
  return data || [];
}
