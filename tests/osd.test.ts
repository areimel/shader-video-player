import { describe, expect, it } from "vitest";
import {
  type OsdEvent, OSD_INITIAL, STATUS_MS, VOLUME_MS, formatCounter, nextExpiry, osdReducer,
  statusText, volumeNumber, volumeSegments,
} from "../renderer/utils/osd";

const play: OsdEvent = { kind: "transport", op: "play" };
const vol = (level: number, muted = false): OsdEvent => ({ kind: "volume", level, muted });

describe("osdReducer", () => {
  it("routes volume to the level slot and the rest to status, independently", () => {
    let s = osdReducer(OSD_INITIAL, { type: "show", event: play, now: 100 });
    s = osdReducer(s, { type: "show", event: vol(0.5), now: 200 });
    expect(s.status).toEqual({ event: play, until: 100 + STATUS_MS });
    expect(s.level).toEqual({ event: vol(0.5), until: 200 + VOLUME_MS });
  });
  it("routes speed, loop and subDelay to status", () => {
    for (const event of [{ kind: "speed", rate: 2 }, { kind: "loop", mode: "one" }, { kind: "subDelay", seconds: 0.1 }] as OsdEvent[]) {
      const s = osdReducer(OSD_INITIAL, { type: "show", event, now: 0 });
      expect(s.status?.event).toBe(event);
      expect(s.level).toBeNull();
    }
  });
  it("replacing a message replaces the event and refreshes the timer", () => {
    let s = osdReducer(OSD_INITIAL, { type: "show", event: play, now: 0 });
    const pause: OsdEvent = { kind: "transport", op: "pause" };
    s = osdReducer(s, { type: "show", event: pause, now: 1500 });
    expect(s.status).toEqual({ event: pause, until: 1500 + STATUS_MS });
  });
  it("expire clears only elapsed slots", () => {
    let s = osdReducer(OSD_INITIAL, { type: "show", event: play, now: 0 });
    s = osdReducer(s, { type: "show", event: vol(1), now: 0 });
    s = osdReducer(s, { type: "expire", now: VOLUME_MS });
    expect(s.level).toBeNull();
    expect(s.status).not.toBeNull();
    s = osdReducer(s, { type: "expire", now: STATUS_MS });
    expect(s).toEqual(OSD_INITIAL);
  });
  it("expire with nothing elapsed returns the same state", () => {
    const s = osdReducer(OSD_INITIAL, { type: "show", event: play, now: 0 });
    expect(osdReducer(s, { type: "expire", now: 1 })).toBe(s);
  });
});

describe("nextExpiry", () => {
  it("is null when empty and the earliest until otherwise", () => {
    expect(nextExpiry(OSD_INITIAL)).toBeNull();
    let s = osdReducer(OSD_INITIAL, { type: "show", event: play, now: 0 });
    expect(nextExpiry(s)).toBe(STATUS_MS);
    s = osdReducer(s, { type: "show", event: vol(1), now: 0 });
    expect(nextExpiry(s)).toBe(Math.min(STATUS_MS, VOLUME_MS));
    s = osdReducer(s, { type: "show", event: vol(1), now: 5000 });
    expect(nextExpiry(s)).toBe(STATUS_MS);
  });
});

describe("statusText", () => {
  const t = (e: OsdEvent) => statusText(e);
  it("transport", () => {
    expect(t(play)).toEqual({ label: "PLAY", glyph: "play" });
    expect(t({ kind: "transport", op: "pause" })).toEqual({ label: "PAUSE", glyph: "pause" });
    expect(t({ kind: "transport", op: "ff", seconds: 10 })).toEqual({ label: "FF +10S", glyph: "fwd10" });
    expect(t({ kind: "transport", op: "rew", seconds: 10 })).toEqual({ label: "REW -10S", glyph: "back10" });
    expect(t({ kind: "transport", op: "ff" })).toEqual({ label: "FF", glyph: "fwd10" });
    expect(t({ kind: "transport", op: "next" })).toEqual({ label: "NEXT", glyph: "skipNext" });
    expect(t({ kind: "transport", op: "prev" })).toEqual({ label: "PREV", glyph: "skipPrev" });
  });
  it("speed, loop", () => {
    expect(t({ kind: "speed", rate: 1.5 })).toEqual({ label: "SPEED 1.5X", glyph: null });
    expect(t({ kind: "speed", rate: 1 }).label).toBe("SPEED 1X");
    expect(t({ kind: "speed", rate: 0.25 }).label).toBe("SPEED 0.25X");
    expect(t({ kind: "loop", mode: "all" }).label).toBe("REPEAT ALL");
    expect(t({ kind: "loop", mode: "one" }).label).toBe("REPEAT ONE");
    expect(t({ kind: "loop", mode: "off" }).label).toBe("REPEAT OFF");
  });
  it("sub delay", () => {
    expect(t({ kind: "subDelay", seconds: 0.1 }).label).toBe("SUB DELAY +0.1S");
    expect(t({ kind: "subDelay", seconds: -0.3 }).label).toBe("SUB DELAY -0.3S");
    expect(t({ kind: "subDelay", seconds: 0 }).label).toBe("SUB DELAY 0.0S");
    expect(t({ kind: "subDelay", seconds: -0.04 }).label).toBe("SUB DELAY 0.0S");
  });
});

describe("volume", () => {
  it("segments round and clamp", () => {
    expect(volumeSegments(0)).toBe(0);
    expect(volumeSegments(1)).toBe(16);
    expect(volumeSegments(0.5)).toBe(8);
    expect(volumeSegments(2)).toBe(16);
    expect(volumeSegments(-1)).toBe(0);
    expect(volumeSegments(NaN)).toBe(0);
    expect(volumeSegments(0.5, 10)).toBe(5);
  });
  it("number is 0..100", () => {
    expect(volumeNumber(0.456)).toBe(46);
    expect(volumeNumber(5)).toBe(100);
    expect(volumeNumber(-1)).toBe(0);
    expect(volumeNumber(NaN)).toBe(0);
  });
});

describe("formatCounter", () => {
  it("formats H:MM:SS", () => {
    expect(formatCounter(0)).toBe("0:00:00");
    expect(formatCounter(1357.9)).toBe("0:22:37");
    expect(formatCounter(3725)).toBe("1:02:05");
  });
  it("clamps bad input", () => {
    expect(formatCounter(-5)).toBe("0:00:00");
    expect(formatCounter(NaN)).toBe("0:00:00");
    expect(formatCounter(Infinity)).toBe("0:00:00");
  });
});
