import { Dropdown } from "../common/Dropdown";
import { CUSTOM } from "../../utils/effectSettings";
import type { Preset } from "../../shader/effects/types";

interface Props {
  presets: Preset[];
  presetId: string;
  onSelect: (id: string) => void;
}

export function PresetPicker({ presets, presetId, onSelect }: Props) {
  if (!presets.length) return null;
  const current = presets.find((p) => p.id === presetId);
  return (
    <div className="fx-row">
      <span className="fx-row-label">Preset</span>
      <Dropdown className="fx-select" label="Preset" selected={presetId} onSelect={onSelect}
        buttonText={current?.label ?? "Custom"} options={presets.map((p) => ({ value: p.id, label: p.label }))} />
      {presetId === CUSTOM && <span className="fx-badge">edited</span>}
    </div>
  );
}
