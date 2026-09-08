import { paragraphs } from '../text';
import { SectionHead } from './bits';
import type { SectionProps } from './types';

/** The advisor's written recommendation, as typed (blank lines = paragraphs). */
export function Notes({ config }: SectionProps) {
  const a = config.advisor;
  const paras = paragraphs(config.notes);
  const sig = [a.name, a.company, a.nmls ? `NMLS #${a.nmls}` : ''].filter(Boolean).join(' · ');
  const contact = [a.phone, a.email].filter(Boolean).join(' · ');
  return (
    <>
      <SectionHead
        eyebrow="Recommendation"
        title={a.name ? `A note from ${a.name}` : 'A note from your advisor'}
        lede={config.client.name.trim() ? `For ${config.client.name.trim()}` : undefined}
      />
      <div className="rp-notes">
        {paras.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {(sig || contact) && (
        <div className="rp-sign">
          {sig && <div className="rp-sign-name">{sig}</div>}
          {contact && <div className="rp-sign-contact">{contact}</div>}
        </div>
      )}
    </>
  );
}
