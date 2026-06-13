import { lazy, Suspense, useMemo, useState } from 'react';
import { runSimulation } from './engine';
import type { SimulationInputs } from './engine';
import { defaultInputs } from './engine/defaults';
import { readSharedState, buildShareUrl } from './share';
import { ClassicAdvisor } from './views/ClassicAdvisor';
import { RedesignAdvisor } from './views/RedesignAdvisor';
import type { LayoutKind } from './views/types';
import './App.css';

// The consumer view pulls in Recharts; lazy-load it so the heavy charting
// library stays out of the initial bundle.
const ConsumerView = lazy(() =>
  import('./components/ConsumerView').then((m) => ({ default: m.ConsumerView })),
);

const shared = readSharedState();
// The redesigned layout is the default; ?layout=classic serves the original.
const initialLayout: LayoutKind =
  new URLSearchParams(window.location.search).get('layout') === 'classic' ? 'classic' : 'v2';

export default function App() {
  const [inp, setInp] = useState<SimulationInputs>(shared.inputs ?? defaultInputs);
  const [view, setView] = useState<'advisor' | 'consumer'>(shared.view);
  const [layout, setLayout] = useState<LayoutKind>(initialLayout);
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

  // Keep ?layout= in the URL so each layout has a stable, shareable address.
  const switchLayout = (l: LayoutKind) => {
    setLayout(l);
    const url = new URL(window.location.href);
    if (l === 'classic') url.searchParams.set('layout', 'classic');
    else url.searchParams.delete('layout');
    window.history.replaceState(null, '', url);
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

  const props = {
    inp,
    setInp,
    result,
    copied,
    share,
    goConsumer: () => setView('consumer'),
    switchLayout,
  };

  return layout === 'v2' ? <RedesignAdvisor {...props} /> : <ClassicAdvisor {...props} />;
}
