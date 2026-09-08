// One page per analysis: a client-voice title, one sentence on what the chart
// shows, the chart itself (the same component the advisor sees), a few key
// figures, and the plain-language reading. Every number is from ReportData.
import { usd, pct } from '../../format';
import {
  LocChart,
  HomeEquityChart,
  MortgageComparisonChart,
  AvailableSpendingChart,
  InvestChart,
  SequenceChart,
  InTheMoneyChart,
} from '../../components/Charts';
import { locInsight, spendingInsight, networthInsight, equityInsight, investInsight, seqInsight } from '../insights';
import type { ReportData } from '../reportData';
import { Callout, ChartBox, SectionHead, Tile, Tiles } from './bits';
import type { SectionProps } from './types';

export type ChartSectionKey = 'loc' | 'spending' | 'networth' | 'equity' | 'invest' | 'seqrisk';

export function ChartSection({ data, section }: SectionProps & { section: ChartSectionKey }) {
  switch (section) {
    case 'loc':
      return <Loc data={data} />;
    case 'spending':
      return <Spending data={data} />;
    case 'networth':
      return <NetWorth data={data} />;
    case 'equity':
      return <Equity data={data} />;
    case 'invest':
      return <Invest data={data} />;
    case 'seqrisk':
      return <SeqRisk data={data} />;
  }
}

function Loc({ data }: { data: ReportData }) {
  const { result, itm, ref, last } = data;
  if (itm.isShortToday) {
    return (
      <>
        <SectionHead
          eyebrow="Qualifying"
          title="When a reverse mortgage would work for you"
          lede="Below the line, the loan can’t pay off your mortgage and costs yet. The crossing point is the age it can — without bringing cash to closing."
        />
        <ChartBox>
          <InTheMoneyChart rows={itm.rows} itmAge={itm.itmAge ?? undefined} consumer />
        </ChartBox>
        <Tiles cols={3}>
          <Tile label="Short today by" value={usd(itm.shortfallToday)} tone="coral" />
          <Tile label="Cash to qualify now" value={usd(itm.depositToQualifyNow)} note="Brought to closing" />
          <Tile label="Qualifies without cash" value={itm.itmAge != null ? `age ${itm.itmAge}` : '—'} note={itm.itmAge != null ? 'As limits rise and the mortgage pays down' : 'Not within this projection'} tone="green" />
        </Tiles>
        <Callout>{locInsight(data)}</Callout>
      </>
    );
  }
  return (
    <>
      <SectionHead
        eyebrow="Credit line growth"
        title="Your credit line grows every year you don’t use it"
        lede="The unused portion of your line of credit grows at the loan’s rate — independent of your home’s value — so what you can access later is larger than what you can access today."
      />
      <ChartBox>
        <LocChart projection={result.projection} consumer />
      </ChartBox>
      <Tiles cols={3}>
        <Tile label="Credit line today" value={usd(result.remainingCredit)} tone="primary" />
        <Tile label={`At age ${ref.age}`} value={usd(ref.availableLOC)} note="If untouched" tone="green" />
        <Tile label={`At age ${last.age}`} value={usd(last.availableLOC)} note="If untouched" />
      </Tiles>
      <Callout>{locInsight(data)}</Callout>
    </>
  );
}

