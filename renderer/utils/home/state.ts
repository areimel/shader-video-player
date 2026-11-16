import type { HomeAction, HomeModel, HomeRow, HomeState, RowAction, ZoneId } from "./types";
import { ZONES } from "./types";
import { VISIBLE } from "./layout";

const focusable = (row: HomeRow | undefined): boolean => !!row?.action;
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const maxScroll = (zone: ZoneId, rows: HomeRow[]): number => Math.max(0, rows.length - VISIBLE[zone]);
const firstFocusable = (rows: HomeRow[]): number => rows.findIndex(focusable);
const lastFocusable = (rows: HomeRow[]): number => {
  for (let i = rows.length - 1; i >= 0; i--) if (focusable(rows[i])) return i;
  return -1;
};

/** Nearest focusable row at or beyond `from` in `dir`, else back the other way; -1 when none. */
function nearest(rows: HomeRow[], from: number, dir: 1 | -1): number {
  const start = clamp(from, 0, rows.length - 1);
  for (let i = start; i >= 0 && i < rows.length; i += dir) if (focusable(rows[i])) return i;
  for (let i = start - dir; i >= 0 && i < rows.length; i -= dir) if (focusable(rows[i])) return i;
  return -1;
}

/** Scroll that keeps `cursor` in the window; the first/last focusable row reveals the list's end. */
function followCursor(zone: ZoneId, rows: HomeRow[], scroll: number, cursor: number): number {
  const visible = VISIBLE[zone];
  const max = maxScroll(zone, rows);
  let s = clamp(scroll, 0, max);
  if (cursor < s) s = cursor;
  else if (cursor >= s + visible) s = cursor - visible + 1;
  if (cursor === firstFocusable(rows) && cursor < visible) s = 0;
  if (cursor === lastFocusable(rows) && cursor >= max) s = max;
  return clamp(s, 0, max);
}

function put(state: HomeState, zone: ZoneId, patch: { cursor?: number; scroll?: number; focus?: ZoneId }): HomeState {
  const cursor = patch.cursor ?? state.cursor[zone];
  const scroll = patch.scroll ?? state.scroll[zone];
  const focus = patch.focus ?? state.zone;
  if (cursor === state.cursor[zone] && scroll === state.scroll[zone] && focus === state.zone) return state;
  return {
    zone: focus,
    cursor: { ...state.cursor, [zone]: cursor },
    scroll: { ...state.scroll, [zone]: scroll },
  };
}

function placeCursor(state: HomeState, zone: ZoneId, rows: HomeRow[], cursor: number, focus?: ZoneId): HomeState {
  return put(state, zone, { cursor, scroll: followCursor(zone, rows, state.scroll[zone], cursor), focus });
}

export function initialState(model: HomeModel): HomeState {
  const cursor = {} as Record<ZoneId, number>;
  const scroll = {} as Record<ZoneId, number>;
  for (const z of ZONES) {
    cursor[z] = Math.max(0, firstFocusable(model.zones[z]));
    scroll[z] = followCursor(z, model.zones[z], 0, cursor[z]);
  }
  return { zone: "library", cursor, scroll };
}

function move(state: HomeState, model: HomeModel, rawBy: number): HomeState {
  const zone = state.zone;
  const rows = model.zones[zone];
  // |by| > 1 means "a page" (the key map does not know the focused zone's height).
  const by = Math.abs(rawBy) > 1 ? Math.sign(rawBy) * VISIBLE[zone] : rawBy;
  if (firstFocusable(rows) < 0) return put(state, zone, { scroll: clamp(state.scroll[zone] + by, 0, maxScroll(zone, rows)) });
  const dir = by < 0 ? -1 : 1;
  const target = nearest(rows, clamp(state.cursor[zone] + by, 0, rows.length - 1), dir);
  return target < 0 ? state : placeCursor(state, zone, rows, target);
}

function edge(state: HomeState, model: HomeModel, to: "start" | "end"): HomeState {
  const zone = state.zone;
  const rows = model.zones[zone];
  if (firstFocusable(rows) < 0) return put(state, zone, { scroll: to === "start" ? 0 : maxScroll(zone, rows) });
  const target = to === "start" ? firstFocusable(rows) : lastFocusable(rows);
  const next = placeCursor(state, zone, rows, target);
  // The very top / bottom of the list shows its headers and trailing rows.
  return put(next, zone, { scroll: to === "start" ? 0 : maxScroll(zone, rows) });
}

function changeZone(state: HomeState, dir: -1 | 1, wrap: boolean): HomeState {
  const i = ZONES.indexOf(state.zone) + dir;
  const next = wrap ? (i + ZONES.length) % ZONES.length : clamp(i, 0, ZONES.length - 1);
  return put(state, state.zone, { focus: ZONES[next] });
}

function sync(state: HomeState, prev: HomeModel, next: HomeModel): HomeState {
  let out = state;
  for (const zone of ZONES) {
    const rows = next.zones[zone];
    const oldIndex = state.cursor[zone];
    const id = prev.zones[zone][oldIndex]?.id;
    const byId = id === undefined ? -1 : rows.findIndex((r) => r.id === id);
    const cursor = firstFocusable(rows) < 0 ? 0 : focusable(rows[byId]) ? byId : nearest(rows, oldIndex, 1);
    const moved = cursor !== oldIndex;
    const scroll = moved ? followCursor(zone, rows, state.scroll[zone], cursor) : clamp(state.scroll[zone], 0, maxScroll(zone, rows));
    out = put(out, zone, { cursor: Math.max(0, cursor), scroll });
  }
  return out;
}

export function homeReducer(state: HomeState, action: HomeAction, model: HomeModel): HomeState {
  switch (action.type) {
    case "move": return move(state, model, action.by);
    case "edge": return edge(state, model, action.to);
    case "zone": return changeZone(state, action.dir, !!action.wrap);
    case "point": {
      const { zone, index } = action.target;
      const rows = model.zones[zone];
      if (!focusable(rows[index])) return state;
      return placeCursor(state, zone, rows, index, zone);
    }
    case "wheel": {
      const rows = model.zones[action.zone];
      return put(state, action.zone, { scroll: clamp(state.scroll[action.zone] + action.by, 0, maxScroll(action.zone, rows)) });
    }
    case "sync": return sync(state, action.prev, action.next);
  }
}

/** Keys the home screen reacts to. `l` and `?` are reserved by the player and never mapped. */
export function keyToAction(key: string, shiftKey: boolean): HomeAction | "activate" | "remove" | null {
  switch (key) {
    case "ArrowUp": return { type: "move", by: -1 };
    case "ArrowDown": return { type: "move", by: 1 };
    case "PageUp": return { type: "move", by: -VISIBLE.library };
    case "PageDown": return { type: "move", by: VISIBLE.library };
    case "Home": return { type: "edge", to: "start" };
    case "End": return { type: "edge", to: "end" };
    case "ArrowLeft": return { type: "zone", dir: -1 };
    case "ArrowRight": return { type: "zone", dir: 1 };
    case "Tab": return { type: "zone", dir: shiftKey ? -1 : 1, wrap: true };
    case "Enter":
    case " ":
    case "Spacebar": return "activate";
    case "Delete":
    case "Backspace": return "remove";
    default: return null;
  }
}

/** A folder header only reacts to "remove"; every other action only to "activate". */
export function activate(model: HomeModel, state: HomeState, how: "activate" | "remove"): RowAction | null {
  const action = model.zones[state.zone][state.cursor[state.zone]]?.action;
  if (!action) return null;
  return (action.type === "removeFolder") === (how === "remove") ? action : null;
}
