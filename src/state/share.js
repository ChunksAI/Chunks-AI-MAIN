// @ts-nocheck
/**
 * src/state/share.js — Share button logic for decks, exams, and study plans.
 *
 * Each exported function:
 *  1. Collects the relevant data from current state / window globals
 *  2. POSTs to /api/share
 *  3. Copies the generated URL to the clipboard
 *  4. Shows a toast with "Link copied!" + optional "Open link" action
 */

import { API_BASE, _getAuthHeader } from '../lib/api.js';
import { showToast } from '../components/Toast.js';
import { sp } from './studyplan/state.js';
import { spMasteryScore } from './studyplan/mastery.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

// Spinner SVG used in loading state (reused across all share buttons)
const _SPINNER_SVG =
  '<svg style="animation:spin 0.8s linear infinite" width="13" height="13" ' +
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83' +
  'M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83' +
  'M16.24 7.76l2.83-2.83"/></svg>';

async function _postShare(type, data) {
  const headers = await _getAuthHeader();
  const res = await fetch(`${API_BASE}/api/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ type, data }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function _copyAndToast(url) {
  const fullUrl = window.location.origin + url;
  try {
    await navigator.clipboard.writeText(fullUrl);
    showToast(
      '🔗',
      'Link copied! ' +
        `<a href="${fullUrl}" target="_blank" rel="noopener" ` +
        'style="color:var(--gold);text-decoration:underline;cursor:pointer;">Open</a>',
      'var(--gold)',
    );
  } catch (_) {
    // Clipboard not available — still show the URL
    showToast('🔗', 'Share link: ' + fullUrl, 'var(--gold)');
  }
}

function _setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = _SPINNER_SVG + ' Sharing…';
  } else {
    btn.disabled = false;
    if (btn.dataset.origText) btn.innerHTML = btn.dataset.origText;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Share a flashcard deck.
 *
 * @param {object} deck  — deck object with at least `name` and `cards` fields
 * @param {HTMLElement|null} [btn]  — optional button element for loading state
 */
export async function shareDeck(deck, btn = null) {
  _setLoading(btn, true);
  try {
    const payload = {
      title:  deck.name || 'Untitled Deck',
      cards:  (deck.cards || []).map(c => ({ q: c.q || c.front || '', a: c.a || c.back || '' })),
    };
    const { url } = await _postShare('deck', payload);
    await _copyAndToast(url);
  } catch (err) {
    showToast('⚠️', 'Could not create share link: ' + err.message, 'var(--red)');
  } finally {
    _setLoading(btn, false);
  }
}

/**
 * Share the current exam results.
 * Reads state from window globals set by the exam script in app.html.
 *
 * @param {HTMLElement|null} [btn]
 */
export async function shareExamResults(btn = null) {
  _setLoading(btn, true);
  try {
    // Exam state lives in app.html script-scope globals exposed on window
    const questions = window._examQuestions || [];
    const answers   = window._examAnswers   || [];
    const topic     = window._examTopic     || 'Exam';
    const type      = window._examType      || '';
    const diff      = window._examDiff      || '';

    const total   = questions.length;
    const correct = answers.filter(a => a && a.correct).length;
    const wrong   = total - correct;
    const pct     = total > 0 ? Math.round(correct / total * 100) : 0;

    // Build compact review items (question + correct answer + user's choice)
    const review = questions.map((q, i) => {
      const ans = answers[i] || {};
      return {
        q:           q.q,
        answer:      q.answer,
        options:     q.options,
        correct:     !!ans.correct,
        selected:    ans.selected,
        skipped:     !!ans.skipped,
        explanation: q.explanation || '',
      };
    });

    // Duration is rendered into the DOM by _examFinish() — read it from there
    // since no separate window global is exposed for this value.
    const durationEl = document.getElementById('stat-time-taken');
    const duration = durationEl ? durationEl.textContent || '—' : '—';

    const payload = {
      title:    topic,
      subtitle: [type, diff].filter(Boolean).join(' · '),
      review,
      total,
      correct,
      wrong,
      score:    pct,
      duration,
      date:     new Date().toLocaleDateString(),
    };
    const { url } = await _postShare('exam', payload);
    await _copyAndToast(url);
  } catch (err) {
    showToast('⚠️', 'Could not create share link: ' + err.message, 'var(--red)');
  } finally {
    _setLoading(btn, false);
  }
}

/**
 * Share the current study plan.
 *
 * @param {HTMLElement|null} [btn]
 */
export async function shareStudyPlan(btn = null) {
  _setLoading(btn, true);
  try {
    const plan = sp.currentPlan;
    if (!plan || !Array.isArray(plan.concepts) || plan.concepts.length === 0) {
      showToast('⚠️', 'No active study plan to share.', 'var(--red)');
      return;
    }

    // Build nodes array with mastery status for the share page
    const nodes = plan.concepts.map((c, i) => {
      const masteryPct = spMasteryScore(i);
      let status = 'locked';
      if (masteryPct >= 80)     status = 'mastered';
      else if (masteryPct > 0)  status = 'in-progress';
      else if (i === 0)         status = 'ready';
      return {
        title:       c.title || '',
        description: c.description || '',
        status,
        mastery:     masteryPct,
        activities:  c.activities || [],
      };
    });

    // Overall readiness = average mastery across all concepts
    const totalMastery = nodes.reduce((s, n) => s + n.mastery, 0);
    const readiness = nodes.length > 0 ? Math.round(totalMastery / nodes.length) : 0;

    const mastered   = nodes.filter(n => n.status === 'mastered').length;
    const flashcards = Array.isArray(window._fcDecksCache) ? window._fcDecksCache.length : 0;

    const payload = {
      title:    plan.topic || 'Study Plan',
      nodes,
      readiness,
      stats: {
        weeks:      nodes.length,
        mastered,
        flashcards,
        studyTime:  '—',
      },
    };
    const { url } = await _postShare('plan', payload);
    await _copyAndToast(url);
  } catch (err) {
    showToast('⚠️', 'Could not create share link: ' + err.message, 'var(--red)');
  } finally {
    _setLoading(btn, false);
  }
}
