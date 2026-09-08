// Small presentational pieces shared by every report page.
import type { ReactNode } from 'react';

export function SectionHead({ eyebrow, title, lede }: { eyebrow?: string; title: string; lede?: ReactNode }) {
  return (
    <div className="rp-section-head">
      {eyebrow && <div className="rp-eyebrow">{eyebrow}</div>}
      <h2 className="rp-h1">{title}</h2>
      {lede && <p className="rp-lede">{lede}</p>}
    </div>
  );
}

export function Tiles({ children, cols }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={`rp-tiles rp-tiles-${cols ?? 3}`}>{children}</div>;
}

export function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: ReactNode;
  tone?: 'primary' | 'green' | 'navy' | 'coral';
}) {
  return (
    <div className={`rp-tile${tone ? ` rp-tile-${tone}` : ''}`}>
      <span className="rp-tile-label">{label}</span>
      <span className="rp-tile-value">{value}</span>
      {note && <span className="rp-tile-note">{note}</span>}
    </div>
  );
}

export function Callout({ children, tone }: { children: ReactNode; tone?: 'green' | 'navy' | 'primary' }) {
  return <p className={`rp-callout${tone ? ` rp-callout-${tone}` : ''}`}>{children}</p>;
}

/** A chart from components/Charts.tsx, boxed to the report's fixed height. */
export function ChartBox({ children }: { children: ReactNode }) {
  return <div className="rp-chart">{children}</div>;
}

export function Panel({ head, tone, children }: { head: string; tone?: 'green' | 'navy'; children: ReactNode }) {
  return (
    <div className={`rp-panel${tone ? ` rp-panel-${tone}` : ''}`}>
      <div className="rp-panel-head">{head}</div>
      {children}
    </div>
  );
}

export function Line({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="rp-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
