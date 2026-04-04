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
  const q = (text || '').toLowerCase().replace(/[?!.]+$/, '').trim();
  if (!q) return 'simple';

  // Exact match on conversational short phrases (may be multi-word)
  if (_SIMPLE_EXACT.has(q)) return 'simple';

  const words = q.split(/\s+/).filter(Boolean);
  const n = words.length;

  // Very short inputs → simple
  if (n <= 2) return 'simple';

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

/**
 * Maps a classifyQuestion result to the actual thinking mode string
 * used in the API request body and ws.thinking state.
 *
 * @param {'simple'|'moderate'|'complex'} complexity
 * @returns {'off'|'think'|'deep'}
 */
export function mapComplexityToMode(complexity) {
  if (complexity === 'complex')  return 'deep';
  if (complexity === 'moderate') return 'think';
  return 'off';
}

/**
 * Returns the display label for an auto-resolved thinking mode.
 *
 * @param {'off'|'think'|'deep'} resolvedMode
 * @returns {string}
 */
export function autoModeLabel(resolvedMode) {
  if (resolvedMode === 'deep')  return 'Auto · Deep Think';
  if (resolvedMode === 'think') return 'Auto · Think';
  return 'Auto';
}
