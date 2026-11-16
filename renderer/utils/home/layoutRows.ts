import type { ColorRole, DrawOp, HitRegion, HomeClock, HomeRow, ZoneId } from "./types";
import { CELL } from "./types";
import { clip, clipWords, marquee, marqueeNextChange } from "./text";

/** A zone's row window, in cells. */
export interface ZoneBox {
  zone: ZoneId; col: number; cols: number; row: number; visible: number;
  /** false: no "current" marker column (a zone whose rows are never current, like the updates). */
  marker?: boolean;
}

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

/**
 * A one-row bar behind text. The glyphs ink the top 7 of their 8 pixel rows, so the bar starts one pixel higher
 * (over the previous row's empty bottom line) to sit the text in its middle.
 */
export function bar(ops: DrawOp[], col: number, row: number, cols: number, color: ColorRole): void {
  ops.push({ op: "rect", x: px(col), y: px(row) - 1, w: px(cols), h: CELL + 1, color });
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
  if (row.kind === "subheader") return "dim";
  return row.kind === "header" ? "accent" : "text";
}

/** First visible row for the window, and whether rows are hidden above / below it. */
export interface Window {
  first: number; above: boolean; below: boolean;
  /** The window turns pages on its own (the unfocused updates zone). */
  paging?: boolean;
}

export function drawRows(
  ops: DrawOp[], hits: HitRegion[], box: ZoneBox, rows: HomeRow[], win: Window,
  cursor: number, focused: boolean, clock: HomeClock,
): number | null {
  let next: number | null = null;
  const markerCols = box.marker === false ? 0 : 1;
  for (let i = 0; i < box.visible; i++) {
    const index = win.first + i;
    const row = rows[index];
    if (!row) break;
    const y = box.row + i;
    const onCursor = focused && index === cursor && !!row.action;
    if (onCursor) bar(ops, box.col, y, box.cols, "accent");
    const secondary = secondaryText(row.cols);
    const secW = Array.from(secondary).length;
    const mainCols = Math.max(0, box.cols - markerCols - (secW > 0 ? secW + 1 : 0));
    const main = row.cols[0] ?? "";
    const scrolls = onCursor && !clock.reducedMotion && Array.from(main).length > mainCols;
    const since = clock.elapsed - clock.cursorSince;
    if (scrolls) next = minChange(next, marqueeNextChange(main, mainCols, since));
    const shown = scrolls ? marquee(main, mainCols, since).trimEnd() : clipWords(main, mainCols);
    const color = rowColor(row, onCursor);
    text(ops, box.col, y, (markerCols ? (row.current ? ">" : " ") : "") + shown, color);
    if (markerCols && row.standby) text(ops, box.col, y, ">", onCursor ? "accentInk" : "dim");
    if (secW > 0) text(ops, box.col + box.cols, y, secondary, onCursor ? "accentInk" : row.alert ? "alert" : "dim", "right");
    if (row.action) hits.push({ x: px(box.col), y: px(y), w: px(box.cols), h: CELL, target: { zone: box.zone, index } });
  }
  return next;
}

/** The sooner of two "seconds until the next change" values; null means never. */
export const minChange = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.min(a, b);

/** Cells at the right end of a title bar kept for the scroll hints: "^" (rows above), "v" (rows below). */
export const HINT_COLS = 2;

/**
 * Title bar: always the navy band (yellow bars mean "selected", and only the cursor row gets one). The focused
 * zone's label and hints turn yellow; the others are white. Right text is dim.
 */
export function drawTitleBar(
  ops: DrawOp[], col: number, row: number, cols: number, label: string, right: string, focused: boolean,
  /** null: a bar that never scrolls (no hint cells reserved). */
  win: { above: boolean; below: boolean } | null,
): void {
  bar(ops, col, row, cols, "band");
  const ink: ColorRole = focused ? "accent" : "text";
  const hints = win ? HINT_COLS : 0;
  const labelText = clip(label, cols - hints);
  text(ops, col, row, labelText, ink);
  const end = col + cols - hints;
  // A space between the right text and the hints, so "10 TAPES" never runs into "^v".
  const rightEnd = hints ? end - 1 : end;
  text(ops, rightEnd, row, clip(right, Math.max(0, rightEnd - col - Array.from(labelText).length - 1)), "dim", "right");
  if (win?.above) text(ops, end, row, "^", ink);
  if (win?.below) text(ops, end + 1, row, "v", ink);
}
