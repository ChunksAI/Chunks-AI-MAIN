/**
 * lib/srsAlgorithm.ts — Pure SM-2 spaced-repetition algorithm.
 *
 * Pure functions only — no side effects, no imports from non-standard modules.
 * Every function is deterministic and fully testable in isolation.
 *
 * SM-2 reference: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-achieved-in-working-with-the-supermemo-method
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SRSCard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  hint?: string;
  /** SM-2 ease factor (default 2.5, min 1.3). */
  easeFactor: number;
  /** Interval in days until next review. */
  interval: number;
  /** How many times reviewed with quality >= 3. */
  repetitions: number;
  /** ISO date string for the next scheduled review. */
  nextReview: string;
  createdAt: string;
  updatedAt: string;
}

export interface SRSDeck {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** SM-2 quality rating:
 *   0 = complete blackout (failed, repeat immediately)
 *   3 = hard (correct with significant difficulty)
 *   4 = ok (correct after some thought)
 *   5 = easy (correct with no difficulty) */
export type SRSQuality = 0 | 3 | 4 | 5;

// ─── Core algorithm ───────────────────────────────────────────────────────────

/**
 * Applies the SM-2 algorithm to compute a card's next review schedule.
 *
 * @param card    The current card state.
 * @param quality The user's self-assessed rating (0 | 3 | 4 | 5).
 * @returns       A new SRSCard with updated easeFactor, interval, repetitions,
 *                and nextReview fields. All other fields are preserved.
 */
export function computeNextReview(card: SRSCard, quality: SRSQuality): SRSCard {
  let { easeFactor, interval, repetitions } = card;

  if (quality < 3) {
    // Failed — restart the interval sequence but keep ease factor
    repetitions = 0;
    interval = 1;
  } else {
    // Successful recall
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }

    // Update ease factor: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    easeFactor =
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    repetitions += 1;
  }

  const nextReview = addDays(new Date(), interval).toISOString();
  const now = new Date().toISOString();

  return {
    ...card,
    easeFactor: Math.round(easeFactor * 100) / 100,
    interval,
    repetitions,
    nextReview,
    updatedAt: now,
  };
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Returns true if the card is due for review today or overdue.
 */
export function isDue(card: SRSCard): boolean {
  return new Date(card.nextReview) <= new Date();
}

/**
 * Filters a list of cards to only those due for review.
 */
export function getDueCards(cards: SRSCard[]): SRSCard[] {
  return cards.filter(isDue);
}

/**
 * Returns the mastery percentage: cards with repetitions >= 3 are considered
 * "mastered". Returns 0 for empty decks.
 */
export function getMasteryPercent(cards: SRSCard[]): number {
  if (cards.length === 0) return 0;
  const mastered = cards.filter((c) => c.repetitions >= 3).length;
  return Math.round((mastered / cards.length) * 100);
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/**
 * Exports a list of cards to CSV format (front,back,hint).
 */
export function exportCardsToCsv(cards: SRSCard[]): string {
  const header = 'front,back,hint';
  const rows = cards.map((c) => {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [escape(c.front), escape(c.back), escape(c.hint ?? '')].join(',');
  });
  return [header, ...rows].join('\n');
}

/**
 * Parses a CSV string (front,back,hint) into partial card objects.
 * Skips the header row. Rows with missing front/back are silently dropped.
 */
export function parseCsvToCards(
  csv: string,
  deckId: string,
): Omit<SRSCard, 'id' | 'createdAt' | 'updatedAt'>[] {
  const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
  // Skip header if present
  const dataLines = lines[0]?.toLowerCase().startsWith('front') ? lines.slice(1) : lines;

  const now = new Date().toISOString();

  const results: Omit<SRSCard, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  for (const line of dataLines) {
    const parts = parseCsvLine(line);
    const front = parts[0]?.trim();
    const back = parts[1]?.trim();
    if (!front || !back) continue;
    results.push({
      deckId,
      front,
      back,
      hint: parts[2]?.trim() || undefined,
      easeFactor: 2.5,
      interval: 1,
      repetitions: 0,
      nextReview: now,
    });
  }
  return results;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
