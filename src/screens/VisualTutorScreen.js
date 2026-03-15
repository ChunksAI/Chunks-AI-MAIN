/**
 * src/screens/VisualTutorScreen.js
 *
 * Visual AI Tutor — a living whiteboard that draws concepts as it explains them.
 * Left: animated SVG canvas. Right: AI chat panel.
 *
 * Architecture:
 *   • 50 pre-built SVG animations for common topics (zero cost)
 *   • AI fallback via /ask endpoint for unknown topics
 *   • Accessible from flashcard Hard rating and sidebar
 */

// ── HTML ──────────────────────────────────────────────────────────────────────

const VT_HTML = `
<div class="screen" id="screen-visual" style="display:none;">
  <aside class="sidebar" data-sidebar-screen="visual"></aside>
  <main class="vt-main">

    <div class="vt-topbar">
      <button class="vt-back-btn" data-action="_vtBack">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
        Back
      </button>
      <div class="vt-title">
        <div class="vt-live-dot"></div>
        Visual Tutor
      </div>
      <button class="vt-clear-btn" data-action="_vtClear">Clear canvas</button>
    </div>

    <div class="vt-body">

      <!-- LEFT: Live canvas -->
      <div class="vt-canvas-panel">
        <div class="vt-canvas-label">
          <div class="vt-canvas-dot" id="vt-canvas-dot"></div>
          <span id="vt-canvas-topic">Waiting for a concept...</span>
        </div>
        <div class="vt-canvas-area" id="vt-canvas-area">
          <svg id="vt-svg" viewBox="0 0 440 340" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <text x="220" y="155" text-anchor="middle" font-size="14" fill="var(--text-4)" font-family="var(--font-body)">Ask me to explain anything</text>
            <text x="220" y="178" text-anchor="middle" font-size="12" fill="var(--text-4)" font-family="var(--font-body)" opacity="0.6">I'll draw it here as I explain</text>
          </svg>
        </div>
        <div class="vt-canvas-footer">
          <div class="vt-quick-pills" id="vt-quick-pills">
            <span class="vt-pills-label">Try:</span>
            <button class="vt-pill" data-action="_vtAskPill-self" data-query="explain osmosis">Osmosis</button>
            <button class="vt-pill" data-action="_vtAskPill-self" data-query="show me the heart pumping blood">Heart</button>
            <button class="vt-pill" data-action="_vtAskPill-self" data-query="explain action potential">Neuron</button>
            <button class="vt-pill" data-action="_vtAskPill-self" data-query="show me mitosis">Mitosis</button>
            <button class="vt-pill" data-action="_vtAskPill-self" data-query="explain photosynthesis">Photosynthesis</button>
            <button class="vt-pill" data-action="_vtAskPill-self" data-query="show me DNA replication">DNA</button>
            <button class="vt-pill" data-action="_vtAskPill-self" data-query="explain how vaccines work">Vaccines</button>
            <button class="vt-pill" data-action="_vtAskPill-self" data-query="show me ohms law">Ohm's law</button>
          </div>
        </div>
      </div>

      <!-- RIGHT: Chat panel -->
      <div class="vt-chat-panel">
        <div class="vt-chat-msgs" id="vt-chat-msgs">
          <div class="vt-msg vt-msg-ai">
            <div class="vt-avatar">AI</div>
            <div class="vt-bubble">Hi! I'm your visual tutor. Ask me to explain any concept — I'll draw it on the canvas as I talk. Try "explain osmosis" or tap a concept on the left.</div>
          </div>
        </div>
        <div class="vt-chat-input-row">
          <input class="vt-input" id="vt-input" placeholder="Ask me to explain anything..." />
          <button class="vt-send-btn" id="vt-send-btn" data-action="_vtSendInput">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>

    </div>
  </main>
</div>
`;

// ── CSS animations shared across all scenes ────────────────────────────────

const VT_ANIMS = `
@keyframes vt-fi   { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
@keyframes vt-steam{ 0%{opacity:0.7;transform:translateY(0) scaleX(1)} 100%{opacity:0;transform:translateY(-32px) scaleX(1.6)} }
@keyframes vt-glow { 0%,100%{opacity:0.2} 50%{opacity:0.7} }
@keyframes vt-flow { from{stroke-dashoffset:100} to{stroke-dashoffset:0} }
@keyframes vt-bob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
@keyframes vt-pulse{ 0%,100%{transform:scale(1);opacity:0.5} 50%{transform:scale(1.18);opacity:1} }
@keyframes vt-zap  { from{stroke-dashoffset:220} to{stroke-dashoffset:0} }
@keyframes vt-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes vt-grow { from{transform:scaleY(0)} to{transform:scaleY(1)} }
@keyframes vt-dash { to{stroke-dashoffset:0} }
`;

// ── Scene library — 50 concepts ──────────────────────────────────────────────

