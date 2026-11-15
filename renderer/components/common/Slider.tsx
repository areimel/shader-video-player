import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clamp } from "../../utils/format";
import { snapToStep } from "../../utils/step";

interface Props {
  value: number;
  /** Defaults to 0. */
  min?: number;
  max: number;
  /** Snaps pointer values and enables arrow-key/Home/End control; omitted = continuous and pointer-only. */
  step?: number;
  buffered?: number;
  label: string;
  className?: string;
  onChange: (v: number) => void;
  tooltip?: (v: number) => string;
}

export function Slider({ value, min = 0, max, step, buffered = 0, label, className = "", onChange, tooltip }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; v: number } | null>(null);
  const dragging = useRef(false);

  const valueAt = (e: PointerEvent): { x: number; v: number } => {
    const r = ref.current!.getBoundingClientRect();
    const x = clamp(e.clientX - r.left, 0, r.width);
    const raw = min + (r.width ? (x / r.width) * (max - min) : 0);
    return { x, v: step ? snapToStep(raw, min, max, step) : raw };
  };
  const pct = (v: number) => (max > min ? clamp(((v - min) / (max - min)) * 100, 0, 100) : 0);
  const onKeyDown = (e: KeyboardEvent) => {
    if (!step) return;
    const to = { ArrowLeft: value - step, ArrowDown: value - step, ArrowRight: value + step, ArrowUp: value + step, Home: min, End: max }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    e.stopPropagation(); // keep window-level player shortcuts (arrows seek) out of this
    onChange(snapToStep(to, min, max, step));
  };

  return (
    <div
      ref={ref} className={`slider ${className}`} role="slider" aria-label={label}
      aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
      tabIndex={step ? 0 : undefined} onKeyDown={onKeyDown}
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); onChange(valueAt(e).v); }}
      onPointerMove={(e) => { const p = valueAt(e); setHover(p); if (dragging.current) onChange(p.v); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerLeave={() => setHover(null)}
    >
      <div className="slider-track">
        <div className="slider-buffered" style={{ width: `${pct(buffered)}%` }} />
        <div className="slider-fill" style={{ width: `${pct(value)}%` }} />
      </div>
      <div className="slider-thumb" style={{ left: `${pct(value)}%` }} />
      {tooltip && hover && (
        <div className="slider-tooltip" style={{ left: hover.x }}>{tooltip(hover.v)}</div>
      )}
    </div>
  );
}
