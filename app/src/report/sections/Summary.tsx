// "Plan at a glance": the whole plan on one page — the old print one-pager,
// reflowed to portrait. Headline numbers, the two charts a client asks about
// first, and the plan's milestones.
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { usd, pct } from '../../format';
import { Tile, Tiles, Panel, Line as Row, SectionHead } from './bits';
import type { SectionProps } from './types';

const NAVY = '#1b2a4a';
const BLUE = '#4a7c9b';
const GREEN = '#5b9f5b';
const CORAL = '#e07a5f';
const fmtK = (n: number) => `$${Math.round(n / 1000)}k`;
const tick = { fontSize: 10, fontWeight: 700, fontFamily: 'DM Mono, monospace', fill: NAVY };

export function Summary({ data, config }: SectionProps) {
  const { inp, result, cmp, spending, spendRef, ref, hasLien, last } = data;
  const t = config.targetAge;
  const marker = t != null && t >= result.projection[0].age && t <= last.age && (
    <ReferenceLine x={t} stroke={NAVY} strokeDasharray="4 4" label={{ value: `Age ${t}`, position: 'top', fontSize: 9, fontWeight: 700, fill: NAVY, fontFamily: 'DM Mono, monospace' }} />
  );
  const chart = result.projection.map((r) => ({
    age: r.age,
    homeValue: r.homeValue,
    upb: r.upb,
    equity: r.equity,
    availableLOC: r.availableLOC,
  }));

  return (
    <>
      <SectionHead
        eyebrow="Plan at a glance"
        title={config.client.name.trim() ? `${config.client.name.trim()}’s plan on one page` : 'Your plan on one page'}
        lede={
          <>
            Age <strong>{inp.age}</strong> · Home value <strong>{usd(inp.homeValue)}</strong>
            {hasLien && (
              <>
                {' '}· Mortgage paid off <strong>{usd(inp.existingLiens)}</strong>
              </>
            )}
            {inp.cashMode === 'Deposit' ? (
              <>
                {' '}· Cash brought to closing <strong>{usd(inp.initialCashDraw)}</strong>
              </>
            ) : (
              <>
                {' '}· Cash at closing <strong>{usd(result.netCashDrawn)}</strong>
              </>
            )}
          </>
        }
      />

      <Tiles cols={4}>
        <Tile label="Cash available now" value={usd(result.availableInitialDraw)} note="Most cash accessible in year one" tone="primary" />
        <Tile label="Total funds available" value={usd(result.principalLimit)} note="Over the loan’s life" />
        <Tile label="Monthly for life" value={usd(result.maxTenurePayment)} note="As a guaranteed payment instead" tone="green" />
        <Tile label="Credit line that grows" value={usd(result.remainingCredit)} note="Unused funds grow every year" />
      </Tiles>

      {data.itm.isShortToday && (
        <p className="rp-callout rp-callout-navy">
          <span className="rp-callout-head">Not yet in the money</span>
          Today the loan would fall {usd(data.itm.shortfallToday)} short of paying off the existing mortgage and
          costs, so it can’t close yet — the figures below assume the gap is covered.{' '}
          {data.itm.itmAge != null
            ? `Bringing ${usd(data.itm.depositToQualifyNow)} to closing qualifies you now; without cash, you qualify at age ${data.itm.itmAge}.`
            : `Bringing ${usd(data.itm.depositToQualifyNow)} to closing would qualify you now.`}
        </p>
      )}

      <p className="rp-assumptions">
        Expected rate {pct(result.expectedRate, 3)} · Initial rate {pct(result.initialRate, 3)} · Principal
        limit factor {pct(result.plf, 1)}
        {inp.rateScenario === 'Custom (per-year)' ? ' · rates vary by year' : ''} · Home appreciation{' '}
        {inp.appreciations ? 'varies by year' : `${pct(inp.appreciation, 1)}/yr`} · Closing costs &amp;
        insurance {usd(result.totalCostAllIn)}
        {inp.costsInLoan ? ' (financed)' : ''} · Projected to age {last.age}
      </p>

      <div className="rp-mini-charts">
        <div className="rp-mini-chart">
          <h4>Line of credit growth</h4>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={chart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
              <XAxis dataKey="age" tick={tick} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={fmtK} tick={tick} tickLine={false} width={46} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {marker}
              <Line type="monotone" dataKey="availableLOC" name="Available credit line" stroke={BLUE} dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" dataKey="equity" name="Home equity" stroke={GREEN} dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="rp-mini-chart">
          <h4>Home value, loan balance &amp; equity</h4>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={chart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
              <XAxis dataKey="age" tick={tick} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={fmtK} tick={tick} tickLine={false} width={46} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {marker}
              <Line type="monotone" dataKey="homeValue" name="Home value" stroke={BLUE} dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" dataKey="equity" name="Equity" stroke={GREEN} dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" dataKey="upb" name="Loan balance" stroke={CORAL} dot={false} strokeWidth={2} strokeDasharray="5 3" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rp-panels">
        {spending.totalAvailable > 0 ? (
          <Panel head="New spending this plan creates" tone="green">
            {spending.lumpSum > 0 && (
              <Row
                label={spending.outOfPocket > 0 ? `Cash in hand (after ${usd(spending.outOfPocket)} paid at closing)` : 'Cash at closing'}
                value={usd(spending.lumpSum)}
              />
            )}
            {spending.totalCreditDraws > 0 && <Row label="Planned credit-line draws" value={usd(spending.totalCreditDraws)} />}
            {spending.annualFreed > 0 && (
              <Row label="Mortgage payment freed" value={`${usd(spending.monthlyFreed)}/mo · ${spending.freedYears} yrs`} />
            )}
            <Row label="First-year total" value={usd(spending.firstYearTotal)} />
            <Row label={`Total by age ${spendRef.age}`} value={usd(spendRef.cumulative)} />
          </Panel>
        ) : (
          <Panel head="Where the value sits" tone="green">
            <Row label="Credit line today" value={usd(result.remainingCredit)} />
            <Row label={`Credit line at age ${ref.age}`} value={usd(ref.availableLOC)} />
            <Row label={`Credit line at age ${last.age}`} value={usd(last.availableLOC)} />
          </Panel>
        )}

        <Panel head={`What it costs — at age ${spendRef.age}`} tone="navy">
          <Row label="Most you’d ever owe" value={usd(Math.min(spendRef.loanBalance, spendRef.homeValue))} />
          <Row label="Home equity remaining" value={usd(spendRef.equityWith)} />
          <Row label="Equity if doing nothing" value={usd(spendRef.equityWithout)} />
          <div className="rp-panel-note">
            FHA-insured and non-recourse: when the home is sold, you or your heirs never repay more than
            it’s worth.
          </div>
        </Panel>

        <Panel head="Plan milestones">
          {hasLien && cmp.annualMortgagePayment > 0 && (
            <Row label="Monthly payment eliminated" value={`${usd(cmp.monthlyMortgagePayment)}/mo`} />
          )}
          {cmp.breakEvenAge != null && <Row label="Net worth pulls ahead" value={`age ${cmp.breakEvenAge}`} />}
          {cmp.noHecmDepletionAge != null && (
            <Row
              label="Savings last longer"
              value={`to ${cmp.hecmDepletionAge ?? `${last.age}+`} vs ${cmp.noHecmDepletionAge}`}
            />
          )}
          <Row label={`Credit line at age ${ref.age}`} value={usd(ref.availableLOC)} />
          <Row label={`Equity for heirs at ${ref.age}`} value={usd(ref.equity)} />
        </Panel>
      </div>
    </>
  );
}
