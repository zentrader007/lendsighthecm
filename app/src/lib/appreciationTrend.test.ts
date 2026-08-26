import { describe, it, expect } from 'vitest';
import { buildAppreciationTrend } from './appreciationTrend';

const near = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('buildAppreciationTrend', () => {
  it('flat: every year equals the base', () => {
    const a = buildAppreciationTrend(0.03, 0.0025, 'flat');
    expect(a.length).toBe(38);
    expect(a.every((v) => v === 0.03)).toBe(true);
  });

  it('rising: year 1 is the base, then +step each year', () => {
    const a = buildAppreciationTrend(0.03, 0.0025, 'rising');
    near(a[0], 0.03); // year 1 = base
    near(a[1], 0.0325); // +0.25%
    near(a[4], 0.04); // +1.00% by year 5
  });

  it('falling: year 1 is the base, then −step each year', () => {
    const a = buildAppreciationTrend(0.03, 0.0025, 'falling');
    near(a[0], 0.03);
    near(a[1], 0.0275);
    near(a[4], 0.02);
  });

  it('clamps a long glide to the ±20% field range', () => {
    const rising = buildAppreciationTrend(0.03, 0.02, 'rising'); // +2%/yr for 38 yrs
    expect(Math.max(...rising)).toBeLessThanOrEqual(0.2 + 1e-12);
    const falling = buildAppreciationTrend(0.03, 0.02, 'falling');
    expect(Math.min(...falling)).toBeGreaterThanOrEqual(-0.2 - 1e-12);
  });

  it('is idempotent — same inputs give the same series', () => {
    expect(buildAppreciationTrend(0.03, 0.0025, 'rising')).toEqual(
      buildAppreciationTrend(0.03, 0.0025, 'rising'),
    );
  });
});
