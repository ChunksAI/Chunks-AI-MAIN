/**
 * Extracts the study topic from an AI response string.
 *
 * Used as a fallback when the backend's SSE meta event ({"meta":{"topic":...}})
 * is not available (e.g. old cached responses or non-streaming paths that do
 * not return a `topic` field).
 *
 * Resolution order:
 *  1. ## Heading on its own line
 *  2. ### Heading on its own line
 *  3. Empty string (topic unknown)
 */
export function extractTopicFromResponse(text: string): string {
  const lines = text.split('\n');

  // Fallback 1: ## heading
  const h2 = lines.find((l) => l.trimStart().startsWith('## '));
  if (h2) return h2.replace(/^#+\s*/, '').trim();

  // Fallback 2: ### heading
  const h3 = lines.find((l) => l.trimStart().startsWith('### '));
  if (h3) return h3.replace(/^#+\s*/, '').trim();

  return '';
}
