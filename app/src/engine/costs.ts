import type { CostInputs } from './types';

export interface DerivedCosts {
  effectiveHomeValue: number;
  initialMIP: number;
  calculatedOriginationFee: number;
  totalLoanCost: number; // sum of non-MIP in-loan costs + initial MIP
  totalCostAllIn: number; // totalLoanCost + always-out-of-pocket fees (counseling, appraisal, other POC)
  pocCosts: number;
}

/**
 * Replicates the Advanced!AO origination tiers and the cost roll-up.
 *   first $200k @ 2% (=$4,000 once value >= $200k), excess @ 1%,
 *   floored at $2,500, capped at $6,000.
 * Initial MIP = 2% of effective home value (capped at HECM limit).
 */
export function deriveCosts(
  homeValue: number,
  hecmLimit: number,
  costs: CostInputs,
  costsInLoan: boolean,
): DerivedCosts {
  const effectiveHomeValue = Math.min(homeValue, hecmLimit);

  const first200k = effectiveHomeValue < 200000 ? 0.02 * effectiveHomeValue : 4000;
  const over200k = effectiveHomeValue > 200000 ? 0.01 * (effectiveHomeValue - 200000) : 0;
  const rawOrig = first200k + over200k;
  const calculatedOriginationFee = rawOrig < 2500 ? 2500 : rawOrig > 6000 ? 6000 : rawOrig;
  const origination = calculatedOriginationFee + costs.originationDiscount;

  const initialMIP = 0.02 * effectiveHomeValue;

  // Total Loan Costs = SUM(Advanced!C18:C33): origination + listed line items + initial MIP.
  const nonMIP =
    origination +
    costs.appraisalInLoan +
    costs.creditReport +
    costs.floodCertification +
    costs.docPrep +
    costs.mersRegistration +
    costs.taxCertFee +
    costs.trustReview +
    costs.settlementClosing +
    costs.ownersTitle +
    costs.lendersTitle +
    costs.titleServices +
    costs.notary +
    costs.recording +
    costs.other;
  const totalLoanCost = nonMIP + initialMIP;

  // Fees always paid out of pocket (never financed), regardless of costsInLoan.
  const alwaysPoc = costs.counselingCost + costs.appraisalPOC + costs.otherPOCCosts;
  // POC = always-OOP fees + (total loan cost if NOT financed).
  const pocCosts = alwaysPoc + (costsInLoan ? 0 : totalLoanCost);
  // All-in cost of the loan = financed closing costs + always-OOP fees, the same
  // whether or not the closing costs are financed.
  const totalCostAllIn = totalLoanCost + alwaysPoc;

  return {
    effectiveHomeValue,
    initialMIP,
    calculatedOriginationFee,
    totalLoanCost,
    totalCostAllIn,
    pocCosts,
  };
}
