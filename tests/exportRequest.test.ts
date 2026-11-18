import { describe, expect, it } from "vitest";
import { buildExportRequest } from "../renderer/utils/exportRequest";

const win = { width: 1280.4, height: 800 };

describe("buildExportRequest", () => {
  it("returns null with no effect", () => {
    expect(buildExportRequest({ effect: null, values: {}, presetId: "x" }, "source", win)).toBeNull();
  });
  it("copies values and keeps a preset id", () => {
    const values = { a: 1 };
    const r = buildExportRequest({ effect: { id: "crt" }, values, presetId: "p" }, "1080p", win, 2)!;
    expect(r).toEqual({ effectId: "crt", presetId: "p", values: { a: 1 }, size: "1080p", audioOrdinal: 2 });
    expect(r.values).not.toBe(values);
  });
  it("uses a null preset when edited", () => {
    expect(buildExportRequest({ effect: { id: "vhs" }, values: {}, presetId: "custom" }, "source", win)!.presetId).toBeNull();
  });
  it("adds a rounded window size only for window", () => {
    const r = buildExportRequest({ effect: { id: "crt" }, values: {}, presetId: "p" }, "window", win)!;
    expect(r.windowSize).toEqual({ width: 1280, height: 800 });
  });
});
