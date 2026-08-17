import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
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
import type { SpendingRow } from '../engine/spending';
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
    equityOnly: r.equity,
    investmentPlusEquity: r.investmentPlusEquity,
    rmNetWorth: r.rmNetWorth,
    accessibleResources: r.accessibleResources,
  }));

// Target-age marker shared by every chart: a vertical guide line at the chosen
// age plus a labelled dot on each series. These are helper functions (not
// components) so the returned elements keep their ReferenceLine / ReferenceDot
// type — recharts only recognises those as direct children of the chart.
function atAge<T extends { age: number }>(data: T[], targetAge?: number): T | undefined {
  if (targetAge == null || !data.length) return undefined;
  if (targetAge < data[0].age || targetAge > data[data.length - 1].age) return undefined;
  return data.find((d) => d.age >= targetAge) ?? data[data.length - 1];
}

// yAxisId is only needed on multi-axis charts (e.g. AvailableSpendingChart), so
// the value maps to the right scale; single-axis charts omit it.
const markerLine = (age: number, yAxisId?: string) => (
  <ReferenceLine
    x={age}
    yAxisId={yAxisId}
    stroke="#1b2a4a"
    strokeDasharray="4 4"
    label={{ value: `Age ${age}`, position: 'top', fontSize: 12, fontWeight: 700, fill: '#1b2a4a', fontFamily: 'DM Mono, monospace' }}
  />
);

// The dot's value label is drawn just above-right of the dot with a white halo
// (paint-order stroke) so it stays legible where it crosses a chart line.
type DotViewBox = { cx?: number; cy?: number; x?: number; y?: number; width?: number; height?: number };
const markerDot = (age: number, y: number, color: string, yAxisId?: string) => (
  <ReferenceDot
    x={age}
    y={y}
    yAxisId={yAxisId}
    r={4}
    fill={color}
    stroke="#fff"
    label={(p: { viewBox?: DotViewBox }) => {
      const vb = p.viewBox ?? {};
      const cx = vb.cx ?? (vb.x ?? 0) + (vb.width ?? 0) / 2;
      const cy = vb.cy ?? (vb.y ?? 0) + (vb.height ?? 0) / 2;
      return (
        <text
          x={cx + 6}
          y={cy - 9}
          fontSize={12}
          fontWeight={700}
          fontFamily="DM Mono, monospace"
          fill={color}
          stroke="#fff"
          strokeWidth={3}
          paintOrder="stroke"
          textAnchor="start"
        >
          {fmtK(y)}
        </text>
      );
    }}
  />
);

// A highlight marker that reads a word label (not a dollar figure): a solid dot
// with a centered caption. Used for the net-worth break-even and the "savings
// run dry" points, where the age it happens is the story, not the amount. `dy`
// nudges the caption above (negative) or below (positive) the dot so stacked
// markers don't collide.
const labelDot = (age: number, y: number, color: string, text: string, dy = -12) => (
  <ReferenceDot
    x={age}
    y={y}
    r={5}
    fill={color}
    stroke="#fff"
    strokeWidth={2}
    label={(p: { viewBox?: DotViewBox }) => {
      const vb = p.viewBox ?? {};
      const cx = vb.cx ?? (vb.x ?? 0) + (vb.width ?? 0) / 2;
      const cy = vb.cy ?? (vb.y ?? 0) + (vb.height ?? 0) / 2;
      return (
        <text
          x={cx}
          y={cy + dy}
          fontSize={12}
          fontWeight={700}
          fontFamily="DM Mono, monospace"
          fill={color}
          stroke="#fff"
          strokeWidth={3}
          paintOrder="stroke"
          textAnchor="middle"
        >
          {text}
        </text>
      );
    }}
  />
);

