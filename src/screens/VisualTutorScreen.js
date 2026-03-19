/**
 * src/screens/VisualTutorScreen.js
 *
 * Visual AI Tutor — step-based lesson player with canvas whiteboard.
 * Entry → Lesson (5 steps + quiz) → Complete.
 *
 * Architecture:
 *   • 2 built-in lessons (pH Scale, Newton's Laws) + generic fallback
 *   • Canvas2D drawing engine (no SVG library dependency)
 *   • "Ask anything" wired to POST /ask with mode: visual_tutor
 *   • Accessible from flashcard Hard rating, sidebar, and Exam weak-concept flow
 */

import { API_BASE } from '../lib/api.js';

// ── HTML ──────────────────────────────────────────────────────────────────────

const VT_HTML = `
<div class="screen" id="screen-visual" style="display:none;">

  <aside class="sidebar" data-sidebar-screen="visual"></aside>

  <!-- ── SCREEN 1: ENTRY ─────────────────────────────────────────────── -->
  <div class="vtp-screen active" id="screen-entry">
    <div class="orb orb-g"></div>
    <div class="orb orb-v"></div>

    <div class="entry-inner">
      <div class="entry-hook">
        <div class="entry-hook-dot"></div>
        This confuses 90% of students — let's fix that in 5 steps
      </div>

      <div class="entry-badge">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 21h8m-4-4v4"/></svg>
        Visual Tutor · Chunks AI
      </div>

      <div class="entry-h">
        What do you want to<br><em>understand today?</em>
      </div>
      <div class="entry-s">
        Pick a topic and I'll guide you through it — step by step,<br>
        drawing it out as we go. <strong style="color:var(--t1-vt);">You'll get it in under 3 minutes.</strong>
      </div>

      <div class="entry-input-wrap">
        <input class="entry-input" id="vtp-entry-input"
          placeholder='e.g. "How does osmosis work?"'>
        <button class="entry-start" id="vtp-entry-start">Start Lesson →</button>
      </div>

      <div class="entry-divider"><div class="entry-divider-text">or start with a topic</div></div>

      <div class="entry-chips" id="vtp-chips">
        <div class="chip gold"   data-topic="pH Scale">⚗ pH Scale</div>
        <div class="chip violet" data-topic="Newton's Laws">⚡ Newton's Laws</div>
        <div class="chip"        data-topic="Cell Structure">🧬 Cell Structure</div>
        <div class="chip"        data-topic="Photosynthesis">🌿 Photosynthesis</div>
        <div class="chip"        data-topic="Osmosis">💧 Osmosis</div>
        <div class="chip"        data-topic="Stoichiometry">🔢 Stoichiometry</div>
        <div class="chip"        data-topic="Supply &amp; Demand">📈 Supply &amp; Demand</div>
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
    </div>
  </div>

</div>
`;

// ─────────────────────────────────────────────────────────────────────────────
// LESSON DATA  (2 built-in topics; all others fall through to buildDefault)
// ─────────────────────────────────────────────────────────────────────────────

