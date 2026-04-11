import type { ChatMessage } from '@/types';

/**
 * Cleans a raw topic string for display — replaces underscores/hyphens with
 * spaces and applies title case.  Safe to call on an already-clean string.
 */
export function cleanTopic(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Derives the best available study topic from context, in priority order:
 *
 *  1. `topic`    — set by the context after any generation or quiz (most specific)
 *  2. `docTitle` — the uploaded document's filename, already extension-stripped
 *  3. First 6 words of the last AI message, stripped of HTML tags and trailing
 *     punctuation (gives a contextual label like "Laws of Thermodynamics")
 *  4. `'General Study'` — safe last resort, never an incomplete placeholder
 */
export function resolveStudyTopic(
  topic: string,
  docTitle: string,
  messages: ChatMessage[],
): string {
  if (topic) return topic;

  // docTitle is already stored without extension by handleUploadDocument,
  // but strip defensively in case it was set from another code path.
  if (docTitle) return docTitle.replace(/\.[^.]+$/, '');

  // Scan backwards for the last AI message
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'ai') {
      const stripped = messages[i].text.replace(/<[^>]+>/g, '').trim();
      const label = stripped
        .split(/\s+/)
        .slice(0, 6)
        .join(' ')
        .replace(/[.,;:!?…]+$/, '')
        .trim();
      if (label) return label;
      break;
    }
  }

  return 'General Study';
}
