# HECM Simulator — Design Handoff for Claude Design

A context package for re-skinning the **LendsightAI HECM Simulator** to match a
final app design style guide, while preserving all functionality, structure, and
calculations. Hand this whole file to Claude Design along with your style guide.

---

## 1. Goal

Re-theme an existing, working React + Vite + TypeScript app to match a new/final
brand style guide. This is a **visual re-skin only** — no changes to the
calculation engine, app structure, component hierarchy, or behavior. The app is
live and validated by 50 passing tests; the math must stay byte-for-byte intact.

## 2. Links

- **Live app:** https://hecm-var-simulator.vercel.app
- **Repo:** https://github.com/zentrader007/lendsighthecm
- **This handoff (in repo):** `DESIGN_HANDOFF.md`
- **Existing style guide (current look):** `style-guide/STYLE_GUIDE.md`, `style-guide/tokens.css`, `style-guide/components.md`

## 3. Where the design lives (the files to change)

Almost all styling is centralized, so a re-skin touches very few files:

| File | What it controls |
|---|---|
| `app/src/App.css` | **The whole design system.** ~707 lines, all CSS custom properties in a single `:root` block at the top, then every component class. This is the primary lever. |
| `app/index.html` | Google Fonts `<link>` (currently DM Sans + DM Mono). Change here if the new guide uses different typefaces. |
| `app/src/components/Charts.tsx` | ⚠️ **Recharts line/area colors are hardcoded hex** (e.g. `#4a7c9b`, `#5b9f5b`, `#e07a5f`, `#1b2a4a`), NOT CSS variables. These must be updated by hand to match the new palette. |
| `app/src/components/ConsumerView.tsx` | ⚠️ The consumer chart gradient also uses a hardcoded hex (`#4a7c9b`). Update to match. |

Everything else (layout, components, tooltips) reads from `App.css` tokens and
needs no edits.

## 4. Current design system (what you're replacing)

### Color tokens (`:root` in `app/src/App.css`)
```css
--primary: #4a7c9b;        /* steel blue — actions, links, eyebrow labels, focus */
--primary-hover: #3f6b87;
--navy: #1b2a4a;           /* headlines, body text */
--navy-deep: #0f1a2e;
--coral: #e07a5f;          /* alerts / loan balance line */
--teal: #2b7a78;
--green: #5b9f5b;          /* positive numbers */
--orange: #d4854a;
--red: #c75b5b;
--purple: #7b6b8d;
--sky: #7bb5d6;
--bg: #ffffff;
--bg-soft: #fbfcfd;
--secondary: #f5f6f8;      /* section backgrounds, input fills */
--accent-bg: #eef2f5;
--border: #e2e6ec;
--border-soft: rgba(226, 230, 236, 0.7);
--ink: #1b2a4a;
--muted: #5a6a80;          /* secondary text, captions */
```

### Typography
- **Sans:** `'DM Sans'` (weights 400–900). Headlines use **900** weight, `-0.025em` letter-spacing, `1.05` line-height. Body 15px / 1.6.
- **Mono:** `'DM Mono'` (400, 500) — used for all numbers, eyebrow/section labels, stat values, chart axes.
- Loaded via Google Fonts in `app/index.html`.

### Shape & depth
```css
--radius: 14px;  --radius-sm: 9px;  --radius-tile: 11px;
--shadow-lg: 0 12px 32px -12px rgba(27,42,74,0.12);
--shadow-xl: 0 20px 48px -16px rgba(27,42,74,0.15);
--ease: cubic-bezier(0.65, 0.05, 0.36, 1);
```

### Layout & component inventory (class names in `App.css`)
The app is a single advisor layout plus a client-facing consumer share view:

