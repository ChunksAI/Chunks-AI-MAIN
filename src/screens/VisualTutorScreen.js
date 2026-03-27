// @ts-nocheck
/**
 * src/screens/VisualTutorScreen.js
 *
 * Visual AI Tutor — step-based lesson player with canvas whiteboard.
 * Entry → Lesson (5 steps + quiz) → Complete.
 *,
 * Architecture:
 *   • 2 built-in lessons (pH Scale, Newton's Laws) + generic fallback
 *   • Canvas2D drawing engine (no SVG library dependency),
 *   • "Ask anything" wired to POST /ask with mode: visual_tutor
 *   • Accessible from flashcard Hard rating, sidebar, and Exam weak-concept flow
 */

import { API_BASE, _getAuthHeader } from '../lib/api.js';
import { guestGate, recordUsage } from '../lib/guestLimits.js';
import { showScreen, setNavFromHistory } from '../state/navigation/screens.js';

// ── HTML ──────────────────────────────────────────────────────────────────────

const VT_HTML = `
<div class="screen" id="screen-visual" style="display:none;">

  <aside class="sidebar" data-sidebar-screen="visual"></aside>

  <!-- ── SCREEN 1: ENTRY ─────────────────────────────────────────────── -->
  <div class="vtp-screen active" id="screen-entry">
    <div class="orb orb-g"></div>
    <div class="orb orb-v"></div>
    <div class="orb orb-t"></div>
    <canvas class="vtp-particles" id="vtp-particles"></canvas>

    <!-- Scroll hint — shown when content overflows -->
    <div class="vtp-scroll-hint" id="vtp-scroll-hint">
      <button class="vtp-scroll-hint-btn" onclick="document.getElementById('screen-entry').scrollBy({top:200,behavior:'smooth'})">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        Scroll for examples
      </button>
    </div>

    <div class="entry-inner">
      <div class="entry-hook">
        <div class="entry-hook-dot"></div>
        See it. Understand it. Remember it.
      </div>

      <div class="entry-badge">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 21h8m-4-4v4"/></svg>
        Visual Tutor · Chunks AI
      </div>

      <div class="entry-h">
        What do you want to<br><em>understand today?</em>
      </div>
      <div class="entry-s">
        Type any topic and watch it come to life — animated diagrams,<br>
        interactive visuals, and bite-size explanations. <strong style="color:var(--t1-vt);">Under 3 minutes.</strong>
      </div>

      <div class="entry-input-wrap">
        <input class="entry-input" id="vtp-entry-input" placeholder="">
        <button class="entry-start" id="vtp-entry-start">Visualize →</button>
      </div>

      <!-- Feature pills -->
      <div class="vtp-feature-pills">
        <div class="vtp-fpill">
          <span class="vtp-fpill-icon" style="background:var(--gm);color:var(--gold);">✦</span>
          Animated diagrams
        </div>
        <div class="vtp-fpill">
          <span class="vtp-fpill-icon" style="background:var(--vm);color:var(--violet);">◉</span>
          Quiz after each step
        </div>
        <div class="vtp-fpill">
          <span class="vtp-fpill-icon" style="background:var(--tm);color:var(--teal);">≋</span>
          Ask anything live
        </div>
      </div>

      <div class="entry-divider"><div class="entry-divider-text">or pick an example</div></div>

      <!-- Animated example cards -->
      <div class="vtp-example-cards" id="vtp-chips">

        <div class="vtp-card gold" data-topic="pH Scale">
          <div class="vtp-card-preview">
            <div class="vtp-mini-bars" id="vtp-bars-ph"></div>
          </div>
          <div class="vtp-card-topic">⚗ pH Scale</div>
          <div class="vtp-card-sub">acid · neutral · base</div>
          <div class="vtp-card-tag">chemistry</div>
        </div>

        <div class="vtp-card violet" data-topic="Cell Structure">
          <div class="vtp-card-preview">
            <div class="vtp-mini-cell">
              <div class="vtp-cell-membrane"></div>
              <div class="vtp-cell-nucleus"></div>
              <div class="vtp-cell-orb"></div>
              <div class="vtp-cell-orb" style="animation-delay:-1.5s;width:6px;height:6px;"></div>
              <div class="vtp-cell-orb" style="animation-delay:-3s;width:5px;height:5px;background:rgba(232,172,46,.6);border-color:rgba(232,172,46,.9);"></div>
            </div>
          </div>
          <div class="vtp-card-topic">🧬 Cell Structure</div>
          <div class="vtp-card-sub">nucleus · membrane · organelles</div>
          <div class="vtp-card-tag">biology</div>
        </div>

        <div class="vtp-card teal" data-topic="Wave Motion">
          <div class="vtp-card-preview">
            <div class="vtp-mini-wave">
              <svg id="vtp-wave-svg" width="100%" height="100%" viewBox="0 0 200 72" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="vtp-wg" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stop-color="rgba(45,212,191,0.1)"/>
                    <stop offset="50%" stop-color="rgba(45,212,191,0.55)"/>
                    <stop offset="100%" stop-color="rgba(45,212,191,0.1)"/>
                  </linearGradient>
                </defs>
                <path id="vtp-wave1" fill="none" stroke="url(#vtp-wg)" stroke-width="2.5" stroke-linecap="round"/>
                <path id="vtp-wave2" fill="none" stroke="rgba(139,124,248,0.35)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="4 3"/>
              </svg>
            </div>
          </div>
          <div class="vtp-card-topic">〰 Wave Motion</div>
          <div class="vtp-card-sub">frequency · amplitude · phase</div>
          <div class="vtp-card-tag">physics</div>
        </div>

        <div class="vtp-card gold" data-topic="Supply &amp; Demand">
          <div class="vtp-card-preview">
            <svg viewBox="0 0 120 72" width="100%" height="100%" style="position:absolute;inset:0;">
              <path d="M10,12 L110,62" stroke="var(--gold-vt)" stroke-width="2" stroke-linecap="round" fill="none" stroke-dasharray="140" stroke-dashoffset="140">
                <animate attributeName="stroke-dashoffset" from="140" to="0" dur="1.2s" fill="freeze" begin="0.3s"/>
              </path>
              <path d="M10,62 L110,12" stroke="var(--teal)" stroke-width="2" stroke-linecap="round" fill="none" stroke-dasharray="140" stroke-dashoffset="140">
                <animate attributeName="stroke-dashoffset" from="140" to="0" dur="1.2s" fill="freeze" begin="0.6s"/>
              </path>
              <circle cx="60" cy="37" r="4" fill="var(--s2)" stroke="var(--gold-vt)" stroke-width="1.5" opacity="0">
                <animate attributeName="opacity" from="0" to="1" dur="0.4s" fill="freeze" begin="1.5s"/>
              </circle>
              <text x="12" y="10" font-size="8" fill="var(--gold-vt)" font-family="DM Mono,monospace">D</text>
              <text x="12" y="68" font-size="8" fill="var(--teal)" font-family="DM Mono,monospace">S</text>
            </svg>
          </div>
          <div class="vtp-card-topic">📈 Supply &amp; Demand</div>
          <div class="vtp-card-sub">equilibrium · price · market</div>
          <div class="vtp-card-tag">economics</div>
        </div>

        <div class="vtp-card violet" data-topic="DNA Structure">
          <div class="vtp-card-preview">
            <svg id="vtp-dna-svg" viewBox="0 0 100 72" width="100%" height="100%" style="position:absolute;inset:0;"></svg>
          </div>
          <div class="vtp-card-topic">🧪 DNA Structure</div>
          <div class="vtp-card-sub">helix · base pairs · genes</div>
          <div class="vtp-card-tag">biology</div>
        </div>

        <div class="vtp-card" data-topic="Newton's Laws">
          <div class="vtp-card-preview" style="display:flex;align-items:center;justify-content:center;gap:8px;">
            <span class="vtp-force-arrow" style="color:var(--gold-vt);">→</span>
            <span style="font-size:20px;color:var(--t3);">⚽</span>
            <span class="vtp-force-arrow" style="color:var(--teal);animation-delay:.5s;">←</span>
          </div>
          <div class="vtp-card-topic">⚡ Newton's Laws</div>
          <div class="vtp-card-sub">force · motion · reaction</div>
          <div class="vtp-card-tag">physics</div>
        </div>

      </div>

      <!-- Extra chips -->
      <div class="entry-chips" style="margin-top:12px;" id="vtp-extra-chips">
        <div class="chip" data-topic="Photosynthesis">🌿 Photosynthesis</div>
        <div class="chip" data-topic="Osmosis">💧 Osmosis</div>
        <div class="chip" data-topic="Stoichiometry">🔢 Stoichiometry</div>
        <div class="chip" data-topic="Mitosis">🔬 Mitosis</div>
        <div class="chip" data-topic="Electric Circuits">⚡ Electric Circuits</div>
      </div>
    </div>
  </div>

  <!-- ── SCREEN 2: LESSON ────────────────────────────────────────────── -->
  <div class="vtp-screen" id="screen-lesson">

    <!-- XP Toast -->
    <div class="xp-toast" id="xp-toast">⚡ +10 XP</div>

    <div class="lesson-header">
      <div class="lh-logo">
        <svg width="20" height="20" viewBox="0 0 100 100">
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity=".95"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity=".88"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity=".8"/>
          <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
        </svg>
        Chunks <em>AI</em>
      </div>
      <div class="lh-topic" id="lh-topic-label">–</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="lh-timer" id="lh-timer">⏱️ ~2 min</div>
        <div class="lh-streak" id="lh-streak">🔥 3-day streak</div>
        <button class="lh-exit" id="vtp-exit-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Exit
        </button>
      </div>
    </div>

    <!-- Whiteboard -->
    <div class="wb-area" id="wb-area">
      <div class="step-prog"><div class="step-prog-fill" id="prog-fill" style="width:0%"></div></div>
      <div class="step-dots" id="step-dots"></div>
      <canvas id="wb-canvas" class="wb-canvas"></canvas>

      <!-- Quiz pre-announce -->
      <div class="quiz-announce" id="quiz-announce">
        <div class="quiz-announce-pill" id="quiz-announce-pill">⚡ Quick check before we continue…</div>
      </div>

      <!-- MCQ Quiz Overlay -->
      <div class="quiz-overlay" id="quiz-overlay">
        <div class="quiz-card">
          <div class="quiz-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Quick Check · Step <span id="quiz-step-num">3</span>
          </div>
          <div class="quiz-q" id="quiz-question">What is pH 7?</div>
          <div class="quiz-options" id="quiz-options"></div>
          <div class="quiz-xp-pop" id="quiz-xp-pop">⚡ +20 XP &nbsp;🔥 Nice!</div>
          <div class="quiz-feedback" id="quiz-feedback"></div>
          <button class="quiz-continue" id="quiz-continue">Continue Lesson →</button>
        </div>
      </div>
    </div>

    <!-- Bottom panel -->
    <div class="bottom-panel">
      <div class="exp-wrap">
        <div class="exp-purpose" id="exp-purpose"></div>
        <div class="exp-label" id="exp-label">Step 1 — Introduction</div>
        <div class="exp-text" id="exp-text"><span class="cursor"></span></div>
        <div class="simplified-wrap" id="simplified-wrap">
          <div class="simplified-label">✦ Simplified version</div>
          <span id="simplified-text"></span>
        </div>
      </div>

      <!-- ── Step Challenge (retrieval practice) ──────────── -->
      <div class="step-challenge" id="step-challenge">
        <div class="challenge-prompt">
          <span class="challenge-icon">⚡</span>
          <span class="challenge-q" id="challenge-q"></span>
        </div>
        <div class="challenge-input-row" id="challenge-input-row">
          <input class="challenge-input" id="challenge-input" placeholder="Type your answer…">
          <button class="challenge-submit" id="challenge-submit">→</button>
        </div>
        <div class="challenge-reveal" id="challenge-reveal">
          <div class="challenge-hint-label">Model answer</div>
          <div class="challenge-model-answer" id="challenge-model-answer"></div>
          <button class="challenge-continue" id="challenge-continue">Continue →</button>
        </div>
        <button class="challenge-skip" id="challenge-skip">Skip</button>
      </div>

      <!-- Got it? row — PRIMARY CTA -->
      <div class="gotit-row" id="gotit-row">
        <button class="gotit-yes" id="vtp-gotit-yes">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Got it!
        </button>
        <button class="gotit-no" id="vtp-gotit-no">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Not really
        </button>
        <button class="btn-skip" id="btn-skip">Skip → Quiz</button>
      </div>

      <!-- Controls bar -->
      <div class="controls-bar">
        <div class="ask-reply" id="ask-reply">
          <span class="ask-reply-close" id="vtp-reply-close">✕</span>
          <span id="ask-reply-text"></span>
        </div>
        <div class="step-counter"><span id="step-cur">1</span>/<span id="step-tot">5</span></div>
        <input class="ask-input" id="ask-input" placeholder="Ask anything…">
        <button class="btn-simplify" id="btn-simplify" title="Simplify this step">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Simpler
        </button>
        <div class="autoplay-toggle" id="autoplay-toggle" title="Auto-advance">
          <div class="autoplay-track" id="autoplay-track">
            <div class="autoplay-thumb"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── SCREEN 3: COMPLETE ──────────────────────────────────────────── -->
  <div class="vtp-screen" id="screen-complete">
    <div class="orb orb-g" style="opacity:.08"></div>

    <div class="complete-card">
      <div class="complete-glow"></div>
      <div class="complete-emoji">🎉</div>
      <div class="complete-h">Lesson Complete!</div>
      <div class="complete-sub">You understood <strong id="complete-topic">pH Scale</strong></div>
      <div class="complete-confidence">
        🧠 You now understand this better than <strong>80% of students</strong> who study this topic.
      </div>

      <div class="score-ring-wrap">
        <div class="score-ring">
          <svg width="110" height="110" viewBox="0 0 110 110">
            <circle cx="55" cy="55" r="45" stroke="var(--s3)" stroke-width="8" fill="none"/>
            <circle class="score-arc" id="score-arc" cx="55" cy="55" r="45" stroke="var(--teal)" stroke-width="8" fill="none"/>
          </svg>
          <div class="score-num">
            <strong id="score-val">5/5</strong>
            <span>Steps</span>
          </div>
        </div>
        <div class="score-detail">
          <div class="score-detail-h">Great session</div>
          <div class="score-stat"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>Quiz: <span id="score-quiz">Passed</span></div>
          <div class="score-stat"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Simplify used: <span id="score-simplify">0×</span></div>
          <div class="score-stat"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Questions asked: <span id="score-asks">0</span></div>
          <div class="score-stat" style="color:var(--gold-vt);font-weight:600;margin-top:6px;">⚡ XP earned: <span id="score-xp">+50 XP</span></div>
        </div>
      </div>

      <div class="lesson-summary" id="lesson-summary">
        <div class="summary-title">Key takeaways</div>
        <div id="summary-items"></div>
      </div>

      <div class="complete-actions">
        <button class="btn-primary-action" id="vtp-again-btn">Practice Again ↺</button>
        <button class="btn-review-weak hidden" id="btn-review-weak">📌 Review weak areas</button>
        <button class="btn-sec-action" id="vtp-new-btn">Learn Something New →</button>
      </div>

      <!-- ── Teach It Back (active recall) ──────────────── -->
      <div class="ttb-section" id="ttb-section">
        <div class="ttb-header">
          <div class="ttb-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Teach It Back
          </div>
          <div class="ttb-desc">Explain <strong id="ttb-topic-label">this topic</strong> in your own words — the AI will score your understanding.</div>
        </div>
        <textarea class="ttb-textarea" id="ttb-textarea" placeholder="Write 2–3 sentences about what you just learned…"></textarea>
        <button class="ttb-submit-btn" id="ttb-submit-btn">Check my understanding →</button>
        <div class="ttb-result" id="ttb-result">
          <div class="ttb-score-badge" id="ttb-score-badge"></div>
          <div class="ttb-feedback-text" id="ttb-feedback-text"></div>
        </div>
      </div>

      <!-- ── What to learn next ──────────────────────────── -->
      <div class="related-next" id="related-next">
        <div class="related-next-title">What to learn next</div>
        <div class="related-next-chips" id="related-next-chips"></div>
      </div>

  <!-- ── SCREEN: LOADING ─────────────────────────────────────────────── -->
  <div class="vtp-screen" id="screen-loading">
    <div class="orb orb-g" style="opacity:.05"></div>
    <div class="vtp-loading-inner">
      <div class="vtp-loading-logo">
        <svg width="40" height="40" viewBox="0 0 100 100">
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity=".95"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity=".88"/>
          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity=".8"/>
          <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>
        </svg>
      </div>
      <div class="vtp-loading-title">Building your lesson…</div>
      <div class="vtp-loading-topic" id="vtp-loading-topic"></div>
      <div class="vtp-loading-bar"><div class="vtp-loading-bar-fill" id="vtp-loading-bar-fill"></div></div>
      <div class="vtp-loading-steps" id="vtp-loading-steps">
        <div class="vtp-lstep" id="vtp-lstep-0">Analysing topic</div>
        <div class="vtp-lstep" id="vtp-lstep-1">Structuring 5 steps</div>
        <div class="vtp-lstep" id="vtp-lstep-2">Designing visuals</div>
        <div class="vtp-lstep" id="vtp-lstep-3">Writing quiz question</div>
      </div>
      <button class="vtp-loading-cancel" id="vtp-loading-cancel">Cancel</button>
      <div class="vtp-loading-error" id="vtp-loading-error" style="display:none">
        <div class="vtp-loading-error-msg" id="vtp-loading-error-msg"></div>
        <button class="vtp-loading-retry" id="vtp-loading-retry">Try again →</button>
      </div>
    </div>
  </div>

</div>
`;

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS COLOR PALETTE
// ─────────────────────────────────────────────────────────────────────────────