const VTP_LESSONS = {
  'pH Scale': {
    hook: "This confuses 90% of students — let's fix that in 5 steps",
    summary: [
      'pH scale: 0–14. Below 7 = acidic, above 7 = basic, 7 = neutral',
      'More H⁺ ions in a solution = lower pH number',
      'Common acids: lemon (pH 2), coffee (pH 5)',
      'Buffers keep blood near pH 7.4 — vital for survival',
    ],
    quiz: {
      onStep: 3,
      q: 'Pure water has a pH of 7. This means it is…',
      options: [
        { text: 'Acidic — it has extra H⁺ ions',            correct: false },
        { text: 'Neutral — equal H⁺ and OH⁻ ions',          correct: true  },
        { text: 'Basic — it has extra OH⁻ ions',            correct: false },
        { text: 'Impossible to classify on the pH scale',   correct: false },
      ],
      feedbackRight: '✓ Exactly right. pH 7 means the H⁺ and OH⁻ ions are perfectly balanced — that\'s neutral.',
      feedbackWrong:  '✗ Not quite. pH 7 is where H⁺ and OH⁻ are balanced — that\'s neutral. Acids are below 7, bases above.',
    },
    steps: [
      {
        label: 'Step 1 — The Big Picture',
        text: '<strong>Let\'s start simple.</strong> The pH scale is just a ruler from 0 to 14 that measures how acidic or basic something is. Lemon juice, your blood, bleach — everything liquid sits somewhere on it.',
        simple: 'Think of it like a sourness-to-soapiness ruler. 0 = very sour (like battery acid). 14 = very soapy (like bleach). 7 = water.',
        draw: 'ph_bar',
        contextualReplies: [
          'Great question. The "p" in pH stands for "potenz" (German for power) — it\'s basically the power of hydrogen. Don\'t worry about that, just remember: low = acidic, high = basic.',
          'Think of pH 1 as being 10 times more acidic than pH 2. It\'s a logarithmic scale — each step is 10× stronger.',
          'Yes, pH is measured in every liquid. Your blood is pH 7.4, stomach acid is pH 1.5, and baking soda solution is about pH 8.',
        ],
      },
      {
        label: 'Step 2 — What pH Actually Measures',
        text: '<strong>Now watch this.</strong> pH measures the concentration of <em>hydrogen ions (H⁺)</em> dissolved in water. The more H⁺ ions, the more acidic, and the <em>lower</em> the pH number. It\'s counterintuitive — but that\'s chemistry.',
        simple: 'More H⁺ ions = more acidic = lower pH number. Think of H⁺ ions as tiny bullies — the more of them, the more "aggressively acidic" the solution.',
        draw: 'ph_ions',
        contextualReplies: [
          'Great question. OH⁻ ions (hydroxide) are the opposite — more OH⁻ means more basic and higher pH. Acids make H⁺, bases make OH⁻.',
          'The equation is pH = -log[H⁺]. In plain English: as H⁺ doubles, pH drops by about 0.3. Don\'t stress the math — just remember more H⁺ = lower pH.',
          'Water slightly ionizes into H⁺ and OH⁻. Pure water has exactly equal amounts, giving pH 7.',
        ],
      },
      {
        label: 'Step 3 — Real Examples You Know',
        text: '<strong>Let\'s make it real.</strong> Lemon juice is pH 2 — very acidic. Your blood is pH 7.4 — slightly basic. Bleach is pH 12 — very basic. The scale is logarithmic: pH 2 is 100,000× more acidic than pH 7.',
        simple: 'Remember these 3: lemon = 2 (sour, acidic). Water = 7 (neutral). Bleach = 12 (basic). Everything else falls between them.',
        draw: 'ph_examples',
        contextualReplies: [
          'Yes! Stomach acid is pH 1–2, which is why it can digest tough foods. Your stomach lining is protected by a mucus layer that resists acid.',
          'Coffee is about pH 5 — mildly acidic. That\'s why some people get heartburn from it. Tea is usually pH 5.5–6.',
          'Rain is naturally pH 5.6 because CO₂ dissolves in it forming carbonic acid. "Acid rain" from pollution can be pH 4 or lower.',
        ],
      },
      {
        label: 'Step 4 — Buffers Keep You Alive',
        text: '<strong>Here\'s the clever part.</strong> Your blood needs to stay near pH 7.4 to keep you alive. <em>Buffers</em> are chemicals that absorb extra H⁺ ions so your pH barely moves — even when you eat acidic food or exercise hard.',
        simple: 'A buffer is like a pH bouncer. Extra acid? The buffer absorbs it. Extra base? It releases some acid back. Result: pH stays stable.',
        draw: 'ph_buffer',
        contextualReplies: [
          'The main blood buffer is bicarbonate (HCO₃⁻). It pairs with carbonic acid (H₂CO₃) to catch or release H⁺ as needed.',
          'If blood pH drops below 7.35 it\'s called acidosis — can cause confusion and breathing problems. Above 7.45 is alkalosis. Both are dangerous.',
          'Your kidneys and lungs also help regulate blood pH. Kidneys adjust bicarbonate levels; lungs adjust CO₂ levels — CO₂ dissolves to form acid.',
        ],
      },
      {
        label: 'Step 5 — The Full Picture',
        text: '<strong>You\'ve got it.</strong> pH is a 0–14 scale. Low = acidic (more H⁺). High = basic (more OH⁻). 7 = neutral. The scale is logarithmic — each step is 10× stronger. Buffers keep living systems at the right pH. That\'s the whole story.',
        simple: 'The three numbers to remember: 0 (acid), 7 (neutral), 14 (base). Lower = more H⁺ ions = more acidic.',
        draw: 'ph_summary',
        contextualReplies: [
          'You\'ve now understood what trips up most students: that lower pH = MORE acidic (not less). Great work.',
          'Next level: try calculating pH from H⁺ concentration using pH = -log[H⁺]. If [H⁺] = 0.01 mol/L, then pH = 2.',
          'Great question. Indicators like litmus turn red in acid, blue in base. Phenolphthalein is colorless in acid, pink in base.',
        ],
      },
    ],
  },

  "Newton's Laws": {
    hook: "You'll understand all 3 laws in under 3 minutes",
    summary: [
      'Law 1: Objects resist change in motion — inertia',
      'Law 2: F = ma — force, mass, and acceleration are linked',
      'Law 3: Every action has an equal and opposite reaction',
      'All three laws work together in every motion you see',
    ],
    quiz: {
      onStep: 3,
      q: 'A heavier truck and a small car have the same engine force applied. Which accelerates faster?',
      options: [
        { text: 'The truck — more mass means more force',              correct: false },
        { text: 'The car — less mass means more acceleration (F=ma)',  correct: true  },
        { text: 'They accelerate equally — force is the same',        correct: false },
        { text: 'Neither — they cancel each other out',               correct: false },
      ],
      feedbackRight: '✓ Correct! F=ma means a = F/m. Same force, less mass → more acceleration. The car wins.',
      feedbackWrong:  '✗ Remember F=ma, so a = F/m. Same force but less mass means MORE acceleration. The lighter car accelerates faster.',
    },
    steps: [
      { label:'Step 1 — Law of Inertia',          text:'<strong>Imagine this.</strong> A ball floating in deep space keeps floating forever — same speed, same direction. Nothing stops it. That\'s Newton\'s First Law: objects keep doing what they\'re doing unless a force pushes or pulls them.', simple:'Things are lazy. A still object stays still. A moving object keeps moving. Only a force can change that.', draw:'n_1', contextualReplies:['A seat belt works because of inertia. In a crash, your body wants to keep moving forward — the belt applies a force to stop you.','Friction is the hidden force that stops objects on Earth. In space, with no friction, the First Law plays out perfectly.','The fancy word for this property is "inertia". More mass = more inertia = harder to start or stop moving.'] },
      { label:'Step 2 — F = ma',                  text:'<strong>Now the famous one.</strong> Force equals mass times acceleration. <em>F = ma.</em> Push a car vs push a bike with the same force — the bike accelerates much faster because it has less mass. Simple and powerful.', simple:'F = ma means: bigger force → more acceleration. But also: bigger mass → less acceleration. Same formula, two lessons.', draw:'n_2', contextualReplies:['In SI units: Force is in Newtons (N). 1 N = 1 kg·m/s². So pushing 1 kg with 1 N gives 1 m/s² acceleration.','Weight is actually a force: W = mg where g = 9.8 m/s². That\'s why heavier things need more force to lift.','This law lets engineers calculate exactly how much rocket thrust is needed to lift a specific mass off the ground.'] },
      { label:'Step 3 — Action & Reaction',        text:'<strong>This one surprises people.</strong> Every force you exert creates an equal and opposite force coming back. When you jump, you push Earth down — Earth pushes you up with the same force. That push is what launches you into the air.', simple:'Forces always come in pairs. You push on something → it pushes back exactly as hard. Always. No exceptions.', draw:'n_3', contextualReplies:['A rocket works by throwing gas backwards (action) → gas pushes rocket forwards (reaction). No air needed.','The forces are equal but their effects aren\'t — if you push a wall, same force comes back, but the wall barely moves (much more mass).','Swimming uses this law: you push water backwards with your hands → water pushes you forwards.'] },
      { label:'Step 4 — All Three Working Together', text:'<strong>Watch how they connect.</strong> A rocket on a launch pad: Law 1 — it stays still until thrust fires. Law 2 — thrust force accelerates its mass upward. Law 3 — exhaust pushes down, rocket is pushed up. Three laws, one launch.', simple:'Law 1: stays still until something happens. Law 2: force causes acceleration based on mass. Law 3: every push has a push-back.', draw:'n_all', contextualReplies:['Car safety systems use all three laws: airbags (Law 1 - inertia), seatbelts (Law 2 - deceleration force), crumple zones (Law 3 - reaction forces).','The ISS stays in orbit because of Law 1 — it\'s constantly falling around Earth but also moving forward fast enough to keep missing it.','Even walking uses Law 3: your foot pushes backward on the ground, ground pushes you forward.'] },
      { label:'Step 5 — Complete Picture',          text:'<strong>You\'ve nailed it.</strong> Three laws. Objects resist change (1). F=ma means force, mass, and acceleration are linked (2). Every force has an equal opposite force (3). These three rules explain nearly every motion you\'ve ever seen.', simple:'Remember F=ma and "equal and opposite" and you\'ve got Newton. Everything else follows from those two ideas.', draw:'n_summary', contextualReplies:['These three laws were published in 1687 in Principia Mathematica — considered one of the greatest science books ever written.','Newton\'s Laws break down at very high speeds (you need Einstein\'s relativity) and at atomic scales (you need quantum mechanics). But for everyday life, they\'re perfect.','A fun test: think of any motion and try to identify all three laws in it. Kicking a ball involves all three.'] },
    ],
  },
};

