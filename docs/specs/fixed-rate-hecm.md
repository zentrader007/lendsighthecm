# Fixed-Rate HECM support — specification

**Status: specced, not scheduled.** Written to be executable later without re-deriving anything.

## Context

Every number the simulator produces silently assumes an **adjustable-rate HECM**. The growing line of
credit, tenure payments, scheduled draws, payments that restore credit, and the standby-LOC
sequence-risk strategy all presuppose it. We never decided to exclude fixed-rate — we never surfaced
that we had assumed it away.

This surfaced from a power user who checked the other three illustrators he uses: **none of them
models fixed-rate either.** The only place to see fixed-rate HECM numbers is the processing software.
He has never written a fixed-rate HECM and doubts many are written, but they appear on
HECM-for-Purchase more than anywhere else.

**The value is not in illustrating fixed-rate as a product to sell.** It is in quantifying what a
client gives up by choosing it — which is exactly the case behind the standing advice to *overfund*
(leave a little in, or put a little extra in, so the credit line starts growing even at $1,000). A
fixed-rate HECM makes that impossible. The same asymmetry drives the H4P point: on an adjustable H4P,
a later lump-sum prepayment **restores available credit** and effectively activates a growing line the
borrower never opened at closing; on a fixed H4P the same prepayment just reduces the balance and buys
back nothing.

## Validation already completed

A processing-software product comparison (age 64, $850,000 property and Max Claim Amount, 0 mandatory
obligations) was reconciled against this engine. **Two independent confirmations:**

**1. Our PLF table reproduces all five products exactly** (`Principal Limit ÷ 850,000` vs
`app/src/data/plfTable.json` at age 64):

| Product | Rate | Chart PLF | Our table |
|---|---|---|---|
| MoO HECM CMT (adjustable) | 7.000% expected | 32.60% | 0.326 ✓ |
| FAR Fixed | 7.560% | 30.50% | 0.305 ✓ |
| FAR Fixed | 7.680% | 30.10% | 0.301 ✓ |
| MoO HECM Fixed | 7.810% | 29.60% | 0.296 ✓ |
| Traditional Fixed | 7.930% | 29.10% | 0.291 ✓ |

**No new PLF data is required.** HUD publishes one PLF table for both products; for a fixed-rate HECM
the expected rate *is* the note rate. `lookupPLFByRate(age, ratePct)`
([plf.ts:51](../../app/src/engine/plf.ts)) already accepts a bare percent.

**2. Fixed "Available Funds" = `0.6 × PL − financed fees`** — already computed as `sixtyPctPL` at
[index.ts:58](../../app/src/engine/index.ts). All four fixed columns reconcile to the penny:

| Rate | 0.6 × PL | − financed fees | = Available | Chart |
|---|---|---|---|---|
| 7.560% | 155,550 | 25,010.35 | 130,539.65 | ✓ |
| 7.680% | 153,510 | 23,260.35 | 130,249.65 | ✓ |
| 7.810% | 150,960 | 26,706.70 | 124,253.30 | ✓ |
| 7.930% | 148,410 | 23,508.14 | 124,901.86 | ✓ |

The adjustable column instead gets the **full** PL less fees ($250,393.30), with $139,553.30 in year
one — i.e. our existing `availableInitialDraw` logic. **The fixed borrower's first-year cap is
permanent; the adjustable borrower's is a schedule.**

**The headline this produces:** $250,393 available adjustable vs $130,540 fixed — **$119,854 (48%)
forfeited**, before counting LOC growth, plus the loss of a $1,668/mo tenure option. That is the chart
no other illustrator can draw.

## What a fixed-rate HECM is (the rules to encode)

1. **Single full draw at closing.** Closed-end. No second draw, ever.
2. **Capped at the initial disbursement limit** — greater of 60% of PL, or mandatory obligations + 10%
   of PL. Everything above it is **forfeited permanently**, not deferred.
3. **PLF keyed on the note rate** (which serves as the expected rate) — usually at or above the
   adjustable expected rate, so the PL starts lower too. Two reductions stacked.
4. **No line of credit, no growth, no tenure/term payments.**
5. **Prepayments do not restore credit.** There is no line to restore.
6. **Accrual = note rate + MIP, constant for life.** No rate-scenario risk at all.

## Recommended approach: comparison first, phased

### Phase 1 — engine capability + a Fixed vs. Adjustable comparison

Deliver the advisory tool without disrupting the existing tabs. The engine gains a fixed-rate
capability; the UI gains one comparison surface rather than a mode that darkens half the app.

**Engine** — add to `SimulationInputs` ([types.ts](../../app/src/engine/types.ts)):
```ts
productType: 'Adjustable' | 'Fixed';   // default 'Adjustable'
fixedNoteRate: number;                 // decimal, e.g. 0.0756
```
Plus a `defaults.ts` entry, a `numOr`/`oneOf` pair in `share.ts` `sanitizeInputs`, and a
`PRODUCT_TYPES` const in `views/types.ts`. Note `RateScenario` is mirrored in **three** places that
must stay in sync (`engine/types.ts`, `views/types.ts`, `share.ts`) — follow the same pattern.

Guarded branches in [index.ts](../../app/src/engine/index.ts)
(`const isFixed = inp.productType === 'Fixed'`):

