import { describe, it, expect } from 'vitest';
import { runAvailableSpending } from './spending';
import { runSimulation } from './index';
import { runMortgageComparison } from './comparison';
import { defaultInputs } from './defaults';

const near = (a: number, b: number, tol = 1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('available spending', () => {
  const base = {
    ...defaultInputs,
    age: 70,
    homeValue: 900_000, // plenty of headroom so nothing is capped
    existingLiens: 100_000,
    existingLienRate: 0.06,
    existingLienTermRemaining: 20,
    costsInLoan: true,
    projectionYears: 30,
    rateScenario: 'Flat (assumed)' as const,
  };

  it('Ex.1 — leftover proceeds become a lump sum, net of out-of-pocket costs', () => {
    const inp = { ...base, initialCashDraw: 10_000 };
    const s = runAvailableSpending(inp);
    const r = runSimulation(inp);
    // Lump sum = cash netted at closing minus what's paid out of pocket.
    near(s.lumpSum, r.netCashDrawn - r.pocCosts, 0.01);
    expect(s.grossCashAtClosing).toBeGreaterThan(s.lumpSum); // OOP costs shave it
    expect(s.annualFreed).toBeGreaterThan(0); // a lien exists, so a payment is freed
    // The whole lump lands in year 1, nothing after.
    expect(s.rows[0].lumpSum).toBeCloseTo(s.lumpSum, 6);
    expect(s.rows.slice(1).every((row) => row.lumpSum === 0)).toBe(true);
  });

  it('Ex.2 — lien covered exactly (no cash draw) is pure freed cash flow', () => {
    const inp = { ...base, existingLiens: 150_000, initialCashDraw: 0, existingLienPayment: 1_500 };
    const s = runAvailableSpending(inp);
    expect(s.lumpSum).toBe(0); // nothing left over
    near(s.monthlyFreed, 1_500, 0.01); // the entered payment is what's freed
    near(s.annualFreed, 18_000, 0.01);
    expect(s.rows[0].freedCashFlow).toBeCloseTo(18_000, 6);
    expect(s.rows[0].lumpSum).toBe(0);
  });

  it('no lien → lump sum only, no freed cash flow', () => {
    const s = runAvailableSpending({ ...base, existingLiens: 0, initialCashDraw: 40_000 });
    expect(s.annualFreed).toBe(0);
    expect(s.freedYears).toBe(0);
    expect(s.lumpSum).toBeGreaterThan(0);
    expect(s.rows.every((row) => row.freedCashFlow === 0)).toBe(true);
    // With no freed payment, total available is just the lump sum.
    near(s.totalAvailable, s.lumpSum, 0.01);
  });

  it('freed cash flow stops at the mortgage payoff, not the projection end', () => {
    const inp = { ...base, existingLiens: 150_000, initialCashDraw: 0 };
    const s = runAvailableSpending(inp);
    expect(s.freedYears).toBeGreaterThan(0);
    expect(s.freedYears).toBeLessThan(inp.projectionYears);
    // The last freed year has cash flow; the year after has none.
    expect(s.rows[s.freedYears - 1].freedCashFlow).toBeGreaterThan(0);
    expect(s.rows[s.freedYears].freedCashFlow).toBe(0);

    // Overriding the payment upward retires the loan sooner, shortening the window.
    const cmp = runMortgageComparison(inp);
    const fast = runAvailableSpending({ ...inp, existingLienPayment: 2 * cmp.monthlyMortgagePayment });
    expect(fast.freedYears).toBeLessThan(s.freedYears);
  });

  it('cumulative is the running sum and totalAvailable is its final value', () => {
    const s = runAvailableSpending({ ...base, initialCashDraw: 10_000 });
    let running = 0;
    for (const row of s.rows) {
      running += row.total;
      near(row.cumulative, running, 0.01);
    }
    near(s.totalAvailable, s.rows[s.rows.length - 1].cumulative, 0.01);
    near(s.firstYearTotal, s.lumpSum + s.annualFreed, 0.01);
  });

  it('a lien with 0 remaining term frees no payment, so nothing reads as freed', () => {
    // Degenerate but typeable in a live demo: a balance with a payment override
    // but zero remaining term. No year can free a payment, so the monthly/annual
    // figures must read 0 too — not a phantom year of cash flow.
    const s = runAvailableSpending({
      ...base,
      existingLiens: 150_000,
      existingLienTermRemaining: 0,
      existingLienPayment: 1_500,
      initialCashDraw: 0,
    });
    expect(s.freedYears).toBe(0);
    expect(s.monthlyFreed).toBe(0);
    expect(s.annualFreed).toBe(0);
    expect(s.firstYearTotal).toBe(s.lumpSum); // no phantom year of freed cash flow
    expect(s.rows.every((row) => row.freedCashFlow === 0)).toBe(true);
  });

  it('reports HUD first-year headroom, floored at 0 when over the limit', () => {
    const r = runSimulation({ ...base, initialCashDraw: 10_000 });
    const under = runAvailableSpending({ ...base, initialCashDraw: 10_000 });
    near(under.hudMaxLumpSum, r.availableInitialDraw, 0.01);
    expect(under.lumpSumHeadroom).toBeGreaterThan(0); // room to draw more
    expect(under.firstYearDrawExcess).toBe(0);

    // Draw beyond the first-year limit → no headroom, and the excess is flagged.
    const over = runAvailableSpending({ ...base, initialCashDraw: 400_000 });
    expect(over.lumpSumHeadroom).toBe(0);
    expect(over.firstYearDrawExcess).toBeGreaterThan(0);
  });
});
