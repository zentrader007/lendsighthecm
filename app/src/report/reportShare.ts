// Client-presentation links: `?r=<base64url>` carrying the scenario inputs AND
// the report configuration, so the client opens exactly the document the
// advisor built — same numbers, same sections, same notes — with no server.
// Legacy `?view=consumer&d=<inputs>` links (sent before the presentation
// existed) still open, as a Standard report with no personalization.
import type { SimulationInputs } from '../engine';
import {
  toBase64Url,
  fromBase64Url,
  inputsFromJson,
  canCompress,
  toCompressedBase64Url,
  fromCompressedBase64Url,
} from '../share';
import {
  defaultReportConfig,
  emptyAdvisor,
  normalizeSections,
  presetFor,
  sanitizeTargetAge,
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
    targetAge: sanitizeTargetAge(r.targetAge),
  };
}

// A `~` prefix (URL-unreserved, not in the base64url alphabet) marks a
// deflated payload; without it the payload is plain base64url JSON.
const COMPRESSED_PREFIX = '~';

/** Plain (uncompressed) encoding — the fallback, and what tests use. */
export function encodeReport(inputs: SimulationInputs, report: ReportConfig): string {
  return toBase64Url({ i: inputs, r: report });
}

/** Compressed when the browser can; about a third the length of the plain form. */
export async function encodeReportCompact(inputs: SimulationInputs, report: ReportConfig): Promise<string> {
  if (!canCompress()) return encodeReport(inputs, report);
  return COMPRESSED_PREFIX + (await toCompressedBase64Url({ i: inputs, r: report }));
}

function payloadFromJson(parsed: unknown): ReportPayload | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as { i?: unknown; r?: unknown };
  const inputs = inputsFromJson(p.i);
  if (!inputs) return null;
  return { inputs, report: sanitizeReportConfig(p.r) };
}

export const isCompressedPayload = (s: string): boolean => s.startsWith(COMPRESSED_PREFIX);

/** Decode a plain payload. Returns null for a compressed one — use decodeReportAsync. */
export function decodeReport(s: string): ReportPayload | null {
  if (isCompressedPayload(s)) return null;
  return payloadFromJson(fromBase64Url(s));
}

export async function decodeReportAsync(s: string): Promise<ReportPayload | null> {
  if (!isCompressedPayload(s)) return decodeReport(s);
  if (!canCompress()) return null;
  return payloadFromJson(await fromCompressedBase64Url(s.slice(COMPRESSED_PREFIX.length)));
}

export async function buildReportUrl(inputs: SimulationInputs, report: ReportConfig): Promise<string> {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?r=${await encodeReportCompact(inputs, report)}`;
}

export interface SharedState {
  /** 'pending' = a compressed `?r=` still inflating; 'broken' = a `?r=` that
   *  could not be decoded (truncated or mangled in transit). */
  view: 'advisor' | 'report' | 'pending' | 'broken';
  inputs: SimulationInputs | null;
  report: ReportConfig | null;
}

/** What the URL asks for on load, synchronously. `?r=` wins (a compressed one
 *  comes back 'pending' — finish with resolveSharedState); a legacy consumer
 *  link maps to a Standard report; a bare `?d=` opens the advisor with those
 *  inputs. An undecodable `?r=` is reported as 'broken', never silently
 *  replaced by the defaults. */
export function readSharedState(search: string = window.location.search): SharedState {
  const params = new URLSearchParams(search);
  const r = params.get('r');
  if (r) {
    if (isCompressedPayload(r)) return { view: 'pending', inputs: null, report: null };
    const payload = decodeReport(r);
    return payload
      ? { view: 'report', inputs: payload.inputs, report: payload.report }
      : { view: 'broken', inputs: null, report: null };
  }
  const d = params.get('d');
  const inputs = d ? inputsFromJson(fromBase64Url(d)) : null;
  if (inputs && params.get('view') === 'consumer') {
    return { view: 'report', inputs, report: sanitizeReportConfig({ preset: 'standard' }) };
  }
  return { view: 'advisor', inputs, report: null };
}

/** Finish a 'pending' state by inflating the compressed payload. */
export async function resolveSharedState(search: string = window.location.search): Promise<SharedState> {
  const sync = readSharedState(search);
  if (sync.view !== 'pending') return sync;
  const payload = await decodeReportAsync(new URLSearchParams(search).get('r') ?? '');
  return payload
    ? { view: 'report', inputs: payload.inputs, report: payload.report }
    : { view: 'broken', inputs: null, report: null };
}
