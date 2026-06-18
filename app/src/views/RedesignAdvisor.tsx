import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { SimulationInputs } from '../engine';
import { defaultInputs } from '../engine/defaults';
import { runSequenceAnalysis } from '../engine/sequence';
import { fetchLiveCMT } from '../lib/cmt';
import { NumberField, SelectField, ToggleField } from '../components/Field';
import { InfoTip } from '../components/InfoTip';
import { ProjectionTableEditable } from '../components/ProjectionTableEditable';
import { Disclaimer } from '../components/Disclaimer';
import { usd, pct } from '../format';
import { RATE_MODES, RATE_SCENARIOS } from './types';
import type { AdvisorProps } from './types';

const LocChart = lazy(() =>
  import('../components/Charts').then((m) => ({ default: m.LocChart })),
);
const HomeEquityChart = lazy(() =>
  import('../components/Charts').then((m) => ({ default: m.HomeEquityChart })),
);
const InvestChart = lazy(() =>
  import('../components/Charts').then((m) => ({ default: m.InvestChart })),
);
const StandbyChart = lazy(() =>
  import('../components/Charts').then((m) => ({ default: m.StandbyChart })),
);
const NetWorthChart = lazy(() =>
  import('../components/Charts').then((m) => ({ default: m.NetWorthChart })),
);
const SequenceChart = lazy(() =>
  import('../components/Charts').then((m) => ({ default: m.SequenceChart })),
);

type StageView = 'loc' | 'networth' | 'equity' | 'invest' | 'standby' | 'seqrisk' | 'table';

const STAGE_TABS: readonly { key: StageView; label: string }[] = [
  { key: 'loc', label: 'Credit line growth' },
  { key: 'networth', label: 'Net worth' },
  { key: 'equity', label: 'Equity vs balance' },
  { key: 'invest', label: 'Invest comparison' },
  { key: 'standby', label: 'Standby LOC' },
  { key: 'seqrisk', label: 'Sequence risk' },
  { key: 'table', label: 'Year table' },
];

/**
 * Redesigned advisor workflow: scenario bar of client facts on top, three
 * headline answers, a compact stat strip, one chart at a time, and all
 * assumptions in a slide-over drawer.
 */
