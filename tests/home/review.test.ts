import { describe, expect, it, vi } from "vitest";
import { clickAction, runRowAction } from "../../renderer/utils/home/actions";
import { mirrorStart, MIRROR_ROWS } from "../../renderer/utils/home/frame";
import { isRealMove } from "../../renderer/utils/home/pointer";
import { keyToAction } from "../../renderer/utils/home/state";
import { wheelPixels, wheelStep, WHEEL_ROW_PX } from "../../renderer/utils/home/wheel";
import { model } from "./fixtures";

describe("wheelStep", () => {
  it("turns many small trackpad deltas into one row per threshold", () => {
    let acc = 0, rows = 0;
    for (let i = 0; i < 20; i++) { const s = wheelStep(acc, 4, 0); acc = s.acc; rows += s.rows; } // 80 px
    expect(rows).toBe(80 / WHEEL_ROW_PX);
  });
  it("moves two rows for a 100 px mouse notch and keeps the remainder", () => {
    expect(wheelStep(0, 100, 0)).toEqual({ rows: 2, acc: 20 });
    expect(wheelStep(20, 30, 0)).toEqual({ rows: 1, acc: 10 });
  });
  it("drops the remainder on a change of direction", () => {
    expect(wheelStep(30, -10, 0)).toEqual({ rows: 0, acc: -10 });
  });
  it("normalises line and page modes", () => {
    expect(wheelPixels(3, 1)).toBe(3 * WHEEL_ROW_PX);
    expect(wheelStep(0, 1, 2).rows).toBe(10);
    expect(wheelPixels(NaN, 0)).toBe(0);
  });
});

describe("isRealMove", () => {
  const e = (sx: number, sy: number, mx: number, my: number) => ({ screenX: sx, screenY: sy, movementX: mx, movementY: my });
  it("needs movement and a new screen position", () => {
    expect(isRealMove(null, e(10, 10, 2, 0))).toBe(true);
    expect(isRealMove({ x: 10, y: 10 }, e(12, 10, 2, 0))).toBe(true);
    expect(isRealMove({ x: 10, y: 10 }, e(10, 10, 0, 0))).toBe(false); // a repaint under a resting pointer
    expect(isRealMove({ x: 10, y: 10 }, e(40, 70, 0, 0))).toBe(false); // a resize: coordinates move, the pointer did not
    expect(isRealMove({ x: 10, y: 10 }, e(10, 10, 1, 1))).toBe(false);
  });
});

describe("key repeat", () => {
  it("repeats navigation but not activate or remove", () => {
    expect(keyToAction("ArrowDown", false, true)).toEqual({ type: "move", by: 1 });
    expect(keyToAction("Enter", false, true)).toBeNull();
    expect(keyToAction(" ", false, true)).toBeNull();
    expect(keyToAction("Delete", false, true)).toBeNull();
    expect(keyToAction("Enter", false, false)).toBe("activate");
  });
});

describe("row actions", () => {
  const handlers = () => ({
    openRecent: vi.fn(), openDialog: vi.fn(), openItem: vi.fn(), addFolder: vi.fn(), removeFolder: vi.fn(), rescan: vi.fn(),
  });
  it("maps every action to its handler", () => {
    const h = handlers();
    const tv = { setEffect: vi.fn(), applyPreset: vi.fn() };
    runRowAction({ type: "openRecent", path: "/a" }, h, tv);
    runRowAction({ type: "openDialog" }, h, tv);
    runRowAction({ type: "openItem", itemId: "i" }, h, tv);
    runRowAction({ type: "addFolder" }, h, tv);
    runRowAction({ type: "removeFolder", folderId: "f-1" }, h, tv);
    runRowAction({ type: "rescan" }, h, tv);
    expect(h.openRecent).toHaveBeenCalledWith("/a");
    expect(h.openItem).toHaveBeenCalledWith("i");
    expect(h.removeFolder).toHaveBeenCalledWith("f-1");
    for (const f of [h.openDialog, h.addFolder, h.rescan]) expect(f).toHaveBeenCalledTimes(1);
  });
  it("sets the effect, then the preset; Off and EDITED leave the values alone", () => {
    const tv = { setEffect: vi.fn(), applyPreset: vi.fn() };
    runRowAction({ type: "setTv", effectId: "crt", presetId: "pvm" }, handlers(), tv);
    expect(tv.setEffect).toHaveBeenLastCalledWith("crt");
    expect(tv.applyPreset).toHaveBeenCalledWith("pvm");
    runRowAction({ type: "setTv", effectId: null, presetId: null }, handlers(), tv);
    runRowAction({ type: "setTv", effectId: "vhs", presetId: null }, handlers(), tv);
    expect(tv.setEffect).toHaveBeenLastCalledWith("vhs");
    expect(tv.applyPreset).toHaveBeenCalledTimes(1);
  });
  it("does not let a click remove a folder", () => {
    const m = model();
    const folder = m.zones.library.findIndex((r) => r.action?.type === "removeFolder");
    expect(clickAction(m, { zone: "library", index: folder })).toBeNull();
    const item = m.zones.library.findIndex((r) => r.action?.type === "openItem");
    expect(clickAction(m, { zone: "library", index: item })).toEqual(m.zones.library[item]!.action);
    expect(clickAction(m, { zone: "library", index: 999 })).toBeNull();
  });
});

describe("mirrorStart", () => {
  it("always holds the cursor in a bounded, stepped window", () => {
    for (const length of [0, 5, 48, 49, 3000]) {
      for (let cursor = 0; cursor < length; cursor += 7) {
        const start = mirrorStart(length, cursor);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(cursor).toBeGreaterThanOrEqual(start);
        expect(cursor).toBeLessThan(start + MIRROR_ROWS);
      }
    }
    expect(mirrorStart(3000, 100)).toBe(mirrorStart(3000, 101)); // most moves keep the window
  });
});
