// Excel-compatible financial primitives. These mirror Excel's FV / PMT / MROUND
// exactly (including sign conventions) because the engine is validated against the
// spreadsheet's own computed values.

/**
 * Excel FV(rate, nper, pmt, pv, type).
 * Returns the future value of an investment. Sign convention matches Excel:
 * outflows are negative, inflows positive.
 */
export function FV(
  rate: number,
  nper: number,
  pmt: number,
  pv = 0,
  type: 0 | 1 = 0,
): number {
  if (rate === 0) return -(pv + pmt * nper);
  const f = Math.pow(1 + rate, nper);
  return -(pv * f + pmt * (1 + rate * type) * (f - 1) / rate);
}

/**
 * Excel PMT(rate, nper, pv, fv, type).
 * Returns the periodic payment for an annuity.
 */
export function PMT(
  rate: number,
  nper: number,
  pv: number,
  fv = 0,
  type: 0 | 1 = 0,
): number {
  if (rate === 0) return -(pv + fv) / nper;
  const f = Math.pow(1 + rate, nper);
  return -(pv * f + fv) * rate / ((1 + rate * type) * (f - 1));
}

/** Excel MROUND(value, multiple) — round to nearest multiple (round half away from zero). */
export function MROUND(value: number, multiple: number): number {
  if (multiple === 0) return 0;
  return Math.round(value / multiple) * multiple;
}
