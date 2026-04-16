/**
 * Two-bar, left-aligned menu mark (ChatGPT-style): longer top line, shorter bottom line.
 */
export function ChatGptStyleMenuIcon({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <line x1="4" y1="8" x2="19" y2="8" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
      <line x1="4" y1="16" x2="13.25" y2="16" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}
