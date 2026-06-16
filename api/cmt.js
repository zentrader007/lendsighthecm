// Serverless proxy for live Constant Maturity Treasury rates.
//
// The app is a static site, so the browser can't fetch FRED directly (CORS).
// This function runs server-side on Vercel, pulls the 10-year (DGS10) and
// 1-year (DGS1) series from FRED's keyless CSV endpoint, and returns the most
// recent rate of each as a decimal. The client falls back to its manual
// defaults if this ever errors, so the app never breaks.
//
// NOTE: the CSV-parsing logic here mirrors latestRateFromFredCsv() in
// app/src/lib/cmt.ts (which is unit-tested) — keep the two in sync.

const SERIES = { cmt10yr: 'DGS10', cmt1yr: 'DGS1' };

async function latest(seriesId) {
  // Limit to the last ~120 days so FRED returns a tiny CSV (the full series goes
  // back to 1962 and is slow enough to time out). Abort after 8s so a slow FRED
  // fails fast to the client's manual-value fallback rather than hanging.
  const cosd = new Date(Date.now() - 120 * 86400 * 1000).toISOString().slice(0, 10);
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${cosd}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; lendsight-hecm/1.0)',
        Accept: 'text/csv,*/*',
      },
    });
    if (!res.ok) throw new Error(`FRED ${seriesId} responded ${res.status}`);
    const csv = await res.text();
    // Rows are "DATE,VALUE"; FRED marks non-trading days with ".". Walk from the
    // end and take the most recent numeric value.
    const lines = csv.trim().split('\n').slice(1);
    for (let i = lines.length - 1; i >= 0; i--) {
      const [date, value] = lines[i].split(',');
      const pct = parseFloat(value);
      if (Number.isFinite(pct)) return { pct, date: (date || '').trim() };
    }
    throw new Error(`FRED ${seriesId} had no numeric value`);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(_req, res) {
  try {
    const [ten, one] = await Promise.all([latest(SERIES.cmt10yr), latest(SERIES.cmt1yr)]);
    // FRED reports percent (4.38); the engine wants a decimal (0.0438). Round to
    // shed binary-float noise so the editable field shows a tidy value.
    const toDecimal = (pct) => Number((pct / 100).toFixed(6));
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      cmt10yr: toDecimal(ten.pct),
      cmt1yr: toDecimal(one.pct),
      asOf: ten.date >= one.date ? ten.date : one.date,
      source: 'FRED DGS10 / DGS1',
    });
  } catch (err) {
    res.status(502).json({ error: String((err && err.message) || err) });
  }
};
