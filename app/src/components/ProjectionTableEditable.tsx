import type { ProjectionRow } from '../engine';
import { usd, pct } from '../format';
import { ScheduleCell } from './ScheduleCell';
import { InfoTip } from './InfoTip';

/**
 * Projection table with Draws / Payments as editable cells (years 1..N), so
 * schedule changes are made right where their effect is visible.
 */
export function ProjectionTableEditable({
  projection,
  draws,
  payments,
  onChange,
}: {
  projection: ProjectionRow[];
  draws: number[];
  payments: number[];
  onChange: (draws: number[], payments: number[]) => void;
}) {
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
            <th>Home Value <InfoTip text="Projected home value, grown each year at the assumed appreciation rate." /></th>
            <th>Tenure/Mo <InfoTip text="The monthly tenure payment the remaining credit could fund for life from that age." /></th>
            <th>Accrual <InfoTip text="The annual rate (index + margin + MIP) applied to the balance and credit line that year." /></th>
            <th>Deduction <InfoTip text="Interest paid that year that may be tax-deductible when the loan is repaid. Not tax advice." /></th>
          </tr>
        </thead>
        <tbody>
          {projection.map((r) => (
            <tr key={r.year}>
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
              <td>{usd(r.homeValue)}</td>
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
