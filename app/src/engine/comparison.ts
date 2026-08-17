// Lien-aware, two-world net-worth comparison: HECM (which pays off an existing
// mortgage at closing) vs. keeping that mortgage. Both worlds carry the same
// home and fund the same living spending; the deliberate difference is the
// mortgage P&I the no-HECM client keeps paying. Tracking each world's home
// equity AND liquid portfolio over time makes the comparison apples-to-apples:
//   - the avoided P&I shows up as the HECM portfolio pulling ahead,
//   - the accrued lien payoff shows up as HECM equity below the amortizing
//     no-HECM mortgage,
//   - out-of-pocket closing costs lower the HECM's starting portfolio,
//   - the HECM's non-recourse floor caps its equity loss.
import { runSimulation } from './index';
import { FV, PMT } from './finance';
import type { SimulationInputs, SimulationResult } from './types';

export interface ComparisonRow {
  year: number;
  age: number;
  homeValue: number;
  // No-HECM world (keep the mortgage)
  residualMortgage: number;
  homeEquityNoHecm: number;
  portfolioNoHecm: number;
  netWorthNoHecm: number;
  // HECM world (mortgage paid off at closing, standby line)
  hecmBalance: number;
  homeEquityHecm: number;
  portfolioHecm: number; // includes the invested freed-payment bucket in build-savings mode
  freedInvested: number; // the freed P&I invested as new savings (0 unless build-savings mode)
  availableLOC: number;
  netWorthHecm: number;
}

export interface ComparisonResult {
  rows: ComparisonRow[];
  monthlyMortgagePayment: number; // effective monthly P&I (override or auto)
  annualMortgagePayment: number;
  // Cash-flow benefit: the mortgage payment the HECM eliminates, over the lien's
  // remaining life (the no-HECM world would have paid it off after that anyway).
  freedPaymentYears: number;
  cumulativeFreedPayment: number;
  // Build-savings mode only: what the invested freed payment compounds to by the
  // end of the projection (0 otherwise). The nominal cash sum above, grown at the
  // investment return.
  freedInvestedValue: number;
  noHecmDepletionYear: number | null;
  noHecmDepletionAge: number | null;
  hecmDepletionYear: number | null;
  hecmDepletionAge: number | null;
  // The first year the HECM net worth catches up to and overtakes the no-HECM
  // line — the "you come out ahead by age X" break-even. null when the HECM
  // starts at or above the no-HECM line (no catch-up to show) or never crosses
  // within the horizon.
  breakEvenYear: number | null;
  breakEvenAge: number | null;
  hecm: SimulationResult;
}

/** Monthly P&I on the existing mortgage being paid off (positive amount). */
export function monthlyMortgagePayment(balance: number, annualRate: number, termYears: number): number {
  if (balance <= 0 || termYears <= 0) return 0;
  if (annualRate === 0) return balance / (termYears * 12);
  return -PMT(annualRate / 12, termYears * 12, balance, 0, 0);
}

/** Remaining mortgage balance after `t` years, amortized; 0 once paid off. An
 *  explicit `payment` (monthly) overrides the auto-amortized figure. */
export function residualMortgage(
  balance: number,
  annualRate: number,
  termYears: number,
  t: number,
  payment?: number,
): number {
  if (balance <= 0 || termYears <= 0 || t >= termYears) return 0;
  const m = payment && payment > 0 ? payment : monthlyMortgagePayment(balance, annualRate, termYears);
  if (annualRate === 0) return Math.max(0, balance - m * 12 * t);
  // FV of the balance owed (pv negative) net of the payments made (pmt positive).
  return Math.max(0, FV(annualRate / 12, t * 12, m, -balance, 0));
}

