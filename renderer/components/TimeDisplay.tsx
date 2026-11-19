import { hint } from "../../shared/commands";
import { formatCounter } from "../utils/osd";
import { IS_MAC } from "../utils/platform";

interface Props {
  time: number;
  duration: number;
  /** Show "-0:08" instead of "0:04" for the current position. */
  remaining: boolean;
  onToggle: () => void;
}

export function TimeDisplay({ time, duration, remaining, onToggle }: Props) {
  const left = remaining ? `-${formatCounter(Math.max(0, duration - time))}` : formatCounter(time);
  return (
    <button type="button" className="time-display" title={hint("toggleRemaining", IS_MAC)} onClick={onToggle}
      aria-label={`${remaining ? "Remaining" : "Elapsed"} ${left} of ${formatCounter(duration)}`}>
      <span className="time-cur">{left}</span>
      <span className="time-total">{formatCounter(duration)}</span>
    </button>
  );
}
