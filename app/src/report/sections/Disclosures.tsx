import { formatPreparedOn } from '../reportConfig';
import { SectionHead } from './bits';
import type { SectionProps } from './types';

export function Disclosures({ config }: SectionProps) {
  return (
    <>
      <SectionHead eyebrow="Important" title="Disclosures" />
      <div className="rp-disclosure">
        <p>
          This document is <strong>not a loan offer</strong>, commitment to lend, or approval of any kind. It
          is a mathematical <strong>simulation for educational purposes only</strong>, based on the
          assumptions shown, and <strong>must be reviewed with a licensed reverse mortgage lender</strong>{' '}
          before any decision is made.
        </p>
        <p>
          Actual rates, fees, eligibility, and terms are set by the lender and HUD guidelines at the time of
          application and will differ from this illustration. Interest rates on an adjustable-rate HECM
          change over time; the loan balance shown assumes the rate path described on the “Plan at a
          glance” page. Home values, investment returns, and market scenarios are assumptions, not
          predictions, and are not guaranteed.
        </p>
        <p>
          Borrowers remain responsible for property taxes, homeowner’s insurance, and home maintenance, and
          must occupy the home as their principal residence; failing to meet these obligations can make the
          loan due and payable. A HECM is a non-recourse, FHA-insured loan: neither the borrower nor the
          heirs will ever owe more than the home’s value when the loan is repaid.
        </p>
        <p>
          Any comparison to investments or to keeping an existing mortgage is illustrative and is not
          investment, tax, or legal advice. Please consult a HUD-approved counselor and, where appropriate,
          a tax or financial professional.
        </p>
        <p className="rp-disclosure-meta">
          Prepared {formatPreparedOn(config.preparedOn)} with LendsightAI · Certified Liability Advisor
        </p>
      </div>
    </>
  );
}
