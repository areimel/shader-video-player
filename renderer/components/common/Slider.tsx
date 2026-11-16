import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clamp } from "../../utils/format";
import { snapToStep } from "../../utils/step";

interface Props {
  value: number;
  /** Defaults to 0. */
  min?: number;
  max: number;
  /** Snaps pointer and keyboard values; omitted = continuous. */
  step?: number;
  /** Arrow-key increment. Defaults to `step`, else 1% of the range. PageUp/PageDown use 10x. */
  keyStep?: number;
  buffered?: number;
  label: string;
  className?: string;
  onChange: (v: number) => void;
  tooltip?: (v: number) => string;
  /** Human-readable value for assistive tech (aria-valuetext). */
  valueText?: (v: number) => string;
}

export function Slider({ value, min = 0, max, step, keyStep, buffered = 0, label, className = "", onChange, tooltip, valueText }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; v: number } | null>(null);
  const dragging = useRef(false);

  const fit = (v: number) => (step ? snapToStep(v, min, max, step) : clamp(Number(v.toFixed(6)), min, max));
  const valueAt = (e: PointerEvent): { x: number; v: number } => {
    const r = ref.current!.getBoundingClientRect();
    const x = clamp(e.clientX - r.left, 0, r.width);
    return { x, v: fit(min + (r.width ? (x / r.width) * (max - min) : 0)) };
  };
  const endDrag = () => { dragging.current = false; };
  const pct = (v: number) => (max > min ? clamp(((v - min) / (max - min)) * 100, 0, 100) : 0);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = keyStep ?? step ?? (max - min) / 100;
    const to = {
      ArrowLeft: value - k, ArrowDown: value - k, ArrowRight: value + k, ArrowUp: value + k,
      PageDown: value - k * 10, PageUp: value + k * 10, Home: min, End: max,
    }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    e.stopPropagation(); // keep window-level player shortcuts (arrows seek) out of this
    onChange(fit(to));
  };

  return (
    <div
      ref={ref} className={`slider ${className}`} role="slider" aria-label={label}
      aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText?.(value)}
      tabIndex={0} onKeyDown={onKeyDown}
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); onChange(valueAt(e).v); }}
      onPointerMove={(e) => { const p = valueAt(e); setHover(p); if (dragging.current) onChange(p.v); }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
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
