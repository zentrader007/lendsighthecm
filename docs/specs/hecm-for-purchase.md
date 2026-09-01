# HECM for Purchase (H4P) support — specification

**Status: specced, not scheduled.** Written to be executable later without re-deriving anything.

## Context

HECM for Purchase lets a borrower buy a new primary residence *and* take a HECM in a single
transaction: they bring a down payment, the HECM funds the rest, and no monthly principal-and-interest
payment is required. It is the natural fit for a downsizing or right-sizing client.

**The simulator does not support it at all.** A repo-wide search for `h4p|H4P|purchase|Purchase`
returns exactly three hits — the computation, the type, and the return:

```ts
// app/src/engine/index.ts:88
const h4pDownPaymentMin = homeValue - principalLimit + financedCosts;
```

It is never rendered in any view, never referenced in any test, and absent from `share.ts`. It is
dead-but-directionally-correct output.

This was raised alongside the fixed-rate gap ([fixed-rate-hecm.md](./fixed-rate-hecm.md)) — fixed-rate
HECMs appear on H4P more than anywhere else, so the two pair naturally. They are independently
valuable and should be built separately.

## What is wrong today

1. **Max Claim Amount is computed incorrectly for a purchase.** `deriveCosts` uses
   `effectiveHomeValue = Math.min(homeValue, hecmLimit)`
   ([costs.ts:26](../../app/src/engine/costs.ts)). For H4P the MCA is the **lesser of purchase price,
   appraised value, and the FHA HECM limit** — three terms, not two. Because initial MIP is 2% of MCA
   and the tiered origination fee keys off it too, a wrong MCA corrupts the costs as well as the
   principal limit.
2. **No purchase price input exists.** There is only `homeValue`, which is ambiguous between
   appraised value and purchase price.
3. **The down-payment formula is a floor, not the cash the client actually needs.** It omits
   out-of-pocket costs (counseling, appraisal) and any prepaids/escrows. `pocCosts` is already
   computed in `deriveCosts` and simply is not added.
4. **The number is never shown.** No card, no panel, no test.
5. **The H4P value story is not modeled** — see Phase 2.

## The rules to encode

1. **MCA = min(purchase price, appraised value, FHA HECM limit).**
2. **Principal limit = MCA × PLF.** PLF lookup by age and expected rate is unchanged.
3. **Required monetary investment (down payment) = purchase price − (principal limit − financed
   costs).** That is today's formula, and it is structurally right; it just needs the correct MCA.
4. **Total cash to close = down payment + out-of-pocket costs + prepaids/escrows.**
5. **The purchase draw is a mandatory obligation.** This matters: it means HUD's first-year
   disbursement rule resolves through the *mandatory obligations + 10%* branch rather than the 60%
   branch — which [index.ts:76-81](../../app/src/engine/index.ts) already implements correctly.
6. **Overfunding creates a growing line of credit.** A down payment above the minimum leaves unused
   principal limit, which becomes an available LOC that grows. This is the standing advice —
   *put a little extra in so the line starts growing even at $1,000* — applied to a purchase.
7. **No monthly P&I is required**, and the borrower must occupy within 60 days.

### Verify against current HUD guidance before building

These carry real regulatory drift and should be confirmed against current Handbook 4000.1 /
Mortgagee Letters at build time rather than taken from this document:

- **Interested party contributions / seller concessions.** Historically prohibited outright on H4P.
  HUD appears to have relaxed this to permit IPCs up to a percentage cap for specified costs —
  **confirm the current rule and the cap before modeling it.** This materially changes cash to close.
- **Acceptable funding sources** for the monetary investment (cash and documented asset sales are
  fine; gifts from relatives are generally permitted; borrowed funds and bridge loans generally are
  not).
- **Eligible property types** and any condo/manufactured-housing conditions.

## Engine mapping

The purchase draw behaves exactly like a mandatory obligation, so H4P maps cleanly onto machinery
that already exists — this is mostly plumbing, not new math:

```
mandatoryObligations = purchasePrice − downPayment      // what the HECM funds
baseUPB              = financedCosts + mandatoryObligations
availableFunds       = principalLimit − baseUPB          // > 0 only when overfunded → LOC
```

`availableInitialDraw` ([index.ts:76-81](../../app/src/engine/index.ts)) then resolves the first-year
rule correctly with no change, and any leftover principal limit flows into the existing LOC and
LOC-growth series untouched.

