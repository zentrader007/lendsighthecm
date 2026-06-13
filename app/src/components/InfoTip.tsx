/** Small info icon with a hover/focus tooltip bubble. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="infotip" tabIndex={0} aria-label={text}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span className="infotip-bubble" role="tooltip">{text}</span>
    </span>
  );
}
