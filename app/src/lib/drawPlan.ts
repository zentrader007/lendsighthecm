// Expand a level "draw plan" — a set monthly amount for N years starting at an
// age — into the 38-year draws array the engine consumes. Draws are
// beginning-of-year: index i is applied at age currentAge + i + 1, so a draw
// that should first appear "at age A" lands at index i = A − currentAge − 1
// (the same mapping the Year table shows). The result REPLACES the whole draws
// array — the plan fully describes the schedule — so it is idempotent and never
// stacks. Hand-tune individual years in the Year table afterward if needed.
export function buildLevelDraws(
  amountPerMonth: number,
  startAge: number,
  currentAge: number,
  years: number,
): number[] {
  const annual = Math.max(0, amountPerMonth) * 12;
  const startIdx = Math.max(0, Math.round(startAge) - Math.round(currentAge) - 1);
  const yrs = Math.max(0, Math.round(years));
  const draws = Array(38).fill(0);
  for (let i = startIdx; i < Math.min(startIdx + yrs, 38); i++) draws[i] = annual;
  return draws;
}