const VTP_COLORS = {
  amber:  { fill: 'rgba(232,172,46,0.13)',  stroke: '#e8ac2e', text: '#e8ac2e',  bold: '#c49020' },
  blue:   { fill: 'rgba(96,165,250,0.13)',  stroke: '#60a5fa', text: '#60a5fa',  bold: '#3b82f6' },
  teal:   { fill: 'rgba(45,212,191,0.13)',  stroke: '#2dd4bf', text: '#2dd4bf',  bold: '#14b8a6' },
  red:    { fill: 'rgba(248,113,113,0.13)', stroke: '#f87171', text: '#f87171',  bold: '#ef4444' },
  green:  { fill: 'rgba(74,222,128,0.13)',  stroke: '#4ade80', text: '#4ade80',  bold: '#22c55e' },
  purple: { fill: 'rgba(167,139,250,0.13)', stroke: '#a78bfa', text: '#a78bfa',  bold: '#8b5cf6' },
};
function _vtpCol(name) { return VTP_COLORS[name] || VTP_COLORS.amber; }

// ─────────────────────────────────────────────────────────────────────────────
// AI LESSON GENERATION
// ─────────────────────────────────────────────────────────────────────────────

let _vtpLoadingAbort  = null;   // AbortController for in-flight fetch
let _vtpLoadingTimer  = null;   // interval for loading animation
let _vtpLessonCache   = {};     // topic → lesson (session memory, no re-fetch)

const VTP_LESSON_PROMPT = (topic) =>
`You are the lesson engine for Chunks AI, a visual tutoring app for students.
Generate a complete 5-step lesson for the topic: "${topic}"

Return ONLY valid JSON — no markdown fences, no explanation text, just the raw JSON object.

{
  "hook": "One punchy sentence — why this confuses students or why it matters",
  "summary": ["takeaway 1", "takeaway 2", "takeaway 3", "takeaway 4"],
  "relatedTopics": ["Related concept 1", "Related concept 2", "Related concept 3"],
  "quiz": {
    "onStep": 3,
    "q": "A specific multiple-choice question testing the core concept",
    "options": [
      {"text": "correct answer — specific and accurate", "correct": true},
      {"text": "plausible wrong answer", "correct": false},
      {"text": "plausible wrong answer", "correct": false},
      {"text": "plausible wrong answer", "correct": false}
    ],
    "feedbackRight": "✓ Why this answer is correct — 1 sentence",
    "feedbackWrong": "✗ The common mistake and the right idea — 1 sentence"
  },
  "steps": [
    {
      "label": "Step 1 — Short Title",
      "text": "<strong>Hook sentence.</strong> 2-3 clear educational sentences. Use <em>key terms</em>.",
      "simple": "One plain-English sentence. No jargon.",
      "challenge": "One specific question testing this step (end with ?) — under 12 words",
      "draw": { ... see draw types below ... },
      "contextualReplies": [
        "Direct answer to likely student question about this step",
        "Answer to another likely question",
        "Answer to a third likely question"
      ]
    }
  ]
}

For each step's "draw" field choose the best type:

TYPE "flow" — sequences, processes, cause-and-effect:
{"type":"flow","items":[{"label":"Name","sub":"1 detail","color":"amber"}],"note":"footer"}
Use 2–5 items. Colors: amber, blue, teal, red, green, purple.

TYPE "equation" — formulas with labeled parts:
{"type":"equation","formula":"A = B × C","parts":[{"symbol":"A","name":"Full name","unit":"unit","color":"amber"},{"symbol":"B","name":"Full name","unit":"unit","color":"blue"},{"symbol":"C","name":"Full name","unit":"unit","color":"teal"}],"note":"plain-English meaning"}

TYPE "compare" — two contrasting things side by side:
{"type":"compare","leftLabel":"Left","leftPoints":["point 1","point 2","point 3"],"leftColor":"red","rightLabel":"Right","rightPoints":["point 1","point 2","point 3"],"rightColor":"teal","note":"footer"}

TYPE "scale" — spectrum, range, gradient:
{"type":"scale","lowLabel":"Low end","highLabel":"High end","lowColor":"red","highColor":"teal","markers":[{"label":"Name","value":0.15,"sub":"detail"},{"label":"Name","value":0.5,"sub":"detail"}],"note":"footer"}
value is 0.0 (left edge) to 1.0 (right edge).

TYPE "bullets" — key facts or summary points:
{"type":"bullets","title":"Optional heading","items":[{"icon":"→","text":"Point one — keep under 55 chars"},{"icon":"→","text":"Point two"}],"color":"teal","note":"footer"}
Max 5 items.

Rules:
- Generate exactly 5 steps.
- Use a DIFFERENT draw type for each step where possible.
- Make content specific and accurate for "${topic}" — NOT generic filler.
- contextualReplies must be real, specific answers a tutor would give — not "great question!".
- quiz options must be specific to the topic, not abstract.
- relatedTopics: 3 closely related concepts the student should learn next (short names only).
- challenge: a retrieval-practice question that tests the core idea of THAT step (end with ?), max 12 words.`;