function Spending({ data }: { data: ReportData }) {
  const { spending, spendRef } = data;
  return (
    <>
      <SectionHead
        eyebrow="New spending money"
        title="What this puts within reach"
        lede="Three kinds of money: cash at closing and credit-line draws (borrowed — the balance grows), and the mortgage payment you stop making (not borrowed — simply money that stays in your pocket)."
      />
      <ChartBox>
        <AvailableSpendingChart rows={spending.rows} consumer showBalance />
      </ChartBox>
      <Tiles cols={3}>
        <Tile label="First year" value={usd(spending.firstYearTotal)} note="New spending available" tone="primary" />
        <Tile label={`By age ${spendRef.age}`} value={usd(spendRef.cumulative)} note="Cumulative" tone="green" />
        {spending.annualFreed > 0 ? (
          <Tile label="Payment you stop making" value={`${usd(spending.monthlyFreed)}/mo`} note={`For ${spending.freedYears} year${spending.freedYears === 1 ? '' : 's'}`} />
        ) : (
          <Tile label="Cash at closing" value={usd(spending.lumpSum)} note="After any costs paid out of pocket" />
        )}
      </Tiles>
      {spending.totalAvailable > 0 && (
        <div className="cost-ledger rp-ledger">
          <div className="ledger-col ledger-receive">
            <span className="ledger-head">What you get</span>
            <span className="ledger-big">{usd(spendRef.cumulative)}</span>
            <span className="ledger-sub">
              of new spending by age {spendRef.age} — {usd(spending.lumpSum)} in cash
              {spending.annualFreed > 0 ? ` plus about ${usd(spending.monthlyFreed)} a month you stop paying on your mortgage` : ''}
              {spendRef.cumulativeDraws > 0 ? ` plus ${usd(spendRef.cumulativeDraws)} drawn from your credit line by then` : ''}.
            </span>
          </div>
          <div className="ledger-col ledger-cost">
            <span className="ledger-head">What it costs</span>
            <span className="ledger-big">{usd(Math.min(spendRef.loanBalance, spendRef.homeValue))}</span>
            <span className="ledger-sub">
              the most you’d repay by age {spendRef.age} — leaving {usd(spendRef.equityWith)} of home equity for you or
              your heirs, vs {usd(spendRef.equityWithout)} if you did nothing. FHA-insured: you or your heirs never
              owe more than the home sells for.
            </span>
          </div>
        </div>
      )}
      <Callout>{spendingInsight(data)}</Callout>
    </>
  );
}

function NetWorth({ data }: { data: ReportData }) {
  const { cmp, cmpRef, hasLien, inp } = data;
  return (
    <>
      <SectionHead
        eyebrow="Net worth"
        title={hasLien ? 'Net worth: reverse mortgage vs. keeping your mortgage' : 'Net worth: with and without the reverse mortgage'}
        lede={
          hasLien
            ? `Both lines pay the same living expenses from the same savings. The difference is the ${usd(cmp.monthlyMortgagePayment)}/month mortgage payment you would keep making without the reverse mortgage.`
            : `Both lines pay the same ${usd(inp.annualSpending)}/year of living expenses from the same savings. With the reverse mortgage, the cash taken at closing is invested against a growing loan balance.`
        }
      />
      <ChartBox>
        <MortgageComparisonChart
          rows={cmp.rows}
          consumer
          noLien={!hasLien}
          breakEvenAge={cmp.breakEvenAge ?? undefined}
          noHecmDepletionAge={cmp.noHecmDepletionAge ?? undefined}
          hecmDepletionAge={cmp.hecmDepletionAge ?? undefined}
        />
      </ChartBox>
      <Tiles cols={3}>
        <Tile label={`With reverse mortgage · age ${cmpRef.age}`} value={usd(cmpRef.netWorthHecm)} note={`${usd(cmpRef.homeEquityHecm)} equity + ${usd(cmpRef.portfolioHecm)} savings`} tone="green" />
        <Tile label={`${hasLien ? 'Keeping mortgage' : 'Without'} · age ${cmpRef.age}`} value={usd(cmpRef.netWorthNoHecm)} note={`${usd(cmpRef.homeEquityNoHecm)} equity + ${usd(cmpRef.portfolioNoHecm)} savings`} />
        {hasLien && cmp.monthlyMortgagePayment > 0 ? (
          <Tile label="Payment eliminated" value={`${usd(cmp.monthlyMortgagePayment)}/mo`} note={`${usd(cmp.cumulativeFreedPayment)} over ${cmp.freedPaymentYears} yrs`} tone="primary" />
        ) : cmp.breakEvenAge != null ? (
          <Tile label="Ahead by" value={`age ${cmp.breakEvenAge}`} note="When the reverse mortgage line passes the baseline" tone="primary" />
        ) : (
          <Tile label="Cash invested" value={usd(cmp.hecm.netCashDrawn)} note={`Growing at ${pct(inp.investmentReturn, 1)}`} tone="primary" />
        )}
      </Tiles>
      <Callout>{networthInsight(data)}</Callout>
    </>
  );
}

