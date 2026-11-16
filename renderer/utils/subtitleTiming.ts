import { clamp } from "./format";

export interface TimedCue {
  start: number;
  end: number;
}

/**
 * Cues on screen at `timeSec`. A positive `delaySec` shifts subtitles later (they appear `delaySec`
 * after their start), a negative one shows them early.
 */
export function activeCues<T extends TimedCue>(cues: readonly T[], timeSec: number, delaySec: number): T[] {
  const t = timeSec - delaySec;
  return cues.filter((c) => c.start <= t && t < c.end);
}

export const SUB_DELAY_STEP = 0.1;

/** Moves the subtitle delay one step (`dir` 1 or -1), rounded to 0.1 s and clamped to +/-30 s. */
export function stepDelay(current: number, dir: 1 | -1): number {
  const stepped = Math.round((current + dir * SUB_DELAY_STEP) * 10) / 10;
  return clamp(stepped + 0, -30, 30); // "+ 0" turns -0 into 0
}

export const SUB_SIZES = [
  { id: "s", label: "S", scale: 0.8 },
  { id: "m", label: "M", scale: 1 },
  { id: "l", label: "L", scale: 1.25 },
  { id: "xl", label: "XL", scale: 1.6 },
] as const;

export type SubSize = typeof SUB_SIZES[number]["id"];
