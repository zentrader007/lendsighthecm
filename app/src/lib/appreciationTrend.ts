// Expand an appreciation "trend" into the 38-year per-year series the engine
// consumes. Year 1 (index 0) starts at the base rate; each subsequent year
// moves by `stepPerYear` in the chosen direction, clamped to the field's own
// [-20%, 20%] range so a long glide can't run to absurd values. The result
// REPLACES the whole series (idempotent, never stacks); the Year table can
// hand-tune individual years afterward.
export type AppreciationTrend = 'flat' | 'rising' | 'falling';

const MIN = -0.2;
const MAX = 0.2;

export function buildAppreciationTrend(
  base: number,
  stepPerYear: number,
  direction: AppreciationTrend,
  years = 38,
): number[] {
  const sign = direction === 'rising' ? 1 : direction === 'falling' ? -1 : 0;
  const step = Math.max(0, stepPerYear) * sign;
  return Array.from({ length: years }, (_, i) =>
    Math.min(MAX, Math.max(MIN, base + step * i)),
  );
}
