import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { ProjectionRow } from '../engine';
import type { SequenceRow } from '../engine/sequence';
import type { ComparisonRow } from '../engine/comparison';
import { usd } from '../format';

const fmtK = (n: number) => `$${Math.round(n / 1000)}k`;
const tip = (value: unknown) => usd(Number(value));

const toData = (projection: ProjectionRow[]) =>
  projection.map((r) => ({
    age: r.age,
    homeValue: r.homeValue,
    upb: r.upb,
    equity: r.equity,
    availableLOC: r.availableLOC,
    totalPL: r.totalPL,
    equityOnly: r.equity,
    investmentPlusEquity: r.investmentPlusEquity,
    rmNetWorth: r.rmNetWorth,
    accessibleResources: r.accessibleResources,
  }));

export function HomeEquityChart({ projection }: { projection: ProjectionRow[] }) {
  const data = toData(projection);
  return (
    <ChartCard title="Home Value vs. Loan Balance vs. Equity">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          <Area type="monotone" dataKey="homeValue" name="Home Value" stroke="#4a7c9b" fill="#eef2f5" />
          <Area type="monotone" dataKey="equity" name="Equity" stroke="#5b9f5b" fill="rgba(91,159,91,0.1)" />
          <Area type="monotone" dataKey="upb" name="Loan Balance" stroke="#e07a5f" fill="rgba(224,122,95,0.1)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function LocChart({ projection }: { projection: ProjectionRow[] }) {
  const data = toData(projection);
  return (
    <ChartCard title="Available Line of Credit Growth">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          <Line type="monotone" dataKey="availableLOC" name="Available LOC" stroke="#4a7c9b" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="totalPL" name="Total Principal Limit" stroke="#1b2a4a" dot={false} strokeWidth={2.5} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function InvestChart({ projection }: { projection: ProjectionRow[] }) {
  const data = toData(projection);
  return (
    <ChartCard title="Equity Only vs. Invest-the-Proceeds (after tax)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          <Line type="monotone" dataKey="equityOnly" name="Equity Only" stroke="#5b9f5b" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="investmentPlusEquity" name="Investment + Equity" stroke="#4a7c9b" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="upb" name="Loan Balance" stroke="#e07a5f" dot={false} strokeWidth={2} strokeDasharray="6 4" />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function NetWorthChart({ projection }: { projection: ProjectionRow[] }) {
  const data = toData(projection);
  return (
    <ChartCard title="Net Worth Over Time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          <Line type="monotone" dataKey="rmNetWorth" name="Net Worth with HECM (after costs)" stroke="#5b9f5b" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="homeValue" name="Home Value (No HECM)" stroke="#1b2a4a" dot={false} strokeWidth={2} strokeDasharray="6 4" />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function StandbyChart({
  projection,
  residual,
}: {
  projection: ProjectionRow[];
  residual?: number[];
}) {
  // When the HECM paid off a mortgage, the honest no-HECM baseline is home value
  // net of the still-outstanding mortgage, not gross home value.
  const data = projection.map((r, i) => ({
    age: r.age,
    accessibleResources: r.accessibleResources,
    rmNetWorth: r.rmNetWorth,
    noHecmBaseline: residual ? Math.max(0, r.homeValue - (residual[i] ?? 0)) : r.homeValue,
  }));
  const baselineLabel = residual ? 'Home equity (No HECM, net of mortgage)' : 'Home Value (No HECM)';
  return (
    <ChartCard title="Standby LOC Strategy: Liquidity vs. Net Worth">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          <Line type="monotone" dataKey="accessibleResources" name="Accessible Resources (Equity + LOC)" stroke="#4a7c9b" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="noHecmBaseline" name={baselineLabel} stroke="#1b2a4a" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="rmNetWorth" name="Net Worth with HECM (after costs)" stroke="#e07a5f" dot={false} strokeWidth={2} strokeDasharray="6 4" />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function MortgageComparisonChart({ rows }: { rows: ComparisonRow[] }) {
  const data = rows.map((r) => ({
    age: r.age,
    netWorthHecm: r.netWorthHecm,
    netWorthNoHecm: r.netWorthNoHecm,
  }));
  return (
    <ChartCard title="Net Worth: HECM (mortgage paid off) vs. Keeping the Mortgage">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          <Line type="monotone" dataKey="netWorthHecm" name="Net worth — HECM (mortgage paid off)" stroke="#5b9f5b" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="netWorthNoHecm" name="Net worth — keep the mortgage" stroke="#1b2a4a" dot={false} strokeWidth={2.5} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SequenceChart({ rows }: { rows: SequenceRow[] }) {
  const data = rows.map((r) => ({
    age: r.age,
    portfolioBridge: r.portfolioBridge,
    portfolioSell: r.portfolioSell,
    hecmDebt: r.hecmDebt,
  }));
  return (
    <ChartCard title="Sequence Risk: Bridge Spending from the LOC vs. Sell Assets in a Downturn">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          <Line type="monotone" dataKey="portfolioBridge" name="Portfolio — bridge from LOC" stroke="#5b9f5b" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="portfolioSell" name="Portfolio — sell assets (no HECM)" stroke="#e07a5f" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="hecmDebt" name="HECM loan balance" stroke="#1b2a4a" dot={false} strokeWidth={2} strokeDasharray="6 4" />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <div className="chart-body">{children}</div>
    </div>
  );
}
