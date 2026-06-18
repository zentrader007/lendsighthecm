/** Small info icon with a hover tooltip bubble. Not in the tab order (tabIndex
 *  -1) so keyboard tabbing moves field-to-field; the aria-label keeps the text
 *  available to screen readers, and it still shows on hover. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="infotip" tabIndex={-1} aria-label={text}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span className="infotip-bubble" role="tooltip">{text}</span>
    </span>
  );
}
