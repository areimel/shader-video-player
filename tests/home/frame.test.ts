import { describe, expect, it } from "vitest";
import { formatClock, mirrorId, msToNextMinute, sameOps } from "../../renderer/utils/home/frame";
import { zoneAt } from "../../renderer/utils/home/hit";
import { BOXES, layout } from "../../renderer/utils/home/layout";
import { clientToUv, containUv, uvToLogical } from "../../renderer/utils/home/pointer";
import { initialState } from "../../renderer/utils/home/state";
import { clock, model } from "./fixtures";

describe("formatClock", () => {
  it("is a 12-hour VCR clock", () => {
    expect(formatClock(new Date(2026, 0, 1, 0, 41))).toBe("12:41AM");
    expect(formatClock(new Date(2026, 0, 1, 9, 5))).toBe("9:05AM");
    expect(formatClock(new Date(2026, 0, 1, 12, 0))).toBe("12:00PM");
    expect(formatClock(new Date(2026, 0, 1, 23, 59))).toBe("11:59PM");
  });
  it("counts down to the next minute", () => {
    expect(msToNextMinute(new Date(2026, 0, 1, 0, 0, 59, 500))).toBe(500);
    expect(msToNextMinute(new Date(2026, 0, 1, 0, 0, 0, 0))).toBe(60_000);
  });
});

describe("sameOps", () => {
  const m = model();
  const a = layout(m, initialState(m), clock).ops;
  it("matches an identical layout and rejects a changed one", () => {
    expect(sameOps(a, layout(m, initialState(m), clock).ops)).toBe(true);
    expect(sameOps(null, a)).toBe(false);
    expect(sameOps(a, layout(m, initialState(m), { ...clock, timeText: "1:00PM" }).ops)).toBe(false);
    expect(sameOps(a, a.slice(1))).toBe(false);
  });
});

describe("mirrorId", () => {
  it("is a valid, stable DOM id for any row id", () => {
    expect(mirrorId("tv", "tv:crt:composite-tv")).toBe("home-tv-tv_3a_crt_3a_composite-tv");
    const id = mirrorId("library", "recent:/home/me/My Movie (1999).mkv");
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(mirrorId("library", "a b")).not.toBe(mirrorId("library", "a_b"));
  });
});

describe("pointer mapping", () => {
  it("maps a client point to element uv", () => {
    expect(clientToUv(150, 100, { left: 100, top: 50, width: 100, height: 100 })).toEqual({ x: 0.5, y: 0.5 });
  });
  it("undoes a 4:3 contain fit and rejects the bars", () => {
    const view = { width: 1600, height: 900 }, pic = { width: 640, height: 480 };
    expect(containUv({ x: 0.5, y: 0.5 }, view, pic)).toEqual({ x: 0.5, y: 0.5 });
    // the picture is 1200 wide, centred: x from 200 to 1400
    expect(containUv({ x: 200 / 1600, y: 0 }, view, pic)).toEqual({ x: 0, y: 0 });
    expect(containUv({ x: 100 / 1600, y: 0.5 }, view, pic)).toBeNull();
  });
  it("scales picture uv to logical pixels", () => {
    expect(uvToLogical({ x: 0.5, y: 0.25 })).toEqual({ x: 160, y: 60 });
    expect(uvToLogical(null)).toBeNull();
    expect(uvToLogical({ x: 1, y: 0.5 })).toBeNull();
  });
  it("finds the zone under a point, title bar included", () => {
    expect(zoneAt(BOXES.library.col * 8, (BOXES.library.row - 1) * 8)).toBe("library");
    expect(zoneAt(BOXES.tv.col * 8 + 4, (BOXES.tv.row + 2) * 8)).toBe("tv");
    expect(zoneAt(BOXES.updates.col * 8 + 4, BOXES.updates.row * 8)).toBe("updates");
    expect(zoneAt(2, 2)).toBeNull();
  });
});
