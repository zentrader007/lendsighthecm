import { lazy, Suspense, useMemo, useState } from 'react';
import { runSimulation } from './engine';
import type { SimulationInputs } from './engine';
import { defaultInputs } from './engine/defaults';
import { readSharedState, buildShareUrl } from './share';
import { RedesignAdvisor } from './views/RedesignAdvisor';
import './App.css';

// The consumer view pulls in Recharts; lazy-load it so the heavy charting
// library stays out of the initial bundle.
const ConsumerView = lazy(() =>
  import('./components/ConsumerView').then((m) => ({ default: m.ConsumerView })),
);

const shared = readSharedState();

export default function App() {
  const [inp, setInp] = useState<SimulationInputs>(shared.inputs ?? defaultInputs);
  const [view, setView] = useState<'advisor' | 'consumer'>(shared.view);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => runSimulation(inp), [inp]);

  const share = async () => {
    const url = buildShareUrl(inp);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this shareable consumer link:', url);
    }
  };

  if (view === 'consumer') {
    return (
      <div className="app">
        <div className="consumer-bar">
          <button onClick={() => setView('advisor')}>← Advisor view</button>
          <button className="share-btn" onClick={share}>
            {copied ? '✓ Link copied' : 'Copy share link'}
          </button>
        </div>
        <Suspense fallback={<div className="chart-loading">Loading…</div>}>
          <ConsumerView inputs={inp} result={result} />
        </Suspense>
      </div>
    );
  }

  return (
    <RedesignAdvisor
      inp={inp}
      setInp={setInp}
      result={result}
      copied={copied}
      share={share}
      goConsumer={() => setView('consumer')}
    />
  );
}
