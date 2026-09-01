# Specs — planned but unscheduled work

Product gaps that have been researched and specified but deliberately not built yet. Each is written
to be executable later without re-deriving the analysis.

| Spec | Summary | Status |
|---|---|---|
| [fixed-rate-hecm.md](./fixed-rate-hecm.md) | The simulator models only adjustable-rate HECMs. Spec covers a fixed-rate engine capability plus a Fixed-vs-Adjustable comparison that quantifies what a borrower forfeits (validated at 48% of available proceeds in a real quote). | Specced, not scheduled |
| [hecm-for-purchase.md](./hecm-for-purchase.md) | H4P is unsupported: `h4pDownPaymentMin` is computed but never displayed, and the Max Claim Amount is wrong for a purchase. Spec covers correct MCA, cash-to-close, and an H4P vs all-cash vs forward-mortgage comparison. | Specced, not scheduled |

Both specs record validation work already done against real lender quotes and processing-software
output, including golden-master fixtures to test against when the work is picked up.
