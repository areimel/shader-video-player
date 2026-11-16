import type { HitTarget, HomeFrame } from "./types";

/** The focusable row under a logical-pixel point, or null. */
export function hitTest(frame: HomeFrame, x: number, y: number): HitTarget | null {
  for (const r of frame.hits) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.target;
  }
  return null;
}
