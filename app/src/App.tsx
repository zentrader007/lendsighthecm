import { lazy, Suspense, useMemo, useState } from 'react';
import { runSimulation } from './engine';
import type { SimulationInputs } from './engine';
import { defaultInputs } from './engine/defaults';
import { readSharedState } from './report/reportShare';
import { RedesignAdvisor } from './views/RedesignAdvisor';
import './App.css';

// The client's report view and the advisor's report builder both pull in
// Recharts; lazy-load them so the heavy charting library stays out of the
// initial bundle.
const ReportView = lazy(() => import('./report/ReportView').then((m) => ({ default: m.ReportView })));
const ReportBuilder = lazy(() =>
  import('./report/ReportBuilder').then((m) => ({ default: m.ReportBuilder })),
);

const shared = readSharedState();

export default function App() {
  const [inp, setInp] = useState<SimulationInputs>(shared.inputs ?? defaultInputs);
  const [presentationOpen, setPresentationOpen] = useState(false);

  const result = useMemo(() => runSimulation(inp), [inp]);

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
        openPresentation={() => setPresentationOpen(true)}
      />
      {presentationOpen && (
        <Suspense fallback={null}>
          <ReportBuilder inp={inp} result={result} onClose={() => setPresentationOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