export function RedesignAdvisor({
  inp,
  setInp,
  result,
  copied,
  share,
  goConsumer,
}: AdvisorProps) {
  const [stage, setStage] = useState<StageView>('loc');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [live, setLive] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; asOf?: string }>({
    status: 'idle',
  });

  const set = <K extends keyof SimulationInputs>(k: K, v: SimulationInputs[K]) =>
    setInp((p) => ({ ...p, [k]: v }));

  // Pull live 10yr & 1yr CMT from the /api/cmt proxy and fill the rate fields
  // (still editable). Falls back silently to the manual values on any error.
  const refreshLive = useCallback(async () => {
    setLive((s) => ({ ...s, status: 'loading' }));
    try {
      const data = await fetchLiveCMT();
      setInp((p) => ({ ...p, cmt10yr: data.cmt10yr, cmt1yr: data.cmt1yr }));
      setLive({ status: 'ok', asOf: data.asOf });
    } catch {
      setLive({ status: 'error' });
    }
  }, [setInp]);

  // Fresh visits pull live rates on load; a shared ?d= scenario keeps the exact
  // numbers it was built with (Refresh still works if the advisor wants live).
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('d')) refreshLive();
  }, [refreshLive]);
  const setCost = (k: keyof SimulationInputs['costs'], v: number) =>
    setInp((p) => ({ ...p, costs: { ...p.costs, [k]: v } }));

  // Nearest projection row at/after a target age (falls back to the last row).
  const rowAt = (age: number) => {
    const rows = result.projection;
    return rows.find((r) => r.age >= age) ?? rows[rows.length - 1];
  };
  const r85 = rowAt(85);
  const r90 = rowAt(90);
  // 20-year horizon for the standby-LOC story (or the last row if shorter).
  const r20 = result.projection[Math.min(20, result.projection.length - 1)];

  const seq = useMemo(() => runSequenceAnalysis(inp), [inp]);
  const seqLast = seq.rows[seq.rows.length - 1];
  const sellDies = seq.sellDepletionAge !== null;
  const bridgeDies = seq.bridgeDepletionAge !== null;
  const seqInsight =
    sellDies && !bridgeDies
      ? `Selling assets through the downturn, the portfolio runs dry at age ${seq.sellDepletionAge} with ${usd(seq.unfundedSell)} of spending unfunded. Bridging ${usd(seq.totalBridgeDraws)} of spending from the credit line keeps the portfolio alive through age ${seqLast.age}, ending at ${usd(seqLast.portfolioBridge)} — the trade-off is a ${usd(seqLast.hecmDebt)} loan balance, leaving ${usd(seqLast.equity)} of home equity.`
      : !sellDies && !bridgeDies
        ? `Both strategies fund spending through age ${seqLast.age}. The bridge ends with a ${usd(seqLast.portfolioBridge)} portfolio plus ${usd(seqLast.equity)} home equity (${usd(seqLast.netBridge)} total); selling assets ends with ${usd(seqLast.portfolioSell)} plus a free-and-clear home (${usd(seqLast.netSell)} total). With no depletion risk at this spending level, the standby line is insurance rather than a numbers win.`
        : bridgeDies && !sellDies
          ? `At this spending level the bridge does not help: even drawing from the credit line, the portfolio runs dry at age ${seq.bridgeDepletionAge}, while selling assets alone funds spending through age ${seqLast.age}. The standby line's capacity is finite — lower the spending or shorten the bridge.`
          : `Spending outruns both strategies: the portfolio depletes at age ${seq.sellDepletionAge} without the HECM and age ${seq.bridgeDepletionAge} with the bridge. Consider lower annual spending, or test a smaller market drop.`;

  // The "cost of standby liquidity" framing only holds for a free-and-clear home.
  // When the HECM paid off an existing mortgage, that mortgage's accrued payoff is
  // inside the gap and would exist anyway in the no-HECM world — so reframe and
  // point to the Net worth tab for the like-for-like comparison.
  const standbyGap = r20.homeValue - r20.rmNetWorth;
  const standbyInsight =
    inp.existingLiens > 0
      ? `If nothing further is drawn, by age ${r20.age} the client can access ${usd(r20.accessibleResources)} (${usd(r20.equity)} equity OR ${usd(r20.availableLOC)} credit line) vs ${usd(r20.homeValue)} with no reverse mortgage. Much of the ${usd(standbyGap)} gap to the HECM net worth (${usd(r20.rmNetWorth)}) is the accrued balance of the ${usd(inp.existingLiens)} mortgage the HECM paid off — which would still exist, and still accrue interest, if no reverse mortgage were taken. The Net worth tab nets that mortgage out for a like-for-like comparison. If the property is sold, the line of credit is no longer available.`
      : `If nothing is ever drawn, by age ${r20.age} the client can access ${usd(r20.accessibleResources)} (${usd(r20.equity)} equity OR ${usd(r20.availableLOC)} credit line) vs ${usd(r20.homeValue)} with no reverse mortgage. Net worth with the HECM is ${usd(r20.rmNetWorth)} — the ${usd(standbyGap)} difference is the cost of standby liquidity, not lost wealth from borrowing. If the property is sold, the line of credit is no longer available.`;

  const insights: Record<StageView, string> = {
    loc: `Unused credit grows from ${usd(result.remainingCredit)} today to about ${usd(r85.availableLOC)} by age ${r85.age} — even if the home's value never changes.`,
    networth: `Net worth with the HECM (home equity minus loan balance and the cost drag) is ${usd(r85.rmNetWorth)} at age ${r85.age}, vs ${usd(r85.homeValue)} if no reverse mortgage were taken — a ${usd(r85.homeValue - r85.rmNetWorth)} difference from accrued borrowing and costs.`,
    equity: `At age ${r85.age} the home is projected at ${usd(r85.homeValue)} with a ${usd(r85.upb)} loan balance — leaving ${usd(r85.equity)} in equity.`,
    invest: `By age ${r90.age}, investing the proceeds plus remaining equity totals ${usd(r90.investmentPlusEquity)}, vs ${usd(r90.equity)} from keeping equity alone.`,
    standby: standbyInsight,
    seqrisk: seqInsight,
    table: 'Draw and Payment cells are editable — type a value and the entire projection updates instantly.',
  };

  return (
    <div className="app v2">
      <header>
        <h1>LendsightAI HECM Simulator</h1>
        <div className="header-actions">
          <button className="view-toggle" onClick={() => setInp(defaultInputs)}>
            Reset
          </button>
          <button className="view-toggle" onClick={goConsumer}>
            Consumer view
          </button>
          <button className="share-btn" onClick={share}>
            {copied ? '✓ Link copied' : 'Share with client'}
          </button>
        </div>
      </header>

      <div className="scenario-bar">
        <span className="scenario-label">Scenario</span>
        <NumberField label="Age" value={inp.age} onChange={(v) => set('age', v)} min={18} max={99} tip="The age of the youngest borrower or eligible non-borrowing spouse. Older ages qualify for a higher PLF." />
        <NumberField label="Home value" value={inp.homeValue} onChange={(v) => set('homeValue', v)} suffix="$" min={0} tip="The appraised value of the home. Value above the HECM lending limit is not counted." />
        <NumberField label="Liens" value={inp.existingLiens} onChange={(v) => set('existingLiens', v)} suffix="$" min={0} tip="Mortgages or liens that must be paid off at closing. These reduce available proceeds." />
        <NumberField label="Cash draw" value={inp.initialCashDraw} onChange={(v) => set('initialCashDraw', v)} suffix="$" min={0} tip="Cash taken at closing, in addition to paying off liens and costs." />
        <button className="assumptions-btn" onClick={() => setDrawerOpen(true)}>
          Assumptions &amp; costs
        </button>
      </div>

      {result.overDraw > 0 && (
        <div className="warning-banner">
          The requested draw exceeds the principal limit by{' '}
          <strong>{usd(result.overDraw)}</strong>. The loan balance has been capped at the
          principal limit; reduce the initial cash draw, liens, or financed costs.
        </div>
      )}

      <section className="hero3">
        <HeroCard
          primary
          label="Total available"
          value={usd(result.principalLimit)}
          note="Principal limit over the life of the loan"
          tip="The total funds available over the life of the loan: home value (up to the HECM limit) × the PLF."
        />
        <HeroCard
          label="Cash available now"
          value={usd(result.availableInitialDraw)}
          note="The most cash accessible in year one"
          tip="The most cash you can access in year one under HUD's first-year disbursement limits (the 60% rule)."
        />
        <HeroCard
          label="Monthly for life"
          value={usd(result.maxTenurePayment)}
          note="Max tenure payment, guaranteed for life"
          tip="The largest fixed monthly payment available for life if you took the proceeds as a tenure payment instead of a lump sum or line of credit."
        />
      </section>

      <div className="stat-strip">
        <Stat label="PLF" value={pct(result.plf, 3)} tip="Principal Limit Factor — the percentage of the home's value (set by HUD from the borrower's age and the expected rate) that can be borrowed." />
        <Stat label="Expected rate" value={pct(result.expectedRate, 3)} tip="The 10-year CMT index plus the lender margin, rounded to the nearest 0.125%. This sets the PLF." />
        <Stat label="Initial rate" value={pct(result.initialRate, 3)} tip="The 1-year CMT index plus the lender margin — the actual interest rate charged in year one." />
        <Stat label="LOC start" value={usd(result.remainingCredit)} tip="Funds still available after the initial draw and costs — the starting line of credit, which grows over time." />
        <Stat label="Initial UPB" value={usd(result.initialUPB)} tip="Initial unpaid principal balance — the starting loan balance, including financed costs, liens paid off, and any initial cash draw." />
        <Stat label="Initial MIP" value={usd(result.initialMIP)} tip="Up-front FHA Mortgage Insurance Premium — 2% of the home's value (up to the HECM limit), paid at closing." />
        <Stat label="Total costs" value={usd(result.totalLoanCost)} tip="All financed closing costs plus the initial MIP — the total cost rolled into the loan." />
      </div>

      <div className="stage">
        <div className="seg">
          {STAGE_TABS.map((t) => (
            <button
              key={t.key}
              className={stage === t.key ? 'active' : ''}
              onClick={() => setStage(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {stage === 'table' ? (
          <ProjectionTableEditable
            projection={result.projection}
            draws={inp.draws}
            payments={inp.payments}
            onChange={(draws, payments) => setInp((p) => ({ ...p, draws, payments }))}
          />
        ) : (
          <Suspense fallback={<div className="chart-loading">Loading chart…</div>}>
            {stage === 'loc' && <LocChart projection={result.projection} />}
            {stage === 'networth' && <NetWorthChart projection={result.projection} />}
            {stage === 'equity' && <HomeEquityChart projection={result.projection} />}
            {stage === 'invest' && <InvestChart projection={result.projection} />}
            {stage === 'standby' && <StandbyChart projection={result.projection} />}
            {stage === 'seqrisk' && (
              <>
                <div className="scenario-bar seq-controls">
                  <NumberField label="Portfolio" value={inp.portfolioValue} onChange={(v) => set('portfolioValue', v)} suffix="$" min={0} tip="The client's investment portfolio at the start of the projection." />
                  <NumberField label="Spending / yr" value={inp.annualSpending} onChange={(v) => set('annualSpending', v)} suffix="$" min={0} tip="Annual withdrawals needed for living expenses, funded from the portfolio — or from the credit line during the bridge years." />
                  <NumberField label="Market drop" value={inp.crashPct} onChange={(v) => set('crashPct', v)} asPercent min={0} max={95} tip="The market decline that hits the portfolio at the start of the projection." />
                  <NumberField label="Recovery return" value={inp.recoveryReturn} onChange={(v) => set('recoveryReturn', v)} asPercent min={-20} max={30} tip="Annual portfolio return during the recovery years. After recovery, the Assumed Inv. Return applies." />
                  <NumberField label="Recovery yrs" value={inp.recoveryYears} onChange={(v) => set('recoveryYears', v)} min={0} max={10} tip="How long the recovery lasts — also the years spending is bridged from the credit line instead of the portfolio." />
                </div>
                <SequenceChart rows={seq.rows} />
                <p className="chart-caption">
                  Illustrative only — models one user-defined market path (a single drop, then
                  recovery), not a Monte Carlo or probabilistic forecast.
                </p>
              </>
            )}
          </Suspense>
        )}

        <p className="chart-insight">{insights[stage]}</p>
      </div>

      {drawerOpen && <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />}
      <aside className={`drawer${drawerOpen ? ' open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="drawer-head">
          <h2>Assumptions &amp; costs</h2>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close">
            ✕
          </button>
        </div>

        <Section title="Appreciation">
          <NumberField label="Assumed Appreciation" value={inp.appreciation} onChange={(v) => set('appreciation', v)} asPercent min={-20} max={20} tip="Annual home-price growth rate used to project future value." />
        </Section>

        <Section title="Rates">
          <div className="live-rates">
            <span className={`live-dot live-${live.status}`} />
            <span className="live-label">
              {live.status === 'loading'
                ? 'Fetching live CMT…'
                : live.status === 'ok'
                  ? `Live CMT · as of ${live.asOf}`
                  : live.status === 'error'
                    ? 'Live CMT unavailable — using manual values'
                    : 'Live CMT'}
            </span>
            <button
              type="button"
              className="live-refresh"
              onClick={refreshLive}
              disabled={live.status === 'loading'}
            >
              {live.status === 'loading' ? '…' : 'Refresh'}
            </button>
          </div>
          <NumberField label="10yr CMT (Expected idx)" value={inp.cmt10yr} onChange={(v) => set('cmt10yr', v)} asPercent min={0} max={20} tip="The 10-year Constant Maturity Treasury rate — the index for the expected rate and PLF. Auto-filled live from FRED on load; you can still type over it." />
          <NumberField label="1yr CMT (Initial idx)" value={inp.cmt1yr} onChange={(v) => set('cmt1yr', v)} asPercent min={0} max={20} tip="The 1-year Constant Maturity Treasury rate — the index for the year-one interest rate. Auto-filled live from FRED on load; you can still type over it." />
          <NumberField label="Margin" value={inp.margin} onChange={(v) => set('margin', v)} asPercent min={0} max={10} tip="The lender's margin, added to the index to determine the interest rate." />
          <NumberField label="Annual MIP" value={inp.annualMIP} onChange={(v) => set('annualMIP', v)} asPercent min={0} max={5} tip="The ongoing FHA Mortgage Insurance Premium rate charged each year on the loan balance (currently 0.5%)." />
          <SelectField label="Rate Scenario" value={inp.rateScenario} options={RATE_SCENARIOS} onChange={(v) => set('rateScenario', v)} tip="Stress-test how the balance, credit line, and total principal limit grow: flat at the projected rate, shocked up or down 2%, or replaying actual 1-year CMT rates from 1986 forward." />
        </Section>

        <Section title="Investment Comparison">
          <NumberField label="Assumed Inv. Return" value={inp.investmentReturn} onChange={(v) => set('investmentReturn', v)} asPercent min={-20} max={30} tip="Annual return assumed for the 'invest the proceeds' comparison and the opportunity cost of out-of-pocket costs." />
          <NumberField label="Tax on Sold Assets" value={inp.taxRateOnSoldAssets} onChange={(v) => set('taxRateOnSoldAssets', v)} asPercent min={0} max={95} tip="The tax rate applied when liquidating invested assets, used in the after-tax comparison. Default is the 15% long-term capital gains rate." />
        </Section>

        <Section title="Limits & Future PLF">
          <NumberField label="HECM Limit" value={inp.hecmLimit} onChange={(v) => set('hecmLimit', v)} suffix="$" min={0} tip="The FHA maximum claim amount. Home value above this is not counted toward the principal limit." />
          <NumberField label="Principal Limit Override" value={inp.principalLimitOverride} onChange={(v) => set('principalLimitOverride', v)} suffix="$" min={0} tip="Enter the exact principal limit from a lender quote to match it to the dollar. Leave at 0 to compute from the HUD PLF table." />
          <NumberField label="Future 10yr CMT" value={inp.futureCMT10yr} onChange={(v) => set('futureCMT10yr', v)} asPercent min={0} max={20} disabled={inp.futureCMTMode !== 'Assumed'} tip="The flat 10-year CMT rate used for the future-PLF columns when Future CMT Source is 'Assumed'. Disabled under 'Historical', which supplies its own year-by-year rates." />
          <SelectField label="Future CMT Source" value={inp.futureCMTMode} options={RATE_MODES} onChange={(v) => set('futureCMTMode', v)} tip="Sets the 10-year CMT rate behind the future principal limit (the PLF a new HECM would offer at each future age). Assumed: applies the single 'Future 10yr CMT' value you enter to every year — one flat rate. Historical: ignores that field and replays actual past 10-year CMT rates, which vary year to year, so the future-PLF columns reflect real rate movement instead of one guess. Only the future-PLF projection changes — the current loan's balance and credit-line growth are unaffected." />
          <NumberField label="Projection Years" value={inp.projectionYears} onChange={(v) => set('projectionYears', v)} min={1} max={38} tip="How many years to project, capped at 38 (the length of the historical data series)." />
          <NumberField label="Beginning Year" value={inp.beginningYear} onChange={(v) => set('beginningYear', v)} min={1900} max={2200} plain tip="The calendar year the loan starts; labels the projection rows." />
        </Section>

        <Section title="Closing Costs">
          <ToggleField label="Finance Costs in Loan?" value={inp.costsInLoan} onChange={(v) => set('costsInLoan', v)} tip="When on, closing costs and the initial MIP are added to the loan balance instead of paid out of pocket." />
          <NumberField label="Counseling (POC)" value={inp.costs.counselingCost} onChange={(v) => setCost('counselingCost', v)} suffix="$" min={0} tip="HUD-required counseling fee, paid out of pocket (POC)." />
          <NumberField label="Appraisal (POC)" value={inp.costs.appraisalPOC} onChange={(v) => setCost('appraisalPOC', v)} suffix="$" min={0} tip="Home appraisal fee, paid out of pocket (POC)." />
          <NumberField label="Origination Discount" value={inp.costs.originationDiscount} onChange={(v) => setCost('originationDiscount', v)} suffix="$" min={0} tip="Any lender credit or discount applied to the calculated origination fee." />
          <NumberField label="Title / Settlement" value={inp.costs.settlementClosing} onChange={(v) => setCost('settlementClosing', v)} suffix="$" min={0} tip="Title and settlement / closing charges." />
          <NumberField label="Other (in loan)" value={inp.costs.other} onChange={(v) => setCost('other', v)} suffix="$" min={0} tip="Any other closing costs financed into the loan." />
        </Section>

        <button className="drawer-done" onClick={() => setDrawerOpen(false)}>
          Done, or Click on Main Page
        </button>
      </aside>

      <Disclaimer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function HeroCard({
  label,
  value,
  note,
  tip,
  primary,
}: {
  label: string;
  value: string;
  note: string;
  tip?: string;
  primary?: boolean;
}) {
  return (
    <div className={`hero-card${primary ? ' hero-card-primary' : ''}`}>
      <span className="hero-card-label">{label}{tip && <InfoTip text={tip} />}</span>
      <span className="hero-card-value">{value}</span>
      <span className="hero-card-note">{note}</span>
    </div>
  );
}

function Stat({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <span className="stat">
      <span className="stat-label">{label}{tip && <InfoTip text={tip} />}</span>
      <span className="stat-value">{value}</span>
    </span>
  );
}
