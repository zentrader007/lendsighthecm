// Everything a report page can draw on, computed once per scenario from the
// same engine calls the advisor view uses — so the presentation can never show
// a number the simulator doesn't.
import { runSimulation } from '../engine';
import type { ProjectionRow, SimulationInputs, SimulationResult } from '../engine';
import { runMortgageComparison, type ComparisonResult, type ComparisonRow } from '../engine/comparison';
import { runAvailableSpending, type SpendingResult, type SpendingRow } from '../engine/spending';
import { runSequenceAnalysis, type SequenceResult, type SequenceRow } from '../engine/sequence';
import { runInTheMoney, type ItmResult } from '../engine/inTheMoney';
import { runOptions, refIndexFor, type OptionsResult } from './options';
import { resolveSections, type ReportConfig, type SectionContext, type SectionKey } from './reportConfig';

/** The planning horizon the narrative anchors to — a realistic age rather than
 *  the projection's tail, where the compounded loan floors equity to $0. */
export const REF_AGE = 85;

export interface ReportData {
  inp: SimulationInputs;
  result: SimulationResult;
  cmp: ComparisonResult;
  spending: SpendingResult;
  seq: SequenceResult;
  itm: ItmResult;
  options: OptionsResult;
  hasLien: boolean;
  /** Projection index of the reference-age row. */
  refIdx: number;
  ref: ProjectionRow; // projection row at the reference age
  cmpRef: ComparisonRow;
  spendRef: SpendingRow;
  cmpLast: ComparisonRow;
  seqLast: SequenceRow;
  last: ProjectionRow;
}

export function buildReportData(inp: SimulationInputs, result: SimulationResult = runSimulation(inp)): ReportData {
  const cmp = runMortgageComparison(inp);
  const spending = runAvailableSpending(inp);
  const seq = runSequenceAnalysis(inp);
  const itm = runInTheMoney(inp);
  const options = runOptions(inp, REF_AGE);
  const refIdx = refIndexFor(result, REF_AGE);
  const last = result.projection[result.projection.length - 1];
  return {
    inp,
    result,
    cmp,
    spending,
    seq,
    itm,
    options,
    hasLien: inp.existingLiens > 0,
    refIdx,
    ref: result.projection[refIdx],
    cmpRef: cmp.rows[Math.min(refIdx, cmp.rows.length - 1)],
    spendRef: spending.rows.find((r) => r.age >= REF_AGE) ?? spending.rows[spending.rows.length - 1],
    cmpLast: cmp.rows[cmp.rows.length - 1],
    seqLast: seq.rows[seq.rows.length - 1],
    last,
  };
}

/** The sections a scenario + config will actually render (for nav/page counts). */
export function reportSections(inputs: SimulationInputs, config: ReportConfig, result?: SimulationResult): SectionKey[] {
  const data = buildReportData(inputs, result);
  return resolveSections(config, sectionContext(data, config.notes));
}

export function sectionContext(data: ReportData, notes: string): SectionContext {
  return {
    hasLien: data.hasLien,
    hasSpending: data.spending.totalAvailable > 0,
    hasPortfolio: data.inp.portfolioValue > 0,
    hasNotes: notes.trim().length > 0,
  };
}
