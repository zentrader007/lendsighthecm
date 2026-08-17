import { FV, PMT, MROUND } from './finance';
import { lookupPLF, lookupPLFByRate } from './plf';
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
  // Infinity/NaN. taxRate scales invested proceeds by (1 - tax); projectionYears
  // indexes the historical series (which cover 38 years).
  const taxRate = Math.min(Math.max(inp.taxRateOnSoldAssets, 0), 0.95);
  const N = Math.min(Math.max(Math.floor(inp.projectionYears) || 0, 1), 38);

  // --- Rates ---
  const expectedRate = MROUND(inp.cmt10yr + margin, 0.00125);
  const initialRate = MROUND(inp.cmt1yr + margin, 0.00125);
  // The projection compounds the principal limit / LOC / balance at the
  // EXPECTED rate + MIP. The expected rate is HUD's estimate of the note rate
  // averaged over the loan's life (it's what sets the PLF, and what HUD's
  // required amortization schedule for adjustable HECMs projects at); the
  // initial rate is only what accrues in the first year. This matches the
  // industry illustration/origination tools (Quantum, REVERSE+) to within ~1%
  // at every checkpoint. Growing at the initial rate — tried Jun-2026 — read as
  // "more conservative" but understated the LOC/balance by ~17% over 25 years
  // versus both tools. Tenure/term payments amortize at the same rate.
  const loanProjectedRate = expectedRate + annMip; // payment-plan amortization rate
  const growthRate = loanProjectedRate; // monthly LOC / balance growth rate
  const plf = lookupPLF(age, inp.cmt10yr, margin);

  // --- Costs ---
  const c = deriveCosts(homeValue, hecmLimit, inp.costs, costsInLoan, inp.financeMipOnly);
  const { effectiveHomeValue, initialMIP, totalLoanCost, totalCostAllIn, calculatedOriginationFee, financedCosts, pocCosts } = c;

  // --- Principal limit & draws ---
  // A lender quote can override the table-derived limit so every downstream
  // figure (LOC, draws, tenure) matches the quote to the dollar.
  const principalLimit =
    inp.principalLimitOverride > 0 ? inp.principalLimitOverride : effectiveHomeValue * plf;
  const feesInLoan = financedCosts;
  const sixtyPctPL = 0.6 * principalLimit - feesInLoan;
  const tenPctPL = 0.1 * principalLimit;
  const plMinusMOMinusFees = principalLimit - mandatoryObligations - feesInLoan;

  const baseUPB = financedCosts + mandatoryObligations + initialCashDraw;
  const initialUPB = Math.min(baseUPB, principalLimit);
  // Cash the borrower actually nets at closing: the loan balance less financed
  // costs and the lien payoff. Capping-aware (an over-draw shrinks it), never
  // negative. This — not the full net proceeds — is the investable amount, and
  // the single source both the Invest and Net-worth comparisons draw from.
  const netCashDrawn = Math.max(0, initialUPB - financedCosts - mandatoryObligations);
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

  const h4pDownPaymentMin = homeValue - principalLimit + financedCosts;

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
    // Invest only the cash the borrower nets at closing (netCashDrawn), less any
    // out-of-pocket costs — never a lien payoff, which discharges a debt rather
    // than handing over investable cash. Then apply the sold-assets tax so the
    // after-tax invested value is compared like-for-like against home equity: a
    // higher tax rate SHRINKS the invested position (it must never inflate it).
    investment: Math.max(0, netCashDrawn - pocCosts) * (1 - taxRate),
    investmentPlusEquity: 0,
    pocDrag: pocCosts,
    rmNetWorth: 0,
    accessibleResources: 0,
  };
  row0.investmentPlusEquity = row0.equity + row0.investment;
  row0.rmNetWorth = row0.equity - row0.pocDrag;
  row0.accessibleResources = row0.equity + row0.availableLOC;
  projection.push(row0);

  // Scheduled draws are user-editable, so they get the same protection the
  // initial draw has: you can never borrow more than the credit line holds.
  let drawsBeyondCredit = 0;
  let firstCappedDrawYear: number | null = null;

  for (let n = 1; n <= N; n++) {
    const prev = projection[n - 1];
    const curAge = age + n;
    const payment = inp.payments[n - 1] ?? 0;
    // Draws are beginning-of-year, so the ceiling is last year's closing credit
    // line plus any payment made this year (a payment restores credit first).
    // Without this cap a typed draw could push the balance past the principal
    // limit and drive the credit line negative — an impossible loan.
    const requestedDraw = inp.draws[n - 1] ?? 0;
    const draw = Math.min(requestedDraw, Math.max(0, prev.availableLOC + payment));
    if (requestedDraw > draw) {
      drawsBeyondCredit += requestedDraw - draw;
      if (firstCappedDrawYear === null) firstCappedDrawYear = n;
    }

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
    // Floored at 0: the draw cap above already prevents a real overdraw, but a
    // fully-drawn line leaves floating-point residue that would render as "-$0".
    const availableLOC = Math.max(0, FV(accrualRate / 12, 12, 0, -(prev.availableLOC - draw + payment)));

    // MIP accrued this year, computed from the actual balance: the loan grows
    // monthly at accrualRate (which already includes the MIP rate), and MIP is
    // the annMip/12 slice charged on each month's opening balance. Derived
    // rather than looked up, so it tracks home value, draws, payments, and the
    // Annual MIP input. (It previously came from a fixed dollar table frozen at
    // one scenario, which left the MIP/interest split wrong for every other.)
    let mipBalance = Math.max(0, prev.upb + draw - payment);
    let annualMip = 0;
    for (let m = 0; m < 12; m++) {
      annualMip += mipBalance * (annMip / 12);
      mipBalance *= 1 + accrualRate / 12;
    }
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
    // Later-year cash draws are invested after tax too (same haircut as year 0);
    // payments are after-tax dollars withdrawn to service the loan.
    const investment = -FV(
      invReturn / 12,
      12,
      (draw * (1 - taxRate)) / 12 - payment / 12,
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

  // HUD caps disbursements in the first 12 months (the 60% rule), which
  // availableInitialDraw computes. The cash at closing AND a scheduled year-1
  // draw (taken at the start of year 1, i.e. inside that window) both count
  // toward it — report any excess so an illustration can't quietly show a
  // first-year disbursement HUD would not permit. Uses the actual (capped)
  // year-1 draw, not the requested figure.
  const firstYearDrawExcess = Math.max(
    0,
    initialCashDraw + (projection[1]?.draw ?? 0) - availableInitialDraw,
  );

  return {
    plf,
    principalLimit,
    effectiveHomeValue,
    expectedRate,
    initialRate,
    loanProjectedRate,
    initialMIP,
    totalLoanCost,
    totalCostAllIn,
    calculatedOriginationFee,
    availableInitialDraw,
    netCashDrawn,
    initialUPB,
    remainingCredit,
    overDraw,
    firstYearDrawExcess,
    drawsBeyondCredit,
    firstCappedDrawYear,
    maxTenurePayment,
    h4pDownPaymentMin,
    pocCosts,
    projection,
  };
}
