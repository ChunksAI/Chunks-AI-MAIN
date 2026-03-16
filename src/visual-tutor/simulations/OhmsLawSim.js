/**
 * src/visual-tutor/simulations/OhmsLawSim.js
 * Interactive Ohm's Law simulation: V = I × R
 */

export const html = `
<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;font-family:var(--font-body,sans-serif);color:var(--text-1,#e8edf2);">
  <svg id="ohm-svg" viewBox="0 0 420 200" width="100%" style="max-height:180px;margin-bottom:10px;" xmlns="http://www.w3.org/2000/svg">
    <!-- Circuit rectangle -->
    <rect x="60" y="30" width="300" height="130" rx="8" fill="none" stroke="rgba(200,214,229,0.2)" stroke-width="1.5"/>
    <!-- Battery (top) -->
    <rect x="168" y="24" width="84" height="28" rx="6" fill="#EF9F27" opacity="0.85"/>
    <text x="210" y="42" text-anchor="middle" font-size="11" fill="#412402" font-weight="600">Battery (V)</text>
    <!-- Resistor (bottom) -->
    <rect x="168" y="138" width="84" height="28" rx="6" fill="#AFA9EC" opacity="0.85"/>
    <text x="210" y="156" text-anchor="middle" font-size="11" fill="#26215C" font-weight="600">Resistor (R)</text>
    <!-- Animated current wires -->
    <!-- Top-left corner wire -->
    <path id="ohm-w1" d="M60 95 L60 38 L168 38" stroke="#e74c3c" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="40" stroke-dashoffset="40"/>
    <!-- Top-right corner wire -->
    <path id="ohm-w2" d="M252 38 L360 38 L360 95" stroke="#e74c3c" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="40" stroke-dashoffset="40"/>
    <!-- Bottom-right corner wire -->
    <path id="ohm-w3" d="M360 95 L360 152 L252 152" stroke="#3498db" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="40" stroke-dashoffset="40"/>
    <!-- Bottom-left corner wire -->
    <path id="ohm-w4" d="M168 152 L60 152 L60 95" stroke="#3498db" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="40" stroke-dashoffset="40"/>
    <!-- Readout box -->
    <rect x="140" y="68" width="140" height="58" rx="7" fill="var(--surface-2,#1a1d24)" opacity="0.95"/>
    <text id="ohm-formula" x="210" y="92" text-anchor="middle" font-size="20" fill="var(--text-1,#e8edf2)" font-weight="700">V = I × R</text>
    <text id="ohm-result"  x="210" y="112" text-anchor="middle" font-size="11" fill="#f1c40f"></text>
    <text id="ohm-power"   x="210" y="126" text-anchor="middle" font-size="10" fill="rgba(200,214,229,0.5)"></text>
    <!-- Current direction label -->
    <text x="36" y="99" text-anchor="middle" font-size="9" fill="#e74c3c">I →</text>
  </svg>

  <div style="display:flex;gap:20px;width:100%;max-width:380px;margin-bottom:8px;">
    <div style="flex:1;">
      <label style="font-size:10px;color:#EF9F27;display:block;margin-bottom:4px;">Voltage (V): <span id="ohm-v-val">12V</span></label>
      <input id="ohm-v" type="range" min="1" max="24" value="12" style="width:100%;accent-color:#EF9F27;"/>
    </div>
    <div style="flex:1;">
      <label style="font-size:10px;color:#AFA9EC;display:block;margin-bottom:4px;">Resistance (Ω): <span id="ohm-r-val">6Ω</span></label>
      <input id="ohm-r" type="range" min="1" max="24" value="6" style="width:100%;accent-color:#AFA9EC;"/>
    </div>
  </div>
  <p id="ohm-status" style="font-size:11px;color:var(--text-3,#c8d6e5);text-align:center;margin:0;min-height:28px;"></p>
</div>`;

export const text = "Adjust voltage and resistance to see how current changes. V = I × R — Ohm's Law. Doubling voltage doubles current. Doubling resistance halves current. Power (P = V × I) tells you how much energy the circuit uses.";

export function init(container) {
  const vSlider = container.querySelector('#ohm-v');
  const rSlider = container.querySelector('#ohm-r');
  const vVal    = container.querySelector('#ohm-v-val');
  const rVal    = container.querySelector('#ohm-r-val');
  const result  = container.querySelector('#ohm-result');
  const power   = container.querySelector('#ohm-power');
  const status  = container.querySelector('#ohm-status');

  // Animate wires using CSS animation speed based on current
  const wires = ['#ohm-w1','#ohm-w2','#ohm-w3','#ohm-w4'].map(id => container.querySelector(id));

  function render() {
    const V = parseInt(vSlider.value);
    const R = parseInt(rSlider.value);
    const I = (V / R).toFixed(2);
    const P = (V * V / R).toFixed(1);

    vVal.textContent = V + 'V';
    rVal.textContent = R + 'Ω';
    result.textContent = `${V}V ÷ ${R}Ω = ${I}A`;
    power.textContent  = `Power = ${P}W`;

    // Wire animation speed: faster current = faster animation
    const speed = Math.max(0.4, 2.0 - parseFloat(I) * 0.15);
    wires.forEach((w, i) => {
      if (!w) return;
      w.style.animation = `ohm-flow ${speed.toFixed(2)}s linear ${(i * speed / 4).toFixed(2)}s infinite`;
    });

    // Inject keyframes if not yet present
    if (!container.querySelector('#ohm-style')) {
      const s = document.createElement('style');
      s.id = 'ohm-style';
      s.textContent = `@keyframes ohm-flow { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }`;
      container.appendChild(s);
    }

    // Status
    const level = parseFloat(I);
    if (level < 1) {
      status.textContent = `🔵 Low current (${I}A) — high resistance limiting flow. Like a narrow pipe.`;
    } else if (level < 3) {
      status.textContent = `🟡 Moderate current (${I}A) — balanced voltage and resistance.`;
    } else {
      status.textContent = `🔴 High current (${I}A) — low resistance with high voltage. Watch for heat! (${P}W)`;
    }
  }

  vSlider.addEventListener('input', render);
  rSlider.addEventListener('input', render);
  render();
}

export default { html, text, init };
