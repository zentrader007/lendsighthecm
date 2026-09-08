// The advisor's report generator: pick a preset or hand-pick sections,
// personalize, watch the document update live, then print it or copy the
// client's link. Rendered through a portal so print CSS can hide the app and
// emit only the pages.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SimulationInputs, SimulationResult } from '../engine';
import {
  SECTIONS,
  PRESET_LABELS,
  applyPreset,
  defaultReportConfig,
  moveSection,
  normalizeSections,
  resolveSections,
  toggleSection,
  todayISO,
  type AdvisorProfile,
  type ReportConfig,
  type ReportPreset,
  type SectionGroup,
} from './reportConfig';
import { buildReportData, sectionContext } from './reportData';
import { buildReportUrl, LIMITS } from './reportShare';
import { loadAdvisorProfile, saveAdvisorProfile } from './advisorProfile';
import { ReportDocument } from './ReportDocument';
import './report.css';

const GROUPS: readonly SectionGroup[] = ['Overview', 'Analysis', 'Details', 'Closing'];
const PRESETS: readonly Exclude<ReportPreset, 'custom'>[] = ['summary', 'standard', 'comprehensive'];
const PRESET_HINTS: Record<ReportPreset, string> = {
  summary: 'One page: headline numbers, two charts, and the plan’s milestones. Plus disclosures.',
  standard: 'A cover, the one-page summary, the options comparison, the four core charts, how it works, and disclosures.',
  comprehensive: 'Everything — adds the invest illustration, downturn protection, and the year-by-year table.',
  custom: 'Your own selection. Sections appear in the order shown; use the arrows to reorder.',
};
const PAGE_W = 816; // 8.5in at 96dpi

