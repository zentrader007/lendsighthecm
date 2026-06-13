import plfTable from '../data/plfTable.json';
import { MROUND } from './finance';

interface PlfData {
  ratesPct: number[];
  byAge: Record<string, (number | null)[]>;
}

const data = plfTable as PlfData;

/**
 * Index of the nearest rate in the PLF table's 0.125% grid, or -1 if `ratePct`
 * falls outside the table's range. The combined expected rate (index + margin)
 * is regulatorily rounded to the nearest 0.125%, but a non-grid margin (e.g.
 * 2.4%) can land between grid points; snapping to the nearest avoids silently
 * returning 0 and zeroing the entire principal limit.
 */
function rateIndex(ratePct: number): number {
  let best = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < data.ratesPct.length; i++) {
    const diff = Math.abs(data.ratesPct[i] - ratePct);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  // Half a grid step (0.0625) is the farthest any in-range rate can be from a
  // grid point; beyond that the rate is outside the table and yields 0.
  return bestDiff <= 0.0625 + 1e-9 ? best : -1;
}

/**
 * HUD Principal Limit Factor lookup, replicating the spreadsheet's
 * XLOOKUP(age, (MROUND(cmt10,0.00125)+margin)*100).
 * Returns 0 when age is outside the table (>=100), matching the AE column guard.
 *
 * Note: this rounds the index (cmt10) before adding the margin, whereas the
 * displayed expected rate rounds (cmt10 + margin). The two agree only when the
 * margin is an exact multiple of 0.125% (true for the default 2.375%).
 */
export function lookupPLF(age: number, cmt10yr: number, margin: number): number {
  return lookupPLFByRate(age, (MROUND(cmt10yr, 0.00125) + margin) * 100);
}

/**
 * PLF lookup by an already-computed expected-rate percentage.
 * Used by the future-PLF projection column, where the rate index is
 * (future10yrCMT + margin) * 100 with no additional rounding.
 */
export function lookupPLFByRate(age: number, ratePct: number): number {
  if (age > 99 || age < 18) return 0;
  const row = data.byAge[String(Math.floor(age))];
  if (!row) return 0;
  const idx = rateIndex(ratePct);
  if (idx < 0) return 0;
  return row[idx] ?? 0;
}
