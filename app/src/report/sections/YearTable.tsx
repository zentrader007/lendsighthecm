import { usd } from '../../format';
import { SectionHead } from './bits';
import type { SectionProps } from './types';

/** The full projection, read-only. Header repeats on printed pages. */
export function YearTable({ data }: SectionProps) {
  const { result } = data;
  const rows = result.projection;
  const hasDraws = rows.some((r) => (r.draw ?? 0) > 0);
  const hasPayments = rows.some((r) => (r.payment ?? 0) > 0);
  return (
    <>
      <SectionHead
        eyebrow="Year by year"
        title="The projection, year by year"
        lede="Every figure on the charts, in a table. Year 0 is closing; the loan balance grows with interest and insurance, the credit line grows at the same rate, and equity is home value less the balance."
      />
      <div className="rp-table-wrap">
        <table className="rp-table rp-years">
          <thead>
            <tr>
              <th>Year</th>
              <th>Age</th>
              {hasDraws && <th>Draw</th>}
              {hasPayments && <th>Payment</th>}
              <th>Home value</th>
              <th>Loan balance</th>
              <th>Credit line</th>
              <th>Equity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year}>
                <td>{r.year}</td>
                <td>{r.age}</td>
                {hasDraws && <td>{r.draw ? usd(r.draw) : ''}</td>}
                {hasPayments && <td>{r.payment ? usd(r.payment) : ''}</td>}
                <td>{usd(r.homeValue)}</td>
                <td>{usd(r.upb)}</td>
                <td>{usd(r.availableLOC)}</td>
                <td>{usd(r.equity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
