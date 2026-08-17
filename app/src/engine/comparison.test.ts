import { describe, it, expect } from 'vitest';
import { runMortgageComparison, monthlyMortgagePayment, residualMortgage } from './comparison';
import { defaultInputs } from './defaults';

const near = (a: number, b: number, tol = 1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

// Independent month-by-month amortization to cross-check the closed form.
function amortize(balance: number, annualRate: number, termYears: number, months: number): number {
  const r = annualRate / 12;
  const m = (balance * r) / (1 - Math.pow(1 + r, -termYears * 12));
  let b = balance;
  for (let i = 0; i < months; i++) b = b * (1 + r) - m;
  return Math.max(0, b);
}

describe('mortgage amortization', () => {
  it('0% rate: payment is straight-line and residual is linear', () => {
    expect(monthlyMortgagePayment(120000, 0, 10)).toBeCloseTo(1000, 6);
    near(residualMortgage(120000, 0, 10, 5), 60000, 0.01);
    near(residualMortgage(120000, 0, 10, 10), 0, 0.01);
  });

  it('residual starts at the full balance and hits 0 at the end of the term', () => {
    near(residualMortgage(150000, 0.065, 30, 0), 150000, 0.01);
    near(residualMortgage(150000, 0.065, 30, 30), 0, 0.01);
    near(residualMortgage(150000, 0.065, 30, 40), 0, 0.01); // past term stays 0
  });

  it('closed-form residual matches a month-by-month amortization', () => {
    for (const t of [1, 5, 10, 20, 29]) {
      near(residualMortgage(150000, 0.065, 30, t), amortize(150000, 0.065, 30, t * 12), 0.5);
    }
  });
});

describe('two-world net-worth comparison', () => {
  const base = {
    ...defaultInputs,
    age: 70,
    homeValue: 600000,
    existingLiens: 150000,
    existingLienRate: 0.065,
    existingLienTermRemaining: 25,
    costsInLoan: true,
    portfolioValue: 300000,
    annualSpending: 50000,
    investmentReturn: 0.05,
    projectionYears: 30,
    rateScenario: 'Flat (assumed)' as const,
  };

  it('the mortgage drain depletes the no-HECM portfolio before the HECM one', () => {
    const res = runMortgageComparison(base);
    expect(res.annualMortgagePayment).toBeGreaterThan(0);
    expect(res.noHecmDepletionYear).not.toBeNull();
    expect(
      res.hecmDepletionYear === null || res.noHecmDepletionYear! < res.hecmDepletionYear,
    ).toBe(true);
  });

  it('reports the break-even age where HECM net worth overtakes the baseline', () => {
    // A break-even on RAW net worth only exists when the freed money out-earns the
    // HECM's ~7% balance growth — i.e. the assumed return clears the loan rate.
    // At a 9% portfolio return (sustainable withdrawal), the HECM catches up.
    const res = runMortgageComparison({
      ...base,
      portfolioValue: 1_000_000,
      annualSpending: 35_000,
      investmentReturn: 0.09,
    });
    expect(res.breakEvenYear).not.toBeNull();
    expect(res.breakEvenAge).toBe(70 + res.breakEvenYear!);
    // At break-even the HECM is at/above the baseline; the year before, behind.
    const beRow = res.rows.find((r) => r.year === res.breakEvenYear)!;
    const prevRow = res.rows.find((r) => r.year === res.breakEvenYear! - 1)!;
    expect(beRow.netWorthHecm).toBeGreaterThanOrEqual(beRow.netWorthNoHecm);
    expect(prevRow.netWorthHecm).toBeLessThan(prevRow.netWorthNoHecm);
  });

  it('no break-even at a typical return, where a reverse mortgage lags on raw net worth', () => {
    // The default base (5% return, 6.5% mortgage vs a ~7% HECM balance): keeping a
    // cheap amortizing mortgage wins on terminal net worth, so the HECM line never
    // overtakes. The value there is cash flow / longevity, not net worth — so there
    // is honestly no break-even to mark.
    expect(runMortgageComparison(base).breakEvenYear).toBeNull();
    expect(runMortgageComparison(base).breakEvenAge).toBeNull();
  });

  it('year 0 snapshot: no-HECM equity is full home value, HECM equity nets the balance', () => {
    const res = runMortgageComparison(base);
    const y0 = res.rows[0];
    near(y0.residualMortgage, 150000, 0.01);
    near(y0.homeEquityNoHecm, 600000 - 150000, 0.01);
    expect(y0.homeEquityHecm).toBeLessThan(y0.homeEquityNoHecm); // HECM balance > residual at t0
    near(y0.portfolioNoHecm, 300000, 0.01);
  });

  it('banking the freed P&I beats consuming it on the wealth axis', () => {
    // Sustainable withdrawal so the HECM portfolio survives in both modes.
    const sustainable = { ...base, portfolioValue: 1_000_000, annualSpending: 35_000 };
    const banked = runMortgageComparison({ ...sustainable, freedCashConsumed: false });
    const consumed = runMortgageComparison({ ...sustainable, freedCashConsumed: true });
    const last = (r: ReturnType<typeof runMortgageComparison>) => r.rows[r.rows.length - 1];
    // Consuming the freed cash drains the HECM portfolio, so end net worth is lower.
    expect(last(consumed).portfolioHecm).toBeLessThan(last(banked).portfolioHecm);
    expect(last(consumed).netWorthHecm).toBeLessThan(last(banked).netWorthHecm);
  });

  it('build-savings mode: the invested freed payment lifts net worth even from a $0 portfolio', () => {
    // No portfolio, no living spending, and no cash draw to muddy it — the only
    // moving part is the freed mortgage payment being invested as new savings.
    const zero = { ...base, portfolioValue: 0, annualSpending: 0, initialCashDraw: 0 };
    const plain = runMortgageComparison({ ...zero, freedPaymentInvested: false });
    const built = runMortgageComparison({
      ...zero,
      freedCashConsumed: false,
      freedPaymentInvested: true,
    });
    const last = (r: ReturnType<typeof runMortgageComparison>) => r.rows[r.rows.length - 1];

    // Default mode can't build from nothing: the HECM portfolio stays at $0.
    near(last(plain).portfolioHecm, 0, 0.01);
    // Build-savings compounds the freed payment into a real, growing bucket...
    expect(last(built).freedInvested).toBeGreaterThan(0);
    expect(built.freedInvestedValue).toBeGreaterThan(built.cumulativeFreedPayment); // grown, not just summed
    // ...so HECM net worth rises above the do-nothing baseline (same home equity).
    expect(last(built).netWorthHecm).toBeGreaterThan(last(plain).netWorthHecm);
    expect(last(built).homeEquityHecm).toBeCloseTo(last(plain).homeEquityHecm, 6); // loan sim unchanged
  });

  it('build-savings mode: the no-HECM portfolio is no longer drained by the P&I', () => {
    // Funding the mortgage from income (not the portfolio) means the no-HECM
    // portfolio keeps more than it would when the payment comes out of savings.
    // Use a sustainable withdrawal so the portfolio survives to compare at the end.
    const sustainable = { ...base, portfolioValue: 1_000_000, annualSpending: 35_000 };
    const drained = runMortgageComparison({ ...sustainable, freedPaymentInvested: false });
    const fromIncome = runMortgageComparison({
      ...sustainable,
      freedCashConsumed: false,
      freedPaymentInvested: true,
    });
    const last = (r: ReturnType<typeof runMortgageComparison>) => r.rows[r.rows.length - 1];
    expect(last(fromIncome).portfolioNoHecm).toBeGreaterThan(last(drained).portfolioNoHecm);
  });

  it('build-savings has no effect when the freed cash is consumed', () => {
    // Consuming the payment wins over investing it: build-savings must defer.
    const a = runMortgageComparison({ ...base, freedCashConsumed: true, freedPaymentInvested: false });
    const b = runMortgageComparison({ ...base, freedCashConsumed: true, freedPaymentInvested: true });
    const last = (r: ReturnType<typeof runMortgageComparison>) => r.rows[r.rows.length - 1];
    near(last(a).netWorthHecm, last(b).netWorthHecm, 0.01);
    expect(b.freedInvestedValue).toBe(0);
  });

  it('an overpaid mortgage stops the freed payment at the real payoff, not the full term', () => {
    // Same $150k balance and 25-yr term, but the client pays ~double the scheduled
    // P&I, retiring the loan far sooner. The freed-payment window must shrink to
    // the actual payoff rather than running the full term.
    const scheduled = runMortgageComparison(base); // auto-amortized over 25 yrs
    const fast = runMortgageComparison({
      ...base,
      existingLienPayment: 2 * scheduled.monthlyMortgagePayment,
    });
    expect(fast.freedPaymentYears).toBeLessThan(scheduled.freedPaymentYears);
    // The no-HECM balance actually reaches zero that year (equity restored early).
    const payoff = fast.rows.find((row) => row.year > 0 && row.residualMortgage === 0);
    expect(payoff).toBeDefined();
    expect(payoff!.year).toBe(fast.freedPaymentYears);
    // Freed cash-flow total reflects the shorter window, not a full 25 years.
    expect(fast.cumulativeFreedPayment).toBeCloseTo(
      fast.annualMortgagePayment * fast.freedPaymentYears,
      6,
    );
  });

  it('no existing lien → no mortgage payment and full-home-value baseline', () => {
    const res = runMortgageComparison({ ...base, existingLiens: 0 });
    expect(res.annualMortgagePayment).toBe(0);
    for (const row of res.rows) near(row.homeEquityNoHecm, row.homeValue, 0.01);
  });

  it('no lien frees no payment even with a stale payment override', () => {
    // Clearing the lien must zero the freed payment; a leftover override cannot
    // conjure a monthly payment on a mortgage that no longer exists.
    const res = runMortgageComparison({ ...base, existingLiens: 0, existingLienPayment: 1_500 });
    expect(res.monthlyMortgagePayment).toBe(0);
    expect(res.annualMortgagePayment).toBe(0);
    expect(res.freedPaymentYears).toBe(0);
  });

  it('the cash the HECM provides is credited to the portfolio as an invested asset', () => {
    // The cash the HECM hands over (the initial draw) is money in hand — it shows
    // up as a portfolio asset, net of out-of-pocket costs, not vanishing.
    const res = runMortgageComparison({
      ...base,
      existingLiens: 0,
      initialCashDraw: 100000,
      portfolioValue: 200000,
    });
    const y0 = res.rows[0];
    expect(y0.portfolioHecm).toBeGreaterThan(y0.portfolioNoHecm);
    near(y0.portfolioHecm - y0.portfolioNoHecm, 100000 - res.hecm.pocCosts, 1);
  });

  it('credits scheduled credit-line draws to the HECM portfolio (they don’t vanish)', () => {
    // A $30k draw in year 5 raises the loan balance (lowering equity) — it must
    // also land in the portfolio as cash in hand, so HECM net worth is roughly
    // unchanged at the draw, not $30k poorer.
    const draws = Array(38).fill(0);
    draws[4] = 30_000; // year 5
    const plain = runMortgageComparison({ ...base, existingLiens: 0, initialCashDraw: 0 });
    const drawn = runMortgageComparison({ ...base, existingLiens: 0, initialCashDraw: 0, draws });
    const y5p = plain.rows[5];
    const y5d = drawn.rows[5];
    // Portfolio up by the draw grown one year at the investment return.
    near(y5d.portfolioHecm - y5p.portfolioHecm, 30_000 * (1 + base.investmentReturn), 1);
    // Equity down by the draw grown one year at the loan rate — so net worth
    // moves only by the small rate differential, not by the whole $30k.
    const nwGap = y5p.netWorthHecm - y5d.netWorthHecm;
    expect(Math.abs(nwGap)).toBeLessThan(30_000 * 0.05);

    // A repayment is cash OUT of the portfolio.
    const payments = Array(38).fill(0);
    payments[6] = 10_000; // year 7
    const repaid = runMortgageComparison({ ...base, existingLiens: 0, initialCashDraw: 0, draws, payments });
    expect(repaid.rows[7].portfolioHecm).toBeLessThan(drawn.rows[7].portfolioHecm);
  });

  it('credits the cash draw whether or not a lien is present (no toggle shorting)', () => {
    // A cash draw is an asset in hand, so it must be credited in BOTH cases — or
    // adding a lien would drop the HECM line as the draw silently vanished. The
    // loan balance already reflects the draw (lowering equity), so this nets out.
    const draw = 40_000;
    const noLien = runMortgageComparison({ ...base, existingLiens: 0, initialCashDraw: draw });
    const withLien = runMortgageComparison({ ...base, existingLiens: 150_000, initialCashDraw: draw });
    const lead = (r: ReturnType<typeof runMortgageComparison>) =>
      r.rows[0].portfolioHecm - r.rows[0].portfolioNoHecm;
    expect(lead(noLien)).toBeGreaterThan(0);
    expect(lead(withLien)).toBeGreaterThan(0);
    // Same draw → same credit (the engine's netCashDrawn), lien or not.
    near(lead(noLien), lead(withLien), 1);
  });
});
