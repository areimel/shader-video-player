import { useState } from "react";
import { ParamControl } from "./ParamControl";
import type { ParamSpec, ParamValues } from "../../shader/effects/types";

interface Props {
  name: string;
  params: ParamSpec[];
  values: ParamValues;
  defaultOpen?: boolean;
  onChange: (id: string, v: number) => void;
  onReset: (id: string) => void;
}

export function ParamGroup({ name, params, values, defaultOpen = false, onChange, onReset }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  if (!params.length) return null;
  return (
    <section className="fx-group">
      <button type="button" className="fx-group-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="fx-chevron" aria-hidden="true">{open ? "▾" : "▸"}</span>{name}
      </button>
      {open && params.map((p) => (
        <ParamControl key={p.id} spec={p} value={values[p.id] ?? p.default}
          onChange={(v) => onChange(p.id, v)} onReset={() => onReset(p.id)} />
      ))}
    </section>
  );
}