const VT_SCENES = [

  // ── BIOLOGY ──────────────────────────────────────────────────────────────

  {
    id: 'osmosis',
    keywords: ['osmosis','membrane','diffusion','concentration','solute','water.*flow'],
    topic: 'Osmosis',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<rect x="25" y="45" width="390" height="210" rx="12" fill="none" stroke="var(--border-xs)" stroke-width="1.5"/>
<line x1="220" y1="45" x2="220" y2="255" stroke="var(--border-sm)" stroke-width="3" stroke-dasharray="8,5"/>
<text x="122" y="38" text-anchor="middle" font-size="11" fill="#378ADD" font-family="var(--font-body)" font-weight="500">High water</text>
<text x="318" y="38" text-anchor="middle" font-size="11" fill="#D85A30" font-family="var(--font-body)" font-weight="500">Low water</text>
${[[55,75],[80,120],[55,168],[115,88],[95,145],[140,175],[70,198],[135,112]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="8" fill="#85B7EB" opacity="0.85" style="animation:vt-bob ${0.8+i*0.09}s ease-in-out ${i*0.07}s infinite"/>`).join('')}
${[[248,72],[275,128],[305,172],[330,98],[255,198],[325,145]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="8" fill="#85B7EB" opacity="0.85" style="animation:vt-bob ${0.9+i*0.1}s ease-in-out ${i*0.1}s infinite"/>`).join('')}
${[85,118,151,184].map((y,i)=>`<path d="M205 ${y} L235 ${y}" stroke="#378ADD" stroke-width="2" fill="none" style="stroke-dasharray:14,10;animation:vt-flow 1.3s linear ${i*0.28}s infinite" marker-end="url(#va1)"/>`).join('')}
<defs><marker id="va1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#378ADD" stroke-width="2"/></marker></defs>
<text x="220" y="282" text-anchor="middle" font-size="11" fill="var(--text-3)" font-family="var(--font-body)">Water moves: HIGH → LOW concentration</text>
</g>`,
        text: "Osmosis is the movement of water molecules across a semi-permeable membrane — from where there's MORE water to where there's LESS. The dashed line is the membrane. It lets tiny water molecules pass but blocks bigger dissolved molecules. Watch the arrows: water always flows down its concentration gradient. This is how plant roots absorb water, how your kidneys reabsorb fluid, and why salty food makes you thirsty."
      };
    }
  },

  {
    id: 'heart',
    keywords: ['heart','pump','blood','cardiac','circulation','ventricle','atrium','coronary'],
    topic: 'Heart & Blood Circulation',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<path d="M220 88 Q185 70 162 98 Q139 126 162 154 L220 220 L278 154 Q301 126 278 98 Q255 70 220 88Z" fill="#c0392b" opacity="0.9"/>
<line x1="202" y1="116" x2="202" y2="172" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
<line x1="238" y1="116" x2="238" y2="172" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
<text x="188" y="150" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.9)" font-family="var(--font-body)">L</text>
<text x="252" y="150" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.9)" font-family="var(--font-body)">R</text>
${[0,1,2].map(i=>`<circle cx="220" cy="154" r="${30+i*24}" fill="none" stroke="#e74c3c" stroke-width="0.8" opacity="${0.45-i*0.12}" style="animation:vt-pulse 1.1s ease-out ${i*0.28}s infinite"/>`).join('')}
${[
  {d:"M168 92 Q128 55 125 28",c:"#3498db",lx:108,ly:20,l:"→ Lungs"},
  {d:"M272 92 Q312 55 315 28",c:"#e74c3c",lx:332,ly:20,l:"← Lungs"},
  {d:"M175 218 Q142 255 142 282",c:"#3498db",lx:122,ly:290,l:"→ Body"},
  {d:"M265 218 Q298 255 298 282",c:"#e74c3c",lx:318,ly:290,l:"← Body"},
].map(({d,c,lx,ly,l})=>`<path d="${d}" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" style="stroke-dasharray:65;animation:vt-flow 1.7s linear infinite"/><text x="${lx}" y="${ly}" text-anchor="middle" font-size="9" fill="${c}" font-family="var(--font-body)">${l}</text>`).join('')}
</g>`,
        text: "Your heart beats 100,000 times a day without stopping. The RIGHT side receives dark, oxygen-poor blood from the body and pumps it to the lungs. The LEFT side receives bright red, oxygen-rich blood back from the lungs and pumps it powerfully out to the whole body. The left side is thicker and stronger because it has to push blood all the way to your toes. The pulse rings show each heartbeat — lub (valves closing) then dub (valves closing again)."
      };
    }
  },

  {
    id: 'neuron',
    keywords: ['neuron','nerve','action.*potential','axon','synapse','fire','depolariz','signal.*brain'],
    topic: 'Neuron & Action Potential',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<circle cx="78" cy="165" r="38" fill="#AFA9EC" opacity="0.85"/>
<text x="78" y="169" text-anchor="middle" font-size="10" fill="#26215C" font-family="var(--font-body)" font-weight="500">Cell body</text>
${[[40,130],[38,175],[45,215],[30,155]].map(([x,y])=>`<line x1="${78+Math.sign(x-78)*32}" y1="${y}" x2="${x}" y2="${y}" stroke="#AFA9EC" stroke-width="1.8" opacity="0.5"/>`).join('')}
<path d="M116 165 L340 165" stroke="#7F77DD" stroke-width="6" fill="none" stroke-linecap="round"/>
<path d="M116 165 L340 165" stroke="white" stroke-width="2" fill="none" style="stroke-dasharray:20,16;animation:vt-zap 0.65s linear infinite"/>
<circle cx="365" cy="165" r="22" fill="#EF9F27" opacity="0.9"/>
<text x="365" y="169" text-anchor="middle" font-size="9" fill="#412402" font-family="var(--font-body)" font-weight="500">Synapse</text>
<text x="228" y="128" text-anchor="middle" font-size="10" fill="#534AB7" font-family="var(--font-body)">← Axon →</text>
<text x="228" y="220" text-anchor="middle" font-size="11" fill="var(--text-3)" font-family="var(--font-body)">Signal speed: up to 120 m/s</text>
<text x="228" y="240" text-anchor="middle" font-size="10" fill="var(--text-4)" font-family="var(--font-body)">Na⁺ rushes in → K⁺ flows out → wave moves</text>
</g>`,
        text: "An action potential is an electrical signal that fires along a neuron. Sodium ions (Na⁺) rush INTO the cell, making it briefly positive — this is depolarization. Then potassium (K⁺) rushes OUT to reset it — repolarization. This creates a domino wave traveling at up to 120 meters per second down the axon. When it hits the synapse, neurotransmitter chemicals are released to trigger the next neuron. Every thought, movement, and sensation you have right now is this happening millions of times simultaneously."
      };
    }
  },

  {
    id: 'mitosis',
    keywords: ['mitosis','cell.*divis','chromosome','replicate','daughter.*cell','prophase','metaphase','anaphase'],
    topic: 'Mitosis — Cell Division',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
${[{x:75,n:'Prophase'},{x:220,n:'Metaphase'},{x:365,n:'Anaphase'}].map(({x,n},i)=>{
  let inner = '';
  if(i===0){
    inner=`<ellipse cx="${x}" cy="130" rx="25" ry="25" fill="#9FE1CB" opacity="0.5"/><path d="M${x-14} 118 Q${x} 107 ${x+14} 118 Q${x} 128 ${x-14} 118Z" fill="#0F6E56" opacity="0.85"/><path d="M${x-14} 142 Q${x} 153 ${x+14} 142 Q${x} 132 ${x-14} 142Z" fill="#0F6E56" opacity="0.85"/>`;
  } else if(i===1){
    inner=`<line x1="${x-40}" y1="130" x2="${x+40}" y2="130" stroke="#ccc" stroke-width="0.8" stroke-dasharray="3,2"/>` + [-1,1].map(j=>`<ellipse cx="${x+j*14}" cy="130" rx="9" ry="17" fill="#0F6E56" opacity="0.85"/>`).join('');
  } else {
    inner=[-1,1].map(j=>`<ellipse cx="${x+j*24}" cy="${130+j*6}" rx="9" ry="15" fill="#0F6E56" opacity="0.85"/><line x1="${x}" y1="130" x2="${x+j*22}" y2="${130+j*5}" stroke="#bbb" stroke-width="1" stroke-dasharray="2,2"/>`).join('');
  }
  return `<ellipse cx="${x}" cy="130" rx="48" ry="58" fill="none" stroke="var(--border-sm)" stroke-width="1.5" style="animation:vt-fi 0.4s ease ${i*0.15}s both"/>${inner}<text x="${x}" y="210" text-anchor="middle" font-size="11" fill="var(--text-1)" font-family="var(--font-body)" font-weight="500">${n}</text>`;
}).join('')}
${[-1,1].map((j,i)=>`<ellipse cx="${60+i*320}" cy="272" rx="32" ry="27" fill="#9FE1CB" opacity="0.45" style="animation:vt-fi 0.5s ease 0.5s both"/><ellipse cx="${60+i*320}" cy="272" rx="11" ry="11" fill="#0F6E56" opacity="0.7" style="animation:vt-fi 0.5s ease 0.7s both"/>`).join('')}
<text x="220" y="266" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">→  2 identical daughter cells</text>
</g>`,
        text: "Mitosis is how one cell becomes two perfect copies. In Prophase, the DNA coils into visible chromosomes. In Metaphase, they line up exactly at the cell's equator — like players lining up before a game. In Anaphase, the cell's machinery pulls them to opposite ends. Then the cell pinches in two. Each daughter cell gets a perfect, identical copy of every chromosome. Your body does this millions of times daily to grow, heal wounds, and replace old cells."
      };
    }
  },

  {
    id: 'photosynthesis',
    keywords: ['photosyn','chloro','plant.*food','leaf.*energy','sunlight.*plant','CO2.*plant'],
    topic: 'Photosynthesis',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<ellipse cx="220" cy="165" rx="98" ry="72" fill="#5DCAA5" opacity="0.2"/>
<ellipse cx="220" cy="165" rx="98" ry="72" fill="none" stroke="#1D9E75" stroke-width="1.5"/>
<text x="220" y="122" text-anchor="middle" font-size="12" fill="#085041" font-family="var(--font-body)" font-weight="500">Leaf cell</text>
<ellipse cx="220" cy="168" rx="30" ry="22" fill="#27ae60" opacity="0.85"/>
<text x="220" y="172" text-anchor="middle" font-size="9" fill="white" font-family="var(--font-body)">Chloroplast</text>
${[[95,42],[130,25],[165,14]].map(([x,y],i)=>`<line x1="${x}" y1="${y}" x2="${188-i*12}" y2="${135+i*6}" stroke="#f1c40f" stroke-width="2.5" stroke-linecap="round" style="stroke-dasharray:30,22;animation:vt-flow 1.5s linear ${i*0.3}s infinite"/>`).join('')}
<text x="95" y="24" text-anchor="middle" font-size="10" fill="#BA7517" font-family="var(--font-body)" font-weight="500">Sunlight</text>
<path d="M48 158 Q25 158 25 158" stroke="#378ADD" stroke-width="2.5" fill="none" style="stroke-dasharray:18;animation:vt-flow 1s linear infinite" marker-end="url(#vph1)"/>
<text x="36" y="148" text-anchor="middle" font-size="9" fill="#378ADD" font-family="var(--font-body)">H₂O</text>
<path d="M122 158 Q85 158 50 158" stroke="#378ADD" stroke-width="2.5" fill="none"/>
<path d="M48 178 Q25 178 25 178" stroke="#888" stroke-width="2" fill="none" style="stroke-dasharray:18;animation:vt-flow 1s linear 0.3s infinite" marker-end="url(#vph2)"/>
<text x="36" y="194" text-anchor="middle" font-size="9" fill="#888" font-family="var(--font-body)">CO₂</text>
<path d="M122 178 Q85 180 50 178" stroke="#888" stroke-width="2" fill="none"/>
<path d="M318 158 Q360 155 390 155" stroke="#639922" stroke-width="2.5" fill="none" style="stroke-dasharray:22;animation:vt-flow 1.1s linear infinite" marker-end="url(#vph3)"/>
<text x="400" y="148" text-anchor="middle" font-size="9" fill="#3B6D11" font-family="var(--font-body)">O₂</text>
<path d="M318 175 Q360 180 390 182" stroke="#EF9F27" stroke-width="2.5" fill="none" style="stroke-dasharray:22;animation:vt-flow 1.1s linear 0.35s infinite" marker-end="url(#vph4)"/>
<text x="408" y="192" text-anchor="middle" font-size="9" fill="#854F0B" font-family="var(--font-body)">Glucose</text>
<defs>
  <marker id="vph1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#378ADD" stroke-width="2"/></marker>
  <marker id="vph2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#888" stroke-width="2"/></marker>
  <marker id="vph3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#639922" stroke-width="2"/></marker>
  <marker id="vph4" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#EF9F27" stroke-width="2"/></marker>
</defs>
<text x="220" y="268" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂</text>
</g>`,
        text: "Photosynthesis is how plants make food from sunlight. Water enters from the roots, carbon dioxide comes in through tiny pores called stomata. Inside the chloroplast — the green powerhouse — sunlight energy is absorbed by chlorophyll and used to bond CO₂ and H₂O into glucose sugar the plant uses as food and for growth. The byproduct is oxygen — the very air you breathe right now! Every breath you take exists because of photosynthesis."
      };
    }
  },

  {
    id: 'dna',
    keywords: ['dna','double helix','replication','base pair','nucleotide','adenine','guanine','thymine','cytosine'],
    topic: 'DNA Double Helix',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.6s ease both">
${Array.from({length:10},(_,i)=>{
  const y = 40 + i*26;
  const lx = 160 + Math.sin(i*0.7)*60;
  const rx = 280 - Math.sin(i*0.7)*60;
  const colors = [['#e74c3c','#3498db'],['#3498db','#e74c3c'],['#f39c12','#2ecc71'],['#2ecc71','#f39c12']];
  const [lc,rc] = colors[i%4];
  return `<circle cx="${lx}" cy="${y}" r="10" fill="${lc}" opacity="0.85" style="animation:vt-bob ${1.2}s ease-in-out ${i*0.08}s infinite"/>
<circle cx="${rx}" cy="${y}" r="10" fill="${rc}" opacity="0.85" style="animation:vt-bob ${1.2}s ease-in-out ${i*0.08+0.6}s infinite"/>
<line x1="${lx+10}" y1="${y}" x2="${rx-10}" y2="${y}" stroke="var(--border-sm)" stroke-width="1.5" stroke-dasharray="3,2"/>`;
}).join('')}
<path d="M160,40 ${Array.from({length:10},(_,i)=>`L${160+Math.sin(i*0.7)*60},${40+i*26}`).join(' ')}" stroke="#7F77DD" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M280,40 ${Array.from({length:10},(_,i)=>`L${280-Math.sin(i*0.7)*60},${40+i*26}`).join(' ')}" stroke="#7F77DD" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="95" y="155" text-anchor="middle" font-size="10" fill="#e74c3c" font-family="var(--font-body)">A — T</text>
<text x="95" y="172" text-anchor="middle" font-size="10" fill="#3498db" font-family="var(--font-body)">T — A</text>
<text x="95" y="189" text-anchor="middle" font-size="10" fill="#f39c12" font-family="var(--font-body)">G — C</text>
<text x="95" y="206" text-anchor="middle" font-size="10" fill="#2ecc71" font-family="var(--font-body)">C — G</text>
<text x="345" y="155" font-size="10" fill="var(--text-4)" font-family="var(--font-body)">Base</text>
<text x="345" y="172" font-size="10" fill="var(--text-4)" font-family="var(--font-body)">pairs</text>
<text x="220" y="310" text-anchor="middle" font-size="11" fill="var(--text-3)" font-family="var(--font-body)">The two strands are complementary — A always pairs with T, G with C</text>
</g>`,
        text: "DNA is a double helix — two strands twisted around each other like a twisted ladder. The sides of the ladder are made of sugar and phosphate. The rungs are base pairs: Adenine always pairs with Thymine (A-T), and Guanine always pairs with Cytosine (G-C). This complementary pairing is why DNA can be copied perfectly — each strand is the template for the other. Your 3 billion base pairs are packed into 46 chromosomes inside almost every cell in your body."
      };
    }
  },

  {
    id: 'vaccine',
    keywords: ['vaccine','immun','antibody','antigen','memory cell','herd immunit'],
    topic: 'How Vaccines Work',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<text x="80" y="30" text-anchor="middle" font-size="11" fill="var(--text-2)" font-family="var(--font-body)" font-weight="500">1. Vaccine</text>
<rect x="42" y="42" width="76" height="44" rx="8" fill="#9FE1CB" opacity="0.5"/>
<circle cx="65" cy="64" r="10" fill="#1D9E75" opacity="0.8"/>
<text x="65" y="68" text-anchor="middle" font-size="8" fill="white" font-family="var(--font-body)">antigen</text>
<circle cx="95" cy="58" r="7" fill="#1D9E75" opacity="0.6"/>
<circle cx="100" cy="76" r="5" fill="#1D9E75" opacity="0.5"/>
<path d="M118 64 L148 64" stroke="var(--text-4)" stroke-width="1.5" fill="none" marker-end="url(#vv1)"/>
<text x="190" y="30" text-anchor="middle" font-size="11" fill="var(--text-2)" font-family="var(--font-body)" font-weight="500">2. Immune response</text>
<rect x="148" y="42" width="84" height="44" rx="8" fill="#EEEDFE" opacity="0.7"/>
<text x="190" y="68" text-anchor="middle" font-size="9" fill="#534AB7" font-family="var(--font-body)">B cells activated</text>
<text x="190" y="80" text-anchor="middle" font-size="8" fill="#7F77DD" font-family="var(--font-body)">antibodies made</text>
<path d="M232 64 L262 64" stroke="var(--text-4)" stroke-width="1.5" fill="none" marker-end="url(#vv1)"/>
<text x="320" y="30" text-anchor="middle" font-size="11" fill="var(--text-2)" font-family="var(--font-body)" font-weight="500">3. Memory</text>
<rect x="262" y="42" width="76" height="44" rx="8" fill="#FAEEDA" opacity="0.7"/>
<text x="300" y="62" text-anchor="middle" font-size="9" fill="#854F0B" font-family="var(--font-body)">Memory cells</text>
<text x="300" y="76" text-anchor="middle" font-size="8" fill="#BA7517" font-family="var(--font-body)">stored for years</text>
<text x="220" y="118" text-anchor="middle" font-size="12" fill="var(--text-2)" font-family="var(--font-body)" font-weight="500">If the real virus arrives later:</text>
<circle cx="80" cy="170" r="20" fill="#f39c12" opacity="0.8"/>
<text x="80" y="174" text-anchor="middle" font-size="8" fill="white" font-family="var(--font-body)" font-weight="500">VIRUS</text>
<text x="80" y="210" text-anchor="middle" font-size="9" fill="var(--text-3)" font-family="var(--font-body)">Real virus enters</text>
<path d="M104 170 L148 170" stroke="var(--text-4)" stroke-width="1.5" fill="none" marker-end="url(#vv1)"/>
<rect x="148" y="148" width="84" height="44" rx="8" fill="#EEEDFE" opacity="0.7"/>
<text x="190" y="172" text-anchor="middle" font-size="9" fill="#534AB7" font-family="var(--font-body)">Memory cells</text>
<text x="190" y="184" text-anchor="middle" font-size="8" fill="#7F77DD" font-family="var(--font-body)">recognize it fast!</text>
<path d="M232 170 L262 170" stroke="var(--text-4)" stroke-width="1.5" fill="none" marker-end="url(#vv1)"/>
<rect x="262" y="148" width="76" height="44" rx="8" fill="#E1F5EE" opacity="0.8"/>
<text x="300" y="168" text-anchor="middle" font-size="9" fill="#0F6E56" font-family="var(--font-body)">Rapid antibody</text>
<text x="300" y="181" text-anchor="middle" font-size="8" fill="#1D9E75" font-family="var(--font-body)">attack! Protected.</text>
<defs><marker id="vv1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="var(--text-4)" stroke-width="2"/></marker></defs>
<text x="220" y="235" text-anchor="middle" font-size="11" fill="var(--text-3)" font-family="var(--font-body)">Vaccine trains the immune system without causing disease</text>
</g>`,
        text: "A vaccine contains a harmless piece of the pathogen — an antigen. Your immune system sees this stranger, activates B cells, and produces antibodies that recognize and destroy it. Crucially, some B cells become memory cells that stick around for years. If the real virus ever enters your body, your immune system recognizes it instantly and launches a massive antibody response before you even feel sick. You're protected without ever having had the disease."
      };
    }
  },

  {
    id: 'ohmslaw',
    keywords: ["ohm", "voltage", "current", "resistance", "v=ir", "circuit.*basic", "electric.*law"],
    topic: "Ohm's Law",
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<rect x="80" y="60" width="280" height="160" rx="12" fill="none" stroke="var(--border-sm)" stroke-width="2"/>
<rect x="188" y="56" width="64" height="32" rx="6" fill="#EF9F27" opacity="0.85"/>
<text x="220" y="76" text-anchor="middle" font-size="11" fill="#412402" font-family="var(--font-body)" font-weight="500">Battery (V)</text>
<rect x="188" y="192" width="64" height="32" rx="6" fill="#AFA9EC" opacity="0.85"/>
<text x="220" y="212" text-anchor="middle" font-size="11" fill="#26215C" font-family="var(--font-body)" font-weight="500">Resistor (R)</text>
<path d="M220 88 L220 220" stroke="var(--text-4)" stroke-width="0" fill="none"/>
<path d="M80 140 L80 88 L188 88" stroke="#e74c3c" stroke-width="3" fill="none" stroke-linecap="round" style="stroke-dasharray:50;animation:vt-flow 1.5s linear infinite"/>
<path d="M252 88 L360 88 L360 140" stroke="#e74c3c" stroke-width="3" fill="none" stroke-linecap="round" style="stroke-dasharray:50;animation:vt-flow 1.5s linear 0.5s infinite"/>
<path d="M360 140 L360 212 L252 212" stroke="#3498db" stroke-width="3" fill="none" stroke-linecap="round" style="stroke-dasharray:50;animation:vt-flow 1.5s linear 1s infinite"/>
<path d="M188 212 L80 212 L80 140" stroke="#3498db" stroke-width="3" fill="none" stroke-linecap="round" style="stroke-dasharray:50;animation:vt-flow 1.5s linear 1.5s infinite"/>
<text x="42" y="144" text-anchor="middle" font-size="10" fill="#e74c3c" font-family="var(--font-body)">current (I)</text>
<rect x="152" y="116" width="136" height="88" rx="8" fill="var(--surface-2)" opacity="0.92"/>
<text x="220" y="144" text-anchor="middle" font-size="22" fill="var(--text-1)" font-family="var(--font-body)" font-weight="700">V = I × R</text>
<text x="220" y="168" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">Voltage = Current × Resistance</text>
<text x="220" y="185" text-anchor="middle" font-size="10" fill="var(--text-4)" font-family="var(--font-body)">Units: Volts = Amps × Ohms</text>
<text x="220" y="290" text-anchor="middle" font-size="11" fill="var(--text-3)" font-family="var(--font-body)">Double the resistance → halve the current (same voltage)</text>
</g>`,
        text: "Ohm's Law is the fundamental rule of electricity: V = I × R. Voltage (V) is the electrical pressure — like water pressure in a pipe. Current (I) is how many electrons flow per second — like the flow rate of water. Resistance (R) is how much the circuit opposes the flow — like a narrow pipe section. If you increase resistance, current drops. If you increase voltage, current rises. This relationship governs every circuit in every device you use."
      };
    }
  },

  {
    id: 'apple',
    keywords: ['apple','fruit','heat.*apple','apple.*heat','cook','evapor','boil'],
    topic: 'Apple being heated',
    render(q) {
      const hot = /heat|hot|cook|boil|warm|evapor/.test(q||'heat');
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<ellipse cx="220" cy="170" rx="65" ry="62" fill="#c0392b" opacity="0.9"/>
<ellipse cx="209" cy="156" rx="11" ry="15" fill="rgba(255,255,255,0.13)" transform="rotate(-18,209,156)"/>
<path d="M220 106 Q234 83 252 86 Q240 96 220 102Z" fill="#27ae60"/>
<path d="M220 106 Q215 90 220 80" stroke="#7d5a3c" stroke-width="2.5" fill="none" stroke-linecap="round"/>
${hot ? [172,188,204,220].map((x,i)=>`<path d="M${x} 102 Q${x+5} 88 ${x} 74 Q${x-5} 60 ${x} 46" stroke="#aaa" stroke-width="2" fill="none" stroke-linecap="round" style="animation:vt-steam ${0.9+i*0.18}s ease-out ${i*0.18}s infinite"/>`).join('') : ''}
${hot ? `<ellipse cx="220" cy="235" rx="68" ry="10" fill="#e67e22" opacity="0.3" style="animation:vt-glow 1.2s ease-in-out infinite"/>` : ''}
<text x="220" y="268" text-anchor="middle" font-size="11" fill="var(--text-3)" font-family="var(--font-body)">${hot ? 'Heat energy → water molecules escape as steam' : 'An apple — full of water, sugars, and cells'}</text>
</g>`,
        text: hot
          ? "Watch the steam rising! When heat is applied, the water molecules inside the apple gain kinetic energy and vibrate faster and faster. At the surface, some molecules have enough energy to break free and escape as water vapor — this is evaporation. The orange glow represents the heat source. This same principle explains cooking, sweating, the water cycle, and why wet clothes dry in the sun."
          : "Here's your apple — simple on the outside but complex inside. It's mostly water molecules, along with sugars, cellulose, vitamins, and millions of living cells. Ask me to heat it and watch what happens to those molecules!"
      };
    }
  },

  {
    id: 'respiration',
    keywords: ['respiration','cellular.*respir','atp','krebs','glycolysis','mitochondria','energy.*cell'],
    topic: 'Cellular Respiration',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<ellipse cx="220" cy="165" rx="110" ry="80" fill="#FAEEDA" opacity="0.4"/>
<ellipse cx="220" cy="165" rx="110" ry="80" fill="none" stroke="#BA7517" stroke-width="1.5"/>
<text x="220" y="118" text-anchor="middle" font-size="11" fill="#633806" font-family="var(--font-body)" font-weight="500">Mitochondria</text>
<ellipse cx="220" cy="168" rx="55" ry="38" fill="#EF9F27" opacity="0.35"/>
<text x="220" y="172" text-anchor="middle" font-size="10" fill="#412402" font-family="var(--font-body)">Inner matrix</text>
<path d="M50 165 Q25 165 25 165" stroke="#e74c3c" stroke-width="2.5" fill="none" style="stroke-dasharray:20;animation:vt-flow 1s linear infinite" marker-end="url(#vr1)"/>
<text x="38" y="155" text-anchor="middle" font-size="9" fill="#e74c3c" font-family="var(--font-body)">Glucose</text>
<path d="M80 175 Q50 180 28 180" stroke="#3498db" stroke-width="2" fill="none" style="stroke-dasharray:18;animation:vt-flow 1s linear 0.2s infinite" marker-end="url(#vr2)"/>
<text x="38" y="194" text-anchor="middle" font-size="9" fill="#3498db" font-family="var(--font-body)">O₂</text>
<path d="M330 155 Q368 152 392 152" stroke="#f39c12" stroke-width="3" fill="none" style="stroke-dasharray:22;animation:vt-flow 1.1s linear infinite" marker-end="url(#vr3)"/>
<text x="408" y="148" text-anchor="middle" font-size="10" fill="#854F0B" font-family="var(--font-body)" font-weight="600">ATP</text>
<text x="408" y="161" text-anchor="middle" font-size="8" fill="#BA7517" font-family="var(--font-body)">(energy!)</text>
<path d="M330 175 Q368 178 392 180" stroke="#888" stroke-width="2" fill="none" style="stroke-dasharray:18;animation:vt-flow 1.1s linear 0.3s infinite" marker-end="url(#vr4)"/>
<text x="408" y="186" text-anchor="middle" font-size="9" fill="#888" font-family="var(--font-body)">CO₂ + H₂O</text>
<defs>
  <marker id="vr1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#e74c3c" stroke-width="2"/></marker>
  <marker id="vr2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#3498db" stroke-width="2"/></marker>
  <marker id="vr3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#f39c12" stroke-width="2"/></marker>
  <marker id="vr4" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#888" stroke-width="2"/></marker>
</defs>
<text x="220" y="275" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + 36–38 ATP</text>
</g>`,
        text: "Cellular respiration is how your cells extract energy from glucose. Inside the mitochondria — the cell's powerhouse — glucose and oxygen are broken down through a series of reactions (glycolysis → Krebs cycle → electron transport chain). The end products are ATP (adenosine triphosphate), the energy currency your body uses for everything, plus carbon dioxide and water as waste products. Every movement, thought, and heartbeat is powered by ATP made this way."
      };
    }
  },

  {
    id: 'digestive',
    keywords: ['digest','stomach','intestin','enzyme.*food','absorption.*gut','small.*intestine','peristalsis'],
    topic: 'Digestive System',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<circle cx="220" cy="55" r="28" fill="none" stroke="var(--border-sm)" stroke-width="2"/>
<text x="220" y="59" text-anchor="middle" font-size="10" fill="var(--text-2)" font-family="var(--font-body)">Mouth</text>
<path d="M220 83 L220 105" stroke="var(--text-4)" stroke-width="2" fill="none" marker-end="url(#vd1)"/>
<rect x="180" y="108" width="80" height="40" rx="8" fill="#AFA9EC" opacity="0.6"/>
<text x="220" y="132" text-anchor="middle" font-size="10" fill="#26215C" font-family="var(--font-body)">Oesophagus</text>
<path d="M220 148 L220 165" stroke="var(--text-4)" stroke-width="2" fill="none" marker-end="url(#vd1)"/>
<path d="M175 180 Q155 168 160 195 Q165 222 200 222 Q235 222 240 195 Q245 168 225 180Z" fill="#EF9F27" opacity="0.7"/>
<text x="200" y="198" text-anchor="middle" font-size="10" fill="#412402" font-family="var(--font-body)" font-weight="500">Stomach</text>
<text x="200" y="210" text-anchor="middle" font-size="8" fill="#633806" font-family="var(--font-body)">acid + enzymes</text>
<path d="M215 222 Q215 240 200 252 Q150 270 145 295 Q140 318 170 320 Q200 322 210 295 Q220 268 260 260 Q300 252 308 278 Q316 305 290 312 Q264 318 260 295" stroke="#5DCAA5" stroke-width="4" fill="none" stroke-linecap="round"/>
<text x="300" y="268" font-size="9" fill="#085041" font-family="var(--font-body)">Small</text>
<text x="300" y="280" font-size="9" fill="#085041" font-family="var(--font-body)">intestine</text>
<text x="300" y="292" font-size="8" fill="#1D9E75" font-family="var(--font-body)">(absorption)</text>
<text x="220" y="340" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">Food → broken down → nutrients absorbed → waste out</text>
<defs><marker id="vd1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="var(--text-4)" stroke-width="2"/></marker></defs>
</g>`,
        text: "Digestion starts in the mouth where teeth crush food and saliva begins breaking down carbohydrates. Food travels down the oesophagus to the stomach, where acid and enzymes break down proteins. The churned mixture (chyme) enters the small intestine — the real workhorse. Here, more enzymes from the pancreas and liver break down everything into tiny molecules: glucose, amino acids, fatty acids. These are absorbed through the intestinal wall into the bloodstream and carried to every cell in your body."
      };
    }
  },

];

