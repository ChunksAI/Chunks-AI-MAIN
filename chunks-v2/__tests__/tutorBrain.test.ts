/**
 * Unit tests for useTutorBrain hook (tbRecordSocraticPass) and
 * the extractTopicFromResponse utility.
 */

import { renderHook, act } from '@testing-library/react';
import { useTutorBrain } from '@/hooks/useTutorBrain';
import type { StudentModel } from '@/hooks/useTutorBrain';
import { extractTopicFromResponse } from '@/lib/extractTopic';

// ── localStorage helpers ───────────────────────────────────────────────────────

const STORAGE_KEY = 'chunks_student_model';

function seedModel(model: StudentModel) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
}

function readModel(): StudentModel {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as StudentModel;
}

beforeEach(() => {
  localStorage.clear();
});

// ── tbRecordSocraticPass ───────────────────────────────────────────────────────

describe('tbRecordSocraticPass', () => {
  it('advances a failing gap to reviewing', () => {
    const now = new Date().toISOString();
    seedModel({
      mastered: [],
      gaps: [{ concept: 'Entropy', status: 'failing', failedAt: now, lastSeenAt: now, passCount: 0 }],
      quizHistory: [],
    });

    const { result } = renderHook(() => useTutorBrain());

    act(() => {
      result.current.tbRecordSocraticPass('Entropy');
    });

    const saved = readModel();
    const gap = saved.gaps.find((g) => g.concept === 'Entropy');
    expect(gap).toBeDefined();
    expect(gap!.status).toBe('reviewing');
  });

  it('advances a reviewing gap to recovering', () => {
    const now = new Date().toISOString();
    seedModel({
      mastered: [],
      gaps: [{ concept: 'Entropy', status: 'reviewing', failedAt: now, lastSeenAt: now, passCount: 1 }],
      quizHistory: [],
    });

    const { result } = renderHook(() => useTutorBrain());

    act(() => {
      result.current.tbRecordSocraticPass('Entropy');
    });

    const saved = readModel();
    const gap = saved.gaps.find((g) => g.concept === 'Entropy');
    expect(gap).toBeDefined();
    expect(gap!.status).toBe('recovering');
  });

  it('moves a recovering gap to mastered after 2 passes', () => {
    const now = new Date().toISOString();
    seedModel({
      mastered: [],
      gaps: [
        // Already has 1 pass at recovering — one more should trigger mastery
        { concept: 'Entropy', status: 'recovering', failedAt: now, lastSeenAt: now, passCount: 1 },
      ],
      quizHistory: [],
    });

    const { result } = renderHook(() => useTutorBrain());

    act(() => {
      result.current.tbRecordSocraticPass('Entropy');
    });

    const saved = readModel();
    expect(saved.mastered).toContain('Entropy');
    expect(saved.gaps.find((g) => g.concept === 'Entropy')).toBeUndefined();
  });
});

// ── extractTopicFromResponse ───────────────────────────────────────────────────

describe('extractTopicFromResponse', () => {
  it('returns the topic from a structured <topic> marker', () => {
    const text = 'Some preamble\n<topic>Entropy</topic>\nMore text';
    expect(extractTopicFromResponse(text)).toBe('Entropy');
  });

  it('falls back to the first ## heading', () => {
    const text = '## Entropy\n\nSome explanation here.';
    expect(extractTopicFromResponse(text)).toBe('Entropy');
  });

  it('returns empty string when no heading or marker is present', () => {
    const text = 'This response has no heading at all.';
    expect(extractTopicFromResponse(text)).toBe('');
  });
});
