import type { HitTarget, HomeFrame, ZoneId } from "./types";
import { CELL, ZONES } from "./types";
import { BOXES } from "./layout";

/** The focusable row under a logical-pixel point, or null. */
export function hitTest(frame: HomeFrame, x: number, y: number): HitTarget | null {
  for (const r of frame.hits) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.target;
  }
  return null;
}

/** The zone whose title bar or row window contains a logical-pixel point (the wheel scrolls it), or null. */
export function zoneAt(x: number, y: number): ZoneId | null {
  for (const zone of ZONES) {
    const b = BOXES[zone];
    if (x >= b.col * CELL && x < (b.col + b.cols) * CELL && y >= (b.row - 1) * CELL && y < (b.row + b.visible) * CELL) return zone;
  }
  return null;
}
