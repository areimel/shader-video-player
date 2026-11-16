import { describe, expect, it } from "vitest";
import { BOXES, UPDATES_PAGE_SECONDS, layout, updatesFirst } from "../../renderer/utils/home/layout";
import { hitTest } from "../../renderer/utils/home/hit";
import { homeReducer, initialState } from "../../renderer/utils/home/state";
import type { DrawOp, HomeClock, HomeFrame, HomeState } from "../../renderer/utils/home/types";
import { ascii, bigModel, clock, model } from "./fixtures";

const L = 16, R = 304, T = 16, B = 224;
const bg = (op: DrawOp) => op.op === "rect" && op.x === 0 && op.y === 0 && op.w === 320 && op.h === 240;

function textOps(frame: HomeFrame) {
  return frame.ops.filter((o): o is Extract<DrawOp, { op: "text" }> => o.op === "text");
}

describe("layout bounds", () => {
  const m = bigModel();
  const cases: [string, HomeState, HomeClock][] = [
    ["start", initialState(m), clock],
    ["end of library", homeReducer(initialState(m), { type: "edge", to: "end" }, m), { ...clock, elapsed: 7.3 }],
    ["updates focused", homeReducer(initialState(m), { type: "point", target: { zone: "tv", index: 3 } }, m), { ...clock, elapsed: 13 }],
  ];
  for (const [name, state, clk] of cases) {
    it(`keeps every op inside the inset (${name})`, () => {
      const frame = layout(m, state, clk);
      expect(frame.ops.filter(bg)).toHaveLength(1);
      for (const op of frame.ops) {
        if (bg(op)) continue;
        if (op.op === "rect") {
          expect(op.x).toBeGreaterThanOrEqual(L); expect(op.x + op.w).toBeLessThanOrEqual(R);
          expect(op.y).toBeGreaterThanOrEqual(T); expect(op.y + op.h).toBeLessThanOrEqual(B);
        } else {
          const w = Array.from(op.text).length * 8 * (op.scale ?? 1);
          const [x0, x1] = op.align === "right" ? [op.x - w, op.x] : [op.x, op.x + w];
          expect(x0).toBeGreaterThanOrEqual(L); expect(x1).toBeLessThanOrEqual(R);
          expect(op.y).toBeGreaterThanOrEqual(T); expect(op.y + 8 * (op.scale ?? 1)).toBeLessThanOrEqual(B);
        }
      }
    });
  }

  it("keeps row text inside its own zone", () => {
    const frame = layout(m, initialState(m), { ...clock, elapsed: 2 });
    for (const op of textOps(frame)) {
      if (op.y < 6 * 8 || op.scale === 2) continue;
      const zone = op.y >= 18 * 8 ? (op.x >= 21 * 8 || (op.align === "right" && op.x > 20 * 8) ? BOXES.updates : BOXES.tv) : BOXES.library;
      const w = Array.from(op.text).length * 8;
      const [x0, x1] = op.align === "right" ? [op.x - w, op.x] : [op.x, op.x + w];
      expect(x0).toBeGreaterThanOrEqual(zone.col * 8);
      expect(x1).toBeLessThanOrEqual((zone.col + zone.cols) * 8);
    }
  });
});

