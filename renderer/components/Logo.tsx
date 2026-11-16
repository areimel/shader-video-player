export function Logo({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--lamp)" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--lamp) 70%, var(--tally))" }} />
        </linearGradient>
      </defs>
      <rect width="72" height="72" rx="18" fill="url(#logo-g)" />
      <path d="M28 21v30l25-15z" style={{ fill: "var(--lamp-ink)" }} />
    </svg>
  );
}
