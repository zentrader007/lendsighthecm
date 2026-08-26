import type { ProjectionRow } from '../engine';
import { usd, pct } from '../format';
import { ScheduleCell, PercentCell } from './ScheduleCell';
import { InfoTip } from './InfoTip';

/**
 * Projection table with Draws / Payments / Appreciation % as editable cells
 * (years 1..N), so schedule and assumption changes are made right where their
 * effect is visible.
 */
export function ProjectionTableEditable({
  projection,
  draws,
  payments,
  appreciations,
  baseAppreciation,
  onChange,
  onAppreciationChange,
  highlightAge,
}: {
  projection: ProjectionRow[];
  draws: number[];
  payments: number[];
  appreciations: number[] | null;
  baseAppreciation: number;
  onChange: (draws: number[], payments: number[]) => void;
  onAppreciationChange: (next: number[]) => void;
  highlightAge?: number;
}) {
  // The row to highlight is the first at/after the target age (matching how the
  // charts snap their marker), or undefined when the age is out of range.
  const highlightYear =
    highlightAge != null &&
    projection.length > 0 &&
    highlightAge >= projection[0].age &&
    highlightAge <= projection[projection.length - 1].age
      ? (projection.find((r) => r.age >= highlightAge) ?? projection[projection.length - 1]).year
      : undefined;
  const setDraw = (i: number, v: number) => {
    const next = draws.slice();
    next[i] = v;
    onChange(next, payments);
  };
  const setPayment = (i: number, v: number) => {
    const next = payments.slice();
    next[i] = v;
    onChange(draws, next);
  };
  // On first edit, materialize the full series from the flat base so the whole
  // column is a real per-year array from then on.
  const setAppreciation = (i: number, v: number) => {
    const next = (appreciations ?? Array(38).fill(baseAppreciation)).slice();
    next[i] = v;
    onAppreciationChange(next);
  };

  return (
    <div className="table-wrap">
      <table className="projection projection-editable">
        <thead>
          <tr>
            <th>Age <InfoTip text="The age of the (youngest) borrower at the end of each projection year." /></th>
            <th>EOY <InfoTip text="Projection year — full years elapsed since closing. Year 0 is the closing snapshot." /></th>
            <th>Draws <InfoTip text="Extra cash drawn from the line of credit at the start of that year. Editable." /></th>
            <th>Payments <InfoTip text="Voluntary repayments made that year, which reduce the loan balance. Editable." /></th>
            <th>Available LOC <InfoTip text="Unused line of credit remaining that year. It grows at the loan rate until drawn." /></th>
            <th>Loan Balance <InfoTip text="Unpaid principal balance — financed costs, liens, and any draws, plus accrued interest and MIP." /></th>
            <th>Home Equity <InfoTip text="Projected home value minus the loan balance — the equity remaining to the owner or heirs." /></th>
            <th>Apprec. % <InfoTip text="The home-price appreciation applied that year. Editable per year — set an FA's or realtor's expert view, or a rising/falling glide. Defaults to the Assumed Appreciation rate until changed." /></th>
            <th>Home Value <InfoTip text="Projected home value, grown each year at that year's appreciation rate." /></th>
            <th>Investment <InfoTip text="The cash actually drawn at closing, if invested instead — compounding each year at the assumed (after-tax) return. Excludes any loan amount that pays off an existing lien (that's not cash in hand) and nets out out-of-pocket closing costs. Illustration only: in most cases you should not draw home equity to invest." /></th>
            <th>Invest + Equity <InfoTip text="Invested cash drawn plus remaining home equity — the 'Investment + Equity' line on the Invest comparison chart." /></th>
            <th>Tenure/Mo <InfoTip text="The monthly tenure payment the remaining credit could fund for life from that age." /></th>
            <th>Accrual <InfoTip text="The annual rate applied to the balance and credit line that year: the expected rate (10yr CMT + margin) + MIP under the flat scenario, shocked ±2% under the stress scenarios, or the historical 1yr CMT + margin + MIP under the replay." /></th>
            <th>Deduction <InfoTip text="Interest paid that year that may be tax-deductible when the loan is repaid. Not tax advice." /></th>
          </tr>
        </thead>
        <tbody>
          {projection.map((r) => (
            <tr key={r.year} className={r.year === highlightYear ? 'row-target' : undefined}>
              <td>{r.age}</td>
              <td>{r.year}</td>
              <td>
                {r.year === 0 ? (
                  'N/A'
                ) : (
                  <ScheduleCell
                    value={draws[r.year - 1] ?? 0}
                    onCommit={(v) => setDraw(r.year - 1, v)}
                  />
                )}
              </td>
              <td>
                {r.year === 0 ? (
                  'N/A'
                ) : (
                  <ScheduleCell
                    value={payments[r.year - 1] ?? 0}
                    onCommit={(v) => setPayment(r.year - 1, v)}
                  />
                )}
              </td>
              <td>{usd(r.availableLOC)}</td>
              <td>{usd(r.upb)}</td>
              <td>{usd(r.equity)}</td>
              <td>
                {r.year === 0 ? (
                  'N/A'
                ) : (
                  <PercentCell
                    value={appreciations?.[r.year - 1] ?? baseAppreciation}
                    onCommit={(v) => setAppreciation(r.year - 1, v)}
                  />
                )}
              </td>
              <td>{usd(r.homeValue)}</td>
              <td>{usd(r.investment)}</td>
              <td>{usd(r.investmentPlusEquity)}</td>
              <td>{r.tenureAvailPerMonth == null ? 'N/A' : usd(r.tenureAvailPerMonth)}</td>
              <td>{r.accrualRate == null ? 'N/A' : pct(r.accrualRate, 3)}</td>
              <td>{usd(r.possibleDeduction)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
