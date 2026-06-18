# Plan — Lien-Aware, Two-World Net-Worth Comparison (Option C)

**Problem.** The Standby LOC comparison comes from `gap = upb + pocDrag`, where `upb`
includes any existing liens the HECM paid off, accrued for years. The "No HECM"
baseline is gross `homeValue`, as if the home were free-and-clear. When the HECM
retires a mortgage, that comparison is apples-to-oranges: it counts the HECM's
accrued balance + costs but ignores (a) the mortgage that would still exist in the
no-HECM world, and (b) the years of P&I the no-HECM client would still pay.

**Goal.** Model **both worlds' full balance sheets over time** — home equity *and*
liquid portfolio — so the comparison is honest on the asset side and the cash-flow
side. This generalizes cleanly: with no liens it reduces to today's behavior.

---

## 1. Conceptual model (the heart)

For each projection year `t`, hold **living spending equal** across both worlds (so
we isolate the financing decision; the mortgage P&I is the only deliberate cash-flow
difference). All series already share the engine's monthly conventions.

```
homeValue(t)            appreciated home value — identical in both worlds

— No-HECM world —
residualMortgage(t)     existing lien amortized at its own rate/term; 0 after payoff
homeEquity_noHECM(t)  = homeValue(t) − residualMortgage(t)
portfolio_noHECM(t)     grows at investmentReturn; each year withdraws
                        livingSpending + annual mortgage P&I (until lien paid off)
netWorth_noHECM(t)    = homeEquity_noHECM(t) + portfolio_noHECM(t)

— HECM world (standby; lien paid off at closing) —
hecmBalance(t)          existing engine UPB (paid-off liens + financed costs,
                        accruing at the note rate); non-recourse floor applies
homeEquity_HECM(t)    = max(0, homeValue(t) − hecmBalance(t))
portfolio_HECM(t)       grows at investmentReturn; each year withdraws
                        livingSpending only (NO mortgage P&I); start reduced by
                        any out-of-pocket closing costs
availableLOC(t)         standby credit line (already modeled) — for the access view
netWorth_HECM(t)      = homeEquity_HECM(t) + portfolio_HECM(t)
```

Why this is the comprehensive fix: the **avoided P&I** surfaces as
`portfolio_HECM(t) > portfolio_noHECM(t)`; the **HECM's accruing balance** surfaces as
`homeEquity_HECM` falling below `homeEquity_noHECM` (where the mortgage amortizes
away); the **out-of-pocket costs** surface as a lower HECM starting portfolio; the
**non-recourse floor** caps HECM equity loss. Both debts and both cash flows net out
in one picture.

**Freed-cash assumption.** The equal-spending framing implicitly *invests* the avoided
P&I (it stays in `portfolio_HECM`). That is the standard wealth comparison (Pfau/Sacks)
and the default. A later variant can let the user mark the freed cash as *consumed*
(a lifestyle/liquidity benefit rather than wealth) — see §7.

---

## 2. New inputs (only relevant when existingLiens > 0)

Add to `SimulationInputs` (`app/src/engine/types.ts`) + `defaults.ts`:

| Field | Meaning | Suggested default |
|---|---|---|
| `existingLienRate` | interest rate on the mortgage being paid off | `0.065` (or pull from FRED 30yr) |
| `existingLienTermRemaining` | years left on that mortgage at closing | `25` |

Reuse existing inputs: `existingLiens` (original balance), `portfolioValue`,
`annualSpending`, `investmentReturn`, `costsInLoan`, plus the HECM/appreciation set.
All must round-trip through the share link (extend `sanitizeInputs` in `share.ts`).

---

## 3. Engine design

New module **`app/src/engine/comparison.ts`** (sibling to `sequence.ts`, reusing
`FV`/`PMT` from `finance.ts`):

- `monthlyMortgagePayment(L0, rate, termYears)` → `PMT(rate/12, termYears*12, L0)`.
- `residualMortgage(L0, rate, termYears, t)` → amortized balance after `t` years
  (closed-form via `FV`), floored at 0 for `t ≥ termYears`.
- `runMortgageComparison(inp)` → `{ rows: ComparisonRow[], noHecmDepletionAge,
  hecmDepletionAge, ... }`, where each `ComparisonRow` carries the eight series in §1
  for year `t`. Runs the HECM side via the existing `runSimulation` (standby: only the
  lien payoff at closing, no further draws) and the no-HECM side via the amortization +
  portfolio iteration. Beginning-of-year withdrawal timing to match `sequence.ts`.
