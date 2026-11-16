import type { ColorRole, DrawOp, HitRegion, HomeClock, HomeRow, ZoneId } from "./types";
import { CELL } from "./types";
import { clip, marquee } from "./text";

/** A zone's row window, in cells. */
export interface ZoneBox { zone: ZoneId; col: number; cols: number; row: number; visible: number }

/** Widths of the secondary columns when a row has two or more (duration, resolution). */
const SECONDARY_MIN_WIDTHS = [7, 5];

export const px = (cells: number): number => cells * CELL;

export function text(
  ops: DrawOp[], col: number, row: number, str: string, color: ColorRole, align: "left" | "right" = "left", scale?: 1 | 2,
): void {
  if (str === "") return;
  ops.push({ op: "text", x: px(col), y: px(row), text: str, color, ...(scale ? { scale } : {}), ...(align === "right" ? { align } : {}) });
}

export function rect(ops: DrawOp[], col: number, row: number, cols: number, rows: number, color: ColorRole): void {
  ops.push({ op: "rect", x: px(col), y: px(row), w: px(cols), h: px(rows), color });
}

/** Secondary columns as one right-aligned string; earlier columns get a fixed width so they line up. */
export function secondaryText(cols: string[]): string {
  const rest = cols.slice(1);
  if (rest.length < 2) return rest.join("");
  return rest.map((c, i) => c.padStart(SECONDARY_MIN_WIDTHS[i] ?? 0)).join(" ");
}

function rowColor(row: HomeRow, onCursor: boolean): ColorRole {
  if (onCursor) return "accentInk";
  if (row.alert) return "alert";
  return row.kind === "header" ? "accent" : "text";
}

/** First visible row for the window, and whether rows are hidden above / below it. */
export interface Window { first: number; above: boolean; below: boolean }

export function drawRows(
  ops: DrawOp[], hits: HitRegion[], box: ZoneBox, rows: HomeRow[], win: Window,
  cursor: number, focused: boolean, clock: HomeClock,
): void {
  const contentCols = box.cols - 1; // the last cell is kept for the scroll hint
  for (let i = 0; i < box.visible; i++) {
    const index = win.first + i;
    const row = rows[index];
    if (!row) break;
    const y = box.row + i;
    const onCursor = focused && index === cursor && !!row.action;
    if (onCursor) rect(ops, box.col, y, box.cols, 1, "accent");
    const secondary = secondaryText(row.cols);
    const secW = Array.from(secondary).length;
    const mainCols = Math.max(0, contentCols - 1 - (secW > 0 ? secW + 1 : 0));
    const main = row.cols[0] ?? "";
    const shown = onCursor && !clock.reducedMotion ? marquee(main, mainCols, clock.elapsed).trimEnd() : clip(main, mainCols);
    const color = rowColor(row, onCursor);
    text(ops, box.col, y, (row.current ? ">" : " ") + shown, color);
    if (secW > 0) text(ops, box.col + contentCols, y, secondary, onCursor ? "accentInk" : row.alert ? "alert" : "dim", "right");
    if (row.action) hits.push({ x: px(box.col), y: px(y), w: px(box.cols), h: CELL, target: { zone: box.zone, index } });
  }
  const last = box.row + box.visible - 1;
  if (win.below) text(ops, box.col + contentCols, last, "v", focused && win.first + box.visible - 1 === cursor && !!rows[cursor]?.action ? "accentInk" : "dim");
}

/** Title bar: band (or accent when focused) with the label, optional right text and an "up" hint. */
export function drawTitleBar(
  ops: DrawOp[], col: number, row: number, cols: number, label: string, right: string, focused: boolean, above: boolean,
): void {
  rect(ops, col, row, cols, 1, focused ? "accent" : "band");
  const ink: ColorRole = focused ? "accentInk" : "accent";
  text(ops, col, row, clip(label, cols - 1), ink);
  text(ops, col + cols - 1, row, clip(right, Math.max(0, cols - 1 - Array.from(label).length - 1)), focused ? "accentInk" : "dim", "right");
  if (above) text(ops, col + cols - 1, row, "^", ink);
}