export function runMortgageComparison(inp: SimulationInputs): ComparisonResult {
  const hecm = runSimulation(inp);
  const N = hecm.projection.length - 1; // years 0..N

  const lien = Math.max(0, inp.existingLiens);
  const lienRate = Math.max(0, inp.existingLienRate);
  const lienTerm = Math.min(Math.max(Math.floor(inp.existingLienTermRemaining) || 0, 0), 40);
  // Monthly P&I: the client's actual payment if entered, else auto-amortized.
  // With no lien there is no mortgage, so no payment is freed — a stale payment
  // override must not survive the lien being cleared.
  const monthlyPI =
    lien <= 0
      ? 0
      : inp.existingLienPayment > 0
        ? inp.existingLienPayment
        : monthlyMortgagePayment(lien, lienRate, lienTerm);
  const annualPI = 12 * monthlyPI;
  const spend = Math.max(0, inp.annualSpending);
  const r = inp.investmentReturn;
  // OOP closing costs reduce the HECM-world portfolio at t=0; when costs are
  // financed they sit in the HECM balance instead (already in hecm.upb).
  const oop = hecm.pocCosts;

  // Credit the cash the borrower nets at closing to the HECM portfolio — it's an
  // asset in hand. The loan balance already reflects that draw (lowering equity),
  // so this nets out at closing (equity −draw, portfolio +draw) rather than
  // double-counting; without it a cash draw would read as a pure loss. Uses the
  // same engine figure the Invest tab does, so the two can't diverge. A lien
  // payoff is NOT included — it discharges a debt, it isn't cash in hand.
  const hecmProceeds = hecm.netCashDrawn;

  // Build-savings mode: treat the mortgage as funded from income, so the freed
  // P&I becomes new savings the HECM client invests — a dedicated bucket that
  // compounds and lifts net worth even from a $0 portfolio. For an apples-to-
  // apples comparison, the no-HECM world then also funds its P&I from income
  // (its portfolio isn't drained by the payment). Only meaningful when the freed
  // cash is invested rather than consumed.
  const buildSavings = inp.freedPaymentInvested && !inp.freedCashConsumed;

  // The mortgage is actually retired the first year its amortizing balance hits
  // zero — lienTerm with the scheduled payment, but sooner if the client's
  // (overridden) payment is larger. Tie the freed payment to this real payoff so
  // an override can't keep charging P&I after the loan is already gone.
  const maxPayYear = Math.min(lienTerm, N);
  let payoffYear = maxPayYear;
  for (let t = 1; t <= maxPayYear; t++) {
    if (residualMortgage(lien, lienRate, lienTerm, t, monthlyPI) <= 0) {
      payoffYear = t;
      break;
    }
  }

  let pNoHecm = inp.portfolioValue;
  let pHecm = inp.portfolioValue - oop + hecmProceeds;
  let freedInvested = 0;
  let noHecmDepletionYear: number | null = null;
  let hecmDepletionYear: number | null = null;

  const rows: ComparisonRow[] = [];
  for (let t = 0; t <= N; t++) {
    const row = hecm.projection[t];
    const resid = residualMortgage(lien, lienRate, lienTerm, t, monthlyPI);

    if (t > 0) {
      const piThisYear = t <= payoffYear ? annualPI : 0;

      // Scheduled credit-line draws are cash in hand (an asset), and repayments
      // are cash out — mirror both in the HECM portfolio so a draw doesn't
      // simply raise the balance (lowering equity) and vanish. Same treatment as
      // the closing cash draw above; the balance side is already in row.upb.
      const cashFromLoan = (row.draw ?? 0) - (row.payment ?? 0);
      pHecm = Math.max(0, pHecm + cashFromLoan);
      // No-HECM: living spending + mortgage P&I (until the loan is paid off) —
      // unless build-savings mode funds that P&I from income, leaving the
      // portfolio untouched by it.
      const drawNoHecm = spend + (buildSavings ? 0 : piThisYear);
      if (pNoHecm > 0 && pNoHecm < drawNoHecm && noHecmDepletionYear === null)
        noHecmDepletionYear = t;
      pNoHecm = Math.max(0, pNoHecm - drawNoHecm) * (1 + r);

      // HECM: living spending only — unless the freed P&I is consumed, in which
      // case the client also spends the equivalent of the avoided payment.
      const drawHecm = spend + (inp.freedCashConsumed ? piThisYear : 0);
      if (pHecm > 0 && pHecm < drawHecm && hecmDepletionYear === null) hecmDepletionYear = t;
      pHecm = Math.max(0, pHecm - drawHecm) * (1 + r);

      // The freed payment invested as new savings — its own compounding bucket,
      // fed while the lien runs, then left to grow. Independent of the spending
      // drawdown, so it builds up from any starting portfolio (including $0).
      if (buildSavings) freedInvested = (freedInvested + piThisYear) * (1 + r);
    }

    const homeEquityNoHecm = Math.max(0, row.homeValue - resid);
    const portfolioHecm = pHecm + freedInvested;
    rows.push({
      year: t,
      age: row.age,
      homeValue: row.homeValue,
      residualMortgage: resid,
      homeEquityNoHecm,
      portfolioNoHecm: pNoHecm,
      netWorthNoHecm: homeEquityNoHecm + pNoHecm,
      hecmBalance: row.upb,
      homeEquityHecm: row.equity,
      portfolioHecm,
      freedInvested,
      availableLOC: row.availableLOC,
      netWorthHecm: row.equity + portfolioHecm,
    });
  }

  const age0 = inp.age;

  // Break-even: only a story worth marking when the HECM starts BEHIND (its
  // upfront cost / higher opening balance) and later overtakes. If it opens at
  // or above the no-HECM line there's no catch-up to point to.
  let breakEvenYear: number | null = null;
  if (rows.length > 1 && rows[0].netWorthHecm < rows[0].netWorthNoHecm) {
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].netWorthHecm >= rows[i].netWorthNoHecm) {
        breakEvenYear = rows[i].year;
        break;
      }
    }
  }
  const breakEvenAge = breakEvenYear === null ? null : age0 + breakEvenYear;

  // No payment freed → no freed-payment years (the payoff loop would otherwise
  // report 1, since a zero balance reads as "paid off" in year 1).
  const freedPaymentYears = annualPI > 0 ? payoffYear : 0;
  return {
    rows,
    monthlyMortgagePayment: monthlyPI,
    annualMortgagePayment: annualPI,
    freedPaymentYears,
    cumulativeFreedPayment: annualPI * freedPaymentYears,
    freedInvestedValue: freedInvested,
    noHecmDepletionYear,
    noHecmDepletionAge: noHecmDepletionYear === null ? null : age0 + noHecmDepletionYear,
    hecmDepletionYear,
    hecmDepletionAge: hecmDepletionYear === null ? null : age0 + hecmDepletionYear,
    breakEvenYear,
    breakEvenAge,
    hecm,
  };
}
