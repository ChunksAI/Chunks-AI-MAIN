/**
 * ChunksLogo — "The Orbital" (refined) v2
 *
 * Three elliptical orbits around a gold core:
 *   • Outer ring  — faint warm-tan stroke, tilted ~20°
 *   • Mid ring    — violet accent, tilted ~−15°, slightly thicker
 *   • Inner ring  — gold, nearly upright
 * Two orbiting nodes sit on the outer and mid rings..
 * Strokes are thin, proportional, and scale cleanly with `size`.
 */
export default function ChunksLogo({ size = 22 }: { size?: number }) {
  const id = 'chunks-orbital';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Chunks AI"
      role="img"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        {/* Gold radial glow for the core */}
        <radialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#F5C96A" />
          <stop offset="55%" stopColor="#C4923A" />
          <stop offset="100%" stopColor="#9B6E20" />
        </radialGradient>

        {/* Subtle glow filter */}
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Node glow */}
        <filter id={`${id}-node-glow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Outer orbit — warm tan, tilted 22° ─────────────────────────── */}
      <ellipse
        cx="20" cy="20"
        rx="17.5" ry="7"
        stroke="#C4923A"
        strokeOpacity="0.28"
        strokeWidth="0.85"
        fill="none"
        transform="rotate(22 20 20)"
      />

      {/* ── Mid orbit — violet accent, tilted −18° ─────────────────────── */}
      <ellipse
        cx="20" cy="20"
        rx="14" ry="5.8"
        stroke="#7C6BE0"
        strokeOpacity="0.55"
        strokeWidth="0.95"
        fill="none"
        transform="rotate(-18 20 20)"
      />

      {/* ── Inner orbit — gold, nearly upright ~80° ─────────────────────── */}
      <ellipse
        cx="20" cy="20"
        rx="10" ry="4.2"
        stroke="#C4923A"
        strokeOpacity="0.75"
        strokeWidth="1.05"
        fill="none"
        transform="rotate(80 20 20)"
      />

      {/* ── Orbiting node 1 — on outer orbit, rightmost point ──────────── */}
      {/*  Outer ellipse at angle 22°: point at rx≈17.5 rotated 22° from (20,20) */}
      <circle
        cx="36.8" cy="26.1"   /* outer ring right-arc, post-rotation  */
        r="1.55"
        fill="#F5C96A"
        filter={`url(#${id}-node-glow)`}
        transform="rotate(22 20 20)"
        style={{ transformOrigin: '20px 20px' }}
      />

      {/* ── Orbiting node 2 — on mid orbit (violet), left-arc ──────────── */}
      <circle
        cx="6" cy="20"        /* mid ring left apex */
        r="1.25"
        fill="#A89FF5"
        filter={`url(#${id}-node-glow)`}
        transform="rotate(-18 20 20)"
        style={{ transformOrigin: '20px 20px' }}
      />

      {/* ── Gold core ───────────────────────────────────────────────────── */}
      <circle
        cx="20" cy="20"
        r="3.2"
        fill={`url(#${id}-core)`}
        filter={`url(#${id}-glow)`}
      />
    </svg>
  );
}
