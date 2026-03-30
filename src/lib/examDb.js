/**
 * src/lib/examDb.js — Exam result persistence
 *
 * Saves each exam attempt to the Supabase `exams` table via ChunksDB.insert().
 * Each call creates a brand-new row — no overwriting of previous attempts.
 *
 * Table: exams  (id, user_id, document_id, topic, questions, score, meta, created_at)
 *   See: backend/migrations/003_exams.sql  (original)
 *        backend/migrations/004_exams_meta.sql  (adds topic, meta; makes document_id nullable)
 *
 * Exports:
 *   saveExamResult({ documentId, topic, questions, score, meta }) → Promise<{ data, error }>
 *   loadExamHistory(documentId)                                   → Promise<Array>
 */

import { ChunksDB } from './chunksDb.js';
import { _currentUser } from './auth.js';

/**
 * Persist a completed exam attempt.
 * Silently no-ops when the user is not logged in (guests cannot save).
 *
 * @param {{ documentId?: string, topic?: string, questions: Array, score: number, meta?: Object }} result
 * @returns {Promise<{ data: Object|null, error: string|null }>}
 */
export async function saveExamResult({ documentId, topic, questions, score, meta }) {
  if (!ChunksDB.isLoggedIn()) return { data: null, error: null };

  return ChunksDB.insert('exams', {
    document_id: documentId || null,
    topic:       topic      || null,
    questions:   questions  || [],
    score:       typeof score === 'number' ? Math.round(score) : 0,
    meta:        meta       || {},
  });
}

/**
 * Load past exam attempts for the current user, newest first.
 * When documentId is provided, results are further filtered to that document.
 * When documentId is omitted/null, ALL attempts for the user are returned —
 * useful for the full history view.
 * Returns an empty array when the user is not logged in.
 *
 * @param {string|null} [documentId]
 * @returns {Promise<Array>}
 */
export async function loadExamHistory(documentId) {
  if (!ChunksDB.isLoggedIn()) return [];

  console.log('User:', _currentUser?.id);

  const opts = {
    order: { col: 'created_at', asc: false },
  };
  if (documentId) {
    opts.eq = { document_id: documentId };
  }

  const { data, error } = await ChunksDB.get('exams', opts);

  if (error) console.error('[ExamDB] loadExamHistory error:', error);
  console.log('Loaded data:', data);

  return data || [];
}
