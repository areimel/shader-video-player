import { Dropdown } from "../common/Dropdown";
import { Slider } from "../common/Slider";
import { Switch } from "./Switch";
import type { ParamSpec } from "../../shader/effects/types";
import { stepDecimals } from "../../utils/step";

interface Props {
  spec: ParamSpec;
  value: number;
  onChange: (v: number) => void;
  onReset: () => void;
}

const SEGMENTED_MAX = 3;

/** Renders any ParamSpec by kind; there is deliberately no per-parameter code. */
export function ParamControl({ spec, value, onChange, onReset }: Props) {
  const options = spec.options ?? [];
  const isRange = spec.kind === "range";
  const shown = isRange ? `${value.toFixed(stepDecimals(spec.step ?? 0))}${spec.unit ?? ""}` : "";
  const modified = value !== spec.default;

  return (
    <div className="fx-param" title={spec.hint} onDoubleClick={onReset}>
      <div className="fx-param-head">
        <span className={`fx-param-label ${modified ? "is-modified" : ""}`}>{spec.label}</span>
        {isRange && <span className="fx-value">{shown}</span>}
        {spec.kind === "toggle" && <Switch checked={value === 1} label={spec.label} onChange={(on) => onChange(on ? 1 : 0)} />}
      </div>
      {isRange && (
        <Slider label={spec.label} value={value} min={spec.min ?? 0} max={spec.max ?? 1} step={spec.step} onChange={onChange} />
      )}
      {spec.kind === "select" && options.length <= SEGMENTED_MAX && (
        <div className="fx-segmented" role="radiogroup" aria-label={spec.label}>
          {options.map((o, i) => (
            <button key={o} type="button" role="radio" aria-checked={i === value}
              className={i === value ? "is-selected" : ""} onClick={() => onChange(i)}>{o}</button>
          ))}
        </div>
      )}
      {spec.kind === "select" && options.length > SEGMENTED_MAX && (
        <Dropdown className="fx-select" label={spec.label} selected={value} buttonText={options[value] ?? ""}
          options={options.map((label, i) => ({ value: i, label }))} onSelect={onChange} />
      )}
    </div>
  );
}
