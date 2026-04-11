/**
 * lib/weaknessEngine.ts — Personalised review weakness scoring.
 *
 * Pure functions only — no side effects, no React imports, fully testable in
 * isolation.  Computes a composite weakness score for each topic the user has
 * studied, combining quiz performance, attempt frequency, and SRS mastery.
 */

import type { StudyState } from '@/contexts/StudyContext';
import type { SRSCard } from '@/lib/srsAlgorithm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeaknessScore {
  topic: string;
  /** Composite score in 0–1 range; higher = weaker. */
  score: number;
  /** Average quiz score 0–100. */
  avgQuizScore: number;
  /** Total quiz attempts for this topic. */
  attempts: number;
  /** SRS mastery ratio 0–1; 0.5 is the neutral default when no SRS data. */
  flashcardMastery: number;
}

export interface Recommendation {
  message: string;
  nextAction: 'review_flashcards' | 'retry_quiz' | 'finish_session';
}

// ─── computeWeaknessScores ────────────────────────────────────────────────────

/**
 * Computes a weakness score for every topic the user has interacted with.
 *
 * Scoring formula:
 *   weakness = (1 − avgQuizScore) × 0.5
 *            + min(attempts / 5, 1) × 0.3
 *            + (1 − flashcardMastery) × 0.2
 *
 * @param state    Current StudyState (reads quizResults + weakAreas).
 * @param srsCards Optional SRS card list for mastery weighting.
 */
export function computeWeaknessScores(state: StudyState, srsCards?: SRSCard[]): WeaknessScore[] {
  const topicMap = new Map<string, { totalScore: number; attempts: number }>();

  // Aggregate quiz results by topic
  for (const r of state.quizResults) {
    const existing = topicMap.get(r.topic);
    if (existing) {
      existing.totalScore += r.score;
      existing.attempts += 1;
    } else {
      topicMap.set(r.topic, { totalScore: r.score, attempts: 1 });
    }
  }

  // Supplement with weak-area topics that may have no quiz result yet
  for (const w of state.weakAreas) {
    if (!topicMap.has(w.topic)) {
      topicMap.set(w.topic, { totalScore: w.score, attempts: w.attempts });
    }
  }

  if (topicMap.size === 0) return [];

  const scores: WeaknessScore[] = [];

  for (const [topic, data] of topicMap) {
    const avgQuizScore = data.totalScore / data.attempts; // 0–100
    const avgNormalised = avgQuizScore / 100;             // 0–1
    const attemptCountNormalised = Math.min(data.attempts / 5, 1); // caps at 1

    // SRS mastery — graceful fallback to 0.5 when no SRS data exists
    const topicCards = srsCards?.filter((c) => c.deckId.toLowerCase().includes(topic.toLowerCase())) ?? [];
    const flashcardMastery =
      topicCards.length > 0
        ? topicCards.filter((c) => c.repetitions >= 3).length / topicCards.length
        : 0.5;

    const weaknessScore =
      (1 - avgNormalised) * 0.5 +
      attemptCountNormalised * 0.3 +
      (1 - flashcardMastery) * 0.2;

    scores.push({
      topic,
      score: Math.round(weaknessScore * 1000) / 1000,
      avgQuizScore: Math.round(avgQuizScore),
      attempts: data.attempts,
      flashcardMastery: Math.round(flashcardMastery * 100) / 100,
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

// ─── getWeakestTopic ──────────────────────────────────────────────────────────

/**
 * Returns the topic string with the highest weakness score.
 * Returns `null` when there is no quiz or weak-area history.
 */
export function getWeakestTopic(state: StudyState, srsCards?: SRSCard[]): string | null {
  const scores = computeWeaknessScores(state, srsCards);
  return scores.length > 0 ? (scores[0]?.topic ?? null) : null;
}

// ─── getRecommendation ────────────────────────────────────────────────────────

/**
 * Maps a quiz score (0–100) to a post-session recommendation.
 */
export function getRecommendation(score: number): Recommendation {
  if (score < 50) {
    return {
      message: "You need more review. Let's go through the flashcards again.",
      nextAction: 'review_flashcards',
    };
  }
  if (score < 80) {
    return {
      message: 'You are improving. Retry the quiz to lock it in.',
      nextAction: 'retry_quiz',
    };
  }
  return {
    message: 'Excellent work. You have mastered this topic.',
    nextAction: 'finish_session',
  };
}
