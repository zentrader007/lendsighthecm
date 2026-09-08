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
  src/views/             RedesignAdvisor layout
  src/components/        Charts, fields, projection table
  src/report/            Client Presentation: report config, `?r=` link encoding,
                         options comparison, the report document + sections, the
                         advisor's builder, and the client's link view
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

- **Client Presentation** (header button) opens a report generator: pick a
  preset (1-page summary / Standard / Comprehensive) or hand-pick and reorder
  sections, add the client's name, your advisor profile (remembered in the
  browser), and a written recommendation, then **Print / Save as PDF** (browser
  print, portrait letter, one section per page) or **Copy client link**.
- Client links are `?r=<base64>` and carry the scenario inputs *and* the report
  configuration, so the client opens exactly the document you built — no
  database. Legacy `?view=consumer&d=` links still open, as a Standard report.
- A bare `?d=<base64>` link opens the advisor with those inputs.
- Figures are educational estimates, not a loan offer or financial advice.
