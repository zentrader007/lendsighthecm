import { describe, it, expect } from 'vitest';
import { runSimulation } from './index';
import { defaultInputs, defaultCosts } from './defaults';
import { FV, PMT, MROUND } from './finance';

// Golden-master values captured directly from the V8.5.1 workbook's computed cells
// for the shipped "Jim Smith" scenario. The engine must reproduce these exactly.
// The workbook scenario used 4% appreciation and a $2,750 "Other" closing cost; the
// app's shipped defaults are now 3% and $0 (fees are itemized instead), so the
// golden master pins the original workbook values explicitly.
const goldenInputs = {
  ...defaultInputs,
  appreciation: 0.04,
  costs: { ...defaultCosts, other: 2750 },
};
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

  // Balance, LOC, and total PL grow monthly at the expected rate + MIP (7.25%)
  // — the workbook's loanProjectedRate and the industry-tool convention
  // (Quantum / REVERSE+). Each value below also equals the closed-form
  // start × (1 + 0.0725/12)^(12·year), an independent check of the iterative
  // monthly loop. Home value still grows at 4% appreciation.
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

  it('monthly loop matches closed-form expected-rate compounding at year 20', () => {
    const nr = 0.0725; // expectedRate (6.75%) + annual MIP (0.5%)
    const grow = (v: number, yr: number) => v * Math.pow(1 + nr / 12, 12 * yr);
    near(y(20).upb, grow(r.initialUPB, 20), 0.01);
    near(y(20).availableLOC, grow(r.remainingCredit, 20), 0.01);
    near(y(20).totalPL, grow(r.principalLimit, 20), 0.01);
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

  it('caps scheduled draws at the available credit line and reports the excess', () => {
    // The Draws column is user-editable, so a typed draw must get the same
    // protection the initial draw has — you cannot borrow more than the line
    // holds. Previously this drove the credit line negative and pushed the
    // balance past the principal limit with no flag.
    const huge = runSimulation({
      ...defaultInputs,
      draws: defaultInputs.draws.map((_, i) => (i === 0 ? 500_000 : 0)),
    });
    expect(huge.drawsBeyondCredit).toBeGreaterThan(0);
    expect(huge.firstCappedDrawYear).toBe(1);
    const y1 = huge.projection[1];
    expect(y1.availableLOC).toBeGreaterThanOrEqual(-0.01); // never negative
    expect(y1.upb).toBeLessThanOrEqual(y1.totalPL + 0.01); // never beyond the principal limit
    // The HECM identity still holds after capping.
    near(y1.availableLOC + y1.upb, y1.totalPL, 0.01);

    // A draw inside the line is untouched and reports nothing.
    const ok = runSimulation({
      ...defaultInputs,
      draws: defaultInputs.draws.map((_, i) => (i === 0 ? 5_000 : 0)),
    });
    expect(ok.drawsBeyondCredit).toBe(0);
    expect(ok.firstCappedDrawYear).toBeNull();
    expect(ok.projection[1].draw).toBe(5_000);
  });

  it("flags a cash draw above HUD's first-year disbursement limit", () => {
    // The 60% rule binds even when the loan fits inside the principal limit.
    const over = runSimulation({
      ...defaultInputs,
      homeValue: 1_250_000,
      existingLiens: 230_000,
      initialCashDraw: 50_000,
    });
    expect(over.overDraw).toBe(0); // fits the principal limit...
    expect(over.firstYearDrawExcess).toBeGreaterThan(0); // ...but breaks the first-year rule
    near(over.firstYearDrawExcess, 50_000 - over.availableInitialDraw, 0.01);

    // Drawing within the first-year limit reports nothing.
    const within = runSimulation({
      ...defaultInputs,
      homeValue: 1_250_000,
      existingLiens: 230_000,
      initialCashDraw: Math.floor(over.availableInitialDraw),
    });
    expect(within.firstYearDrawExcess).toBe(0);
  });

  it('clamps a 100% tax rate so investment figures stay finite', () => {
    const taxed = runSimulation({ ...defaultInputs, taxRateOnSoldAssets: 1 });
    expect(Number.isFinite(taxed.projection[1].investment)).toBe(true);
  });

  it('a higher sold-assets tax rate shrinks the invested proceeds, never inflates them', () => {
    // The tax must reduce the after-tax invested value (a fair haircut), not gross
    // it up — otherwise a higher tax rate would perversely make investing the
    // proceeds look better.
    const untaxed = runSimulation({ ...defaultInputs, taxRateOnSoldAssets: 0 });
    const taxed = runSimulation({ ...defaultInputs, taxRateOnSoldAssets: 0.25 });
    expect(taxed.projection[0].investment).toBeLessThan(untaxed.projection[0].investment);
    expect(taxed.projection[10].investment).toBeLessThan(untaxed.projection[10].investment);
    // Exactly a 25% haircut on the invested position (equity, common to both
    // comparison lines, is left untaxed and cancels out).
    near(taxed.projection[0].investment, untaxed.projection[0].investment * 0.75, 1);
  });

  it('year-0 investment is the cash drawn, not a lien payoff', () => {
    // A lien is paid off with proceeds, not handed to the borrower as cash — so
    // paying off a $230k lien with a $0 cash draw must show ~$0 investable, never
    // the $230k that discharged the debt.
    const lienPaidNoCash = runSimulation({
      ...defaultInputs,
      homeValue: 1_250_000,
      existingLiens: 230_000,
      initialCashDraw: 0,
    });
    expect(lienPaidNoCash.projection[0].investment).toBeLessThan(1);

    // With no lien, the invested balance is the cash draw net of out-of-pocket costs.
    const cashOut = runSimulation({ ...defaultInputs, existingLiens: 0, initialCashDraw: 50_000 });
    near(cashOut.projection[0].investment, 50_000 - cashOut.pocCosts, 1);
  });

  it('annual MIP tracks the actual balance and the MIP rate, not a fixed table', () => {
    // MIP is 0.5% of the outstanding balance, so a bigger loan owes more MIP and
    // a higher rate owes proportionally more. (It was previously read from a
    // hard-coded dollar table frozen at one scenario, identical for every input.)
    const small = runSimulation(defaultInputs);
    const big = runSimulation({ ...defaultInputs, homeValue: 2_000_000, hecmLimit: 2_000_000 });
    expect(big.projection[1].annualMIP).toBeGreaterThan(small.projection[1].annualMIP);

    // Year 1 MIP ~= rate x the balance averaged over the year's monthly accrual.
    const y0 = small.projection[0];
    const y1 = small.projection[1];
    const approx = defaultInputs.annualMIP * ((y0.upb + y1.upb) / 2);
    expect(y1.annualMIP).toBeGreaterThan(approx * 0.97);
    expect(y1.annualMIP).toBeLessThan(approx * 1.03);

    // Quadrupling the MIP rate roughly quadruples the MIP charged in year 1.
    const hi = runSimulation({ ...defaultInputs, annualMIP: 0.02 });
    const ratio = hi.projection[1].annualMIP / small.projection[1].annualMIP;
    expect(ratio).toBeGreaterThan(3.9);
    expect(ratio).toBeLessThan(4.2);
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

describe('Per-year appreciation series', () => {
  it('null appreciations behaves exactly like the flat rate', () => {
    const flat = runSimulation({ ...goldenInputs, appreciation: 0.03, appreciations: null });
    const filled = runSimulation({
      ...goldenInputs,
      appreciation: 0.03,
      appreciations: Array(38).fill(0.03),
    });
    for (let n = 1; n <= 20; n++) near(filled.projection[n].homeValue, flat.projection[n].homeValue, 0.01);
  });

  it('uses the per-year rate for each year’s home-price growth', () => {
    // 10% in year 1, then 0% forever: home jumps once and holds.
    const series = Array(38).fill(0);
    series[0] = 0.1;
    const r = runSimulation({ ...goldenInputs, homeValue: 500_000, appreciation: 0.03, appreciations: series });
    near(r.projection[1].homeValue, 550_000, 0.01); // 500k × 1.10
    near(r.projection[2].homeValue, 550_000, 0.01); // × 1.00
    near(r.projection[5].homeValue, 550_000, 0.01);
    // The row carries the rate actually used, for the Year table to display.
    near(r.projection[1].appreciation!, 0.1, 1e-9);
    near(r.projection[2].appreciation!, 0, 1e-9);
  });

  it('a falling glide compounds each year’s distinct rate', () => {
    const series = [0.04, 0.03, 0.02]; // years 1–3, rest 0
    const full = Array.from({ length: 38 }, (_, i) => series[i] ?? 0);
    const r = runSimulation({ ...goldenInputs, homeValue: 100_000, appreciations: full });
    near(r.projection[3].homeValue, 100_000 * 1.04 * 1.03 * 1.02, 0.5);
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
    // Shocks build off the expected-rate growth basis (7.25%).
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
    // Growth keys off the 10yr (expected) index, so drive it low via cmt10yr.
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

describe('Industry-tool benchmark (Quantum origination software + REVERSE+)', () => {
  // Three-tool comparison (Aug 2026): 70yo, home at/above the HECM limit, $100k
  // initial draw, margin 2.25%, 1yr CMT 4.00%, 10yr CMT 4.72%, costs financed
  // (MIP + $6k orig + $3,400 other). Quantum and REVERSE+ agree with each other
  // within ~1–2% at every checkpoint; the engine must land in that band. It
  // does so only when the LOC/balance compound at the EXPECTED rate + MIP —
  // growing at the initial rate understated both by ~17% at age 95.
  const scen = {
    ...defaultInputs,
    age: 70,
    homeValue: 1_300_000,
    initialCashDraw: 100_000,
    existingLiens: 0,
    cmt1yr: 0.04,
    cmt10yr: 0.0472,
    margin: 0.0225,
    costsInLoan: true,
    costs: { ...defaultCosts, counselingCost: 0, appraisalPOC: 0, other: 3400 },
    projectionYears: 30,
    rateScenario: 'Flat (assumed)' as const,
  };
  const res = runSimulation(scen);
  const at = (age: number) => res.projection.find((p) => p.age === age)!;
  // Tolerance: the two tools themselves differ by up to ~1%, and the year-0
  // principal limit differs from theirs by ~1.5% (PLF/cost inputs), so allow
  // 2.5% on the growth checkpoints.
  const within = (actual: number, ref: number, pctTol: number) =>
    expect(Math.abs(actual - ref) / ref).toBeLessThanOrEqual(pctTol);

  it('rates: expected 7.00%, initial 6.25%, growth at expected + MIP = 7.50%', () => {
    expect(res.expectedRate).toBeCloseTo(0.07, 10);
    expect(res.initialRate).toBeCloseTo(0.0625, 10);
    expect(res.projection[1].accrualRate).toBeCloseTo(0.075, 10);
  });

  it('LOC tracks Quantum ($1,003,464 @85, $2,093,214 @95) and REVERSE+ ($1,010,290, $2,114,798)', () => {
    within(at(75).availableLOC, 481_050, 0.025);
    within(at(85).availableLOC, 1_003_464, 0.025);
    within(at(95).availableLOC, 2_093_214, 0.025);
  });

  it('balance tracks REVERSE+ ($195,077 @75, $408,346 @85, $854,774 @95)', () => {
    within(at(75).upb, 195_077, 0.025);
    within(at(85).upb, 408_346, 0.025);
    within(at(95).upb, 854_774, 0.025);
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
    // Growth at the expected rate + MIP (7.25%).
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
