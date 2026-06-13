export const usd = (n: number | null | undefined, dp = 0): string =>
  n == null || Number.isNaN(n)
    ? '—'
    : n.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      });

export const pct = (n: number | null | undefined, dp = 3): string =>
  n == null || Number.isNaN(n) ? '—' : `${(n * 100).toFixed(dp)}%`;
