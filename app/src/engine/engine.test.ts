import { describe, it, expect } from 'vitest';
import { runSimulation } from './index';
import { defaultInputs, defaultCosts } from './defaults';
import { FV, PMT, MROUND } from './finance';

// Golden-master values captured directly from the V8.5.1 workbook's computed cells
// for the shipped "Jim Smith" scenario. The engine must reproduce these exactly.
// The workbook scenario used 4% appreciation; the app's shipped default is now 3%,
// so the golden master pins the original value explicitly.
const goldenInputs = { ...defaultInputs, appreciation: 0.04 };
const r = runSimulation(goldenInputs);

const near = (a: number, b: number, tol = 0.5) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('Excel financial primitives', () => {
  it('FV matches Excel sign convention', () => {
    // One year of monthly growth on 69,650 at 7.25%/yr.
    near(FV(0.0725 / 12, 12, 0, -69650), 74870.85, 0.01);
  });
  it('PMT matches Excel', () => {
    near(-PMT(0.0725 / 12, 432, 114015, 0, 1), 739.51, 0.01);
  });
  it('MROUND rounds to nearest multiple', () => {
    expect(MROUND(0.06755, 0.00125)).toBeCloseTo(0.0675, 10);
  });
});

describe('Headline figures (Dashboard)', () => {
  it('PLF', () => expect(r.plf).toBeCloseTo(0.337, 6));
  it('Effective home value', () => near(r.effectiveHomeValue, 545000));
  it('Principal limit', () => near(r.principalLimit, 183665));
  it('Initial MIP', () => near(r.initialMIP, 10900));
  it('Total loan cost (HECM costs)', () => near(r.totalLoanCost, 19650));
  it('Initial UPB', () => near(r.initialUPB, 69650));
  it('Remaining credit', () => near(r.remainingCredit, 114015));
  it('Available initial draw', () => near(r.availableInitialDraw, 90549));
  it('Expected rate', () => expect(r.expectedRate).toBeCloseTo(0.0675, 6));
  it('Initial rate', () => expect(r.initialRate).toBeCloseTo(0.06125, 6));
  it('Loan projected rate', () => expect(r.loanProjectedRate).toBeCloseTo(0.0725, 6));
  it('Max tenure payment', () => near(r.maxTenurePayment!, 739.51, 0.01));
});

describe('Projection (Advanced)', () => {
  const y = (n: number) => r.projection[n];

  it('Year 1', () => {
    near(y(1).homeValue, 566800);
    near(y(1).upb, 74870.85, 0.01);
    near(y(1).availableLOC, 122561.37, 0.01);
    near(y(1).equity, 491929.15, 0.01);
    near(y(1).totalPL, 197432.22, 0.01);
  });

  it('Year 10', () => {
    near(y(10).homeValue, 806733.14, 0.01);
    near(y(10).upb, 143495.17, 0.01);
    near(y(10).availableLOC, 234897.37, 0.01);
    near(y(10).equity, 663237.97, 0.01);
    near(y(10).totalPL, 378392.54, 0.01);
  });

  it('Year 20', () => {
    near(y(20).homeValue, 1194162.11, 0.01);
    near(y(20).upb, 295633.37, 0.01);
    near(y(20).availableLOC, 483943.12, 0.01);
    near(y(20).equity, 898528.75, 0.01);
    near(y(20).totalPL, 779576.48, 0.01);
  });

  it('has 39 rows (year 0..38)', () => expect(r.projection.length).toBe(39));
});

