import { useState } from 'react';

const fmt = (n: number) => (n ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '');

/** Per-year draw & payment schedule editor (year 1..N). Beginning-of-year amounts. */
export function ScheduleEditor({
  startAge,
  beginningYear,
  draws,
  payments,
  onChange,
}: {
  startAge: number;
  beginningYear: number;
  draws: number[];
  payments: number[];
  onChange: (draws: number[], payments: number[]) => void;
}) {
  const n = Math.max(draws.length, payments.length);
  const rows = Array.from({ length: n }, (_, i) => i);

  const setDraw = (i: number, v: number) => {
    const next = draws.slice();
    next[i] = v;
    onChange(next, payments);
  };
  const setPayment = (i: number, v: number) => {
    const next = payments.slice();
    next[i] = v;
    onChange(draws, next);
  };

  const clearAll = () => onChange(draws.map(() => 0), payments.map(() => 0));
  const hasAny = draws.some((d) => d) || payments.some((p) => p);

  return (
    <div className="schedule">
      <div className="schedule-head">
        <span>Year-by-year extra draws &amp; payments</span>
        <button type="button" className="schedule-clear" onClick={clearAll} disabled={!hasAny}>
          Clear
        </button>
      </div>
      <div className="schedule-wrap">
        <table className="schedule-table">
          <thead>
            <tr>
              <th>Yr</th>
              <th>Age</th>
              <th>Draw $</th>
              <th>Payment $</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i}>
                <td className="sc-yr">{beginningYear + i + 1}</td>
                <td className="sc-age">{startAge + i + 1}</td>
                <td>
                  <ScheduleCell value={draws[i] ?? 0} onCommit={(v) => setDraw(i, v)} />
                </td>
                <td>
                  <ScheduleCell value={payments[i] ?? 0} onCommit={(v) => setPayment(i, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Compact comma-formatted numeric cell. Commits live; selects all on focus. */
export function ScheduleCell({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  return (
    <input
      type="text"
      inputMode="numeric"
      className="sc-input"
      value={editing ? draft : fmt(value)}
      onFocus={(e) => {
        setDraft(value ? String(value) : '');
        setEditing(true);
        const el = e.target;
        requestAnimationFrame(() => el.select());
      }}
      onBlur={() => setEditing(false)}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^0-9.\-]/g, '');
        setDraft(cleaned);
        const raw = parseFloat(cleaned);
        onCommit(Number.isNaN(raw) ? 0 : Math.max(0, raw));
      }}
    />
  );
}
