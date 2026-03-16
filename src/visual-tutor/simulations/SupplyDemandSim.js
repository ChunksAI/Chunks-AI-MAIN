/**
 * src/visual-tutor/simulations/SupplyDemandSim.js
 * Interactive supply & demand curve simulation.
 */

export const html = `
<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;font-family:var(--font-body,sans-serif);color:var(--text-1,#e8edf2);">
  <svg id="sd-svg" viewBox="0 0 400 260" width="100%" style="max-height:210px;margin-bottom:8px;" xmlns="http://www.w3.org/2000/svg">
    <!-- Axes -->
    <line x1="50" y1="220" x2="370" y2="220" stroke="rgba(200,214,229,0.4)" stroke-width="1.5"/>
    <line x1="50" y1="20"  x2="50"  y2="220" stroke="rgba(200,214,229,0.4)" stroke-width="1.5"/>
    <!-- Axis labels -->
    <text x="210" y="242" text-anchor="middle" font-size="10" fill="rgba(200,214,229,0.6)">Quantity</text>
    <text x="16"  y="124" text-anchor="middle" font-size="10" fill="rgba(200,214,229,0.6)" transform="rotate(-90,16,124)">Price</text>
    <!-- Demand curve (red, downward slope) -->
    <line id="sd-demand" x1="60" y1="40" x2="360" y2="210" stroke="#e74c3c" stroke-width="2.5" stroke-linecap="round"/>
    <text id="sd-d-label" x="365" y="215" font-size="10" fill="#e74c3c">D</text>
    <!-- Supply curve (green, upward slope) -->
    <line id="sd-supply" x1="60" y1="210" x2="360" y2="40" stroke="#2ecc71" stroke-width="2.5" stroke-linecap="round"/>
    <text id="sd-s-label" x="365" y="44" font-size="10" fill="#2ecc71">S</text>
    <!-- Equilibrium point -->
    <circle id="sd-eq" cx="210" cy="125" r="6" fill="#f1c40f" opacity="0.9"/>
    <!-- Dashed lines to axes -->
    <line id="sd-eq-x" x1="210" y1="125" x2="210" y2="220" stroke="#f1c40f" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>
    <line id="sd-eq-y" x1="50"  y1="125" x2="210" y2="125" stroke="#f1c40f" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>
    <!-- Labels -->
    <text id="sd-peq" x="36" y="129" font-size="9" fill="#f1c40f" text-anchor="end">P*</text>
    <text id="sd-qeq" x="210" y="234" font-size="9" fill="#f1c40f" text-anchor="middle">Q*</text>
  </svg>
  <div style="display:flex;gap:20px;width:100%;max-width:380px;margin-bottom:8px;">
    <div style="flex:1;">
      <label style="font-size:10px;color:#e74c3c;display:block;margin-bottom:4px;">Demand shift: <span id="sd-d-val">0</span></label>
      <input id="sd-d-slider" type="range" min="-60" max="60" value="0" style="width:100%;accent-color:#e74c3c;"/>
    </div>
    <div style="flex:1;">
      <label style="font-size:10px;color:#2ecc71;display:block;margin-bottom:4px;">Supply shift: <span id="sd-s-val">0</span></label>
      <input id="sd-s-slider" type="range" min="-60" max="60" value="0" style="width:100%;accent-color:#2ecc71;"/>
    </div>
  </div>
  <p id="sd-status" style="font-size:11px;color:var(--text-3,#c8d6e5);text-align:center;margin:0;min-height:28px;"></p>
</div>`;

export const text = "Drag the sliders to shift supply and demand curves. Where they cross is the equilibrium — the market-clearing price and quantity. Increase demand and prices rise. Increase supply and prices fall.";

