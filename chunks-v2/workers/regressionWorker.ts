/// <reference lib="webworker" />
// Web Worker: runs regression scan off the main thread.
// Receives: { mastered: string[], quizHistory: QuizHistoryEntry[] }
// Sends back: { regressed: string[] }
//
// IMPORTANT: Do not import React, Next.js, or any browser-only modules here.
// This file runs in a dedicated Worker context where those APIs are unavailable.

interface QuizHistoryEntry {
  topic: string;
  score: number;
  wrongAnswers: string[];
  timestamp: string;
}

self.onmessage = (e: MessageEvent<{ mastered: string[]; quizHistory: QuizHistoryEntry[] }>) => {
  const { mastered, quizHistory } = e.data;
  const now = Date.now();
  const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

  const regressed: string[] = [];

  for (const concept of mastered) {
    const entries = quizHistory
      .filter((h) => h.topic === concept)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const lastSeen = entries[0]?.timestamp;
    if (lastSeen && now - new Date(lastSeen).getTime() > FOURTEEN_DAYS) {
      regressed.push(concept);
    }
  }

  self.postMessage({ regressed });
};
