// Client-side helper for the live CMT-rate feed (served by /api/cmt).

export interface LiveCMT {
  cmt10yr: number; // decimal, e.g. 0.0438
  cmt1yr: number; // decimal, e.g. 0.0375
  asOf: string; // observation date from the source, e.g. "08/12/2026"
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
