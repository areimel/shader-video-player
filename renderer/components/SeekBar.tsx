import { Slider } from "./common/Slider";
import { formatTime } from "../utils/format";

interface Props {
  time: number;
  duration: number;
  buffered: number;
  onSeek: (t: number) => void;
}

export function SeekBar({ time, duration, buffered, onSeek }: Props) {
  const pct = duration > 0 ? Math.min(100, Math.max(0, (time / duration) * 100)) : 0;
  return (
    <Slider
      className="seekbar" variant="tape" label="Seek" value={time} max={duration} buffered={buffered}
      keyStep={5} onChange={onSeek} tooltip={formatTime} valueText={formatTime}
    >
      <span className="tape-marker" aria-hidden="true" style={{ left: `${pct}%` }}>▼</span>
      <span className="tape-label tape-begin" aria-hidden="true">BEGIN</span>
      <span className="tape-label tape-end" aria-hidden="true">END</span>
    </Slider>
  );
}
