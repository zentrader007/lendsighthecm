import type { ProjectionRow } from '../engine';
import { usd, pct } from '../format';

export function ProjectionTable({ projection }: { projection: ProjectionRow[] }) {
  return (
    <div className="table-wrap">
      <table className="projection">
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
              <td>{r.draw == null ? 'N/A' : usd(r.draw)}</td>
              <td>{r.payment == null ? 'N/A' : usd(r.payment)}</td>
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
