/**
 * Unit tests for useTutorBrain hook (tbRecordSocraticPass) and
 * the extractTopicFromResponse utility.
 */

import { renderHook, act } from '@testing-library/react';
import { useTutorBrain } from '@/hooks/useTutorBrain';
import type { StudentModel } from '@/hooks/useTutorBrain';
import { getStorageKey } from '@/lib/tutorStorage';
import { extractTopicFromResponse } from '@/lib/extractTopic';

// ── localStorage helpers ───────────────────────────────────────────────────────

// Test with a fixed user+book scope so the key matches what the hook uses
const TEST_USER_ID = 'test-user-1';
const TEST_BOOK_ID = 'test-book-1';
const STORAGE_KEY = getStorageKey(TEST_USER_ID, TEST_BOOK_ID);

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

    const { result } = renderHook(() => useTutorBrain(TEST_USER_ID, TEST_BOOK_ID));

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

    const { result } = renderHook(() => useTutorBrain(TEST_USER_ID, TEST_BOOK_ID));

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

    const { result } = renderHook(() => useTutorBrain(TEST_USER_ID, TEST_BOOK_ID));

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
  it('returns the topic from a structured <!-- chunks-topic:... --> marker', () => {
    const text = 'Some preamble\n## Entropy\n\nMore text\n<!-- chunks-topic:Entropy -->';
    expect(extractTopicFromResponse(text)).toBe('Entropy');
  });

  it('prioritises the HTML comment marker over heading parsing', () => {
    // Even when a heading is present, the explicit marker takes priority
    const text = '## Gibbs Free Energy\n\nExplanation.\n<!-- chunks-topic:Entropy -->';
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
