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
  unfundedSell: number; // spending the sell-assets strategy could not cover
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

  // Bridge schedule: spending from the LOC during the recovery years, capped
  // so the LOC never goes negative (re-run after trimming any over-draw).
  const draws = Array(38).fill(0);
  for (let i = 0; i < R; i++) draws[i] = spend;
  let hecm = runSimulation({ ...inp, draws, payments: Array(38).fill(0) });
  for (let pass = 0; pass < 8; pass++) {
    const firstNeg = hecm.projection.findIndex((r) => r.availableLOC < 0);
    if (firstNeg === -1) break;
    const over = -hecm.projection[firstNeg].availableLOC;
    // De-accrue one year of growth, leave a small buffer, never below zero.
    const accrual = hecm.projection[firstNeg].accrualRate ?? hecm.loanProjectedRate;
    draws[firstNeg - 1] = Math.max(0, Math.floor(draws[firstNeg - 1] - over / (1 + accrual) - 1));
    hecm = runSimulation({ ...inp, draws, payments: Array(38).fill(0) });
  }
  const totalBridgeDraws = draws.reduce((a, b) => a + b, 0);

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

    if (pSell > 0 && pSell <= spend && sellDepletionYear === null) sellDepletionYear = y;
    const wSell = Math.min(spend, pSell);
    unfundedSell += spend - wSell;
    pSell = (pSell - wSell) * (1 + r);

    const bridgeDraw = draws[y - 1] ?? 0;
    const needBridge = Math.max(0, spend - bridgeDraw);
    if (pBridge > 0 && needBridge > 0 && pBridge <= needBridge && bridgeDepletionYear === null)
      bridgeDepletionYear = y;
    const wBridge = Math.min(needBridge, pBridge);
    unfundedBridge += needBridge - wBridge;
    pBridge = (pBridge - wBridge) * (1 + r);

    const row = hecm.projection[y];
    // The trim loop above keeps draws within the LOC, but clamp defensively so
    // an unconverged extreme input can never surface a negative credit line.
    const hecmLOC = Math.max(0, row.availableLOC);
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
      netSell: pSell + row.homeValue,
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
