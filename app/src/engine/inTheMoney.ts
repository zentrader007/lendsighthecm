// "In the money" — when does a borrower who does NOT yet qualify become able to
// close a HECM?
//
// A borrower qualifies only when the principal limit covers everything the loan
// must pay off: the existing lien plus any financed closing costs. When it does
// not, the loan cannot close at all — so the ordinary projection (which caps the
// balance at the principal limit and grows a $0 credit line) is a fiction for
// them. The honest question is instead: how short are they, and what closes the
// gap — cash now, or time?
//
// The gap closes from three directions at once:
//   1. AGE      — the PLF rises every year the borrower gets older,
//   2. HOME     — appreciation lifts the max claim amount (per-year appreciation
//                 aware, since it reads the projection's own home values),
//   3. THE LIEN — the existing mortgage amortizes down as they keep paying it.
// A cash DEPOSIT shifts the whole curve up immediately, which is what makes
// "deposit now vs. simply wait" a comparison the client can see.
//
// Everything is reused from the existing engine: the projection's futurePL
// series (the principal limit a NEW loan would offer at each future age),
// deriveCosts for closing costs at that year's home value, and residualMortgage
// for the amortizing lien.
import { runSimulation } from './index';
import { deriveCosts } from './costs';
import { monthlyMortgagePayment, residualMortgage } from './comparison';
import type { SimulationInputs, SimulationResult } from './types';

export interface ItmRow {
  year: number;
  age: number;
  homeValue: number; // appreciated home value that year
  principalLimit: number; // what a loan originated that year would offer
  lienBalance: number; // the existing mortgage, amortized
  financedCosts: number; // closing costs financed at that year's home value
  /** Signed headroom: principal limit less lien and financed costs, plus any
   *  deposit. Negative = short by that much; >= 0 = qualifies ("in the money"). */
  available: number;
  /** available when negative, else null — the red "short by" series. */
  shortfall: number | null;
}

export interface ItmResult {
  rows: ItmRow[];
  /** Signed headroom today (year 0), including any deposit entered. */
  availableToday: number;
  /** How far short today, 0 if already qualified. */
  shortfallToday: number;
  /** True when the borrower cannot close today — the only case worth charting. */
  isShortToday: boolean;
  /** Additional cash needed at closing to qualify right now. */
  depositToQualifyNow: number;
  /** Cash the borrower is already bringing (0 unless cashMode is 'Deposit'). */
  cashDeposit: number;
  /** First year/age the borrower qualifies without adding cash; null if never
   *  within the projection. 0 when they already qualify today. */
  itmYear: number | null;
  itmAge: number | null;
  hecm: SimulationResult;
}

export function runInTheMoney(inp: SimulationInputs): ItmResult {
  const hecm = runSimulation(inp);
  const N = hecm.projection.length - 1;

  const lien = Math.max(0, inp.existingLiens);
  const lienRate = Math.max(0, inp.existingLienRate);
  const lienTerm = Math.min(Math.max(Math.floor(inp.existingLienTermRemaining) || 0, 0), 40);
  const monthlyPI =
    lien <= 0
      ? 0
      : inp.existingLienPayment > 0
        ? inp.existingLienPayment
        : monthlyMortgagePayment(lien, lienRate, lienTerm);

  const deposit = hecm.cashDeposit;

  // The lien balance at a future closing. Year 0 is today's actual mandatory
  // obligation (so it matches the engine exactly), and with no remaining term
  // entered we hold the balance FLAT rather than letting residualMortgage's
  // term<=0 guard zero it out — assuming an unknown payoff schedule erases the
  // debt would falsely show the borrower qualifying.
  const lienAt = (t: number) =>
    lien <= 0
      ? 0
      : lienTerm <= 0
        ? lien
        : t === 0
          ? lien
          : residualMortgage(lien, lienRate, lienTerm, t, monthlyPI);

  const rows: ItmRow[] = [];
  for (let t = 0; t <= N; t++) {
    const row = hecm.projection[t];
    // Year 0 uses the actual principal limit (so it matches the headline, and
    // respects a lender-quote override); later years use the projection's
    // future-PLF series for a loan originated at that age and home value.
    const principalLimit = t === 0 ? hecm.principalLimit : row.futurePL;
    // Closing costs scale with the home value at that future origination.
    const financedCosts = deriveCosts(
      row.homeValue,
      inp.hecmLimit,
      inp.costs,
      inp.costsInLoan,
      inp.financeMipOnly,
    ).financedCosts;
    const lienBalance = lienAt(t);
    const available = principalLimit - lienBalance - financedCosts + deposit;
    rows.push({
      year: t,
      age: row.age,
      homeValue: row.homeValue,
      principalLimit,
      lienBalance,
      financedCosts,
      available,
      shortfall: available < 0 ? available : null,
    });
  }

  const availableToday = rows[0]?.available ?? 0;
  const shortfallToday = Math.max(0, -availableToday);
  const crossing = rows.find((r) => r.available >= 0) ?? null;

  return {
    rows,
    availableToday,
    shortfallToday,
    isShortToday: availableToday < 0,
    depositToQualifyNow: shortfallToday,
    cashDeposit: deposit,
    itmYear: crossing ? crossing.year : null,
    itmAge: crossing ? crossing.age : null,
    hecm,
  };
}
