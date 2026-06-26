import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { SimulationInputs } from '../engine';
import { defaultInputs } from '../engine/defaults';
import { runSequenceAnalysis } from '../engine/sequence';
import { runMortgageComparison } from '../engine/comparison';
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
const MortgageComparisonChart = lazy(() =>
  import('../components/Charts').then((m) => ({ default: m.MortgageComparisonChart })),
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
  const [targetAge, setTargetAge] = useState('');
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
      setInp((p) => ({
        ...p,
        cmt10yr: data.cmt10yr,
        cmt1yr: data.cmt1yr,
        ...(data.mortgage30 ? { existingLienRate: data.mortgage30 } : {}),
      }));
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

  // Target-age marker shared by every chart and the Year table. An empty input or
  // an age outside the projection range plots/highlights nothing.
  const firstAge = result.projection[0].age;
  const lastAge = result.projection[result.projection.length - 1].age;
  const targetAgeNum = parseInt(targetAge, 10);
  const targetValid =
    Number.isFinite(targetAgeNum) && targetAgeNum >= firstAge && targetAgeNum <= lastAge;
  const markerAge = targetValid ? targetAgeNum : undefined;
  const atTarget = <T extends { age: number }>(rows: T[]): T | undefined =>
    targetValid ? (rows.find((r) => r.age >= targetAgeNum) ?? rows[rows.length - 1]) : undefined;
  const tRow = atTarget(result.projection);

  // Lien-aware two-world net-worth comparison (only meaningful when a mortgage
  // was paid off). residual[] feeds the honest standby baseline too.
  const hasLien = inp.existingLiens > 0;
  const cmp = useMemo(() => runMortgageComparison(inp), [inp]);
  const cmpLast = cmp.rows[cmp.rows.length - 1];

  const seq = useMemo(() => runSequenceAnalysis(inp), [inp]);
  const seqLast = seq.rows[seq.rows.length - 1];

  // Values at the marked age for the active chart, echoed beside the input.
  const tSeq = atTarget(seq.rows);
  const tCmp = atTarget(cmp.rows);

  // The per-tab footer insights anchor to the marked age when a target is set;
  // otherwise they keep their default horizons (age 85, age 90, the 20-year mark,
  // or the last comparison row).
  const locEqRow = tRow ?? r85;
  const investRow = tRow ?? r90;
  const standbyRow = tRow ?? r20;
  const cmpRow = tCmp ?? cmpLast;
  const targetReadoutFor = (s: StageView) => {
    if (!tRow) return null;
    switch (s) {
      case 'loc':
        return <>{usd(tRow.availableLOC)} available credit · {usd(tRow.equity)} home equity</>;
      case 'networth':
        return hasLien && tCmp ? (
          <>{usd(tCmp.netWorthHecm)} net worth with HECM · {usd(tCmp.netWorthNoHecm)} keeping the mortgage</>
        ) : (
          <>{usd(tRow.rmNetWorth)} net worth with HECM · {usd(tRow.homeValue)} home value (no HECM)</>
        );
      case 'equity':
        return <>{usd(tRow.homeValue)} home value · {usd(tRow.upb)} loan balance · {usd(tRow.equity)} equity</>;
      case 'invest':
        return <>{usd(tRow.investmentPlusEquity)} invest + equity · {usd(tRow.equity)} equity only</>;
      case 'standby':
        return <>{usd(tRow.availableLOC)} credit line · {usd(tRow.equity)} home equity</>;
      case 'seqrisk':
        return tSeq ? <>{usd(tSeq.portfolioBridge)} bridge from LOC · {usd(tSeq.portfolioSell)} sell assets</> : null;
      case 'table':
        return <>row highlighted in the table below</>;
    }
  };
  const targetReadout = targetReadoutFor(stage);
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

  // Standby tab is a pure liquidity story: how much the client can tap via the
  // growing line of credit (without selling) or by selling for the equity. These
  // are alternatives, not a sum. Net-worth questions — including any mortgage the
  // HECM paid off — belong on the Net worth tab.
  const standbyInsight = `Left untouched, the standby line of credit grows to ${usd(standbyRow.availableLOC)} by age ${standbyRow.age} — money the client can borrow without selling the home — versus ${usd(standbyRow.equity)} of equity they'd reach by selling instead. The credit line grows on its own schedule regardless of the home's value, so in a flat market it can outgrow equity. This is standby liquidity, not extra net worth: drawing on the line adds to the loan balance, and if the home is sold the line is no longer available.${inp.existingLiens > 0 ? ' For a like-for-like net-worth comparison that nets out the mortgage the HECM paid off, see the Net worth tab.' : ''}`;

  const networthInsight = hasLien
    ? `Like-for-like at age ${cmpRow.age}: keeping the ${usd(inp.existingLiens)} mortgage, net worth is ${usd(cmpRow.netWorthNoHecm)} (${usd(cmpRow.homeEquityNoHecm)} home equity + ${usd(cmpRow.portfolioNoHecm)} portfolio); with the HECM it is ${usd(cmpRow.netWorthHecm)} (${usd(cmpRow.homeEquityHecm)} home equity + ${usd(cmpRow.portfolioHecm)} portfolio). The HECM removes the ${usd(cmp.annualMortgagePayment)}/yr payment — ${inp.freedCashConsumed ? 'spent on lifestyle here, so the gain shows as cash flow, not wealth' : 'kept invested here, so it compounds in the portfolio'}.${cmp.noHecmDepletionAge ? ` Keeping the mortgage, the portfolio runs dry at age ${cmp.noHecmDepletionAge}.` : ''}`
    : `Net worth with the HECM (home equity minus loan balance and the cost drag) is ${usd(locEqRow.rmNetWorth)} at age ${locEqRow.age}, vs ${usd(locEqRow.homeValue)} if no reverse mortgage were taken — a ${usd(locEqRow.homeValue - locEqRow.rmNetWorth)} difference from accrued borrowing and costs.`;

  const insights: Record<StageView, string> = {
    loc: `Unused credit grows from ${usd(result.remainingCredit)} today to about ${usd(locEqRow.availableLOC)} by age ${locEqRow.age} — even if the home's value never changes.`,
    networth: networthInsight,
    equity: `At age ${locEqRow.age} the home is projected at ${usd(locEqRow.homeValue)} with a ${usd(locEqRow.upb)} loan balance — leaving ${usd(locEqRow.equity)} in equity.`,
    invest: `By age ${investRow.age}, investing the proceeds plus remaining equity totals ${usd(investRow.investmentPlusEquity)}, vs ${usd(investRow.equity)} from keeping equity alone.`,
    standby: standbyInsight,
    seqrisk: seqInsight,
    table: 'Draw and Payment cells are editable — type a value and the projection updates instantly. The Investment column compounds the invested proceeds; any closing costs paid out of pocket (rather than financed) are subtracted from its starting balance.',
  };

  // Running total of the itemized third-party / title fees, shown at the foot of
  // that collapsible section.
  const thirdPartyTotal =
    inp.costs.creditReport +
    inp.costs.floodCertification +
    inp.costs.docPrep +
    inp.costs.mersRegistration +
    inp.costs.taxCertFee +
    inp.costs.trustReview +
    inp.costs.settlementClosing +
    inp.costs.ownersTitle +
    inp.costs.lendersTitle +
    inp.costs.titleServices +
    inp.costs.notary +
    inp.costs.recording +
    inp.costs.other;

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
        <Stat label="Total costs" value={usd(result.totalCostAllIn)} tip="The all-in cost of the loan: financed closing costs and the initial MIP, plus out-of-pocket fees (counseling, appraisal, and any other POC items)." />
        <div className="stat-target">
          <span className="stat-target-label">
            Target age
            <InfoTip text="Enter an age to mark it across every chart and highlight that row in the Year table, showing the projected values at that age. Leave blank for no marker." />
          </span>
          <input
            className="stat-target-input"
            type="text"
            inputMode="numeric"
            placeholder="—"
            value={targetAge}
            onChange={(e) => setTargetAge(e.target.value.replace(/[^0-9]/g, ''))}
          />
          {tRow && targetReadout && (
            <span className="target-readout">At age {tRow.age}: {targetReadout}</span>
          )}
        </div>
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
            highlightAge={markerAge}
          />
        ) : (
          <Suspense fallback={<div className="chart-loading">Loading chart…</div>}>
            {stage === 'loc' && <LocChart projection={result.projection} targetAge={markerAge} />}
            {stage === 'networth' &&
              (hasLien ? (
                <>
                  <div className="scenario-bar seq-controls">
                    <NumberField label="Mortgage rate" value={inp.existingLienRate} onChange={(v) => set('existingLienRate', v)} asPercent min={0} max={20} tip="Interest rate on the existing mortgage the HECM paid off. Auto-filled from the live 30yr rate; edit to the client's actual rate." />
                    <NumberField label="Yrs left" value={inp.existingLienTermRemaining} onChange={(v) => set('existingLienTermRemaining', v)} min={0} max={40} tip="Years left on that mortgage at closing — used to amortize the residual balance in the no-HECM world." />
                    <NumberField label="Portfolio" value={inp.portfolioValue} onChange={(v) => set('portfolioValue', v)} suffix="$" min={0} tip="The client's investment portfolio, which funds living spending in both worlds." />
                    <NumberField label="Spending / yr" value={inp.annualSpending} onChange={(v) => set('annualSpending', v)} suffix="$" min={0} tip="Annual living expenses, funded equally in both worlds. The no-HECM world also pays the mortgage from this portfolio." />
                    <ToggleField label="Spend freed payment?" value={inp.freedCashConsumed} onChange={(v) => set('freedCashConsumed', v)} tip="On: the client spends the money the HECM freed up (a lifestyle gain, not wealth). Off: that cash stays invested in the portfolio." />
                  </div>
                  <MortgageComparisonChart rows={cmp.rows} targetAge={markerAge} />
                  <p className="chart-caption">
                    Illustrative, equal-spending comparison: {pct(inp.existingLienRate, 2)} mortgage with{' '}
                    {inp.existingLienTermRemaining} yrs left, {pct(inp.investmentReturn, 1)} portfolio return,{' '}
                    {pct(inp.appreciation, 1)} appreciation. Freed payment is{' '}
                    {inp.freedCashConsumed ? 'spent' : 'invested'}.
                  </p>
                </>
              ) : (
                <NetWorthChart projection={result.projection} cashAtClosing={inp.initialCashDraw} targetAge={markerAge} />
              ))}
            {stage === 'equity' && <HomeEquityChart projection={result.projection} targetAge={markerAge} />}
            {stage === 'invest' && <InvestChart projection={result.projection} targetAge={markerAge} />}
            {stage === 'standby' && <StandbyChart projection={result.projection} targetAge={markerAge} />}
            {stage === 'seqrisk' && (
              <>
                <div className="scenario-bar seq-controls">
                  <NumberField label="Portfolio" value={inp.portfolioValue} onChange={(v) => set('portfolioValue', v)} suffix="$" min={0} tip="The client's investment portfolio at the start of the projection." />
                  <NumberField label="Spending / yr" value={inp.annualSpending} onChange={(v) => set('annualSpending', v)} suffix="$" min={0} tip="Annual withdrawals needed for living expenses, funded from the portfolio — or from the credit line during the bridge years." />
                  <NumberField label="Market drop" value={inp.crashPct} onChange={(v) => set('crashPct', v)} asPercent min={0} max={95} tip="The market decline that hits the portfolio at the start of the projection." />
                  <NumberField label="Recovery return" value={inp.recoveryReturn} onChange={(v) => set('recoveryReturn', v)} asPercent min={-20} max={30} tip="Annual portfolio return during the recovery years. After recovery, the Assumed Inv. Return applies." />
                  <NumberField label="Recovery yrs" value={inp.recoveryYears} onChange={(v) => set('recoveryYears', v)} min={0} max={10} tip="How long the recovery lasts — also the years spending is bridged from the credit line instead of the portfolio." />
                </div>
                <SequenceChart rows={seq.rows} targetAge={markerAge} />
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
          <ToggleField label="Finance Costs in Loan?" value={inp.costsInLoan} onChange={(v) => set('costsInLoan', v)} tip="When on, all closing costs and the initial MIP are added to the loan balance instead of paid out of pocket." />
          <ToggleField label="Finance MIP Only?" value={inp.financeMipOnly} onChange={(v) => set('financeMipOnly', v)} disabled={inp.costsInLoan} tip="When on (and 'Finance Costs in Loan?' is off), only the initial MIP is financed into the loan; all other closing costs are paid out of pocket. Ignored while 'Finance Costs in Loan?' is on, since everything is financed then." />
          <NumberField label="Initial MIP" value={result.initialMIP} onChange={(v) => setCost('initialMipOverride', v)} suffix="$" min={0} tip="Up-front FHA Mortgage Insurance Premium. Auto-calculated at 2% of the max claim amount; type an exact figure to override, or set to 0 to recalculate." />
          <NumberField label="Origination Fee" value={result.calculatedOriginationFee} onChange={(v) => setCost('originationOverride', v)} suffix="$" min={-1} tip="Auto-calculated by the HUD tier formula: 2% of the first $200k of the max claim amount + 1% above, floored at $2,500 and capped at $6,000 (so it is not a flat $6,000 on lower-value homes). Type an exact figure to override — including $0 to waive it — or clear the field to recalculate." />
          <NumberField label="Origination Discount" value={inp.costs.originationDiscount} onChange={(v) => setCost('originationDiscount', v)} suffix="$" min={0} tip="Any lender credit or charge added to the origination fee above." />
          <NumberField label="Counseling (POC)" value={inp.costs.counselingCost} onChange={(v) => setCost('counselingCost', v)} suffix="$" min={0} tip="HUD-required counseling fee, paid out of pocket (POC)." />
          <NumberField label="Appraisal (POC)" value={inp.costs.appraisalPOC} onChange={(v) => setCost('appraisalPOC', v)} suffix="$" min={0} tip="Home appraisal fee, paid out of pocket (POC)." />
          <NumberField label="Other (POC)" value={inp.costs.otherPOCCosts} onChange={(v) => setCost('otherPOCCosts', v)} suffix="$" min={0} tip="Any other fees paid out of pocket (POC) — not financed into the loan." />
        </Section>

        <Section title="Third-Party &amp; Title Fees" collapsible defaultOpen={false}>
          <p className="section-note">
            Itemize a lender quote here. These are financed into the loan when "Finance Costs in
            Loan?" is on; otherwise they're paid out of pocket. Anything without its own line goes
            in "Other."
          </p>
          <NumberField label="Credit Report" value={inp.costs.creditReport} onChange={(v) => setCost('creditReport', v)} suffix="$" min={0} tip="Credit report fee." />
          <NumberField label="Flood Certification" value={inp.costs.floodCertification} onChange={(v) => setCost('floodCertification', v)} suffix="$" min={0} tip="Flood-zone certification fee." />
          <NumberField label="Doc Prep" value={inp.costs.docPrep} onChange={(v) => setCost('docPrep', v)} suffix="$" min={0} tip="Document preparation fee." />
          <NumberField label="MERS Registration" value={inp.costs.mersRegistration} onChange={(v) => setCost('mersRegistration', v)} suffix="$" min={0} tip="MERS registration fee." />
          <NumberField label="Tax Cert Fee" value={inp.costs.taxCertFee} onChange={(v) => setCost('taxCertFee', v)} suffix="$" min={0} tip="Tax certification / tax-service fee." />
          <NumberField label="Trust Review" value={inp.costs.trustReview} onChange={(v) => setCost('trustReview', v)} suffix="$" min={0} tip="Trust or legal-document review fee." />
          <NumberField label="Settlement / Closing" value={inp.costs.settlementClosing} onChange={(v) => setCost('settlementClosing', v)} suffix="$" min={0} tip="Settlement / closing / escrow charges." />
          <NumberField label="Owner's Title" value={inp.costs.ownersTitle} onChange={(v) => setCost('ownersTitle', v)} suffix="$" min={0} tip="Owner's title insurance premium." />
          <NumberField label="Lender's Title" value={inp.costs.lendersTitle} onChange={(v) => setCost('lendersTitle', v)} suffix="$" min={0} tip="Lender's title insurance premium." />
          <NumberField label="Title Services" value={inp.costs.titleServices} onChange={(v) => setCost('titleServices', v)} suffix="$" min={0} tip="Title search / settlement-services fee." />
          <NumberField label="Notary" value={inp.costs.notary} onChange={(v) => setCost('notary', v)} suffix="$" min={0} tip="Notary / signing fee." />
          <NumberField label="Recording" value={inp.costs.recording} onChange={(v) => setCost('recording', v)} suffix="$" min={0} tip="County recording fee." />
          <NumberField label="Other (in loan)" value={inp.costs.other} onChange={(v) => setCost('other', v)} suffix="$" min={0} tip="Any other closing costs not itemized above." />
          <div className="section-total">
            <span>Total: Third-Party &amp; Title Fees</span>
            <span className="total-value">{usd(thirdPartyTotal)}</span>
          </div>
        </Section>

        <button className="drawer-done" onClick={() => setDrawerOpen(false)}>
          Done, or Click on Main Page
        </button>
      </aside>

      <Disclaimer />
    </div>
  );
}

function Section({
  title,
  children,
  collapsible,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!collapsible) {
    return (
      <div className="section">
        <h2>{title}</h2>
        {children}
      </div>
    );
  }
  return (
    <div className="section">
      <button
        type="button"
        className="section-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {title}
        <span className="section-chevron" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && children}
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
