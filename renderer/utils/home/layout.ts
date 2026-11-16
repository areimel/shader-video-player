import type { DrawOp, HitRegion, HomeClock, HomeFrame, HomeModel, HomeState, ZoneId } from "./types";
import { CELL, COLS, INSET, ROWS } from "./types";
import { clip } from "./text";
import { drawRows, drawTitleBar, minChange, text, type Window, type ZoneBox } from "./layoutRows";

/** Zone geometry in cells. Nothing but the background is drawn outside cols 2..37 / rows 2..27. */
export const LEFT = INSET;
export const RIGHT = COLS - INSET - 1;
export const LIBRARY_BOX: ZoneBox = { zone: "library", col: LEFT, cols: RIGHT - LEFT + 1, row: 6, visible: 10 };
/**
 * The two lower zones split the 36 cells 19 | gutter | 16. Scroll hints sit in the title bars, so rows use their
 * zone's full width: the TV zone holds the marker plus 18 (every preset label but one fits), and the updates zone,
 * which has no marker column, holds 16 (UPDATES_COLS in model.ts).
 */
export const TV_BOX: ZoneBox = { zone: "tv", col: LEFT, cols: 19, row: 18, visible: 10 };
const UPDATES_COL = LEFT + 19 + 1;
export const UPDATES_BOX: ZoneBox = { zone: "updates", col: UPDATES_COL, cols: RIGHT - UPDATES_COL + 1, row: 18, visible: 8, marker: false };
export const BOXES: Record<ZoneId, ZoneBox> = { library: LIBRARY_BOX, tv: TV_BOX, updates: UPDATES_BOX };
/** Visible rows per zone (also the page size). */
export const VISIBLE: Record<ZoneId, number> = { library: LIBRARY_BOX.visible, tv: TV_BOX.visible, updates: UPDATES_BOX.visible };
export const UPDATES_PAGE_SECONDS = 6;
const CREDITS_BAR_ROW = UPDATES_BOX.row + UPDATES_BOX.visible;
const CREDITS_ROW = CREDITS_BAR_ROW + 1;

/** First visible row of the updates zone while it is unfocused: it pages like a guide channel. */
export function updatesFirst(rowCount: number, elapsed: number): number {
  const page = UPDATES_BOX.visible;
  if (rowCount <= page) return 0;
  const pages = Math.ceil(rowCount / page);
  return (Math.floor(Math.max(0, elapsed) / UPDATES_PAGE_SECONDS) % pages) * page;
}

function windowOf(zone: ZoneId, rowCount: number, state: HomeState, clock: HomeClock): Window {
  const visible = VISIBLE[zone];
  const auto = zone === "updates" && state.zone !== "updates" && !clock.reducedMotion;
  const first = auto ? updatesFirst(rowCount, clock.elapsed) : Math.max(0, Math.min(state.scroll[zone], Math.max(0, rowCount - visible)));
  return { first, above: first > 0, below: first + visible < rowCount, paging: auto && rowCount > visible };
}

/** The static credits block under the updates: version on the bar, author below. Third-party names page with the updates. */
function credits(ops: DrawOp[], model: HomeModel): void {
  const { col, cols } = UPDATES_BOX;
  drawTitleBar(ops, col, CREDITS_BAR_ROW, cols, "CREDITS", `V${model.credits.version}`, false, null);
  text(ops, col, CREDITS_ROW, clip(model.credits.author, cols), "text");
}

export function layout(model: HomeModel, state: HomeState, clock: HomeClock): HomeFrame {
  const ops: DrawOp[] = [];
  const hits: HitRegion[] = [];
  ops.push({ op: "rect", x: 0, y: 0, w: COLS * CELL, h: ROWS * CELL, color: "bg" });

  text(ops, LEFT, 2, "SHADER VIDEO", "accent", "left", 2);
  text(ops, RIGHT + 1, 2, clip(clock.timeText, 16), "text", "right");
  text(ops, RIGHT + 1, 3, "CH 03", "dim", "right");

  const wins = {} as Record<ZoneId, Window>;
  for (const zone of ["library", "tv", "updates"] as const) wins[zone] = windowOf(zone, model.zones[zone].length, state, clock);

  const titles: [ZoneId, string, string][] = [
    ["library", "LIBRARY", model.libraryStatus], ["tv", "TV PRESET", ""], ["updates", "LATEST UPDATES", ""],
  ];
  for (const [zone, label, right] of titles) {
    const box = BOXES[zone];
    drawTitleBar(ops, box.col, box.row - 1, box.cols, label, right, state.zone === zone, wins[zone]);
  }
  let nextChange = wins.updates.paging ? UPDATES_PAGE_SECONDS - (Math.max(0, clock.elapsed) % UPDATES_PAGE_SECONDS) : null;
  for (const zone of ["library", "tv", "updates"] as const) {
    nextChange = minChange(nextChange, drawRows(ops, hits, BOXES[zone], model.zones[zone], wins[zone], state.cursor[zone], state.zone === zone, clock));
  }
  credits(ops, model);
  return { ops, hits, nextChange };
}

