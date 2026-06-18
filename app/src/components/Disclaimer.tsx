/**
 * Educational-illustration / not-a-loan-offer disclaimer. Rendered at the bottom
 * of both advisor layouts (the consumer share page has its own fuller footer),
 * since the advisor screen is what gets screen-shared and exported.
 */
export function Disclaimer() {
  return (
    <footer className="app-disclaimer">
      <p>
        This is an educational illustration — not a loan offer, commitment to lend, or financial
        advice. All figures are estimates based on the assumptions shown and current program
        limits; actual terms depend on rates, fees, and HUD guidelines at the time of application.
        The Sequence Risk view models a single user-defined market path for illustration and is not
        a Monte Carlo or probabilistic forecast. Net-worth comparisons assume equal living spending
        in both scenarios, plus the portfolio return, appreciation, and existing-mortgage terms
        shown — small input changes can shift the outcome materially. Consult a HUD-approved
        counselor and a licensed mortgage professional before making any decision.
      </p>
      <p className="app-disclaimer-brand">LendsightAI · Certified Liability Advisor</p>
    </footer>
  );
}
