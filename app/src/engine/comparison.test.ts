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
    // No portfolio and no living spending to muddy it — the only moving part is
    // the freed mortgage payment being invested as new savings.
    const zero = { ...base, portfolioValue: 0, annualSpending: 0 };
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

  it('no existing lien → no mortgage payment and full-home-value baseline', () => {
    const res = runMortgageComparison({ ...base, existingLiens: 0 });
    expect(res.annualMortgagePayment).toBe(0);
    for (const row of res.rows) near(row.homeEquityNoHecm, row.homeValue, 0.01);
  });

  it('no lien: the HECM proceeds are credited to the portfolio as an invested asset', () => {
    // Without a mortgage to pay off, the cash the HECM provides (the initial draw)
    // is what the borrower gains — it should show up as a portfolio asset, not
    // vanish. The lien case leaves the proceeds out (they fund the payoff instead).
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
});
