/**
 * src/visual-tutor/simulations/OsmosisSim.js
 * Interactive osmosis simulation with concentration sliders.
 */

export const html = `
<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;font-family:var(--font-body,sans-serif);color:var(--text-1,#e8edf2);">
  <svg id="osm-svg" viewBox="0 0 440 240" width="100%" style="max-height:200px;margin-bottom:10px;" xmlns="http://www.w3.org/2000/svg">
    <!-- Chamber border -->
    <rect x="20" y="20" width="400" height="200" rx="10" fill="none" stroke="rgba(200,214,229,0.2)" stroke-width="1.5"/>
    <!-- Membrane -->
    <line id="osm-membrane" x1="220" y1="20" x2="220" y2="220" stroke="rgba(200,214,229,0.4)" stroke-width="3" stroke-dasharray="8,5"/>
    <!-- Left label -->
    <text x="110" y="16" text-anchor="middle" font-size="11" fill="#3498db">Left side</text>
    <!-- Right label -->
    <text x="330" y="16" text-anchor="middle" font-size="11" fill="#e74c3c">Right side</text>
    <!-- Molecules rendered by JS -->
    <g id="osm-molecules"></g>
    <!-- Arrow group -->
    <g id="osm-arrows"></g>
    <!-- Water level lines -->
    <line id="osm-level-left"  x1="25"  y1="120" x2="215" y2="120" stroke="#3498db" stroke-width="2" opacity="0.5"/>
    <line id="osm-level-right" x1="225" y1="120" x2="415" y2="120" stroke="#e74c3c" stroke-width="2" opacity="0.5"/>
    <defs>
      <marker id="osm-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
        <path d="M1 1L8 5L1 9" fill="none" stroke="#60a5fa" stroke-width="2"/>
      </marker>
    </defs>
  </svg>
  <div style="display:flex;gap:24px;width:100%;max-width:380px;margin-bottom:8px;">
    <div style="flex:1;">
      <label style="font-size:10px;color:#3498db;display:block;margin-bottom:4px;">Left concentration: <span id="osm-left-val">30%</span></label>
      <input id="osm-left" type="range" min="0" max="100" value="30" style="width:100%;accent-color:#3498db;"/>
    </div>
    <div style="flex:1;">
      <label style="font-size:10px;color:#e74c3c;display:block;margin-bottom:4px;">Right concentration: <span id="osm-right-val">70%</span></label>
      <input id="osm-right" type="range" min="0" max="100" value="70" style="width:100%;accent-color:#e74c3c;"/>
    </div>
  </div>
  <p id="osm-status" style="font-size:11px;color:var(--text-3,#c8d6e5);text-align:center;margin:0;min-height:32px;"></p>
</div>`;

export const text = "Drag the sliders to change solute concentration on each side. Water flows through the semi-permeable membrane from LOW concentration (more water) to HIGH concentration (less water). When both sides are equal, osmotic equilibrium is reached.";

export function init(container) {
  const leftSlider  = container.querySelector('#osm-left');
  const rightSlider = container.querySelector('#osm-right');
  const leftVal     = container.querySelector('#osm-left-val');
  const rightVal    = container.querySelector('#osm-right-val');
  const status      = container.querySelector('#osm-status');
  const molGroup    = container.querySelector('#osm-molecules');
  const arrowGroup  = container.querySelector('#osm-arrows');
  const levelLeft   = container.querySelector('#osm-level-left');
  const levelRight  = container.querySelector('#osm-level-right');

  const NS = 'http://www.w3.org/2000/svg';

  function render() {
    const L = parseInt(leftSlider.value);
    const R = parseInt(rightSlider.value);
    leftVal.textContent  = L + '%';
    rightVal.textContent = R + '%';

    // Water level shifts based on concentration difference
    const diff = (R - L) / 100; // positive = water flows left→right
    const baseY = 120;
    const shift = diff * 40;
    levelLeft.setAttribute('y1',  baseY + shift);
    levelLeft.setAttribute('y2',  baseY + shift);
    levelRight.setAttribute('y1', baseY - shift);
    levelRight.setAttribute('y2', baseY - shift);

    // Draw solute molecules
    molGroup.innerHTML = '';
    const seed = (side, count, color) => {
      const xMin = side === 'left' ? 28 : 228;
      const xMax = side === 'left' ? 210 : 410;
      for (let i = 0; i < count; i++) {
        const x = xMin + Math.abs(Math.sin(i * 137.5 + (side === 'right' ? 50 : 0))) * (xMax - xMin);
        const y = 30 + Math.abs(Math.cos(i * 97.3  + (side === 'right' ? 30 : 0))) * 170;
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', x.toFixed(1));
        c.setAttribute('cy', y.toFixed(1));
        c.setAttribute('r', 5);
        c.setAttribute('fill', color);
        c.setAttribute('opacity', '0.8');
        molGroup.appendChild(c);
      }
    };
    seed('left',  Math.round(L / 10), '#e74c3c');
    seed('right', Math.round(R / 10), '#e74c3c');

    // Draw water flow arrows
    arrowGroup.innerHTML = '';
    const diff2 = R - L;
    if (Math.abs(diff2) > 5) {
      const fromX = diff2 > 0 ? 185 : 255;
      const toX   = diff2 > 0 ? 255 : 185;
      const strength = Math.min(3, Math.abs(diff2) / 30);
      for (let i = 0; i < Math.ceil(strength); i++) {
        const y = 70 + i * 50;
        const a = document.createElementNS(NS, 'path');
        a.setAttribute('d', `M${fromX} ${y} L${toX} ${y}`);
        a.setAttribute('stroke', '#60a5fa');
        a.setAttribute('stroke-width', '2');
        a.setAttribute('fill', 'none');
        a.setAttribute('marker-end', 'url(#osm-arr)');
        a.setAttribute('opacity', '0.7');
        arrowGroup.appendChild(a);
      }
    }

    // Status text
    if (Math.abs(diff2) <= 5) {
      status.textContent = '⚖️ Equilibrium reached — equal water concentration on both sides. Net flow = zero.';
    } else if (diff2 > 0) {
      status.textContent = `💧 Water flows LEFT → RIGHT. Right side has more solute (less water). Osmotic pressure: ${Math.abs(diff2)} units.`;
    } else {
      status.textContent = `💧 Water flows RIGHT → LEFT. Left side has more solute (less water). Osmotic pressure: ${Math.abs(diff2)} units.`;
    }
  }

  leftSlider.addEventListener('input', render);
  rightSlider.addEventListener('input', render);
  render();
}

export default { html, text, init };
