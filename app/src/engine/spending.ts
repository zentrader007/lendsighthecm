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
//
// LOC / tenure draws are deliberately excluded — those are additional borrowing,
// not money the HECM has already freed. Both figures are reused straight from the
// existing engine (runSimulation + runMortgageComparison); nothing is recomputed.
import { runSimulation } from './index';
import { runMortgageComparison } from './comparison';
import type { SimulationInputs } from './types';

export interface SpendingRow {
  year: number;
  age: number;
  lumpSum: number; // year 1 only, 0 after
  freedCashFlow: number; // annual freed P&I, 0 after the mortgage's payoff year
  total: number; // lumpSum + freedCashFlow for the year
  cumulative: number; // running total of `total`
  loanBalance: number; // the HECM balance (upb) — the cost side of the lump sum
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
  firstYearTotal: number; // lumpSum + one year of freed cash flow
  totalAvailable: number; // lumpSum + annualFreed × freedYears
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

  const monthlyFreed = cmp.monthlyMortgagePayment;
  const annualFreed = cmp.annualMortgagePayment;
  const freedYears = cmp.freedPaymentYears; // already 0 when no payment is freed

  const rows: SpendingRow[] = [];
  let cumulative = 0;
  for (let t = 1; t <= N; t++) {
    const row = hecm.projection[t];
    const lump = t === 1 ? lumpSum : 0;
    // Freed cash flow runs only while the old mortgage would still have been
    // paid — after that, the no-HECM borrower would owe nothing either.
    const freed = t <= freedYears ? annualFreed : 0;
    const total = lump + freed;
    cumulative += total;
    rows.push({
      year: t,
      age: row.age,
      lumpSum: lump,
      freedCashFlow: freed,
      total,
      cumulative,
      loanBalance: row.upb,
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
    firstYearTotal: lumpSum + annualFreed,
    totalAvailable: lumpSum + annualFreed * freedYears,
  };
}
