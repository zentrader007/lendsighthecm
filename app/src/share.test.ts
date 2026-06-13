import { describe, it, expect } from 'vitest';
import { encodeInputs, decodeInputs } from './share';
import { defaultInputs } from './engine/defaults';
import { runSimulation } from './engine';

// Build the same URL-safe base64 the app would, from an arbitrary object.
const encodeRaw = (obj: unknown) => {
  const json = JSON.stringify(obj);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

describe('Share link round-trip', () => {
  it('round-trips all inputs, including the new sequence-risk fields', () => {
    const custom = {
      ...defaultInputs,
      principalLimitOverride: 258600,
      portfolioValue: 1_500_000,
      annualSpending: 72_000,
      crashPct: 0.35,
      recoveryReturn: 0.09,
      recoveryYears: 5,
    };
    const decoded = decodeInputs(encodeInputs(custom));
    expect(decoded).not.toBeNull();
    expect(decoded!.principalLimitOverride).toBe(258600);
    expect(decoded!.portfolioValue).toBe(1_500_000);
    expect(decoded!.annualSpending).toBe(72_000);
    expect(decoded!.crashPct).toBeCloseTo(0.35, 10);
    expect(decoded!.recoveryReturn).toBeCloseTo(0.09, 10);
    expect(decoded!.recoveryYears).toBe(5);
  });

  it('coerces a string-injected numeric field back to the default (no NaN)', () => {
    const decoded = decodeInputs(encodeRaw({ crashPct: 'x', homeValue: 'oops' }));
    expect(decoded).not.toBeNull();
    expect(Number.isFinite(decoded!.crashPct)).toBe(true);
    expect(decoded!.crashPct).toBe(defaultInputs.crashPct);
    expect(decoded!.homeValue).toBe(defaultInputs.homeValue);
    // And the engine produces finite output from the sanitized inputs.
    expect(Number.isFinite(runSimulation(decoded!).principalLimit)).toBe(true);
  });

  it('normalizes a non-array draws/payments payload to 38-length arrays', () => {
    const decoded = decodeInputs(encodeRaw({ draws: 'x', payments: 5 }));
    expect(decoded).not.toBeNull();
    expect(Array.isArray(decoded!.draws)).toBe(true);
    expect(decoded!.draws).toHaveLength(38);
    expect(Array.isArray(decoded!.payments)).toBe(true);
    expect(decoded!.payments).toHaveLength(38);
  });

  it('returns null on a garbled payload', () => {
    expect(decodeInputs('!!!not-base64!!!')).toBeNull();
  });
});
