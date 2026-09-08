import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { runSimulation } from './engine';
import type { SimulationInputs } from './engine';
import { defaultInputs } from './engine/defaults';
import { readSharedState, resolveSharedState, type SharedState } from './report/reportShare';
import { RedesignAdvisor } from './views/RedesignAdvisor';
import './App.css';

// The client's report view and the advisor's report builder both pull in
// Recharts; lazy-load them so the heavy charting library stays out of the
// initial bundle.
const ReportView = lazy(() => import('./report/ReportView').then((m) => ({ default: m.ReportView })));
const ReportBuilder = lazy(() =>
  import('./report/ReportBuilder').then((m) => ({ default: m.ReportBuilder })),
);

// Decoded synchronously at load; a compressed client link comes back
// 'pending' and finishes inflating in the effect below.
const initialShared = readSharedState();

export default function App() {
  const [shared, setShared] = useState<SharedState>(initialShared);
  const [inp, setInp] = useState<SimulationInputs>(initialShared.inputs ?? defaultInputs);
  // null = closed; otherwise the target age (if any) the advisor had marked
  // when they opened the builder, so the report starts with the same marker.
  const [presentation, setPresentation] = useState<{ targetAge?: number } | null>(null);

  useEffect(() => {
    if (initialShared.view !== 'pending') return;
    resolveSharedState().then((s) => {
      setShared(s);
      if (s.inputs) setInp(s.inputs);
    });
  }, []);

  const result = useMemo(() => runSimulation(inp), [inp]);

  if (shared.view === 'pending') {
    return <div className="chart-loading">Loading your plan…</div>;
  }

  // A `?r=` that can't be decoded was truncated or altered somewhere between
  // the advisor's clipboard and this browser. Say so — never quietly show the
  // default scenario as if it were the client's.
  if (shared.view === 'broken') {
    return (
      <div className="link-broken">
        <span className="link-broken-brand">LendsightAI</span>
        <h1>This link didn’t come through complete</h1>
        <p>
          The plan is encoded in the link itself, and part of it is missing or was changed along the
          way — this often happens when a long link is wrapped or shortened by an email or messaging
          app. Please ask your advisor to send the link again, or to send the plan as a PDF.
        </p>
      </div>
    );
  }

  // A `?r=` (or legacy consumer) link is the client's copy: render only the
  // report, with the exact inputs and configuration it was built with.
  if (shared.view === 'report' && shared.report) {
    return (
      <Suspense fallback={<div className="chart-loading">Loading your plan…</div>}>
        <ReportView inputs={inp} report={shared.report} />
      </Suspense>
    );
  }

  return (
    <>
      <RedesignAdvisor
        inp={inp}
        setInp={setInp}
        result={result}
        openPresentation={(targetAge) => setPresentation({ targetAge })}
      />
      {presentation && (
        <Suspense fallback={null}>
          <ReportBuilder
            inp={inp}
            result={result}
            targetAge={presentation.targetAge}
            onClose={() => setPresentation(null)}
          />
        </Suspense>
      )}
    </>
  );
}
