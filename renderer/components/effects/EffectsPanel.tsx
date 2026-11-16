import { Button } from "../common/Button";
import { Dropdown } from "../common/Dropdown";
import { Panel, PanelHeader } from "../common/Panel";
import { ParamGroup } from "./ParamGroup";
import { PresetPicker } from "./PresetPicker";
import { Switch } from "../common/Switch";
import type { EffectSettings } from "../../hooks/useEffectSettings";
import { EFFECTS } from "../../shader/effects/registry";

interface Props {
  fx: EffectSettings;
  onClose: () => void;
}

export function EffectsPanel({ fx, onClose }: Props) {
  const { selected } = fx;

  return (
    <Panel className="fx-panel" role="complementary" aria-label="Effects" onDismiss={onClose}
      onDoubleClick={(e) => e.stopPropagation()}>
      <PanelHeader title="Effects">
        <Button variant="link" onClick={onClose}>Close</Button>
      </PanelHeader>
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
          <Button variant="link" className="fx-reset" onClick={fx.reset}>Reset all to defaults</Button>
        </>
      )}
    </Panel>
  );
}
