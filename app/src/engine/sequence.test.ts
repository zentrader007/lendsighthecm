import { describe, it, expect } from 'vitest';
import { runSequenceAnalysis } from './sequence';
import { defaultInputs, defaultCosts } from './defaults';

// Sequence-of-returns case study (validated against the standby-LOC ChatGPT
// conversation): 62yo, $800k home, $1M portfolio, $60k/yr spending, −40%
// crash at the start, +10% recovery for 4 years, 6% after, costs POC $25,400.
const caseStudy = {
  ...defaultInputs,
  age: 62,
  homeValue: 800000,
  appreciation: 0.03,
  initialCashDraw: 0,
  existingLiens: 0,
  costsInLoan: false,
  costs: { ...defaultCosts, counselingCost: 0, appraisalPOC: 0, other: 3400 },
  portfolioValue: 1_000_000,
  annualSpending: 60_000,
  crashPct: 0.4,
  recoveryReturn: 0.1,
  recoveryYears: 4,
  projectionYears: 25,
};

const near = (a: number, b: number, tol = 1) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('Sequence-of-returns analysis', () => {
  const seq = runSequenceAnalysis(caseStudy);
  const y = (n: number) => seq.rows[n - 1];

  it('year 4: bridge keeps the portfolio at $856k vs $572k selling assets', () => {
    near(y(4).portfolioSell, 572154);
    near(y(4).portfolioBridge, 856147);
    // HECM debt/LOC grow at the note rate (6.625%) per HUD's growth formula.
    near(y(4).hecmDebt, 283875);
    near(y(4).hecmLOC, 51644);
  });

  it('bridge draws the full 4 years of spending from the LOC', () => {
    expect(seq.totalBridgeDraws).toBe(240000);
    expect(y(1).bridgeDraw).toBe(60000);
    expect(y(5).bridgeDraw).toBe(0);
  });

  it('selling assets depletes the portfolio at age 80 with $460k unfunded', () => {
    expect(seq.sellDepletionYear).toBe(18);
    expect(seq.sellDepletionAge).toBe(80);
    near(seq.unfundedSell, 460541);
  });

  it('the bridge strategy never depletes and funds all spending', () => {
    expect(seq.bridgeDepletionYear).toBeNull();
    expect(seq.unfundedBridge).toBe(0);
  });

  it('year 25: bridge ends with $367k portfolio; debt has grown to $1.14M', () => {
    near(y(25).portfolioSell, 0);
    near(y(25).portfolioBridge, 366989);
    near(y(25).hecmDebt, 1136784);
    near(y(25).equity, 538238);
    near(y(25).hecmLOC, 206809);
  });

  it('caps bridge draws so the LOC never goes negative', () => {
    const tight = runSequenceAnalysis({ ...caseStudy, annualSpending: 80000, recoveryYears: 5 });
    for (const row of tight.rows) expect(row.hecmLOC).toBeGreaterThanOrEqual(0);
    // The cap means some spending falls back to the portfolio, not thin air.
    expect(tight.totalBridgeDraws).toBeLessThan(400000);
  });

  it('no crash + no bridge years degenerates to two identical-spending paths', () => {
    const calm = runSequenceAnalysis({ ...caseStudy, crashPct: 0, recoveryYears: 0 });
    // Sell-assets path starts at the full $1M and survives the horizon.
    expect(calm.sellDepletionYear).toBeNull();
    // Bridge path only differs by the $25,400 of out-of-pocket costs.
    expect(calm.rows[0].portfolioSell - calm.rows[0].portfolioBridge).toBeCloseTo(
      25400 * 1.06,
      0,
    );
  });
});