async function _vtpFetchLesson(topic) {
  // Cache hit — instant
  if (_vtpLessonCache[topic]) return _vtpLessonCache[topic];

  _vtpLoadingAbort = new AbortController();
  const authHeader = await _getAuthHeader?.() ?? {};

  const res = await fetch(`${API_BASE}/ask`, {
    method:  'POST',
    signal:  _vtpLoadingAbort.signal,
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({
      question:   VTP_LESSON_PROMPT(topic),
      mode:       'visual_tutor',
      bookId:     'none',
      complexity: 7,
      history:    [],
    }),
  });

  if (!res.ok) throw new Error(`Server error ${res.status} — please try again`);

  const data  = await res.json();
  const raw   = (data.answer ?? data.response ?? data.text ?? '').trim();
  const clean = raw
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '').trim();

  let lesson;
  try {
    lesson = JSON.parse(clean);
  } catch (_) {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) {
      try { lesson = JSON.parse(m[0]); }
      catch (_2) { throw new Error('AI returned malformed JSON — please try again'); }
    } else {
      throw new Error('AI response was not valid JSON — please try again');
    }
  }

  // Validate + fill any missing fields
  if (!lesson.steps?.length) throw new Error('AI returned an incomplete lesson — please try again');

  while (lesson.steps.length < 5) {
    const i = lesson.steps.length + 1;
    lesson.steps.push({
      label: `Step ${i} — Summary`,
      text:  `<strong>Wrapping up.</strong> Let's consolidate what you've learned about ${topic}.`,
      simple: `Review the key ideas about ${topic}.`,
      draw:  { type: 'bullets', items: [{ icon: '→', text: `Key idea about ${topic}` }], color: 'teal' },
      contextualReplies: [`That's a great question about ${topic}.`],
    });
  }
  lesson.hook    = lesson.hook    || `You'll understand ${topic} in under 3 minutes`;
  lesson.summary = lesson.summary || [`${topic} explained`, 'Visual steps complete', 'Quiz passed', 'Ready to apply'];
  lesson.quiz    = lesson.quiz    || {
    onStep: 3,
    q: `What is the core idea behind ${topic}?`,
    options: [
      { text: 'The relationship between its key variables', correct: true },
      { text: 'When it was historically discovered', correct: false },
      { text: 'The exceptions to the rule', correct: false },
      { text: 'Its mathematical proof', correct: false },
    ],
    feedbackRight: '✓ Correct — the core relationship is the key insight.',
    feedbackWrong:  `✗ Focus on the core relationship in ${topic}.`,
  };

  // Normalise every step's draw field — string keys from old lessons → object
  lesson.steps.forEach(step => {
    if (!step.draw || typeof step.draw === 'string') {
      step.draw = { type: 'bullets', items: [{ icon: '→', text: step.label || 'Key idea' }], color: 'amber' };
    }
  });

  _vtpLessonCache[topic] = lesson;
  return lesson;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SCREEN HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _vtpStartLoadingAnim() {
  const steps   = document.querySelectorAll('#screen-loading .vtp-lstep');
  const barFill = document.getElementById('vtp-loading-bar-fill');
  const errEl   = document.getElementById('vtp-loading-error');
  if (errEl)   errEl.style.display = 'none';
  steps.forEach(s => s.classList.remove('active', 'done'));
  if (steps[0]) steps[0].classList.add('active');
  if (barFill)  barFill.style.width = '8%';
  let cur = 0;
  if (_vtpLoadingTimer) clearInterval(_vtpLoadingTimer);
  _vtpLoadingTimer = setInterval(() => {
    if (cur < steps.length - 1) {
      steps[cur].classList.remove('active');
      steps[cur].classList.add('done');
      cur++;
      steps[cur].classList.add('active');
      const pct = 8 + Math.round((cur / steps.length) * 82);
      if (barFill) barFill.style.width = pct + '%';
    }
  }, 950);
}

function _vtpStopLoadingAnim() {
  if (_vtpLoadingTimer) { clearInterval(_vtpLoadingTimer); _vtpLoadingTimer = null; }
  const barFill = document.getElementById('vtp-loading-bar-fill');
  if (barFill) barFill.style.width = '100%';
}

function _vtpShowLoadingError(msg) {
  _vtpStopLoadingAnim();
  const errEl = document.getElementById('vtp-loading-error');
  const msgEl = document.getElementById('vtp-loading-error-msg');
  const steps = document.getElementById('vtp-loading-steps');
  if (steps)  steps.style.display  = 'none';
  if (msgEl)  msgEl.textContent    = msg || 'Something went wrong — please try again.';
  if (errEl)  errEl.style.display  = 'block';
}

// ─────────────────────────────────────────────────────────────────────────────
// SPEC-BASED CANVAS RENDERER
// Five draw types: flow | equation | compare | scale | bullets
// ─────────────────────────────────────────────────────────────────────────────

function _vtpDrawSpec(spec) {
  if (!_vtpCtx || !spec) return;
  _vtpClearCanvas();
  const ctx = _vtpCtx, W = _vtpW, H = _vtpH;
  const cx = W / 2, cy = H / 2;
  const draw = (fn, delay) => setTimeout(fn, delay);
  const TEXT_PRI  = '#ededf0';
  const TEXT_SEC  = '#9898ae';
  const TEXT_MUT  = '#55556a';

  // ── Shared helpers ──────────────────────────────────────────────────────
  function roundRect(x, y, w, h, r, fillStyle, strokeStyle) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fillStyle)   { ctx.fillStyle   = fillStyle;   ctx.fill();   }
    if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  function label(text, x, y, size, color, align, weight) {
    ctx.font = `${weight||'normal'} ${size}px sans-serif`;
    ctx.fillStyle   = color;
    ctx.textAlign   = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }
  function note(text) {
    if (!text) return;
    ctx.font = '11px sans-serif'; ctx.fillStyle = TEXT_MUT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, H - 30);
  }

  // ── FLOW ────────────────────────────────────────────────────────────────
  if (spec.type === 'flow') {
    const items = (spec.items || []).slice(0, 5);
    const n = items.length;
    const BOX_W = Math.min(130, (W - 80) / n - 20);
    const BOX_H = 64;
    const GAP   = (W - 80 - n * BOX_W) / (n - 1 || 1);
    const startX = 40;
    const rowY  = cy - BOX_H / 2 - 10;

    items.forEach((item, i) => {
      const c = _vtpCol(item.color || 'amber');
      const bx = startX + i * (BOX_W + GAP);
      draw(() => {
        // Arrow before box (except first)
        if (i > 0) {
          const ax = bx - GAP + 4;
          ctx.strokeStyle = TEXT_MUT; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(ax, rowY + BOX_H / 2); ctx.lineTo(bx - 6, rowY + BOX_H / 2); ctx.stroke();
          // arrowhead
          ctx.fillStyle = TEXT_MUT; ctx.beginPath();
          ctx.moveTo(bx - 4, rowY + BOX_H / 2);
          ctx.lineTo(bx - 10, rowY + BOX_H / 2 - 5);
          ctx.lineTo(bx - 10, rowY + BOX_H / 2 + 5);
          ctx.fill();
        }
        roundRect(bx, rowY, BOX_W, BOX_H, 10, c.fill, c.stroke);
        label(item.label || '', bx + BOX_W / 2, rowY + 22, 13, c.text, 'center', '600');
        if (item.sub) label(item.sub, bx + BOX_W / 2, rowY + 42, 11, TEXT_SEC);
      }, 80 + i * 130);
    });
    draw(() => note(spec.note), 80 + n * 130 + 200);
    return;
  }

  // ── EQUATION ────────────────────────────────────────────────────────────
  if (spec.type === 'equation') {
    const parts  = (spec.parts || []).slice(0, 4);
    const formula = spec.formula || '';
    const BOX_W  = 120, BOX_H = 70;
    const n      = parts.length;
    const gap    = Math.min(30, (W - 80 - n * BOX_W) / (n - 1 || 1));
    const startX = (W - (n * BOX_W + (n - 1) * gap)) / 2;

    // Formula at top
    draw(() => {
      ctx.font = 'bold 28px sans-serif'; ctx.fillStyle = TEXT_PRI;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(formula, cx, cy - 70);
    }, 80);

    // Divider
    draw(() => {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(80, cy - 40); ctx.lineTo(W - 80, cy - 40); ctx.stroke();
    }, 200);

    parts.forEach((p, i) => {
      const c  = _vtpCol(p.color || 'amber');
      const bx = startX + i * (BOX_W + gap);
      const by = cy - 20;
      draw(() => {
        roundRect(bx, by, BOX_W, BOX_H, 10, c.fill, c.stroke);
        label(p.symbol || '', bx + BOX_W / 2, by + 18, 18, c.text, 'center', 'bold');
        label(p.name   || '', bx + BOX_W / 2, by + 40, 11, TEXT_PRI);
        if (p.unit) label(p.unit, bx + BOX_W / 2, by + 56, 10, TEXT_SEC);
      }, 300 + i * 140);
    });

    draw(() => {
      if (spec.note) label(spec.note, cx, cy + 80, 12, TEXT_SEC, 'center');
    }, 300 + parts.length * 140 + 100);
    return;
  }

  // ── COMPARE ─────────────────────────────────────────────────────────────
  if (spec.type === 'compare') {
    const lPts = (spec.leftPoints  || []).slice(0, 4);
    const rPts = (spec.rightPoints || []).slice(0, 4);
    const lCol = _vtpCol(spec.leftColor  || 'red');
    const rCol = _vtpCol(spec.rightColor || 'teal');
    const COL_W = W * 0.38, COL_X_L = W * 0.06, COL_X_R = W * 0.56;
    const TOP_Y = cy - 110;

    draw(() => {
      // Left column
      roundRect(COL_X_L, TOP_Y, COL_W, 220, 12, lCol.fill, lCol.stroke);
      label(spec.leftLabel || 'Left', COL_X_L + COL_W / 2, TOP_Y + 22, 14, lCol.text, 'center', '600');
      lPts.forEach((pt, i) => {
        ctx.font = '12px sans-serif'; ctx.fillStyle = TEXT_PRI;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const maxW = COL_W - 28;
        // word-wrap simple
        ctx.fillText('• ' + pt.slice(0, 38), COL_X_L + 14, TOP_Y + 52 + i * 36, maxW);
      });
    }, 80);

    // VS badge
    draw(() => {
      roundRect(cx - 18, cy - 12, 36, 24, 12, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.15)');
      label('VS', cx, cy, 12, TEXT_SEC, 'center', '600');
    }, 180);

    draw(() => {
      // Right column
      roundRect(COL_X_R, TOP_Y, COL_W, 220, 12, rCol.fill, rCol.stroke);
      label(spec.rightLabel || 'Right', COL_X_R + COL_W / 2, TOP_Y + 22, 14, rCol.text, 'center', '600');
      rPts.forEach((pt, i) => {
        ctx.font = '12px sans-serif'; ctx.fillStyle = TEXT_PRI;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('• ' + pt.slice(0, 38), COL_X_R + 14, TOP_Y + 52 + i * 36, COL_W - 28);
      });
    }, 280);

    draw(() => note(spec.note), 480);
    return;
  }

  // ── SCALE ───────────────────────────────────────────────────────────────
  if (spec.type === 'scale') {
    const markers  = (spec.markers || []).slice(0, 6);
    const lCol = _vtpCol(spec.lowColor  || 'red');
    const rCol = _vtpCol(spec.highColor || 'teal');
    const BAR_X = 60, BAR_Y = cy - 16, BAR_W = W - 120, BAR_H = 28;

    draw(() => {
      // Gradient bar via steps
      const steps = 20;
      for (let i = 0; i < steps; i++) {
        const t  = i / steps;
        // blend two colors by drawing overlapping rects
        const r1 = parseInt(lCol.stroke.slice(1,3)||'f8',16);
        const g1 = parseInt(lCol.stroke.slice(3,5)||'71',16);
        const b1 = parseInt(lCol.stroke.slice(5,7)||'71',16);
        const r2 = parseInt(rCol.stroke.slice(1,3)||'2d',16);
        const g2 = parseInt(rCol.stroke.slice(3,5)||'d4',16);
        const b2 = parseInt(rCol.stroke.slice(5,7)||'bf',16);
        const r  = Math.round(r1 + (r2-r1)*t);
        const g  = Math.round(g1 + (g2-g1)*t);
        const b  = Math.round(b1 + (b2-b1)*t);
        ctx.fillStyle = `rgba(${r},${g},${b},0.22)`;
        ctx.fillRect(BAR_X + i*(BAR_W/steps), BAR_Y, BAR_W/steps + 1, BAR_H);
      }
      // Bar border
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      ctx.strokeRect(BAR_X, BAR_Y, BAR_W, BAR_H);
      // End labels
      label(spec.lowLabel  || 'Low',  BAR_X + 4,          BAR_Y - 16, 11, lCol.text, 'left');
      label(spec.highLabel || 'High', BAR_X + BAR_W - 4,  BAR_Y - 16, 11, rCol.text, 'right');
    }, 80);

    markers.forEach((m, i) => {
      const x = BAR_X + (m.value || 0) * BAR_W;
      const above = i % 2 === 0;
      draw(() => {
        // Tick
        ctx.strokeStyle = TEXT_PRI; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, BAR_Y); ctx.lineTo(x, BAR_Y + BAR_H); ctx.stroke();
        // Marker dot
        ctx.fillStyle = TEXT_PRI; ctx.beginPath(); ctx.arc(x, above ? BAR_Y - 18 : BAR_Y + BAR_H + 18, 3, 0, Math.PI*2); ctx.fill();
        // Label
        label(m.label || '', x, above ? BAR_Y - 34 : BAR_Y + BAR_H + 34, 12, TEXT_PRI, 'center', '600');
        if (m.sub) label(m.sub, x, above ? BAR_Y - 18 : BAR_Y + BAR_H + 18, 10, TEXT_SEC);
      }, 200 + i * 120);
    });

    draw(() => note(spec.note), 200 + markers.length * 120 + 150);
    return;
  }

  // ── BULLETS ─────────────────────────────────────────────────────────────
  if (spec.type === 'bullets') {
    const items = (spec.items || []).slice(0, 5);
    const c = _vtpCol(spec.color || 'teal');
    const ITEM_H = 52, PAD = 18;
    const BOX_W = Math.min(W - 120, 520);
    const totalH = items.length * ITEM_H + (items.length - 1) * 8;
    const startY = cy - totalH / 2 - 10;
    const startX = (W - BOX_W) / 2;

    if (spec.title) {
      draw(() => label(spec.title, cx, startY - 28, 14, TEXT_PRI, 'center', '600'), 60);
    }

    items.forEach((item, i) => {
      const by = startY + i * (ITEM_H + 8);
      draw(() => {
        roundRect(startX, by, BOX_W, ITEM_H, 10, c.fill, c.stroke + '50');
        // Icon/bullet
        label(item.icon || '→', startX + PAD + 6, by + ITEM_H / 2, 14, c.text, 'center', 'bold');
        // Text — with simple overflow clip
        ctx.font = '13px sans-serif'; ctx.fillStyle = TEXT_PRI;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const text = (item.text || '').slice(0, 70);
        ctx.fillText(text, startX + PAD + 22, by + ITEM_H / 2, BOX_W - PAD * 2 - 22);
      }, 80 + i * 110);
    });

    draw(() => note(spec.note), 80 + items.length * 110 + 100);
    return;
  }

  // ── GENERIC FALLBACK (shouldn't normally reach here) ───────────────────
  draw(() => {
    roundRect(cx - 140, cy - 52, 280, 104, 16, 'rgba(232,172,46,0.07)', 'rgba(232,172,46,0.18)');
    label(_vtpCurrentTopic, cx, cy - 10, 18, TEXT_PRI, 'center', 'bold');
    label(`Step ${_vtpStepIdx + 1} of ${_vtpTotalSteps}`, cx, cy + 16, 12, TEXT_SEC);
  }, 160);
}


