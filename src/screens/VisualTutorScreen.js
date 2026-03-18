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
      <div class="vt-title">
        <div class="vt-live-dot"></div>
        Visual Tutor
      </div>
      <div class="vt-title-divider"></div>
      <div class="vt-topic-inline">
        <div class="vt-canvas-dot" id="vt-canvas-dot"></div>
        <span id="vt-canvas-topic">Waiting for a concept...</span>
      </div>
    </div>

    <div class="vt-body">

      <!-- LEFT: Live canvas -->
      <div class="vt-canvas-panel">
        <div class="vt-canvas-area" id="vt-canvas-area">
          <svg id="vt-svg" viewBox="0 0 440 340" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <text x="220" y="155" text-anchor="middle" font-size="14" fill="var(--text-4)" font-family="var(--font-body)">Ask me to explain anything</text>
            <text x="220" y="178" text-anchor="middle" font-size="12" fill="var(--text-4)" font-family="var(--font-body)" opacity="0.6">I'll draw it here as I explain</text>
          </svg>
        </div>
        <div class="vt-canvas-footer">
          <!-- Quick-topic pills (shown when idle) -->
          <div class="vt-quick-pills" id="vt-quick-pills">
            <span class="vt-pills-label">Try:</span>
            <button class="vt-pill" data-query="explain titration">Titration</button>
            <button class="vt-pill" data-query="show me the heart pumping blood">Heart</button>
            <button class="vt-pill" data-query="explain action potential">Neuron</button>
            <button class="vt-pill" data-query="explain cell structure organelles">Cell</button>
            <button class="vt-pill" data-query="explain photosynthesis">Photosynthesis</button>
            <button class="vt-pill" data-query="explain supply and demand equilibrium">Supply &amp; Demand</button>
            <button class="vt-pill" data-query="explain newton laws of motion">Newton's Laws</button>
            <button class="vt-pill" data-query="explain wave properties wavelength frequency">Waves</button>
            <button class="vt-pill" data-query="explain the water cycle">Water Cycle</button>
            <button class="vt-pill" data-query="explain enzymes active site lock and key">Enzymes</button>
            <button class="vt-pill" data-query="explain pH scale acids bases">pH Scale</button>
            <button class="vt-pill" data-query="explain how vaccines work">Vaccines</button>
          </div>
          <!-- Step nav bar (shown when whiteboard is drawing) -->
          <div class="vt-step-nav" id="vt-step-nav" style="display:none;">
            <div class="vt-step-dots" id="vt-step-dots"></div>
            <div class="vt-step-btns">
              <button class="vt-step-btn vt-step-back" id="vt-step-back" onclick="window._vtPrevStep()" title="Previous step">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                Back
              </button>
              <button class="vt-step-btn vt-step-next" id="vt-step-next" onclick="window._vtNextStep()">
                Next step
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Chat panel -->
      <div class="vt-chat-panel">
        <div class="vt-chat-msgs" id="vt-chat-msgs">
          <div class="vt-msg vt-msg-ai">
            <div class="vt-avatar"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/><ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/><ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/><circle cx="50" cy="50" r="6" fill="#e8ac2e"/></svg></div>
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

  // ── CHEMISTRY ────────────────────────────────────────────────────────────

  {
    id: 'titration',
    keywords: ['titration','titrate','burette','equivalence','neutrali','acid.*base.*reaction','pH.*curve','indicator.*color'],
    topic: 'Acid-Base Titration',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<defs>
  <marker id="vt1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#3498db" stroke-width="2"/></marker>
  <linearGradient id="vtg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3498db" stop-opacity="0.9"/><stop offset="100%" stop-color="#3498db" stop-opacity="0.3"/></linearGradient>
  <linearGradient id="vtg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e74c3c" stop-opacity="0.7"/><stop offset="100%" stop-color="#e74c3c" stop-opacity="0.2"/></linearGradient>
</defs>
<rect x="178" y="22" width="28" height="7" rx="2" fill="#b0bec5"/>
<rect x="180" y="29" width="24" height="115" rx="3" fill="none" stroke="#b0bec5" stroke-width="2"/>
<rect x="182" y="31" width="20" height="80" rx="2" fill="url(#vtg1)" style="animation:vt-grow 1.5s ease both;transform-origin:182px 111px"/>
${[0,1,2,3,4].map(i=>`<line x1="204" y1="${38+i*18}" x2="210" y2="${38+i*18}" stroke="#b0bec5" stroke-width="1"/><text x="213" y="${42+i*18}" font-size="8" fill="var(--text-3)" font-family="var(--font-body)">${50-i*10} mL</text>`).join('')}
<path d="M188 144 L188 155 L192 160 L188 165" stroke="#b0bec5" stroke-width="2" fill="none" stroke-linecap="round"/>
<circle cx="192" cy="161" r="2.5" fill="#3498db" opacity="0.9" style="animation:vt-bob 0.9s ease-in-out infinite"/>
<path d="M192 163 Q192 185 192 195" stroke="#3498db" stroke-width="1.5" fill="none" stroke-linecap="round" style="stroke-dasharray:6,4;animation:vt-flow 0.8s linear infinite" marker-end="url(#vt1)"/>
<path d="M148 225 Q148 200 168 195 Q192 190 216 195 Q236 200 236 225 Q236 252 192 255 Q148 252 148 225Z" fill="url(#vtg2)" stroke="#e74c3c" stroke-width="1.5"/>
<path d="M148 225 Q148 200 168 195 Q192 190 216 195 Q236 200 236 225" fill="none" stroke="#e74c3c" stroke-width="1.5"/>
<text x="192" y="230" text-anchor="middle" font-size="10" fill="white" font-family="var(--font-body)" font-weight="500">HCl (acid)</text>
<text x="192" y="244" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.75)" font-family="var(--font-body)">+ indicator</text>
<line x1="152" y1="255" x2="232" y2="255" stroke="#e74c3c" stroke-width="1.5" opacity="0.4"/>
<path d="M280 155 L380 155" stroke="var(--border-sm)" stroke-width="1" stroke-dasharray="3,3"/>
<path d="M280 80 Q295 78 300 100 Q305 130 310 150 Q314 162 320 155 Q328 148 330 100 Q332 72 340 68 Q360 62 380 62" stroke="#8b7cf8" stroke-width="2.5" fill="none" stroke-linecap="round" style="stroke-dasharray:200;animation:vt-dash 2s ease both"/>
<text x="270" y="80" text-anchor="middle" font-size="9" fill="var(--text-3)" font-family="var(--font-body)" transform="rotate(-90,270,120)">pH</text>
<text x="330" y="175" text-anchor="middle" font-size="9" fill="var(--text-3)" font-family="var(--font-body)">Volume NaOH →</text>
<circle cx="320" cy="155" r="4" fill="#e8ac2e" style="animation:vt-pulse 1.2s ease-in-out infinite"/>
<text x="320" y="148" text-anchor="middle" font-size="8" fill="#e8ac2e" font-family="var(--font-body)" font-weight="600">Equiv.</text>
<text x="192" y="295" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">At equivalence: moles acid = moles base → pH = 7</text>
</g>`,
        text: "Titration is the most elegant experiment in chemistry — you slowly add a known base (NaOH from the burette) into an unknown acid until they perfectly cancel each other out. The indicator dye changes color the moment that happens. On the right, watch the pH curve: it barely changes at first, then ROCKETS upward at the equivalence point — that sharp jump is where moles of acid exactly equal moles of base. By reading the burette, you can calculate the exact concentration of the unknown acid. Precise, beautiful, and absolutely fundamental to medicine, food science, and environmental testing."
      };
    }
  },

  {
    id: 'atomstructure',
    keywords: ['atom','proton','neutron','electron','nucleus','bohr','electron.*shell','atomic.*structure','periodic','element'],
    topic: 'Atomic Structure',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<defs>
  <radialGradient id="vag1"><stop offset="0%" stop-color="#e74c3c" stop-opacity="0.9"/><stop offset="100%" stop-color="#c0392b" stop-opacity="0.6"/></radialGradient>
  <radialGradient id="vag2"><stop offset="0%" stop-color="#3498db" stop-opacity="0.9"/><stop offset="100%" stop-color="#2980b9" stop-opacity="0.6"/></radialGradient>
</defs>
${[0,1,2].map(i=>`<circle cx="192" cy="148" r="${42+i*38}" fill="none" stroke="var(--border-sm)" stroke-width="${1.2-i*0.2}" stroke-dasharray="${i===0?'none':'4,3'}"/>`).join('')}
<circle cx="192" cy="148" r="22" fill="#1e1f29" stroke="#e74c3c" stroke-width="1.5"/>
${[[183,143],[201,143],[192,156],[184,155],[200,155],[192,140]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="5.5" fill="${i%2===0?'url(#vag1)':'url(#vag2)'}" style="animation:vt-pulse ${1.2+i*0.1}s ease-in-out ${i*0.15}s infinite"/>`).join('')}
<text x="192" y="183" text-anchor="middle" font-size="8" fill="var(--text-3)" font-family="var(--font-body)">Nucleus</text>
${[[192,106,0],[154,148,1],[192,190,2],[230,148,3],[160,120,0],[224,120,0]].slice(0,2).map(([x,y,sh],i)=>`<circle cx="${x}" cy="${y}" r="6" fill="#f1c40f" stroke="#e8ac2e" stroke-width="1" style="animation:vt-spin ${1.8+sh*0.6}s linear infinite;transform-origin:192px 148px"/>`).join('')}
<circle cx="234" cy="148" r="6" fill="#f1c40f" stroke="#e8ac2e" stroke-width="1" style="animation:vt-spin 1.8s linear infinite;transform-origin:192px 148px"/>
<circle cx="192" cy="110" r="6" fill="#f1c40f" stroke="#e8ac2e" stroke-width="1" style="animation:vt-spin 1.8s linear reverse infinite;transform-origin:192px 148px"/>
<circle cx="175" cy="224" r="6" fill="#f1c40f" stroke="#e8ac2e" stroke-width="1" style="animation:vt-spin 3s linear infinite;transform-origin:192px 148px"/>
<circle cx="209" cy="224" r="6" fill="#f1c40f" stroke="#e8ac2e" stroke-width="1" style="animation:vt-spin 3s linear 1.5s infinite;transform-origin:192px 148px"/>
<text x="60" y="148" text-anchor="middle" font-size="9" fill="#e74c3c" font-family="var(--font-body)" font-weight="600">Proton +</text>
<text x="60" y="162" text-anchor="middle" font-size="9" fill="#3498db" font-family="var(--font-body)" font-weight="600">Neutron 0</text>
<text x="60" y="176" text-anchor="middle" font-size="9" fill="#f1c40f" font-family="var(--font-body)" font-weight="600">Electron –</text>
<line x1="78" y1="148" x2="168" y2="150" stroke="var(--border-sm)" stroke-width="0.8"/>
<text x="340" y="115" text-anchor="middle" font-size="10" fill="var(--text-2)" font-family="var(--font-body)" font-weight="500">Shell K: 2e⁻</text>
<text x="340" y="135" text-anchor="middle" font-size="10" fill="var(--text-2)" font-family="var(--font-body)" font-weight="500">Shell L: 8e⁻</text>
<text x="340" y="155" text-anchor="middle" font-size="10" fill="var(--text-2)" font-family="var(--font-body)" font-weight="500">Shell M: 8e⁻</text>
<text x="192" y="298" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">Protons = atomic number. Electrons = protons (neutral atom).</text>
</g>`,
        text: "Every atom is mostly empty space — if the nucleus were the size of a marble in the center of a football stadium, the electrons would be orbiting at the stadium's outer walls. The nucleus holds protons (positive charge) and neutrons (no charge), packed tight together. Electrons whirl around in shells or energy levels — up to 2 in the first shell, 8 in the second and third. The number of protons defines the element: 6 protons = carbon, always. The electrons in the outer shell determine how the atom bonds with others — that's the entire basis of chemistry."
      };
    }
  },

  {
    id: 'acidbase',
    keywords: ['acid.*base','pH scale','pH.*neutral','hydrogen.*ion','hydroxide','strong acid','weak acid','buffer','pOH'],
    topic: 'pH Scale & Acids/Bases',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<defs>
  <linearGradient id="phg" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#e74c3c"/>
    <stop offset="28%" stop-color="#f39c12"/>
    <stop offset="50%" stop-color="#2ecc71"/>
    <stop offset="72%" stop-color="#3498db"/>
    <stop offset="100%" stop-color="#9b59b6"/>
  </linearGradient>
</defs>
<rect x="30" y="95" width="380" height="32" rx="8" fill="url(#phg)" opacity="0.85"/>
${Array.from({length:15},(_,i)=>`<line x1="${30+i*27}" y1="95" x2="${30+i*27}" y2="127" stroke="rgba(0,0,0,0.25)" stroke-width="1"/><text x="${30+i*27}" y="142" text-anchor="middle" font-size="9" fill="var(--text-2)" font-family="var(--font-body)" font-weight="500">${i}</text>`).join('')}
<text x="30" y="162" font-size="9" fill="#e74c3c" font-family="var(--font-body)" font-weight="600">ACID</text>
<text x="196" y="162" text-anchor="middle" font-size="9" fill="#2ecc71" font-family="var(--font-body)" font-weight="600">NEUTRAL</text>
<text x="408" y="162" text-anchor="end" font-size="9" fill="#9b59b6" font-family="var(--font-body)" font-weight="600">BASE</text>
${[
  {x:57,y:185,label:'Battery acid',sub:'pH 1',c:'#e74c3c'},
  {x:111,y:205,label:'Lemon juice',sub:'pH 3',c:'#e67e22'},
  {x:165,y:185,label:'Coffee',sub:'pH 5',c:'#f39c12'},
  {x:219,y:205,label:'Pure water',sub:'pH 7',c:'#2ecc71'},
  {x:273,y:185,label:'Baking soda',sub:'pH 9',c:'#3498db'},
  {x:354,y:205,label:'Bleach',sub:'pH 12',c:'#9b59b6'},
].map(({x,y,label,sub,c})=>`<line x1="${x}" y1="127" x2="${x}" y2="${y-12}" stroke="${c}" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/><text x="${x}" y="${y}" text-anchor="middle" font-size="9" fill="${c}" font-family="var(--font-body)" font-weight="600">${label}</text><text x="${x}" y="${y+11}" text-anchor="middle" font-size="8" fill="${c}" font-family="var(--font-body)" opacity="0.8">${sub}</text>`).join('')}
<text x="30" y="258" font-size="10" fill="#e74c3c" font-family="var(--font-body)">Acid: more H⁺ ions</text>
<text x="30" y="272" font-size="10" fill="#9b59b6" font-family="var(--font-body)">Base: more OH⁻ ions</text>
<text x="220" y="300" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">Each pH unit = 10× change in H⁺ concentration</text>
</g>`,
        text: "The pH scale measures how acidic or basic a solution is, running from 0 to 14. Acids donate hydrogen ions (H⁺) — the more H⁺, the lower the pH, the stronger the acid. Bases accept H⁺ or donate OH⁻ ions. pH 7 is neutral — pure water at 25°C. Here's the critical part: the scale is logarithmic, meaning pH 4 is TEN TIMES more acidic than pH 5, and 100 times more acidic than pH 6. This is why a tiny shift in blood pH from 7.4 to 7.0 can be life-threatening — your body's enzymes only work in a very narrow pH window."
      };
    }
  },

  // ── PHYSICS ───────────────────────────────────────────────────────────────

  {
    id: 'newtonslaws',
    keywords: ['newton','force','mass.*acceleration','inertia','F=ma','third.*law','action.*reaction','momentum','classical.*mechanics'],
    topic: "Newton's Three Laws",
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<defs><marker id="vn1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#e8ac2e" stroke-width="2"/></marker>
<marker id="vn2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#e74c3c" stroke-width="2"/></marker>
<marker id="vn3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#3498db" stroke-width="2"/></marker></defs>
<rect x="25" y="30" width="118" height="82" rx="8" fill="var(--surface-3)" stroke="var(--border-sm)" stroke-width="1"/>
<text x="84" y="48" text-anchor="middle" font-size="9" fill="var(--gold)" font-family="var(--font-body)" font-weight="700">1st LAW</text>
<text x="84" y="61" text-anchor="middle" font-size="8" fill="var(--text-2)" font-family="var(--font-body)">Inertia</text>
<circle cx="68" cy="87" r="11" fill="#3498db" opacity="0.8" style="animation:vt-bob 2s ease-in-out infinite"/>
<path d="M40 87 L56 87" stroke="#e8ac2e" stroke-width="2" fill="none" marker-end="url(#vn1)"/>
<text x="84" y="102" text-anchor="middle" font-size="8" fill="var(--text-3)" font-family="var(--font-body)">stays moving forever</text>
<rect x="161" y="30" width="118" height="82" rx="8" fill="var(--surface-3)" stroke="var(--border-sm)" stroke-width="1"/>
<text x="220" y="48" text-anchor="middle" font-size="9" fill="var(--gold)" font-family="var(--font-body)" font-weight="700">2nd LAW</text>
<text x="220" y="61" text-anchor="middle" font-size="9" fill="var(--gold)" font-family="var(--font-body)" font-weight="700">F = ma</text>
<circle cx="204" cy="87" r="8" fill="#2ecc71" opacity="0.8"/>
<circle cx="236" cy="87" r="14" fill="#2ecc71" opacity="0.5"/>
<path d="M178 87 L194 87" stroke="#e74c3c" stroke-width="2.5" fill="none" marker-end="url(#vn2)"/>
<path d="M178 87 L214 87" stroke="#3498db" stroke-width="2.5" fill="none" marker-end="url(#vn3)" style="stroke-dasharray:30;animation:vt-flow 1s linear infinite"/>
<text x="220" y="104" text-anchor="middle" font-size="8" fill="var(--text-3)" font-family="var(--font-body)">bigger mass → less acc.</text>
<rect x="297" y="30" width="118" height="82" rx="8" fill="var(--surface-3)" stroke="var(--border-sm)" stroke-width="1"/>
<text x="356" y="48" text-anchor="middle" font-size="9" fill="var(--gold)" font-family="var(--font-body)" font-weight="700">3rd LAW</text>
<text x="356" y="61" text-anchor="middle" font-size="8" fill="var(--text-2)" font-family="var(--font-body)">Action = Reaction</text>
<circle cx="336" cy="87" r="11" fill="#e74c3c" opacity="0.8"/>
<circle cx="376" cy="87" r="11" fill="#9b59b6" opacity="0.8"/>
<path d="M348 84 L364 84" stroke="#e74c3c" stroke-width="2" fill="none" marker-end="url(#vn2)"/>
<path d="M364 90 L348 90" stroke="#9b59b6" stroke-width="2" fill="none" marker-end="url(#vn3)"/>
<path d="M55 155 Q110 130 165 155 Q220 180 275 155 Q330 130 385 155" stroke="#e8ac2e" stroke-width="2" fill="none" stroke-linecap="round" stroke-dasharray="180;animation:vt-dash 1.8s ease both"/>
<circle cx="55" cy="155" r="10" fill="#3498db" opacity="0.85" style="animation:vt-bob 1.2s ease-in-out infinite"/>
<text x="220" y="205" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">Projectile path curves under gravity</text>
<rect x="35" y="220" width="370" height="44" rx="8" fill="var(--surface-3)" stroke="var(--border-sm)" stroke-width="1"/>
<text x="220" y="238" text-anchor="middle" font-size="10" fill="var(--text-2)" font-family="var(--font-body)">F = ma    →    a = F/m    →    bigger force = bigger acceleration</text>
<text x="220" y="254" text-anchor="middle" font-size="9" fill="var(--text-3)" font-family="var(--font-body)">Applies to everything from atoms to galaxies</text>
</g>`,
        text: "Newton gave us three laws that explain ALL motion in the universe. Law 1 (Inertia): objects keep doing what they're doing — moving or still — unless a force acts on them. That's why you lurch forward when a car brakes. Law 2 (F=ma): force equals mass times acceleration. Push harder → accelerate more. Push the same force on something heavier → less acceleration. Law 3: every action has an equal and opposite reaction. The rocket pushes gas backward, the gas pushes the rocket forward. You push Earth down with your weight, Earth pushes back up with exactly the same force. These three ideas built the entire field of classical mechanics."
      };
    }
  },

  {
    id: 'waves',
    keywords: ['wave','wavelength','frequency','amplitude','transverse','longitudinal','sound.*wave','light.*wave','oscillat','crest.*trough'],
    topic: 'Wave Properties',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<defs><marker id="vw1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="var(--text-3)" stroke-width="2"/></marker></defs>
<line x1="30" y1="140" x2="420" y2="140" stroke="var(--border-sm)" stroke-width="1" stroke-dasharray="4,3"/>
<path d="M30 140 Q65 68 100 140 Q135 212 170 140 Q205 68 240 140 Q275 212 310 140 Q345 68 380 140" stroke="#8b7cf8" stroke-width="2.5" fill="none" stroke-linecap="round" style="stroke-dasharray:600;animation:vt-dash 2s ease both"/>
<path d="M30 140 Q65 68 100 140 Q135 212 170 140 Q205 68 240 140 Q275 212 310 140 Q345 68 380 140" stroke="#8b7cf8" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.15" style="animation:vt-flow 2s linear infinite"/>
<line x1="100" y1="68" x2="100" y2="140" stroke="#e8ac2e" stroke-width="1.5" stroke-dasharray="3,2"/>
<text x="100" y="60" text-anchor="middle" font-size="9" fill="#e8ac2e" font-family="var(--font-body)" font-weight="600">Crest</text>
<line x1="170" y1="212" x2="170" y2="140" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="3,2"/>
<text x="170" y="226" text-anchor="middle" font-size="9" fill="#e74c3c" font-family="var(--font-body)" font-weight="600">Trough</text>
<line x1="240" y1="95" x2="240" y2="140" stroke="#2ecc71" stroke-width="1.5" stroke-dasharray="3,2"/>
<line x1="100" y1="95" x2="240" y2="95" stroke="#2ecc71" stroke-width="1.5" marker-end="url(#vw1)"/>
<line x1="240" y1="95" x2="100" y2="95" stroke="#2ecc71" stroke-width="1.5" marker-end="url(#vw1)"/>
<text x="170" y="89" text-anchor="middle" font-size="9" fill="#2ecc71" font-family="var(--font-body)" font-weight="600">λ wavelength</text>
<line x1="52" y1="140" x2="52" y2="68" stroke="#3498db" stroke-width="1.5" marker-end="url(#vw1)"/>
<line x1="52" y1="140" x2="52" y2="212" stroke="#3498db" stroke-width="1.5" marker-end="url(#vw1)"/>
<text x="40" y="144" text-anchor="end" font-size="9" fill="#3498db" font-family="var(--font-body)" font-weight="600">A</text>
<text x="22" y="136" text-anchor="middle" font-size="8" fill="#3498db" font-family="var(--font-body)">amp.</text>
<rect x="30" y="250" width="380" height="52" rx="8" fill="var(--surface-3)" stroke="var(--border-sm)" stroke-width="1"/>
<text x="220" y="268" text-anchor="middle" font-size="10" fill="var(--text-2)" font-family="var(--font-body)" font-weight="500">v = f × λ</text>
<text x="220" y="284" text-anchor="middle" font-size="9" fill="var(--text-3)" font-family="var(--font-body)">speed = frequency × wavelength</text>
<text x="220" y="297" text-anchor="middle" font-size="8" fill="var(--text-4)" font-family="var(--font-body)">Higher frequency → shorter wavelength (same speed)</text>
</g>`,
        text: "A wave is a disturbance that transfers energy without transferring matter. The crest is the peak, the trough is the valley. Amplitude is the height from rest to crest — it determines the wave's energy and intensity. Wavelength is the distance from one crest to the next. Frequency is how many complete waves pass a point per second, measured in Hertz. The golden equation is v = f × λ: wave speed equals frequency times wavelength. For light in a vacuum the speed is fixed at 300,000 km/s — so higher frequency light (violet) must have shorter wavelengths, and lower frequency light (red) has longer ones. This is the entire electromagnetic spectrum in one equation."
      };
    }
  },

  // ── BIOLOGY continued ─────────────────────────────────────────────────────

  {
    id: 'cellstructure',
    keywords: ['cell.*structur','eukaryot','organelle','mitochondr','nucleus.*cell','cell.*membrane','ribosome','golgi','endoplasmic'],
    topic: 'Eukaryotic Cell Structure',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<defs>
  <radialGradient id="vcg"><stop offset="0%" stop-color="#2ecc71" stop-opacity="0.08"/><stop offset="100%" stop-color="#27ae60" stop-opacity="0.18"/></radialGradient>
</defs>
<path d="M75 165 Q80 60 160 45 Q245 30 320 55 Q390 75 400 155 Q410 235 330 275 Q240 300 160 285 Q80 270 75 165Z" fill="url(#vcg)" stroke="#27ae60" stroke-width="1.8"/>
<path d="M78 165 Q82 62 160 48 Q244 33 318 57 Q386 77 397 155" fill="none" stroke="#27ae60" stroke-width="0.8" opacity="0.4" stroke-dasharray="4,3"/>
<ellipse cx="195" cy="155" rx="48" ry="38" fill="rgba(139,124,248,0.22)" stroke="#8b7cf8" stroke-width="2"/>
<ellipse cx="195" cy="155" rx="40" ry="30" fill="rgba(139,124,248,0.12)" stroke="#8b7cf8" stroke-width="1" stroke-dasharray="3,2"/>
<circle cx="195" cy="152" r="11" fill="#534AB7" opacity="0.7"/>
<text x="195" y="193" text-anchor="middle" font-size="9" fill="#AFA9EC" font-family="var(--font-body)" font-weight="600">Nucleus</text>
<ellipse cx="318" cy="135" rx="30" ry="18" fill="rgba(232,172,46,0.25)" stroke="#e8ac2e" stroke-width="1.5"/>
<path d="M295 135 Q305 127 318 135 Q305 143 295 135Z" fill="#e8ac2e" opacity="0.5"/>
<path d="M318 135 Q331 127 341 135 Q331 143 318 135Z" fill="#e8ac2e" opacity="0.5"/>
<text x="318" y="162" text-anchor="middle" font-size="8" fill="#e8ac2e" font-family="var(--font-body)">Mitochondria</text>
<path d="M268 205 Q285 195 302 205 Q285 215 268 205Z" fill="rgba(52,152,219,0.3)" stroke="#3498db" stroke-width="1"/>
<path d="M268 218 Q285 208 302 218 Q285 228 268 218Z" fill="rgba(52,152,219,0.3)" stroke="#3498db" stroke-width="1"/>
<path d="M268 231 Q285 221 302 231 Q285 241 268 231Z" fill="rgba(52,152,219,0.3)" stroke="#3498db" stroke-width="1"/>
<text x="285" y="250" text-anchor="middle" font-size="8" fill="#3498db" font-family="var(--font-body)">Golgi</text>
<path d="M130 218 Q128 200 140 190 Q155 182 165 192 Q168 205 158 215Z" fill="rgba(231,76,60,0.2)" stroke="#e74c3c" stroke-width="1.2"/>
<text x="140" y="238" text-anchor="middle" font-size="8" fill="#e74c3c" font-family="var(--font-body)">Lysosome</text>
${[[108,102],[118,120],[100,135]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3" fill="#f1c40f" opacity="0.9"/>`).join('')}
<text x="95" y="92" text-anchor="middle" font-size="8" fill="#f1c40f" font-family="var(--font-body)">Ribosomes</text>
<path d="M355 195 Q368 190 375 200 Q370 215 355 215 Q342 215 340 200 Q345 188 355 195Z" fill="rgba(46,204,113,0.25)" stroke="#2ecc71" stroke-width="1.2"/>
<text x="362" y="232" text-anchor="middle" font-size="8" fill="#2ecc71" font-family="var(--font-body)">Vacuole</text>
<text x="220" y="322" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">Every organelle has a specific job — like organs in a body</text>
</g>`,
        text: "A eukaryotic cell is a miniature city, and every organelle is a specialized department. The nucleus is city hall — it holds the DNA blueprints and controls everything. Mitochondria are the power plants — they take glucose and oxygen and produce ATP energy. The Golgi apparatus is the post office — it packages and ships proteins to the right addresses. Ribosomes are the factories — tiny machines that read RNA instructions and build proteins. Lysosomes are the recycling centers — they break down waste and old organelles. All of this packed into a space 10 micrometres wide, running 24/7 without stopping."
      };
    }
  },

  {
    id: 'enzyme',
    keywords: ['enzyme','substrate','active.*site','lock.*key','induced.*fit','catalyst','activation.*energy','inhibitor','denatured'],
    topic: 'Enzymes & Active Sites',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<defs><marker id="ve1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="var(--text-3)" stroke-width="2"/></marker></defs>
<text x="80" y="32" text-anchor="middle" font-size="10" fill="var(--text-2)" font-family="var(--font-body)" font-weight="600">1. Substrate approaches</text>
<path d="M35 75 Q38 55 60 52 Q95 48 110 58 Q125 68 118 85 Q108 105 85 108 Q55 110 42 95 Q32 85 35 75Z" fill="rgba(45,212,191,0.25)" stroke="#2dd4bf" stroke-width="2"/>
<path d="M65 80 Q70 68 85 68 Q98 68 100 80 Q100 92 85 92 Q70 92 65 80Z" fill="rgba(45,212,191,0.15)" stroke="#2dd4bf" stroke-width="1.5" stroke-dasharray="3,2"/>
<text x="75" y="128" text-anchor="middle" font-size="9" fill="#2dd4bf" font-family="var(--font-body)">Enzyme</text>
<circle cx="128" cy="78" r="14" fill="rgba(232,172,46,0.7)" stroke="#e8ac2e" stroke-width="1.5" style="animation:vt-bob 1.2s ease-in-out infinite"/>
<text x="128" y="103" text-anchor="middle" font-size="8" fill="#e8ac2e" font-family="var(--font-body)">Substrate</text>
<text x="220" y="32" text-anchor="middle" font-size="10" fill="var(--text-2)" font-family="var(--font-body)" font-weight="600">2. Lock & key fit</text>
<path d="M175 75 Q178 55 200 52 Q235 48 250 58 Q265 68 258 85 Q248 105 225 108 Q195 110 182 95 Q172 85 175 75Z" fill="rgba(45,212,191,0.25)" stroke="#2dd4bf" stroke-width="2"/>
<path d="M205 80 Q210 68 225 68 Q238 68 240 80 Q240 92 225 92 Q210 92 205 80Z" fill="rgba(232,172,46,0.45)" stroke="#e8ac2e" stroke-width="1.5"/>
<text x="215" y="128" text-anchor="middle" font-size="9" fill="#2dd4bf" font-family="var(--font-body)">ES Complex</text>
<text x="355" y="32" text-anchor="middle" font-size="10" fill="var(--text-2)" font-family="var(--font-body)" font-weight="600">3. Products released</text>
<path d="M305 75 Q308 55 330 52 Q365 48 380 58 Q395 68 388 85 Q378 105 355 108 Q325 110 312 95 Q302 85 305 75Z" fill="rgba(45,212,191,0.25)" stroke="#2dd4bf" stroke-width="2"/>
<path d="M335 80 Q340 68 355 68 Q368 68 370 80 Q370 92 355 92 Q340 92 335 80Z" fill="rgba(45,212,191,0.15)" stroke="#2dd4bf" stroke-width="1.5" stroke-dasharray="3,2"/>
<circle cx="385" cy="68" r="9" fill="rgba(52,211,153,0.7)" stroke="#34d399" stroke-width="1.5" style="animation:vt-bob 0.9s ease-in-out infinite"/>
<circle cx="398" cy="85" r="8" fill="rgba(52,211,153,0.7)" stroke="#34d399" stroke-width="1.5" style="animation:vt-bob 0.9s ease-in-out 0.4s infinite"/>
<text x="355" y="128" text-anchor="middle" font-size="9" fill="#34d399" font-family="var(--font-body)">Products</text>
<path d="M140 82 L168 82" stroke="var(--text-3)" stroke-width="1.5" fill="none" marker-end="url(#ve1)"/>
<path d="M272 82 L298 82" stroke="var(--text-3)" stroke-width="1.5" fill="none" marker-end="url(#ve1)"/>
<rect x="55" y="155" width="330" height="55" rx="8" fill="var(--surface-3)" stroke="var(--border-sm)" stroke-width="1"/>
<path d="M80 205 Q100 165 130 185 Q160 205 190 165 Q195 158 220 158" stroke="#8b7cf8" stroke-width="2" fill="none" stroke-linecap="round"/>
<text x="232" y="162" font-size="8" fill="#8b7cf8" font-family="var(--font-body)">with enzyme</text>
<path d="M80 205 Q120 205 150 195 Q185 182 220 175" stroke="var(--text-4)" stroke-width="1.5" fill="none" stroke-dasharray="4,3"/>
<text x="232" y="178" font-size="8" fill="var(--text-4)" font-family="var(--font-body)">without</text>
<text x="220" y="230" text-anchor="middle" font-size="8" fill="var(--text-3)" font-family="var(--font-body)">Enzyme lowers activation energy needed</text>
<text x="220" y="298" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">Enzymes are reusable — released unchanged after each reaction</text>
</g>`,
        text: "Enzymes are proteins that act as biological catalysts — they speed up chemical reactions by a million times without being used up. Each enzyme has an active site — a precisely shaped pocket that fits one specific substrate like a lock and key. The substrate binds to the active site, gets transformed into products, and then releases. The enzyme is left unchanged, ready to do it again. Without enzymes, reactions like digesting food or copying DNA would take thousands of years. Temperature and pH affect enzyme shape — too hot or too acidic and the enzyme denatures (unfolds) and permanently loses its shape."
      };
    }
  },

  {
    id: 'bloodcells',
    keywords: ['blood.*cell','red blood','white blood','platelet','haemoglobin','hemoglobin','immune.*blood','RBC','WBC','plasma'],
    topic: 'Blood Cells & Components',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<rect x="25" y="35" width="390" height="220" rx="12" fill="rgba(231,76,60,0.06)" stroke="rgba(231,76,60,0.2)" stroke-width="1.5"/>
<text x="220" y="26" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">Blood plasma (55%) — yellow liquid carrying nutrients, hormones, waste</text>
${[
  [65,95],[120,78],[175,98],[55,138],[105,155],[155,135],[68,175],[130,180],[175,160],[90,118],[148,108],
].map(([x,y],i)=>`<ellipse cx="${x}" cy="${y}" rx="13" ry="9" fill="#e74c3c" opacity="${0.75+i*0.02}" style="animation:vt-bob ${1+i*0.08}s ease-in-out ${i*0.06}s infinite"/>`).join('')}
<text x="115" y="210" text-anchor="middle" font-size="9" fill="#e74c3c" font-family="var(--font-body)" font-weight="600">Red blood cells (45%)</text>
<text x="115" y="222" text-anchor="middle" font-size="8" fill="var(--text-3)" font-family="var(--font-body)">carry O₂ via haemoglobin · no nucleus · biconcave disc</text>
${[[280,90],[330,75],[375,95],[290,135],[348,148],[385,128]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${10+i%2*3}" fill="rgba(139,124,248,${0.5+i*0.05})" stroke="#8b7cf8" stroke-width="1" style="animation:vt-pulse ${1.4+i*0.1}s ease-in-out ${i*0.15}s infinite"/>`).join('')}
<text x="330" y="175" text-anchor="middle" font-size="9" fill="#8b7cf8" font-family="var(--font-body)" font-weight="600">White blood cells (&lt;1%)</text>
<text x="330" y="187" text-anchor="middle" font-size="8" fill="var(--text-3)" font-family="var(--font-body)">fight infection · larger · have nucleus</text>
${[[268,218],[295,212],[322,220],[349,215],[376,222]].map(([x,y],i)=>`<ellipse cx="${x}" cy="${y}" rx="7" ry="4" fill="rgba(232,172,46,0.6)" stroke="#e8ac2e" stroke-width="0.8" style="animation:vt-bob ${0.9+i*0.05}s ease-in-out ${i*0.05}s infinite"/>`).join('')}
<text x="330" y="238" text-anchor="middle" font-size="8" fill="#e8ac2e" font-family="var(--font-body)">Platelets — clot wounds</text>
<text x="220" y="288" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">1 mm³ of blood: 5 million RBCs · 7,000 WBCs · 250,000 platelets</text>
</g>`,
        text: "Blood is a tissue — a liquid connective tissue carrying out life-critical jobs. Red blood cells are the most numerous: biconcave discs (like a squashed donut) packed with haemoglobin that grabs oxygen in the lungs and drops it off at every tissue. They have no nucleus, maximising space for haemoglobin. White blood cells are your immune army — they recognise pathogens and destroy them. Platelets are tiny fragments that clump together at a wound and release chemicals that trigger clotting to seal the damage. The yellowish plasma carries glucose, hormones, antibodies, and carries carbon dioxide back to the lungs. Every second, your bone marrow produces 3.5 million new red blood cells."
      };
    }
  },

  // ── ECONOMICS ─────────────────────────────────────────────────────────────

  {
    id: 'supplydemand',
    keywords: ['supply.*demand','demand.*supply','equilibrium.*price','market.*price','price.*mechanism','consumer.*surplus','producer.*surplus','shift.*demand','shift.*supply'],
    topic: 'Supply & Demand',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<defs>
  <marker id="vsd1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="var(--text-3)" stroke-width="2"/></marker>
</defs>
<line x1="55" y1="25" x2="55" y2="265" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round" marker-end="url(#vsd1)"/>
<line x1="45" y1="255" x2="400" y2="255" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round" marker-end="url(#vsd1)"/>
<text x="45" y="20" text-anchor="middle" font-size="10" fill="var(--text-2)" font-family="var(--font-body)" font-weight="600">Price</text>
<text x="400" y="268" text-anchor="middle" font-size="10" fill="var(--text-2)" font-family="var(--font-body)" font-weight="600">Quantity</text>
<path d="M80 60 Q180 120 380 230" stroke="#e74c3c" stroke-width="2.5" fill="none" stroke-linecap="round" style="stroke-dasharray:380;animation:vt-dash 1.5s ease both"/>
<text x="388" y="225" font-size="10" fill="#e74c3c" font-family="var(--font-body)" font-weight="700">D</text>
<text x="330" y="82" font-size="9" fill="#e74c3c" font-family="var(--font-body)">Demand curve</text>
<text x="330" y="94" font-size="8" fill="var(--text-3)" font-family="var(--font-body)">(higher price → less bought)</text>
<path d="M80 230 Q180 170 380 60" stroke="#2ecc71" stroke-width="2.5" fill="none" stroke-linecap="round" style="stroke-dasharray:380;animation:vt-dash 1.5s ease 0.4s both"/>
<text x="388" y="56" font-size="10" fill="#2ecc71" font-family="var(--font-body)" font-weight="700">S</text>
<text x="68" y="218" font-size="9" fill="#2ecc71" font-family="var(--font-body)">Supply curve</text>
<text x="68" y="230" font-size="8" fill="var(--text-3)" font-family="var(--font-body)">(higher price → more produced)</text>
<circle cx="230" cy="145" r="7" fill="#e8ac2e" style="animation:vt-pulse 1.2s ease-in-out infinite"/>
<line x1="230" y1="145" x2="230" y2="255" stroke="#e8ac2e" stroke-width="1" stroke-dasharray="4,3"/>
<line x1="55" y1="145" x2="230" y2="145" stroke="#e8ac2e" stroke-width="1" stroke-dasharray="4,3"/>
<text x="237" y="142" font-size="9" fill="#e8ac2e" font-family="var(--font-body)" font-weight="700">Equilibrium</text>
<text x="237" y="154" font-size="8" fill="var(--text-3)" font-family="var(--font-body)">P* and Q*</text>
<text x="220" y="290" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-body)">Where curves cross: market clears — no surplus, no shortage</text>
</g>`,
        text: "Supply and demand is the engine of every market. The demand curve slopes downward — as price rises, buyers want less. The supply curve slopes upward — as price rises, producers make more. Where they intersect is the equilibrium: the price at which exactly the right amount is produced and consumed, with nothing left over and nobody going without. If something shifts — a drought cuts coffee supply, or a new study boosts demand for avocados — the curves shift and a new equilibrium forms at a different price and quantity. This model predicts how wages, rents, oil prices, and even taxi fares respond to the real world."
      };
    }
  },

  // ── EARTH SCIENCE ─────────────────────────────────────────────────────────

  {
    id: 'watercycle',
    keywords: ['water cycle','hydrological','evaporation','condensation','precipitation','transpiration','runoff','groundwater'],
    topic: 'The Water Cycle',
    render() {
      return {
        svg: `<g style="animation:vt-fi 0.5s ease both">
<defs>
  <marker id="vwc1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#3498db" stroke-width="2"/></marker>
  <marker id="vwc2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#7f8c8d" stroke-width="2"/></marker>
  <linearGradient id="vwcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3498db" stop-opacity="0.5"/><stop offset="100%" stop-color="#3498db" stop-opacity="0.15"/></linearGradient>
</defs>
<path d="M25 255 Q100 230 160 235 Q220 240 280 235 Q340 230 415 255 L415 310 L25 310Z" fill="url(#vwcg)" stroke="#3498db" stroke-width="1.5"/>
<text x="220" y="278" text-anchor="middle" font-size="10" fill="#3498db" font-family="var(--font-body)" font-weight="500">Ocean / Sea</text>
<path d="M310 255 Q315 200 325 160 Q340 120 360 100 Q380 82 415 75 L415 255Z" fill="rgba(101,131,91,0.35)" stroke="rgba(101,131,91,0.6)" stroke-width="1.5"/>
<text x="372" y="175" text-anchor="middle" font-size="9" fill="#27ae60" font-family="var(--font-body)" font-weight="500">Mountain</text>
<path d="M155 240 Q162 175 172 130" stroke="#3498db" stroke-width="1.5" fill="none" stroke-dasharray="5,4" style="animation:vt-flow 1.8s linear infinite" marker-end="url(#vwc1)"/>
<text x="133" y="185" font-size="9" fill="#3498db" font-family="var(--font-body)" font-weight="500">Evaporation</text>
<path d="M260 240 Q262 195 265 165" stroke="#3498db" stroke-width="1" fill="none" stroke-dasharray="5,4" style="animation:vt-flow 2.2s linear 0.4s infinite" marker-end="url(#vwc1)"/>
<path d="M85 255 Q82 215 80 185" stroke="#2ecc71" stroke-width="1" fill="none" stroke-dasharray="4,4" style="animation:vt-flow 2s linear 0.8s infinite" marker-end="url(#vwc1)"/>
<text x="60" y="215" font-size="8" fill="#2ecc71" font-family="var(--font-body)">Transpiration</text>
<path d="M80 75 Q130 55 190 65 Q240 72 290 62 Q330 55 370 65" stroke="#7f8c8d" stroke-width="2" fill="none"/>
<ellipse cx="100" cy="68" rx="42" ry="22" fill="rgba(127,140,141,0.35)" stroke="rgba(127,140,141,0.5)" stroke-width="1.5"/>
<ellipse cx="175" cy="58" rx="55" ry="26" fill="rgba(127,140,141,0.4)" stroke="rgba(127,140,141,0.5)" stroke-width="1.5"/>
<ellipse cx="280" cy="55" rx="60" ry="28" fill="rgba(127,140,141,0.45)" stroke="rgba(127,140,141,0.5)" stroke-width="1.5"/>
<text x="280" y="59" text-anchor="middle" font-size="9" fill="white" font-family="var(--font-body)" font-weight="500">Cloud (condensation)</text>
${[[240,95],[252,108],[228,112],[260,122],[235,130]].map(([x,y],i)=>`<path d="M${x} ${y} L${x-2} ${y+14}" stroke="#3498db" stroke-width="2" fill="none" stroke-linecap="round" style="animation:vt-flow 1s linear ${i*0.18}s infinite" marker-end="url(#vwc1)"/>`).join('')}
<text x="270" y="145" font-size="9" fill="#3498db" font-family="var(--font-body)" font-weight="500">Precipitation</text>
<path d="M230 230 Q290 248 355 252" stroke="#3498db" stroke-width="2" fill="none" stroke-linecap="round" style="stroke-dasharray:100;animation:vt-flow 1.5s linear infinite" marker-end="url(#vwc1)"/>
<text x="295" y="245" text-anchor="middle" font-size="9" fill="#3498db" font-family="var(--font-body)">Runoff</text>
</g>`,
        text: "The water cycle is the planet's most important recycling system — every water molecule on Earth has been cycling for billions of years. Heat from the sun causes evaporation from oceans and lakes, sending water vapor upward. Plants add to this through transpiration — releasing water through their leaves. As vapor rises and cools, it condenses around tiny particles to form clouds. When droplets grow heavy enough, precipitation falls as rain or snow. On land, water runs off into rivers back to the sea, or soaks into the ground as groundwater. This continuous cycle distributes fresh water across the planet and drives weather patterns."
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
  // Save the inner SVG content (the <g> fragments), not the outer <svg> wrapper
  const svg   = document.getElementById('vt-svg')?.innerHTML || '';
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('chunks_vt_session_' + _vtSessionId, JSON.stringify({ html, topic, svg }));
    localStorage.setItem('chunks_active_vt_session', _vtSessionId);
  } catch(e) {}
}

function _vtLoadSession(id) {
  try {
    if (typeof localStorage === 'undefined') return null;
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

  // WhiteboardEngine wipes vt-canvas-area on every AI call, so always
  // rebuild #vt-svg from scratch inside the container.
  const area = document.getElementById('vt-canvas-area');
  if (area) {
    area.innerHTML =
      `<svg id="vt-svg" viewBox="0 0 440 340" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">` +
      result.svg +
      `</svg>`;
  }

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
    // Only create a new sidebar entry on the FIRST message of a session
    // Subsequent messages just update the label and save
    if (!_vtSessionId && window.recentAdd) {
      window.recentAdd(text, null, 'visual');
      // Grab the session id from the item recentAdd just created
      if (window._recentItems && window._recentItems.length) {
        const latest = window._recentItems[0];
        if (latest.source === 'visual') _vtSessionId = latest.id;
      }
    } else if (_vtSessionId && window._recentItems) {
      // Update the existing entry's label to reflect the latest question
      const existing = window._recentItems.find(r => r.id === _vtSessionId);
      if (existing) {
        existing.label = text.length > 32 ? text.slice(0, 32).trimEnd() + '…' : text;
        existing.question = text;
        if (typeof window._saveRecent === 'function') window._saveRecent();
        window._renderAllRecent?.();
      }
    }
    _vtSaveSession();
    return;
  } else {
    div.innerHTML = `<div class="vt-avatar"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/><ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/><ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/><circle cx="50" cy="50" r="6" fill="#e8ac2e"/></svg></div><div class="vt-bubble"></div>`;
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

// ── AI fallback — powered by VisualTutorRenderer ────────────────────────────

let _vtRenderer = null;

async function _getRenderer() {
  if (_vtRenderer) return _vtRenderer;
  const { VisualTutorRenderer } = await import(/* @vite-ignore */ '../visual-tutor/VisualTutorRenderer.js');
  _vtRenderer = new VisualTutorRenderer(
    document.getElementById('vt-canvas-area'),
    {
      apiBase:      window.API_BASE,
      getLanguage:  () => localStorage.getItem('chunks_setting_language') || 'Auto-detect',
      getSafeMode:  () => localStorage.getItem('chunks_setting_safe-content') === '1',

      onNarration: (text, stepIdx, total) => {
        if (text) _vtAddMsg(text, 'ai');
      },

      onTopic: (name) => {
        const topicEl = document.getElementById('vt-canvas-topic');
        if (topicEl) topicEl.textContent = name;
      },

      onComplete: () => {
        const dot = document.getElementById('vt-canvas-dot');
        if (dot) dot.style.background = '#4ade80';
        _vtShowStepNav(true);  // keep nav visible on complete, show replay
        _vtAddMsg('Diagram complete! Ask me anything about it to go deeper.', 'ai');
      },

      onError: (err) => {
        const dot = document.getElementById('vt-canvas-dot');
        if (dot) dot.style.background = '#f87171';
        _vtHideStepNav();
        console.error('[VisualTutor]', err);
      },

      onModeChange: (mode) => {
        const dot = document.getElementById('vt-canvas-dot');
        if (!dot) return;
        if (mode === 'whiteboard')  dot.style.background = '#60a5fa';
        if (mode === 'simulation')  { dot.style.background = '#a78bfa'; _vtHideStepNav(); }
        if (mode === 'idle')        { dot.style.background = '#4ade80'; _vtHideStepNav(); }
      },

      onStepComplete: (idx, total) => {
        _vtUpdateStepNav(idx, total);
      },
    }
  );
  return _vtRenderer;
}

// ── Step nav helpers ──────────────────────────────────────────────────────────

function _vtShowStepNav(isComplete) {
  const nav   = document.getElementById('vt-step-nav');
  const pills = document.getElementById('vt-quick-pills');
  if (nav)   nav.style.display   = '';
  if (pills) pills.style.display = 'none';

  const nextBtn = document.getElementById('vt-step-next');
  if (nextBtn) {
    if (isComplete) {
      nextBtn.textContent = 'Replay';
      nextBtn.innerHTML = 'Replay <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.63"/></svg>';
      nextBtn.onclick = () => { _vtRenderer && _vtRenderer.goToStep(0); };
    } else {
      nextBtn.innerHTML = 'Next step <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
      nextBtn.onclick = () => window._vtNextStep();
    }
  }
}

function _vtHideStepNav() {
  const nav   = document.getElementById('vt-step-nav');
  const pills = document.getElementById('vt-quick-pills');
  if (nav)   nav.style.display   = 'none';
  if (pills) pills.style.display = '';
}

function _vtUpdateStepNav(idx, total) {
  _vtShowStepNav(false);

  // Dots
  const dotsEl = document.getElementById('vt-step-dots');
  if (dotsEl) {
    dotsEl.innerHTML = '';
    const max = Math.min(total, 12); // cap at 12 dots
    for (let i = 0; i < max; i++) {
      const d = document.createElement('span');
      d.className = 'vt-step-dot' + (i <= idx ? ' vt-step-dot-active' : '');
      if (i === idx) d.className += ' vt-step-dot-current';
      dotsEl.appendChild(d);
    }
  }

  // Back button — disabled on first step
  const backBtn = document.getElementById('vt-step-back');
  if (backBtn) {
    backBtn.disabled = (idx === 0);
    backBtn.style.opacity = (idx === 0) ? '0.35' : '';
  }

  // Next button label — "Finish" on last step
  const nextBtn = document.getElementById('vt-step-next');
  if (nextBtn) {
    const isLast = (idx >= total - 1);
    nextBtn.innerHTML = isLast
      ? 'Finish <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : 'Next step <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
    nextBtn.onclick = () => window._vtNextStep();
  }
}

if (typeof window !== 'undefined') window._vtNextStep = function() {
  if (!_vtRenderer) return;
  const idx   = _vtRenderer.currentStep;
  const total = _vtRenderer.totalSteps;
  if (idx >= total - 1) {
    // Was on last step — trigger done
    _vtShowStepNav(true);
    return;
  }
  _vtRenderer.nextStep();
};

if (typeof window !== 'undefined') window._vtPrevStep = function() {
  if (!_vtRenderer) return;
  const idx = _vtRenderer.currentStep;
  if (idx <= 0) return;
  _vtRenderer.goToStep(idx - 1);
};

async function _vtAskAI(q) {
  const dot = document.getElementById('vt-canvas-dot');
  if (dot) dot.style.background = '#facc15';

  try {
    const renderer = await _getRenderer();
    // Update the container reference in case the DOM was rebuilt (e.g. after _vtClear)
    renderer._container = document.getElementById('vt-canvas-area');
    await renderer.ask(q);
  } catch (e) {
    if (e.name === 'AbortError') return;
    _vtAddMsg("Sorry, I couldn\'t generate a diagram right now. Try one of the pre-built topics!", 'ai');
    if (dot) dot.style.background = '#f87171';
  }
}

// Stop any running animation when clearing the canvas
if (typeof window !== 'undefined') {
  const _vtOrigClear = window._vtClear;
  window._vtClear = function() {
    _vtRenderer?.stop();
    _vtOrigClear?.();
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') window._vtAsk = function(q) {
  if (!q.trim()) return;
  const input = document.getElementById('vt-input');
  if (input) input.value = '';
  _vtAddMsg(q, 'user');

  const scene = _vtMatchScene(q);
  if (scene) {
    const text = _vtRenderScene(scene, q);
    setTimeout(() => _vtAddMsg(text, 'ai'), 200);
  } else {
    const area = document.getElementById('vt-canvas-area');
    if (area) {
      area.innerHTML =
        `<svg id="vt-svg" viewBox="0 0 440 340" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">` +
        `<text x="220" y="165" text-anchor="middle" font-size="13" fill="var(--text-4)" font-family="var(--font-body)">Thinking about ${q}...</text>` +
        `</svg>`;
    }
    _vtAddMsg("Let me think about that for you...", 'ai');
    _vtAskAI(q);
  }
};

if (typeof window !== 'undefined') window._vtSendInput = function() {
  const input = document.getElementById('vt-input');
  if (input) window._vtAsk(input.value);
};

if (typeof window !== 'undefined') window._vtBack = function() {
  if (window.showScreen) window.showScreen(_vtPrevScreen || 'flash');
};

if (typeof window !== 'undefined') window._vtClear = function() {
  const area = document.getElementById('vt-canvas-area');
  if (area) {
    area.innerHTML =
      `<svg id="vt-svg" viewBox="0 0 440 340" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">` +
      `<text x="220" y="155" text-anchor="middle" font-size="14" fill="var(--text-4)" font-family="var(--font-body)">Ask me to explain anything</text>` +
      `<text x="220" y="178" text-anchor="middle" font-size="12" fill="var(--text-4)" font-family="var(--font-body)" opacity="0.6">I'll draw it here as I explain</text>` +
      `</svg>`;
  }
  _vtHideStepNav();
  const dot = document.getElementById('vt-canvas-dot');
  if (dot) dot.style.background = '#4ade80';
  const topicEl = document.getElementById('vt-canvas-topic');
  if (topicEl) topicEl.textContent = 'Waiting for a concept...';
  const msgs = document.getElementById('vt-chat-msgs');
  if (msgs) {
    msgs.innerHTML = `<div class="vt-msg vt-msg-ai"><div class="vt-avatar"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/><ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/><ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/><circle cx="50" cy="50" r="6" fill="#e8ac2e"/></svg></div><div class="vt-bubble">Hi! I'm your visual tutor. Ask me to explain any concept — I'll draw it on the canvas as I talk. Try "explain osmosis" or tap a concept on the left.</div></div>`;
  }
  // Clear session so next message starts a fresh recent entry
  _vtSessionId = null;
  if (typeof localStorage !== 'undefined') localStorage.removeItem('chunks_active_vt_session');
};

// Called from flashcard Hard rating to open tutor on a specific concept
if (typeof window !== 'undefined') window._vtOpenForConcept = function(front, back) {
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
if (typeof window !== 'undefined') window._vtRestoreSession = function(sessionId, question) {
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
    }

    // Restore SVG canvas — use saved SVG if available, else re-render from scene library
    const area = document.getElementById('vt-canvas-area');
    if (area) {
      if (session.svg) {
        area.innerHTML =
          `<svg id="vt-svg" viewBox="0 0 440 340" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">` +
          session.svg + `</svg>`;
        const dot = document.getElementById('vt-canvas-dot');
        if (dot) dot.style.background = '#4ade80';
      } else if (session.topic) {
        const scene = _vtMatchScene(session.topic);
        if (scene) {
          area.innerHTML =
            `<svg id="vt-svg" viewBox="0 0 440 340" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">` +
            scene.render(session.topic).svg + `</svg>`;
          const dot = document.getElementById('vt-canvas-dot');
          if (dot) dot.style.background = '#4ade80';
        } else {
          area.innerHTML =
            `<svg id="vt-svg" viewBox="0 0 440 340" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">` +
            `<text x="220" y="148" text-anchor="middle" font-size="13" fill="var(--text-3)" font-family="var(--font-body)">💡 ${session.topic}</text>` +
            `<text x="220" y="172" text-anchor="middle" font-size="11" fill="var(--text-4)" font-family="var(--font-body)">Ask a follow-up to redraw the canvas</text>` +
            `</svg>`;
        }
      }
    }
  } else if (question) {
    // No saved HTML — pre-fill input so user can re-ask
    const input = document.getElementById('vt-input');
    if (input) { input.value = question; input.focus(); }
  }
};

// ── Mount ──────────────────────────────────────────────────────────────────

let _vtMounted = false;

export function mountVisualTutorScreen() {
  if (_vtMounted) return;   // prevent double-mount / duplicate event listeners
  _vtMounted = true;
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

      // ── Pick up weak-concept prefill from Exam results (Task 1) ──
      try {
        const raw = sessionStorage.getItem('exam_weak_prefill');
        if (raw) {
          const { vtQuery } = JSON.parse(raw);
          if (vtQuery) {
            input.value = vtQuery;
            setTimeout(() => input.focus(), 150);
          }
          sessionStorage.removeItem('exam_weak_prefill');
        }
      } catch(e) {}
    }

    // Wire pill buttons directly — avoids double-fire from global data-action delegation
    document.querySelectorAll('#vt-quick-pills .vt-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.getAttribute('data-query');
        if (q && window._vtAsk) window._vtAsk(q);
      });
    });
  }, 100);

  // ── Restore last visual session on page refresh ──
  (function _restoreVtSession() {
    const savedId = localStorage.getItem('chunks_active_vt_session');
    if (!savedId) return;

    const lastScreen = (() => {
      try { return (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('chunks_last_screen') : null; } catch(e) { return null; }
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
      const area2 = document.getElementById('vt-canvas-area');
      if (area2) {
        if (session.svg) {
          area2.innerHTML =
            `<svg id="vt-svg" viewBox="0 0 440 340" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">` +
            session.svg + `</svg>`;
          const dot = document.getElementById('vt-canvas-dot');
          if (dot) dot.style.background = '#4ade80';
        } else {
          const scene = _vtMatchScene(session.topic);
          if (scene) {
            area2.innerHTML =
              `<svg id="vt-svg" viewBox="0 0 440 340" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">` +
              scene.render(session.topic).svg + `</svg>`;
            const dot = document.getElementById('vt-canvas-dot');
            if (dot) dot.style.background = '#4ade80';
          } else {
            area2.innerHTML =
              `<svg id="vt-svg" viewBox="0 0 440 340" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">` +
              `<text x="220" y="148" text-anchor="middle" font-size="13" fill="var(--text-3)" font-family="var(--font-body)">💡 ${session.topic}</text>` +
              `<text x="220" y="172" text-anchor="middle" font-size="11" fill="var(--text-4)" font-family="var(--font-body)">Ask a follow-up to redraw the canvas</text>` +
              `</svg>`;
          }
        }
      }
    }

    _vtSessionId = savedId;
    setTimeout(() => {
      if (window._setActiveRecent) window._setActiveRecent(savedId);
    }, 200);
  })();

  console.log('[VisualTutorScreen] mounted ✦');
}

if (typeof document !== 'undefined') mountVisualTutorScreen();