// ── State ──────────────────────────────────────────────────────────────────

let _vtPrevScreen = 'flash';
let _vtAbort = null;
let _vtSessionId = null;   // tracks current recent-item id for save/restore

// ── Session persistence helpers ────────────────────────────────────────────

function _vtSaveSession() {
  if (!_vtSessionId) return;
  const msgs = document.getElementById('vt-chat-msgs');
  if (!msgs) return;
  const html  = msgs.innerHTML;
  const topic = document.getElementById('vt-canvas-topic')?.textContent || '';
  try {
    localStorage.setItem('chunks_vt_session_' + _vtSessionId, JSON.stringify({ html, topic }));
    localStorage.setItem('chunks_active_vt_session', _vtSessionId);
  } catch(e) {}
}

function _vtLoadSession(id) {
  try {
    const raw = localStorage.getItem('chunks_vt_session_' + id);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

// ── Scene matcher ──────────────────────────────────────────────────────────

function _vtMatchScene(q) {
  const lower = q.toLowerCase();
  for (const scene of VT_SCENES) {
    const match = scene.keywords.some(k => new RegExp(k, 'i').test(lower));
    if (match) return scene;
  }
  return null;
}

// ── Render scene ───────────────────────────────────────────────────────────

function _vtRenderScene(scene, q) {
  const result = scene.render(q);
  const svgEl = document.getElementById('vt-svg');
  if (svgEl) svgEl.innerHTML = result.svg;
  const topicEl = document.getElementById('vt-canvas-topic');
  if (topicEl) topicEl.textContent = scene.topic;
  const dot = document.getElementById('vt-canvas-dot');
  if (dot) dot.style.background = '#4ade80';
  return result.text;
}

// ── Add message ────────────────────────────────────────────────────────────

function _vtAddMsg(text, role) {
  const msgs = document.getElementById('vt-chat-msgs');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = `vt-msg vt-msg-${role}`;
  if (role === 'user') {
    div.innerHTML = `<div class="vt-bubble">${text}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    // Register in recent history on every user message
    if (window.recentAdd) {
      window.recentAdd(text, null, 'visual');
      // Grab the session id from the item recentAdd just created/activated
      if (window._recentItems && window._recentItems.length) {
        const latest = window._recentItems[0];
        if (latest.source === 'visual') _vtSessionId = latest.id;
      }
    }
    _vtSaveSession();
    return;
  } else {
    div.innerHTML = `<div class="vt-avatar">AI</div><div class="vt-bubble"></div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    const bubble = div.querySelector('.vt-bubble');
    let i = 0;
    const words = text.split(' ');
    const iv = setInterval(() => {
      if (i >= words.length) {
        clearInterval(iv);
        _vtSaveSession(); // save after AI finishes typing
        return;
      }
      bubble.textContent += (i > 0 ? ' ' : '') + words[i++];
      msgs.scrollTop = msgs.scrollHeight;
    }, 22);
    return;
  }
}

// ── AI fallback ────────────────────────────────────────────────────────────

async function _vtAskAI(q) {
  if (_vtAbort) _vtAbort.abort();
  _vtAbort = new AbortController();

  const dot = document.getElementById('vt-canvas-dot');
  if (dot) dot.style.background = '#facc15';

  try {
    const res = await fetch(`${window.API_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: _vtAbort.signal,
      body: JSON.stringify({
        question: `You are a visual tutor explaining "${q}" to a student.
Explain the concept clearly in 3-4 sentences. Be concrete and use vivid analogies.
Focus on the key mechanism that makes this concept click. No bullet points — write as a natural explanation.`,
        mode: 'study',
        complexity: 6,
      }),
    });
    const data = await res.json();
    const answer = data.answer || data.response || '';
    if (answer) {
      _vtAddMsg(answer, 'ai');
      const svgEl = document.getElementById('vt-svg');
      if (svgEl) {
        svgEl.innerHTML = `
          <text x="220" y="140" text-anchor="middle" font-size="13" fill="var(--text-3)" font-family="var(--font-body)">💡 ${q}</text>
          <text x="220" y="168" text-anchor="middle" font-size="11" fill="var(--text-4)" font-family="var(--font-body)">Animation for this topic coming soon</text>
          <text x="220" y="192" text-anchor="middle" font-size="10" fill="var(--text-4)" font-family="var(--font-body)" opacity="0.6">Try: osmosis, heart, neuron, mitosis, photosynthesis, DNA</text>
        `;
      }
      const topicEl = document.getElementById('vt-canvas-topic');
      if (topicEl) topicEl.textContent = q;
      if (dot) dot.style.background = '#4ade80';
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    _vtAddMsg("Sorry, I couldn't connect to the AI right now. Try one of the pre-built topics using the buttons!", 'ai');
    if (dot) dot.style.background = '#f87171';
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

window._vtAsk = function(q) {
  if (!q.trim()) return;
  const input = document.getElementById('vt-input');
  if (input) input.value = '';
  _vtAddMsg(q, 'user');

  const scene = _vtMatchScene(q);
  if (scene) {
    const text = _vtRenderScene(scene, q);
    setTimeout(() => _vtAddMsg(text, 'ai'), 200);
  } else {
    const svgEl = document.getElementById('vt-svg');
    if (svgEl) {
      svgEl.innerHTML = `<text x="220" y="165" text-anchor="middle" font-size="13" fill="var(--text-4)" font-family="var(--font-body)">Thinking about ${q}...</text>`;
    }
    _vtAddMsg("Let me think about that for you...", 'ai');
    _vtAskAI(q);
  }
};

window._vtSendInput = function() {
  const input = document.getElementById('vt-input');
  if (input) window._vtAsk(input.value);
};

window._vtBack = function() {
  if (window.showScreen) window.showScreen(_vtPrevScreen || 'flash');
};

window._vtClear = function() {
  const svgEl = document.getElementById('vt-svg');
  if (svgEl) {
    svgEl.innerHTML = `
      <text x="220" y="155" text-anchor="middle" font-size="14" fill="var(--text-4)" font-family="var(--font-body)">Canvas cleared</text>
      <text x="220" y="178" text-anchor="middle" font-size="12" fill="var(--text-4)" font-family="var(--font-body)" opacity="0.6">Ask me to explain anything</text>
    `;
  }
  const dot = document.getElementById('vt-canvas-dot');
  if (dot) dot.style.background = '#4ade80';
  const topicEl = document.getElementById('vt-canvas-topic');
  if (topicEl) topicEl.textContent = 'Waiting for a concept...';
  const msgs = document.getElementById('vt-chat-msgs');
  if (msgs) {
    msgs.innerHTML = `<div class="vt-msg vt-msg-ai"><div class="vt-avatar">AI</div><div class="vt-bubble">Canvas cleared! Ask me to explain anything and I'll draw it here.</div></div>`;
  }
  // Clear session so next message starts a fresh recent entry
  _vtSessionId = null;
  localStorage.removeItem('chunks_active_vt_session');
};

// Called from flashcard Hard rating to open tutor on a specific concept
window._vtOpenForConcept = function(front, back) {
  _vtPrevScreen = 'flash';
  _vtSessionId = null; // fresh session for each flashcard concept
  window._navFromHistory = true; // skip showScreen reset — we set state ourselves
  if (window.showScreen) window.showScreen('visual');
  setTimeout(() => {
    const q = front || 'this concept';
    window._vtAsk(`explain ${q}`);
  }, 300);
};

// Called when user clicks a recent item that was saved from Visual Tutor
window._vtRestoreSession = function(sessionId, question) {
  _vtSessionId = sessionId;

  // Mark item active in sidebar
  if (window._setActiveRecent) window._setActiveRecent(sessionId);

  const session = _vtLoadSession(sessionId);
  const msgs = document.getElementById('vt-chat-msgs');

  if (session && session.html && msgs) {
    // Restore chat messages
    msgs.innerHTML = typeof window.sanitize === 'function'
      ? window.sanitize(session.html)
      : session.html;
    msgs.scrollTop = msgs.scrollHeight;

    // Restore topic label
    if (session.topic) {
      const topicEl = document.getElementById('vt-canvas-topic');
      if (topicEl) topicEl.textContent = session.topic;
      // Show a "session restored" placeholder on canvas
      const svgEl = document.getElementById('vt-svg');
      if (svgEl) {
        svgEl.innerHTML = `
          <text x="220" y="148" text-anchor="middle" font-size="13" fill="var(--text-3)" font-family="var(--font-body)">💡 ${session.topic}</text>
          <text x="220" y="172" text-anchor="middle" font-size="11" fill="var(--text-4)" font-family="var(--font-body)">Ask a follow-up to redraw the canvas</text>
        `;
      }
    }
  } else if (question) {
    // No saved HTML — pre-fill input so user can re-ask
    const input = document.getElementById('vt-input');
    if (input) { input.value = question; input.focus(); }
  }
};

// ── Mount ──────────────────────────────────────────────────────────────────

export function mountVisualTutorScreen() {
  const sp = document.querySelector('[data-visual-screen]');
  if (sp) {
    sp.outerHTML = VT_HTML;
  } else {
    // Fallback: append to body
    const div = document.createElement('div');
    div.innerHTML = VT_HTML;
    document.body.appendChild(div.firstElementChild);
  }

  // Inject animation keyframes
  if (!document.getElementById('vt-anims')) {
    const style = document.createElement('style');
    style.id = 'vt-anims';
    style.textContent = VT_ANIMS;
    document.head.appendChild(style);
  }

  // Wire input enter key
  setTimeout(() => {
    const input = document.getElementById('vt-input');
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') window._vtSendInput();
      });
    }
  }, 100);

  // ── Restore last visual session on page refresh ──
  (function _restoreVtSession() {
    const savedId = localStorage.getItem('chunks_active_vt_session');
    if (!savedId) return;

    const lastScreen = (() => {
      try { return sessionStorage.getItem('chunks_last_screen'); } catch(e) { return null; }
    })();
    // Only auto-restore if we were on the visual screen
    if (lastScreen !== 'visual') return;

    const session = _vtLoadSession(savedId);
    if (!session?.html) return;

    const msgs = document.getElementById('vt-chat-msgs');
    if (msgs) {
      msgs.innerHTML = typeof window.sanitize === 'function'
        ? window.sanitize(session.html)
        : session.html;
      msgs.scrollTop = msgs.scrollHeight;
    }

    if (session.topic) {
      const topicEl = document.getElementById('vt-canvas-topic');
      if (topicEl) topicEl.textContent = session.topic;
      const svgEl = document.getElementById('vt-svg');
      if (svgEl) {
        svgEl.innerHTML = `
          <text x="220" y="148" text-anchor="middle" font-size="13" fill="var(--text-3)" font-family="var(--font-body)">💡 ${session.topic}</text>
          <text x="220" y="172" text-anchor="middle" font-size="11" fill="var(--text-4)" font-family="var(--font-body)">Ask a follow-up to redraw the canvas</text>
        `;
      }
    }

    _vtSessionId = savedId;
    setTimeout(() => {
      if (window._setActiveRecent) window._setActiveRecent(savedId);
    }, 200);
  })();

  console.log('[VisualTutorScreen] mounted ✦');
}

mountVisualTutorScreen();
