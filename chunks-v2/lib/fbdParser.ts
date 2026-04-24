export interface FBDForce {
  label: string;
  /** Angle in degrees: 0=right, 90=up, 180=left, 270=down */
  angle: number;
  /** Newton magnitude, always >= 1 after validation */
  magnitude: number;
  color?: string;
}

export interface FBDData {
  object: 'box' | 'ball' | 'hanging_mass';
  surface?: 'flat' | 'incline';
  inclineAngle?: number;
  forces: FBDForce[];
}

/**
 * Parse and validate FBD JSON produced by the AI.
 *
 * Rules applied:
 * - Wrapped entirely in try/catch — returns null on any error, never throws.
 * - Strips markdown fences (```json, ```fbd, ```) before parsing.
 * - Validates the forces array: each force needs a non-empty label, a
 *   magnitude > 0, and an angle in [0, 360]. Invalid forces are dropped
 *   silently; the whole diagram is only null if < 1 valid force remains.
 * - Each magnitude is clamped to a minimum of 1.
 * - If object is not 'box' | 'ball' | 'hanging_mass', defaults to 'box'.
 */
export function parseFBDFromJSON(raw: string): FBDData | null {
  try {
    // Strip markdown fences
    let cleaned = raw
      .replace(/^```(?:json|fbd)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    // If the cleaned text is not a bare JSON object, extract the first {...} block.
    // This handles responses where the AI adds explanatory text before or after
    // the JSON (e.g. "Here is the JSON: {...}").
    if (!cleaned.startsWith('{')) {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        cleaned = cleaned.slice(start, end + 1);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(cleaned) as any;

    if (!parsed || typeof parsed !== 'object') return null;

    // Validate forces array
    if (!Array.isArray(parsed.forces)) return null;

    const validForces: FBDForce[] = [];
    for (const f of parsed.forces) {
      if (!f || typeof f !== 'object') continue;
      if (typeof f.label !== 'string' || f.label.trim() === '') continue;
      if (typeof f.magnitude !== 'number' || f.magnitude <= 0) continue;
      if (typeof f.angle !== 'number' || f.angle < 0 || f.angle > 360) continue;
      validForces.push({
        label: f.label.trim(),
        magnitude: Math.max(1, f.magnitude),
        angle: f.angle,
        ...(typeof f.color === 'string' && f.color ? { color: f.color } : {}),
      });
    }

    if (validForces.length < 1) return null;

    const VALID_OBJECTS = new Set(['box', 'ball', 'hanging_mass']);
    const object: FBDData['object'] = VALID_OBJECTS.has(String(parsed.object))
      ? (parsed.object as FBDData['object'])
      : 'box';

    const result: FBDData = { object, forces: validForces };

    if (parsed.surface === 'flat' || parsed.surface === 'incline') {
      result.surface = parsed.surface;
    }
    if (typeof parsed.inclineAngle === 'number') {
      result.inclineAngle = parsed.inclineAngle;
    }

    return result;
  } catch {
    return null;
  }
}
