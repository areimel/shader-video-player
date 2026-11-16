/** Wheel travel per row: a mouse notch (about 100 px) moves two rows; a trackpad flick moves smoothly, not 3 rows per event. */
export const WHEEL_ROW_PX = 40;
const LINE_PX = WHEEL_ROW_PX;
const PAGE_PX = 10 * WHEEL_ROW_PX;

/** deltaY in pixels whatever the deltaMode (0 pixels, 1 lines, 2 pages). */
export function wheelPixels(deltaY: number, deltaMode: number): number {
  if (!Number.isFinite(deltaY)) return 0;
  return deltaMode === 1 ? deltaY * LINE_PX : deltaMode === 2 ? deltaY * PAGE_PX : deltaY;
}

/**
 * Adds one wheel event to the running total and returns whole rows to scroll plus the remainder to keep.
 * A change of direction drops the remainder, so a reversal answers at once.
 */
export function wheelStep(acc: number, deltaY: number, deltaMode: number): { rows: number; acc: number } {
  const px = wheelPixels(deltaY, deltaMode);
  let total: number = Math.sign(px) !== 0 && Math.sign(px) !== Math.sign(acc) ? px : acc + px;
  const rows = Math.trunc(total / WHEEL_ROW_PX) || 0; // never -0
  total -= rows * WHEEL_ROW_PX;
  return { rows, acc: total };
}
