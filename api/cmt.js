// Serverless proxy for live Constant Maturity Treasury rates.
//
// The app is a static site, so the browser can't fetch the source directly
// (CORS). This function runs server-side on Vercel and returns the most recent
// 1-year and 10-year CMT rates as decimals. It reads the U.S. Treasury's daily
// par-yield-curve CSV (the primary CMT source); the previous FRED fredgraph.csv
// endpoint began hanging. The client falls back to its manual defaults on any
// error, so the app never breaks.

const CSV_BASE =
  'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all';

// Column indexes in the daily yield-curve CSV header:
// Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr",...
const COL_1YR = 7;
const COL_10YR = 12;

const yyyymm = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

// Fetch one month of the daily yield curve as CSV. Abort after 12s so a slow
// upstream fails fast to the client's manual-value fallback rather than hanging.
async function fetchMonth(month) {
  const url = `${CSV_BASE}?type=daily_treasury_yield_curve&field_tdr_date_value_month=${month}&_format=csv`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; lendsight-hecm/1.0)',
        Accept: 'text/csv,*/*',
      },
    });
    if (!res.ok) throw new Error(`Treasury responded ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Rows are newest-first; take the most recent one with numeric 1yr & 10yr values.
function parseLatest(csv) {
  const lines = csv.trim().split('\n');
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const one = parseFloat(cols[COL_1YR]);
    const ten = parseFloat(cols[COL_10YR]);
    if (Number.isFinite(one) && Number.isFinite(ten)) {
      return { one, ten, date: (cols[0] || '').trim() };
    }
  }
  return null;
}

module.exports = async function handler(_req, res) {
  try {
    const now = new Date();
    let parsed = parseLatest(await fetchMonth(yyyymm(now)));
    if (!parsed) {
      // Early in a month, before the first release — fall back to last month.
      const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      parsed = parseLatest(await fetchMonth(yyyymm(prev)));
    }
    if (!parsed) throw new Error('Treasury CSV had no numeric rate rows');
    // Treasury reports percent (4.38); the engine wants a decimal (0.0438). Round
    // to shed binary-float noise so the editable field shows a tidy value.
    const toDecimal = (pct) => Number((pct / 100).toFixed(6));
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      cmt10yr: toDecimal(parsed.ten),
      cmt1yr: toDecimal(parsed.one),
      asOf: parsed.date,
      source: 'U.S. Treasury daily par yield curve (1 Yr / 10 Yr CMT)',
    });
  } catch (err) {
    res.status(502).json({ error: String((err && err.message) || err) });
  }
};
