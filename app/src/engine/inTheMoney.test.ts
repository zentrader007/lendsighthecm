import { describe, it, expect } from 'vitest';
import { runInTheMoney } from './inTheMoney';
import { runSimulation } from './index';
import { defaultInputs } from './defaults';

const near = (a: number, b: number, tol = 1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

// The reported real-world case: a 64-year-old with a $650k home and a $250k
// lien is short of qualifying. Rates pinned so the fixture is stable.
const shortCase = {
  ...defaultInputs,
  age: 64,
  homeValue: 650_000,
  existingLiens: 250_000,
  initialCashDraw: 0,
  costsInLoan: true,
  cmt10yr: 0.0472,
  futureCMT10yr: 0.0472,
};

describe('In the money', () => {
  it('reports the shortfall for a borrower who cannot close today', () => {
    const r = runInTheMoney(shortCase);
    expect(r.isShortToday).toBe(true);
    near(r.shortfallToday, 60_350, 1); // principal limit 208,650 vs 250,000 lien + 19,000 costs
    near(r.availableToday, -60_350, 1);
    near(r.depositToQualifyNow, 60_350, 1);
    // Year 0 principal limit matches the headline figure exactly.
    near(r.rows[0].principalLimit, runSimulation(shortCase).principalLimit, 0.01);
  });

  it('finds the crossover where waiting alone makes them qualify', () => {
    const r = runInTheMoney(shortCase);
    expect(r.itmYear).toBe(4);
    expect(r.itmAge).toBe(68);
    // Short right up to the crossing, in the money from it on.
    expect(r.rows[3].available).toBeLessThan(0);
    expect(r.rows[4].available).toBeGreaterThanOrEqual(0);
    near(r.rows[4].available, 5_130, 1);
  });

  it('the gap closes from all three directions — PLF, home value, and the lien', () => {
    const r = runInTheMoney(shortCase);
    const a = r.rows[1];
    const b = r.rows[3];
    expect(b.principalLimit).toBeGreaterThan(a.principalLimit); // older + appreciation
    expect(b.homeValue).toBeGreaterThan(a.homeValue);
    expect(b.lienBalance).toBeLessThan(a.lienBalance); // mortgage amortizing down
    expect(b.available).toBeGreaterThan(a.available);
  });

  it('a cash deposit qualifies them now and leaves the surplus as credit', () => {
    const dep = runInTheMoney({ ...shortCase, initialCashDraw: 65_000, cashMode: 'Deposit' });
    expect(dep.isShortToday).toBe(false);
    near(dep.availableToday, 4_650, 1); // 65,000 brought in vs the 60,350 gap
    expect(dep.itmYear).toBe(0);
    expect(dep.itmAge).toBe(64);
    // The engine agrees: no over-draw, no cash out, and the surplus is real credit.
    expect(dep.hecm.overDraw).toBe(0);
    near(dep.hecm.remainingCredit, 4_650, 1);
    expect(dep.hecm.netCashDrawn).toBe(0);
    near(dep.hecm.cashDeposit, 65_000, 0.01);
  });

  it('a partial deposit moves the crossover earlier without reaching it', () => {
    const partial = runInTheMoney({ ...shortCase, initialCashDraw: 30_000, cashMode: 'Deposit' });
    expect(partial.isShortToday).toBe(true);
    near(partial.shortfallToday, 30_350, 1);
    expect(partial.itmYear!).toBeGreaterThan(0);
    expect(partial.itmYear!).toBeLessThan(4); // sooner than waiting with no cash
  });

  it('a borrower who already qualifies is in the money at year 0', () => {
    const r = runInTheMoney({ ...shortCase, existingLiens: 0 });
    expect(r.isShortToday).toBe(false);
    expect(r.shortfallToday).toBe(0);
    expect(r.itmYear).toBe(0);
    expect(r.availableToday).toBeGreaterThan(0);
  });

  it('never qualifying within the horizon reports no crossover', () => {
    // A lien far beyond anything the principal limit could reach.
    const r = runInTheMoney({ ...shortCase, existingLiens: 3_000_000, existingLienRate: 0, existingLienTermRemaining: 0 });
    expect(r.itmYear).toBeNull();
    expect(r.itmAge).toBeNull();
    expect(r.rows.every((row) => row.available < 0)).toBe(true);
  });
});

describe('Cash mode (draw vs deposit)', () => {
  it("'Draw' is the default and leaves today's behavior unchanged", () => {
    expect(defaultInputs.cashMode).toBe('Draw');
    const a = runSimulation(defaultInputs);
    const b = runSimulation({ ...defaultInputs, cashMode: 'Draw' });
    near(a.initialUPB, b.initialUPB, 0.01);
    near(a.remainingCredit, b.remainingCredit, 0.01);
    expect(a.cashDeposit).toBe(0);
  });

  it('a deposit lowers the balance where a draw raises it', () => {
    const inp = { ...shortCase, existingLiens: 100_000, initialCashDraw: 40_000 };
    const draw = runSimulation({ ...inp, cashMode: 'Draw' });
    const dep = runSimulation({ ...inp, cashMode: 'Deposit' });
    near(draw.initialUPB - dep.initialUPB, 80_000, 1); // +40k vs -40k
    expect(dep.remainingCredit).toBeGreaterThan(draw.remainingCredit);
    // A deposit is not cash in hand, so nothing is drawn or investable.
    expect(dep.netCashDrawn).toBe(0);
    near(dep.cashDeposit, 40_000, 0.01);
    // ...and it cannot trip HUD's first-year disbursement rule.
    expect(dep.firstYearDrawExcess).toBe(0);
  });

  it('a deposit never drives the loan balance below zero', () => {
    const huge = runSimulation({ ...shortCase, existingLiens: 0, initialCashDraw: 5_000_000, cashMode: 'Deposit' });
    expect(huge.initialUPB).toBeGreaterThanOrEqual(0);
    expect(huge.projection.every((r) => r.upb >= 0)).toBe(true);
  });
});

describe("HUD first-year limit with a deposit", () => {
  it('nets the deposit out of mandatory obligations and never goes negative', () => {
    // A lien larger than the principal limit used to drive the first-year limit
    // negative (principalLimit − MO − fees), which then reported a phantom
    // over-disbursement. The borrower's own cash pays part of the lien, so it
    // reduces the obligations the LOAN must fund.
    const dep = runSimulation({ ...shortCase, initialCashDraw: 65_000, cashMode: 'Deposit' });
    expect(dep.availableInitialDraw).toBeGreaterThanOrEqual(0);
    near(dep.availableInitialDraw, 4_650, 1); // the surplus, capped by the 10% rule
    expect(dep.firstYearDrawExcess).toBe(0);
  });

  it('leaves the no-deposit path untouched', () => {
    const a = runSimulation(defaultInputs);
    const b = runSimulation({ ...defaultInputs, cashMode: 'Draw' });
    near(a.availableInitialDraw, b.availableInitialDraw, 0.01);
    expect(a.availableInitialDraw).toBeGreaterThan(0);
  });
});
