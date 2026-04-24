'use client';

import type { FBDData, FBDForce } from '@/lib/fbdParser';

// ─── Canvas constants ─────────────────────────────────────────────────────────

const CX = 240; // object centre x
const CY = 220; // object centre y
const W = 480;
const H = 440;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Scale a Newton magnitude to an arrow pixel length (50–150 px). */
function arrowLength(magnitude: number): number {
  return Math.min(50 + magnitude * 2, 150);
}

/**
 * Convert an angle (0=right, 90=up, 180=left, 270=down) to an SVG direction
 * vector.  SVG y-axis is flipped relative to maths, so dy = -sin(angle).
 */
function angleToDir(angleDeg: number): { dx: number; dy: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { dx: Math.cos(rad), dy: -Math.sin(rad) };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ArrowHead({
  x,
  y,
  angleDeg,
  color,
}: {
  x: number;
  y: number;
  angleDeg: number;
  color: string;
}) {
  const size = 10;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = -Math.sin(rad); // SVG flip

  // Tip at (x, y); two base points perpendicular to the direction
  const p2x = x - size * cos + (size / 2) * sin;
  const p2y = y - size * sin - (size / 2) * cos;
  const p3x = x - size * cos - (size / 2) * sin;
  const p3y = y - size * sin + (size / 2) * cos;

  return (
    <polygon
      points={`${x},${y} ${p2x},${p2y} ${p3x},${p3y}`}
      fill={color}
    />
  );
}

function ForceArrow({
  force,
  cx,
  cy,
}: {
  force: FBDForce;
  cx: number;
  cy: number;
}) {
  const color = force.color ?? '#e53e3e';
  const len = arrowLength(force.magnitude);
  const { dx, dy } = angleToDir(force.angle);

  // Arrow shaft endpoint
  const ex = cx + dx * len;
  const ey = cy + dy * len;

  // Label placed beyond the arrowhead tip
  const labelGap = 18;
  const lx = cx + dx * (len + labelGap);
  const ly = cy + dy * (len + labelGap);

  const magLabel = force.magnitude > 0 ? ` (${force.magnitude} N)` : '';

  return (
    <g>
      <line
        x1={cx}
        y1={cy}
        x2={ex}
        y2={ey}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <ArrowHead x={ex} y={ey} angleDeg={force.angle} color={color} />
      <text
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={12}
        fontFamily="system-ui, sans-serif"
        fontWeight={600}
        fill={color}
      >
        {force.label}{magLabel}
      </text>
    </g>
  );
}

function ObjectShape({ data }: { data: FBDData }) {
  if (data.object === 'ball') {
    return (
      <circle
        cx={CX}
        cy={CY}
        r={30}
        fill="#e2e8f0"
        stroke="#4a5568"
        strokeWidth={2}
      />
    );
  }
  if (data.object === 'hanging_mass') {
    return (
      <rect
        x={CX - 20}
        y={CY - 30}
        width={40}
        height={60}
        rx={4}
        fill="#e2e8f0"
        stroke="#4a5568"
        strokeWidth={2}
      />
    );
  }
  // default: box
  return (
    <rect
      x={CX - 30}
      y={CY - 30}
      width={60}
      height={60}
      rx={4}
      fill="#e2e8f0"
      stroke="#4a5568"
      strokeWidth={2}
    />
  );
}

function InclineSurface({ angle }: { angle: number }) {
  const halfLen = 180;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Surface line centred below the object (CX, CY + 32)
  const bx = CX;
  const by = CY + 32;
  const x1 = bx - halfLen * cos;
  const y1 = by + halfLen * sin;
  const x2 = bx + halfLen * cos;
  const y2 = by - halfLen * sin;

  return (
    <>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#718096" strokeWidth={2} />
      <text x={20} y={H - 18} fontSize={11} fill="#718096" fontFamily="system-ui, sans-serif">
        incline {angle}°
      </text>
    </>
  );
}

function FlatSurface() {
  return (
    <line
      x1={CX - 80}
      y1={CY + 32}
      x2={CX + 80}
      y2={CY + 32}
      stroke="#718096"
      strokeWidth={2}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FBDViewer({ data }: { data: FBDData }) {
  const showIncline = data.surface === 'incline' && data.inclineAngle != null;
  const showFlat = !showIncline && (!data.surface || data.surface === 'flat');

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ background: '#fafafa', borderRadius: 8, display: 'block' }}
      aria-label="Free Body Diagram"
    >
      {/* Dashed centre-lines for reference */}
      <line
        x1={CX} y1={0} x2={CX} y2={H}
        stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4,4"
      />
      <line
        x1={0} y1={CY} x2={W} y2={CY}
        stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4,4"
      />

      {/* Surface */}
      {showIncline && <InclineSurface angle={data.inclineAngle!} />}
      {showFlat && <FlatSurface />}

      {/* Object */}
      <ObjectShape data={data} />

      {/* Force arrows */}
      {data.forces.map((force, i) => (
        <ForceArrow key={i} force={force} cx={CX} cy={CY} />
      ))}

      {/* Title */}
      <text
        x={W / 2}
        y={20}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        fill="#2d3748"
        fontFamily="system-ui, sans-serif"
      >
        Free Body Diagram
      </text>
    </svg>
  );
}
