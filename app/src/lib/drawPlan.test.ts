import { describe, it, expect } from 'vitest';
import { buildLevelDraws } from './drawPlan';

describe('buildLevelDraws', () => {
  it('maps start age to the right year index (beginning-of-year draw)', () => {
    // 70yo, $2,000/mo for 10 yrs starting age 75 → $24k/yr at indices 4..13,
    // which the Year table shows as ages 75..84.
    const d = buildLevelDraws(2000, 75, 70, 10);
    expect(d[3]).toBe(0); // age 74 — before the plan
    expect(d[4]).toBe(24_000); // age 75 — first draw
    expect(d[13]).toBe(24_000); // age 84 — last draw
    expect(d[14]).toBe(0); // age 85 — after the plan
    expect(d.filter((v) => v > 0).length).toBe(10);
    expect(d.length).toBe(38);
  });

  it('is idempotent — same inputs give the same array, never stacking', () => {
    const a = buildLevelDraws(2000, 75, 70, 10);
    const b = buildLevelDraws(2000, 75, 70, 10);
    expect(b).toEqual(a);
  });

  it('replaces the whole schedule (years outside the plan are zero)', () => {
    const d = buildLevelDraws(1000, 72, 70, 3);
    // Only the three planned years hold a value; everything else is 0.
    expect(d.reduce((n, v) => n + (v > 0 ? 1 : 0), 0)).toBe(3);
  });

  it('clamps a start age at or below the current age to the first drawable year', () => {
    // Scheduled draws cannot occur at closing (that is the cash draw); the
    // earliest is age+1 (index 0).
    const d = buildLevelDraws(1000, 70, 70, 2);
    expect(d[0]).toBe(12_000);
    expect(d[1]).toBe(12_000);
    expect(d[2]).toBe(0);
  });

  it('clamps the run to the 38-year window', () => {
    const d = buildLevelDraws(1000, 100, 70, 20); // starts near the end
    expect(d.length).toBe(38);
    // No out-of-range writes; whatever fits is filled, the rest stays 0.
    expect(d.every((v) => v === 0 || v === 12_000)).toBe(true);
  });

  it('a zero amount or zero years produces an all-zero array', () => {
    expect(buildLevelDraws(0, 75, 70, 10).every((v) => v === 0)).toBe(true);
    expect(buildLevelDraws(2000, 75, 70, 0).every((v) => v === 0)).toBe(true);
  });
});
