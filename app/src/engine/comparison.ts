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
  portfolioHecm: number;
  availableLOC: number;
  netWorthHecm: number;
}

export interface ComparisonResult {
  rows: ComparisonRow[];
  annualMortgagePayment: number;
  noHecmDepletionYear: number | null;
  noHecmDepletionAge: number | null;
  hecmDepletionYear: number | null;
  hecmDepletionAge: number | null;
  hecm: SimulationResult;
}

/** Monthly P&I on the existing mortgage being paid off (positive amount). */
export function monthlyMortgagePayment(balance: number, annualRate: number, termYears: number): number {
  if (balance <= 0 || termYears <= 0) return 0;
  if (annualRate === 0) return balance / (termYears * 12);
  return -PMT(annualRate / 12, termYears * 12, balance, 0, 0);
}

/** Remaining mortgage balance after `t` years, amortized; 0 once paid off. */
export function residualMortgage(
  balance: number,
  annualRate: number,
  termYears: number,
  t: number,
): number {
  if (balance <= 0 || termYears <= 0 || t >= termYears) return 0;
  const m = monthlyMortgagePayment(balance, annualRate, termYears);
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
  const annualPI = 12 * monthlyMortgagePayment(lien, lienRate, lienTerm);
  const spend = Math.max(0, inp.annualSpending);
  const r = inp.investmentReturn;
  // OOP closing costs reduce the HECM-world portfolio at t=0; when costs are
  // financed they sit in the HECM balance instead (already in hecm.upb).
  const oop = hecm.pocCosts;

  let pNoHecm = inp.portfolioValue;
  let pHecm = inp.portfolioValue - oop;
  let noHecmDepletionYear: number | null = null;
  let hecmDepletionYear: number | null = null;

  const rows: ComparisonRow[] = [];
  for (let t = 0; t <= N; t++) {
    const row = hecm.projection[t];
    const resid = residualMortgage(lien, lienRate, lienTerm, t);

    if (t > 0) {
      const piThisYear = t <= lienTerm ? annualPI : 0;
      // No-HECM: living spending + mortgage P&I (while the lien runs).
      const drawNoHecm = spend + piThisYear;
      if (pNoHecm > 0 && pNoHecm < drawNoHecm && noHecmDepletionYear === null)
        noHecmDepletionYear = t;
      pNoHecm = Math.max(0, pNoHecm - drawNoHecm) * (1 + r);

      // HECM: living spending only — unless the freed P&I is consumed, in which
      // case the client also spends the equivalent of the avoided payment.
      const drawHecm = spend + (inp.freedCashConsumed ? piThisYear : 0);
      if (pHecm > 0 && pHecm < drawHecm && hecmDepletionYear === null) hecmDepletionYear = t;
      pHecm = Math.max(0, pHecm - drawHecm) * (1 + r);
    }

    const homeEquityNoHecm = Math.max(0, row.homeValue - resid);
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
      portfolioHecm: pHecm,
      availableLOC: row.availableLOC,
      netWorthHecm: row.equity + pHecm,
    });
  }

  const age0 = inp.age;
  return {
    rows,
    annualMortgagePayment: annualPI,
    noHecmDepletionYear,
    noHecmDepletionAge: noHecmDepletionYear === null ? null : age0 + noHecmDepletionYear,
    hecmDepletionYear,
    hecmDepletionAge: hecmDepletionYear === null ? null : age0 + hecmDepletionYear,
    hecm,
  };
}
