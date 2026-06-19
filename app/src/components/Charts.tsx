import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot,
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
          <Area type="monotone" dataKey="homeValue" name="Home Value" stroke="#4a7c9b" strokeWidth={2.5} fill="#eef2f5" />
          <Area type="monotone" dataKey="equity" name="Equity" stroke="#5b9f5b" strokeWidth={2.5} fill="rgba(91,159,91,0.1)" />
          <Area type="monotone" dataKey="upb" name="Loan Balance" stroke="#e07a5f" strokeWidth={2.5} fill="rgba(224,122,95,0.1)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function LocChart({
  projection,
  marker,
}: {
  projection: ProjectionRow[];
  marker?: { age: number; availableLOC: number; equity: number };
}) {
  const data = toData(projection);
  return (
    <ChartCard title="Available Line of Credit Growth">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          {/* Equity, styled the same as the Equity vs. Balance tab. */}
          <Area type="monotone" dataKey="equity" name="Equity" stroke="#5b9f5b" strokeWidth={2.5} fill="rgba(91,159,91,0.1)" />
          <Line type="monotone" dataKey="availableLOC" name="Available LOC" stroke="#4a7c9b" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="totalPL" name="Total Principal Limit" stroke="#1b2a4a" dot={false} strokeWidth={2.5} />
          {marker && (
            <>
              <ReferenceLine
                x={marker.age}
                stroke="#1b2a4a"
                strokeDasharray="4 4"
                label={{ value: `Age ${marker.age}`, position: 'top', fontSize: 12, fill: '#1b2a4a', fontFamily: 'DM Mono, monospace' }}
              />
              <ReferenceDot
                x={marker.age}
                y={marker.availableLOC}
                r={4}
                fill="#4a7c9b"
                stroke="#fff"
                label={{ value: fmtK(marker.availableLOC), position: 'right', fontSize: 12, fill: '#4a7c9b', fontFamily: 'DM Mono, monospace' }}
              />
              <ReferenceDot
                x={marker.age}
                y={marker.equity}
                r={4}
                fill="#5b9f5b"
                stroke="#fff"
                label={{ value: fmtK(marker.equity), position: 'right', fontSize: 12, fill: '#5b9f5b', fontFamily: 'DM Mono, monospace' }}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function InvestChart({ projection }: { projection: ProjectionRow[] }) {
  const data = toData(projection);
  return (
    <ChartCard title="Equity Only vs. Invest-the-Proceeds (after tax)">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          {/* Shade the headline "invest the proceeds" outcome; draw Equity Only
              on top as a clean line so it stays visible over the fill. */}
          <Area type="monotone" dataKey="investmentPlusEquity" name="Investment + Equity" stroke="#4a7c9b" strokeWidth={2.5} fill="rgba(74,124,155,0.1)" />
          <Line type="monotone" dataKey="equityOnly" name="Equity Only" stroke="#5b9f5b" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="upb" name="Loan Balance" stroke="#e07a5f" dot={false} strokeWidth={2} strokeDasharray="6 4" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

const NET_WORTH_LEGEND = [
  { name: 'Net Worth with HECM (after costs)', color: '#5b9f5b', dashed: false },
  { name: 'Cash drawn at closing', color: '#d4854a', dashed: true },
  { name: 'Home Value (No HECM)', color: '#1b2a4a', dashed: true },
];

/** Centered legend rendered in an explicit order (recharts otherwise reorders). */
function OrderedLegend({ items }: { items: typeof NET_WORTH_LEGEND }) {
  return (
    <ul
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '4px 18px',
        listStyle: 'none',
        margin: 0,
        padding: 0,
        fontSize: 12,
        fontFamily: 'DM Mono, monospace',
        color: '#1b2a4a',
      }}
    >
      {items.map((it) => (
        <li key={it.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 16,
              height: 0,
              borderTop: `2px ${it.dashed ? 'dashed' : 'solid'} ${it.color}`,
              display: 'inline-block',
            }}
          />
          {it.name}
        </li>
      ))}
    </ul>
  );
}

export function NetWorthChart({
  projection,
  cashAtClosing = 0,
}: {
  projection: ProjectionRow[];
  cashAtClosing?: number;
}) {
  const data = toData(projection).map((d) => ({ ...d, cashAtClosing }));
  return (
    <ChartCard title="Net Worth Over Time">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          {/* Custom legend so "Available cash at closing" sits next to the
              net-worth key (recharts' default legend orders by dataKey). */}
          <Legend content={() => <OrderedLegend items={NET_WORTH_LEGEND} />} />
          {/* Shade only the net-worth area (matching the Equity chart's style);
              the two dashed reference lines stay unfilled to keep it readable. */}
          <Area type="monotone" dataKey="rmNetWorth" name="Net Worth with HECM (after costs)" stroke="#5b9f5b" strokeWidth={2.5} fill="rgba(91,159,91,0.1)" />
          <Line type="monotone" dataKey="homeValue" name="Home Value (No HECM)" stroke="#1b2a4a" dot={false} strokeWidth={2} strokeDasharray="6 4" />
          <Line type="monotone" dataKey="cashAtClosing" name="Cash drawn at closing" stroke="#d4854a" dot={false} strokeWidth={2} strokeDasharray="2 4" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function StandbyChart({ projection }: { projection: ProjectionRow[] }) {
  // Pure liquidity story: the two distinct ways the client can reach cash — borrow
  // against the growing line of credit (without selling) or sell for the equity.
  // These are alternatives, not a sum, so they are plotted as separate lines. Net
  // worth (and any lien the HECM paid off) lives on the Net worth tab.
  const data = projection.map((r) => ({
    age: r.age,
    availableLOC: r.availableLOC,
    equity: r.equity,
  }));
  return (
    <ChartCard title="Standby LOC Strategy: Liquidity You Can Tap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          <Line type="monotone" dataKey="availableLOC" name="Available credit line (borrow, don't sell)" stroke="#4a7c9b" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="equity" name="Home equity (access by selling)" stroke="#5b9f5b" dot={false} strokeWidth={2.5} />
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
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          {/* Shade the headline strategy (bridge from LOC); draw the sell-assets
              baseline on top as a clean line. HECM debt stays dashed/unfilled. */}
          <Area type="monotone" dataKey="portfolioBridge" name="Portfolio — bridge from LOC" stroke="#5b9f5b" strokeWidth={2.5} fill="rgba(91,159,91,0.1)" />
          <Line type="monotone" dataKey="portfolioSell" name="Portfolio — sell assets (no HECM)" stroke="#e07a5f" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="hecmDebt" name="HECM loan balance" stroke="#1b2a4a" dot={false} strokeWidth={2} strokeDasharray="6 4" />
        </ComposedChart>
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
