// Input/output contracts for the HECM Variable-Rate simulation engine.
// Field names mirror the spreadsheet's named ranges so the mapping is auditable.

export type RateSourceMode = 'Assumed' | 'Historical';

/**
 * Whether the cash figure at closing is money the borrower TAKES OUT (a draw)
 * or money they BRING IN (a deposit). A deposit reduces what the loan has to
 * cover, which is how a borrower who is short of qualifying closes the gap
 * without waiting.
 */
export type CashMode = 'Draw' | 'Deposit';

/** How the accrual rate behaves across the projection. */
export type RateScenario =
  | 'Flat (assumed)'
  | 'Rates +2%'
  | 'Rates -2%'
  | 'Replay 1986-2024'
  | 'Custom (per-year)';

export interface CostInputs {
  counselingCost: number; // POC
  appraisalPOC: number; // POC
  otherPOCCosts: number; // POC
  // Overrides: 0 = use the auto-calculated value (2% MCA for MIP; the tiered
  // origination formula). > 0 replaces the calculated figure to the dollar.
  initialMipOverride: number;
  originationOverride: number;
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
  appreciation: number; // assumed annual appreciation (the flat base), e.g. 0.03
  /**
   * Optional per-year appreciation (index 0 = year 1). When null (the default),
   * the flat `appreciation` above is used for every year. When set (a 38-length
   * array), the engine uses appreciations[n-1] for each year's home-price
   * growth — so a COI can model a rising/falling glide or hand-set specific
   * years. Populated by the appreciation-trend generator and the editable
   * Appreciation % column in the Year table.
   */
  appreciations: number[] | null;

  // Liens & draws
  existingLiens: number; // mandatory obligations
  /** Magnitude of the cash figure at closing; `cashMode` decides its direction. */
  initialCashDraw: number;
  /** 'Draw' = borrower takes this cash out; 'Deposit' = borrower brings it in. */
  cashMode: CashMode;
  costsInLoan: boolean;
  /**
   * Finance only the initial MIP into the loan and pay all other closing costs
   * out of pocket. Only takes effect when costsInLoan is false (when costsInLoan
   * is true, every cost is financed anyway).
   */
  financeMipOnly: boolean;

  // Rates (Dashboard)
  cmt10yr: number; // 10yr CMT index / expected-rate index
  cmt1yr: number; // 1yr CMT index / initial-rate index
  margin: number;
  rateScenario: RateScenario;
  /**
   * Optional per-year accrual index (index 0 = year 1). Only used under the
   * 'Custom (per-year)' scenario; null (the default) elsewhere. Each value is
   * the index (e.g. CMT) for that year — the accrual becomes
   * MROUND(index + margin, 1/8%) + MIP — so a COI can model rates rising/falling
   * or hand-set specific years. Populated by the rate-trend generator and the
   * editable Index % column in the Year table.
   */
  indexRates: number[] | null;

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
  existingLienPayment: number; // monthly P&I override; 0 = auto-amortize from rate/term
  freedCashConsumed: boolean; // true = the avoided P&I is spent (lifestyle), not invested
  // true = model the freed P&I as new invested savings (mortgage funded from
  // income), so it compounds in its own bucket and lifts net worth even from a
  // $0 portfolio. false = the freed P&I simply reduces portfolio drawdown.
  freedPaymentInvested: boolean;

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
  /** The index driving accrual that year (accrualRate − margin − MIP), backed
   *  out so the editable Index % column is consistent with the Accrual column
   *  under every scenario. null for year 0. */
  accrualIndex: number | null;
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
  netCashDrawn: number; // cash the borrower nets at closing (draw beyond the lien payoff & financed costs); capping-aware, never negative
  initialUPB: number;
  remainingCredit: number; // floored at 0 for display
  /** Signed: principal limit less everything the loan must cover. Negative means
   *  the borrower does not yet qualify (short by that much). */
  availableFunds: number;
  /** Borrower's own cash brought to closing (0 unless cashMode is 'Deposit'). */
  cashDeposit: number;
  overDraw: number; // amount by which liens + draw + financed costs exceed the principal limit
  /** Cash draw at closing beyond HUD's first-year disbursement limit (the 60% rule). */
  firstYearDrawExcess: number;
  /** Total scheduled draws that exceeded the credit available that year (capped, not borrowed). */
  drawsBeyondCredit: number;
  /** First projection year whose scheduled draw had to be capped, or null. */
  firstCappedDrawYear: number | null;
  maxTenurePayment: number | null;
  h4pDownPaymentMin: number;
  pocCosts: number;
  projection: ProjectionRow[];
}