function vtpBuildDefault(topic) {
  return {
    hook: `You'll understand ${topic} in under 3 minutes`,
    summary: [
      `Core concept of ${topic} established`,
      'Visual understanding built step by step',
      'Real-world examples connected',
      'Practice confirms understanding',
    ],
    quiz: {
      onStep: 3,
      q: `Which best describes the key idea behind ${topic}?`,
      options: [
        { text: 'It involves a relationship between two changing quantities', correct: true  },
        { text: 'It only applies in laboratory conditions',                  correct: false },
        { text: 'It contradicts most other scientific principles',           correct: false },
        { text: 'It was only discovered in the 20th century',               correct: false },
      ],
      feedbackRight: '✓ Correct! That\'s the core insight — most scientific concepts describe relationships between variables.',
      feedbackWrong:  '✗ Actually, most concepts describe relationships between quantities. Keep that in mind as we go.',
    },
    steps: [
      { label:'Step 1 — Foundation',      text:`<strong>Let's start simple.</strong> Every concept has a core idea. For ${topic}, that core idea is about understanding how one thing relates to another. Before the details, let's lock in the foundation.`, simple:`Think of ${topic} as a relationship. When one thing changes, something else responds predictably. That's the whole concept.`, draw:'generic', contextualReplies:[`Great question! The foundation of ${topic} comes down to the key variable that changes everything else. Watch how that plays out in the next step.`,`That's a common confusion. The key thing to remember is the direction of the relationship — which thing causes which.`] },
      { label:'Step 2 — Core Mechanism',  text:`<strong>Now imagine this.</strong> The mechanism behind ${topic} is a cause-and-effect chain. One input changes → a predictable output follows. Understanding that chain is 80% of understanding the topic.`, simple:`Input changes → output changes in a predictable way. That's the mechanism. The rest is just knowing the specific inputs and outputs.`, draw:'generic', contextualReplies:[`The mechanism here is elegant because it works the same way in many contexts. Once you see the pattern, you'll spot it everywhere.`] },
      { label:'Step 3 — Real Example',    text:`<strong>Let's ground it.</strong> The best way to lock in a concept is a concrete example. Here's one that shows exactly how ${topic} plays out in a real situation you can picture.`, simple:`Picture the simplest version: one thing goes up, another goes down (or up). That's all a real example shows.`, draw:'generic', contextualReplies:[`Yes, that's a great real-world application. You're already connecting the concept to your existing knowledge — that's how real understanding builds.`] },
      { label:'Step 4 — Why It Matters',  text:`<strong>Here's why it sticks.</strong> ${topic} shows up in the real world in ways you encounter every day. Recognising it outside the classroom is what turns knowledge into understanding.`, simple:`Ask yourself: where do I see this in real life? The moment you find a personal example, the concept belongs to you.`, draw:'generic', contextualReplies:[`That's exactly the kind of connection that makes knowledge permanent. The more personal examples you find, the better it sticks.`] },
      { label:'Step 5 — Summary',         text:`<strong>You've got it.</strong> You've walked through ${topic} from the core idea to real examples. The key pattern, the mechanism, and the real-world context — all in one session. Well done.`, simple:`Three things: the core idea, how it works, and where you see it. You've covered all three.`, draw:'generic', contextualReplies:[`You're now in the top 10% of students who can explain ${topic} clearly. Most people skip steps — you didn't.`] },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

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
}

// ─────────────────────────────────────────────────────────────────────────────
// LESSON LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

function _vtpStartLesson() {
  const inp = document.getElementById('vtp-entry-input');
  const t   = (inp ? inp.value.trim() : '') || 'pH Scale';
  _vtpCurrentTopic  = t;
  _vtpLesson        = VTP_LESSONS[t] || vtpBuildDefault(t);
  _vtpTotalSteps    = _vtpLesson.steps.length;
  _vtpStepIdx       = 0;
  _vtpSimplifyCount = 0;
  _vtpAskCount      = 0;
  _vtpQuizPassed    = false;
  _vtpQuizAnswered  = false;
  _vtpCtxReplyStep  = 0;
  _vtpWeakSteps     = [];

  // Update hook text on entry screen for next open
  const hookEl = document.querySelector('#screen-visual .entry-hook');
  if (hookEl) {
    const textNode = hookEl.childNodes[hookEl.childNodes.length - 1];
    if (textNode) textNode.textContent = ' ' + (_vtpLesson.hook || "You'll understand this in 5 steps");
  }

  const topicLabel = document.getElementById('lh-topic-label');
  if (topicLabel) topicLabel.textContent = _vtpCurrentTopic;

  const completeTopic = document.getElementById('complete-topic');
  if (completeTopic) completeTopic.textContent = _vtpCurrentTopic;

  // Build summary
  const summaryEl = document.getElementById('summary-items');
  if (summaryEl) {
    summaryEl.innerHTML = _vtpLesson.summary
      .map(s => `<div class="summary-item"><div class="summary-dot"></div>${s}</div>`)
      .join('');
  }

  _vtpShowScreen('screen-lesson');
  setTimeout(() => { _vtpInitCanvas(); _vtpBuildDots(); _vtpRenderStep(0); }, 220);
}

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
  _vtpFadeAndDraw(step.draw || 'generic');

  _vtpTypeText(step.text, () => {
    _vtpStepBusy = false;
    if (simpBtn) simpBtn.disabled = false;
    if (askEl)   { askEl.disabled = false; askEl.placeholder = 'Ask anything…'; }
    _vtpShowGotItRow();
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
// ASK — sends student question to POST /ask (mode: visual_tutor)
//        Falls back to built-in contextual replies if offline / unauthenticated
// ─────────────────────────────────────────────────────────────────────────────

async function _vtpSendAsk() {
  const input = document.getElementById('ask-input');
  if (!input) return;
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  _vtpAskCount++;

  // ── Offline / instant fallback (used if API call fails) ───────────────────
  const step        = _vtpLesson.steps[_vtpStepIdx];
  const stepTitle   = step.label.split('—')[1]?.trim() || _vtpCurrentTopic;
  const localReplies = step.contextualReplies || [];
  const localFallback = localReplies[_vtpCtxReplyStep % localReplies.length] ||
    `That's a great question about ${stepTitle}. Focus on the key relationship shown in the diagram — that's where the answer lives.`;
  _vtpCtxReplyStep++;

  // ── Show loading state immediately ────────────────────────────────────────
  const askEl   = document.getElementById('ask-input');
  const simpBtn = document.getElementById('btn-simplify');
  if (askEl)   { askEl.disabled = true; askEl.placeholder = 'Thinking…'; }
  if (simpBtn)  simpBtn.disabled = true;
  _vtpShowAskReply('<span class="ask-thinking">●●●</span>');

  // ── Build the prompt — give the AI full context about the current step ─────
  const contextPrompt =
    `You are tutoring a student on "${_vtpCurrentTopic}". ` +
    `They are currently on ${step.label} of a 5-step visual lesson. ` +
    `The step just explained: "${step.text.replace(/<[^>]+>/g, '')}". ` +
    `The student asks: "${q}". ` +
    `Answer in 2–3 sentences max. Be direct, clear, and encouraging. ` +
    `No preamble like "Great question!" — just the answer.`;

  try {
    const authHeader = await window._getAuthHeader?.() ?? {};
    const res = await fetch(`${API_BASE}/ask`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        question:   contextPrompt,
        mode:       'visual_tutor',
        bookId:     'none',
        complexity: 4,        // keep answers student-friendly
        history:    [],
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data   = await res.json();
    const answer = (data.answer ?? data.response ?? data.text ?? '').trim();

    _vtpShowAskReply(answer || localFallback);

  } catch (err) {
    // Network error, auth failure, server error — use local fallback silently
    console.warn('[VTP] Ask API error, using local fallback:', err.message);
    _vtpShowAskReply(localFallback);

  } finally {
    // Always re-enable the input
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

function _vtpFadeAndDraw(key) {
  setTimeout(() => { _vtpClearCanvas(); _vtpDrawScene(key); }, 100);
}

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

function _vtpDrawScene(key) {
  if (!_vtpCtx) return;
  const cx = _vtpW / 2, cy = _vtpH / 2;
  const draw = (fn, delay) => setTimeout(fn, delay);

  if (key === 'ph_bar') {
    const bw = Math.min(_vtpW * 0.72, 500), bx = cx - bw / 2, by = cy - 30;
    draw(() => {
      const g = _vtpCtx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, '#e8433e'); g.addColorStop(0.45, '#f5c842'); g.addColorStop(1, '#4ade80');
      _vtpCtx.beginPath(); _vtpCtx.roundRect(bx, by, bw, 26, 13);
      _vtpCtx.fillStyle = g; _vtpCtx.fill();
    }, 150);
    [[0, '0'], [7, '7'], [14, '14']].forEach(([v, l], i) => draw(() => {
      const x = bx + (v / 14) * bw;
      _vtpCtx.strokeStyle = 'rgba(255,255,255,.3)'; _vtpCtx.lineWidth = 1.5;
      _vtpCtx.beginPath(); _vtpCtx.moveTo(x, by + 26); _vtpCtx.lineTo(x, by + 36); _vtpCtx.stroke();
      _vtpCtx.fillStyle = '#ededf0'; _vtpCtx.font = 'bold 13px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText(l, x, by + 50);
    }, 400 + i * 160));
    [['ACID', bx + bw * 0.1, '#f87171'], ['NEUTRAL', cx, '#2dd4bf'], ['BASE', bx + bw * 0.9, '#4ade80']].forEach(([l, x, c], i) => draw(() => {
      _vtpCtx.fillStyle = c; _vtpCtx.font = '600 11px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText(l, x, by - 14);
    }, 800 + i * 120));
    draw(() => {
      _vtpCtx.strokeStyle = 'rgba(45,212,191,.4)'; _vtpCtx.lineWidth = 1.5; _vtpCtx.setLineDash([4, 3]);
      _vtpCtx.beginPath(); _vtpCtx.moveTo(cx, by - 4); _vtpCtx.lineTo(cx, by - 32); _vtpCtx.stroke();
      _vtpCtx.setLineDash([]);
      _vtpCtx.fillStyle = '#2dd4bf'; _vtpCtx.font = '12px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText('Pure water (pH 7)', cx, by - 42);
    }, 1300);
  }

  else if (key === 'ph_ions') {
    const bx = cx - 65, by = cy - 75, bw = 130, bh = 130;
    draw(() => {
      _vtpCtx.strokeStyle = 'rgba(255,255,255,.25)'; _vtpCtx.lineWidth = 2;
      _vtpCtx.beginPath(); _vtpCtx.moveTo(bx, by); _vtpCtx.lineTo(bx, by + bh);
      _vtpCtx.lineTo(bx + bw, by + bh); _vtpCtx.lineTo(bx + bw, by); _vtpCtx.stroke();
      _vtpCtx.fillStyle = 'rgba(59,130,246,.1)'; _vtpCtx.fillRect(bx + 1, by + bh * 0.38, bw - 2, bh * 0.62 - 1);
      _vtpCtx.strokeStyle = 'rgba(96,165,250,.35)'; _vtpCtx.lineWidth = 1.5;
      _vtpCtx.beginPath(); _vtpCtx.moveTo(bx, by + bh * 0.38); _vtpCtx.lineTo(bx + bw, by + bh * 0.38); _vtpCtx.stroke();
    }, 150);
    [{ x: bx + 24, y: cy + 10 }, { x: bx + 64, y: cy + 20 }, { x: bx + 100, y: cy + 10 }, { x: bx + 44, y: cy + 38 }, { x: bx + 86, y: cy + 40 }].forEach(({ x, y }, i) => draw(() => {
      _vtpCtx.beginPath(); _vtpCtx.arc(x, y, 14, 0, Math.PI * 2);
      _vtpCtx.fillStyle = 'rgba(248,113,113,.18)'; _vtpCtx.fill();
      _vtpCtx.strokeStyle = '#f87171'; _vtpCtx.lineWidth = 1.5; _vtpCtx.stroke();
      _vtpCtx.fillStyle = '#f87171'; _vtpCtx.font = 'bold 11px sans-serif'; _vtpCtx.textAlign = 'center'; _vtpCtx.textBaseline = 'middle';
      _vtpCtx.fillText('H⁺', x, y); _vtpCtx.textBaseline = 'alphabetic';
    }, 450 + i * 150));
    draw(() => {
      _vtpCtx.fillStyle = '#e8ac2e'; _vtpCtx.font = 'bold 14px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText('More H⁺ ions → lower pH', cx, by - 18);
    }, 1300);
  }

  else if (key === 'ph_examples') {
    const items = [{ n: 'Battery\nAcid', ph: 1, c: '#e8433e' }, { n: 'Lemon\nJuice', ph: 2, c: '#f07038' }, { n: 'Coffee', ph: 5, c: '#f5c842' }, { n: 'Water', ph: 7, c: '#2dd4bf' }, { n: 'Baking\nSoda', ph: 9, c: '#82d94a' }, { n: 'Bleach', ph: 12, c: '#4ade80' }];
    const cols = items.length, cw = _vtpW / (cols + 1);
    draw(() => {
      _vtpCtx.strokeStyle = 'rgba(255,255,255,.08)'; _vtpCtx.lineWidth = 1;
      _vtpCtx.beginPath(); _vtpCtx.moveTo(cw * 0.5, cy + 48); _vtpCtx.lineTo(_vtpW - cw * 0.5, cy + 48); _vtpCtx.stroke();
    }, 100);
    items.forEach(({ n, ph, c }, i) => draw(() => {
      const x = cw * (i + 1), maxH = 110, bh = 12 + (ph / 14) * maxH, bY = cy + 48 - bh;
      _vtpCtx.fillStyle = c + '22'; _vtpCtx.strokeStyle = c + '70'; _vtpCtx.lineWidth = 1.5;
      _vtpCtx.beginPath(); _vtpCtx.roundRect(x - 18, bY, 36, bh, 4); _vtpCtx.fill(); _vtpCtx.stroke();
      _vtpCtx.fillStyle = c; _vtpCtx.font = 'bold 12px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText(ph, x, bY - 8);
      _vtpCtx.fillStyle = '#9898ae'; _vtpCtx.font = '10px sans-serif';
      n.split('\n').forEach((l, li) => _vtpCtx.fillText(l, x, cy + 62 + li * 13));
    }, 200 + i * 130));
  }

  else if (key === 'ph_buffer') {
    draw(() => {
      _vtpCtx.fillStyle = 'rgba(248,113,113,.06)'; _vtpCtx.strokeStyle = 'rgba(248,113,113,.25)'; _vtpCtx.lineWidth = 1.5;
      _vtpCtx.beginPath(); _vtpCtx.ellipse(cx, cy + 8, 155, 78, 0, 0, Math.PI * 2); _vtpCtx.fill(); _vtpCtx.stroke();
      _vtpCtx.fillStyle = 'rgba(45,212,191,.12)'; _vtpCtx.strokeStyle = 'rgba(45,212,191,.3)'; _vtpCtx.lineWidth = 1;
      _vtpCtx.beginPath(); _vtpCtx.ellipse(cx, cy + 8, 85, 42, 0, 0, Math.PI * 2); _vtpCtx.fill(); _vtpCtx.stroke();
      _vtpCtx.fillStyle = '#2dd4bf'; _vtpCtx.font = 'bold 12px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText('BUFFER', cx, cy + 6);
      _vtpCtx.fillStyle = '#9898ae'; _vtpCtx.font = '11px sans-serif'; _vtpCtx.fillText('HCO₃⁻ / H₂CO₃', cx, cy + 24);
      _vtpCtx.fillText('Blood (pH 7.4)', cx, cy - 54);
    }, 200);
    draw(() => {
      _vtpArrow(cx - 240, cy, cx - 160, cy, '#f87171', 2);
      _vtpCtx.fillStyle = '#f87171'; _vtpCtx.font = '11px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText('acid in (H⁺)', cx - 205, cy - 14);
    }, 700);
    draw(() => {
      _vtpCtx.fillStyle = '#e8ac2e'; _vtpCtx.font = 'bold 15px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText('pH stays ≈ 7.4 ✓', cx, cy + 112);
      _vtpCtx.fillStyle = '#55556a'; _vtpCtx.font = '11px sans-serif';
      _vtpCtx.fillText('Buffer absorbs the extra H⁺', cx, cy + 130);
    }, 1300);
  }

  else if (key === 'ph_summary') {
    const cards = [{ l: 'LOW pH (0–6)', s: 'Acidic · more H⁺', c: '#f87171', x: cx - 155 }, { l: 'pH 7', s: 'Neutral', c: '#2dd4bf', x: cx }, { l: 'HIGH pH (8–14)', s: 'Basic · more OH⁻', c: '#4ade80', x: cx + 155 }];
    cards.forEach(({ l, s, c, x }, i) => draw(() => {
      _vtpCtx.fillStyle = c + '15'; _vtpCtx.strokeStyle = c + '50'; _vtpCtx.lineWidth = 1.5;
      _vtpCtx.beginPath(); _vtpCtx.roundRect(x - 62, cy - 54, 124, 108, 12); _vtpCtx.fill(); _vtpCtx.stroke();
      _vtpCtx.fillStyle = c; _vtpCtx.font = 'bold 13px sans-serif'; _vtpCtx.textAlign = 'center'; _vtpCtx.fillText(l, x, cy - 16);
      _vtpCtx.fillStyle = '#9898ae'; _vtpCtx.font = '11px sans-serif'; _vtpCtx.fillText(s, x, cy + 8);
    }, 200 + i * 260));
    draw(() => {
      _vtpCtx.fillStyle = '#e8ac2e'; _vtpCtx.font = 'bold 13px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText('Buffers stabilize pH in living systems', cx, cy + 88);
    }, 1100);
  }

  else if (key === 'n_1') {
    draw(() => {
      for (let i = 0; i < 50; i++) {
        const sx = Math.random() * _vtpW, sy = Math.random() * _vtpH;
        _vtpCtx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.2})`;
        _vtpCtx.beginPath(); _vtpCtx.arc(sx, sy, 0.8, 0, Math.PI * 2); _vtpCtx.fill();
      }
      _vtpCtx.beginPath(); _vtpCtx.arc(cx - 60, cy, 28, 0, Math.PI * 2);
      _vtpCtx.fillStyle = 'rgba(96,165,250,.18)'; _vtpCtx.fill();
      _vtpCtx.strokeStyle = '#60a5fa'; _vtpCtx.lineWidth = 2; _vtpCtx.stroke();
      _vtpArrow(cx - 28, cy, cx + 120, cy, '#60a5fa', 2);
      _vtpCtx.fillStyle = '#9898ae'; _vtpCtx.font = '12px sans-serif'; _vtpCtx.textAlign = 'left';
      _vtpCtx.fillText('constant velocity', cx - 18, cy - 16);
    }, 200);
    draw(() => {
      _vtpCtx.fillStyle = '#e8ac2e'; _vtpCtx.font = 'bold 14px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText('An object in motion stays in motion', cx, cy + 80);
      _vtpCtx.fillStyle = '#55556a'; _vtpCtx.font = '12px sans-serif';
      _vtpCtx.fillText('— unless a force acts on it', cx, cy + 100);
    }, 900);
  }

  else if (key === 'n_2') {
    draw(() => {
      _vtpCtx.fillStyle = 'rgba(232,172,46,.07)'; _vtpCtx.strokeStyle = 'rgba(232,172,46,.22)'; _vtpCtx.lineWidth = 1.5;
      _vtpCtx.beginPath(); _vtpCtx.roundRect(cx - 115, cy - 52, 230, 104, 14); _vtpCtx.fill(); _vtpCtx.stroke();
      _vtpCtx.fillStyle = '#e8ac2e'; _vtpCtx.font = 'bold 44px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText('F = m × a', cx, cy + 18);
    }, 200);
    [['Force', cx - 85, '#f87171'], ['mass', cx + 5, '#60a5fa'], ['accel.', cx + 86, '#4ade80']].forEach(([l, x, c]) => draw(() => {
      _vtpCtx.fillStyle = c; _vtpCtx.font = '11px sans-serif'; _vtpCtx.textAlign = 'center'; _vtpCtx.fillText(l, x, cy + 60);
      _vtpCtx.strokeStyle = c + '60'; _vtpCtx.lineWidth = 1; _vtpCtx.setLineDash([2, 2]);
      _vtpCtx.beginPath(); _vtpCtx.moveTo(x, cy + 26); _vtpCtx.lineTo(x, cy + 48); _vtpCtx.stroke(); _vtpCtx.setLineDash([]);
    }, 500));
    draw(() => {
      _vtpCtx.fillStyle = '#9898ae'; _vtpCtx.font = '12px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText('More mass → need more force for same acceleration', cx, cy + 88);
    }, 1000);
  }

  else if (key === 'n_3') {
    draw(() => {
      [cx - 115, cx + 115].forEach((x, i) => {
        _vtpCtx.fillStyle = i === 0 ? 'rgba(248,113,113,.14)' : 'rgba(96,165,250,.14)';
        _vtpCtx.strokeStyle = i === 0 ? '#f87171' : '#60a5fa'; _vtpCtx.lineWidth = 2;
        _vtpCtx.beginPath(); _vtpCtx.roundRect(x - 22, cy - 42, 44, 84, 6); _vtpCtx.fill(); _vtpCtx.stroke();
        _vtpCtx.fillStyle = i === 0 ? '#f87171' : '#60a5fa'; _vtpCtx.font = 'bold 13px sans-serif'; _vtpCtx.textAlign = 'center';
        _vtpCtx.fillText(i === 0 ? 'YOU' : 'WALL', x, cy + 58);
      });
      _vtpArrow(cx - 90, cy, cx - 8, cy, '#e8ac2e', 2);
    }, 200);
    draw(() => {
      _vtpArrow(cx + 90, cy - 10, cx + 8, cy - 10, '#2dd4bf', 2);
      _vtpCtx.fillStyle = '#e8ac2e'; _vtpCtx.font = '11px sans-serif'; _vtpCtx.textAlign = 'center'; _vtpCtx.fillText('You push →', cx - 42, cy + 22);
      _vtpCtx.fillStyle = '#2dd4bf'; _vtpCtx.fillText('← Equal push back', cx + 20, cy - 24);
    }, 700);
    draw(() => {
      _vtpCtx.fillStyle = '#e8ac2e'; _vtpCtx.font = 'bold 14px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText('Equal & opposite — every single time', cx, cy + 96);
    }, 1200);
  }

  else if (key === 'n_all' || key === 'n_summary') {
    const laws = [{ n: 'Law 1', s: 'Inertia', c: '#60a5fa', x: cx - 140 }, { n: 'Law 2', s: 'F = ma', c: '#e8ac2e', x: cx }, { n: 'Law 3', s: 'Reaction', c: '#4ade80', x: cx + 140 }];
    laws.forEach(({ n, s, c, x }, i) => draw(() => {
      _vtpCtx.fillStyle = c + '14'; _vtpCtx.strokeStyle = c + '50'; _vtpCtx.lineWidth = 1.5;
      _vtpCtx.beginPath(); _vtpCtx.roundRect(x - 55, cy - 52, 110, 104, 12); _vtpCtx.fill(); _vtpCtx.stroke();
      _vtpCtx.fillStyle = c; _vtpCtx.font = 'bold 22px sans-serif'; _vtpCtx.textAlign = 'center'; _vtpCtx.fillText(n, x, cy - 10);
      _vtpCtx.fillStyle = '#9898ae'; _vtpCtx.font = '500 13px sans-serif'; _vtpCtx.fillText(s, x, cy + 14);
    }, 200 + i * 240));
    draw(() => {
      _vtpCtx.fillStyle = '#55556a'; _vtpCtx.font = '12px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText("Three laws explain almost every motion you've ever seen", cx, cy + 86);
    }, 1100);
  }

  else { // generic fallback
    draw(() => {
      _vtpCtx.fillStyle = 'rgba(232,172,46,.06)'; _vtpCtx.strokeStyle = 'rgba(232,172,46,.16)'; _vtpCtx.lineWidth = 1.5;
      _vtpCtx.beginPath(); _vtpCtx.roundRect(cx - 140, cy - 52, 280, 104, 16); _vtpCtx.fill(); _vtpCtx.stroke();
      _vtpCtx.fillStyle = '#ededf0'; _vtpCtx.font = 'bold 20px sans-serif'; _vtpCtx.textAlign = 'center';
      _vtpCtx.fillText(_vtpCurrentTopic, cx, cy - 10);
      _vtpCtx.fillStyle = '#55556a'; _vtpCtx.font = '13px sans-serif';
      _vtpCtx.fillText(`Step ${_vtpStepIdx + 1} of ${_vtpTotalSteps}`, cx, cy + 16);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, dx = Math.cos(a) * 110, dy = Math.sin(a) * 55;
        _vtpCtx.fillStyle = 'rgba(232,172,46,.12)';
        _vtpCtx.beginPath(); _vtpCtx.arc(cx + dx, cy + dy - 2, 5, 0, Math.PI * 2); _vtpCtx.fill();
      }
    }, 200);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// APP INTEGRATION POINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called by navigation.js on every FRESH navigation to the visual screen
 * (i.e. user clicks the Visual Tutor nav item from another screen).
 * Must return the UI to the entry screen and stop anything running.
 */
if (typeof window !== 'undefined') window._vtClear = function() {
  if (_vtpTypeTimer) clearTimeout(_vtpTypeTimer);
  if (_vtpAutoTimer)  clearTimeout(_vtpAutoTimer);
  _vtpLesson      = null;
  _vtpStepBusy    = false;
  _vtpAutoplay    = false;

  // Visually reset — clear canvas and return to entry screen
  _vtpClearCanvas();
  const inp = document.getElementById('vtp-entry-input');
  if (inp) inp.value = '';
  const sw = document.getElementById('simplified-wrap');
  if (sw) sw.style.display = 'none';
  const gr = document.getElementById('gotit-row');
  if (gr) gr.style.display = 'none';
  const ar = document.getElementById('ask-reply');
  if (ar) ar.classList.remove('open');

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
  window._navFromHistory = true;
  if (window.showScreen) window.showScreen('visual');
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
if (typeof window !== 'undefined') window._vtRestoreSession = function(sessionId, question) {
  if (window._setActiveRecent) window._setActiveRecent(sessionId);
  // Set flag so navigation doesn't immediately call _vtClear over us
  window._navFromHistory = true;
  if (window.showScreen) window.showScreen('visual');
  setTimeout(() => {
    const inp = document.getElementById('vtp-entry-input');
    if (inp && question) inp.value = question;
    _vtpShowScreen('screen-entry');
  }, 100);
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

    // Topic chips
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
        if (_vtpLesson.steps[_vtpStepIdx]) _vtpDrawScene(_vtpLesson.steps[_vtpStepIdx].draw || 'generic');
      }, 150);
    });

  }, 100);

  console.log('[VisualTutorScreen] mounted ✦');
}

if (typeof document !== 'undefined') mountVisualTutorScreen();
