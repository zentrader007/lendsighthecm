// Client-presentation links: `?r=<base64url>` carrying the scenario inputs AND
// the report configuration, so the client opens exactly the document the
// advisor built — same numbers, same sections, same notes — with no server.
// Legacy `?view=consumer&d=<inputs>` links (sent before the presentation
// existed) still open, as a Standard report with no personalization.
import type { SimulationInputs } from '../engine';
import { toBase64Url, fromBase64Url, inputsFromJson } from '../share';
import {
  defaultReportConfig,
  emptyAdvisor,
  normalizeSections,
  presetFor,
  todayISO,
  SECTION_BY_KEY,
  type AdvisorProfile,
  type ReportConfig,
  type SectionKey,
} from './reportConfig';

export interface ReportPayload {
  inputs: SimulationInputs;
  report: ReportConfig;
}

export const LIMITS = {
  clientName: 80,
  advisorField: 120,
  notes: 2000,
} as const;

// Strip control characters (keeping newlines/tabs so notes keep their
// paragraphs) and cap the length.
const isPrintable = (ch: string) => {
  const c = ch.charCodeAt(0);
  return c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127);
};
const str = (v: unknown, max: number): string =>
  typeof v === 'string' ? Array.from(v).filter(isPrintable).join('').slice(0, max) : '';

export function sanitizeAdvisor(raw: unknown): AdvisorProfile {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    name: str(a.name, LIMITS.advisorField),
    company: str(a.company, LIMITS.advisorField),
    nmls: str(a.nmls, 40),
    phone: str(a.phone, 40),
    email: str(a.email, LIMITS.advisorField),
  };
}

/** Coerce an untrusted parsed object into a valid ReportConfig: unknown
 *  sections dropped, strings capped, missing fields defaulted. */
export function sanitizeReportConfig(raw: unknown): ReportConfig {
  const base = defaultReportConfig(emptyAdvisor);
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const sections = Array.isArray(r.sections)
    ? normalizeSections(r.sections.filter((k): k is SectionKey => typeof k === 'string' && k in SECTION_BY_KEY))
    : base.sections;
  const client = (r.client && typeof r.client === 'object' ? r.client : {}) as Record<string, unknown>;
  const preparedRaw = str(r.preparedOn, 10);
  return {
    v: 1,
    preset: presetFor(sections),
    sections,
    client: { name: str(client.name, LIMITS.clientName) },
    advisor: sanitizeAdvisor(r.advisor),
    notes: str(r.notes, LIMITS.notes),
    preparedOn: /^\d{4}-\d{2}-\d{2}$/.test(preparedRaw) ? preparedRaw : todayISO(),
  };
}

export function encodeReport(inputs: SimulationInputs, report: ReportConfig): string {
  return toBase64Url({ i: inputs, r: report });
}

export function decodeReport(s: string): ReportPayload | null {
  const parsed = fromBase64Url(s);
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as { i?: unknown; r?: unknown };
  const inputs = inputsFromJson(p.i);
  if (!inputs) return null;
  return { inputs, report: sanitizeReportConfig(p.r) };
}

export function buildReportUrl(inputs: SimulationInputs, report: ReportConfig): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?r=${encodeReport(inputs, report)}`;
}

export interface SharedState {
  view: 'advisor' | 'report';
  inputs: SimulationInputs | null;
  report: ReportConfig | null;
}

/** What the URL asks for on load. `?r=` wins; a legacy consumer link maps to a
 *  Standard report; a bare `?d=` opens the advisor with those inputs. */
export function readSharedState(search: string = window.location.search): SharedState {
  const params = new URLSearchParams(search);
  const r = params.get('r');
  if (r) {
    const payload = decodeReport(r);
    if (payload) return { view: 'report', inputs: payload.inputs, report: payload.report };
  }
  const d = params.get('d');
  const inputs = d ? inputsFromJson(fromBase64Url(d)) : null;
  if (inputs && params.get('view') === 'consumer') {
    return { view: 'report', inputs, report: sanitizeReportConfig({ preset: 'standard' }) };
  }
  return { view: 'advisor', inputs, report: null };
}
