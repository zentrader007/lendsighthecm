// Sequence-of-returns analysis: does bridging spending from a standby HECM
// LOC during a market downturn beat selling portfolio assets at the bottom?
//
// Two strategies over the projection horizon, both funding the same spending:
//   "Sell assets":  no HECM; withdraw annualSpending from the portfolio every
//                   year, including through the crash and recovery.
//   "LOC bridge":   open the HECM (closing costs from the portfolio when paid
//                   out of pocket); during the recovery years draw spending
//                   from the LOC instead, capped at available credit; resume
//                   portfolio withdrawals afterward.
//
// Market path: crashPct drop at the start, recoveryReturn for recoveryYears,
// then investmentReturn. Withdrawals at the beginning of each year; the HECM
// side (debt, LOC, equity) accrues monthly via runSimulation.
import { runSimulation } from './index';
import { monthlyMortgagePayment, residualMortgage } from './comparison';
import type { SimulationInputs, SimulationResult } from './types';

export interface SequenceRow {
  year: number;
  age: number;
  marketReturn: number;
  portfolioSell: number; // no HECM, sell-assets strategy
  portfolioBridge: number; // with HECM, LOC-bridge strategy
  bridgeDraw: number; // drawn from the LOC this year
  hecmDebt: number;
  hecmLOC: number;
  equity: number;
  netBridge: number; // portfolioBridge + home equity (after debt)
  netSell: number; // portfolioSell + home value (free and clear)
}

export interface SequenceResult {
  rows: SequenceRow[];
  /** Year/age the sell-assets portfolio can no longer fund full spending. */
  sellDepletionYear: number | null;
  sellDepletionAge: number | null;
  bridgeDepletionYear: number | null;
  bridgeDepletionAge: number | null;
  unfundedSell: number; // spending (and kept-mortgage P&I) the sell-assets strategy could not cover
  unfundedBridge: number;
  totalBridgeDraws: number;
  hecm: SimulationResult; // the underlying HECM run with the bridge schedule
}

export function runSequenceAnalysis(inp: SimulationInputs): SequenceResult {
  const N = Math.min(Math.max(Math.floor(inp.projectionYears) || 0, 1), 38);
  const R = Math.min(Math.max(Math.floor(inp.recoveryYears) || 0, 0), N);
  const spend = Math.max(0, inp.annualSpending);
  const crash = Math.min(Math.max(inp.crashPct, 0), 0.95);

  const marketReturn = (y: number) => (y <= R ? inp.recoveryReturn : inp.investmentReturn);

  // An existing lien the no-HECM ("sell assets") client keeps carrying: its P&I
  // drains that portfolio each year and its residual balance nets out of that
  // home equity — exactly as the Net Worth tab models the keep-the-mortgage
  // world. The bridge (HECM) side has the lien paid off at closing, so it carries
  // neither. Without this, the sell-assets path would get a free-and-clear home
  // and skip the mortgage entirely, overstating it against the HECM.
  const lien = Math.max(0, inp.existingLiens);
  const lienRate = Math.max(0, inp.existingLienRate);
  const lienTerm = Math.min(Math.max(Math.floor(inp.existingLienTermRemaining) || 0, 0), 40);
  const monthlyPI =
    lien <= 0
      ? 0
      : inp.existingLienPayment > 0
        ? inp.existingLienPayment
        : monthlyMortgagePayment(lien, lienRate, lienTerm);
  const annualPI = 12 * monthlyPI;
  // The mortgage is actually retired the first year its amortizing balance hits
  // zero (sooner than the term if the entered payment is larger), matching the
  // Net Worth tab's real-payoff logic.
  const maxPayYear = Math.min(lienTerm, N);
  let payoffYear = maxPayYear;
  for (let t = 1; t <= maxPayYear; t++) {
    if (residualMortgage(lien, lienRate, lienTerm, t, monthlyPI) <= 0) {
      payoffYear = t;
      break;
    }
  }

  // Bridge schedule: request spending from the LOC during the recovery years.
  // The engine caps each draw at the credit actually available that year, so we
  // read the ACTUAL draws back out of the projection — requesting more than the
  // line holds must fall back to the portfolio, not materialize from thin air.
  const draws = Array(38).fill(0);
  for (let i = 0; i < R; i++) draws[i] = spend;
  const hecm = runSimulation({ ...inp, draws, payments: Array(38).fill(0) });
  const drawnInYear = (y: number) => hecm.projection[y]?.draw ?? 0;
  const totalBridgeDraws = hecm.projection.reduce((a, row) => a + (row.draw ?? 0), 0);

  // Portfolio paths. Closing costs come out of the portfolio (pre-crash) when
  // paid out of pocket; when financed they sit in the loan balance instead.
  let pSell = inp.portfolioValue * (1 - crash);
  let pBridge = (inp.portfolioValue - hecm.pocCosts) * (1 - crash);

  let sellDepletionYear: number | null = null;
  let bridgeDepletionYear: number | null = null;
  let unfundedSell = 0;
  let unfundedBridge = 0;

  const rows: SequenceRow[] = [];
  for (let y = 1; y <= N; y++) {
    const r = marketReturn(y);

    // Keep-the-mortgage world: living spending PLUS the mortgage P&I (until the
    // loan is paid off) both come out of the portfolio.
    const piThisYear = y <= payoffYear ? annualPI : 0;
    const sellNeed = spend + piThisYear;
    if (pSell > 0 && pSell <= sellNeed && sellDepletionYear === null) sellDepletionYear = y;
    const wSell = Math.min(sellNeed, pSell);
    unfundedSell += sellNeed - wSell;
    pSell = (pSell - wSell) * (1 + r);

    const bridgeDraw = drawnInYear(y);
    const needBridge = Math.max(0, spend - bridgeDraw);
    if (pBridge > 0 && needBridge > 0 && pBridge <= needBridge && bridgeDepletionYear === null)
      bridgeDepletionYear = y;
    const wBridge = Math.min(needBridge, pBridge);
    unfundedBridge += needBridge - wBridge;
    pBridge = (pBridge - wBridge) * (1 + r);

    const row = hecm.projection[y];
    // The engine caps draws at the available credit, so this can't go negative;
    // kept as a cheap guard against an extreme input surfacing a negative line.
    const hecmLOC = Math.max(0, row.availableLOC);
    // The kept mortgage's shrinking balance reduces the sell-assets home equity;
    // 0 (free and clear) once there's no lien or it's paid off.
    const residSell = residualMortgage(lien, lienRate, lienTerm, y, monthlyPI);
    rows.push({
      year: y,
      age: row.age,
      marketReturn: r,
      portfolioSell: pSell,
      portfolioBridge: pBridge,
      bridgeDraw,
      hecmDebt: row.upb,
      hecmLOC,
      equity: row.equity,
      netBridge: pBridge + row.equity,
      netSell: pSell + Math.max(0, row.homeValue - residSell),
    });
  }

  const age = inp.age;
  return {
    rows,
    sellDepletionYear,
    sellDepletionAge: sellDepletionYear === null ? null : age + sellDepletionYear,
    bridgeDepletionYear,
    bridgeDepletionAge: bridgeDepletionYear === null ? null : age + bridgeDepletionYear,
    unfundedSell,
    unfundedBridge,
    totalBridgeDraws,
    hecm,
  };
}
