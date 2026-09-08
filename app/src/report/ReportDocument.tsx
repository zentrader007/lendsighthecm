// The report itself: an ordered stack of pages, each one section. Rendered
// identically in the builder's live preview, the client's link, and print —
// so the PDF and the digital view can never differ.
import { useMemo } from 'react';
import type { SimulationInputs, SimulationResult } from '../engine';
import { buildReportData, sectionContext } from './reportData';
import { formatPreparedOn, resolveSections, type ReportConfig, type SectionKey } from './reportConfig';
import type { SectionProps } from './sections/types';
import { Cover } from './sections/Cover';
import { Summary } from './sections/Summary';
import { Options } from './sections/Options';
import { ChartSection, type ChartSectionKey } from './sections/ChartSection';
import { YearTable } from './sections/YearTable';
import { Notes } from './sections/Notes';
import { HowItWorks } from './sections/HowItWorks';
import { Disclosures } from './sections/Disclosures';
import './report.css';

const CHART_SECTIONS: readonly SectionKey[] = ['loc', 'spending', 'networth', 'equity', 'invest', 'seqrisk'];

function renderSection(key: SectionKey, props: SectionProps) {
  switch (key) {
    case 'cover':
      return <Cover {...props} />;
    case 'summary':
      return <Summary {...props} />;
    case 'options':
      return <Options {...props} />;
    case 'table':
      return <YearTable {...props} />;
    case 'notes':
      return <Notes {...props} />;
    case 'howItWorks':
      return <HowItWorks {...props} />;
    case 'disclosures':
      return <Disclosures {...props} />;
    default:
      return CHART_SECTIONS.includes(key) ? <ChartSection {...props} section={key as ChartSectionKey} /> : null;
  }
}

export function ReportDocument({
  inputs,
  result,
  config,
  layout,
}: {
  inputs: SimulationInputs;
  result?: SimulationResult;
  config: ReportConfig;
  /** 'fixed' = letter-size pages (builder preview / print); 'flow' = responsive (client link). */
  layout: 'fixed' | 'flow';
}) {
  const data = useMemo(() => buildReportData(inputs, result), [inputs, result]);
  const sections = useMemo(() => resolveSections(config, sectionContext(data, config.notes)), [config, data]);
  const total = sections.length;
  const client = config.client.name.trim();
  const a = config.advisor;
  const advisorLine = [a.name, a.company, a.nmls ? `NMLS #${a.nmls}` : '', a.phone, a.email].filter(Boolean).join(' · ');

  return (
    <div className={`rp-doc rp-${layout}`}>
      {sections.map((key, i) => {
        const props: SectionProps = { data, config, sections };
        const isCover = key === 'cover';
        return (
          <section key={key} id={`rp-${key}`} className={`rp-page rp-page-${key}${isCover ? ' rp-page-cover' : ''}`}>
            {!isCover && (
              <div className="rp-head">
                <span className="rp-head-left">
                  <strong>{client || 'Reverse Mortgage Plan'}</strong>
                  {client ? ' · Reverse Mortgage Plan' : ''}
                </span>
                <span className="rp-head-right">{formatPreparedOn(config.preparedOn)}</span>
              </div>
            )}
            <div className="rp-body">{renderSection(key, props)}</div>
            <div className="rp-foot">
              <span className="rp-foot-left">{advisorLine || 'Prepared with LendsightAI'}</span>
              <span className="rp-foot-note">Estimate for education only — not a loan offer</span>
              <span className="rp-foot-right">
                {i + 1} / {total}
              </span>
            </div>
          </section>
        );
      })}
    </div>
  );
}