describe('Guardrails', () => {
  it('floors remaining credit at 0 and reports overDraw when over-drawn', () => {
    const over = runSimulation({ ...defaultInputs, initialCashDraw: 1_000_000 });
    expect(over.remainingCredit).toBe(0);
    expect(over.overDraw).toBeGreaterThan(0);
    expect(over.initialUPB).toBeCloseTo(over.principalLimit, 6);
    expect(over.maxTenurePayment).toBeNull();
  });

  it('no overDraw on the baseline scenario', () => {
    expect(r.overDraw).toBe(0);
    expect(r.remainingCredit).toBeGreaterThan(0);
  });

  it('clamps a 100% tax rate so investment figures stay finite', () => {
    const taxed = runSimulation({ ...defaultInputs, taxRateOnSoldAssets: 1 });
    expect(Number.isFinite(taxed.projection[1].investment)).toBe(true);
  });

  it('clamps projection years to the 38-year historical window', () => {
    const long = runSimulation({ ...defaultInputs, projectionYears: 80 });
    expect(long.projection.length).toBe(39);
  });

  it('a year-1 extra draw raises the year-1 loan balance', () => {
    const draws = Array(38).fill(0);
    draws[0] = 10000;
    const withDraw = runSimulation({ ...goldenInputs, draws });
    // Beginning-of-year draw is added to the balance, then accrues for 12 months.
    expect(withDraw.projection[1].upb).toBeGreaterThan(r.projection[1].upb + 10000);
    expect(withDraw.projection[1].availableLOC).toBeLessThan(r.projection[1].availableLOC);
  });
});

describe('Principal limit override', () => {
  it('0 (default) computes from the PLF table', () => {
    expect(defaultInputs.principalLimitOverride).toBe(0);
    near(r.principalLimit, 183665);
  });

  it('a lender quote replaces the table-derived limit and flows downstream', () => {
    const quoted = runSimulation({ ...goldenInputs, principalLimitOverride: 200000 });
    expect(quoted.principalLimit).toBe(200000);
    // LOC start = limit − initial UPB (69,650 financed costs + liens + draw)
    near(quoted.remainingCredit, 200000 - 69650);
    near(quoted.projection[0].availableLOC, 200000 - 69650);
    near(quoted.projection[0].totalPL, 200000);
  });

  it('matches the case-study lender quote of $258,600 at age 62', () => {
    const quoted = runSimulation({
      ...defaultInputs,
      age: 62,
      homeValue: 800000,
      initialCashDraw: 0,
      existingLiens: 0,
      costsInLoan: false,
      principalLimitOverride: 258600,
    });
    expect(quoted.principalLimit).toBe(258600);
    near(quoted.remainingCredit, 258600);
  });
});

describe('Off-grid margin (PLF grid snap)', () => {
  it('a non-0.125%-grid margin no longer zeroes the principal limit', () => {
    // margin 2.4% makes the expected rate land between PLF table grid points.
    const offGrid = runSimulation({ ...goldenInputs, margin: 0.024 });
    expect(offGrid.plf).toBeGreaterThan(0);
    expect(offGrid.principalLimit).toBeGreaterThan(0);
    // Snaps to the same 6.75% grid row as the on-grid default → same PLF.
    expect(offGrid.plf).toBeCloseTo(r.plf, 6);
    // Future PLF columns are also rescued (no longer collapse to 0).
    expect(offGrid.projection[1].futurePLF).toBeGreaterThan(0);
  });

  it('on-grid default margin is unchanged (golden master intact)', () => {
    expect(r.plf).toBeCloseTo(0.337, 6);
  });

  it('a margin far outside the table still yields 0 (out-of-range guard)', () => {
    // expected rate ~ 4.375% + 9% = 13.375% is on-grid and valid; push beyond
    // the table top (18.875%) to confirm the out-of-range branch still zeroes.
    const huge = runSimulation({ ...goldenInputs, margin: 0.2 });
    expect(huge.plf).toBe(0);
  });
});

