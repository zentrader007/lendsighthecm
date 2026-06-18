// Client-side helper for the live CMT-rate feed (served by /api/cmt).

export interface LiveCMT {
  cmt10yr: number; // decimal, e.g. 0.0438
  cmt1yr: number; // decimal, e.g. 0.0375
  mortgage30?: number; // 30yr fixed mortgage rate (FRED MORTGAGE30US), decimal
  asOf: string; // ISO observation date from FRED, e.g. "2026-06-12"
  source: string;
}

/** Fetch the latest live 10yr & 1yr CMT rates from the serverless proxy. */
export async function fetchLiveCMT(signal?: AbortSignal): Promise<LiveCMT> {
  const res = await fetch('/api/cmt', { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CMT fetch failed (${res.status})`);
  const data = await res.json();
  if (
    typeof data?.cmt10yr !== 'number' ||
    typeof data?.cmt1yr !== 'number' ||
    !Number.isFinite(data.cmt10yr) ||
    !Number.isFinite(data.cmt1yr)
  ) {
    throw new Error('CMT response malformed');
  }
  return data as LiveCMT;
}

/**
 * Pick the most recent numeric value from a FRED `fredgraph.csv` body and
 * return it as a rate decimal plus its date. FRED reports percent (4.38) and
 * marks non-trading days with ".". This mirrors the parser in /api/cmt.js
 * (the server does the real parse) — kept here so the algorithm is unit-tested.
 */
export function latestRateFromFredCsv(csv: string): { rate: number; date: string } {
  const lines = csv.trim().split('\n').slice(1); // drop the "DATE,SERIES" header
  for (let i = lines.length - 1; i >= 0; i--) {
    const [date, value] = lines[i].split(',');
    const pct = parseFloat(value);
    if (Number.isFinite(pct)) return { rate: pct / 100, date: (date || '').trim() };
  }
  throw new Error('no numeric value in FRED CSV');
}
