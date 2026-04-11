'use client';

import { useState, useRef } from 'react';
import { useExam } from '@/contexts/ExamContext';
import { useStudy } from '@/contexts/StudyContext';
import type { SlideItem } from '@/types/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function topicToSlides(topic: string): SlideItem[] {
  return [{ title: topic, slide_number: 1, content: [topic], notes: '' }];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConceptProgress() {
  const { state } = useExam();
  const { concepts, questions, loading, error } = state;
  const allConceptsFound = concepts.length > 0 && !loading;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ fontWeight: 600, marginBottom: 20, fontSize: 15 }}>
        Extracting concepts from your document…
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {concepts.map((c, i) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              animation: `fadeUp 0.3s ease both`,
              animationDelay: `${i * 0.08}s`,
              fontSize: 14,
            }}
          >
            <span style={{ color: 'var(--accent2)', fontWeight: 600, fontSize: 16 }}>✓</span>
            <span>{c.concept}</span>
          </div>
        ))}

        {loading && concepts.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <span style={{ color: 'var(--accent)' }}>⟳</span>
            <span style={{ color: 'var(--text3)' }}>Identifying key concepts…</span>
          </div>
        )}

        {loading && concepts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <span style={{ color: 'var(--accent)' }}>⟳</span>
            <span style={{ color: 'var(--text3)' }}>Generating questions for each concept…</span>
          </div>
        )}
      </div>

      {allConceptsFound && questions.length > 0 && (
        <div style={{ marginTop: 20, color: 'var(--text3)', fontSize: 13 }}>
          ✓ {questions.length} questions ready — starting exam…
        </div>
      )}

      {error && (
        <div style={{ marginTop: 16, color: 'var(--danger)', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

// ─── ExamSetup ────────────────────────────────────────────────────────────────

export default function ExamSetup() {
  const { state, dispatch, handleStartExam } = useExam();
  const studyCtx = useStudy();
  const { config, loading, error } = state;
  const { slides, docTitle } = studyCtx.state;

  const [customTime, setCustomTime] = useState('');
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [topicInput, setTopicInput] = useState('');

  const hasDocument = slides.length > 0;

  const setQuestionCount = (n: 10 | 25 | 50) =>
    dispatch({ type: 'SET_CONFIG', payload: { questionCount: n } });

  const setTimeLimit = (seconds: number) => {
    setUseCustomTime(false);
    dispatch({ type: 'SET_CONFIG', payload: { timeLimit: seconds } });
  };

  const setDifficulty = (d: typeof config.difficulty) =>
    dispatch({ type: 'SET_CONFIG', payload: { difficulty: d } });

  const handleCustomTime = (val: string) => {
    setCustomTime(val);
    const mins = parseInt(val, 10);
    if (!isNaN(mins) && mins > 0) {
      dispatch({ type: 'SET_CONFIG', payload: { timeLimit: mins * 60 } });
    }
  };

  const handleGenerate = () => {
    let slideSource: SlideItem[];
    if (hasDocument && config.source === 'document') {
      slideSource = slides;
    } else {
      const topic = topicInput.trim() || config.topic;
      dispatch({ type: 'SET_CONFIG', payload: { topic } });
      slideSource = topicToSlides(topic);
    }
    void handleStartExam(slideSource);
  };

  const canGenerate = hasDocument
    ? config.source === 'document' || topicInput.trim().length > 0
    : topicInput.trim().length > 0 || config.topic.length > 0;

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <ConceptProgress />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 860, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, marginBottom: 24 }}>
        Configure Your Exam
      </h2>

      {/* ── Three-column card layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>

        {/* Question count */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Questions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([10, 25, 50] as const).map((n) => (
              <button
                key={n}
                onClick={() => setQuestionCount(n)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${config.questionCount === n ? 'var(--accent)' : 'var(--border2)'}`,
                  background: config.questionCount === n ? 'var(--accent-light)' : 'transparent',
                  color: config.questionCount === n ? 'var(--accent)' : 'var(--text)',
                  fontWeight: config.questionCount === n ? 700 : 400,
                  fontSize: 15,
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                }}
              >
                {n} Questions
              </button>
            ))}
          </div>
        </div>

        {/* Time limit */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Time Limit
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: '30 min', seconds: 1800 },
              { label: '60 min', seconds: 3600 },
              { label: '90 min', seconds: 5400 },
            ].map(({ label, seconds }) => (
              <button
                key={seconds}
                onClick={() => setTimeLimit(seconds)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${!useCustomTime && config.timeLimit === seconds ? 'var(--accent)' : 'var(--border2)'}`,
                  background: !useCustomTime && config.timeLimit === seconds ? 'var(--accent-light)' : 'transparent',
                  color: !useCustomTime && config.timeLimit === seconds ? 'var(--accent)' : 'var(--text)',
                  fontWeight: !useCustomTime && config.timeLimit === seconds ? 700 : 400,
                  fontSize: 15,
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                }}
              >
                {label}
              </button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input
                type="number"
                min="1"
                placeholder="Custom (min)"
                value={customTime}
                onClick={() => setUseCustomTime(true)}
                onChange={(e) => handleCustomTime(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${useCustomTime ? 'var(--accent)' : 'var(--border2)'}`,
                  background: 'transparent',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Difficulty */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Difficulty
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['easy', 'medium', 'hard', 'mixed'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${config.difficulty === d ? 'var(--accent)' : 'var(--border2)'}`,
                  background: config.difficulty === d ? 'var(--accent-light)' : 'transparent',
                  color: config.difficulty === d ? 'var(--accent)' : 'var(--text)',
                  fontWeight: config.difficulty === d ? 700 : 400,
                  fontSize: 15,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'var(--transition)',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Source selector ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Source
        </div>

        {hasDocument && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="radio"
              name="source"
              checked={config.source === 'document'}
              onChange={() => dispatch({ type: 'SET_CONFIG', payload: { source: 'document' } })}
            />
            <span style={{ fontSize: 14 }}>
              Use uploaded document
              <span style={{ color: 'var(--text3)', marginLeft: 6 }}>— {docTitle || 'current document'}</span>
            </span>
          </label>
        )}

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input
            type="radio"
            name="source"
            style={{ marginTop: 3 }}
            checked={!hasDocument || config.source === 'topic'}
            onChange={() => dispatch({ type: 'SET_CONFIG', payload: { source: 'topic' } })}
          />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 14 }}>Enter a topic</span>
            <input
              type="text"
              placeholder="e.g. Organic Chemistry, Cell Biology…"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              disabled={hasDocument && config.source === 'document'}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 8,
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border2)',
                background: (hasDocument && config.source === 'document') ? 'var(--bg2)' : 'transparent',
                fontSize: 14,
                outline: 'none',
                color: (hasDocument && config.source === 'document') ? 'var(--text3)' : 'var(--text)',
              }}
            />
          </div>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        style={{
          width: '100%',
          padding: '14px 24px',
          borderRadius: 'var(--radius)',
          border: 'none',
          background: canGenerate ? 'var(--accent)' : 'var(--border2)',
          color: canGenerate ? 'white' : 'var(--text3)',
          fontWeight: 600,
          fontSize: 15,
          cursor: canGenerate ? 'pointer' : 'not-allowed',
          transition: 'var(--transition)',
        }}
      >
        Generate Exam →
      </button>
    </div>
  );
}
