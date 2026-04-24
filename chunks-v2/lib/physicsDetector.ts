export function detectPhysicsProblem(text: string): boolean {
  const keywords = [
    'force', 'friction', 'tension', 'acceleration', 'gravity',
    'newton', 'incline', 'normal force', 'normal', 'pulley',
    'torque', 'weight', 'mass', 'momentum', 'push', 'pull',
    'slope', 'ramp', 'kg', ' n ', 'newtons', 'applied',
    'free body', 'fbd', 'equilibrium', 'resultant'
  ];
  const lower = text.toLowerCase();
  const matched = keywords.filter(k => lower.includes(k));
  return matched.length >= 2;
}
