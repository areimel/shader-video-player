import { describe, expect, it } from "vitest";
import { activate, homeReducer, initialState, keyToAction } from "../../renderer/utils/home/state";
import type { HomeAction, HomeModel, HomeState } from "../../renderer/utils/home/types";
import { bigModel, item, model, snapshot } from "./fixtures";

const run = (s: HomeState, m: HomeModel, ...a: HomeAction[]) => a.reduce((acc, x) => homeReducer(acc, x, m), s);
const idAt = (m: HomeModel, s: HomeState) => m.zones[s.zone][s.cursor[s.zone]]?.id;
const down: HomeAction = { type: "move", by: 1 };
const up: HomeAction = { type: "move", by: -1 };

describe("initialState", () => {
  it("puts the cursor on the first focusable row of each zone", () => {
    const m = model();
    const s = initialState(m);
    expect(s.zone).toBe("library");
    expect(idAt(m, s)).toBe("recent:/m/Alien.mkv");
    expect(m.zones.tv[s.cursor.tv]!.id).toBe("tv:off");
    expect(s.cursor.updates).toBe(0);
  });
});

describe("moving", () => {
  it("skips rows without an action", () => {
    const m = model();
    let s = initialState(m);
    s = run(s, m, down); // folder header
    expect(idAt(m, s)).toBe("folder:f-1");
    s = run(s, m, { type: "zone", dir: 1 }, down); // OFF -> (header skipped) CONSUMER TV
    expect(idAt(m, s)).toBe("tv:crt:consumer");
    s = run(s, m, down, down);
    expect(idAt(m, s)).toBe("tv:vhs:rental");
    expect(run(s, m, up, up, up, up, up).cursor.tv).toBe(0);
  });

  it("stays put at the ends and returns the same object", () => {
    const m = model();
    const s = initialState(m);
    expect(homeReducer(s, up, m)).toBe(s);
    const end = run(s, m, { type: "edge", to: "end" });
    expect(idAt(m, end)).toBe("act:open");
    expect(homeReducer(end, down, m)).toBe(end);
  });

  it("pages and goes to the edges", () => {
    const m = bigModel();
    let s = initialState(m);
    s = run(s, m, { type: "move", by: 10 });
    expect(s.cursor.library).toBeGreaterThanOrEqual(10);
    const end = run(s, m, { type: "edge", to: "end" });
    expect(idAt(m, end)).toBe("act:open");
    expect(end.scroll.library).toBe(m.zones.library.length - 10);
    const start = run(end, m, { type: "edge", to: "start" });
    expect(start.cursor.library).toBe(initialState(m).cursor.library);
    expect(start.scroll.library).toBe(0);
  });
});

describe("zones", () => {
  it("clamps for arrows and wraps for Tab", () => {
    const m = model();
    const s = initialState(m);
    expect(homeReducer(s, { type: "zone", dir: -1 }, m)).toBe(s);
    const u = run(s, m, { type: "zone", dir: 1 }, { type: "zone", dir: 1 });
    expect(u.zone).toBe("updates");
    expect(homeReducer(u, { type: "zone", dir: 1 }, m)).toBe(u);
    expect(run(u, m, { type: "zone", dir: 1, wrap: true }).zone).toBe("library");
    expect(run(s, m, { type: "zone", dir: -1, wrap: true }).zone).toBe("updates");
  });

  it("scrolls a zone without actionable rows", () => {
    const m = bigModel();
    let s = run(initialState(m), m, { type: "zone", dir: 1 }, { type: "zone", dir: 1 });
    s = run(s, m, down, down);
    expect(s.scroll.updates).toBe(2);
    s = run(s, m, { type: "edge", to: "end" });
    expect(s.scroll.updates).toBe(m.zones.updates.length - 6);
    expect(run(s, m, { type: "edge", to: "start" }).scroll.updates).toBe(0);
  });
});

describe("scroll follows the cursor", () => {
  it("keeps the cursor in the 10-row window both ways", () => {
    const m = bigModel();
    let s = initialState(m);
    for (let i = 0; i < 30; i++) {
      s = run(s, m, down);
      expect(s.cursor.library).toBeGreaterThanOrEqual(s.scroll.library);
      expect(s.cursor.library).toBeLessThan(s.scroll.library + 10);
    }
    expect(s.scroll.library).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) {
      s = run(s, m, up);
      expect(s.cursor.library).toBeGreaterThanOrEqual(s.scroll.library);
      expect(s.cursor.library).toBeLessThan(s.scroll.library + 10);
    }
  });
});

