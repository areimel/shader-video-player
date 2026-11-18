import { describe, expect, it } from "vitest";
import { outputSizeFor, validateExportRequest } from "../../electron/export/exportRequest";
import { validAudioOrdinal } from "../../electron/media/audioOrdinal";

const base = { effectId: "crt", presetId: "p", values: { a: 1 }, size: "source", audioOrdinal: 0 };

describe("validateExportRequest", () => {
  it("accepts a good request and drops unknown fields", () => {
    expect(validateExportRequest({ ...base, extra: "x" })).toEqual(base);
  });
  it("keeps a window size only for size window", () => {
    const r = validateExportRequest({ ...base, size: "window", windowSize: { width: 1280, height: 800 } });
    expect(r.windowSize).toEqual({ width: 1280, height: 800 });
    expect(validateExportRequest({ ...base, windowSize: { width: 1, height: 1 } }).windowSize).toBeUndefined();
  });
  it.each([
    [null], ["x"], [[]],
    [{ ...base, effectId: "" }], [{ ...base, effectId: "a".repeat(65) }], [{ ...base, effectId: 3 }],
    [{ ...base, presetId: 4 }], [{ ...base, values: [] }], [{ ...base, values: { a: NaN } }], [{ ...base, values: { a: "1" } }],
    [{ ...base, size: "4k" }], [{ ...base, size: "window" }], [{ ...base, size: "window", windowSize: { width: 0, height: 5 } }],
    [{ ...base, audioOrdinal: -1 }], [{ ...base, audioOrdinal: 1.5 }], [{ ...base, audioOrdinal: "0" }],
    [{ ...base, audioOrdinal: undefined }], [{ ...base, audioOrdinal: 5000 }],
  ])("rejects %j", (req) => {
    expect(() => validateExportRequest(req)).toThrow();
  });
  it("rejects too many or oversized settings", () => {
    const many = Object.fromEntries(Array.from({ length: 513 }, (_, i) => [`k${i}`, 1]));
    expect(() => validateExportRequest({ ...base, values: many })).toThrow(/settings/);
    expect(() => validateExportRequest({ ...base, values: { ["k".repeat(65)]: 1 } })).toThrow(/settings/);
  });
});

describe("outputSizeFor", () => {
  it("uses 1080p height and an even-clamped window size", () => {
    const r = validateExportRequest({ ...base, size: "1080p" });
    expect(outputSizeFor(r, { width: 640, height: 360 }).height).toBe(1080);
    const w = validateExportRequest({ ...base, size: "window", windowSize: { width: 1281, height: 801 } });
    expect(outputSizeFor(w, { width: 640, height: 360 })).toEqual({ width: 1282, height: 802 });
  });
});

describe("validAudioOrdinal", () => {
  const tracks = [{ ordinal: 0 }, { ordinal: 1 }];
  it("accepts only existing tracks", () => {
    expect(validAudioOrdinal(1, tracks)).toBe(true);
    expect(validAudioOrdinal(2, tracks)).toBe(false);
    expect(validAudioOrdinal(-1, tracks)).toBe(false);
    expect(validAudioOrdinal("0", tracks)).toBe(false);
  });
  it("accepts 0 for a file without audio", () => {
    expect(validAudioOrdinal(0, [])).toBe(true);
    expect(validAudioOrdinal(1, [])).toBe(false);
  });
});
