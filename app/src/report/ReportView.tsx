// What the client sees at a `?r=` link: the report, nothing else. A slim bar
// with section links and a Save-as-PDF button; no advisor controls and no way
// into the simulator.
import { useEffect, useMemo } from 'react';
import type { SimulationInputs } from '../engine';
import { SECTION_BY_KEY, type ReportConfig } from './reportConfig';
import { reportSections } from './reportData';
import { ReportDocument } from './ReportDocument';
import './report.css';

export function ReportView({ inputs, report }: { inputs: SimulationInputs; report: ReportConfig }) {
  const sections = useMemo(() => reportSections(inputs, report), [inputs, report]);
  const nav = sections.filter((k) => k !== 'cover' && k !== 'disclosures');

  useEffect(() => {
    document.body.classList.add('rp-print');
    document.title = report.client.name.trim()
      ? `${report.client.name.trim()} — Reverse Mortgage Plan`
      : 'Your Reverse Mortgage Plan';
    return () => document.body.classList.remove('rp-print');
  }, [report.client.name]);

  return (
    <div className="rp-view">
      <div className="rp-viewbar">
        <span className="rp-viewbar-brand">LendsightAI</span>
        <nav className="rp-viewbar-nav">
          {nav.map((k) => (
            <a key={k} href={`#rp-${k}`}>
              {SECTION_BY_KEY[k].label}
            </a>
          ))}
        </nav>
        <button className="share-btn" onClick={() => window.print()}>
          Save as PDF
        </button>
      </div>
      <ReportDocument inputs={inputs} config={report} layout="flow" />
    </div>
  );
}
