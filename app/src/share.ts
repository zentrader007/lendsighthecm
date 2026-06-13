import type { SimulationInputs } from './engine';
import { defaultInputs, defaultCosts } from './engine/defaults';

// Encode/decode the full input set into a URL-safe string so a scenario can be
// shared as a link that reproduces the exact same numbers.
export function encodeInputs(inp: SimulationInputs): string {
  const json = JSON.stringify(inp);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeInputs(s: string): SimulationInputs | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object') return null;
    // Merge over defaults so a link made before a field existed (or a partial /
    // garbled payload) can never leave a field undefined → NaN downstream, then
    // sanitize so a stale or hand-crafted link can't inject strings, NaN, or
    // non-array schedules into the engine.
    return sanitizeInputs({
      ...defaultInputs,
      ...parsed,
      costs: { ...defaultCosts, ...(parsed.costs ?? {}) },
    } as SimulationInputs);
  } catch {
    return null;
  }
}

const numOr = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Coerce every numeric field to a finite number and the schedules to 38-length
 *  numeric arrays, falling back to defaults — so a malformed `?d=` payload
 *  degrades gracefully instead of poisoning the projection with NaN/strings. */
function sanitizeInputs(inp: SimulationInputs): SimulationInputs {
  const arr38 = (v: unknown, fallback: number[]) =>
    Array.isArray(v) ? Array.from({ length: 38 }, (_, i) => numOr(v[i], 0)) : fallback.slice();

  const rawCosts = (inp.costs ?? {}) as unknown as Record<string, unknown>;
  const costs = { ...defaultCosts };
  for (const k of Object.keys(costs) as (keyof typeof costs)[]) {
    costs[k] = numOr(rawCosts[k], defaultCosts[k]);
  }

  return {
    ...inp,
    age: numOr(inp.age, defaultInputs.age),
    homeValue: numOr(inp.homeValue, defaultInputs.homeValue),
    appreciation: numOr(inp.appreciation, defaultInputs.appreciation),
    existingLiens: numOr(inp.existingLiens, defaultInputs.existingLiens),
    initialCashDraw: numOr(inp.initialCashDraw, defaultInputs.initialCashDraw),
    cmt10yr: numOr(inp.cmt10yr, defaultInputs.cmt10yr),
    cmt1yr: numOr(inp.cmt1yr, defaultInputs.cmt1yr),
    margin: numOr(inp.margin, defaultInputs.margin),
    hecmLimit: numOr(inp.hecmLimit, defaultInputs.hecmLimit),
    annualMIP: numOr(inp.annualMIP, defaultInputs.annualMIP),
    principalLimitOverride: numOr(inp.principalLimitOverride, defaultInputs.principalLimitOverride),
    futureCMT10yr: numOr(inp.futureCMT10yr, defaultInputs.futureCMT10yr),
    investmentReturn: numOr(inp.investmentReturn, defaultInputs.investmentReturn),
    taxRateOnSoldAssets: numOr(inp.taxRateOnSoldAssets, defaultInputs.taxRateOnSoldAssets),
    portfolioValue: numOr(inp.portfolioValue, defaultInputs.portfolioValue),
    annualSpending: numOr(inp.annualSpending, defaultInputs.annualSpending),
    crashPct: numOr(inp.crashPct, defaultInputs.crashPct),
    recoveryReturn: numOr(inp.recoveryReturn, defaultInputs.recoveryReturn),
    recoveryYears: numOr(inp.recoveryYears, defaultInputs.recoveryYears),
    beginningYear: numOr(inp.beginningYear, defaultInputs.beginningYear),
    projectionYears: numOr(inp.projectionYears, defaultInputs.projectionYears),
    costsInLoan: Boolean(inp.costsInLoan),
    draws: arr38(inp.draws, defaultInputs.draws),
    payments: arr38(inp.payments, defaultInputs.payments),
    costs,
  };
}

export interface SharedState {
  view: 'advisor' | 'consumer';
  inputs: SimulationInputs | null;
}

export function readSharedState(): SharedState {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') === 'consumer' ? 'consumer' : 'advisor';
  const d = params.get('d');
  return { view, inputs: d ? decodeInputs(d) : null };
}

export function buildShareUrl(inp: SimulationInputs): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?view=consumer&d=${encodeInputs(inp)}`;
}
