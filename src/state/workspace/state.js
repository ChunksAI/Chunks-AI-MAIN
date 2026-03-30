// @ts-nocheck
/**
 * src/state/workspace/state.js — Shared mutable state + constants
 *
 * Every workspace domain file imports `ws` and reads / writes properties
 * on it instead of using module-level `let` variables.
 */

// ── Book metadata ──────────────────────────────────────────────────────────

export const wsBookMeta = {
  // Chemistry
  zumdahl:  { name: 'General Chemistry',              author: 'Zumdahl & Zumdahl' },
  atkins:   { name: 'Physical Chemistry',             author: 'Atkins & de Paula' },
  klein:    { name: 'Organic Chemistry',              author: 'David Klein' },
  harris:   { name: 'Quantitative Chemical Analysis', author: 'Daniel C. Harris' },
  // Biology
  berg:     { name: 'Biochemistry',                   author: 'Berg, Tymoczko & Stryer' },
  biochem:  { name: 'Biochemistry',                   author: 'Berg, Tymoczko & Stryer' },
  anaphy2e: { name: 'Anatomy & Physiology',           author: 'Patton & Thibodeau' },
  biology2e:{ name: 'Biology',                        author: 'OpenStax' },
  // Anatomy / Nursing
  netter:   { name: 'Atlas of Human Anatomy',         author: 'Frank H. Netter' },
  'nursing-skills-2e': { name: 'Nursing Skills',      author: 'OpenStax' },
  // Physics
  physics2e:{ name: 'College Physics',                author: 'OpenStax' },
  // Psychology
  psychology2e: { name: 'Psychology',                 author: 'OpenStax' },
};

// ── Zoom constants ─────────────────────────────────────────────────────────

export const ZOOM_STEP = 0.2, ZOOM_MIN = 0.6, ZOOM_MAX = 3.0;

// ── Per-book fallback outlines ─────────────────────────────────────────────

export const _wsBookOutlines = {
  atkins: [
    { title:'1. The Properties of Gases',    page:1,   level:0 },
    { title:'2. The First Law',              page:45,  level:0 },
    { title:'3. The Second & Third Laws',    page:87,  level:0 },
    { title:'3A. Entropy',                   page:88,  level:1 },
    { title:'3B. Entropy Changes',           page:98,  level:1 },
    { title:'3C. Concentrating on System',   page:109, level:1 },
    { title:'4. Physical Transformations',   page:131, level:0 },
    { title:'5. Simple Mixtures',            page:159, level:0 },
    { title:'6. Chemical Equilibrium',       page:199, level:0 },
    { title:'7. Quantum Theory',             page:239, level:0 },
    { title:'8. Atomic Structure',           page:285, level:0 },
    { title:'9. Molecular Structure',        page:321, level:0 },
    { title:'10. Molecular Symmetry',        page:371, level:0 },
    { title:'11. Molecular Spectroscopy',    page:399, level:0 },
    { title:'12. Statistical Thermodynamics',page:455, level:0 },
    { title:'13. Molecules in Motion',       page:503, level:0 },
    { title:'14. Chemical Kinetics',         page:543, level:0 },
    { title:'15. Reaction Dynamics',         page:591, level:0 },
    { title:'16. Magnetic Resonance',        page:631, level:0 },
  ],
  zumdahl: [
    { title:'1. Chemical Foundations',       page:1,   level:0 },
    { title:'2. Atoms, Molecules, Ions',     page:37,  level:0 },
    { title:'3. Stoichiometry',              page:79,  level:0 },
    { title:'4. Types of Chemical Reactions',page:127, level:0 },
    { title:'5. Gases',                      page:183, level:0 },
    { title:'6. Thermochemistry',            page:237, level:0 },
    { title:'7. Atomic Structure',           page:281, level:0 },
    { title:'8. Bonding: General Concepts',  page:329, level:0 },
    { title:'9. Covalent Bonding: Orbitals', page:379, level:0 },
    { title:'10. Liquids and Solids',        page:417, level:0 },
    { title:'11. Properties of Solutions',   page:461, level:0 },
    { title:'12. Chemical Kinetics',         page:505, level:0 },
    { title:'13. Chemical Equilibrium',      page:555, level:0 },
    { title:'14. Acids and Bases',           page:601, level:0 },
    { title:'15. Acid-Base Equilibria',      page:647, level:0 },
    { title:'16. Solubility Equilibria',     page:695, level:0 },
    { title:'17. Spontaneity, Entropy, Free Energy', page:731, level:0 },
    { title:'18. Electrochemistry',          page:779, level:0 },
  ],
};

// ── Shared mutable state ───────────────────────────────────────────────────

export const ws = {
  pdfDoc:        null,
  scale:         1.0,
  currentPage:   1,
  totalPages:    0,
  pageContainers: [],
  resizeObserver: null,
  resizeRaf:      0,

  bookId:        (window._memGet ? window._memGet('chunks_default_book', null) : null),
  chatHistory:   [],
  newChatIsIncognito: false,
  typing:        false,
  webSearch:     false,
  thinking:      'off',   // 'off' | 'think' | 'deep'
  selectedText:  '',      // text highlighted in PDF — sent as context with next question
  userDocId:     null,    // id of user-uploaded doc currently open (null = textbook mode)
  userDocText:   '',      // full extracted text of user doc — sent to /ask as doc_context

  outlineFlat:   [],

  attachments:     [],
  homeAttachments: [],
};
