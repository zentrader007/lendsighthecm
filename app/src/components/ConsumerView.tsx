import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { SimulationInputs, SimulationResult } from '../engine';
import { residualMortgage } from '../engine/comparison';
import { usd } from '../format';

const fmtK = (n: number) => `$${Math.round(n / 1000)}k`;
const tip = (value: unknown) => usd(Number(value));

export function ConsumerView({
  inputs,
  result,
}: {
  inputs: SimulationInputs;
  result: SimulationResult;
}) {
  const locData = result.projection
    .filter((r) => r.age <= 95)
    .map((r) => ({ age: r.age, loc: r.availableLOC, equity: r.equity }));

  const startLOC = result.remainingCredit;
  const locAt85 = result.projection.find((r) => r.age === 85)?.availableLOC;
  // 20-year horizon for the standby safety-net story (or the last row if shorter).
  const r20 = result.projection[Math.min(20, result.projection.length - 1)];
  // When the HECM paid off a mortgage, the honest no-HECM baseline is home value
  // net of the still-outstanding mortgage, not gross home value.
  const hasLien = inputs.existingLiens > 0;
  const residual20 = hasLien
    ? residualMortgage(inputs.existingLiens, inputs.existingLienRate, inputs.existingLienTermRemaining, r20.year)
    : 0;
  const noHecmBaseline = Math.max(0, r20.homeValue - residual20);
  const standbyCost = noHecmBaseline - r20.rmNetWorth;

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
        <h2>Your line of credit grows over time</h2>
        <p className="consumer-chart-sub">
          One of the most powerful features: any money you don't use stays in a line of credit that
          grows automatically — giving you more access as you age.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={locData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="locGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4a7c9b" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#4a7c9b" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
            <XAxis dataKey="age" tick={{ fontSize: 13, fontFamily: 'DM Mono, monospace' }} label={{ value: 'Your age', position: 'insideBottom', offset: -2, fontSize: 12 }} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 13, fontFamily: 'DM Mono, monospace' }} width={56} />
            <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
            <Area type="monotone" dataKey="loc" name="Available line of credit" stroke="#4a7c9b" strokeWidth={2.5} fill="url(#locGrad)" />
          </AreaChart>
        </ResponsiveContainer>
        {locAt85 != null && (
          <p className="consumer-callout">
            Your starting line of credit of <strong>{usd(startLOC)}</strong> could grow to about{' '}
            <strong>{usd(locAt85)}</strong> by age 85 — even if your home value never changes.
          </p>
        )}
      </section>

      <section className="consumer-chart-card">
        <h2>A safety net that grows — even if you never use it</h2>
        <p className="consumer-chart-sub">
          Many homeowners open a reverse mortgage line of credit and simply let it sit as an
          emergency fund. Here is what that standby safety net looks like for you, twenty years
          from now.
        </p>
        <div className="consumer-standby-stats">
          <div className="consumer-standby-stat">
            <span className="consumer-standby-label">
              Total you could potentially access at age {r20.age}
            </span>
            <span className="consumer-standby-value">{usd(r20.accessibleResources)}</span>
            <span className="consumer-standby-note">
              {usd(r20.equity)} home equity OR {usd(r20.availableLOC)} credit line — not both; selling
              the home to access equity ends the credit line.
            </span>
          </div>
          <div className="consumer-standby-stat">
            <span className="consumer-standby-label">Without a reverse mortgage</span>
            <span className="consumer-standby-value">{usd(noHecmBaseline)}</span>
            <span className="consumer-standby-note">
              {hasLien
                ? `Your home's value (${usd(r20.homeValue)}) minus the roughly ${usd(residual20)} still owed on your current mortgage`
                : "Your home's value — accessible only by selling or borrowing against it"}
            </span>
          </div>
          <div className="consumer-standby-stat">
            <span className="consumer-standby-label">Cost of keeping the safety net</span>
            <span className="consumer-standby-value">{usd(standbyCost)}</span>
            <span className="consumer-standby-note">
              The projected difference in net worth at age {r20.age} under these assumptions
            </span>
          </div>
        </div>
        <p className="consumer-callout">
          Think of it like insurance: the cost above is the premium for having{' '}
          <strong>{usd(r20.availableLOC)}</strong> ready at age {r20.age} for health events, home
          repairs, market downturns, or simply peace of mind — without selling your home or asking
          a bank for a new loan when you may no longer qualify.
        </p>
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
