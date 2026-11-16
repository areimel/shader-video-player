import type { DrawOp, ZoneId } from "./types";

/** "12:41AM": a VCR clock, 12-hour, no leading zero on the hour. */
export function formatClock(date: Date): string {
  const h24 = date.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(date.getMinutes()).padStart(2, "0")}${h24 < 12 ? "AM" : "PM"}`;
}

/** Milliseconds until the wall clock's next minute starts (at least 1). */
export function msToNextMinute(date: Date): number {
  return Math.max(1, 60_000 - (date.getSeconds() * 1000 + date.getMilliseconds()));
}

/** True when two draw lists paint the same pixels, so a repaint (and a texture upload) can be skipped. */
export function sameOps(a: readonly DrawOp[] | null, b: readonly DrawOp[]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!, y = b[i]!;
    if (x.op !== y.op || x.x !== y.x || x.y !== y.y || x.color !== y.color) return false;
    if (x.op === "rect" && y.op === "rect" && (x.w !== y.w || x.h !== y.h)) return false;
    if (x.op === "text" && y.op === "text" && (x.text !== y.text || x.scale !== y.scale || x.align !== y.align)) return false;
  }
  return true;
}

/**
 * DOM id of a row in the accessibility mirror: `home-<zone>-<rowId>`, with every character outside
 * [A-Za-z0-9-] escaped as `_<hex>_` (row ids hold paths, which may contain spaces or colons).
 */
export function mirrorId(zone: ZoneId, rowId: string): string {
  const safe = Array.from(rowId, (ch) => (/[A-Za-z0-9-]/.test(ch) ? ch : `_${ch.codePointAt(0)!.toString(16)}_`)).join("");
  return `home-${zone}-${safe}`;
}
