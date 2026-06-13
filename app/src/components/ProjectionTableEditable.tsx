import type { ProjectionRow } from '../engine';
import { usd, pct } from '../format';
import { ScheduleCell } from './ScheduleEditor';

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
            <th>Age</th>
            <th>EOY</th>
            <th>Draws</th>
            <th>Payments</th>
            <th>Available LOC</th>
            <th>Loan Balance</th>
            <th>Home Equity</th>
            <th>Home Value</th>
            <th>Tenure/Mo</th>
            <th>Accrual</th>
            <th>Deduction</th>
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