- Depletion detection for both portfolios (mirrors `sequence.ts`), so the chart can
  call out "no-HECM portfolio runs dry at age X" — a key, honest output.

Reuse, don't duplicate: factor the portfolio-iteration + depletion logic shared with
`sequence.ts` into a small helper if it cleanly extracts.

---

## 4. UI design

- **Net Worth tab → make it lien-aware.** When `existingLiens > 0`, render the two-world
  comparison: `netWorth_HECM` vs `netWorth_noHECM` (plus optional faint home-equity and
  portfolio sub-lines). When `existingLiens == 0`, keep today's `rmNetWorth` vs
  `homeValue` chart unchanged. The insight text reports the honest gap and any
  portfolio-depletion ages.
- **Standby LOC tab → fix the baseline (the B component).** Change "Home Value (No HECM)"
  to **"Home equity (No HECM)" = homeValue − residualMortgage(t)**; with no liens this is
  identical to today. Gate/relabel the "cost of standby liquidity, not lost wealth from
  borrowing" line so it only makes that claim when `existingLiens == 0`; otherwise state
  that the gap includes the accrued lien payoff (which would exist as a mortgage anyway).
- **Drawer → new "Existing mortgage" section** (shown only when liens > 0): `existingLienRate`,
  `existingLienTermRemaining`, with InfoTips. Reuse the Sequence-Risk portfolio/spending
  controls for the shared inputs.
- **Assumptions transparency.** A short caption under the comparison listing the live
  assumptions (lien rate/term, return, appreciation, equal-spending/invest-the-difference)
  so the model can't read as false precision.

---

## 5. Phased delivery

- **Phase 0 — Honesty now (ship immediately).** Standby insight: gate the "cost of standby
  liquidity" wording on `liens == 0`; caveat otherwise. No engine change. (This is the
  prior "Option A".)
- **Phase 1 — Engine.** New inputs + `comparison.ts` (amortization + two-world series +
  depletion). Unit tests with closed-form amortization checks.
- **Phase 2 — Standby baseline fix (B).** Net residual mortgage out of the standby
  baseline; verify the no-lien case is byte-identical to today.
- **Phase 3 — Net Worth comparison (C).** Lien-aware Net Worth tab + drawer section +
  assumptions caption. Verify both worlds, depletion call-outs.
- **Phase 4 — Consumer view + disclaimers.** Reflect the two-world framing client-side;
  surface assumptions; extend the disclaimer.
- **Phase 5 — Share-link + polish.** `sanitizeInputs` covers new fields; responsive checks.

Each phase is independently shippable, built/tested/deployed, committed and pushed.

---

## 6. Test plan

- **Amortization closed-form:** `residualMortgage` matches a hand-checked schedule;
  balance hits 0 exactly at `termRemaining`.
- **Reduces to current behavior:** with `existingLiens == 0`, the Net Worth and Standby
  series equal today's values to the penny (protects the validated free-and-clear case).
- **Two-world sanity:** a scenario where the no-HECM portfolio depletes (mortgage drain)
  while the HECM portfolio survives — assert depletion ages and the net-worth crossover.
- **Avoided-P&I identity:** `portfolio_HECM − portfolio_noHECM` equals the compounded
  avoided P&I stream (minus OOP cost difference), checked independently.
- **Non-recourse floor:** HECM home equity never negative even if `upb > homeValue`.
- **Share-link round-trip:** new fields survive encode/decode and sanitize.

---

## 7. Open questions / decisions for Todd

1. **Existing-lien rate default & source** — fixed default (~6.5%) or pull a 30yr rate
   from the FRED feed alongside the CMT pulls?
2. **Freed-cash treatment** — ship equal-spending/invest-the-difference only (default), or
   also expose a "freed cash is consumed" toggle that shows the liquidity benefit
   separately from wealth?
3. **Home for the full comparison** — upgrade the existing **Net Worth** tab (recommended),
   or add a dedicated "HECM vs. Mortgage" tab?
4. **Spending source** — reuse the Sequence-Risk `annualSpending`, or a separate spending
   input for this view?

---

## 8. Scope guardrails

- Keep the **Sequence Risk** tab as-is (different question: downturn bridging). This plan
  adds the *mortgage/net-worth* dimension; it does not merge the two analyses.
- Do not touch the HECM core math (PLF, principal limit, note-rate growth) — only add the
  no-HECM mortgage model and the portfolio bookkeeping around it.
- Every new number must be assumption-transparent and independently testable; prefer
  showing a range or the key driver over a single authoritative figure.
