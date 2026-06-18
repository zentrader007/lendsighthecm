// Input/output contracts for the HECM Variable-Rate simulation engine.
// Field names mirror the spreadsheet's named ranges so the mapping is auditable.

export type RateSourceMode = 'Assumed' | 'Historical';

/** How the accrual rate behaves across the projection. */
export type RateScenario =
  | 'Flat (assumed)'
  | 'Rates +2%'
  | 'Rates -2%'
  | 'Replay 1986-2024';

export interface CostInputs {
  counselingCost: number; // POC
  appraisalPOC: number; // POC
  otherPOCCosts: number; // POC
  originationDiscount: number;
  appraisalInLoan: number;
  creditReport: number;
  floodCertification: number;
  docPrep: number;
  mersRegistration: number;
  taxCertFee: number;
  trustReview: number;
  settlementClosing: number;
  ownersTitle: number;
  lendersTitle: number;
  titleServices: number;
  notary: number;
  recording: number;
  other: number;
}

export interface SimulationInputs {
  // Client & property (Dashboard)
  age: number;
  homeValue: number;
  appreciation: number; // assumed annual appreciation, e.g. 0.03

  // Liens & draws
  existingLiens: number; // mandatory obligations
  initialCashDraw: number;
  costsInLoan: boolean;

  // Rates (Dashboard)
  cmt10yr: number; // 10yr CMT index / expected-rate index
  cmt1yr: number; // 1yr CMT index / initial-rate index
  margin: number;
  rateScenario: RateScenario;

  // Limits & MIP (Advanced)
  hecmLimit: number;
  annualMIP: number; // 0.005
  /**
   * Exact principal limit from a lender quote. 0 = compute from the HUD PLF
   * table. When set, replaces effectiveHomeValue × PLF so every downstream
   * figure matches the quote to the dollar.
   */
  principalLimitOverride: number;

  // Future PLF
  futureCMT10yr: number;
  futureCMTMode: RateSourceMode;

  // Investment comparison
  investmentReturn: number;
  taxRateOnSoldAssets: number;

  // Sequence-risk analysis (coordinated-withdrawal strategy)
  portfolioValue: number; // client's investment portfolio at the start
  annualSpending: number; // annual withdrawals needed for living expenses
  crashPct: number; // market drop at the start, e.g. 0.40 = −40%
  recoveryReturn: number; // annual return during the recovery years, e.g. 0.10
  recoveryYears: number; // length of the recovery (and the LOC bridge)

  // HECM-vs-keep-mortgage comparison (used when existing liens are paid off)
  existingLienRate: number; // interest rate on the mortgage being paid off
  existingLienTermRemaining: number; // years left on that mortgage at closing
  freedCashConsumed: boolean; // true = the avoided P&I is spent (lifestyle), not invested

  // Per-year schedules (index 0 = year 1). Beginning-of-year amounts.
  draws: number[];
  payments: number[];

  costs: CostInputs;
  beginningYear: number;
  projectionYears: number; // default 38
}

export interface ProjectionRow {
  year: number; // 0..N
  calendarYear: number;
  age: number;
  draw: number | null;
  payment: number | null;
  homeValue: number;
  effectiveHomeValue: number;
  appreciation: number | null;
  upb: number; // loan balance (M)
  accrualRate: number | null;
  availableLOC: number; // O
  upbPrincipalBal: number; // U
  upbInterestBal: number; // V
  possibleDeduction: number; // X
  tenureAvailPerMonth: number | null; // Y
  equity: number; // Z
  totalPL: number; // AA
  annualMIP: number; // AB
  accumMIP: number; // AC
  futurePLF: number; // AE
  futurePL: number; // AF
  cmt10yr: number; // AG
  investment: number; // AI
  investmentPlusEquity: number; // AL

  // Standby-LOC strategy series (not in the workbook; derived).
  pocDrag: number; // out-of-pocket costs compounded at the investment return
  rmNetWorth: number; // equity − pocDrag: honest net worth with the HECM in place
  accessibleResources: number; // equity + available LOC: total liquidity
}

export interface SimulationResult {
  // Headline figures (Dashboard)
  plf: number;
  principalLimit: number;
  effectiveHomeValue: number;
  expectedRate: number;
  initialRate: number;
  loanProjectedRate: number;
  initialMIP: number;
  totalLoanCost: number; // financed closing costs + initial MIP
  totalCostAllIn: number; // totalLoanCost + always-out-of-pocket fees (counseling, appraisal, other POC)
  calculatedOriginationFee: number;
  availableInitialDraw: number;
  initialUPB: number;
  remainingCredit: number; // floored at 0 for display
  overDraw: number; // amount by which liens + draw + financed costs exceed the principal limit
  maxTenurePayment: number | null;
  h4pDownPaymentMin: number;
  pocCosts: number;
  projection: ProjectionRow[];
}
