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
