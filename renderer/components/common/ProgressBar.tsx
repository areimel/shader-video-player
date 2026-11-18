import { clamp } from "../../utils/format";

interface Props {
  /** 0..1, or null when the amount is unknown (indeterminate, animated unless reduced motion is asked for). */
  fraction: number | null;
  label: string;
  className?: string;
}

/** Display-only progress. Shares the slider's track and fill look. */
export function ProgressBar({ fraction, label, className = "" }: Props) {
  const known = fraction !== null && Number.isFinite(fraction);
  const pct = known ? Math.round(clamp(fraction, 0, 1) * 100) : undefined;
  return (
    <div
      className={`progress slider-track ${known ? "" : "is-indeterminate"} ${className}`.trim()}
      role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
    >
      <div className="slider-fill progress-fill" style={known ? { width: `${pct}%` } : undefined} />
    </div>
  );
}