describe("drawing rules", () => {
  it("highlights only the focused zone's cursor row", () => {
    const m = model();
    const s = initialState(m);
    const f = layout(m, s, clock);
    const bars = f.ops.filter((o) => o.op === "rect" && o.color === "accent");
    // only the cursor row gets a yellow bar (title bars stay navy; the focused label turns yellow)
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ y: 7 * 8 - 1, h: 9 });
    const title = textOps(f).find((o) => o.text === "LIBRARY")!;
    expect(title.color).toBe("accent");
    expect(textOps(f).find((o) => o.text === "TV PRESET")!.color).toBe("text");
    const tv = textOps(f).find((o) => o.text.includes("OFF"));
    expect(tv!.color).toBe("text");
  });

  it("draws a dim > on the standby preset", () => {
    const m = model({ tv: { activeEffectId: null, selectedEffectId: "crt", presetId: "pvm" } });
    const f = layout(m, initialState(m), clock);
    const y = (BOXES.tv.row + m.zones.tv.findIndex((r) => r.standby)) * 8;
    expect(textOps(f).filter((o) => o.y === y && o.x === 16).map((o) => [o.text.trim(), o.color])).toContainEqual([">", "dim"]);
  });

  it("marks the current row with > and a space on others", () => {
    const m = model();
    const f = layout(m, initialState(m), clock);
    const rows = textOps(f).filter((o) => o.x === 16 && o.y >= 18 * 8);
    expect(rows.find((o) => o.text.includes("CONSUMER TV"))!.text.startsWith(">")).toBe(true);
    expect(rows.find((o) => o.text.includes("STUDIO"))!.text.startsWith(" ")).toBe(true);
  });

  it("scrolls the focused cursor title with elapsed, statically under reduced motion", () => {
    const m = model({ recents: [{ path: "/x", name: "A really very long recent file name here.mkv", openedAt: 1 }] });
    const s = initialState(m);
    const row = (c: HomeClock) => textOps(layout(m, s, c)).find((o) => o.y === 6 * 8 + 8 && o.x === 16)!.text;
    const a = row({ ...clock, elapsed: 0 });
    const b = row({ ...clock, elapsed: 3 });
    expect(b).not.toBe(a);
    expect(row({ ...clock, elapsed: 3, reducedMotion: true })).toBe(a);
  });

  it("starts a long cursor title from its beginning whenever the cursor lands on it", () => {
    const m = model({ recents: [{ path: "/x", name: "A really very long recent file name here.mkv", openedAt: 1 }] });
    const s = initialState(m);
    const row = (c: HomeClock) => textOps(layout(m, s, c)).find((o) => o.y === 7 * 8 && o.x === 16)!.text;
    const start = row({ ...clock, elapsed: 0, cursorSince: 0 });
    expect(row({ ...clock, elapsed: 37.3, cursorSince: 37.3 })).toBe(start);
    expect(row({ ...clock, elapsed: 37.3 + 0.9, cursorSince: 37.3 })).toBe(start); // still in the opening pause
  });

  it("shows scroll hints", () => {
    const m = bigModel();
    const top = textOps(layout(m, initialState(m), clock));
    expect(top.some((o) => o.text === "v")).toBe(true);
    expect(top.some((o) => o.text === "^")).toBe(false);
    const scrolled = homeReducer(initialState(m), { type: "wheel", zone: "library", by: 5 }, m);
    expect(textOps(layout(m, scrolled, clock)).some((o) => o.text === "^")).toBe(true);
    // Hints live on the title bars, never on a row.
    for (const o of textOps(layout(m, scrolled, clock)).filter((o) => o.text === "^" || o.text === "v")) {
      expect([5, 17].map((r) => r * 8)).toContain(o.y);
    }
  });

  it("keeps a space between a title bar's right text and its hints, and none on a bar that never scrolls", () => {
    const m = bigModel();
    const ops = textOps(layout(m, homeReducer(initialState(m), { type: "wheel", zone: "library", by: 2 }, m), clock));
    const status = ops.find((o) => o.y === 5 * 8 && o.align === "right" && o.color === "dim")!;
    const hint = ops.find((o) => o.y === 5 * 8 && o.text === "^")!;
    expect(status.x).toBe(hint.x - 8);
    const version = ops.find((o) => o.text === "V0.2.0")!;
    expect(version.x).toBe((BOXES.updates.col + BOXES.updates.cols) * 8);
  });

  it("keeps a one-cell gutter between the TV and updates zones", () => {
    expect(BOXES.tv.col + BOXES.tv.cols).toBe(BOXES.updates.col - 1);
    expect(BOXES.updates.col + BOXES.updates.cols).toBe(38);
  });

  it("draws a static credits block: version on its bar, author below", () => {
    const at = (c: HomeClock) => textOps(layout(model(), initialState(model()), c)).filter((o) => o.y >= 26 * 8).map((o) => o.text);
    expect(at(clock)).toEqual(["CREDITS", "V0.2.0", "ALEC REIMEL"]);
    expect(at({ ...clock, elapsed: 3 })).toEqual(at(clock));
  });

  it("reports when time alone next changes the frame: a scrolling cursor title or the updates page", () => {
    const still = model({ changelog: [], credits: { version: "1", author: "A", thirdParty: [] } });
    expect(layout(still, initialState(still), clock).nextChange).toBeNull();
    const long = model({ changelog: [], credits: still.credits, recents: [{ path: "/x", name: "A really very long recent file name here, longer than the row.mkv", openedAt: 1 }] });
    const s = initialState(long);
    expect(long.zones.library[s.cursor.library]!.id).toBe("recent:/x");
    expect(layout(long, s, clock).nextChange).toBeCloseTo(1.25); // the opening pause, then one step
    expect(layout(long, s, { ...clock, reducedMotion: true }).nextChange).toBeNull();
    const paging = bigModel();
    expect(layout(paging, initialState(paging), { ...clock, elapsed: 2 }).nextChange).toBeCloseTo(UPDATES_PAGE_SECONDS - 2);
    expect(layout(paging, initialState(paging), { ...clock, reducedMotion: true }).nextChange).toBeNull();
  });
});