- **Header:** `header`, `header-actions`, `view-toggle` (Reset / Consumer view), `share-btn`
- **Scenario bar:** `scenario-bar`, `scenario-label`, `field` chips (Age, Home value, Liens, Cash draw), `assumptions-btn` (tinted-blue pill)
- **Hero row:** `hero3` → three `hero-card` (Total available / Cash now / Monthly for life) with `hero-card-label/value/note`
- **Stat strip:** `stat-strip` → `stat` (`stat-label`, `stat-value`) — PLF, rates, LOC, MIP, costs
- **Chart stage:** `stage` → `seg` segmented tabs (7: Credit line growth, Net worth, Equity vs balance, Invest comparison, Standby LOC, Sequence risk, Year table), `chart-card` → `chart-body` (Recharts), `chart-insight` (explainer line), `chart-caption`
- **Sequence Risk controls:** `seq-controls` (inline `field` chips)
- **Assumptions drawer (slide-over):** `drawer`, `drawer-overlay`, `drawer-head`, `drawer-close`, `section`, `field` / `field-input` / `field-toggle` / `prefix` / `suffix`, `drawer-done` (tinted-blue close button)
- **Banners & footers:** `warning-banner` (over-draw), `app-disclaimer` (+ `app-disclaimer-brand`)
- **Tooltips:** `infotip`, `infotip-bubble` (circle-i icon + hover bubble) — on every KPI and input label
- **Editable table:** `projection`, `projection-editable`, `table-wrap`, `sc-input`
- **Consumer share view:** `consumer`, `consumer-bar`, `consumer-hero`, `consumer-brand`, `consumer-cards` → `consumer-card-*`, `consumer-chart-card`, `consumer-callout`, `consumer-standby-*`, `consumer-explain`, `consumer-footer`, `consumer-prepared`

## 5. Constraints — do not break

- **Do not touch** anything under `app/src/engine/`, the `*.test.ts` files, `app/src/share.ts`, or any calculation/state logic.
- **Keep all class names and DOM structure** — restyle by changing token values and CSS rules, not by renaming classes or restructuring JSX (so the engine + tests + share links keep working).
- **Preserve accessibility:** keep readable contrast (WCAG AA for text), keep the info-tooltips legible, keep focus states visible.
- **Charts are not pure CSS** — remember to update the hardcoded hex in `Charts.tsx` and `ConsumerView.tsx` so chart lines match the new palette.
- **Light mode only** today (`color-scheme: light`). Add dark mode only if the new guide requires it.
- After changes, it must still `cd app && npm run build` clean and `npm test` green.

## 6. What I want back

1. A **token mapping table** (old value → new value) for every `:root` custom property.
2. The **updated `app/src/App.css`** (`:root` block + any component rules that need new values).
3. **Updated `app/index.html`** font `<link>` if the typeface changes.
4. **Updated chart color constants** in `Charts.tsx` / `ConsumerView.tsx`.
5. A short **visual QA checklist** (header, hero cards, stat strip, tabs, drawer, tooltips, charts, consumer view, disclaimer) so I can verify each surface matches the guide.

---

## 7. Prompt to paste into Claude Design

> You are restyling an existing, working React + Vite + TypeScript app — the
> **LendsightAI HECM Simulator** (live: https://hecm-var-simulator.vercel.app,
> repo: https://github.com/zentrader007/lendsighthecm) — to match the style guide
> I'm providing below. This is a **visual re-skin only**: do not change any
> calculation logic, component structure, DOM hierarchy, or class names — the app
> is validated by 50 passing tests and the math must stay identical.
>
> The entire design system lives in **`app/src/App.css`** as CSS custom
> properties in a single `:root` block, plus fonts in **`app/index.html`**.
> Chart colors are **hardcoded hex** in `app/src/components/Charts.tsx` and
> `app/src/components/ConsumerView.tsx` and must be updated by hand to match.
> The attached `DESIGN_HANDOFF.md` documents the current tokens, typography, and
> full component inventory — read it first.
>
> Apply my style guide to this app. Specifically:
> 1. Map every current `:root` token to the new guide and give me the old→new
>    mapping table.
> 2. Produce the updated `:root` block and any component CSS rules that need new
>    values, keeping all existing class names and selectors.
> 3. Update the font `<link>` in `index.html` if the typeface changes, and the
>    `--font-sans` / `--font-mono` tokens to match.
> 4. Update the hardcoded chart hex in `Charts.tsx` and `ConsumerView.tsx` to the
>    new palette (lines for: principal limit, LOC, equity, loan balance, net
>    worth, portfolio paths).
> 5. Preserve WCAG-AA text contrast, visible focus states, and legible tooltips.
> 6. Give me a per-surface visual QA checklist (header, scenario bar, hero cards,
>    stat strip, segmented tabs, assumptions drawer, tooltips, each chart, the
>    consumer share view, and the disclaimer footer).
>
> Keep it buildable: `cd app && npm run build` must stay clean and `npm test`
> must stay green.
>
> **MY FINAL STYLE GUIDE:**
> [PASTE YOUR STYLE GUIDE HERE — colors/tokens, type scale + fonts, radii,
> shadows, spacing, button & card styles, and any reference screenshots]