function Equity({ data }: { data: ReportData }) {
  const { result, ref } = data;
  return (
    <>
      <SectionHead
        eyebrow="Equity vs. balance"
        title="Your home’s value, the loan balance, and what’s left"
        lede="The loan balance grows because no payments are required; the home grows with the market. The gap between them is your equity — what you or your heirs keep when the home is sold."
      />
      <ChartBox>
        <HomeEquityChart projection={result.projection} consumer />
      </ChartBox>
      <Tiles cols={3}>
        <Tile label={`Home value at ${ref.age}`} value={usd(ref.homeValue)} tone="primary" />
        <Tile label={`Loan balance at ${ref.age}`} value={usd(ref.upb)} tone="coral" />
        <Tile label={`Equity at ${ref.age}`} value={usd(ref.equity)} note="For you or your heirs" tone="green" />
      </Tiles>
      <Callout>{equityInsight(data)}</Callout>
    </>
  );
}

function Invest({ data }: { data: ReportData }) {
  const { result, inp } = data;
  const row = result.projection.find((r) => r.age >= 90) ?? data.last;
  return (
    <>
      <SectionHead
        eyebrow="Illustration"
        title="If the cash were invested instead of spent"
        lede={`An illustration, not a recommendation: the cash taken at closing invested at ${pct(inp.investmentReturn, 1)} a year${inp.taxRateOnSoldAssets > 0 ? `, after a ${pct(inp.taxRateOnSoldAssets, 0)} tax on the invested side` : ''}, compared with leaving the equity alone.`}
      />
      <ChartBox>
        <InvestChart projection={result.projection} />
      </ChartBox>
      <Tiles cols={3}>
        <Tile label={`Invested cash at ${row.age}`} value={usd(row.investment)} note={`From ${usd(result.netCashDrawn)} at closing`} tone="primary" />
        <Tile label={`Investment + equity at ${row.age}`} value={usd(row.investmentPlusEquity)} tone="green" />
        <Tile label={`Equity alone at ${row.age}`} value={usd(row.equity)} />
      </Tiles>
      <Callout>{investInsight(data)}</Callout>
    </>
  );
}

function SeqRisk({ data }: { data: ReportData }) {
  const { seq, seqLast, inp } = data;
  return (
    <>
      <SectionHead
        eyebrow="Market downturn protection"
        title="Protecting your savings in a downturn"
        lede={`Two ways to pay for living expenses through a ${pct(inp.crashPct, 0)} market drop with ${inp.recoveryYears} years of recovery: keep selling investments at low prices, or draw from the credit line and let the investments recover.`}
      />
      <ChartBox>
        <SequenceChart rows={seq.rows} />
      </ChartBox>
      <Tiles cols={3}>
        <Tile label={`Savings at ${seqLast.age} · bridge from line`} value={usd(seqLast.portfolioBridge)} note={seq.bridgeDepletionAge != null ? `Runs out at age ${seq.bridgeDepletionAge}` : 'Lasts the projection'} tone="green" />
        <Tile label={`Savings at ${seqLast.age} · sell investments`} value={usd(seqLast.portfolioSell)} note={seq.sellDepletionAge != null ? `Runs out at age ${seq.sellDepletionAge}` : 'Lasts the projection'} tone="coral" />
        <Tile label="Drawn from the line" value={usd(seq.totalBridgeDraws)} note={`Over ${inp.recoveryYears} recovery year${inp.recoveryYears === 1 ? '' : 's'}`} />
      </Tiles>
      <Callout>{seqInsight(data)}</Callout>
    </>
  );
}
