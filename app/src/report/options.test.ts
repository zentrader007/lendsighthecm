import { describe, it, expect } from 'vitest';
import { defaultInputs } from '../engine/defaults';
import { runSimulation } from '../engine';
import { runMortgageComparison } from '../engine/comparison';
import { runAvailableSpending } from '../engine/spending';
import { runOptions, refIndexFor } from './options';

const zeros = () => Array(38).fill(0) as number[];

describe('Options side-by-side', () => {
  const inp = { ...defaultInputs, existingLiens: 150_000 };
  const opts = runOptions(inp);
  const col = (k: string) => opts.columns.find((c) => c.key === k)!;

  it('anchors to the first row at or after age 85', () => {
    const res = runSimulation(inp);
    expect(opts.refAge).toBe(res.projection[refIndexFor(res, 85)].age);
    expect(opts.refAge).toBeGreaterThanOrEqual(85);
  });

  it('lists every structure plus do-nothing, in order', () => {
    expect(opts.columns.map((c) => c.key)).toEqual(['plan', 'maxCash', 'loc', 'tenure', 'none']);
  });

  it('"This plan" equals a direct simulation of the inputs', () => {
    const res = runSimulation(inp);
    const cmp = runMortgageComparison(inp);
    const i = refIndexFor(res, 85);
    const c = col('plan');
    expect(c.cashAtClosing).toBe(res.netCashDrawn);
    expect(c.creditLineToday).toBe(res.remainingCredit);
    expect(c.creditLineAtRef).toBe(res.projection[i].availableLOC);
    expect(c.loanBalanceAtRef).toBe(res.projection[i].upb);
    expect(c.homeEquityAtRef).toBe(res.projection[i].equity);
    expect(c.netWorthAtRef).toBe(cmp.rows[i].netWorthHecm);
    expect(c.paymentEliminated).toBe(cmp.monthlyMortgagePayment);
  });

  it('"Most cash now" draws HUD\'s first-year maximum with no scheduled draws', () => {
    const locOnly = { ...inp, initialCashDraw: 0, draws: zeros(), payments: zeros() };
    const hudMax = runSimulation(locOnly).availableInitialDraw;
    expect(hudMax).toBe(runAvailableSpending(locOnly).hudMaxLumpSum);
    const res = runSimulation({ ...locOnly, initialCashDraw: hudMax });
    const c = col('maxCash');
    expect(c.cashAtClosing).toBe(res.netCashDrawn);
    // The plan's own $50k draw over-draws the limit, so it caps at the same maximum.
    expect(c.cashAtClosing!).toBeGreaterThanOrEqual(col('plan').cashAtClosing!);
  });

  it('"Growing credit line" takes nothing and has the largest line at the reference age', () => {
    const c = col('loc');
    expect(c.cashAtClosing).toBe(0);
    for (const other of opts.columns.filter((o) => o.creditLineAtRef != null && o.key !== 'loc')) {
      expect(c.creditLineAtRef!).toBeGreaterThanOrEqual(other.creditLineAtRef!);
    }
  });

  it('"Monthly for life" is the tenure payment on the untouched line, modeled as annual draws', () => {
    const locOnly = { ...inp, initialCashDraw: 0, draws: zeros(), payments: zeros() };
    const tenure = runSimulation(locOnly).maxTenurePayment!;
    const c = col('tenure');
    expect(c.monthlyIncome).toBe(tenure);
    const draws = zeros().map(() => tenure * 12);
    const res = runSimulation({ ...locOnly, draws });
    const i = refIndexFor(res, 85);
    expect(c.loanBalanceAtRef).toBe(res.projection[i].upb);
    expect(c.homeEquityAtRef).toBe(res.projection[i].equity);
  });

  it('"Keep current mortgage" reads the no-HECM world of the comparison', () => {
    const cmp = runMortgageComparison(inp);
    const i = refIndexFor(runSimulation(inp), 85);
    const c = col('none');
    expect(c.netWorthAtRef).toBe(cmp.rows[i].netWorthNoHecm);
    expect(c.homeEquityAtRef).toBe(cmp.rows[i].homeEquityNoHecm);
    expect(c.loanBalanceAtRef).toBe(cmp.rows[i].residualMortgage);
    expect(c.cashAtClosing).toBeNull();
    expect(c.paymentEliminated).toBeNull();
    expect(opts.hasLien).toBe(true);
  });

  it('without a lien, do-nothing has no loan balance and no payment to eliminate', () => {
    const o = runOptions(defaultInputs);
    expect(o.hasLien).toBe(false);
    expect(o.monthlyMortgagePayment).toBe(0);
    expect(o.columns.find((c) => c.key === 'none')!.loanBalanceAtRef).toBeNull();
    expect(o.columns.find((c) => c.key === 'plan')!.paymentEliminated).toBeNull();
  });

  it('a borrower short of qualifying only sees their plan and do-nothing', () => {
    const short = { ...defaultInputs, existingLiens: 500_000 };
    expect(runSimulation(short).availableFunds).toBeLessThan(0);
    expect(runOptions(short).columns.map((c) => c.key)).toEqual(['plan', 'none']);
  });
});
