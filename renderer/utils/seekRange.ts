/** The part of `TimeRanges` this needs, so tests can pass plain objects. */
export interface Ranges {
  readonly length: number;
  start(i: number): number;
  end(i: number): number;
}

/** Margin kept from a range's end, so a seek never lands on data still arriving. */
export const SEEK_END_MARGIN = 0.25;

/** True when `t` lies inside one of the ranges, at least SEEK_END_MARGIN before its end. */
export function inSeekable(ranges: Ranges, t: number): boolean {
  for (let i = 0; i < ranges.length; i++) {
    if (t >= ranges.start(i) && t <= ranges.end(i) - SEEK_END_MARGIN) return true;
  }
  return false;
}