// ─────────────────────────────────────────────────────────────────────────────
// LESSON LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

async function _vtpStartLesson() {
  const startBtn = document.getElementById('vtp-entry-start');
  if (startBtn) { startBtn.textContent = 'Generating…'; startBtn.classList.add('loading'); }
  if (!guestGate('visual')) {
    if (startBtn) { startBtn.textContent = 'Visualize →'; startBtn.classList.remove('loading'); }
    return;
  }
  const inp = document.getElementById('vtp-entry-input');
  const t   = (inp ? inp.value.trim() : '').replace(/^(explain|what is|what are|how does|how do|tell me about)\s+/i, '').trim() || 'Photosynthesis';
  _vtpCurrentTopic  = t;
  _vtpStepIdx       = 0;
  _vtpSimplifyCount = 0;
  _vtpAskCount      = 0;
  _vtpQuizPassed    = false;
  _vtpQuizAnswered  = false;
  _vtpCtxReplyStep  = 0;
  _vtpWeakSteps     = [];
  _vtpAskHistory    = [];

  // Always wipe any stale lesson DOM before starting fresh
  _vtpResetLessonDOM();
  recordUsage('visual'); // track guest usage

  // Show loading screen
  const topicEl = document.getElementById('vtp-loading-topic');
  if (topicEl) topicEl.textContent = t;
  _vtpShowScreen('screen-loading');
  _vtpStartLoadingAnim();

  try {
    _vtpLesson = await _vtpFetchLesson(t);
  } catch (err) {
    if (err.name === 'AbortError') return; // user cancelled
    _vtpShowLoadingError(err.message || 'Could not generate lesson — please try again.');
    return;
  }

  _vtpStopLoadingAnim();
  _vtpTotalSteps = _vtpLesson.steps.length;

  // Update entry screen hook for next open
  const hookEl = document.querySelector('#screen-visual .entry-hook');
  if (hookEl) {
    const tn = hookEl.childNodes[hookEl.childNodes.length - 1];
    if (tn) tn.textContent = ' ' + (_vtpLesson.hook || "You'll understand this in 5 steps");
  }

  const topicLabel   = document.getElementById('lh-topic-label');
  const completeTopic = document.getElementById('complete-topic');
  if (topicLabel)    topicLabel.textContent   = _vtpCurrentTopic;
  if (completeTopic) completeTopic.textContent = _vtpCurrentTopic;

  const summaryEl = document.getElementById('summary-items');
  if (summaryEl) {
    summaryEl.innerHTML = (_vtpLesson.summary || [])
      .map(s => `<div class="summary-item"><div class="summary-dot"></div>${s}</div>`)
      .join('');
  }

  _vtpShowScreen('screen-lesson');

  // ── Save to sidebar recent history ──────────────────────────────────────
  if (typeof window.recentAdd === 'function') {
    window.recentAdd(_vtpCurrentTopic, '', 'visual');
  }

  // ── Persist lesson data so clicking history can restore it ───────────────
  // Save lesson JSON keyed by the recent item id (set by recentAdd above)
  _vtpSaveSession();

  setTimeout(() => { _vtpInitCanvas(); _vtpBuildDots(); _vtpRenderStep(0); }, 220);
}

let _vtpCurrentTopic = '';
let _vtpLesson       = null;
let _vtpStepIdx      = 0;
let _vtpTotalSteps   = 5;
let _vtpCanvas, _vtpCtx, _vtpW, _vtpH;
let _vtpTypeTimer    = null;
let _vtpStepBusy     = false;
let _vtpQuizAnswered = false;
let _vtpAutoplay     = false;
let _vtpAutoTimer    = null;
let _vtpSimplifyCount = 0;
let _vtpAskCount     = 0;
let _vtpQuizPassed   = false;
let _vtpCtxReplyStep = 0;
let _vtpWeakSteps    = [];
let _vtpResizeTimer  = null;
let _vtpAskHistory   = []; // [{q: string, a: string}] — in-lesson Q&A thread
let _vtpChallengeRevealed = false; // true once the model answer is shown

// ─────────────────────────────────────────────────────────────────────────────
// SOUND ENGINE  (Web Audio API — no file assets needed)
// ─────────────────────────────────────────────────────────────────────────────