describe("updates paging", () => {
  const m = bigModel();
  const rows = m.zones.updates.length;
  const firstUpdateText = (c: HomeClock, s = initialState(m)) =>
    textOps(layout(m, s, c)).find((o) => o.y === 18 * 8 && o.x >= 21 * 8 && o.align !== "right")?.text;

  it("pages every 6 seconds while unfocused and wraps", () => {
    const page = BOXES.updates.visible;
    expect(rows).toBeGreaterThan(page);
    expect(updatesFirst(rows, 0)).toBe(0);
    expect(updatesFirst(rows, UPDATES_PAGE_SECONDS)).toBe(page);
    const pages = Math.ceil(rows / page);
    expect(updatesFirst(rows, UPDATES_PAGE_SECONDS * pages)).toBe(0);
    expect(updatesFirst(4, 100)).toBe(0);
    expect(firstUpdateText({ ...clock, elapsed: 0 })).not.toBe(firstUpdateText({ ...clock, elapsed: 6 }));
  });

  it("is static under reduced motion and uses scroll when focused", () => {
    expect(firstUpdateText({ ...clock, elapsed: 0, reducedMotion: true })).toBe(firstUpdateText({ ...clock, elapsed: 12, reducedMotion: true }));
    const focused = homeReducer(homeReducer(initialState(m), { type: "zone", dir: 1 }, m), { type: "zone", dir: 1 }, m);
    expect(firstUpdateText({ ...clock, elapsed: 0 }, focused)).toBe(firstUpdateText({ ...clock, elapsed: 7 }, focused));
    const moved = homeReducer(focused, { type: "wheel", zone: "updates", by: 1 }, m);
    expect(firstUpdateText({ ...clock, elapsed: 0 }, moved)).toBe(m.zones.updates[1]!.cols[0]!.toUpperCase());
  });
});

describe("hits", () => {
  it("has one region per visible focusable row, matching the drawn bar rows", () => {
    const m = bigModel();
    let s = initialState(m);
    s = homeReducer(s, { type: "wheel", zone: "library", by: 4 }, m);
    const f = layout(m, s, clock);
    const visible = (zone: "library" | "tv") =>
      m.zones[zone].slice(s.scroll[zone], s.scroll[zone] + 10).filter((r) => r.action).length;
    expect(f.hits.filter((h) => h.target.zone === "library")).toHaveLength(visible("library"));
    expect(f.hits.filter((h) => h.target.zone === "tv")).toHaveLength(visible("tv"));
    expect(f.hits.filter((h) => h.target.zone === "updates")).toHaveLength(0);
    for (const h of f.hits) {
      const box = BOXES[h.target.zone];
      expect(h.y).toBe((box.row + h.target.index - s.scroll[h.target.zone]) * 8);
      expect(m.zones[h.target.zone][h.target.index]!.action).toBeDefined();
      expect(hitTest(f, h.x + 3, h.y + 3)).toEqual(h.target);
    }
    expect(hitTest(f, 5, 5)).toBeNull();
    expect(hitTest(f, 319, 239)).toBeNull();
  });
});

describe("sample frame", () => {
  it("renders to the grid", () => {
    const m = model();
    const grid = ascii(layout(m, initialState(m), { ...clock, elapsed: 0 }));
    expect(grid).toHaveLength(30);
    expect(grid.every((r) => r.length === 40)).toBe(true);
    if (process.env.SVP_DUMP_HOME) console.log("\n" + grid.map((r, i) => `${String(i).padStart(2)}|${r}|`).join("\n"));
  });
});
