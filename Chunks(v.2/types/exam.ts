// ─── Exam Mode Types ──────────────────────────────────────────────────────────

export interface ConceptChunk {
  id: string;
  concept: string;       // e.g. "Mitochondria and ATP Synthesis"
  summary: string;       // 1–2 sentence description
  questionCount: number; // how many questions were generated for this concept
  slideRefs: number[];   // which slide numbers this came from
}

export interface ExamQuestion {
  id: string;
  conceptId: string;     // links back to ConceptChunk
  conceptLabel: string;  // shown in question navigator
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation: string;
}

export interface ExamResult {
  score: number;
  passed: boolean;
  passThreshold: number;
  totalQuestions: number;
  correctAnswers: number;
  timeUsed: number;
  conceptBreakdown: {
    concept: string;
    total: number;
    correct: number;
    score: number;
  }[];
  weakConcepts: string[];
}

export interface ExamConfig {
  questionCount: 10 | 25 | 50;
  timeLimit: number;        // seconds
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  source: 'document' | 'topic';
  topic: string;
}
