# LendsightAI HECM Simulator

A variable-rate HECM (reverse mortgage) simulator built from the V8.5.1 Excel
workbook as a React + Vite + TypeScript app. It reproduces the workbook's HECM
math exactly (validated by a golden-master test suite) and adds advisor-facing
analyses: line-of-credit growth, net worth, equity vs. balance, an
invest-the-proceeds comparison, a standby-LOC strategy view, and a
sequence-of-returns ("bridge spending from the LOC vs. sell assets in a
downturn") analysis.

**Live:** https://hecm-var-simulator.vercel.app

## Project layout

```
app/                     The Vite + React + TypeScript application
  src/engine/            HECM simulation engine (PLF, principal limit, 38-yr
                         projection, standby LOC, sequence-risk) + tests
  src/views/             RedesignAdvisor (default) and ClassicAdvisor layouts
  src/components/        Charts, fields, consumer share view, projection table
  data/                  HUD PLF table and historical CMT data (JSON)
style-guide/             Brand / design reference
vercel.json              Static deployment config (builds from app/)
00 Variable Rate HECM Simulator V8.5.1.xlsx   Source workbook (spec of record)
```

## Develop

```bash
cd app
npm install
npm run dev      # local dev server
npm test         # Vitest engine + share-link suites
npm run build    # type-check + production build
```

## Notes

- Scenarios are shareable via a base64-encoded `?d=` URL param (no database).
  `?layout=classic` opens the original sidebar layout; the default is the
  redesigned layout.
- Figures are educational estimates, not a loan offer or financial advice.
