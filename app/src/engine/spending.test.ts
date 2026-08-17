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

  it('exposes the cost side: equity with the HECM trails equity from doing nothing', () => {
    const inp = { ...base, initialCashDraw: 10_000 };
    const s = runAvailableSpending(inp);
    const r = runSimulation(inp);
    const last = s.rows[s.rows.length - 1];
    // Equity with the HECM matches the loan sim's equity, and is below the
    // do-nothing equity — the gap is the equity the loan consumed.
    near(last.equityWith, r.projection[r.projection.length - 1].equity, 1);
    expect(last.equityWith).toBeLessThan(last.equityWithout);
    // Loan balance is the cost line behind the lump sum.
    expect(last.loanBalance).toBeGreaterThan(0);
    // Equity is home value net of the balance, floored at 0 (non-recourse), so
    // the amount actually owed can never exceed the home value.
    near(last.equityWith, Math.max(0, last.homeValue - last.loanBalance), 1);
    expect(Math.min(last.loanBalance, last.homeValue)).toBeLessThanOrEqual(last.homeValue);
  });

  it('with no lien, doing-nothing equity is the full (appreciated) home value', () => {
    const inp = { ...base, existingLiens: 0, initialCashDraw: 40_000 };
    const s = runAvailableSpending(inp);
    const r = runSimulation(inp);
    // No mortgage in the do-nothing world, so its equity is the whole home.
    for (const row of s.rows) near(row.equityWithout, r.projection[row.year].homeValue, 1);
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

  describe('credit-line draws from the Year table', () => {
    const withDraws = (draws: Record<number, number>, payments: Record<number, number> = {}) => {
      const d = Array(38).fill(0);
      const p = Array(38).fill(0);
      for (const [i, v] of Object.entries(draws)) d[Number(i)] = v;
      for (const [i, v] of Object.entries(payments)) p[Number(i)] = v;
      return { ...base, initialCashDraw: 0, existingLiens: 0, draws: d, payments: p };
    };

    it('scheduled draws show up as spending in the years they are taken', () => {
      // $25k/yr in years 6–10 (index 5–9).
      const s = runAvailableSpending(withDraws({ 5: 25_000, 6: 25_000, 7: 25_000, 8: 25_000, 9: 25_000 }));
      expect(s.rows[4].creditDraws).toBe(0);
      expect(s.rows[5].creditDraws).toBe(25_000);
      expect(s.rows[9].creditDraws).toBe(25_000);
      expect(s.rows[10].creditDraws).toBe(0);
      near(s.totalCreditDraws, 125_000, 0.01);
      near(s.totalAvailable, 125_000, 0.01); // no lien, no cash draw → draws only
      // Running total on the row matches the sum so far.
      near(s.rows[7].cumulativeDraws, 75_000, 0.01);
    });

    it('guard: a repayment the same year is netted out (borrow / repay / re-borrow is not double-counted)', () => {
      const s = runAvailableSpending(withDraws({ 2: 25_000, 4: 25_000 }, { 3: 25_000 }));
      // Draw, repay, draw: gross draws $50k, but the client put $25k of their own
      // money back — years with a payment and no draw contribute 0 (floored),
      // and the total spending is the draws, not draws + repaid + re-drawn.
      expect(s.rows[3].creditDraws).toBe(0);
      near(s.totalCreditDraws, 50_000, 0.01);
      // Same year draw + payment nets.
      const same = runAvailableSpending(withDraws({ 2: 25_000 }, { 2: 10_000 }));
      near(same.rows[2].creditDraws, 15_000, 0.01);
    });

    it('guard: only the actual (credit-capped) draw counts, never the requested amount', () => {
      // Ask for far more than the line holds: the engine caps it, and the
      // spending tab must show the capped figure and flag the excess.
      const s = runAvailableSpending(withDraws({ 1: 5_000_000 }));
      const r = runSimulation(withDraws({ 1: 5_000_000 }));
      expect(r.drawsBeyondCredit).toBeGreaterThan(0);
      near(s.rows[1].creditDraws, r.projection[2].draw ?? 0, 0.01);
      expect(s.rows[1].creditDraws).toBeLessThan(5_000_000);
      near(s.drawsBeyondCredit, r.drawsBeyondCredit, 0.01);
    });

    it('guard: a year-1 draw counts against HUD’s first-year limit', () => {
      // No cash at closing, but a big year-1 draw: still a first-12-months
      // disbursement, so the 60% rule must flag it.
      const r0 = runSimulation({ ...base, existingLiens: 0, initialCashDraw: 0 });
      const cap = r0.availableInitialDraw;
      const r = runSimulation(withDraws({ 0: cap + 50_000 }));
      expect(r.firstYearDrawExcess).toBeGreaterThan(0);
      near(r.firstYearDrawExcess, 50_000, 1);
      // A year-2 draw is outside the window and does not count.
      const later = runSimulation(withDraws({ 1: cap + 50_000 }));
      expect(later.firstYearDrawExcess).toBe(0);
    });
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
