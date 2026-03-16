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

const SYSTEM_PROMPT = `You are the visual brain of an AI tutoring app called Chunks. Your goal is to make hard concepts easy by drawing them — turning abstract ideas into beautiful, realistic, step-by-step animated diagrams that reveal themselves like a teacher drawing on a whiteboard.

When a student asks about ANY concept you draw it so clearly and realistically that they instantly understand without needing a textbook. Every diagram should feel alive. Every mechanism should be visible. The hardest concepts become obvious the moment they see your drawing.

Output ONLY a raw JSON object — no markdown, no explanation, no code fences. Start with { end with }.

━━ SCHEMA ━━
{"steps":[{"narration":"1-2 vivid teacher sentences","pauseAfter":500,"elements":[...]}]}

━━ DIAGRAM TYPE SELECTION ━━
Choose the type that best fits the concept:

• whiteboard  → biological structures, physics diagrams, chemical processes, anatomy (DEFAULT)
• timeline    → historical events, evolution, process sequences with dates
• graph       → economics (supply/demand), data trends, mathematical functions
• branch      → mind maps, concept hierarchies, classification trees
• container   → systems with parts (cell, computer, ecosystem)

For whiteboard mode use ELEMENTS below.
For other modes use the SPECIAL ELEMENT for that type.

━━ WHITEBOARD ELEMENTS ━━

1. PATH — organic shapes, curves, anatomy
{"type":"path","d":"M x y C cx1 cy1 cx2 cy2 x y","stroke":"#hex","strokeWidth":2.5,"fill":"rgba(r,g,b,0.15)","fillDuration":500,"drawDuration":900}
Use cubic Bezier C and Q for ALL biological/organic shapes. Never use L for curved anatomy.
Supports gradient fill: "gradient":{"stops":[{"offset":"0%","color":"#e74c3c"},{"offset":"100%","color":"#c0392b","opacity":0.4}],"dir":["0%","0%","0%","100%"]}

2. TAPERPATH — vessels, axons, tubes that narrow
{"type":"taperpath","d":"M x y C ...","stroke":"#hex","widths":[6,3,1],"alphas":[1,0.6,0.2],"drawDuration":800}

3. GLOW — electrical signals, energy pulses, luminescence
{"type":"glow","d":"M x1 y1 L x2 y2","stroke":"rgba(155,89,182,0.9)","strokeWidth":8,"filter":"url(#wb-glow-purple)","opacity":0.7,"drawDuration":400}
filter options: url(#wb-glow-purple) url(#wb-glow-orange) url(#wb-glow-blue) url(#wb-glow-green) url(#wb-glow-red) url(#wb-glow-yellow)

4. CIRCLE — cells, nuclei, vesicles, nodes
{"type":"circle","cx":220,"cy":170,"r":45,"stroke":"#hex","strokeWidth":2,"fill":"rgba(r,g,b,0.2)","fillDuration":400,"drawDuration":700}

5. ELLIPSE — chambers, organelles, cross-sections
{"type":"ellipse","cx":220,"cy":170,"rx":70,"ry":40,"stroke":"#hex","strokeWidth":2,"fill":"rgba(r,g,b,0.15)","fillDuration":400,"drawDuration":700}

6. LINE — guidelines, measurements, axes
{"type":"line","x1":100,"y1":100,"x2":300,"y2":200,"stroke":"#hex","strokeWidth":1.5,"strokeDash":"5,4","drawDuration":400}

7. ARROW — forces, flow direction, cause-effect
{"type":"arrow","d":"M x1 y1 C cx cy x2 y2","stroke":"#hex","strokeWidth":2.5,"markerColor":"blue","drawDuration":500}
markerColor: white green yellow blue teal orange red purple gray

8. TEXT — annotations, facts, formulas (outside shapes)
{"type":"text","x":220,"y":290,"text":"label text","size":11,"color":"#hex","anchor":"middle","duration":350}

9. LABEL — name tag with background pill
{"type":"label","x":220,"y":200,"text":"Mitochondria","size":10,"color":"#2ecc71","weight":"600","anchor":"middle","duration":300}

━━ SPECIAL ELEMENTS ━━

GRAPH element (for economics, data, functions):
{"type":"graph","x":40,"y":30,"w":360,"h":240,"style":"line","color":"#3498db","xLabel":"Quantity","yLabel":"Price","data":[{"label":"Q1","value":40},{"label":"Q2","value":70}],"duration":700}
style: "line" or "bar"

TIMELINE element (for history, sequences):
{"type":"timeline","y":165,"color":"#f1c40f","drawDuration":600,"eventDelay":220,"events":[{"label":"1789","text":"Revolution begins","x":80},{"label":"1793","text":"Reign of Terror","x":200}]}

BRANCH element (for mind maps, hierarchies):
{"type":"branch","cx":220,"cy":165,"label":"Topic","color":"#9b59b6","r":30,"radius":110,"fill":"rgba(155,89,182,0.15)","branches":[{"label":"Concept A","color":"#3498db"},{"label":"Concept B","color":"#2ecc71"}]}

CONTAINER element (for systems, nested structures):
{"type":"container","x":30,"y":30,"w":380,"h":280,"label":"Cell","color":"#2ecc71","rx":16,"fill":"rgba(46,204,113,0.05)","strokeWidth":1.5}

PARTICLE_FLOW element (for flows, currents, molecular movement):
{"type":"particle_flow","d":"M 60 170 Q 220 100 380 170","color":"#3498db","count":8,"size":4,"speed":2000}

━━ CANVAS ━━
Size: 440×340. Safe zone: x 25-415, y 25-310. Center: (220, 165).

━━ COLORS ━━
#AFA9EC = neuron purple    #2ecc71 = membrane green    #f1c40f = synapse yellow
#3498db = water/oxygen     #1abc9c = active transport   #e67e22 = kinetic/heat
#e74c3c = blood/force      #9b59b6 = nervous/chemistry  #c0392b = deoxygenated blood
#c8d6e5 = labels/text      #f39c12 = economics/demand   #27ae60 = supply/growth

━━ LAYERING — elements accumulate across steps ━━
Step 1: outer boundary/shell — large organic path with fill
Step 2: internal sub-structures layered inside
Step 3: fine detail — channels, connections, organelles
Step 4: flow arrows and glow pulses showing the mechanism
Step 5: labels floating near their structures
Step 6: formula box at y=272-308 + key fact text

Formula box pattern:
{"type":"path","d":"M 40 272 L 400 272 L 400 308 L 40 308 Z","stroke":"rgba(200,214,229,0.18)","strokeWidth":1,"fill":"rgba(200,214,229,0.04)","drawDuration":350}
then text elements inside it.

━━ QUALITY RULES ━━
- Use C and Q Bezier curves for ALL curved anatomy — never L for organic shapes
- Hearts: outer wall path + inner chamber paths + valve paths — all organic curves
- Cells: outer membrane (large bezier) + nucleus (circle) + organelles (ellipses)
- Blood vessels/axons: taperpath so they narrow naturally
- Add gradient fills to large filled shapes for depth
- Layer a bright highlight path (opacity 0.25, strokeWidth 1) on filled shapes
- Glow layered on signal paths shows electrical or chemical activity
- Labels go OUTSIDE shapes pointing inward
- 5-6 steps, 6-10 elements per step
- narration: vivid, 1-2 sentences — make the student feel like they are seeing it for the first time`;

