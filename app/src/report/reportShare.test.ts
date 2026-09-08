import { describe, it, expect } from 'vitest';
import { defaultInputs } from '../engine/defaults';
import { encodeInputs } from '../share';
import { encodeReport, decodeReport, sanitizeReportConfig, readSharedState, LIMITS } from './reportShare';
import { defaultReportConfig, presetFor, toggleSection, moveSection, applyPreset, PRESET_SECTIONS } from './reportConfig';

describe('Client presentation link round-trip', () => {
  it('round-trips inputs and the full report config', () => {
    const inputs = { ...defaultInputs, homeValue: 700_000, existingLiens: 120_000 };
    const report = {
      ...defaultReportConfig(),
      preset: 'custom' as const,
      sections: ['cover', 'options', 'equity', 'notes', 'disclosures'] as const,
      client: { name: 'Jim & Mary Smith' },
      advisor: { name: 'Pat Advisor', company: 'Lendsight', nmls: '123456', phone: '555-0100', email: 'pat@example.com' },
      notes: 'My recommendation.\n\nSecond paragraph.',
      preparedOn: '2026-09-07',
    };
    const decoded = decodeReport(encodeReport(inputs, { ...report, sections: [...report.sections] }));
    expect(decoded).not.toBeNull();
    expect(decoded!.inputs.homeValue).toBe(700_000);
    expect(decoded!.inputs.existingLiens).toBe(120_000);
    expect(decoded!.report.sections).toEqual(['cover', 'options', 'equity', 'notes', 'disclosures']);
    expect(decoded!.report.preset).toBe('custom');
    expect(decoded!.report.client.name).toBe('Jim & Mary Smith');
    expect(decoded!.report.advisor.nmls).toBe('123456');
    expect(decoded!.report.notes).toBe('My recommendation.\n\nSecond paragraph.');
    expect(decoded!.report.preparedOn).toBe('2026-09-07');
  });

  it('recognises presets from their section lists regardless of order', () => {
    expect(presetFor(PRESET_SECTIONS.standard)).toBe('standard');
    expect(presetFor([...PRESET_SECTIONS.summary])).toBe('summary');
    expect(presetFor(['options', 'cover'])).toBe('custom');
  });

  it('drops unknown sections, caps strings, and always ends with disclosures', () => {
    const cfg = sanitizeReportConfig({
      sections: ['bogus', 'equity', 'disclosures', 'cover', 'equity'],
      client: { name: 'x'.repeat(500) },
      notes: 'n'.repeat(5000),
      advisor: { name: 42, email: 'a@b.c' },
      preparedOn: 'not-a-date',
    });
    expect(cfg.sections).toEqual(['equity', 'cover', 'disclosures']);
    expect(cfg.client.name).toHaveLength(LIMITS.clientName);
    expect(cfg.notes).toHaveLength(LIMITS.notes);
    expect(cfg.advisor.name).toBe('');
    expect(cfg.advisor.email).toBe('a@b.c');
    expect(cfg.preparedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('strips control characters from notes but keeps newlines', () => {
    const NL = String.fromCharCode(10);
    const cfg = sanitizeReportConfig({ notes: 'a' + String.fromCharCode(1) + 'b' + NL + 'cd' + String.fromCharCode(127) });
    expect(cfg.notes).toBe('ab' + NL + 'cd');
  });

  it('returns null for a payload with no inputs', () => {
    expect(decodeReport('not-base64!!')).toBeNull();
  });
});

describe('readSharedState', () => {
  it('opens a ?r= link as a report', () => {
    const cfg = defaultReportConfig();
    const s = readSharedState(`?r=${encodeReport(defaultInputs, cfg)}`);
    expect(s.view).toBe('report');
    expect(s.inputs).not.toBeNull();
    expect(s.report?.preset).toBe('standard');
  });

  it('maps a legacy consumer link to a Standard report', () => {
    const s = readSharedState(`?view=consumer&d=${encodeInputs({ ...defaultInputs, age: 71 })}`);
    expect(s.view).toBe('report');
    expect(s.inputs?.age).toBe(71);
    expect(s.report?.sections).toEqual(PRESET_SECTIONS.standard);
  });

  it('opens a bare ?d= link in the advisor', () => {
    const s = readSharedState(`?d=${encodeInputs(defaultInputs)}`);
    expect(s.view).toBe('advisor');
    expect(s.inputs).not.toBeNull();
    expect(s.report).toBeNull();
  });

  it('falls back to the advisor with defaults when the payload is garbage', () => {
    const s = readSharedState('?r=garbage');
    expect(s.view).toBe('advisor');
    expect(s.inputs).toBeNull();
  });
});

describe('Section editing', () => {
  it('toggling a section off and on restores catalog order and flips presets', () => {
    let cfg = applyPreset(defaultReportConfig(), 'standard');
    cfg = toggleSection(cfg, 'options', false);
    expect(cfg.preset).toBe('custom');
    expect(cfg.sections).not.toContain('options');
    cfg = toggleSection(cfg, 'options', true);
    expect(cfg.preset).toBe('standard');
    expect(cfg.sections).toEqual(PRESET_SECTIONS.standard);
  });

  it('cannot remove disclosures', () => {
    const cfg = toggleSection(defaultReportConfig(), 'disclosures', false);
    expect(cfg.sections).toContain('disclosures');
  });

  it('moves sections but keeps disclosures last', () => {
    let cfg = applyPreset(defaultReportConfig(), 'summary');
    cfg = toggleSection(cfg, 'options', true); // [summary, options, disclosures]
    cfg = moveSection(cfg, 'options', -1);
    expect(cfg.sections).toEqual(['options', 'summary', 'disclosures']);
    cfg = moveSection(cfg, 'summary', 1); // would pass disclosures — no-op
    expect(cfg.sections).toEqual(['options', 'summary', 'disclosures']);
  });
});
