import { hint } from "../../shared/commands";
import { formatRemaining, formatTime } from "../utils/format";
import { IS_MAC } from "../utils/platform";

interface Props {
  time: number;
  duration: number;
  /** Show "-0:08" instead of "0:04" for the current position. */
  remaining: boolean;
  onToggle: () => void;
}

export function TimeDisplay({ time, duration, remaining, onToggle }: Props) {
  const left = remaining ? formatRemaining(time, duration) : formatTime(time);
  return (
    <button type="button" className="time-display" title={hint("toggleRemaining", IS_MAC)} onClick={onToggle}>
      {left} / {formatTime(duration)}
    </button>
  );
}
