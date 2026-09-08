import { SectionHead } from './bits';
import type { SectionProps } from './types';

export function HowItWorks({ data }: SectionProps) {
  const { hasLien } = data;
  return (
    <>
      <SectionHead eyebrow="How it works" title="What a reverse mortgage means for you" />
      <ul className="rp-bullets">
        <li>
          <strong>You keep your home.</strong> You remain the owner and continue living there. The loan is
          repaid when you sell, move out permanently, or pass away.
        </li>
        <li>
          <strong>No monthly mortgage payments are required.</strong>
          {hasLien ? ' Your current mortgage is paid off at closing.' : ''} You stay responsible for
          property taxes, homeowner’s insurance, and upkeep.
        </li>
        <li>
          <strong>Flexible access.</strong> Take cash up front, a steady monthly amount, a growing line of
          credit, or any combination — and change it later.
        </li>
        <li>
          <strong>It is a non-recourse loan.</strong> You or your heirs will never owe more than the home is
          worth when the loan comes due; FHA insurance covers any shortfall. Heirs can keep the home by
          repaying the balance (or 95% of its value, whichever is less).
        </li>
        <li>
          <strong>Proceeds are generally not taxable income</strong> and typically don’t affect Social
          Security or Medicare. Ask a tax professional about your situation.
        </li>
      </ul>

      <h3 className="rp-h2">Your next steps</h3>
      <ol className="rp-steps">
        <li>
          <strong>Read this plan and write down questions.</strong> Anything unclear is worth asking — the
          numbers are estimates and the assumptions can be changed.
        </li>
        <li>
          <strong>Complete HUD-approved counseling.</strong> An independent session, required by law,
          confirms the loan fits your situation and issues the certificate needed to apply.
        </li>
        <li>
          <strong>Apply with a licensed reverse mortgage lender.</strong> The lender orders an appraisal and
          verifies that taxes and insurance can be kept current. Actual terms are set at this stage.
        </li>
        <li>
          <strong>Close, then decide.</strong> After closing you have three business days to cancel. Funds
          are available after that period ends.
        </li>
      </ol>
    </>
  );
}
