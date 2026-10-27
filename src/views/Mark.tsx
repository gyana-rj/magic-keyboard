/** The wordmark glyph: seven bars, one per weekday. */
export function Mark({ size = 28 }: { size?: number }) {
  const heights = [0.45, 0.75, 0.55, 1, 0.65, 0.85, 0.35];
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" class="mark">
      <defs>
        <linearGradient id="mark-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--accent)" />
          <stop offset="1" stop-color="var(--accent2)" />
        </linearGradient>
      </defs>
      {heights.map((h, i) => (
        <rect x={i * 4} y={28 - 28 * h} width="2.6" height={28 * h} rx="1.3" fill="url(#mark-g)" />
      ))}
    </svg>
  );
}