| Line | Change |
|---|---|
| 33 | `expectedRate` → `MROUND(inp.fixedNoteRate, 0.00125)` (no index + margin) |
| 34 | `initialRate` → the fixed rate (display-only; never used in calculation) |
| 46 | `plf` → `lookupPLFByRate(age, MROUND(inp.fixedNoteRate, 0.00125) * 100)` |
| 44-45 | **unchanged** — `expectedRate + annMip` is already correct for fixed |
| 170-185 | bypass the whole `rateScenario` ladder: `isFixed ? growthRate : <ladder>` |
| 83-86, 116-117, 252-253 | `maxTenurePayment` / `tenureAvailPerMonth` → `null` |
| 98, 112, 190 | `availableLOC` → 0 every year (also correctly zeroes `accessibleResources`) |
| 62-63, 76-81 | disbursement = `availableInitialDraw`; it becomes the whole loan, not a year-one cap |
| 143-159 | force `inp.draws` to zeros; `drawsBeyondCredit` / `firstCappedDrawYear` moot |
| 268 | `accrualIndex` → `null` (no margin to back out; also disables the Index % column) |

The monthly compounding at `index.ts:187` is **already correct** for fixed. `costs.ts` is untouched —
origination tiers and MIP are identical for both products.

**Bypass entirely:** [sequence.ts](../../app/src/engine/sequence.ts). Its whole premise is bridging
from a standby LOC; under fixed every draw caps to 0 and it would silently render two identical lines.

**UI** — one new comparison surface (a tab, or a panel on `Available spending`) that runs the engine
twice — once `Adjustable`, once `Fixed` — and lays the two side by side, mirroring the processing
software's own layout: principal limit, available funds, year-one access, tenure, LOC growth, and the
forfeited amount stated plainly.

### Phase 2 — full fixed-rate mode (optional, only if a real fixed loan must be illustrated)

Tabs adapt when `productType === 'Fixed'`:

| Surface | Action |
|---|---|
| `loc` tab (`STAGE_TABS`, `RedesignAdvisor.tsx:40`), `seqrisk` | **Hide** |
| `spending` | Keep lump sum + freed cash flow; drop the "Plan draws from the line" panel |
| `networth`, `equity`, `invest` | Valid as-is (`equity` is arguably the most important fixed tab) |
| `table` | Hide **Available LOC**, **Tenure/Mo**, **Index %**; make Draws read-only |
| Consumer `loc` tab (`CONSUMER_TABS`, `ConsumerView.tsx:8`) | **Hide** |
| Consumer BigCards | "Monthly income for life" and "Line of credit that grows" break — the latter's note is actively false under fixed |
| `PrintOnePager` | Tenure, LOC callout, and the `availableLOC` chart series |

Also: the advisor "Monthly for life" hero card, the "LOC start" stat, the `loc` headline string, and
the `shortTenureHorizon` warning banner.

## Decisions to make at build time

1. **Out-of-range fixed rate.** The PLF table spans 3.000%–18.875%; outside it `lookupPLFByRate`
   returns **0**, silently zeroing the entire principal limit. Unlike `cmt10yr` (fetched live), the
   fixed rate is user-typed, so this is reachable. **Recommend clamping to the 3.0% floor** — that
   matches HUD's actual PLF floor rather than erroring.
2. **`futurePLF`** (`index.ts:229`) models the PLF a *new* HECM would offer at each future age, so it
   legitimately stays index-driven — but under fixed the `margin` term relates to no actual loan.
   **Recommend leaving as-is and documenting.**
3. **Watch item — "Initial LOC Growth Rate."** The processing software lists 6.750% for the adjustable
   product = initial rate (6.250%) + MIP. Our engine projects at expected + MIP (7.500%) per the
   round-4 fix validated against Quantum and REVERSE+. **Not a contradiction:** 6.750% is the year-one
   contractual rate; the industry tools project forward at the expected rate. It *will* come up when
   someone compares screens side by side, so the comparison surface should label its growth-rate basis
   explicitly.

## Verification

The chart supplies a ready-made golden-master fixture — **age 64, home and MCA $850,000, no mandatory
obligations, MIP 0.5%, initial MIP $17,000**:

| Product | Rate | Orig | Other | Expected PL | Expected available |
|---|---|---|---|---|---|
| Adjustable | 7.000% exp / 6.250% init, margin 2.250% | 6,000 | 3,706.70 | 277,100 | 250,393.30 (yr 1: 139,553.30; tenure 1,668.30) |
| Fixed | 7.560% | 6,000 | 2,010.35 | 259,250 | 130,539.65 |
| Fixed | 7.680% | 4,250 | 2,010.35 | 255,850 | 130,249.65 |
| Fixed | 7.810% | 6,000 | 3,706.70 | 251,600 | 124,253.30 |
| Fixed | 7.930% | 3,000 | 3,508.14 | 247,350 | 124,901.86 |

1. Add these as engine tests — all five PLFs and all five available-funds figures, to the dollar.
2. Assert fixed invariants: `availableLOC === 0` every year, `maxTenurePayment === null`,
   `tenureAvailPerMonth === null` throughout, scheduled draws forced to 0.
3. Assert the adjustable path is **byte-identical** to today (`productType` defaults to
   `'Adjustable'`; existing golden-master tests must not move).
4. Browser: verify hidden tabs/cards under fixed, and that the comparison reproduces the
   $250,393 vs $130,540 headline.
5. Share-link round-trip of `productType` + `fixedNoteRate`.

## Related

- [hecm-for-purchase.md](./hecm-for-purchase.md) — fixed-rate is most common on H4P. Independent
  builds, but a fixed H4P is the realistic combined case.
