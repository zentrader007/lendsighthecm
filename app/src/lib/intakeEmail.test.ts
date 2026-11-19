import { describe, it, expect } from 'vitest';
import { buildIntakeEmailBody, buildIntakeEmailUrl, INTAKE_EMAIL_SUBJECT } from './intakeEmail';
import { emptyAdvisor } from '../report/reportConfig';

describe('intake email', () => {
  it('asks exactly the two questions, in the requested wording', () => {
    const body = buildIntakeEmailBody(emptyAdvisor);
    expect(body).toContain(
      "With only two numbers, I can estimate what's available to you today. Simply reply with these two numbers, and I'll create and send you a full plan that you can review.",
    );
    expect(body).toContain('What is the age of the youngest owner living in the house?');
    expect(body).toContain('What is the current home value?');
  });

  it('omits a signature block when the advisor profile is empty', () => {
    const body = buildIntakeEmailBody(emptyAdvisor);
    expect(body.trimEnd().endsWith('Thanks!')).toBe(true);
  });

  it('signs with whatever advisor details are saved, skipping blank fields', () => {
    const body = buildIntakeEmailBody({ ...emptyAdvisor, name: 'Todd Ballenger', phone: '555-1234' });
    expect(body).toContain('Todd Ballenger');
    expect(body).toContain('555-1234');
    // company and nmls are blank and must not leave stray empty lines
    expect(body).not.toMatch(/\n{3,}/);
  });

  it('builds a mailto URL with no recipient and the exact subject', () => {
    const url = buildIntakeEmailUrl(emptyAdvisor);
    expect(url.startsWith('mailto:?')).toBe(true);
    const params = new URLSearchParams(new URL(url).search);
    expect(params.get('subject')).toBe(INTAKE_EMAIL_SUBJECT);
    expect(params.has('body')).toBe(true);
  });

  it('round-trips the body through encoding with CRLF line breaks', () => {
    const advisor = { ...emptyAdvisor, name: 'Todd Ballenger' };
    const url = buildIntakeEmailUrl(advisor);
    const params = new URLSearchParams(new URL(url).search);
    const decoded = params.get('body') ?? '';
    expect(decoded).toContain('\r\n');
    expect(decoded.replace(/\r\n/g, '\n')).toBe(buildIntakeEmailBody(advisor));
  });
});