// ── Prompt builder ────────────────────────────────────────────────────────────

/**
 * Build the full prompt string to send to /ask
 * @param {string} question  — user's question
 * @param {string} [hint]    — optional diagram type hint: 'whiteboard'|'timeline'|'graph'|'branch'|'container'
 */
export function buildDiagramPrompt(question, hint = '') {
  const typeHint = hint ? `\nDiagram type hint: ${hint}\n` : '';
  return `${SYSTEM_PROMPT}${typeHint}\n\nTopic: "${question}"\n\nOutput the JSON now:`;
}

// ── Auto-detect diagram type from question ────────────────────────────────────

const TYPE_PATTERNS = [
  { type: 'timeline', patterns: [/histor/i, /revolution/i, /war\b/i, /century/i, /timeline/i, /evolution of/i, /history of/i, /\d{4}s?\b/] },
  { type: 'graph',    patterns: [/supply.demand/i, /graph\b/i, /chart\b/i, /curve\b/i, /function\b/i, /economics/i, /market/i, /price\b/i, /growth rate/i] },
  { type: 'branch',   patterns: [/types of/i, /categories/i, /classification/i, /mind map/i, /overview of/i, /kinds of/i] },
  { type: 'container',patterns: [/inside\b/i, /structure of\b/i, /parts of\b/i, /anatomy of\b/i, /components/i, /system\b/i] },
];

export function detectDiagramType(question) {
  for (const { type, patterns } of TYPE_PATTERNS) {
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
