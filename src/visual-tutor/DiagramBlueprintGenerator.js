/**
 * src/visual-tutor/DiagramBlueprintGenerator.js  — v2
 *
 * Converts an AI response into a validated diagram blueprint
 * that WhiteboardEngine can render.
 *
 * Flow:
 *   user question
 *     → buildPrompt(question, mode)         → string sent to /ask
 *     → parseBlueprint(rawAnswer)           → validated concept JSON
 *     → WhiteboardEngine(container, concept) → animated diagram
 *
 * Supports diagram types:
 *   whiteboard   — step-by-step SVG drawing (default)
 *   timeline     — horizontal event ribbon
 *   graph        — line or bar chart
 *   branch       — mind-map from center node
 *   container    — nested region diagram
 */

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the visual brain of an AI tutoring app called Chunks. You draw hard concepts as clean, accurate, step-by-step animated diagrams — like a teacher drawing on a whiteboard.

Output ONLY a raw JSON object. No markdown, no explanation, no code fences. Start with { end with }.

━━ SCHEMA ━━
{"steps":[{"narration":"1-2 vivid teacher sentences","pauseAfter":500,"elements":[...]}]}

━━ DIAGRAM TYPE SELECTION ━━
• whiteboard  → anatomy, biology, physics, chemistry, math concepts (DEFAULT)
• timeline    → historical events, sequences with dates
• graph       → economics, data trends, mathematical functions
• branch      → mind maps, concept hierarchies, classification
• container   → systems with named parts (cell, computer, ecosystem)

━━ SPATIAL PLANNING — DO THIS FIRST ━━
Before placing ANY element, divide the canvas into zones and assign each structure its own zone:
- Single central structure: center (220,140), radius 80-110. Labels radiate outward with 40px gap.
- Two structures side by side: LEFT zone x=30-190, RIGHT zone x=250-410. 60px gap between zones.
- Process flow A→B→C: nodes at x=70, x=220, x=370 at y=130. Arrows between, not overlapping nodes.
- NEVER give two filled shapes the same center. Every shape occupies its own exclusive zone.
- Labels ALWAYS go outside the shape they name: above (y-40), below (y+35), or beside (x±70).
- Reserve y=268-305 exclusively for the formula/fact box. No other elements in that band.

━━ OVERLAP RULES — CRITICAL ━━
- Circles and ellipses must NOT overlap unless the concept IS explicitly a Venn diagram.
- Venn diagrams only: exactly 2 circles, overlap region = 35px wide, label the intersection.
- Child shapes inside a parent: child must be fully enclosed, 20px away from parent edge.
- Arrows must NOT pass through unrelated shapes — curve around them.
- Text/labels: minimum 18px vertical gap between any two text elements. Never stack at same y.
- Maximum 3 labeled structures per step. More creates unreadable clutter.

━━ WHITEBOARD ELEMENTS ━━

1. PATH — organic shapes, curves, anatomy
{"type":"path","d":"M x y C cx1 cy1 cx2 cy2 x y","stroke":"#hex","strokeWidth":2.5,"fill":"rgba(r,g,b,0.15)","fillDuration":500,"drawDuration":900}
Use C and Q Bezier for ALL organic shapes. Never use L for curved anatomy.
Gradient: "gradient":{"stops":[{"offset":"0%","color":"#e74c3c"},{"offset":"100%","color":"#c0392b","opacity":0.4}],"dir":["0%","0%","0%","100%"]}

2. TAPERPATH — vessels, axons, tubes
{"type":"taperpath","d":"M x y C ...","stroke":"#hex","widths":[6,3,1],"alphas":[1,0.6,0.2],"drawDuration":800}

