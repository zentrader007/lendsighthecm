import { useState } from 'react';
import { InfoTip } from './InfoTip';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
  asPercent?: boolean; // store as fraction, display as %
  min?: number; // in display units (e.g. percent, not fraction)
  max?: number;
  disabled?: boolean;
  tip?: string;
  plain?: boolean; // no thousands grouping (e.g. calendar years)
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  asPercent,
  min,
  max,
  disabled,
  tip,
  plain,
}: NumberFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const numeric = asPercent ? +(value * 100).toFixed(4) : value;
  const formatted = Number.isNaN(numeric)
    ? ''
    : numeric.toLocaleString('en-US', { maximumFractionDigits: 4, useGrouping: !plain });

  // Commit a clamped value (min/max are in display units). Empty stays at min ?? 0.
  const commit = () => {
    const raw = parseFloat(draft);
    let display = Number.isNaN(raw) ? (min ?? 0) : raw;
    if (min != null) display = Math.max(min, display);
    if (max != null) display = Math.min(max, display);
    onChange(asPercent ? display / 100 : display);
  };

  return (
    <label className={`field${disabled ? ' field-disabled' : ''}`}>
      <span>{label}{tip && <InfoTip text={tip} />}</span>
      <div className="field-input">
        {suffix === '$' && <span className="prefix">$</span>}
        <input
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={editing ? draft : formatted}
          onFocus={(e) => {
            setDraft(Number.isNaN(numeric) ? '' : String(numeric));
            setEditing(true);
            const el = e.target;
            requestAnimationFrame(() => el.select());
          }}
          onBlur={() => {
            commit();
            setEditing(false);
          }}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9.\-]/g, '');
            setDraft(cleaned);
            const raw = parseFloat(cleaned);
            // Live update without clamping so intermediate typing feels natural;
            // the value is clamped to [min, max] on blur.
            const v = Number.isNaN(raw) ? 0 : asPercent ? raw / 100 : raw;
            onChange(v);
          }}
        />
        {(asPercent || (suffix && suffix !== '$')) && (
          <span className="suffix">{suffix && suffix !== '$' ? suffix : '%'}</span>
        )}
      </div>
    </label>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  tip?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  tip,
}: SelectFieldProps<T>) {
  return (
    <label className="field">
      <span>{label}{tip && <InfoTip text={tip} />}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ToggleField({
  label,
  value,
  onChange,
  tip,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  tip?: string;
}) {
  return (
    <label className="field field-toggle">
      <span>{label}{tip && <InfoTip text={tip} />}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
