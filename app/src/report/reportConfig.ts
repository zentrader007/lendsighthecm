// Client Presentation: what goes into a report. A report is an ordered list of
// sections drawn from a fixed catalog, plus the personalization that travels
// with it (client name, advisor profile, the advisor's written recommendation).
// Presets are just named section lists; any hand edit flips the preset to
// 'custom'. Everything here is pure data so it can be encoded into a share link
// and round-tripped without a backend.

export type SectionKey =
  | 'cover'
  | 'summary'
  | 'options'
  | 'loc'
  | 'spending'
  | 'networth'
  | 'equity'
  | 'invest'
  | 'seqrisk'
  | 'table'
  | 'notes'
  | 'howItWorks'
  | 'disclosures';

export type ReportPreset = 'summary' | 'standard' | 'comprehensive' | 'custom';

export interface AdvisorProfile {
  name: string;
  company: string;
  nmls: string;
  phone: string;
  email: string;
}

export interface ReportConfig {
  v: 1;
  preset: ReportPreset;
  /** Ordered section list. 'disclosures' is always rendered last regardless. */
  sections: SectionKey[];
  client: { name: string };
  advisor: AdvisorProfile;
  /** The advisor's recommendation / next steps, plain text (blank lines = paragraphs). */
  notes: string;
  /** ISO date (YYYY-MM-DD) the report was prepared; frozen when a link is built. */
  preparedOn: string;
}

/** Scenario facts that decide whether a section has anything to say. */
export interface SectionContext {
  hasLien: boolean;
  hasSpending: boolean;
  hasPortfolio: boolean;
  hasNotes: boolean;
}

export type SectionGroup = 'Overview' | 'Analysis' | 'Details' | 'Closing';

export interface SectionMeta {
  key: SectionKey;
  label: string;
  description: string;
  group: SectionGroup;
  /** Hidden from the builder (and skipped in the document) when false. */
  available?: (ctx: SectionContext) => boolean;
  /** Always included; cannot be unchecked. */
  locked?: boolean;
}

export const SECTIONS: readonly SectionMeta[] = [
  { key: 'cover', label: 'Cover page', description: 'Client name, advisor, date, and the three headline numbers.', group: 'Overview' },
  { key: 'summary', label: 'Plan at a glance', description: 'Headline figures, two charts, and the plan’s milestones on one page.', group: 'Overview' },
  { key: 'options', label: 'Your options side by side', description: 'Lump sum, growing credit line, monthly for life, this plan, and doing nothing — compared.', group: 'Overview' },
  { key: 'loc', label: 'Credit line growth', description: 'How the unused line of credit grows over time.', group: 'Analysis' },
  { key: 'spending', label: 'New spending money', description: 'Cash at closing, freed-up payments, and planned draws.', group: 'Analysis', available: (c) => c.hasSpending },
  { key: 'networth', label: 'Net worth comparison', description: 'Net worth with the reverse mortgage vs. without it.', group: 'Analysis' },
  { key: 'equity', label: 'Equity vs. balance', description: 'Home value, loan balance, and remaining equity by age.', group: 'Analysis' },
  { key: 'invest', label: 'Invest comparison', description: 'Illustration: equity alone vs. proceeds invested (after tax).', group: 'Analysis' },
  { key: 'seqrisk', label: 'Market downturn protection', description: 'Bridging spending from the credit line vs. selling investments in a downturn.', group: 'Analysis', available: (c) => c.hasPortfolio },
  { key: 'table', label: 'Year-by-year table', description: 'The full projection: home value, balance, credit line, and equity each year.', group: 'Details' },
  { key: 'notes', label: 'Advisor recommendation', description: 'Your written recommendation and next steps.', group: 'Closing', available: (c) => c.hasNotes },
  { key: 'howItWorks', label: 'How it works & next steps', description: 'What a HECM means for the client, and what happens next.', group: 'Closing' },
  { key: 'disclosures', label: 'Disclosures', description: 'Required disclosures. Always included.', group: 'Closing', locked: true },
];

export const SECTION_KEYS: readonly SectionKey[] = SECTIONS.map((s) => s.key);
export const SECTION_BY_KEY: Record<SectionKey, SectionMeta> = Object.fromEntries(
  SECTIONS.map((s) => [s.key, s]),
) as Record<SectionKey, SectionMeta>;

