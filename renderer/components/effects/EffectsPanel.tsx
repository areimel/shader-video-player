import { useEffect } from "react";
import { Dropdown } from "../common/Dropdown";
import { ParamGroup } from "./ParamGroup";
import { PresetPicker } from "./PresetPicker";
import { Switch } from "./Switch";
import type { EffectSettings } from "../../hooks/useEffectSettings";
import { EFFECTS } from "../../shader/effects/registry";

interface Props {
  fx: EffectSettings;
  onClose: () => void;
}

export function EffectsPanel({ fx, onClose }: Props) {
  const { selected } = fx;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside className="fx-panel" aria-label="Effects" onDoubleClick={(e) => e.stopPropagation()}>
      <div className="info-head">
        <strong>Effects</strong>
        <button type="button" className="link-btn" onClick={onClose}>Close</button>
      </div>
      {selected && (
        <>
          <div className="fx-row">
            <Switch checked={!!fx.effect} label="Enable effect (E)" onChange={fx.toggle} />
            {EFFECTS.length > 1 ? (
              <Dropdown className="fx-select" label="Effect" selected={selected.id} buttonText={selected.label}
                options={EFFECTS.map((e) => ({ value: e.id, label: e.label }))} onSelect={fx.setEffect} />
            ) : <span className="fx-row-label">{selected.label}</span>}
          </div>
          <PresetPicker presets={selected.presets} presetId={fx.presetId} onSelect={fx.applyPreset} />
          {selected.groups.map((g, i) => (
            <ParamGroup key={`${selected.id}:${g}`} name={g} params={selected.params.filter((p) => p.group === g)}
              values={fx.values} defaultOpen={i === 0} onChange={fx.setValue} onReset={fx.resetParam} />
          ))}
          <button type="button" className="link-btn fx-reset" onClick={fx.reset}>Reset all to defaults</button>
        </>
      )}
    </aside>
  );
}
