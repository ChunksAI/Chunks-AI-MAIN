/**
 * Returns true when the given text is likely a physics problem that warrants
 * generating an automatic Free Body Diagram.
 *
 * Two changes vs. the original implementation prevent false positives on
 * everyday / non-physics text (e.g. news articles, political summaries):
 *
 * 1. **Whole-word matching** — single-word terms are matched with regex word
 *    boundaries (`\b`) so "forces" does not match "force", "massive" does not
 *    match "mass", "inclined to" does not match "incline", etc.
 *
 * 2. **Removed ambiguous keywords** — words that are common in non-physics
 *    prose are no longer used as signals:
 *      - 'normal'    → kept only as part of the phrase 'normal force'
 *      - 'mass'      → too common ("mass protest", "mass media")
 *      - 'weight'    → too common ("give weight to", "political weight")
 *      - 'push'      → too generic
 *      - 'pull'      → too generic
 *      - 'applied'   → too generic
 *      - 'slope'     → too generic ("steep slope" in non-physics contexts)
 *      - ' n '       → too short / too ambiguous as a standalone token
 *
 * Note: real physics questions that mention mass or weight almost always also
 * contain at least two other keywords from the retained list (e.g. 'kg',
 * 'acceleration', 'gravity', 'friction') so removing them does not miss
 * genuine physics problems while substantially reducing false positives.
 */
export function detectPhysicsProblem(text: string): boolean {
  const lower = text.toLowerCase();

  // Multi-word phrases are specific enough to count on substring presence.
  const phrases = ['normal force', 'free body', 'free-body', 'fbd', 'net force'];

  // Single-word physics terms matched with whole-word boundaries so that
  // inflected forms ('forces', 'inclined') do not trigger a match.
  // Patterns are pre-compiled once per call (not inside an inner loop).
  const singleWordPatterns = [
    'friction', 'tension', 'acceleration', 'gravity',
    'newton', 'incline', 'pulley', 'torque',
    'momentum', 'ramp', 'kg', 'newtons',
    'force', 'equilibrium', 'resultant',
  ].map(
    // Escape meta-characters (defensive; current words are all alphanumeric
    // but keeps the function safe for future additions).
    (w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
  );

  let count = 0;

  for (const phrase of phrases) {
    if (lower.includes(phrase)) count++;
  }

  for (const pattern of singleWordPatterns) {
    if (pattern.test(lower)) count++;
  }

  return count >= 2;
}
