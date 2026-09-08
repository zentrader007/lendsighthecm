// "Your options side by side": the decision page. One table, the same home
// and assumptions in every column, so the client can see what each structure
// gives up and gets — and what doing nothing looks like next to it.
import { usd } from '../../format';
import type { OptionColumn } from '../options';
import { paragraphs } from '../text';
import { Callout, SectionHead } from './bits';
import type { SectionProps } from './types';

const money = (n: number | null) => (n == null ? '—' : usd(n));

export function Options({ data, config, sections }: SectionProps) {
  const { options, hasLien, cmp, itm } = data;
  const { columns, refAge } = options;
  const pmt = options.monthlyMortgagePayment;
  const hasTenure = columns.some((c) => c.key === 'tenure');
  const notesElsewhere = sections.includes('notes');
  const firstNote = paragraphs(config.notes)[0];

  // A borrower who can't close today has no structures to compare yet — the
  // only decision is how to get into the money. Say so instead of tabling a
  // loan that can't be made.
  if (itm.isShortToday) {
    return (
      <>
        <SectionHead
          eyebrow="Your options"
          title="Not yet in the money"
          lede="A reverse mortgage has to pay off your existing mortgage and closing costs first. Today the loan would fall short of that, so there is nothing left over to compare — yet."
        />
        <div className="rp-options-notes">
          <h3>What would change that</h3>
          <ul>
            <li>
              <strong>Bring cash to closing.</strong> {usd(itm.depositToQualifyNow)} would close the gap today; anything
              beyond that becomes a growing line of credit.
            </li>
            <li>
              <strong>Wait.</strong>{' '}
              {itm.itmAge != null
                ? `Without adding cash, you come into the money at age ${itm.itmAge}: the program lends a larger share of the home's value as you get older, your home appreciates, and the mortgage pays down.`
                : 'Within this projection the gap does not close on its own, so cash at closing is the route.'}
            </li>
            <li>
              <strong>Pay the mortgage down.</strong> Every dollar off the balance is a dollar less the reverse mortgage
              has to cover.
            </li>
          </ul>
        </div>
        {firstNote && (
          <Callout tone="primary">
            <span className="rp-callout-head">Your advisor’s take</span>
            {firstNote}
          </Callout>
        )}
      </>
    );
  }

  type RowDef = { label: string; cell: (c: OptionColumn) => string; className?: string };
  const rows: RowDef[] = [
    { label: 'Cash at closing', cell: (c) => (c.key === 'none' ? '—' : money(c.cashAtClosing)) },
    ...(hasTenure
      ? [{ label: 'Guaranteed monthly income', cell: (c: OptionColumn) => (c.monthlyIncome == null ? '—' : `${usd(c.monthlyIncome)}/mo`) }]
      : []),
    { label: 'Credit line today', cell: (c) => money(c.creditLineToday) },
    { label: `Credit line at age ${refAge}`, cell: (c) => money(c.creditLineAtRef) },
    {
      label: hasLien ? `Loan or mortgage balance at ${refAge}` : `Loan balance at age ${refAge}`,
      cell: (c) => (c.key === 'none' ? (hasLien ? money(c.loanBalanceAtRef) : 'none') : money(c.loanBalanceAtRef)),
    },
    { label: `Home equity at age ${refAge}`, cell: (c) => money(c.homeEquityAtRef), className: 'rp-row-strong' },
    { label: `Net worth at age ${refAge}`, cell: (c) => money(c.netWorthAtRef), className: 'rp-row-strong' },
    ...(hasLien && pmt > 0
      ? [
          {
            label: 'Monthly mortgage payment',
            cell: (c: OptionColumn) => (c.paymentEliminated != null ? 'Eliminated' : `Keep paying ${usd(pmt)}/mo`),
          },
        ]
      : []),
  ];

  return (
    <>
      <SectionHead
        eyebrow="Your options"
        title="Your options, side by side"
        lede={
          <>
            Same home, same age, same rates and assumptions in every column — only the way the money is
            taken changes. “Later” figures are at age {refAge}; net worth counts home equity plus
            savings{hasLien ? ', with the same living expenses in every world' : ''}.
          </>
        }
      />

      <div className="rp-table-wrap">
        <table className="rp-table rp-options">
          <thead>
            <tr>
              <th className="rp-options-rowhead" />
              {columns.map((c) => (
                <th key={c.key} className={`rp-options-col rp-col-${c.key}`}>
                  <span className="rp-options-label">{c.label}</span>
                  <span className="rp-options-sub">{c.sublabel}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={r.className}>
                <th scope="row">{r.label}</th>
                {columns.map((c) => (
                  <td key={c.key} className={`rp-col-${c.key}`}>
                    {r.cell(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rp-options-notes">
        <h3>How to read this</h3>
        <ul>
          <li>
            <strong>More cash now means less later.</strong> Every dollar taken at closing accrues interest,
            so the columns that take the most up front show the largest balance and the least equity at
            age {refAge}.
          </li>
          <li>
            <strong>The credit line is the flexible middle.</strong> Unused credit grows every year and can be
            drawn when needed — it’s the option that keeps the most doors open.
          </li>
          {hasTenure && (
            <li>
              <strong>Monthly for life trades flexibility for certainty.</strong> The payment continues as long
              as you live in the home, however long that is.
            </li>
          )}
          <li>
            <strong>{hasLien ? 'Keeping the mortgage' : 'Doing nothing'} isn’t free either.</strong>{' '}
            {hasLien
              ? `It means ${usd(cmp.monthlyMortgagePayment)} a month keeps leaving your budget, and every payment comes from savings or income you could use elsewhere.`
              : 'Your equity stays locked in the home, and any need for cash later has to be met by selling, borrowing, or drawing down savings.'}
          </li>
        </ul>
      </div>

      {firstNote && (
        <Callout tone="primary">
          <span className="rp-callout-head">Your advisor’s take</span>
          {firstNote}
          {notesElsewhere && paragraphs(config.notes).length > 1 ? ' (Read the full recommendation on the advisor page.)' : ''}
        </Callout>
      )}
    </>
  );
}