export const PRESET_SECTIONS: Record<Exclude<ReportPreset, 'custom'>, SectionKey[]> = {
  summary: ['summary', 'disclosures'],
  standard: ['cover', 'summary', 'options', 'loc', 'spending', 'networth', 'equity', 'notes', 'howItWorks', 'disclosures'],
  comprehensive: ['cover', 'summary', 'options', 'loc', 'spending', 'networth', 'equity', 'invest', 'seqrisk', 'table', 'notes', 'howItWorks', 'disclosures'],
};

export const PRESET_LABELS: Record<ReportPreset, string> = {
  summary: '1-page summary',
  standard: 'Standard',
  comprehensive: 'Comprehensive',
  custom: 'Custom',
};

export const emptyAdvisor: AdvisorProfile = { name: '', company: '', nmls: '', phone: '', email: '' };

/** Today's date in the browser's local calendar (not UTC), as YYYY-MM-DD. */
export const todayISO = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export function defaultReportConfig(advisor: AdvisorProfile = emptyAdvisor): ReportConfig {
  return {
    v: 1,
    preset: 'standard',
    sections: [...PRESET_SECTIONS.standard],
    client: { name: '' },
    advisor: { ...advisor },
    notes: '',
    preparedOn: todayISO(),
  };
}

/** The list as given (order preserved), minus unknowns and duplicates, with
 *  disclosures forced last. */
export function normalizeSections(sections: readonly SectionKey[]): SectionKey[] {
  const seen = new Set<SectionKey>();
  const out: SectionKey[] = [];
  for (const k of sections) {
    if (k === 'disclosures' || seen.has(k) || !SECTION_BY_KEY[k]) continue;
    seen.add(k);
    out.push(k);
  }
  out.push('disclosures');
  return out;
}

/** The sections a document actually renders: the config's list, minus any that
 *  have nothing to say for this scenario, disclosures last. */
export function resolveSections(config: ReportConfig, ctx: SectionContext): SectionKey[] {
  return normalizeSections(config.sections).filter((k) => {
    const meta = SECTION_BY_KEY[k];
    return meta && (meta.available ? meta.available(ctx) : true);
  });
}

/** Which preset a section list corresponds to, or 'custom'. Order-insensitive. */
export function presetFor(sections: readonly SectionKey[]): ReportPreset {
  const norm = normalizeSections(sections).join('|');
  for (const p of ['summary', 'standard', 'comprehensive'] as const) {
    if (normalizeSections(PRESET_SECTIONS[p]).join('|') === norm) return p;
  }
  return 'custom';
}

export function applyPreset(config: ReportConfig, preset: Exclude<ReportPreset, 'custom'>): ReportConfig {
  return { ...config, preset, sections: [...PRESET_SECTIONS[preset]] };
}

export function toggleSection(config: ReportConfig, key: SectionKey, on: boolean): ReportConfig {
  if (SECTION_BY_KEY[key]?.locked) return config;
  const has = config.sections.includes(key);
  if (on === has) return config;
  const sections = on
    ? insertInCatalogOrder(config.sections, key)
    : config.sections.filter((k) => k !== key);
  return { ...config, sections, preset: presetFor(sections) };
}

/** Move a section one step earlier or later in the document. */
export function moveSection(config: ReportConfig, key: SectionKey, dir: -1 | 1): ReportConfig {
  const list = normalizeSections(config.sections);
  const i = list.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length - 1 || key === 'disclosures') return config;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return { ...config, sections: next, preset: presetFor(next) };
}

// Re-adding a section drops it back where the catalog would put it relative to
// the sections already present, so a toggle doesn't scramble a custom order.
function insertInCatalogOrder(sections: SectionKey[], key: SectionKey): SectionKey[] {
  const rank = SECTION_KEYS.indexOf(key);
  const out = [...sections];
  let at = out.length;
  for (let i = 0; i < out.length; i++) {
    if (SECTION_KEYS.indexOf(out[i]) > rank) {
      at = i;
      break;
    }
  }
  out.splice(at, 0, key);
  return out;
}

export function formatPreparedOn(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d) ? new Date(y, m - 1, d) : new Date();
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
