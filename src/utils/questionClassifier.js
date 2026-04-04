// @ts-nocheck
/**
 * src/utils/questionClassifier.js
 *
 * Lightweight question complexity classifier used by Auto thinking mode.
 * Returns 'simple' | 'moderate' | 'complex' based on heuristics so the
 * UI can auto-select Normal / Think / Deep Think before each request.
 */

const _COMPLEX_KEYWORDS = [
  'analyze', 'analyse', 'compare', 'contrast', 'derive', 'prove',
  'step by step', 'step-by-step', 'in detail', 'in-depth', 'in depth',
  'comprehensive', 'comprehensively', 'extensively', 'in great detail',
  'essay', 'critical analysis', 'evaluate', 'discuss thoroughly',
  'explain thoroughly', 'deep dive', 'elaborate', 'thorough',
  'in-depth analysis', 'detailed explanation', 'walk me through',
  'break down', 'what are the implications', 'pros and cons',
];

const _MODERATE_KEYWORDS = [
  'explain', 'how does', 'how do', 'why does', 'why do', 'why is',
  'what is the difference', 'what are the differences', 'describe',
  'summarize', 'summary', 'how to', 'what causes', 'what happens',
];

const _SIMPLE_EXACT = new Set([
  'hi', 'hello', 'hey', 'thanks', 'thank you', 'ok', 'okay',
  'yes', 'no', 'nope', 'sure', 'cool', 'great', 'nice', 'good',
  'bye', 'goodbye', 'got it', 'understood',
]);

/**
 * Classifies a user question as 'simple', 'moderate', or 'complex'.
 *
 * Mapping to thinking mode:
 *   'simple'   → Normal (no thinking param)
 *   'moderate' → Think
 *   'complex'  → Deep Think
 *
 * @param {string} text - The user's question / message
 * @returns {'simple'|'moderate'|'complex'}
 */
export function classifyQuestion(text) {
  const q = (text || '').toLowerCase().trim().replace(/[?!.]+$/, '').trim();
  if (!q) return 'simple';

  const words = q.split(/\s+/).filter(Boolean);
  const n = words.length;

  // Very short greetings / one-word / two-word → simple
  if (n <= 2) return 'simple';
  if (_SIMPLE_EXACT.has(q)) return 'simple';

  // Explicit complex keywords
  if (_COMPLEX_KEYWORDS.some(kw => q.includes(kw))) return 'complex';

  // Long questions are likely complex
  if (n > 30) return 'complex';

  // Explicit moderate keywords
  if (_MODERATE_KEYWORDS.some(kw => q.includes(kw))) return 'moderate';

  // Medium length is moderate
  if (n >= 10) return 'moderate';

  // Short but not conversational → simple
  return 'simple';
}
