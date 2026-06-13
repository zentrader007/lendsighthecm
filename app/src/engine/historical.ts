import historical from '../data/historical.json';

interface SeriesRow {
  year: number | null;
  value: number | null;
}
interface HistData {
  cmt10yr: SeriesRow[];
  cmt1yr: SeriesRow[];
  sp500: SeriesRow[];
  housingCO: SeriesRow[];
  housingAZ: SeriesRow[];
  housingHypothetical: SeriesRow[];
  housingManual: SeriesRow[];
}

const data = historical as HistData;

function at(series: SeriesRow[], idx: number, fallback = 0): number {
  const row = series[idx];
  return row && typeof row.value === 'number' ? row.value : fallback;
}

/**
 * Historical 1yr CMT replayed forward in time for loan year n (n>=1).
 * The stored series is reverse-chronological (index 0 = 2024 … index 38 = 1986),
 * so loan year 1 maps to 1986, year 2 to 1987, and so on through 2023.
 */
export const hist1yrCMTForward = (n: number) => at(data.cmt1yr, 38 - (n - 1));

/** Historical 10yr CMT for projection year y (y>=0): reverse-order series, index y. */
export const hist10yrCMT = (y: number) => at(data.cmt10yr, y);