describe("point and wheel", () => {
  it("point focuses a focusable row and ignores others", () => {
    const m = model();
    const s = initialState(m);
    const p = run(s, m, { type: "point", target: { zone: "tv", index: 3 } });
    expect(p.zone).toBe("tv");
    expect(p.cursor.tv).toBe(3);
    expect(homeReducer(p, { type: "point", target: { zone: "tv", index: 1 } }, m)).toBe(p); // header
    expect(homeReducer(p, { type: "point", target: { zone: "tv", index: 3 } }, m)).toBe(p);
  });

  it("wheel scrolls a zone within bounds and leaves the cursor", () => {
    const m = bigModel();
    const s = initialState(m);
    const w = run(s, m, { type: "wheel", zone: "library", by: 3 });
    expect(w.scroll.library).toBe(3);
    expect(w.cursor.library).toBe(s.cursor.library);
    expect(run(w, m, { type: "wheel", zone: "library", by: -99 }).scroll.library).toBe(0);
    expect(run(w, m, { type: "wheel", zone: "library", by: 999 }).scroll.library).toBe(m.zones.library.length - 10);
    expect(homeReducer(model() && initialState(model()), { type: "wheel", zone: "tv", by: 5 }, model())).toEqual(initialState(model()));
  });
});

describe("sync", () => {
  it("keeps the cursor on the same row id when rows move", () => {
    const prev = model();
    let s = run(initialState(prev), prev, down, down); // first item
    const id = idAt(prev, s);
    const next = model({ recents: [], library: snapshot([item("0", "0.mkv"), item("a", "Alien.mkv"), item("b", "Akira.mp4")]) });
    s = homeReducer(s, { type: "sync", prev, next }, next);
    expect(idAt(next, s)).toBe(id);
  });

  it("clamps to the nearest focusable row when the row vanishes", () => {
    const prev = model();
    const s = run(initialState(prev), prev, { type: "edge", to: "end" });
    const next = model({ recents: [], library: snapshot([], { folders: [] }) });
    const out = homeReducer(s, { type: "sync", prev, next }, next);
    expect(next.zones.library[out.cursor.library]!.action).toBeDefined();
    expect(out.scroll.library).toBe(0);
  });

  it("returns the same state when nothing changed", () => {
    const m = model();
    const s = initialState(m);
    expect(homeReducer(s, { type: "sync", prev: m, next: model() }, model())).toBe(s);
  });
});

describe("keys and activation", () => {
  it("maps keys", () => {
    expect(keyToAction("ArrowDown", false)).toEqual({ type: "move", by: 1 });
    expect(keyToAction("Tab", true)).toEqual({ type: "zone", dir: -1, wrap: true });
    expect(keyToAction("ArrowRight", false)).toEqual({ type: "zone", dir: 1 });
    expect(keyToAction("Enter", false)).toBe("activate");
    expect(keyToAction(" ", false)).toBe("activate");
    expect(keyToAction("Delete", false)).toBe("remove");
    expect(keyToAction("Backspace", false)).toBe("remove");
    expect(keyToAction("Home", false)).toEqual({ type: "edge", to: "start" });
    expect(keyToAction("l", false)).toBeNull();
    expect(keyToAction("?", true)).toBeNull();
  });

  it("activate and remove follow the folder-header rule", () => {
    const m = model();
    let s = initialState(m);
    expect(activate(m, s, "activate")).toEqual({ type: "openRecent", path: "/m/Alien.mkv" });
    expect(activate(m, s, "remove")).toBeNull();
    s = run(s, m, down);
    expect(activate(m, s, "activate")).toBeNull();
    expect(activate(m, s, "remove")).toEqual({ type: "removeFolder", folderId: "f-1" });
    const u = run(s, m, { type: "zone", dir: 1 }, { type: "zone", dir: 1 });
    expect(activate(m, u, "activate")).toBeNull();
  });
});
