import type { CostInputs, SimulationInputs } from './types';

export const defaultCosts: CostInputs = {
  counselingCost: 199,
  appraisalPOC: 750,
  otherPOCCosts: 0,
  initialMipOverride: 0,
  originationOverride: -1, // -1 = auto-calculate; 0 is a valid (waived) fee
  originationDiscount: 0,
  appraisalInLoan: 0,
  creditReport: 0,
  floodCertification: 0,
  docPrep: 0,
  mersRegistration: 0,
  taxCertFee: 0,
  trustReview: 0,
  settlementClosing: 0,
  ownersTitle: 0,
  lendersTitle: 0,
  titleServices: 0,
  notary: 0,
  recording: 0,
  other: 2750,
};

/** The workbook's shipped "Jim Smith" scenario — used as the golden-master baseline. */
export const defaultInputs: SimulationInputs = {
  age: 64,
  homeValue: 545000,
  appreciation: 0.03,
  existingLiens: 0,
  initialCashDraw: 50000,
  costsInLoan: true,
  financeMipOnly: false,
  cmt10yr: 0.0438,
  cmt1yr: 0.0375,
  margin: 0.02375,
  rateScenario: 'Flat (assumed)',
  hecmLimit: 1249125,
  annualMIP: 0.005,
  principalLimitOverride: 0,
  futureCMT10yr: 0.025,
  futureCMTMode: 'Assumed',
  investmentReturn: 0.06,
  taxRateOnSoldAssets: 0, // default 0%; advisor can set the client's rate
  portfolioValue: 1_000_000,
  annualSpending: 60_000,
  crashPct: 0.25,
  recoveryReturn: 0.1,
  recoveryYears: 10,
  existingLienRate: 0.065, // editable; auto-filled from the live 30yr mortgage rate
  existingLienTermRemaining: 25,
  freedCashConsumed: false,
  draws: Array(38).fill(0),
  payments: Array(38).fill(0),
  costs: defaultCosts,
  beginningYear: 2026,
  projectionYears: 38,
};
