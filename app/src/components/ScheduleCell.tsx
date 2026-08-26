import { useState } from 'react';

const fmt = (n: number) => (n ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '');

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

/** Percent cell: value is stored as a fraction (0.03) and shown as a percent
 *  (3). Accepts negatives and decimals, clamped to [-20%, 20%] on commit. */
export function PercentCell({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const shown = +(value * 100).toFixed(3);
  return (
    <input
      type="text"
      inputMode="decimal"
      className="sc-input sc-input-pct"
      value={editing ? draft : `${shown}%`}
      onFocus={(e) => {
        setDraft(String(shown));
        setEditing(true);
        const el = e.target;
        requestAnimationFrame(() => el.select());
      }}
      onBlur={() => setEditing(false)}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^0-9.\-]/g, '');
        setDraft(cleaned);
        const raw = parseFloat(cleaned);
        const clamped = Number.isNaN(raw) ? 0 : Math.min(20, Math.max(-20, raw));
        onCommit(clamped / 100);
      }}
    />
  );
}