export function init(container) {
  const dSlider  = container.querySelector('#sd-d-slider');
  const sSlider  = container.querySelector('#sd-s-slider');
  const dVal     = container.querySelector('#sd-d-val');
  const sVal     = container.querySelector('#sd-s-val');
  const status   = container.querySelector('#sd-status');
  const demandLine = container.querySelector('#sd-demand');
  const supplyLine = container.querySelector('#sd-supply');
  const eqDot    = container.querySelector('#sd-eq');
  const eqX      = container.querySelector('#sd-eq-x');
  const eqY      = container.querySelector('#sd-eq-y');
  const peqLbl   = container.querySelector('#sd-peq');
  const qeqLbl   = container.querySelector('#sd-qeq');

  // Base endpoints: demand goes top-left to bottom-right; supply bottom-left to top-right
  // Both lines go between x=60..360, y=40..210 (flipped)
  // Equilibrium at intersection

  function getLineY(x, x1, y1, x2, y2) {
    return y1 + (y2 - y1) * ((x - x1) / (x2 - x1));
  }

  function render() {
    const dShift = parseInt(dSlider.value);
    const sShift = parseInt(sSlider.value);
    dVal.textContent = dShift > 0 ? `+${dShift}` : dShift;
    sVal.textContent = sShift > 0 ? `+${sShift}` : sShift;

    // Demand: x1=60, y1=40+shift, x2=360, y2=210+shift  (shift right = higher demand)
    const d_x1 = 60,  d_y1 = 40  - dShift, d_x2 = 360, d_y2 = 210 - dShift;
    // Supply: x1=60, y1=210-shift, x2=360, y2=40-shift  (shift right = more supply)
    const s_x1 = 60,  s_y1 = 210 + sShift, s_x2 = 360, s_y2 = 40  + sShift;

    demandLine.setAttribute('x1', d_x1); demandLine.setAttribute('y1', Math.max(20, Math.min(240, d_y1)));
    demandLine.setAttribute('x2', d_x2); demandLine.setAttribute('y2', Math.max(20, Math.min(240, d_y2)));
    supplyLine.setAttribute('x1', s_x1); supplyLine.setAttribute('y1', Math.max(20, Math.min(240, s_y1)));
    supplyLine.setAttribute('x2', s_x2); supplyLine.setAttribute('y2', Math.max(20, Math.min(240, s_y2)));

    // Find intersection: parametric solve
    // d: P = d_y1 + (d_y2-d_y1)/(d_x2-d_x1) * (Q-d_x1)
    // s: P = s_y1 + (s_y2-s_y1)/(s_x2-s_x1) * (Q-s_x1)
    const dm = (d_y2 - d_y1) / (d_x2 - d_x1);
    const sm = (s_y2 - s_y1) / (s_x2 - s_x1);
    // d_y1 + dm*(Q-d_x1) = s_y1 + sm*(Q-s_x1)
    // Q(dm - sm) = s_y1 - d_y1 + dm*d_x1 - sm*s_x1  (note: d_x1 = s_x1 = 60)
    let eqQx, eqPy;
    if (Math.abs(dm - sm) < 0.001) {
      eqQx = 210; eqPy = 125; // parallel — no intersection, show midpoint
    } else {
      eqQx = (s_y1 - d_y1 + dm * d_x1 - sm * s_x1) / (dm - sm);
      eqPy = d_y1 + dm * (eqQx - d_x1);
    }
    eqQx = Math.max(60, Math.min(360, eqQx));
    eqPy = Math.max(25, Math.min(215, eqPy));

    eqDot.setAttribute('cx', eqQx.toFixed(1));
    eqDot.setAttribute('cy', eqPy.toFixed(1));
    eqX.setAttribute('x1', eqQx.toFixed(1)); eqX.setAttribute('x2', eqQx.toFixed(1)); eqX.setAttribute('y1', eqPy.toFixed(1));
    eqY.setAttribute('x2', eqQx.toFixed(1)); eqY.setAttribute('y1', eqPy.toFixed(1)); eqY.setAttribute('y2', eqPy.toFixed(1));
    peqLbl.setAttribute('y', (eqPy + 4).toFixed(1));
    qeqLbl.setAttribute('x', eqQx.toFixed(1));

    // Status
    const priceLevel = Math.round(((220 - eqPy) / 200) * 100);
    const qtyLevel   = Math.round(((eqQx - 50) / 310) * 100);
    if (dShift === 0 && sShift === 0) {
      status.textContent = '⚖️ Market in equilibrium. Drag sliders to shift curves.';
    } else if (dShift > 0 && sShift === 0) {
      status.textContent = `📈 Demand increased → higher price (${priceLevel}) and more quantity (${qtyLevel}).`;
    } else if (dShift < 0 && sShift === 0) {
      status.textContent = `📉 Demand decreased → lower price (${priceLevel}) and less quantity (${qtyLevel}).`;
    } else if (sShift < 0 && dShift === 0) {
      status.textContent = `📈 Supply decreased → higher price (${priceLevel}), less quantity (${qtyLevel}).`;
    } else if (sShift > 0 && dShift === 0) {
      status.textContent = `📉 Supply increased → lower price (${priceLevel}), more quantity (${qtyLevel}).`;
    } else {
      status.textContent = `New equilibrium: Price ≈ ${priceLevel}, Quantity ≈ ${qtyLevel}.`;
    }
  }

  dSlider.addEventListener('input', render);
  sSlider.addEventListener('input', render);
  render();
}

export default { html, text, init };
