import { IconButton } from "./common/IconButton";
import { Slider } from "./common/Slider";

interface Props {
  volume: number;
  muted: boolean;
  onVolume: (v: number) => void;
  onToggleMute: () => void;
}

export function VolumeControl({ volume, muted, onVolume, onToggleMute }: Props) {
  const silent = muted || volume === 0;
  return (
    <div className="volume">
      <IconButton icon={silent ? "mute" : "volume"} label={silent ? "Unmute (M)" : "Mute (M)"} onClick={onToggleMute} />
      <Slider className="volume-slider" label="Volume" value={silent ? 0 : volume} max={1} keyStep={0.05} onChange={onVolume}
        valueText={(v) => `${Math.round(v * 100)}%`} />
    </div>
  );
}
