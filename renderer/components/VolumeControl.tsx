import { IconButton } from "./common/IconButton";
import { Slider } from "./common/Slider";

interface Props {
  volume: number;
  muted: boolean;
  onVolume: (v: number) => void;
  onToggleMute: () => void;
}

const BLOCKS = 16;

export function VolumeControl({ volume, muted, onVolume, onToggleMute }: Props) {
  const silent = muted || volume === 0;
  const filled = silent ? 0 : Math.round(volume * BLOCKS);
  return (
    <div className="volume">
      <IconButton icon={silent ? "mute" : "volume"} label={silent ? "Unmute (M)" : "Mute (M)"} onClick={onToggleMute} />
      <Slider className="volume-slider" variant="segments" label="Volume" value={silent ? 0 : volume} max={1} keyStep={0.05} onChange={onVolume}
        valueText={(v) => `${Math.round(v * 100)}%`}>
        <div className="vol-blocks" aria-hidden="true">
          {Array.from({ length: BLOCKS }, (_, i) => <span key={i} className={i < filled ? "vol-block on" : "vol-block"} />)}
        </div>
        {muted && <span className="vol-mute" aria-hidden="true">MUTE</span>}
      </Slider>
    </div>
  );
}
