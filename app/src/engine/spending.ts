// "Available Spending" — the net-new money a HECM actually puts within reach,
// answering the question a client asks first: how much more can I spend?
//
// A HECM creates spending capacity in two distinct forms, and this module keeps
// them honestly separate:
//   - a LUMP SUM at closing: the proceeds left over after the lien payoff and
//     the financed closing costs, net of anything paid out of pocket. It's real
//     cash in hand, but it's borrowed — the loan balance accrues against it.
//   - FREED CASH FLOW: the monthly mortgage payment the HECM eliminates. This is
//     true recurring spending power, not borrowed, and it runs only until the old
//     mortgage would have been paid off anyway (freedPaymentYears).
//   - CREDIT-LINE DRAWS: the draws scheduled in the Year table. Borrowed, like the
//     lump sum — and guarded so they can't be overstated: only the engine's
//     ACTUAL (credit-capped) draws count, net of any repayment made the same
//     year (so borrow/repay/re-borrow isn't double-counted, and a client who
//     keeps voluntarily paying isn't shown both a "freed" payment and that same
//     cash as spending).
//
// Tenure is a hypothetical (the "monthly for life" card), not a scheduled draw,
// so it is not counted. Every figure is reused straight from the existing engine
// (runSimulation + runMortgageComparison); nothing is recomputed.
import { runSimulation } from './index';
import { runMortgageComparison } from './comparison';
import type { SimulationInputs } from './types';

export interface SpendingRow {
  year: number;
  age: number;
  lumpSum: number; // year 1 only, 0 after
  freedCashFlow: number; // annual freed P&I, 0 after the mortgage's payoff year
  creditDraws: number; // scheduled draws actually taken this year, net of repayments, floored at 0
  cumulativeDraws: number; // running total of creditDraws
  total: number; // lumpSum + freedCashFlow + creditDraws for the year
  cumulative: number; // running total of `total`
  loanBalance: number; // the HECM balance (upb) — the cost side of the lump sum
  homeValue: number; // appreciated home value this year — the non-recourse cap on what's owed
  // The cost side, for an honest benefit-vs-cost ledger: home equity remaining
  // with the HECM (home value − balance) vs. equity if the client did nothing
  // (home value − any residual on the current mortgage). The gap is the equity
  // the HECM has consumed by this age.
  equityWith: number;
  equityWithout: number;
}

export interface SpendingResult {
  rows: SpendingRow[];
  lumpSum: number; // spendable cash at closing: netCashDrawn − out-of-pocket costs, floored at 0
  grossCashAtClosing: number; // netCashDrawn, before out-of-pocket costs (for the breakdown)
  outOfPocket: number; // pocCosts written as a check at closing
  hudMaxLumpSum: number; // HUD's first-year disbursement limit (the 60% rule)
  lumpSumHeadroom: number; // additional cash HUD would allow at closing, floored at 0
  firstYearDrawExcess: number; // cash drawn beyond the HUD first-year limit, floored at 0
  monthlyFreed: number; // freed mortgage payment per month
  annualFreed: number; // freed mortgage payment per year
  freedYears: number; // years the freed payment runs (until the mortgage's payoff)
  totalCreditDraws: number; // sum of creditDraws over the projection
  drawsBeyondCredit: number; // requested draws the credit line couldn't cover (never shown as spending)
  firstYearTotal: number; // lumpSum + one year of freed cash flow + year-1 credit draws
  totalAvailable: number; // final cumulative: lumpSum + freed × years + credit draws
}

export function runAvailableSpending(inp: SimulationInputs): SpendingResult {
  const hecm = runSimulation(inp);
  const cmp = runMortgageComparison(inp);
  const N = hecm.projection.length - 1; // years 0..N

  // Spendable lump sum: the cash netted at closing, less any costs paid out of
  // pocket (a check the client writes isn't money they can spend). Mirrors how
  // the Invest series nets out-of-pocket costs.
  const grossCashAtClosing = hecm.netCashDrawn;
  const outOfPocket = hecm.pocCosts;
  const lumpSum = Math.max(0, grossCashAtClosing - outOfPocket);

  const hudMaxLumpSum = hecm.availableInitialDraw;
  const lumpSumHeadroom = Math.max(0, hudMaxLumpSum - grossCashAtClosing);

  const freedYears = cmp.freedPaymentYears; // already 0 when no payment is freed
  // When no year actually frees a payment (e.g. a lien entered with 0 remaining
  // term), the monthly/annual figures must read 0 too — otherwise firstYearTotal
  // and the stat strip would claim a year of cash flow the chart never shows.
  const monthlyFreed = freedYears > 0 ? cmp.monthlyMortgagePayment : 0;
  const annualFreed = freedYears > 0 ? cmp.annualMortgagePayment : 0;

  const rows: SpendingRow[] = [];
  let cumulative = 0;
  let totalCreditDraws = 0;
  for (let t = 1; t <= N; t++) {
    const row = hecm.projection[t];
    const lump = t === 1 ? lumpSum : 0;
    // Freed cash flow runs only while the old mortgage would still have been
    // paid — after that, the no-HECM borrower would owe nothing either.
    const freed = t <= freedYears ? annualFreed : 0;
    // Credit-line draws: the ACTUAL draw the engine allowed (capped at the
    // credit available), net of any repayment that year — a repayment is the
    // client's own money going back in, so it isn't new spending.
    const draws = Math.max(0, (row.draw ?? 0) - (row.payment ?? 0));
    totalCreditDraws += draws;
    const total = lump + freed + draws;
    cumulative += total;
    rows.push({
      year: t,
      age: row.age,
      lumpSum: lump,
      freedCashFlow: freed,
      creditDraws: draws,
      cumulativeDraws: totalCreditDraws,
      total,
      cumulative,
      loanBalance: row.upb,
      homeValue: row.homeValue,
      equityWith: row.equity,
      equityWithout: cmp.rows[t].homeEquityNoHecm,
    });
  }

  return {
    rows,
    lumpSum,
    grossCashAtClosing,
    outOfPocket,
    hudMaxLumpSum,
    lumpSumHeadroom,
    firstYearDrawExcess: hecm.firstYearDrawExcess,
    monthlyFreed,
    annualFreed,
    freedYears,
    totalCreditDraws,
    drawsBeyondCredit: hecm.drawsBeyondCredit,
    firstYearTotal: rows[0]?.total ?? lumpSum + annualFreed,
    totalAvailable: cumulative,
  };
}
