import { useMemo, useState } from 'react';
import type { SimulationInputs, SimulationResult } from '../engine';
import { runMortgageComparison } from '../engine/comparison';
import {
  LocChart,
  HomeEquityChart,
  NetWorthChart,
  StandbyChart,
  MortgageComparisonChart,
} from './Charts';
import { usd } from '../format';

type ConsumerStage = 'loc' | 'networth' | 'equity' | 'standby';

const CONSUMER_TABS: readonly { key: ConsumerStage; label: string }[] = [
  { key: 'loc', label: 'Credit line growth' },
  { key: 'networth', label: 'Net worth' },
  { key: 'equity', label: 'Equity vs balance' },
  { key: 'standby', label: 'Standby LOC' },
];

export function ConsumerView({
  inputs,
  result,
}: {
  inputs: SimulationInputs;
  result: SimulationResult;
}) {
  const [stage, setStage] = useState<ConsumerStage>('loc');

  // Every figure below is read from the same runSimulation(inp) result the
  // advisor view uses, so the two views can never disagree on the numbers.
  const rowAt = (age: number) =>
    result.projection.find((r) => r.age >= age) ?? result.projection[result.projection.length - 1];
  const r85 = rowAt(85);
  // 20-year horizon for the standby safety-net story (or the last row if shorter).
  const r20 = result.projection[Math.min(20, result.projection.length - 1)];
  const startLOC = result.remainingCredit;

  // Lien-aware net-worth comparison (only meaningful when a mortgage is paid off),
  // identical to the advisor's Net worth tab.
  const hasLien = inputs.existingLiens > 0;
  const cmp = useMemo(() => runMortgageComparison(inputs), [inputs]);
  const cmpLast = cmp.rows[cmp.rows.length - 1];

  const insights: Record<ConsumerStage, string> = {
    loc: `Your starting line of credit of ${usd(startLOC)} could grow to about ${usd(r85.availableLOC)} by age ${r85.age} — even if your home's value never changes.`,
    networth: hasLien
      ? `By age ${cmpLast.age}, using the reverse mortgage to pay off your ${usd(inputs.existingLiens)} mortgage leaves a projected net worth of ${usd(cmpLast.netWorthHecm)}, versus ${usd(cmpLast.netWorthNoHecm)} if you keep your current mortgage — because the reverse mortgage removes your monthly payment.`
      : `With the reverse mortgage, your projected net worth (home equity minus the loan balance and costs) is ${usd(r85.rmNetWorth)} at age ${r85.age}, versus ${usd(r85.homeValue)} in home value if you took no reverse mortgage. The difference is the cost of the borrowing and the loan's growth over time.`,
    equity: `At age ${r85.age} your home is projected at ${usd(r85.homeValue)} with a ${usd(r85.upb)} loan balance — leaving ${usd(r85.equity)} in equity for you or your heirs.`,
    standby: `Left untouched, your line of credit grows to ${usd(r20.availableLOC)} by age ${r20.age} — money you can borrow without selling your home — versus ${usd(r20.equity)} of equity you could reach by selling instead. Drawing on the line adds to the loan balance, and if you sell the home the line is no longer available.`,
  };

  return (
    <div className="consumer">
      <div className="consumer-hero">
        <span className="consumer-brand">LendsightAI</span>
        <h1>Your Reverse Mortgage Estimate</h1>
        <p className="consumer-sub">
          Based on a home valued at <strong>{usd(inputs.homeValue)}</strong> and a starting age of{' '}
          <strong>{inputs.age}</strong>, here is what a Home Equity Conversion Mortgage could make
          available to you.
        </p>
      </div>

      <div className="consumer-cards">
        <BigCard
          label="Cash you can take at closing"
          value={usd(result.availableInitialDraw)}
          note="Available right away in year one"
          primary
        />
        <BigCard
          label="Total funds available"
          value={usd(result.principalLimit)}
          note="The most you can borrow over the life of the loan"
        />
        <BigCard
          label="Monthly income for life"
          value={usd(result.maxTenurePayment)}
          note="If you take it as a lifetime monthly payment instead"
        />
        <BigCard
          label="Line of credit that grows"
          value={usd(result.remainingCredit)}
          note="Unused funds grow larger every year"
        />
      </div>

      <section className="consumer-chart-card">
        <h2>Explore your estimate</h2>
        <p className="consumer-chart-sub">
          Use the tabs to see your line of credit growth, net worth, home equity, and standby
          safety net — all built from the same numbers above.
        </p>
        <div className="seg consumer-seg">
          {CONSUMER_TABS.map((t) => (
            <button
              key={t.key}
              className={stage === t.key ? 'active' : ''}
              onClick={() => setStage(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {stage === 'loc' && <LocChart projection={result.projection} consumer />}
        {stage === 'networth' &&
          (hasLien ? (
            <MortgageComparisonChart rows={cmp.rows} consumer />
          ) : (
            <NetWorthChart
              projection={result.projection}
              cashAtClosing={inputs.initialCashDraw}
              consumer
            />
          ))}
        {stage === 'equity' && <HomeEquityChart projection={result.projection} consumer />}
        {stage === 'standby' && <StandbyChart projection={result.projection} consumer />}

        <p className="consumer-callout">{insights[stage]}</p>
      </section>

      <section className="consumer-explain">
        <h2>What this means for you</h2>
        <ul>
          <li>
            <strong>You keep your home.</strong> You remain the owner and continue living there. The
            loan is repaid when you sell or leave.
          </li>
          <li>
            <strong>No monthly mortgage payments are required.</strong> You stay responsible for
            property taxes, insurance, and upkeep.
          </li>
          <li>
            <strong>Flexible access.</strong> Take cash up front, a steady monthly amount, a growing
            line of credit, or any combination.
          </li>
          <li>
            <strong>It is a non-recourse loan.</strong> You or your heirs will never owe more than
            the home is worth when the loan comes due.
          </li>
        </ul>
      </section>

      <footer className="consumer-footer">
        <p>
          This is an illustration prepared for educational purposes and is not a loan offer,
          commitment to lend, or financial advice. Figures are estimates based on the assumptions
          shown and current program limits; your actual terms will depend on rates, fees, and HUD
          guidelines at the time of application. Please consult a HUD-approved counselor and a
          licensed mortgage professional before making any decision.
        </p>
        <p className="consumer-prepared">Prepared with LendsightAI · Certified Liability Advisor</p>
      </footer>
    </div>
  );
}

function BigCard({
  label,
  value,
  note,
  primary,
}: {
  label: string;
  value: string;
  note: string;
  primary?: boolean;
}) {
  return (
    <div className={`consumer-card${primary ? ' consumer-card-primary' : ''}`}>
      <span className="consumer-card-label">{label}</span>
      <span className="consumer-card-value">{value}</span>
      <span className="consumer-card-note">{note}</span>
    </div>
  );
}
