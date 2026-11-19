import { describe, expect, it } from "vitest";
import { createTracker, parseLine } from "../../electron/download/ytdlpProgress";

describe("parseLine", () => {
  it("parses progress lines", () => {
    expect(parseLine("SVPDL 500 1000 12")).toEqual({ kind: "progress", fraction: 0.5, etaSec: 12 });
  });
  it("treats NA as unknown", () => {
    expect(parseLine("SVPDL 500 NA NA")).toEqual({ kind: "progress", fraction: null, etaSec: null });
    expect(parseLine("SVPDL NA NA NA")).toEqual({ kind: "progress", fraction: null, etaSec: null });
  });
  it("recognises stages and the final path", () => {
    expect(parseLine("[download] Destination: /v/a.f247.webm").kind).toBe("stage");
    expect(parseLine('[Merger] Merging formats into "/v/a.webm"')).toEqual({ kind: "stage", stage: "merging" });
    expect(parseLine("/v/Me at the zoo [x].webm")).toEqual({ kind: "path", path: "/v/Me at the zoo [x].webm" });
    expect(parseLine("[youtube] Extracting URL").kind).toBe("other");
  });
});

describe("createTracker", () => {
  it("labels video, audio, merging and keeps the bar monotonic", () => {
    const t = createTracker();
    expect(t.push("[download] Destination: /v/a.f247.webm")?.label).toBe("video");
    const mid = t.push("SVPDL 50 100 3");
    expect(mid?.label).toBe("video");
    expect(mid?.fraction).toBeCloseTo(0.45);
    const a = t.push("[download] Destination: /v/a.f251.webm");
    expect(a).toMatchObject({ label: "audio", fraction: 0.9 });
    expect(t.push("SVPDL 100 100 0")?.fraction).toBeCloseTo(0.99);
    expect(t.push('[Merger] Merging formats into "/v/a.webm"')?.label).toBe("merging");
    t.push("/v/a.webm");
    expect(t.path).toBe("/v/a.webm");
  });
  it("keeps the last fraction when progress is unknown", () => {
    const t = createTracker();
    t.push("[download] Destination: /v/a.mp4");
    t.push("SVPDL 10 100 NA");
    expect(t.push("SVPDL 20 NA NA")?.fraction).toBeCloseTo(0.09);
  });
});