3. GLOW — signals, energy, electricity
{"type":"glow","d":"M x1 y1 L x2 y2","stroke":"rgba(155,89,182,0.9)","strokeWidth":8,"filter":"url(#wb-glow-purple)","opacity":0.7,"drawDuration":400}
filter: url(#wb-glow-purple) url(#wb-glow-orange) url(#wb-glow-blue) url(#wb-glow-green) url(#wb-glow-red) url(#wb-glow-yellow)

4. CIRCLE — cells, nuclei, nodes
{"type":"circle","cx":220,"cy":140,"r":45,"stroke":"#hex","strokeWidth":2,"fill":"rgba(r,g,b,0.2)","fillDuration":400,"drawDuration":700}

5. ELLIPSE — chambers, organelles
{"type":"ellipse","cx":220,"cy":140,"rx":70,"ry":40,"stroke":"#hex","strokeWidth":2,"fill":"rgba(r,g,b,0.15)","fillDuration":400,"drawDuration":700}

6. LINE — axes, guidelines, separators
{"type":"line","x1":100,"y1":100,"x2":300,"y2":200,"stroke":"#hex","strokeWidth":1.5,"strokeDash":"5,4","drawDuration":400}

7. ARROW — direction, force, flow
{"type":"arrow","d":"M x1 y1 C cx cy x2 y2","stroke":"#hex","strokeWidth":2.5,"markerColor":"blue","drawDuration":500}
markerColor: white green yellow blue teal orange red purple gray

8. TEXT — annotations outside shapes only
{"type":"text","x":220,"y":50,"text":"short label","size":11,"color":"#hex","anchor":"middle","duration":350}
Max 25 characters per element. Split longer labels into two TEXT elements 16px apart vertically.

9. LABEL — highlighted name pill
{"type":"label","x":220,"y":50,"text":"Structure name","size":10,"color":"#2ecc71","weight":"600","anchor":"middle","duration":300}

━━ SPECIAL ELEMENTS ━━

GRAPH: {"type":"graph","x":40,"y":30,"w":360,"h":225,"style":"line","color":"#3498db","xLabel":"x","yLabel":"y","data":[{"label":"A","value":40},{"label":"B","value":70}],"duration":700}
style: "line" or "bar"

TIMELINE: {"type":"timeline","y":140,"color":"#f1c40f","drawDuration":600,"eventDelay":220,"events":[{"label":"1789","text":"Revolution","x":80},{"label":"1793","text":"Terror","x":220}]}

BRANCH: {"type":"branch","cx":220,"cy":125,"label":"Topic","color":"#9b59b6","r":28,"radius":100,"fill":"rgba(155,89,182,0.15)","branches":[{"label":"A","color":"#3498db"},{"label":"B","color":"#2ecc71"}]}

CONTAINER: {"type":"container","x":30,"y":25,"w":380,"h":225,"label":"Cell","color":"#2ecc71","rx":16,"fill":"rgba(46,204,113,0.05)","strokeWidth":1.5}

PARTICLE_FLOW: {"type":"particle_flow","d":"M 60 140 Q 220 75 380 140","color":"#3498db","count":8,"size":4,"speed":2000}

━━ CANVAS ━━
440x310 px. Safe zone: x 25-415, y 25-260. Center: (220,140). Formula box: y 268-305 only.

━━ COLORS ━━
#AFA9EC = neural/neuron     #2ecc71 = membrane/healthy   #f1c40f = energy/synapse
#3498db = water/oxygen      #1abc9c = active transport   #e67e22 = heat/kinetic
#e74c3c = blood/force/alert #9b59b6 = chemistry/brain    #c0392b = deoxygenated
#c8d6e5 = labels/text       #f39c12 = demand/warning     #27ae60 = supply/growth

━━ STEP STRUCTURE ━━
Step 1: outer boundary ONLY — one large shape with light fill. Absolutely nothing else in this step.
Step 2: 2-3 internal sub-structures, each in its own non-overlapping zone.
Step 3: connections and flow paths between structures. Route arrows to avoid crossing shapes.
Step 4: directional arrows + glow on active signal paths showing the mechanism.
Step 5: labels — one per structure, placed outside with clear breathing room.
Step 6: formula box (y=268-305) + one concise key fact sentence.
Total: 5-6 steps. Max 7 elements per step.

━━ ACCURACY EXAMPLES — FOLLOW THESE EXACTLY ━━
Brain tumor: brain=large organic path (cx=220,cy=130). Tumor=circle INSIDE brain, offset right (cx=275,cy=120,r=48). Edema=dashed circle same center as tumor (r=68). Arrows radiate outward from tumor. Labels outside: "Tumor mass" "Edema zone" "Healthy cortex".
Heart: 4 chambers as 4 SEPARATE path regions — RA top-right of center, LA top-left, RV bottom-right, LV bottom-left. NOT overlapping circles.
Neuron: cell body=ellipse (cx=85,cy=140,rx=40,ry=30). Axon=taperpath from x=125 to x=370. Synaptic bulb=circle (cx=385,cy=140,r=14). All at same y-level, left to right.
Quadratic equation: use GRAPH type. Parabola data points, label vertex and x-intercepts. Do NOT use circles.
Cell: outer membrane=large ellipse (cx=220,cy=135,rx=165,ry=105). Nucleus=circle (cx=185,cy=125,r=38) inside. Mitochondria=small ellipses (rx=22,ry=11) at (300,110) (310,160) (275,185) — all inside outer membrane.
`;

// ── Prompt builder ────────────────────────────────────────────────────────────

/**
 * Build the full prompt string to send to /ask
 * @param {string} question  — user's question
 * @param {string} [hint]    — optional diagram type hint: 'whiteboard'|'timeline'|'graph'|'branch'|'container'
 */
export function buildDiagramPrompt(question, hint = '') {
  // The type instruction goes BEFORE the system prompt so the AI sees it first.
  // A buried hint at the bottom of 200 lines gets ignored — this does not.
  const typeOverride = hint && hint !== 'whiteboard'
    ? `MANDATORY DIAGRAM TYPE: "${hint}" — You MUST use the ${hint.toUpperCase()} format. Do NOT use whiteboard elements. Use ONLY the special element for type "${hint}" as defined below.\n\n`
    : '';
  return `${typeOverride}${SYSTEM_PROMPT}\n\nTopic: "${question}"\n\nOutput the JSON now:`;
}

// ── Auto-detect diagram type from question ────────────────────────────────────

// Explicit-intent patterns — checked FIRST. If the user literally says
// "graph", "chart", "timeline", "mind map" etc. we honour that word
// unconditionally. These override any subject-based guesses below.
const EXPLICIT_TYPE_PATTERNS = [
  { type: 'graph',    patterns: [/\b(graph|bar chart|line chart|pie chart|chart|plot|histogram|scatter)\b/i] },
  { type: 'timeline', patterns: [/\b(timeline|time.?line|chronolog|sequence of events)\b/i] },
  { type: 'branch',   patterns: [/\b(mind.?map|concept.?map|tree diagram|branch)\b/i] },
  { type: 'container',patterns: [/\b(diagram of|label.*(parts|organs)|annotate)\b/i] },
];

// Subject-based fallback patterns — only used when no explicit intent found
const SUBJECT_TYPE_PATTERNS = [
  { type: 'timeline', patterns: [/histor/i, /revolution/i, /\bwar\b/i, /century/i, /evolution of/i, /history of/i, /\d{4}s?\b/] },
  { type: 'graph',    patterns: [/supply.demand/i, /\beconomics\b/i, /\bmarket\b/i, /\bprice\b/i, /growth rate/i, /\bcurve\b/i] },
  { type: 'branch',   patterns: [/\btypes of\b/i, /\bcategories\b/i, /\bclassification\b/i, /\boverview of\b/i, /\bkinds of\b/i] },
  { type: 'container',patterns: [/\binside\b/i, /structure of\b/i, /parts of\b/i, /anatomy of\b/i, /\bcomponents\b/i] },
];

export function detectDiagramType(question) {
  // 1. Explicit intent wins unconditionally
  for (const { type, patterns } of EXPLICIT_TYPE_PATTERNS) {
    if (patterns.some(p => p.test(question))) return type;
  }
  // 2. Subject-based fallback
  for (const { type, patterns } of SUBJECT_TYPE_PATTERNS) {
    if (patterns.some(p => p.test(question))) return type;
  }
  return 'whiteboard';
}

// ── Blueprint parser / validator ──────────────────────────────────────────────

const ALLOWED_TYPES = new Set([
  'path','circle','ellipse','line','arrow','text','label',
  'taperpath','glow','group',
  'graph','timeline','branch','container','particle_flow',
]);

/**
 * Parse and validate the raw AI JSON string into a concept object.
 * @param {string} raw  — raw string from /ask response
 * @returns {{ steps: Array }|null}
 */
export function parseBlueprint(raw) {
  if (!raw) return null;

  let cleaned = raw.trim();

  // Strip markdown fences
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fence) cleaned = fence[1];

  // Extract first {...} block
  const brace = cleaned.indexOf('{');
  const last  = cleaned.lastIndexOf('}');
  if (brace >= 0 && last > brace) cleaned = cleaned.slice(brace, last + 1);

  let concept;
  try {
    concept = JSON.parse(cleaned);
  } catch (_) {
    // Last resort: regex extract
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { concept = JSON.parse(match[0]); } catch { return null; }
  }

  return sanitise(concept);
}

function sanitise(concept) {
  if (!concept || !Array.isArray(concept.steps)) return null;

  concept.steps = concept.steps.map(step => {
    if (!step || !Array.isArray(step.elements)) return null;

    step.elements = step.elements.filter(el => el && ALLOWED_TYPES.has(el.type));

    // Clamp numeric fields
    step.pauseAfter = clamp(Number(step.pauseAfter) || 500, 200, 3000);

    // Validate per-element required fields
    step.elements = step.elements.filter(el => {
      try {
        switch (el.type) {
          case 'path':      return typeof el.d === 'string' && el.d.length > 0;
          case 'taperpath': return typeof el.d === 'string' && el.d.length > 0;
          case 'glow':      return typeof el.d === 'string' && el.d.length > 0;
          case 'arrow':     return typeof el.d === 'string' && el.d.length > 0;
          case 'circle':    return isFinite(el.cx) && isFinite(el.cy) && isFinite(el.r) && el.r > 0;
          case 'ellipse':   return isFinite(el.cx) && isFinite(el.cy) && isFinite(el.rx) && isFinite(el.ry);
          case 'line':      return isFinite(el.x1) && isFinite(el.y1) && isFinite(el.x2) && isFinite(el.y2);
          case 'text':      return typeof el.text === 'string' && isFinite(el.x) && isFinite(el.y);
          case 'label':     return typeof el.text === 'string' && isFinite(el.x) && isFinite(el.y);
          case 'graph':     return Array.isArray(el.data) && el.data.length > 0;
          case 'timeline':  return Array.isArray(el.events) && el.events.length > 0;
          case 'branch':    return Array.isArray(el.branches);
          case 'container': return isFinite(el.x) && isFinite(el.y) && isFinite(el.w) && isFinite(el.h);
          case 'particle_flow': return typeof el.d === 'string';
          default:          return true;
        }
      } catch { return false; }
    });

    return step;
  }).filter(Boolean);

  return concept.steps.length ? concept : null;
}

function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

// ── Intro narration prompt ────────────────────────────────────────────────────

/**
 * Build the prompt for a 2-3 sentence intro before the diagram starts.
 */
export function buildIntroPrompt(question) {
  return `In 2-3 vivid sentences introduce "${question}" to a student. End with: I'll draw it step by step. Max 50 words. No bullet points.`;
}
