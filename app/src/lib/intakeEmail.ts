// A ready-to-send intake email: the two numbers that are enough to run a
// first estimate (age, home value). Opens in the advisor's own mail client
// via mailto: — which only carries plain text, so the body is formatted to
// read warmly without any markup.
import type { AdvisorProfile } from '../report/reportConfig';

export const INTAKE_EMAIL_SUBJECT = 'Two quick numbers to get your estimate started';

export function buildIntakeEmailBody(advisor: AdvisorProfile): string {
  // Skip blank fields rather than rendering empty signature lines.
  const signatureLines = [advisor.name, advisor.company, advisor.phone].filter((l) => l.trim());
  const signature = signatureLines.length ? `\n\n${signatureLines.join('\n')}` : '';
  return (
    `Hi,\n\n` +
    `With only two numbers, I can estimate what's available to you today. Simply reply with ` +
    `these two numbers, and I'll create and send you a full plan that you can review.\n\n` +
    `1. What is the age of the youngest owner living in the house?\n\n` +
    `2. What is the current home value?\n\n` +
    `Thanks!${signature}`
  );
}

/**
 * mailto: URL with no recipient — the advisor picks who it goes to in their
 * own mail client. No client email is collected anywhere this early in the
 * flow, so leaving "to" blank is correct, not an oversight. RFC 6068 wants
 * CRLF line breaks in the body.
 */
export function buildIntakeEmailUrl(advisor: AdvisorProfile): string {
  const body = buildIntakeEmailBody(advisor).replace(/\n/g, '\r\n');
  return `mailto:?subject=${encodeURIComponent(INTAKE_EMAIL_SUBJECT)}&body=${encodeURIComponent(body)}`;
}
