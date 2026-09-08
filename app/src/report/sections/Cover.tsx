import { usd } from '../../format';
import { formatPreparedOn, SECTION_BY_KEY } from '../reportConfig';
import { Tile, Tiles } from './bits';
import type { SectionProps } from './types';

export function Cover({ data, config, sections }: SectionProps) {
  const { inp, result, hasLien } = data;
  const a = config.advisor;
  const advisorBits = [a.company, a.nmls ? `NMLS #${a.nmls}` : '', a.phone, a.email].filter(Boolean);
  const contents = sections.filter((k) => k !== 'cover');

  return (
    <div className="rp-cover">
      <div className="rp-cover-band">
        <span className="rp-cover-brand">LendsightAI</span>
        <span className="rp-cover-kind">Reverse Mortgage Plan</span>
      </div>

      <h1 className="rp-cover-title">Your Reverse Mortgage Plan</h1>
      <p className="rp-cover-for">
        Prepared for <strong>{config.client.name.trim() || 'you'}</strong>
      </p>
      <p className="rp-cover-date">{formatPreparedOn(config.preparedOn)}</p>

      <Tiles cols={3}>
        <Tile label="Cash available now" value={usd(result.availableInitialDraw)} note="The most cash accessible in year one" tone="primary" />
        <Tile label="Total funds available" value={usd(result.principalLimit)} note="Over the life of the loan" />
        <Tile label="Monthly for life" value={usd(result.maxTenurePayment)} note="If taken as a guaranteed monthly payment" tone="green" />
      </Tiles>

      <p className="rp-cover-basis">
        Based on a home valued at <strong>{usd(inp.homeValue)}</strong>, a starting age of{' '}
        <strong>{inp.age}</strong>
        {hasLien ? (
          <>
            , and paying off a <strong>{usd(inp.existingLiens)}</strong> mortgage
          </>
        ) : null}
        . Every figure in this plan comes from the same set of assumptions, shown on the “Plan at a
        glance” page.
      </p>

      <div className="rp-cover-bottom">
        <div className="rp-toc">
          <div className="rp-eyebrow">What’s inside</div>
          <ol>
            {contents.map((k) => (
              <li key={k}>{SECTION_BY_KEY[k].label}</li>
            ))}
          </ol>
        </div>
        {(a.name || advisorBits.length > 0) && (
          <div className="rp-cover-advisor">
            <div className="rp-eyebrow">Prepared by</div>
            {a.name && <div className="rp-cover-advisor-name">{a.name}</div>}
            {advisorBits.map((b) => (
              <div key={b} className="rp-cover-advisor-line">
                {b}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