## Phased approach

### Phase 1 — correctness and cash to close

**Inputs** (`SimulationInputs`, [types.ts](../../app/src/engine/types.ts)):
```ts
transactionType: 'Refinance' | 'Purchase';   // default 'Refinance' — preserves today's behavior
purchasePrice: number;                       // 0 when not a purchase
```
Plus a `defaults.ts` entry, a `numOr`/`oneOf` pair in `share.ts` `sanitizeInputs`, and a
`TRANSACTION_TYPES` const in `views/types.ts`. Follow the `rateScenario` precedent — that union is
mirrored in **three** places that must stay in sync (`engine/types.ts`, `views/types.ts`,
`share.ts`).

**Engine:**
- Compute MCA as the three-way minimum and pass it into `deriveCosts` (currently it derives its own
  two-way minimum internally — either pass MCA in, or pass the already-minimized purchase/appraised
  value as `homeValue`).
- Extend the result with a cash-to-close breakdown rather than the single bare number:
  `h4pDownPaymentMin`, `h4pOutOfPocket` (= existing `pocCosts`), `h4pCashToClose`, and
  `h4pHecmContribution` (what the loan covers).
- Guard: down payment cannot be negative (a principal limit exceeding the purchase price means no
  down payment is required and the surplus is available as LOC).

**UI:** a purchase panel — Purchase price, Appraised value, Down payment (defaulting to the minimum,
editable upward to model overfunding) — plus a cash-to-close readout: *required down payment +
out-of-pocket costs = cash to close*, and *the HECM covers $X of the $Y purchase*.

### Phase 2 — the value story (three-way comparison)

This is what makes H4P worth building. The client's real question is not "what is my down payment,"
it is "how should I pay for this house?" Three ways:

| | Cash at closing | Monthly payment | Capital left invested |
|---|---|---|---|
| **All cash** | full purchase price | none | none |
| **H4P** | ~half down | **none required** | the rest stays invested |
| **Forward mortgage** | same down payment | full P&I | the rest stays invested |

H4P versus a forward mortgage isolates the product's actual value: **same house, same down payment,
no required monthly payment.** That is structurally identical to the freed-payment machinery already
in [comparison.ts](../../app/src/engine/comparison.ts) — `monthlyMortgagePayment`,
`residualMortgage`, `freedPaymentYears`, and the invest-vs-consume toggles should be reused, not
rewritten.

### Phase 3 — the overfunding lever

Surface what a larger-than-required down payment buys: unused principal limit becoming a growing line
of credit. Largely free once Phase 1 lands, since the leftover already flows into the LOC series.
Worth an explicit readout because it is the single most actionable piece of advice on an H4P.

## Tab behavior

Most tabs work as-is. Notes:

| Tab | Under H4P |
|---|---|
| `networth` | **The primary tab** — home for the three-way comparison |
| `spending` | Lump sum is $0 (all proceeds fund the purchase); the story is the freed payment vs a forward mortgage |
| `loc` | Meaningful **only when overfunded** — otherwise a flat zero |
| `equity`, `invest` | Valid as-is |
| `seqrisk` | Valid only when there is a LOC to bridge from (i.e. overfunded) |
| `table` | Valid |

## Verification

1. **Obtain a real H4P quote as a golden-master fixture** — the fixed-rate spec's processing-software
   comparison served this role well. Needs: age, purchase price, appraised value, expected rate,
   fee breakdown, resulting principal limit, and required down payment.
2. Assert `MCA === min(purchasePrice, appraisedValue, hecmLimit)`, including each of the three
   binding in turn.
3. Assert `downPayment + (principalLimit − financedCosts) === purchasePrice`, and that
   `cashToClose === downPayment + pocCosts`.
4. Assert the **refinance path is byte-identical to today** (`transactionType` defaults to
   `'Refinance'`; existing golden-master tests must not move).
5. Assert overfunding: a down payment above the minimum produces `availableFunds > 0` and a growing
   `availableLOC`.
6. Browser: purchase panel, cash-to-close readout, three-way comparison.
7. Share-link round-trip of `transactionType` + `purchasePrice`.

## Related

- [fixed-rate-hecm.md](./fixed-rate-hecm.md) — fixed-rate HECMs are most common on H4P. Independent
  builds, but a fixed H4P is the realistic combined case.
