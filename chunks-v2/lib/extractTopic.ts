/**
 * Extracts the study topic from an AI response string.
 *
 * Resolution order:
 *  1. Structured marker: <topic>…</topic>
 *  2. ## Heading on its own line
 *  3. ### Heading on its own line
 *  4. Empty string (topic unknown)
 */
export function extractTopicFromResponse(text: string): string {
  // Primary: structured marker injected by the backend
  const structuredMatch = text.match(/<topic>(.*?)<\/topic>/);
  if (structuredMatch) return structuredMatch[1].trim();

  const lines = text.split('\n');

  // Fallback 1: ## heading
  const h2 = lines.find((l) => l.trimStart().startsWith('## '));
  if (h2) return h2.replace(/^#+\s*/, '').trim();

  // Fallback 2: ### heading
  const h3 = lines.find((l) => l.trimStart().startsWith('### '));
  if (h3) return h3.replace(/^#+\s*/, '').trim();

  return '';
}