export function HomeEquityChart({ projection, targetAge, consumer }: { projection: ProjectionRow[]; targetAge?: number; consumer?: boolean }) {
  const data = toData(projection);
  const m = atAge(data, targetAge);
  return (
    <ChartCard title={consumer ? 'Your home value, loan balance, and equity' : 'Home Value vs. Loan Balance vs. Equity'}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 24, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          <Area type="monotone" dataKey="homeValue" name="Home Value" stroke="#4a7c9b" strokeWidth={2.5} fill="#eef2f5" />
          <Area type="monotone" dataKey="equity" name="Equity" stroke="#5b9f5b" strokeWidth={2.5} fill="rgba(91,159,91,0.1)" />
          <Area type="monotone" dataKey="upb" name="Loan Balance" stroke="#e07a5f" strokeWidth={2.5} fill="rgba(224,122,95,0.1)" />
          {m && (
            <>
              {markerLine(m.age)}
              {markerDot(m.age, m.homeValue, '#4a7c9b')}
              {markerDot(m.age, m.equity, '#5b9f5b')}
              {markerDot(m.age, m.upb, '#e07a5f')}
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function LocChart({ projection, targetAge, consumer }: { projection: ProjectionRow[]; targetAge?: number; consumer?: boolean }) {
  const data = toData(projection);
  const m = atAge(data, targetAge);
  return (
    <ChartCard title={consumer ? 'Your line of credit grows over time' : 'Available Line of Credit Growth'}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 24, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          {/* Equity, styled the same as the Equity vs. Balance tab. */}
          <Area type="monotone" dataKey="equity" name={consumer ? 'Home equity' : 'Equity'} stroke="#5b9f5b" strokeWidth={2.5} fill="rgba(91,159,91,0.1)" />
          <Line type="monotone" dataKey="availableLOC" name={consumer ? 'Available line of credit' : 'Available LOC'} stroke="#4a7c9b" dot={false} strokeWidth={2.5} />
          {m && (
            <>
              {markerLine(m.age)}
              {markerDot(m.age, m.availableLOC, '#4a7c9b')}
              {markerDot(m.age, m.equity, '#5b9f5b')}
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function InvestChart({ projection, targetAge }: { projection: ProjectionRow[]; targetAge?: number }) {
  const data = toData(projection);
  const m = atAge(data, targetAge);
  return (
    <ChartCard title="Equity Only vs. Invest the Cash Drawn (after tax)">
      <div className="chart-caveat-overlay">
        <strong>Illustration only.</strong> In most cases you should not remove home equity to
        invest — not a recommendation to borrow in order to invest.
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 24, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          {/* Shade the headline "invest the proceeds" outcome; draw Equity Only
              on top as a clean line so it stays visible over the fill. */}
          <Area type="monotone" dataKey="investmentPlusEquity" name="Investment + Equity" stroke="#4a7c9b" strokeWidth={2.5} fill="rgba(74,124,155,0.1)" />
          <Line type="monotone" dataKey="equityOnly" name="Equity Only" stroke="#5b9f5b" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="upb" name="Loan Balance" stroke="#e07a5f" dot={false} strokeWidth={2} strokeDasharray="6 4" />
          {m && (
            <>
              {markerLine(m.age)}
              {markerDot(m.age, m.investmentPlusEquity, '#4a7c9b')}
              {markerDot(m.age, m.equityOnly, '#5b9f5b')}
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function MortgageComparisonChart({ rows, targetAge, consumer, noLien, breakEvenAge, noHecmDepletionAge, hecmDepletionAge }: { rows: ComparisonRow[]; targetAge?: number; consumer?: boolean; noLien?: boolean; breakEvenAge?: number; noHecmDepletionAge?: number; hecmDepletionAge?: number }) {
  const data = rows.map((r) => ({
    age: r.age,
    netWorthHecm: r.netWorthHecm,
    netWorthNoHecm: r.netWorthNoHecm,
  }));
  const m = atAge(data, targetAge);
  const be = atAge(data, breakEvenAge);
  // "Savings run dry": the age each world's liquid portfolio is exhausted (the
  // net-worth line is all home equity past this point). The freed mortgage
  // payment is exactly why the two ages differ.
  const dryNo = atAge(data, noHecmDepletionAge);
  const dryHecm = atAge(data, hecmDepletionAge);
  const dryLabel = (age: number) => `${consumer ? 'Savings run out' : 'Savings dry'} · age ${age}`;
  // Without a mortgage to pay off, the baseline is "do nothing" rather than
  // "keep the mortgage", so the title and the no-HECM line are relabeled.
  const title = noLien
    ? consumer
      ? 'Your net worth: with vs. without a reverse mortgage'
      : 'Net Worth Over Time: With HECM vs. Without'
    : consumer
      ? 'Net worth: reverse mortgage vs. keeping your mortgage'
      : 'Net Worth: HECM (mortgage paid off) vs. Keeping the Mortgage';
  const hecmName = consumer ? 'With the reverse mortgage' : noLien ? 'Net worth — with HECM' : 'Net worth — HECM (mortgage paid off)';
  const noHecmName = noLien
    ? consumer
      ? 'Without a reverse mortgage'
      : 'Net worth — no reverse mortgage'
    : consumer
      ? 'Keeping your mortgage'
      : 'Net worth — keep the mortgage';
  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 24, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          <Line type="monotone" dataKey="netWorthHecm" name={hecmName} stroke="#5b9f5b" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="netWorthNoHecm" name={noHecmName} stroke="#1b2a4a" dot={false} strokeWidth={2.5} />
          {/* Break-even: the age the HECM line overtakes the baseline. Drawn
              first so the target-age marker (if any) sits on top of it. */}
          {be && breakEvenAge != null && (
            <>
              <ReferenceLine x={breakEvenAge} stroke="#c9820a" strokeDasharray="2 3" strokeWidth={1.5} />
              {labelDot(breakEvenAge, be.netWorthHecm, '#c9820a', `Break-even · age ${breakEvenAge}`)}
            </>
          )}
          {/* Savings-run-dry markers on each line, captioned below the dot so
              they clear the value labels above. */}
          {dryNo && noHecmDepletionAge != null && labelDot(noHecmDepletionAge, dryNo.netWorthNoHecm, '#b23a3a', dryLabel(noHecmDepletionAge), 20)}
          {dryHecm && hecmDepletionAge != null && labelDot(hecmDepletionAge, dryHecm.netWorthHecm, '#b23a3a', dryLabel(hecmDepletionAge), 20)}
          {m && (
            <>
              {markerLine(m.age)}
              {markerDot(m.age, m.netWorthHecm, '#5b9f5b')}
              {markerDot(m.age, m.netWorthNoHecm, '#1b2a4a')}
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SequenceChart({ rows, targetAge }: { rows: SequenceRow[]; targetAge?: number }) {
  const data = rows.map((r) => ({
    age: r.age,
    portfolioBridge: r.portfolioBridge,
    portfolioSell: r.portfolioSell,
    hecmDebt: r.hecmDebt,
  }));
  const m = atAge(data, targetAge);
  return (
    <ChartCard title="Sequence Risk: Bridge Spending from the LOC vs. Sell Assets in a Downturn">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 24, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace' }} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          {/* Shade the headline strategy (bridge from LOC); draw the sell-assets
              baseline on top as a clean line. HECM debt stays dashed/unfilled. */}
          <Area type="monotone" dataKey="portfolioBridge" name="Portfolio — bridge from LOC" stroke="#5b9f5b" strokeWidth={2.5} fill="rgba(91,159,91,0.1)" />
          <Line type="monotone" dataKey="portfolioSell" name="Portfolio — sell assets (no HECM)" stroke="#e07a5f" dot={false} strokeWidth={2.5} />
          <Line type="monotone" dataKey="hecmDebt" name="HECM loan balance" stroke="#1b2a4a" dot={false} strokeWidth={2} strokeDasharray="6 4" />
          {m && (
            <>
              {markerLine(m.age)}
              {markerDot(m.age, m.portfolioBridge, '#5b9f5b')}
              {markerDot(m.age, m.portfolioSell, '#e07a5f')}
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function AvailableSpendingChart({
  rows,
  targetAge,
  consumer,
  showBalance,
}: {
  rows: SpendingRow[];
  targetAge?: number;
  consumer?: boolean;
  showBalance?: boolean;
}) {
  const data = rows.map((r) => ({
    age: r.age,
    lumpSum: r.lumpSum,
    freedCashFlow: r.freedCashFlow,
    cumulative: r.cumulative,
    loanBalance: r.loanBalance,
  }));
  const m = atAge(data, targetAge);
  return (
    <ChartCard title={consumer ? 'The new spending this makes available' : 'Available Spending: Lump Sum + Freed Cash Flow'}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 24, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="age" tick={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace' }} />
          {/* Left axis: the per-year amounts (bars). Right axis: the running total
              and the loan balance, which dwarf the annual bars. */}
          <YAxis yAxisId="left" tickFormatter={fmtK} tick={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace' }} width={56} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={fmtK} tick={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace' }} width={56} />
          <Tooltip formatter={tip} labelFormatter={(l) => `Age ${l}`} />
          <Legend />
          <Bar yAxisId="left" dataKey="lumpSum" name={consumer ? 'Cash at closing' : 'Lump sum (at closing)'} stackId="a" fill="#4a7c9b" />
          <Bar yAxisId="left" dataKey="freedCashFlow" name={consumer ? 'Freed-up payment (per year)' : 'Freed cash flow (per year)'} stackId="a" fill="#5b9f5b" />
          <Line yAxisId="right" type="monotone" dataKey="cumulative" name={consumer ? 'Total made available' : 'Cumulative available'} stroke="#1b2a4a" dot={false} strokeWidth={2.5} />
          {showBalance && (
            <Line yAxisId="right" type="monotone" dataKey="loanBalance" name={consumer ? 'What you owe (loan balance)' : 'Loan balance'} stroke="#e07a5f" dot={false} strokeWidth={2} strokeDasharray="6 4" />
          )}
          {m && (
            <>
              {markerLine(m.age, 'right')}
              {markerDot(m.age, m.cumulative, '#1b2a4a', 'right')}
            </>
          )}
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