describe('Rate scenarios', () => {
  it('flat scenario reproduces the golden master exactly', () => {
    const flat = runSimulation({ ...goldenInputs, rateScenario: 'Flat (assumed)' });
    near(flat.projection[20].upb, 295633.37, 0.01);
    near(flat.projection[20].totalPL, 779576.48, 0.01);
  });

  it('+2% shock accrues balance, LOC, and total PL at 9.25%', () => {
    const up = runSimulation({ ...goldenInputs, rateScenario: 'Rates +2%' });
    const y1 = up.projection[1];
    expect(y1.accrualRate).toBeCloseTo(0.0925, 10);
    near(y1.upb, FV(0.0925 / 12, 12, 0, -69650), 0.01);
    near(y1.totalPL, -FV(0.0925 / 12, 12, 0, 183665.45), 1);
  });

  it('-2% shock accrues at 5.25%', () => {
    const down = runSimulation({ ...goldenInputs, rateScenario: 'Rates -2%' });
    expect(down.projection[1].accrualRate).toBeCloseTo(0.0525, 10);
  });

  it('-2% shock floors at margin + MIP when the index would go negative', () => {
    const low = runSimulation({ ...goldenInputs, cmt10yr: 0.005, rateScenario: 'Rates -2%' });
    // expected rate = 0.5% + 2.375% = 2.875%; +MIP = 3.375%; −2% would be 1.375%,
    // below the 2.875% margin+MIP floor.
    expect(low.projection[1].accrualRate).toBeCloseTo(0.02875, 10);
  });

  it('replay starts at 1986 rates and moves forward', () => {
    const replay = runSimulation({ ...goldenInputs, rateScenario: 'Replay 1986-2024' });
    // 1986 1yr CMT = 6.45356%; + margin 2.375% + MIP 0.5%
    expect(replay.projection[1].accrualRate).toBeCloseTo(0.0645356 + 0.02875, 8);
    // 1987 = 6.77148%
    expect(replay.projection[2].accrualRate).toBeCloseTo(0.0677148 + 0.02875, 8);
  });
});

describe('Standby LOC strategy (ChatGPT case study: 62yo, $800k home, 3% apprec., $25,400 costs)', () => {
  const caseStudy = {
    ...defaultInputs,
    age: 62,
    homeValue: 800000,
    appreciation: 0.03,
    initialCashDraw: 0,
    existingLiens: 0,
    // origination 6,000 (capped) + initial MIP 16,000 + other 3,400 = 25,400
    costs: { ...defaultCosts, counselingCost: 0, appraisalPOC: 0, other: 3400 },
  };

  it('costs paid in cash: LOC compounds monthly to ~$1.09M at year 20, balance $0', () => {
    const res = runSimulation({ ...caseStudy, costsInLoan: false });
    const y20 = res.projection[20];
    near(res.principalLimit, 257600);
    near(y20.homeValue, 1444889, 1);
    near(y20.availableLOC, 1093398, 1);
    near(y20.upb, 0, 0.01);
    near(y20.accessibleResources, 2538287, 1);
  });

  it('costs financed: the $25,400 grows to a ~$108k balance that shrinks LOC and equity', () => {
    const res = runSimulation({ ...caseStudy, costsInLoan: true });
    const y20 = res.projection[20];
    near(y20.upb, 107812, 1);
    near(y20.availableLOC, 985586, 1);
    near(y20.equity, 1337077, 1);
    // nothing paid out of pocket → no POC drag; net worth equals equity
    expect(y20.pocDrag).toBe(0);
    near(y20.rmNetWorth, y20.equity, 0.01);
  });

  it('net worth with 0% opportunity cost matches the case study (~$1,419,500)', () => {
    const res = runSimulation({ ...caseStudy, costsInLoan: false, investmentReturn: 0 });
    const y20 = res.projection[20];
    expect(y20.pocDrag).toBeCloseTo(25400, 6);
    near(y20.rmNetWorth, 1444889 - 25400, 1);
  });

  it('net worth subtracts compounded opportunity cost when a return is assumed', () => {
    const res = runSimulation({ ...caseStudy, costsInLoan: false, investmentReturn: 0.06 });
    const y20 = res.projection[20];
    // 25,400 × (1 + 0.06/12)^240
    const expectedDrag = 25400 * Math.pow(1 + 0.06 / 12, 240);
    near(y20.pocDrag, expectedDrag, 1);
    near(y20.rmNetWorth, y20.equity - expectedDrag, 1);
  });
});
