import { clamp } from "../../utils/format";

interface Props {
  /** 0..1, or null when the amount is unknown (indeterminate, animated unless reduced motion is asked for). */
  fraction: number | null;
  label: string;
  className?: string;
}

const BLOCKS = 20;

/** Display-only progress as a row of VCR blocks (the volume bar's look, stretched to the width). */
export function ProgressBar({ fraction, label, className = "" }: Props) {
  const known = fraction !== null && Number.isFinite(fraction);
  const pct = known ? Math.round(clamp(fraction, 0, 1) * 100) : undefined;
  const filled = known ? Math.floor(clamp(fraction, 0, 1) * BLOCKS) : 0;
  return (
    <div
      className={`progress ${known ? "" : "is-indeterminate"} ${className}`.trim()}
      role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
    >
      {Array.from({ length: BLOCKS }, (_, i) => (
        <span key={i} className={i < filled ? "progress-block on" : "progress-block"} style={known ? undefined : { animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );
}