let _vtpAudioCtx = null;
function _vtpGetAudio() {
  if (!_vtpAudioCtx) _vtpAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _vtpAudioCtx;
}
function _vtpSound(type) {
  try {
    const ac = _vtpGetAudio();
    const o  = ac.createOscillator();
    const g  = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    const t = ac.currentTime;
    if (type === 'tick') {
      o.type = 'sine'; o.frequency.setValueAtTime(660, t);
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.start(t); o.stop(t + 0.08);
    } else if (type === 'correct') {
      o.type = 'triangle';
      o.frequency.setValueAtTime(523, t);
      o.frequency.setValueAtTime(659, t + 0.1);
      o.frequency.setValueAtTime(784, t + 0.2);
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.start(t); o.stop(t + 0.45);
    } else if (type === 'wrong') {
      o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(180, t + 0.25);
      g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.start(t); o.stop(t + 0.28);
    } else if (type === 'gotit') {
      o.type = 'sine'; o.frequency.setValueAtTime(440, t);
      o.frequency.setValueAtTime(528, t + 0.1);
      g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.start(t); o.stop(t + 0.2);
    }
  } catch(e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN TRANSITIONS  (scoped to .vtp-screen only)
// ─────────────────────────────────────────────────────────────────────────────

function _vtpShowScreen(id) {
  document.querySelectorAll('.vtp-screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  if (id === 'screen-entry') {
    const startBtn = document.getElementById('vtp-entry-start');
    if (startBtn) { startBtn.textContent = 'Visualize →'; startBtn.classList.remove('loading'); }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LESSON LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

function _vtpExitLesson() {
  if (_vtpTypeTimer) clearTimeout(_vtpTypeTimer);
  if (_vtpAutoTimer) clearTimeout(_vtpAutoTimer);
  _vtpClearCanvas();

  const sw = document.getElementById('simplified-wrap');
  if (sw) sw.style.display = 'none';
  const gr = document.getElementById('gotit-row');
  if (gr) gr.style.display = 'none';

  const inp = document.getElementById('vtp-entry-input');
  if (inp) inp.value = '';

  _vtpShowScreen('screen-entry');
}

function _vtpDoAgain() {
  const inp = document.getElementById('vtp-entry-input');
  if (inp) inp.value = _vtpCurrentTopic;
  _vtpStartLesson();
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS
// ─────────────────────────────────────────────────────────────────────────────

function _vtpInitCanvas() {
  _vtpCanvas = document.getElementById('wb-canvas');
  const area = document.getElementById('wb-area');
  if (!_vtpCanvas || !area) return;
  _vtpW = area.offsetWidth;
  _vtpH = area.offsetHeight;
  _vtpCanvas.width  = _vtpW;
  _vtpCanvas.height = _vtpH;
  _vtpCtx = _vtpCanvas.getContext('2d');
  _vtpDrawDotGrid();
}

function _vtpDrawDotGrid() {
  if (!_vtpCtx) return;
  _vtpCtx.clearRect(0, 0, _vtpW, _vtpH);
  _vtpCtx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let x = 44; x < _vtpW; x += 44)
    for (let y = 44; y < _vtpH; y += 44) {
      _vtpCtx.beginPath();
      _vtpCtx.arc(x, y, 1.3, 0, Math.PI * 2);
      _vtpCtx.fill();
    }
}

function _vtpClearCanvas() {
  if (!_vtpCtx) return;
  _vtpCtx.clearRect(0, 0, _vtpW, _vtpH);
  _vtpDrawDotGrid();
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

function _vtpBuildDots() {
  const c = document.getElementById('step-dots');
  if (!c) return;
  c.innerHTML = '';
  for (let i = 0; i < _vtpTotalSteps; i++) {
    const d = document.createElement('div');
    d.className = 'sdot' + (i === 0 ? ' active' : '');
    d.id = 'sd-' + i;
    c.appendChild(d);
  }
}

function _vtpUpdateDots(idx) {
  for (let i = 0; i < _vtpTotalSteps; i++) {
    const d = document.getElementById('sd-' + i);
    if (!d) continue;
    d.className = 'sdot' + (i < idx ? ' done' : i === idx ? ' active' : '');
  }
}

function _vtpUpdateProgress(idx) {
  const pct = idx === 0 ? 0 : (idx / (_vtpTotalSteps - 1)) * 100;
  const fill = document.getElementById('prog-fill');
  if (fill) fill.style.width = pct + '%';
}

function _vtpRenderStep(idx) {
  _vtpStepBusy = true;
  _vtpClearAskReply();

  const sw = document.getElementById('simplified-wrap');
  const gr = document.getElementById('gotit-row');
  if (sw) sw.style.display = 'none';
  if (gr) gr.style.display = 'none';

  const step = _vtpLesson.steps[idx];

  const cur = document.getElementById('step-cur');
  const tot = document.getElementById('step-tot');
  if (cur) cur.textContent = idx + 1;
  if (tot) tot.textContent = _vtpTotalSteps;

  // Split "Step N — Purpose text" label
  const rawLabel  = step.label || '';
  const dashIdx   = rawLabel.indexOf('—');
  const stepTag   = dashIdx > -1 ? rawLabel.slice(0, dashIdx).trim() : rawLabel;
  const purposeTxt = dashIdx > -1 ? rawLabel.slice(dashIdx + 1).trim() : '';

  const purposeEl = document.getElementById('exp-purpose');
  const lblEl     = document.getElementById('exp-label');
  if (purposeEl) { purposeEl.classList.remove('vis'); }
  if (lblEl)     { lblEl.classList.remove('vis'); }

  if (purposeTxt) {
    if (purposeEl) purposeEl.textContent = stepTag + ' of ' + _vtpTotalSteps;
    if (lblEl)     lblEl.textContent     = purposeTxt;
  } else {
    if (purposeEl) purposeEl.textContent = '';
    if (lblEl)     lblEl.textContent     = rawLabel;
  }
  setTimeout(() => {
    if (purposeEl) purposeEl.classList.add('vis');
    if (lblEl)     lblEl.classList.add('vis');
  }, 100);

  // Disable ask input while typing
  const askEl = document.getElementById('ask-input');
  const simpBtn = document.getElementById('btn-simplify');
  if (askEl)   { askEl.disabled = true; askEl.placeholder = 'AI is explaining…'; }
  if (simpBtn) simpBtn.disabled = true;

  _vtpUpdateDots(idx);
  _vtpUpdateProgress(idx);
  _vtpSound('tick');
  _vtpFadeAndDraw(step.draw || { type: 'bullets', items: [{ icon: '→', text: step.label || _vtpCurrentTopic }], color: 'amber' });

  _vtpTypeText(step.text, () => {
    _vtpStepBusy = false;
    if (simpBtn) simpBtn.disabled = false;
    if (askEl)   { askEl.disabled = false; askEl.placeholder = 'Ask anything…'; }
    _vtpShowStepChallenge(step);
  });
}

function _vtpShowGotItRow() {
  const row = document.getElementById('gotit-row');
  if (row) row.style.display = 'flex';

  const skipBtn = document.getElementById('btn-skip');
  if (skipBtn) {
    skipBtn.style.display = (_vtpLesson.quiz && !_vtpQuizAnswered) ? 'inline-block' : 'none';
  }

  if (_vtpAutoplay) {
    if (_vtpAutoTimer) clearTimeout(_vtpAutoTimer);
    _vtpAutoTimer = setTimeout(() => _vtpGotIt(true), 5000);
  }
}

function _vtpGotIt(understood) {
  if (_vtpAutoTimer) clearTimeout(_vtpAutoTimer);
  const row = document.getElementById('gotit-row');
  if (row) row.style.display = 'none';

  if (understood) {
    _vtpSpawnConfetti();
    _vtpShowXpToast();
    _vtpSound('gotit');
    _vtpProceedFromStep();
  } else {
    if (!_vtpWeakSteps.includes(_vtpStepIdx)) _vtpWeakSteps.push(_vtpStepIdx);
    _vtpSimplify();
    setTimeout(() => {
      const r = document.getElementById('gotit-row');
      if (r) r.style.display = 'flex';
    }, 400);
  }
}

function _vtpReviewWeak() {
  if (!_vtpWeakSteps.length) { _vtpDoAgain(); return; }
  _vtpStepIdx   = _vtpWeakSteps[0];
  _vtpWeakSteps = [];
  _vtpShowScreen('screen-lesson');
  setTimeout(() => { _vtpInitCanvas(); _vtpBuildDots(); _vtpRenderStep(_vtpStepIdx); }, 220);
}

function _vtpShowXpToast() {
  const toast = document.getElementById('xp-toast');
  if (!toast) return;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function _vtpSkipToQuiz() {
  if (_vtpAutoTimer) clearTimeout(_vtpAutoTimer);
  const row = document.getElementById('gotit-row');
  if (row) row.style.display = 'none';
  if (_vtpLesson.quiz && !_vtpQuizAnswered) {
    _vtpOpenQuiz();
  } else {
    _vtpFinishLesson();
  }
}

function _vtpProceedFromStep() {
  const q = _vtpLesson.quiz;
  if (q && q.onStep === _vtpStepIdx + 1 && !_vtpQuizAnswered) {
    _vtpOpenQuiz();
    return;
  }
  if (_vtpStepIdx >= _vtpTotalSteps - 1) {
    _vtpFinishLesson();
    return;
  }
  _vtpStepIdx++;
  _vtpRenderStep(_vtpStepIdx);
}

// ─────────────────────────────────────────────────────────────────────────────
// QUIZ
// ─────────────────────────────────────────────────────────────────────────────

function _vtpOpenQuiz() {
  const q = _vtpLesson.quiz;
  if (!q) { _vtpAdvanceAfterQuiz(); return; }

  const pill = document.getElementById('quiz-announce-pill');
  if (pill) {
    pill.classList.add('show');
    setTimeout(() => {
      pill.classList.remove('show');
      setTimeout(() => _vtpShowQuizOverlay(q), 200);
    }, 900);
  } else {
    _vtpShowQuizOverlay(q);
  }
}

function _vtpShowQuizOverlay(q) {
  const stepNum = document.getElementById('quiz-step-num');
  const questEl = document.getElementById('quiz-question');
  const fbEl    = document.getElementById('quiz-feedback');
  const contBtn = document.getElementById('quiz-continue');
  if (stepNum) stepNum.textContent = q.onStep;
  if (questEl) questEl.textContent = q.q;
  if (fbEl)    fbEl.style.display  = 'none';
  if (contBtn) contBtn.style.display = 'none';

  const opts = document.getElementById('quiz-options');
  if (!opts) return;
  opts.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];
  q.options.forEach((opt, i) => {
    const el = document.createElement('div');
    el.className = 'qopt';
    el.innerHTML = `<div class="qopt-letter">${letters[i]}</div><span>${opt.text}</span>`;
    el.addEventListener('click', () => _vtpAnswerQuiz(i, opt.correct));
    opts.appendChild(el);
  });

  const overlay = document.getElementById('quiz-overlay');
  if (overlay) overlay.classList.add('open');
}

function _vtpAnswerQuiz(idx, correct) {
  if (_vtpQuizAnswered) return;
  _vtpQuizAnswered = true;
  _vtpQuizPassed   = correct;

  const opts = document.querySelectorAll('#screen-visual .qopt');
  const q    = _vtpLesson.quiz;

  opts.forEach((el, i) => {
    el.style.cursor = 'default';
    el.onclick = null;
    if (i === idx) el.classList.add(correct ? 'correct' : 'wrong');
    if (!correct && q.options[i].correct) el.classList.add('reveal');
  });

  const xpPop = document.getElementById('quiz-xp-pop');
  if (correct && xpPop) {
    xpPop.classList.add('show');
    _vtpSound('correct');
    _vtpSpawnConfetti();
  } else {
    _vtpSound('wrong');
  }

  const fb    = document.getElementById('quiz-feedback');
  const cont  = document.getElementById('quiz-continue');
  if (fb) {
    fb.textContent  = correct ? q.feedbackRight : q.feedbackWrong;
    fb.className    = 'quiz-feedback ' + (correct ? 'correct' : 'wrong');
    fb.style.display = 'block';
  }
  if (cont) cont.style.display = 'block';
}

function _vtpCloseQuiz() {
  const overlay = document.getElementById('quiz-overlay');
  if (overlay) overlay.classList.remove('open');
  _vtpAdvanceAfterQuiz();
}

function _vtpAdvanceAfterQuiz() {
  if (_vtpStepIdx >= _vtpTotalSteps - 1) {
    _vtpFinishLesson();
    return;
  }
  _vtpStepIdx++;
  _vtpRenderStep(_vtpStepIdx);
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLIFY
// ─────────────────────────────────────────────────────────────────────────────

function _vtpSimplify() {
  _vtpSimplifyCount++;
  const step = _vtpLesson.steps[_vtpStepIdx];
  const text = step.simple || 'Think of it this way: ' + step.text.replace(/<[^>]+>/g, '').slice(0, 80) + '…';
  const wrap = document.getElementById('simplified-wrap');
  const txt  = document.getElementById('simplified-text');
  if (txt)  txt.innerHTML  = text;
  if (wrap) wrap.style.display = 'block';
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP CHALLENGE — retrieval-practice question after each step
// Shows the step's challenge question, accepts a typed answer, then reveals
// the model answer from contextualReplies[0] before showing the Got-it row.
// Skipped entirely when autoplay is on.
// ─────────────────────────────────────────────────────────────────────────────

function _vtpShowStepChallenge(step) {
  const panel    = document.getElementById('step-challenge');
  const qEl      = document.getElementById('challenge-q');
  const inputRow = document.getElementById('challenge-input-row');
  const revealEl = document.getElementById('challenge-reveal');
  const inputEl  = document.getElementById('challenge-input');

  // Skip challenge when autoplay is on or no challenge question provided
  const question = step && step.challenge;
  if (!panel || !question || _vtpAutoplay) {
    _vtpShowGotItRow();
    return;
  }

  _vtpChallengeRevealed = false;
  if (qEl)      qEl.textContent         = question;
  if (inputRow) inputRow.style.display  = 'flex';
  if (revealEl) revealEl.style.display  = 'none';
  if (inputEl)  { inputEl.value = ''; inputEl.disabled = false; }
  if (panel)    panel.classList.add('active');
}

function _vtpSubmitChallenge() {
  if (_vtpChallengeRevealed) return;
  _vtpChallengeRevealed = true;

  const step     = _vtpLesson.steps[_vtpStepIdx];
  // Use contextualReplies[0] first; fall back to the pre-built plain-text "simple" field
  // (avoids any HTML-stripping regex on step.text).
  const modelAns = (step.contextualReplies && step.contextualReplies[0]) ||
    step.simple ||
    step.label.split('—')[1]?.trim() ||
    `Focus on the diagram — that illustrates the key idea for this step.`;

  const inputRow  = document.getElementById('challenge-input-row');
  const revealEl  = document.getElementById('challenge-reveal');
  const modelEl   = document.getElementById('challenge-model-answer');
  const skipBtn   = document.getElementById('challenge-skip');
  const inputEl   = document.getElementById('challenge-input');

  if (inputEl)  inputEl.disabled = true;
  if (inputRow) inputRow.style.display  = 'none';
  if (modelEl)  modelEl.textContent     = modelAns;
  if (revealEl) revealEl.style.display  = 'block';
  if (skipBtn)  skipBtn.style.display   = 'none';
}

function _vtpContinueChallenge() {
  const panel = document.getElementById('step-challenge');
  if (panel) panel.classList.remove('active');
  _vtpShowGotItRow();
}

function _vtpSkipChallenge() {
  const panel = document.getElementById('step-challenge');
  if (panel) panel.classList.remove('active');
  _vtpShowGotItRow();
}

// ─────────────────────────────────────────────────────────────────────────────
// TEACH IT BACK — active-recall evaluation after lesson completion
// The student writes a free-form explanation of the topic and the AI scores it.
// ─────────────────────────────────────────────────────────────────────────────

// Index 0–4 maps directly to score values 0–4 returned by the AI evaluator.
const TTB_SCORE_LABELS = ['Needs work', 'Getting there', 'Good', 'Excellent', 'Perfect'];

async function _vtpTeachItBack() {
  const textarea  = document.getElementById('ttb-textarea');
  const submitBtn = document.getElementById('ttb-submit-btn');
  const resultEl  = document.getElementById('ttb-result');
  const badgeEl   = document.getElementById('ttb-score-badge');
  const feedbackEl = document.getElementById('ttb-feedback-text');
  if (!textarea) return;

  const explanation = textarea.value.trim();
  if (!explanation) { textarea.focus(); return; }

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Checking…'; }

  const summary = (_vtpLesson && _vtpLesson.summary) ? _vtpLesson.summary.join('; ') : _vtpCurrentTopic;

  const evalPrompt =
    `You are evaluating a student's self-explanation of "${_vtpCurrentTopic}" after a visual lesson.\n` +
    `Key concepts from the lesson: ${summary}\n\n` +
    `Student wrote:\n"${explanation}"\n\n` +
    `Score their explanation (0–4 concepts covered) and give 1-sentence feedback.\n` +
    `Return ONLY valid JSON (no markdown): {"score":3,"max":4,"label":"Good","feedback":"You explained X well; also mention Y next time."}`;

  // Local fallback score — used if API call fails.
  // Formula: ~30 words expected for a reasonable answer → scale to max 3 (capped at 4).
  const words = explanation.split(/\s+/).length;
  const localScore = Math.min(4, Math.max(0, Math.round((words / 30) * 3)));
  const localLabel = TTB_SCORE_LABELS[localScore] || 'Good';
  const localFeedback = `You covered the main idea. Review the key takeaways to deepen your understanding.`;

  try {
    const authHeader = await _getAuthHeader?.() ?? {};
    const res = await fetch(`${API_BASE}/ask`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        question:   evalPrompt,
        mode:       'visual_tutor',
        bookId:     'none',
        complexity: 3,
        history:    [],
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data  = await res.json();
    const raw   = (data.answer ?? data.response ?? data.text ?? '').trim();
    const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'').trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch (_) {
      const m = clean.match(/\{[\s\S]*?\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    }

    const score    = (parsed && typeof parsed.score === 'number')
      ? Math.min(4, Math.max(0, Math.round(parsed.score)))  // clamp to 0–4
      : localScore;
    const max      = (parsed && typeof parsed.max === 'number' && parsed.max > 0) ? parsed.max : 4;
    const label    = (parsed && parsed.label)    ? parsed.label    : localLabel;
    const feedback = (parsed && parsed.feedback) ? parsed.feedback : localFeedback;

    _vtpRenderTTBResult(score, max, label, feedback);

  } catch (_err) {
    _vtpRenderTTBResult(localScore, 4, localLabel, localFeedback);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Try again ↺'; }
  }

  function _vtpRenderTTBResult(score, max, label, feedback) {
    const safePct = max > 0 ? Math.round((score / max) * 100) : 0;
    const color = safePct >= 75 ? 'var(--teal)' : safePct >= 50 ? 'var(--gold)' : 'var(--red)';
    if (badgeEl) {
      badgeEl.innerHTML =
        `<span style="color:${color};font-weight:700;font-size:22px;">${score}/${max}</span>` +
        `<span style="color:var(--t3);font-size:12px;margin-left:6px;">${label}</span>`;
    }
    if (feedbackEl) feedbackEl.textContent = feedback;
    if (resultEl)   resultEl.classList.add('visible');
    if (textarea)   textarea.disabled = true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATED TOPICS — "What to learn next" chips on the complete screen
// ─────────────────────────────────────────────────────────────────────────────

function _vtpRenderRelatedTopics(topics) {
  const wrap  = document.getElementById('related-next');
  const chips = document.getElementById('related-next-chips');
  if (!chips || !topics || !topics.length) return;

  // Build chips via DOM to avoid any XSS from AI-generated topic names
  chips.innerHTML = '';
  topics.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'related-chip';
    btn.textContent = t;
    btn.addEventListener('click', () => {
      const inp = document.getElementById('vtp-entry-input');
      if (inp) inp.value = t;
      _vtpShowScreen('screen-entry');
      // Brief delay lets the screen transition start before kicking off the lesson fetch
      setTimeout(() => _vtpStartLesson(), 80);
    });
    chips.appendChild(btn);
  });

  if (wrap) wrap.style.display = 'block';
}

// ─────────────────────────────────────────────────────────────────────────────
//   • Includes all steps the student has already seen
//   • Carries the full in-lesson Q&A thread so AI can say "as I mentioned…"
//   • Falls back to built-in contextualReplies if offline / server error
// ─────────────────────────────────────────────────────────────────────────────

async function _vtpSendAsk() {
  const input = document.getElementById('ask-input');
  if (!input) return;
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  _vtpAskCount++;

  // ── Local fallback (used if API call fails) ───────────────────────────────
  const step         = _vtpLesson.steps[_vtpStepIdx];
  const localReplies = step.contextualReplies || [];
  const localFallback = localReplies[_vtpCtxReplyStep % localReplies.length] ||
    `That relates to ${step.label.split('—')[1]?.trim() || _vtpCurrentTopic}. Focus on the key relationship shown in the diagram — that's where the answer lives.`;
  _vtpCtxReplyStep++;

  // ── Show loading state ─────────────────────────────────────────────────────
  const askEl   = document.getElementById('ask-input');
  const simpBtn = document.getElementById('btn-simplify');
  if (askEl)   { askEl.disabled = true; askEl.placeholder = 'Thinking…'; }
  if (simpBtn)  simpBtn.disabled = true;
  _vtpShowAskReply('<span class="ask-thinking">●●●</span>');

  // ── Build steps-seen summary (all steps up to and including current) ───────
  const stepsSeen = _vtpLesson.steps
    .slice(0, _vtpStepIdx + 1)
    .map((s, i) => `Step ${i + 1} (${s.label.split('—')[1]?.trim() || ''}): ${s.text.replace(/<[^>]+>/g, '').slice(0, 120)}`)
    .join('\n');

  // ── System prompt ──────────────────────────────────────────────────────────
  const systemMsg =
    `You are a friendly, direct tutor for Chunks AI helping a student understand "${_vtpCurrentTopic}". ` +
    `The student is working through a 5-step visual lesson. ` +
    `Answer in 2–3 sentences max. Be specific — use the exact concepts from the lesson. ` +
    `Never say "Great question!" or add filler preamble. Just answer directly. ` +
    `If referencing something from an earlier step, say "as we covered in step N…" ` +
    `\n\nSteps the student has seen so far:\n${stepsSeen}`;

  // ── Build history array for /ask endpoint ─────────────────────────────────
  // Format: [{role:'user',content:'...'},{role:'assistant',content:'...'}]
  // Keep last 4 exchanges max to stay within token budget
  const historyForApi = _vtpAskHistory.slice(-4).flatMap(({ q: hq, a: ha }) => [
    { role: 'user',      content: hq },
    { role: 'assistant', content: ha },
  ]);

  try {
    const authHeader = await _getAuthHeader?.() ?? {};
    const res = await fetch(`${API_BASE}/ask`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        question:      q,
        mode:          'visual_tutor',
        bookId:        'none',
        complexity:    4,
        history:       historyForApi,
        // system context is passed as the first user message so the backend
        // visual_tutor mode picks it up without any server changes needed
        _vtpSystemCtx: systemMsg,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data   = await res.json();
    const answer = (data.answer ?? data.response ?? data.text ?? '').trim();
    const reply  = answer || localFallback;

    // ── Append to in-lesson conversation thread ────────────────────────────
    _vtpAskHistory.push({ q, a: reply });

    _vtpShowAskReply(reply);

  } catch (err) {
    console.warn('[VTP] Ask error, using local fallback:', err.message);
    _vtpAskHistory.push({ q, a: localFallback });
    _vtpShowAskReply(localFallback);

  } finally {
    if (askEl)   { askEl.disabled = false; askEl.placeholder = 'Ask anything…'; }
    if (simpBtn)  simpBtn.disabled = false;
  }
}

function _vtpShowAskReply(html) {
  const el  = document.getElementById('ask-reply');
  const txt = document.getElementById('ask-reply-text');
  if (txt) txt.innerHTML = html;
  if (el)  el.classList.add('open');
}

function _vtpCloseAskReply() {
  const el = document.getElementById('ask-reply');
  if (el) el.classList.remove('open');
}
function _vtpClearAskReply() { _vtpCloseAskReply(); }

// ─────────────────────────────────────────────────────────────────────────────
// AUTOPLAY
// ─────────────────────────────────────────────────────────────────────────────

function _vtpToggleAutoplay() {
  _vtpAutoplay = !_vtpAutoplay;
  const track = document.getElementById('autoplay-track');
  if (track) track.classList.toggle('on', _vtpAutoplay);

  if (_vtpAutoplay && !_vtpStepBusy) {
    const row = document.getElementById('gotit-row');
    if (row && row.style.display !== 'none') {
      if (_vtpAutoTimer) clearTimeout(_vtpAutoTimer);
      _vtpAutoTimer = setTimeout(() => _vtpGotIt(true), 3000);
    }
  } else {
    if (_vtpAutoTimer) clearTimeout(_vtpAutoTimer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPEWRITER
// ─────────────────────────────────────────────────────────────────────────────

function _vtpTypeText(html, onDone) {
  const el = document.getElementById('exp-text');
  if (!el) { if (onDone) onDone(); return; }
  el.innerHTML = '<span class="cursor"></span>';
  const plain = html.replace(/<[^>]+>/g, '');
  let i = 0;
  const spd = plain.length > 130 ? 13 : 17;
  if (_vtpTypeTimer) clearTimeout(_vtpTypeTimer);

  function tick() {
    i++;
    el.textContent = plain.slice(0, i);
    const c = document.createElement('span');
    c.className = 'cursor';
    el.appendChild(c);
    if (i < plain.length) {
      _vtpTypeTimer = setTimeout(tick, spd);
    } else {
      setTimeout(() => { el.innerHTML = html; if (onDone) onDone(); }, 60);
    }
  }
  tick();
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFETTI
// ─────────────────────────────────────────────────────────────────────────────

function _vtpSpawnConfetti() {
  const area   = document.getElementById('wb-area');
  if (!area) return;
  const colors = ['#e8ac2e', '#4ade80', '#2dd4bf', '#8b7cf8', '#f87171'];
  for (let i = 0; i < 14; i++) {
    const d = document.createElement('div');
    d.className = 'confetti-dot';
    const x = 20 + Math.random() * 60;
    const y = 20 + Math.random() * 60;
    d.style.cssText = `left:${x}%;top:${y}%;background:${colors[i % colors.length]};animation-delay:${i * 40}ms;animation-duration:${500 + Math.random() * 400}ms;`;
    area.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LESSON COMPLETE
// ─────────────────────────────────────────────────────────────────────────────

function _vtpFinishLesson() {
  const xp = _vtpTotalSteps * 10 + (_vtpQuizPassed ? 20 : 0);

  const scoreVal  = document.getElementById('score-val');
  const scoreQuiz = document.getElementById('score-quiz');
  const scoreSim  = document.getElementById('score-simplify');
  const scoreAsk  = document.getElementById('score-asks');
  const scoreXP   = document.getElementById('score-xp');
  if (scoreVal)  scoreVal.textContent  = _vtpTotalSteps + '/' + _vtpTotalSteps;
  if (scoreQuiz) scoreQuiz.textContent = _vtpLesson.quiz ? (_vtpQuizPassed ? 'Passed ✓' : 'Attempted') : 'N/A';
  if (scoreSim)  scoreSim.textContent  = _vtpSimplifyCount + '×';
  if (scoreAsk)  scoreAsk.textContent  = _vtpAskCount;
  if (scoreXP)   scoreXP.textContent   = '+' + xp + ' XP';

  const reviewBtn = document.getElementById('btn-review-weak');
  if (reviewBtn) {
    reviewBtn.className = _vtpWeakSteps.length > 0 ? 'btn-review-weak' : 'btn-review-weak hidden';
  }

  // ── Reset Teach-It-Back UI ────────────────────────────────────────────────
  const ttbTopicLabel = document.getElementById('ttb-topic-label');
  const ttbTextarea   = document.getElementById('ttb-textarea');
  const ttbSubmitBtn  = document.getElementById('ttb-submit-btn');
  const ttbResult     = document.getElementById('ttb-result');
  const ttbBadge      = document.getElementById('ttb-score-badge');
  const ttbFeedback   = document.getElementById('ttb-feedback-text');
  if (ttbTopicLabel) ttbTopicLabel.textContent = _vtpCurrentTopic;
  if (ttbTextarea)   { ttbTextarea.value = ''; ttbTextarea.disabled = false; }
  if (ttbSubmitBtn)  { ttbSubmitBtn.disabled = false; ttbSubmitBtn.textContent = 'Check my understanding →'; }
  if (ttbResult)     ttbResult.classList.remove('visible');
  if (ttbBadge)      ttbBadge.innerHTML = '';
  if (ttbFeedback)   ttbFeedback.textContent = '';

  // ── Render related topics ────────────────────────────────────────────────
  const relatedWrap = document.getElementById('related-next');
  if (relatedWrap) relatedWrap.style.display = 'none';
  if (_vtpLesson && _vtpLesson.relatedTopics) {
    _vtpRenderRelatedTopics(_vtpLesson.relatedTopics);
  }

  // ── Update sidebar recent item label to show completion ───────────────────
  // Find the matching recent item and append ✓ so students can see what
  // they've finished at a glance in the sidebar history.
  try {
    const raw = localStorage.getItem('chunks_recent');
    if (raw) {
      const items = JSON.parse(raw);
      const match = items.find(r => r.source === 'visual' && r.question === _vtpCurrentTopic);
      if (match && !match.label.endsWith(' ✓')) {
        match.label = (match.label.length > 28 ? match.label.slice(0, 28).trimEnd() + '…' : match.label) + ' ✓';
        localStorage.setItem('chunks_recent', JSON.stringify(items));
        window._renderAllRecent?.();
      }
    }
  } catch (_) {}

  _vtpShowScreen('screen-complete');
  setTimeout(() => {
    const arc = document.getElementById('score-arc');
    if (arc) arc.style.strokeDashoffset = '0';
  }, 250);
  _vtpSpawnConfetti();
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS DRAWING
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// CANVAS DRAWING  (spec-based — see _vtpDrawSpec above)
// ─────────────────────────────────────────────────────────────────────────────

function _vtpArrow(x1, y1, x2, y2, col, w) {
  _vtpCtx.strokeStyle = col; _vtpCtx.lineWidth = w; _vtpCtx.setLineDash([]);
  _vtpCtx.beginPath(); _vtpCtx.moveTo(x1, y1); _vtpCtx.lineTo(x2, y2); _vtpCtx.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  _vtpCtx.fillStyle = col; _vtpCtx.beginPath();
  _vtpCtx.moveTo(x2, y2);
  _vtpCtx.lineTo(x2 - 11 * Math.cos(a - 0.38), y2 - 11 * Math.sin(a - 0.38));
  _vtpCtx.lineTo(x2 - 11 * Math.cos(a + 0.38), y2 - 11 * Math.sin(a + 0.38));
  _vtpCtx.fill();
}

function _vtpFadeAndDraw(spec) {
  setTimeout(() => {
    _vtpClearCanvas();
    _vtpDrawSpec(spec);
  }, 100);
}

// APP INTEGRATION POINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called by navigation.js on every FRESH navigation to the visual screen
 * (i.e. user clicks the Visual Tutor nav item from another screen).
 * Must return the UI to the entry screen and stop anything running.
 */
// ── Full DOM reset for lesson UI — call before any lesson transition ─────────
// Closes quiz overlay, clears quiz content, hides announce pill, resets all
// lesson-panel state so a new lesson never inherits stale UI from a previous one.
function _vtpResetLessonDOM() {
  // Quiz overlay — close and wipe content
  const quizOverlay = document.getElementById('quiz-overlay');
  if (quizOverlay) quizOverlay.classList.remove('open');
  const quizFb   = document.getElementById('quiz-feedback');
  const quizCont = document.getElementById('quiz-continue');
  const quizXp   = document.getElementById('quiz-xp-pop');
  const quizOpts = document.getElementById('quiz-options');
  if (quizFb)   { quizFb.style.display = 'none'; quizFb.textContent = ''; quizFb.className = 'quiz-feedback'; }
  if (quizCont) quizCont.style.display = 'none';
  if (quizXp)   quizXp.classList.remove('show');
  if (quizOpts) quizOpts.innerHTML = '';

  // Quiz announce pill
  const pill = document.getElementById('quiz-announce-pill');
  if (pill) pill.classList.remove('show');

  // Bottom panel elements
  const sw = document.getElementById('simplified-wrap');
  if (sw) sw.style.display = 'none';
  const gr = document.getElementById('gotit-row');
  if (gr) gr.style.display = 'none';
  const ar = document.getElementById('ask-reply');
  if (ar) ar.classList.remove('open');
  const simpWrap = document.getElementById('simplified-wrap');
  if (simpWrap) simpWrap.style.display = 'none';

  // Step challenge — hide and reset
  const challengePanel = document.getElementById('step-challenge');
  if (challengePanel) challengePanel.classList.remove('active');
  const challengeReveal = document.getElementById('challenge-reveal');
  if (challengeReveal) challengeReveal.style.display = 'none';
  const challengeInputRow = document.getElementById('challenge-input-row');
  if (challengeInputRow) challengeInputRow.style.display = 'flex';
  const challengeSkipBtn = document.getElementById('challenge-skip');
  if (challengeSkipBtn) challengeSkipBtn.style.display = '';
  _vtpChallengeRevealed = false;

  // Ask input — re-enable in case it was disabled mid-step
  const askEl  = document.getElementById('ask-input');
  const simpBtn = document.getElementById('btn-simplify');
  if (askEl)   { askEl.disabled = false; askEl.value = ''; askEl.placeholder = 'Ask anything…'; }
  if (simpBtn) simpBtn.disabled = false;

  // Progress + dots
  const progFill = document.getElementById('prog-fill');
  if (progFill) progFill.style.width = '0%';
}

if (typeof window !== 'undefined') window._vtClear = function() {
  if (_vtpTypeTimer)    clearTimeout(_vtpTypeTimer);
  if (_vtpAutoTimer)    clearTimeout(_vtpAutoTimer);
  if (_vtpLoadingAbort) { _vtpLoadingAbort.abort(); _vtpLoadingAbort = null; }
  _vtpStopLoadingAnim();
  _vtpLesson      = null;
  _vtpStepBusy    = false;
  _vtpAutoplay    = false;

  // Wipe all lesson DOM state so nothing bleeds into the next session
  _vtpResetLessonDOM();

  // Clear canvas and return to entry screen
  _vtpClearCanvas();
  const inp = document.getElementById('vtp-entry-input');
  if (inp) inp.value = '';

  _vtpShowScreen('screen-entry');
};

/**
 * Called by FlashScreen (Hard rating button) and studyPlanState
 * to open the Visual Tutor pre-loaded with a specific concept.
 * _navFromHistory must be true BEFORE showScreen so navigation.js
 * skips calling _vtClear and we set state ourselves.
 */
if (typeof window !== 'undefined') window._vtOpenForConcept = function(front /*, back */) {
  // Set the flag first — navigation.js reads it inside showScreen()
  setNavFromHistory(true);
  showScreen('visual');
  setTimeout(() => {
    const inp = document.getElementById('vtp-entry-input');
    if (inp && front) inp.value = front;
    if (front) _vtpStartLesson();
    else _vtpShowScreen('screen-entry');
  }, 300);
};

/**
 * Called by sidebar when user clicks a recent VT session item.
 * The new step-based VT has no persistent chat/SVG state to restore,
 * so we pre-fill the topic and return to entry so they can restart.
 */
// ── Session persistence helpers ─────────────────────────────────────────────
function _vtpSaveSession() {
  try {
    // Get the id of the most-recent visual item just added by recentAdd
    const raw = localStorage.getItem('chunks_recent');
    if (!raw || !_vtpLesson || !_vtpCurrentTopic) return;
    const items = JSON.parse(raw);
    const match = items.find(r => r.source === 'visual' && r.question === _vtpCurrentTopic);
    if (!match) return;
    const session = { topic: _vtpCurrentTopic, lesson: _vtpLesson };
    localStorage.setItem('chunks_vt_session_' + match.id, JSON.stringify(session));
  } catch (_) {}
}

if (typeof window !== 'undefined') window._vtRestoreSession = function(sessionId, question) {
  // _clickRecent already called _setActiveRecent and showScreen('visual') before us.
  // Just ensure _navFromHistory stays true so _vtClear doesn't fire after our setTimeout.
  setNavFromHistory(true);

  setTimeout(() => {
    // Try to restore saved lesson data
    try {
      const raw = localStorage.getItem('chunks_vt_session_' + sessionId);
      if (raw) {
        const session = JSON.parse(raw);
        if (session.lesson && session.topic) {
          _vtpCurrentTopic = session.topic;
          _vtpLesson       = session.lesson;
          _vtpStepIdx      = 0;
          _vtpTotalSteps   = session.lesson.steps.length;
          _vtpSimplifyCount = 0;
          _vtpAskCount      = 0;
          _vtpQuizPassed    = false;
          _vtpQuizAnswered  = false;
          _vtpWeakSteps     = [];
          _vtpAskHistory    = [];

          const topicLabel    = document.getElementById('lh-topic-label');
          const completeTopic = document.getElementById('complete-topic');
          if (topicLabel)    topicLabel.textContent    = _vtpCurrentTopic;
          if (completeTopic) completeTopic.textContent = _vtpCurrentTopic;

          const summaryEl = document.getElementById('summary-items');
          if (summaryEl) {
            summaryEl.innerHTML = (session.lesson.summary || [])
              .map(s => '<div class="summary-item"><div class="summary-dot"></div>' + s + '</div>')
              .join('');
          }

          _vtpResetLessonDOM();
          _vtpShowScreen('screen-lesson');
          setTimeout(() => { _vtpInitCanvas(); _vtpBuildDots(); _vtpRenderStep(0); }, 220);
          return;
        }
      }
    } catch (_) {}

    // Fallback: pre-fill topic so user can re-run
    const inp = document.getElementById('vtp-entry-input');
    if (inp && question) inp.value = question;
    _vtpShowScreen('screen-entry');
  }, 150);
};

// ─────────────────────────────────────────────────────────────────────────────
// MOUNT
// ─────────────────────────────────────────────────────────────────────────────

let _vtMounted = false;

export function mountVisualTutorScreen() {
  if (_vtMounted) return;
  _vtMounted = true;

  // Inject HTML
  const sp = document.querySelector('[data-visual-screen]');
  if (sp) {
    sp.outerHTML = VT_HTML;
  } else {
    const div = document.createElement('div');
    div.innerHTML = VT_HTML;
    document.body.appendChild(div.firstElementChild);
  }

  // Wire all event listeners after a tick so the DOM is ready
  setTimeout(() => {

    // ── Entry screen ────────────────────────────────────────────────────────
    const entryInput = document.getElementById('vtp-entry-input');
    if (entryInput) {
      entryInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') _vtpStartLesson();
      });

      // Pick up weak-concept prefill from Exam results
      try {
        const raw = sessionStorage.getItem('exam_weak_prefill');
        if (raw) {
          const { vtQuery } = JSON.parse(raw);
          if (vtQuery) { entryInput.value = vtQuery; setTimeout(() => entryInput.focus(), 150); }
          sessionStorage.removeItem('exam_weak_prefill');
        }
      } catch (e) {}
    }

    const startBtn = document.getElementById('vtp-entry-start');
    if (startBtn) startBtn.addEventListener('click', _vtpStartLesson);

    // Topic chips (cards + extra chips rows)
    const chipsWrap = document.getElementById('vtp-chips');
    if (chipsWrap) {
      chipsWrap.querySelectorAll('[data-topic]').forEach(chip => {
        chip.addEventListener('click', () => {
          const inp = document.getElementById('vtp-entry-input');
          if (inp) inp.value = chip.getAttribute('data-topic');
          _vtpStartLesson();
        });
      });
    }
    const extraChips = document.getElementById('vtp-extra-chips');
    if (extraChips) {
      extraChips.querySelectorAll('[data-topic]').forEach(chip => {
        chip.addEventListener('click', () => {
          const inp = document.getElementById('vtp-entry-input');
          if (inp) inp.value = chip.getAttribute('data-topic');
          _vtpStartLesson();
        });
      });
    }

    // ── Entry screen animations ──────────────────────────────────────────────
    _vtpInitEntryAnimations();

    // ── Scroll hint — show when entry content overflows viewport ────────────
    (function _initScrollHint() {
      const entryEl = document.getElementById('screen-entry');
      const hintEl  = document.getElementById('vtp-scroll-hint');
      if (!entryEl || !hintEl) return;

      function _updateHint() {
        const overflows = entryEl.scrollHeight > entryEl.clientHeight + 10;
        const atBottom  = entryEl.scrollTop + entryEl.clientHeight >= entryEl.scrollHeight - 20;
        hintEl.classList.toggle('visible', overflows && !atBottom);
      }

      entryEl.addEventListener('scroll', _updateHint, { passive: true });
      let _vtpHintResizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(_vtpHintResizeTimer);
        _vtpHintResizeTimer = setTimeout(_updateHint, 150);
      });
      // Check after a short delay to let layout settle
      setTimeout(_updateHint, 400);
    })();

    // ── Lesson screen ────────────────────────────────────────────────────────
    const exitBtn = document.getElementById('vtp-exit-btn');
    if (exitBtn) exitBtn.addEventListener('click', _vtpExitLesson);

    const gotitYes = document.getElementById('vtp-gotit-yes');
    if (gotitYes) gotitYes.addEventListener('click', () => _vtpGotIt(true));

    const gotitNo = document.getElementById('vtp-gotit-no');
    if (gotitNo) gotitNo.addEventListener('click', () => _vtpGotIt(false));

    const skipBtn = document.getElementById('btn-skip');
    if (skipBtn) skipBtn.addEventListener('click', _vtpSkipToQuiz);

    const replyClose = document.getElementById('vtp-reply-close');
    if (replyClose) replyClose.addEventListener('click', _vtpCloseAskReply);

    const askInput = document.getElementById('ask-input');
    if (askInput) {
      askInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') _vtpSendAsk();
      });
    }

    const simpBtn = document.getElementById('btn-simplify');
    if (simpBtn) simpBtn.addEventListener('click', _vtpSimplify);

    const autoplayToggle = document.getElementById('autoplay-toggle');
    if (autoplayToggle) autoplayToggle.addEventListener('click', _vtpToggleAutoplay);

    // ── Step Challenge ───────────────────────────────────────────────────────
    const challengeInput  = document.getElementById('challenge-input');
    const challengeSubmit = document.getElementById('challenge-submit');
    const challengeCont   = document.getElementById('challenge-continue');
    const challengeSkip   = document.getElementById('challenge-skip');
    if (challengeInput) {
      challengeInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') _vtpSubmitChallenge();
      });
    }
    if (challengeSubmit) challengeSubmit.addEventListener('click', _vtpSubmitChallenge);
    if (challengeCont)   challengeCont.addEventListener('click', _vtpContinueChallenge);
    if (challengeSkip)   challengeSkip.addEventListener('click', _vtpSkipChallenge);

    // ── Quiz ────────────────────────────────────────────────────────────────
    const quizContinue = document.getElementById('quiz-continue');
    if (quizContinue) quizContinue.addEventListener('click', _vtpCloseQuiz);

    // ── Complete screen ──────────────────────────────────────────────────────
    const againBtn = document.getElementById('vtp-again-btn');
    if (againBtn) againBtn.addEventListener('click', _vtpDoAgain);

    const newBtn = document.getElementById('vtp-new-btn');
    if (newBtn) newBtn.addEventListener('click', _vtpExitLesson);

    const reviewBtn = document.getElementById('btn-review-weak');
    if (reviewBtn) reviewBtn.addEventListener('click', _vtpReviewWeak);

    // ── Teach It Back ────────────────────────────────────────────────────────
    const ttbSubmitBtn = document.getElementById('ttb-submit-btn');
    if (ttbSubmitBtn) ttbSubmitBtn.addEventListener('click', _vtpTeachItBack);

    // ── Loading screen ───────────────────────────────────────────────────
    const cancelBtn = document.getElementById('vtp-loading-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      if (_vtpLoadingAbort) { _vtpLoadingAbort.abort(); _vtpLoadingAbort = null; }
      _vtpStopLoadingAnim();
      _vtpShowScreen('screen-entry');
    });

    const retryBtn = document.getElementById('vtp-loading-retry');
    if (retryBtn) retryBtn.addEventListener('click', () => {
      // Clear cache for this topic so we re-fetch
      if (_vtpCurrentTopic) delete _vtpLessonCache[_vtpCurrentTopic];
      _vtpStartLesson();
    });

    // ── Resize handler ───────────────────────────────────────────────────────
    window.addEventListener('resize', () => {
      clearTimeout(_vtpResizeTimer);
      _vtpResizeTimer = setTimeout(() => {
        if (!_vtpCanvas || !_vtpLesson) return;
        const area = document.getElementById('wb-area');
        if (!area) return;
        _vtpW = area.offsetWidth; _vtpH = area.offsetHeight;
        _vtpCanvas.width = _vtpW; _vtpCanvas.height = _vtpH;
        _vtpClearCanvas();
        if (_vtpLesson?.steps[_vtpStepIdx]) _vtpDrawSpec(_vtpLesson.steps[_vtpStepIdx].draw);
      }, 150);
    });

  }, 100);

  console.log('[VisualTutorScreen] mounted ✦');
}

// ── Entry Screen Animations ───────────────────────────────────────────────────

function _vtpInitEntryAnimations() {
  // ── Typing placeholder ──────────────────────────────────────────────────
  const TOPICS = [
    'How does osmosis work?',
    'Explain Newton\'s 3rd Law',
    'What is the pH scale?',
    'Show me how DNA replication works',
    'Explain supply and demand curves',
    'How does photosynthesis happen?',
    'Visualize electric circuits',
    'What is cell division?',
  ];
  let _ti = 0, _ci = 0, _del = false, _ptimer = null;
  const inp = document.getElementById('vtp-entry-input');
  function _typeStep() {
    if (!inp || document.activeElement === inp) { _ptimer = setTimeout(_typeStep, 500); return; }
    const topic = TOPICS[_ti];
    if (!_del) {
      if (_ci < topic.length) {
        inp.placeholder = topic.slice(0, ++_ci) + '|';
        _ptimer = setTimeout(_typeStep, 55 + Math.random() * 30);
      } else {
        _ptimer = setTimeout(() => { _del = true; _typeStep(); }, 1800);
      }
    } else {
      if (_ci > 0) {
        inp.placeholder = topic.slice(0, --_ci) + '|';
        _ptimer = setTimeout(_typeStep, 28);
      } else {
        _del = false; _ti = (_ti + 1) % TOPICS.length;
        _ptimer = setTimeout(_typeStep, 400);
      }
    }
  }
  _typeStep();

  // ── pH bar chart ────────────────────────────────────────────────────────
  const PH_COLORS  = ['#f87171','#fb923c','#facc15','#a3e635','#4ade80','#34d399','#22d3ee','#60a5fa','#818cf8','#a78bfa','#c084fc','#e879f9','#f472b6','#fb7185'];
  const PH_HEIGHTS = [90,82,74,65,56,50,44,44,50,56,65,74,82,90];
  const barsEl = document.getElementById('vtp-bars-ph');
  if (barsEl) {
    PH_HEIGHTS.forEach((h, i) => {
      const bar = document.createElement('div');
      bar.className = 'vtp-mini-bar';
      bar.style.cssText = `height:${h}%;background:${PH_COLORS[i]};opacity:0.85;animation-delay:${i * 0.04}s;`;
      barsEl.appendChild(bar);
    });
  }

  // ── Sine wave ───────────────────────────────────────────────────────────
  let _wPhase = 0, _wActive = true;
  function _drawWave(pathEl, amp, freq, phase, w=200, h=72) {
    let d = '';
    for (let x = 0; x <= w; x += 2) {
      const y = h/2 + amp * Math.sin((x/w)*freq*Math.PI*2 + phase);
      d += (x===0?'M':'L') + x + ',' + y;
    }
    pathEl.setAttribute('d', d);
  }
  function _animWave() {
    if (!_wActive) return;
    _wPhase += 0.04;
    const w1 = document.getElementById('vtp-wave1');
    const w2 = document.getElementById('vtp-wave2');
    if (w1) _drawWave(w1, 18, 2, _wPhase);
    if (w2) _drawWave(w2, 12, 3, -_wPhase*1.3);
    requestAnimationFrame(_animWave);
  }
  _animWave();

  // ── DNA helix ───────────────────────────────────────────────────────────
  let _dnaPhase = 0, _dnaActive = true;
  const DNA_COLORS = ['#e8ac2e','#2dd4bf','#8b7cf8','#f87171'];
  function _drawDNA() {
    if (!_dnaActive) return;
    const svg = document.getElementById('vtp-dna-svg');
    if (!svg) return;
    const steps = 14, cx = 50, H = 72;
    let html = '';
    for (let i = 0; i <= steps; i++) {
      const t   = i / steps;
      const y   = 4 + t * (H - 8);
      const ang = (t * Math.PI * 4) + _dnaPhase;
      const x1  = cx + Math.sin(ang) * 20;
      const x2  = cx - Math.sin(ang) * 20;
      const r   = 2.5 + Math.abs(Math.sin(ang));
      const col = DNA_COLORS[i % DNA_COLORS.length];
      const op  = (0.3 + Math.abs(Math.cos(ang)) * 0.5).toFixed(2);
      html += `<line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="1.2" stroke-linecap="round" opacity="${op}"/>`;
      html += `<circle cx="${x1.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${col}" opacity="0.9"/>`;
      html += `<circle cx="${x2.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${col}" opacity="0.9"/>`;
    }
    svg.innerHTML = html;
    _dnaPhase += 0.03;
    requestAnimationFrame(_drawDNA);
  }
  _drawDNA();

  // ── Particle network ────────────────────────────────────────────────────
  const canvas = document.getElementById('vtp-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const screen = document.getElementById('screen-entry');
  function _resizeCanvas() {
    canvas.width  = screen ? screen.offsetWidth  : window.innerWidth;
    canvas.height = screen ? screen.offsetHeight : window.innerHeight;
  }
  _resizeCanvas();
  let _vtpPartResizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(_vtpPartResizeTimer);
    _vtpPartResizeTimer = setTimeout(_resizeCanvas, 150);
  });

  const PART_COLORS = ['rgba(232,172,46,','rgba(139,124,248,','rgba(45,212,191,'];
  const _parts = Array.from({length: 55}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random()-.5)*.3, vy: (Math.random()-.5)*.3,
    r: Math.random()*1.4+.3,
    a: Math.random()*.35+.05,
    color: PART_COLORS[Math.floor(Math.random()*3)],
  }));

  let _pActive = true;
  function _tickParticles() {
    if (!_pActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    _parts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = p.color + p.a + ')';
      ctx.fill();
    });
    for (let i = 0; i < _parts.length; i++) {
      for (let j = i+1; j < _parts.length; j++) {
        const dx = _parts[i].x - _parts[j].x;
        const dy = _parts[i].y - _parts[j].y;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < 90) {
          ctx.beginPath();
          ctx.moveTo(_parts[i].x, _parts[i].y);
          ctx.lineTo(_parts[j].x, _parts[j].y);
          ctx.strokeStyle = `rgba(255,255,255,${0.02*(1-dist/90)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(_tickParticles);
  }
  _tickParticles();
}

if (typeof document !== 'undefined') mountVisualTutorScreen();
