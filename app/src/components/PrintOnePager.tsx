// Landscape print one-pager: a single-sheet snapshot of the plan an advisor
// can hand a client. Rendered through a portal so print CSS can hide the app
// and emit only the sheet; charts are fixed-size (no ResponsiveContainer) so
// the printed layout is deterministic. Uses the app's Debt.Done.Date palette.
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import type { SimulationInputs, SimulationResult } from '../engine';
import { runMortgageComparison } from '../engine/comparison';
import { runAvailableSpending } from '../engine/spending';
import { usd, pct } from '../format';

const NAVY = '#1b2a4a';
const BLUE = '#4a7c9b';
const GREEN = '#5b9f5b';
const CORAL = '#e07a5f';

const fmtK = (n: number) => `$${Math.round(n / 1000)}k`;
const tickStyle = { fontSize: 9, fontWeight: 700, fontFamily: 'DM Mono, monospace', fill: NAVY };

export function PrintOnePager({
  inp,
  result,
  onClose,
}: {
  inp: SimulationInputs;
  result: SimulationResult;
  onClose: () => void;
}) {
  const cmp = useMemo(() => runMortgageComparison(inp), [inp]);
  const spending = useMemo(() => runAvailableSpending(inp), [inp]);

  // Flag the print mode on <body> so @media print can hide the app root and
  // emit only this sheet.
  useEffect(() => {
    document.body.classList.add('op-print');
    return () => document.body.classList.remove('op-print');
  }, []);

  const hasLien = inp.existingLiens > 0;
  const data = result.projection.map((r) => ({
    age: r.age,
    homeValue: r.homeValue,
    upb: r.upb,
    equity: r.equity,
    availableLOC: r.availableLOC,
  }));

  // Anchor the plan readouts to a realistic horizon (~age 85), matching the
  // in-app honesty ledger.
  const ref85 = spending.rows.find((r) => r.age >= 85) ?? spending.rows[spending.rows.length - 1];
  const proj85 =
    result.projection.find((r) => r.age >= 85) ?? result.projection[result.projection.length - 1];

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sheet = (
    <div className="op-overlay">
      <div className="op-toolbar">
        <button className="share-btn" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <button className="view-toggle" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="op-sheet">
        {/* ── Header ── */}
        <div className="op-head">
          <div>
            <div className="op-brand">LendsightAI</div>
            <div className="op-title">Reverse Mortgage Plan Snapshot</div>
          </div>
          <div className="op-scenario">
            <div className="op-scenario-row">
              <span>Age <strong>{inp.age}</strong></span>
              <span>Home value <strong>{usd(inp.homeValue)}</strong></span>
              <span>Mortgage paid off <strong>{usd(inp.existingLiens)}</strong></span>
              <span>Cash at closing <strong>{usd(inp.initialCashDraw)}</strong></span>
            </div>
            <div className="op-scenario-sub">
              Prepared {today} · Expected rate {pct(result.expectedRate, 3)} · Initial rate{' '}
              {pct(result.initialRate, 3)} · PLF {pct(result.plf, 1)} · Appreciation{' '}
              {pct(inp.appreciation, 1)}
            </div>
          </div>
        </div>

        {/* ── Headline stats ── */}
        <div className="op-stats">
          <div className="op-stat op-stat-primary">
            <span className="op-stat-label">Cash available now</span>
            <span className="op-stat-value">{usd(result.availableInitialDraw)}</span>
            <span className="op-stat-note">Most cash accessible in year one</span>
          </div>
          <div className="op-stat">
            <span className="op-stat-label">Total funds available</span>
            <span className="op-stat-value">{usd(result.principalLimit)}</span>
            <span className="op-stat-note">Principal limit over the loan's life</span>
          </div>
          <div className="op-stat">
            <span className="op-stat-label">Monthly for life</span>
            <span className="op-stat-value">{usd(result.maxTenurePayment)}</span>
            <span className="op-stat-note">If taken as a tenure payment instead</span>
          </div>
          <div className="op-stat">
            <span className="op-stat-label">Credit line that grows</span>
            <span className="op-stat-value">{usd(result.remainingCredit)}</span>
            <span className="op-stat-note">Unused funds grow every year</span>
          </div>
        </div>

        {/* ── Body: charts + plan rail ── */}
        <div className="op-body">
          <div className="op-charts">
            <div className="op-chart">
              <h4>Line of credit growth</h4>
              <LineChart width={430} height={172} data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
                <XAxis dataKey="age" tick={tickStyle} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={fmtK} tick={tickStyle} tickLine={false} width={44} />
                <Legend wrapperStyle={{ fontSize: 9.5 }} />
                <Line type="monotone" dataKey="availableLOC" name="Available credit line" stroke={BLUE} dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line type="monotone" dataKey="equity" name="Home equity" stroke={GREEN} dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </div>
            <div className="op-chart">
              <h4>Home value, loan balance &amp; equity</h4>
              <LineChart width={430} height={172} data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
                <XAxis dataKey="age" tick={tickStyle} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={fmtK} tick={tickStyle} tickLine={false} width={44} />
                <Legend wrapperStyle={{ fontSize: 9.5 }} />
                <Line type="monotone" dataKey="homeValue" name="Home value" stroke={BLUE} dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line type="monotone" dataKey="equity" name="Equity" stroke={GREEN} dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line type="monotone" dataKey="upb" name="Loan balance" stroke={CORAL} dot={false} strokeWidth={2} strokeDasharray="5 3" isAnimationActive={false} />
              </LineChart>
            </div>
          </div>

          <div className="op-rail">
            {spending.totalAvailable > 0 && (
              <div className="op-panel op-panel-green">
                <div className="op-panel-head">New spending this plan creates</div>
                {spending.lumpSum > 0 && (
                  <div className="op-line">
                    <span>Lump sum at closing</span>
                    <strong>{usd(spending.lumpSum)}</strong>
                  </div>
                )}
                {spending.totalCreditDraws > 0 && (
                  <div className="op-line">
                    <span>Planned credit-line draws</span>
                    <strong>{usd(spending.totalCreditDraws)}</strong>
                  </div>
                )}
                {spending.annualFreed > 0 && (
                  <div className="op-line">
                    <span>Freed mortgage payment</span>
                    <strong>
                      {usd(spending.monthlyFreed)}/mo · {spending.freedYears} yrs
                    </strong>
                  </div>
                )}
                <div className="op-line">
                  <span>First-year total</span>
                  <strong>{usd(spending.firstYearTotal)}</strong>
                </div>
                <div className="op-line">
                  <span>Total by age {ref85.age}</span>
                  <strong>{usd(ref85.cumulative)}</strong>
                </div>
              </div>
            )}

            <div className="op-panel op-panel-navy">
              <div className="op-panel-head">What it costs — at age {ref85.age}</div>
              <div className="op-line">
                <span>Most owed (non-recourse cap)</span>
                <strong>{usd(Math.min(ref85.loanBalance, ref85.homeValue))}</strong>
              </div>
              <div className="op-line">
                <span>Home equity remaining</span>
                <strong>{usd(ref85.equityWith)}</strong>
              </div>
              <div className="op-line">
                <span>Equity if doing nothing</span>
                <strong>{usd(ref85.equityWithout)}</strong>
              </div>
              <div className="op-panel-note">
                FHA-insured &amp; non-recourse: at sale, you or your heirs never repay more than the
                home is worth — the MIP-funded insurance covers any shortfall.
              </div>
            </div>

            <div className="op-panel">
              <div className="op-panel-head">Plan milestones</div>
              {hasLien && cmp.annualMortgagePayment > 0 && (
                <div className="op-line">
                  <span>Monthly payment eliminated</span>
                  <strong>{usd(cmp.monthlyMortgagePayment)}/mo</strong>
                </div>
              )}
              {cmp.breakEvenAge != null && (
                <div className="op-line">
                  <span>Net worth pulls ahead</span>
                  <strong>age {cmp.breakEvenAge}</strong>
                </div>
              )}
              {cmp.noHecmDepletionAge != null && (
                <div className="op-line">
                  <span>Savings last longer</span>
                  <strong>
                    to age {cmp.hecmDepletionAge ?? `${result.projection[result.projection.length - 1].age}+`} vs{' '}
                    {cmp.noHecmDepletionAge} without
                  </strong>
                </div>
              )}
              <div className="op-line">
                <span>Credit line by age {proj85.age}</span>
                <strong>{usd(proj85.availableLOC)}</strong>
              </div>
              <div className="op-line">
                <span>Equity for heirs at {proj85.age}</span>
                <strong>{usd(proj85.equity)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ── Disclosures ── */}
        <div className="op-disclosure">
          <strong>Important disclosures.</strong> This document is <strong>not a loan offer</strong>,
          commitment to lend, or approval of any kind. It is a mathematical{' '}
          <strong>simulation for educational purposes only</strong>, based on the assumptions shown,
          and <strong>must be reviewed with a licensed reverse mortgage lender</strong> before any
          decision is made. Actual rates, fees, eligibility, and terms are set by the lender and HUD
          guidelines at the time of application and will differ from this illustration. Borrowers
          remain responsible for property taxes, homeowner's insurance, and home maintenance. A HECM
          is a non-recourse, FHA-insured loan: neither the borrower nor the heirs will ever owe more
          than the home's value when the loan is repaid. Please consult a HUD-approved counselor.
          <span className="op-prepared"> Prepared with LendsightAI · Certified Liability Advisor</span>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
