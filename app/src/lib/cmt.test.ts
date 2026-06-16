import { describe, it, expect } from 'vitest';
import { latestRateFromFredCsv } from './cmt';

describe('latestRateFromFredCsv', () => {
  it('returns the last numeric row as a decimal rate', () => {
    const csv = 'DATE,DGS10\n2026-06-10,4.30\n2026-06-11,4.38';
    expect(latestRateFromFredCsv(csv)).toEqual({ rate: 0.0438, date: '2026-06-11' });
  });

  it("skips FRED's non-trading-day dots and uses the last real value", () => {
    const csv = 'DATE,DGS1\n2026-06-11,3.75\n2026-06-12,.\n2026-06-13,.';
    expect(latestRateFromFredCsv(csv)).toEqual({ rate: 0.0375, date: '2026-06-11' });
  });

  it('handles a trailing newline', () => {
    const csv = 'DATE,DGS10\n2026-06-11,4.38\n';
    expect(latestRateFromFredCsv(csv).rate).toBeCloseTo(0.0438, 10);
  });

  it('throws when no numeric value is present', () => {
    expect(() => latestRateFromFredCsv('DATE,DGS10\n2026-06-12,.')).toThrow();
  });
});
