// "Your options side by side": the same home, the same age, the same rates —
// five ways to use (or not use) the reverse mortgage, compared on the numbers
// a client actually decides on. Every cell is read straight from the engine by
// re-running the simulation with the option's inputs; nothing is hand-computed,
// so the table can never disagree with the charts.
import { runSimulation } from '../engine';
import type { SimulationInputs, SimulationResult } from '../engine';
import { runMortgageComparison } from '../engine/comparison';
import { runAvailableSpending } from '../engine/spending';

export type OptionKey = 'plan' | 'maxCash' | 'loc' | 'tenure' | 'none';

export interface OptionColumn {
  key: OptionKey;
  label: string;
  sublabel: string;
  cashAtClosing: number | null; // cash the borrower nets at closing
  monthlyIncome: number | null; // tenure payment (monthly-for-life option only)
  creditLineToday: number | null;
  creditLineAtRef: number | null;
  loanBalanceAtRef: number | null; // HECM balance, or the residual mortgage in the do-nothing world
  homeEquityAtRef: number;
  netWorthAtRef: number;
  paymentEliminated: number | null; // monthly mortgage payment removed (with a lien); null = keeps paying
}

export interface OptionsResult {
  refAge: number;
  hasLien: boolean;
  /** The mortgage payment the do-nothing world keeps paying (0 without a lien). */
  monthlyMortgagePayment: number;
  columns: OptionColumn[];
}

const zeros = () => Array(38).fill(0) as number[];

/** Index of the projection row at/after `age` (falls back to the last row). */
export function refIndexFor(result: SimulationResult, age: number): number {
  const i = result.projection.findIndex((r) => r.age >= age);
  return i >= 0 ? i : result.projection.length - 1;
}

function hecmColumn(
  key: OptionKey,
  label: string,
  sublabel: string,
  inp: SimulationInputs,
  refIdx: number,
  monthlyIncome: number | null,
  paymentEliminated: number | null,
): OptionColumn {
  const res = runSimulation(inp);
  const cmp = runMortgageComparison(inp);
  const i = Math.min(refIdx, res.projection.length - 1);
  const row = res.projection[i];
  return {
    key,
    label,
    sublabel,
    cashAtClosing: res.netCashDrawn,
    monthlyIncome,
    creditLineToday: res.remainingCredit,
    creditLineAtRef: row.availableLOC,
    loanBalanceAtRef: row.upb,
    homeEquityAtRef: row.equity,
    netWorthAtRef: cmp.rows[i].netWorthHecm,
    paymentEliminated,
  };
}

/**
 * Build the comparison. `refAge` anchors the "later" columns (default 85 —
 * the same realistic horizon the in-app honesty ledger uses).
 */
export function runOptions(inp: SimulationInputs, refAge = 85): OptionsResult {
  const base = runSimulation(inp);
  const cmp = runMortgageComparison(inp);
  const spending = runAvailableSpending(inp);
  const refIdx = refIndexFor(base, refAge);
  const hasLien = inp.existingLiens > 0;
  const freed = hasLien && cmp.freedPaymentYears > 0 ? cmp.monthlyMortgagePayment : null;

  const columns: OptionColumn[] = [];

  // This plan — exactly as configured in the simulator.
  columns.push(
    hecmColumn(
      'plan',
      'This plan',
      spending.totalCreditDraws > 0 ? 'As modeled, with planned draws' : 'As modeled',
      inp,
      refIdx,
      null,
      freed,
    ),
  );

  // The alternative structures only make sense for a borrower who qualifies
  // without bringing cash; a deposit ("not yet in the money") scenario has one
  // shape only. Qualification is judged with no draw — the plan's own draw can
  // over-draw the limit without meaning the borrower can't close.
  const locOnly = { ...inp, initialCashDraw: 0, draws: zeros(), payments: zeros() };
  const locRun = runSimulation(locOnly);
  if (inp.cashMode === 'Draw' && locRun.availableFunds >= 0) {
    // HUD's first-year maximum, judged on the untouched line.
    const maxCash = { ...locOnly, initialCashDraw: locRun.availableInitialDraw };
    columns.push(hecmColumn('maxCash', 'Most cash now', 'Largest lump sum HUD allows in year one', maxCash, refIdx, null, freed));
    columns.push(hecmColumn('loc', 'Growing credit line', 'Take nothing now; let the line grow', locOnly, refIdx, null, freed));

    // Monthly for life: the tenure payment on the full line, modeled as a level
    // annual draw so the balance, credit line, and equity reflect actually
    // receiving it.
    const tenure = locRun.maxTenurePayment;
    if (tenure != null && tenure > 0) {
      const years = Math.min(Math.max(Math.floor(inp.projectionYears) || 0, 1), 38);
      const draws = zeros().map((_, i) => (i < years ? tenure * 12 : 0));
      columns.push(hecmColumn('tenure', 'Monthly for life', 'A guaranteed payment every month', { ...locOnly, draws }, refIdx, tenure, freed));
    }
  }

  // Do nothing: no reverse mortgage — keep the current mortgage (if any) and
  // fund spending from the portfolio. All from the comparison's no-HECM world.
  const none = cmp.rows[Math.min(refIdx, cmp.rows.length - 1)];
  columns.push({
    key: 'none',
    label: hasLien ? 'Keep current mortgage' : 'Do nothing',
    sublabel: hasLien ? 'No reverse mortgage; keep paying' : 'No reverse mortgage',
    cashAtClosing: null,
    monthlyIncome: null,
    creditLineToday: null,
    creditLineAtRef: null,
    loanBalanceAtRef: hasLien ? none.residualMortgage : null,
    homeEquityAtRef: none.homeEquityNoHecm,
    netWorthAtRef: none.netWorthNoHecm,
    paymentEliminated: null,
  });

  return {
    refAge: base.projection[refIdx].age,
    hasLien,
    monthlyMortgagePayment: hasLien ? cmp.monthlyMortgagePayment : 0,
    columns,
  };
}
