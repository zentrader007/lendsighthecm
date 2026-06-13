import { lazy, Suspense, useState } from 'react';
import type { SimulationInputs } from '../engine';
import { defaultInputs } from '../engine/defaults';
import { NumberField, SelectField, ToggleField } from '../components/Field';
import { InfoTip } from '../components/InfoTip';
import { ScheduleEditor } from '../components/ScheduleEditor';
import { ProjectionTable } from '../components/ProjectionTable';
import { Disclaimer } from '../components/Disclaimer';
import { usd, pct } from '../format';
import { RATE_MODES, RATE_SCENARIOS } from './types';
import type { AdvisorProps } from './types';

const Charts = lazy(() =>
  import('../components/Charts').then((m) => ({ default: m.Charts })),
);

/** The original advisor layout: input sidebar + KPI grid + chart/table tabs. */
export function ClassicAdvisor({
  inp,
  setInp,
  result,
  copied,
  share,
  goConsumer,
  switchLayout,
}: AdvisorProps) {
  const [tab, setTab] = useState<'charts' | 'table'>('charts');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const set = <K extends keyof SimulationInputs>(k: K, v: SimulationInputs[K]) =>
    setInp((p) => ({ ...p, [k]: v }));
  const setCost = (k: keyof SimulationInputs['costs'], v: number) =>
    setInp((p) => ({ ...p, costs: { ...p.costs, [k]: v } }));

  return (
    <div className="app">
      <header>
        <h1>LendsightAI HECM Simulator</h1>
        <div className="header-actions">
          <button className="view-toggle" onClick={() => setInp(defaultInputs)}>
            Reset
          </button>
          <button className="view-toggle" onClick={() => switchLayout('v2')}>
            New layout
          </button>
          <button className="view-toggle" onClick={goConsumer}>
            Consumer view
          </button>
          <button className="share-btn" onClick={share}>
            {copied ? '✓ Link copied' : 'Share with client'}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="inputs">
          <Section title="Client & Property">
            <NumberField label="Age (youngest)" value={inp.age} onChange={(v) => set('age', v)} min={18} max={99} tip="The age of the youngest borrower or eligible non-borrowing spouse. Older ages qualify for a higher PLF." />
            <NumberField label="Home Value" value={inp.homeValue} onChange={(v) => set('homeValue', v)} suffix="$" step={1000} min={0} tip="The appraised value of the home. Value above the HECM lending limit is not counted." />
            <NumberField label="Assumed Appreciation" value={inp.appreciation} onChange={(v) => set('appreciation', v)} asPercent min={-20} max={20} tip="Annual home-price growth rate used to project future value." />
          </Section>

          <Section title="Loan Setup">
            <NumberField label="Existing Liens" value={inp.existingLiens} onChange={(v) => set('existingLiens', v)} suffix="$" step={1000} min={0} tip="Mortgages or liens that must be paid off at closing (mandatory obligations). These reduce available proceeds." />
            <NumberField label="Initial Cash Draw" value={inp.initialCashDraw} onChange={(v) => set('initialCashDraw', v)} suffix="$" step={1000} min={0} tip="Cash taken at closing, in addition to paying off liens and costs." />
            <ToggleField label="Finance Costs in Loan?" value={inp.costsInLoan} onChange={(v) => set('costsInLoan', v)} tip="When on, closing costs and the initial MIP are added to the loan balance instead of paid out of pocket." />
          </Section>

          <Section title="Rates">
            <NumberField label="10yr CMT (Expected idx)" value={inp.cmt10yr} onChange={(v) => set('cmt10yr', v)} asPercent min={0} max={20} tip="The 10-year Constant Maturity Treasury rate — the index used to set the expected rate and the PLF." />
            <NumberField label="1yr CMT (Initial idx)" value={inp.cmt1yr} onChange={(v) => set('cmt1yr', v)} asPercent min={0} max={20} tip="The 1-year Constant Maturity Treasury rate — the index used to set the initial (year-one) interest rate." />
            <NumberField label="Margin" value={inp.margin} onChange={(v) => set('margin', v)} asPercent min={0} max={10} tip="The lender's margin, added to the index to determine the interest rate." />
            <NumberField label="Annual MIP" value={inp.annualMIP} onChange={(v) => set('annualMIP', v)} asPercent min={0} max={5} tip="The ongoing FHA Mortgage Insurance Premium rate charged each year on the loan balance (currently 0.5%)." />
            <SelectField label="Rate Scenario" value={inp.rateScenario} options={RATE_SCENARIOS} onChange={(v) => set('rateScenario', v)} tip="Stress-test how the balance, credit line, and total principal limit grow: flat at the projected rate, shocked up or down 2%, or replaying actual 1-year CMT rates from 1986 forward." />
          </Section>

          <Section title="Investment Comparison">
            <NumberField label="Assumed Inv. Return" value={inp.investmentReturn} onChange={(v) => set('investmentReturn', v)} asPercent min={-20} max={30} tip="Annual return assumed for the 'invest the proceeds' comparison and the opportunity cost of out-of-pocket costs." />
            <NumberField label="Tax on Sold Assets" value={inp.taxRateOnSoldAssets} onChange={(v) => set('taxRateOnSoldAssets', v)} asPercent min={0} max={95} tip="The tax rate applied when liquidating invested assets, used in the after-tax comparison. Default is the 15% long-term capital gains rate." />
          </Section>

          <button className="toggle-advanced" onClick={() => setShowSchedule((s) => !s)}>
            {showSchedule ? '− Hide' : '+ Show'} Draw &amp; Payment Schedule
          </button>

          {showSchedule && (
            <ScheduleEditor
              startAge={inp.age}
              beginningYear={inp.beginningYear}
              draws={inp.draws}
              payments={inp.payments}
              onChange={(draws, payments) => setInp((p) => ({ ...p, draws, payments }))}
            />
          )}

          <button className="toggle-advanced" onClick={() => setShowAdvanced((s) => !s)}>
            {showAdvanced ? '− Hide' : '+ Show'} Advanced (costs, limits, future PLF)
          </button>

          {showAdvanced && (
            <>
              <Section title="Limits & Future PLF">
                <NumberField label="HECM Limit" value={inp.hecmLimit} onChange={(v) => set('hecmLimit', v)} suffix="$" step={1000} min={0} tip="The FHA maximum claim amount. Home value above this is not counted toward the principal limit." />
                <NumberField label="Principal Limit Override" value={inp.principalLimitOverride} onChange={(v) => set('principalLimitOverride', v)} suffix="$" step={100} min={0} tip="Enter the exact principal limit from a lender quote to match it to the dollar. Leave at 0 to compute from the HUD PLF table." />
                <NumberField label="Future 10yr CMT" value={inp.futureCMT10yr} onChange={(v) => set('futureCMT10yr', v)} asPercent min={0} max={20} disabled={inp.futureCMTMode !== 'Assumed'} tip="The flat 10-year CMT rate used for the future-PLF columns when Future CMT Source is 'Assumed'. Disabled under 'Historical', which supplies its own year-by-year rates." />
                <SelectField label="Future CMT Source" value={inp.futureCMTMode} options={RATE_MODES} onChange={(v) => set('futureCMTMode', v)} tip="Sets the 10-year CMT rate behind the future principal limit (the PLF a new HECM would offer at each future age). Assumed: applies the single 'Future 10yr CMT' value you enter to every year — one flat rate. Historical: ignores that field and replays actual past 10-year CMT rates, which vary year to year, so the future-PLF columns reflect real rate movement instead of one guess. Only the future-PLF projection changes — the current loan's balance and credit-line growth are unaffected." />
                <NumberField label="Projection Years" value={inp.projectionYears} onChange={(v) => set('projectionYears', v)} min={1} max={38} tip="How many years to project, capped at 38 (the length of the historical data series)." />
                <NumberField label="Beginning Year" value={inp.beginningYear} onChange={(v) => set('beginningYear', v)} min={1900} max={2200} plain tip="The calendar year the loan starts; labels the projection rows." />
              </Section>
              <Section title="Closing Costs">
                <NumberField label="Counseling (POC)" value={inp.costs.counselingCost} onChange={(v) => setCost('counselingCost', v)} suffix="$" min={0} tip="HUD-required counseling fee, paid out of pocket (POC)." />
                <NumberField label="Appraisal (POC)" value={inp.costs.appraisalPOC} onChange={(v) => setCost('appraisalPOC', v)} suffix="$" min={0} tip="Home appraisal fee, paid out of pocket (POC)." />
                <NumberField label="Origination Discount" value={inp.costs.originationDiscount} onChange={(v) => setCost('originationDiscount', v)} suffix="$" min={0} tip="Any lender credit or discount applied to the calculated origination fee." />
                <NumberField label="Title / Settlement" value={inp.costs.settlementClosing} onChange={(v) => setCost('settlementClosing', v)} suffix="$" min={0} tip="Title and settlement / closing charges." />
                <NumberField label="Other (in loan)" value={inp.costs.other} onChange={(v) => setCost('other', v)} suffix="$" min={0} tip="Any other closing costs financed into the loan." />
              </Section>
            </>
          )}
        </aside>

        <main>
          {result.overDraw > 0 && (
            <div className="warning-banner">
              The requested draw exceeds the principal limit by{' '}
              <strong>{usd(result.overDraw)}</strong>. The loan balance has been capped at the
              principal limit; reduce the initial cash draw, liens, or financed costs.
            </div>
          )}
          <section className="kpis">
            <Kpi label="PLF" value={pct(result.plf, 3)} tip="Principal Limit Factor — the percentage of the home's value (set by HUD from the borrower's age and the expected rate) that can be borrowed." />
            <Kpi label="Principal Limit" value={usd(result.principalLimit)} primary tip="The total funds available over the life of the loan: home value (up to the HECM limit) × the PLF." />
            <Kpi label="Initial UPB" value={usd(result.initialUPB)} tip="Initial unpaid principal balance — the starting loan balance, including financed costs, liens paid off, and any initial cash draw." />
            <Kpi label="Remaining Credit" value={usd(result.remainingCredit)} tip="Funds still available after the initial draw and costs — the starting line of credit, which grows over time." />
            <Kpi label="Avail. Initial Draw" value={usd(result.availableInitialDraw)} tip="The most cash you can access in year one under HUD's first-year disbursement limits (the 60% rule)." />
            <Kpi label="Max Tenure / Mo" value={usd(result.maxTenurePayment)} tip="The largest fixed monthly payment available for life if you took the proceeds as a tenure payment instead of a lump sum or line of credit." />
            <Kpi label="Expected Rate" value={pct(result.expectedRate, 3)} tip="The 10-year CMT index plus the lender margin, rounded to the nearest 0.125%. This sets the PLF." />
            <Kpi label="Initial Rate" value={pct(result.initialRate, 3)} tip="The 1-year CMT index plus the lender margin — the actual interest rate charged in year one." />
            <Kpi label="Initial MIP" value={usd(result.initialMIP)} tip="Up-front FHA Mortgage Insurance Premium — 2% of the home's value (up to the HECM limit), paid at closing." />
            <Kpi label="Total HECM Costs" value={usd(result.totalLoanCost)} tip="All financed closing costs plus the initial MIP — the total cost rolled into the loan." />
          </section>

          <div className="tabs">
            <button className={tab === 'charts' ? 'active' : ''} onClick={() => setTab('charts')}>
              Charts
            </button>
            <button className={tab === 'table' ? 'active' : ''} onClick={() => setTab('table')}>
              Projection Table
            </button>
          </div>

          {tab === 'charts' ? (
            <Suspense fallback={<div className="chart-loading">Loading charts…</div>}>
              <Charts projection={result.projection} />
            </Suspense>
          ) : (
            <ProjectionTable projection={result.projection} />
          )}
          <Disclaimer />
        </main>
      </div>
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

function Kpi({
  label,
  value,
  tip,
  primary,
}: {
  label: string;
  value: string;
  tip?: string;
  primary?: boolean;
}) {
  return (
    <div className={`kpi${primary ? ' kpi-primary' : ''}`}>
      <span className="kpi-label">{label}{tip && <InfoTip text={tip} />}</span>
      <span className="kpi-value">{value}</span>
    </div>
  );
}
