import { FV, PMT, MROUND } from './finance';
import { lookupPLF, lookupPLFByRate } from './plf';
import { lookupAnnualMIP } from './mip';
import { deriveCosts } from './costs';
import { hist1yrCMTForward, hist10yrCMT } from './historical';
import type { ProjectionRow, SimulationInputs, SimulationResult } from './types';

export * from './types';

/**
 * Run the full Variable-Rate HECM simulation, mirroring the V8.5.1 workbook:
 * Dashboard headline figures + the Advanced 38-year projection.
 */
export function runSimulation(inp: SimulationInputs): SimulationResult {
  const {
    age,
    homeValue,
    margin,
    annualMIP: annMip,
    hecmLimit,
    existingLiens: mandatoryObligations,
    initialCashDraw,
    costsInLoan,
    beginningYear,
  } = inp;

  // Defensive clamps so a malformed input or stale shared link can't produce
  // Infinity/NaN. taxRate feeds a 1/(1-tax) divisor; projectionYears indexes the
  // historical series (which cover 38 years).
  const taxRate = Math.min(Math.max(inp.taxRateOnSoldAssets, 0), 0.95);
  const N = Math.min(Math.max(Math.floor(inp.projectionYears) || 0, 1), 38);

  // --- Rates ---
  const expectedRate = MROUND(inp.cmt10yr + margin, 0.00125);
  const initialRate = MROUND(inp.cmt1yr + margin, 0.00125);
  // Two distinct HUD rates: tenure/term PAYMENTS amortize at the expected rate
  // + MIP (HUD uses the expected rate for payment plans), while the principal
  // limit / LOC / balance GROW each month at the note (current) rate + MIP —
  // HUD's monthly principal-limit growth rate (24 CFR 206.3). On a normal
  // upward-sloping yield curve the note rate is below the expected rate, so
  // growth is more conservative than the expected-rate projection.
  const loanProjectedRate = expectedRate + annMip; // payment-plan amortization rate
  const growthRate = initialRate + annMip; // monthly principal-limit growth rate
  const plf = lookupPLF(age, inp.cmt10yr, margin);

  // --- Costs ---
  const c = deriveCosts(homeValue, hecmLimit, inp.costs, costsInLoan);
  const { effectiveHomeValue, initialMIP, totalLoanCost, calculatedOriginationFee, pocCosts } = c;

  // --- Principal limit & draws ---
  // A lender quote can override the table-derived limit so every downstream
  // figure (LOC, draws, tenure) matches the quote to the dollar.
  const principalLimit =
    inp.principalLimitOverride > 0 ? inp.principalLimitOverride : effectiveHomeValue * plf;
  const feesInLoan = costsInLoan ? totalLoanCost : 0;
  const sixtyPctPL = 0.6 * principalLimit - feesInLoan;
  const tenPctPL = 0.1 * principalLimit;
  const plMinusMOMinusFees = principalLimit - mandatoryObligations - feesInLoan;

  const baseUPB = costsInLoan
    ? totalLoanCost + mandatoryObligations + initialCashDraw
    : mandatoryObligations + initialCashDraw;
  const initialUPB = Math.min(baseUPB, principalLimit);
  // availableFunds keeps the raw (possibly negative) figure so the draw/tenure
  // guards below behave exactly as the workbook does. remainingCredit is floored
  // for display, and overDraw reports how far an over-draw exceeded the limit.
  const availableFunds = principalLimit - baseUPB;
  const remainingCredit = Math.max(0, availableFunds);
  const overDraw = Math.max(0, baseUPB - principalLimit);

  const availableInitialDraw =
    availableFunds > 0
      ? mandatoryObligations + tenPctPL > sixtyPctPL
        ? Math.min(tenPctPL, plMinusMOMinusFees)
        : sixtyPctPL - mandatoryObligations
      : 0;

  const maxTenurePayment =
    availableFunds > 0
      ? -PMT(loanProjectedRate / 12, 1200 - age * 12, availableFunds, 0, 1)
      : null;

  const h4pDownPaymentMin = costsInLoan
    ? homeValue - principalLimit + totalLoanCost
    : homeValue - principalLimit;

  // --- Projection ---
  const projection: ProjectionRow[] = [];

  const futureCMTat = (y: number) =>
    inp.futureCMTMode === 'Assumed' ? MROUND(inp.futureCMT10yr, 0.00125) : hist10yrCMT(y);

  // Year 0 (Advanced row 6)
  // initialUPB is clamped to <= principalLimit above, so this is always >= 0.
  const loc0 = Math.max(0, principalLimit - initialUPB);
  const cmt10_0 = futureCMTat(0);
  const row0: ProjectionRow = {
    year: 0,
    calendarYear: beginningYear,
    age,
    draw: null,
    payment: null,
    homeValue,
    effectiveHomeValue,
    appreciation: null,
    upb: initialUPB,
    accrualRate: null,
    availableLOC: loc0,
    upbPrincipalBal: initialUPB - initialMIP,
    upbInterestBal: 0,
    possibleDeduction: 0,
    tenureAvailPerMonth:
      loc0 > 0 ? -PMT(loanProjectedRate / 12, 1200 - age * 12, loc0, 0, 1) : null,
    equity: initialUPB < homeValue ? homeValue - initialUPB : 0,
    totalPL: principalLimit,
    annualMIP: initialMIP,
    accumMIP: initialMIP,
    futurePLF: plf,
    futurePL: plf * effectiveHomeValue,
    cmt10yr: cmt10_0,
    investment: (initialUPB - totalLoanCost) / (1 - taxRate),
    investmentPlusEquity: 0,
    pocDrag: pocCosts,
    rmNetWorth: 0,
    accessibleResources: 0,
  };
  row0.investmentPlusEquity = row0.equity + row0.investment;
  row0.rmNetWorth = row0.equity - row0.pocDrag;
  row0.accessibleResources = row0.equity + row0.availableLOC;
  projection.push(row0);

  for (let n = 1; n <= N; n++) {
    const prev = projection[n - 1];
    const curAge = age + n;
    const draw = inp.draws[n - 1] ?? 0;
    const payment = inp.payments[n - 1] ?? 0;

    const appreciation = inp.appreciation;

    const homeVal = prev.homeValue * (1 + appreciation);
    const effHome = prev.effectiveHomeValue * (1 + appreciation);

    // Accrual under the selected rate scenario. Shocks are floored at
    // margin + MIP (the index cannot go below zero on a variable HECM).
    const accrualRate =
      inp.rateScenario === 'Rates +2%'
        ? growthRate + 0.02
        : inp.rateScenario === 'Rates -2%'
          ? Math.max(margin + annMip, growthRate - 0.02)
          : inp.rateScenario === 'Replay 1986-2024'
            ? hist1yrCMTForward(n) + margin + annMip
            : growthRate;

    const upb = FV(accrualRate / 12, 12, 0, -(prev.upb + draw - payment));
    const availableLOC = FV(accrualRate / 12, 12, 0, -(prev.availableLOC - draw + payment));

    const annualMip = lookupAnnualMIP(n);
    // MIP subtracted by payment, capped at prior accumulated MIP (negative).
    const S = -(payment <= prev.accumMIP ? payment : prev.accumMIP);
    // Principal subtracted once payment exceeds interest + accumulated MIP.
    const Q = prev.upbInterestBal + prev.accumMIP >= payment
      ? 0
      : prev.upbInterestBal + prev.accumMIP - payment;
    // Interest subtracted (negative).
    const R = -(payment < prev.accumMIP
      ? 0
      : payment > prev.accumMIP + prev.upbInterestBal
        ? prev.upbInterestBal
        : payment + S);

    const accumMIP = prev.accumMIP + S + annualMip;
    const principalAdd = draw;
    const upbPrincipalBal = prev.upbPrincipalBal + principalAdd + Q;
    const upbInterestBal = upb - upbPrincipalBal - accumMIP;
    const possibleDeduction = -R - S;

    const equity = upb < homeVal ? homeVal - upb : 0;
    // Total PL accrues at the same scenario rate as the balance and LOC, so
    // the chart lines stay internally consistent. Identical to the workbook's
    // loanProjectedRate in the flat scenario.
    const totalPL = -FV(accrualRate / 12, 12, 0, prev.totalPL);

    const cmt10 = futureCMTat(n);
    const futurePLF = curAge > 99 ? 0 : lookupPLFByRate(curAge, (cmt10 + margin) * 100);
    const futurePL = futurePLF * effHome;

    const invReturn = inp.investmentReturn;
    const investment = -FV(
      invReturn / 12,
      12,
      (draw / (1 - taxRate)) / 12 - payment / 12,
      prev.investment,
    );

    // Standby-LOC series: out-of-pocket costs compound at the investment
    // return (their opportunity cost); net worth nets them against equity.
    const pocDrag = -FV(invReturn / 12, 12, 0, prev.pocDrag);
    const rmNetWorth = equity - pocDrag;
    const accessibleResources = equity + availableLOC;

    // Above age 95 the workbook holds the tenure horizon at a 60-month floor;
    // the headline maxTenurePayment (computed at the current age) does not.
    const tenureMonths = curAge > 95 ? 60 : 1200 - curAge * 12;
    const tenureAvailPerMonth =
      availableLOC > 0 ? -PMT(loanProjectedRate / 12, tenureMonths, availableLOC, 0, 1) : null;

    projection.push({
      year: n,
      calendarYear: beginningYear + n,
      age: curAge,
      draw,
      payment,
      homeValue: homeVal,
      effectiveHomeValue: effHome,
      appreciation,
      upb,
      accrualRate,
      availableLOC,
      upbPrincipalBal,
      upbInterestBal,
      possibleDeduction,
      tenureAvailPerMonth,
      equity,
      totalPL,
      annualMIP: annualMip,
      accumMIP,
      futurePLF,
      futurePL,
      cmt10yr: cmt10,
      investment,
      investmentPlusEquity: equity + investment,
      pocDrag,
      rmNetWorth,
      accessibleResources,
    });
  }

  return {
    plf,
    principalLimit,
    effectiveHomeValue,
    expectedRate,
    initialRate,
    loanProjectedRate,
    initialMIP,
    totalLoanCost,
    calculatedOriginationFee,
    availableInitialDraw,
    initialUPB,
    remainingCredit,
    overDraw,
    maxTenurePayment,
    h4pDownPaymentMin,
    pocCosts,
    projection,
  };
}
