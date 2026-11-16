import type { KeyboardEvent } from "react";

export interface SegmentOption<T> {
  value: T;
  label: string;
}

interface Props<T> {
  options: SegmentOption<T>[];
  value: T;
  label: string;
  onChange: (v: T) => void;
}

const DELTA: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

export function Segmented<T>({ options, value, label, onChange }: Props<T>) {
  const current = options.findIndex((o) => o.value === value);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = DELTA[e.key];
    if (d === undefined || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation(); // arrows must not also seek/change volume
    const n = options.length;
    const next = (Math.max(current, 0) + d + n) % n;
    onChange(options[next].value);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <div className="segmented" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => {
        const on = i === current;
        return (
          <button key={i} type="button" role="radio" aria-checked={on} tabIndex={on || (current < 0 && i === 0) ? 0 : -1}
            className={on ? "is-selected" : ""} onClick={() => onChange(o.value)}>{o.label}</button>
        );
      })}
    </div>
  );
}