export function ReportBuilder({
  inp,
  result,
  onClose,
}: {
  inp: SimulationInputs;
  result: SimulationResult;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<ReportConfig>(() => defaultReportConfig(loadAdvisorProfile()));
  const [advisorOpen, setAdvisorOpen] = useState(() => !loadAdvisorProfile().name);
  const [copied, setCopied] = useState(false);

  const data = useMemo(() => buildReportData(inp, result), [inp, result]);
  const ctx = useMemo(() => sectionContext(data, config.notes), [data, config.notes]);
  const resolved = useMemo(() => resolveSections(config, ctx), [config, ctx]);
  const ordered = useMemo(() => normalizeSections(config.sections), [config.sections]);

  // Flag the builder on <body> so @media print hides the app root and emits
  // only the preview's pages.
  useEffect(() => {
    document.body.classList.add('rp-print', 'rp-print-builder');
    return () => document.body.classList.remove('rp-print', 'rp-print-builder');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setAdvisor = (patch: Partial<AdvisorProfile>) =>
    setConfig((c) => {
      const advisor = { ...c.advisor, ...patch };
      saveAdvisorProfile(advisor);
      return { ...c, advisor };
    });

  // The link freezes today's date so the client's copy reads "prepared" on the
  // day it was sent, even if opened months later.
  const linkFor = useCallback(() => buildReportUrl(inp, { ...config, preparedOn: todayISO() }), [inp, config]);

  // The last link built, shown read-only under the actions so the advisor can
  // see exactly what was copied (and re-copy it by hand if the clipboard
  // misbehaves).
  const [lastLink, setLastLink] = useState('');

  const copyLink = async () => {
    const url = await linkFor();
    setLastLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this client link:', url);
    }
  };
  const openAsClient = async () => {
    const url = await linkFor();
    setLastLink(url);
    window.open(url, '_blank', 'noopener');
  };
  const print = () => window.print();

  const ui = (
    <div className="rp-builder" role="dialog" aria-label="Client presentation">
      <div className="rp-builder-top">
        <h2>Client Presentation</h2>
        <span className="rp-builder-pages">
          {PRESET_LABELS[config.preset]} · {resolved.length} page{resolved.length === 1 ? '' : 's'}
        </span>
        <div className="rp-builder-actions">
          <button className="view-toggle" onClick={openAsClient}>
            Open as client
          </button>
          <button className="view-toggle" onClick={copyLink}>
            {copied ? '✓ Link copied' : 'Copy client link'}
          </button>
          <button className="share-btn" onClick={print}>
            Print / Save as PDF
          </button>
          <button className="view-toggle" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
      </div>
      {lastLink && (
        <div className="rp-linkbar">
          <span className="rp-linkbar-label">Client link · {lastLink.length} characters</span>
          <input className="rp-linkbar-input" readOnly value={lastLink} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}

      <div className="rp-builder-main">
        <aside className="rp-builder-rail">
          <div className="rp-rail-group">
            <h3>Report</h3>
            <div className="rp-presets">
              {PRESETS.map((p) => (
                <button key={p} className={config.preset === p ? 'active' : ''} onClick={() => setConfig((c) => applyPreset(c, p))}>
                  {PRESET_LABELS[p]}
                </button>
              ))}
              {config.preset === 'custom' && <button className="active">Custom</button>}
            </div>
            <p className="rp-preset-hint">{PRESET_HINTS[config.preset]}</p>
          </div>

          <div className="rp-rail-group">
            <h3>Sections</h3>
            {GROUPS.map((g) => {
              const items = SECTIONS.filter((s) => s.group === g && (!s.available || s.available(ctx)));
              if (!items.length) return null;
              return (
                <div key={g} className="rp-sec-group">
                  <p className="rp-sec-group-name">{g}</p>
                  {items.map((s) => {
                    const on = ordered.includes(s.key);
                    const idx = ordered.indexOf(s.key);
                    const id = `rp-sec-${s.key}`;
                    return (
                      <div key={s.key} className={`rp-sec${on ? '' : ' rp-sec-off'}`}>
                        <input
                          id={id}
                          type="checkbox"
                          checked={on}
                          disabled={s.locked}
                          onChange={(e) => setConfig((c) => toggleSection(c, s.key, e.target.checked))}
                        />
                        <div>
                          <label htmlFor={id} className="rp-sec-label">
                            {s.label}
                          </label>
                          <div className="rp-sec-desc">{s.description}</div>
                        </div>
                        {s.locked ? (
                          <span className="rp-sec-locked">always</span>
                        ) : on ? (
                          <div className="rp-sec-move">
                            <button title="Move earlier" disabled={idx <= 0} onClick={() => setConfig((c) => moveSection(c, s.key, -1))}>
                              ▲
                            </button>
                            <button title="Move later" disabled={idx >= ordered.length - 2} onClick={() => setConfig((c) => moveSection(c, s.key, 1))}>
                              ▼
                            </button>
                          </div>
                        ) : (
                          <span />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="rp-rail-group">
            <h3>Client</h3>
            <div className="rp-field">
              <label htmlFor="rp-client">Client name</label>
              <input
                id="rp-client"
                value={config.client.name}
                maxLength={LIMITS.clientName}
                placeholder="e.g. Jim & Mary Smith"
                onChange={(e) => setConfig((c) => ({ ...c, client: { name: e.target.value } }))}
              />
            </div>
            <div className="rp-field">
              <label htmlFor="rp-notes">Your recommendation</label>
              <textarea
                id="rp-notes"
                value={config.notes}
                maxLength={LIMITS.notes}
                placeholder="What you recommend and why, and what happens next. Blank lines start new paragraphs. Appears on the options page and its own page."
                onChange={(e) => setConfig((c) => ({ ...c, notes: e.target.value }))}
              />
              <span className="rp-field-hint">
                {config.notes.length} / {LIMITS.notes}
              </span>
            </div>
          </div>

          <div className="rp-rail-group">
            <h3>Advisor</h3>
            <button className="rp-advisor-toggle" onClick={() => setAdvisorOpen((o) => !o)}>
              {advisorOpen ? '▾ ' : '▸ '}
              {config.advisor.name ? `${config.advisor.name}${config.advisor.company ? ` · ${config.advisor.company}` : ''}` : 'Add your details'}
            </button>
            {advisorOpen && (
              <div style={{ marginTop: 10 }}>
                <div className="rp-field">
                  <label htmlFor="rp-adv-name">Name</label>
                  <input id="rp-adv-name" value={config.advisor.name} maxLength={LIMITS.advisorField} onChange={(e) => setAdvisor({ name: e.target.value })} />
                </div>
                <div className="rp-field">
                  <label htmlFor="rp-adv-company">Company</label>
                  <input id="rp-adv-company" value={config.advisor.company} maxLength={LIMITS.advisorField} onChange={(e) => setAdvisor({ company: e.target.value })} />
                </div>
                <div className="rp-field-row">
                  <div className="rp-field">
                    <label htmlFor="rp-adv-nmls">NMLS #</label>
                    <input id="rp-adv-nmls" value={config.advisor.nmls} maxLength={40} onChange={(e) => setAdvisor({ nmls: e.target.value })} />
                  </div>
                  <div className="rp-field">
                    <label htmlFor="rp-adv-phone">Phone</label>
                    <input id="rp-adv-phone" value={config.advisor.phone} maxLength={40} onChange={(e) => setAdvisor({ phone: e.target.value })} />
                  </div>
                </div>
                <div className="rp-field">
                  <label htmlFor="rp-adv-email">Email</label>
                  <input id="rp-adv-email" value={config.advisor.email} maxLength={LIMITS.advisorField} onChange={(e) => setAdvisor({ email: e.target.value })} />
                </div>
                <span className="rp-field-hint">Remembered in this browser for next time.</span>
              </div>
            )}
          </div>
        </aside>

        <ScaledPreview>
          <ReportDocument inputs={inp} result={result} config={config} layout="fixed" />
        </ScaledPreview>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}

/**
 * Shows letter-size pages scaled down to fit the pane. A CSS transform (not
 * `zoom`) so the pages keep their real 816px layout width — the charts measure
 * the same size on screen as they will in print.
 */
function ScaledPreview({ children }: { children: React.ReactNode }) {
  const paneRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    const doc = docRef.current;
    if (!pane || !doc) return;
    const update = () => {
      const s = Math.min(1, (pane.clientWidth - 48) / PAGE_W);
      setScale(s);
      setHeight(doc.offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(pane);
    ro.observe(doc);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="rp-preview" ref={paneRef}>
      <div className="rp-preview-inner" style={{ width: PAGE_W * scale, height }}>
        <div className="rp-scaled" ref={docRef} style={{ transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
