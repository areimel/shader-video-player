import { describe, expect, it } from "vitest";
import { presetLabel } from "../../renderer/utils/home/model";
import { item, model, snapshot } from "./fixtures";

describe("buildModel", () => {
  it("builds the TV zone with Off, headers and current preset", () => {
    const rows = model().zones.tv;
    expect(rows.map((r) => r.cols[0])).toEqual(["OFF", "CRT television", "CONSUMER TV", "STUDIO MONITOR", "VHS tape", "WORN RENTAL"]);
    expect(rows.filter((r) => r.current).map((r) => r.id)).toEqual(["tv:crt:consumer"]);
    expect(rows.filter((r) => !r.action).map((r) => r.kind)).toEqual(["header", "header"]);
    expect(rows[2]!.action).toEqual({ type: "setTv", effectId: "crt", presetId: "consumer" });
    expect(rows[0]!.action).toEqual({ type: "setTv", effectId: null, presetId: null });
  });

  it("marks Off current when no effect is active", () => {
    const rows = model({ tv: { activeEffectId: null, selectedEffectId: "crt", presetId: "consumer" } }).zones.tv;
    expect(rows.filter((r) => r.current).map((r) => r.id)).toEqual(["tv:off"]);
  });

  it("adds an EDITED row for custom values", () => {
    const rows = model({ tv: { activeEffectId: "vhs", selectedEffectId: "vhs", presetId: "custom" } }).zones.tv;
    const edited = rows.find((r) => r.cols[0] === "EDITED")!;
    expect(edited).toMatchObject({ current: true, action: { type: "setTv", effectId: "vhs", presetId: null } });
    expect(rows[rows.indexOf(edited) - 1]!.cols[0]).toBe("WORN RENTAL");
    expect(rows.filter((r) => r.current)).toEqual([edited]);
  });

  it("strips a trailing parenthetical from preset labels", () => {
    expect(presetLabel("Consumer TV (composite)")).toBe("CONSUMER TV");
    expect(presetLabel("Plain")).toBe("PLAIN");
  });

  it("builds updates with headers, bullets and wrapped continuation rows", () => {
    const rows = model().zones.updates;
    expect(rows[0]).toMatchObject({ kind: "header", cols: ["V0.2.0", "NOV 16"] });
    expect(rows[1]!.cols[0]).toBe("- Library");
    expect(rows.every((r) => !r.action)).toBe(true);
    expect(rows.every((r) => Array.from(r.cols[0]!).length <= 15)).toBe(true);
    expect(rows.some((r) => r.cols[0]!.startsWith("  "))).toBe(true);
  });

  it("limits updates to the newest 3 entries", () => {
    const many = [4, 3, 2, 1].map((v) => ({ version: `0.${v}.0`, date: "2026-01-01", items: ["x"] }));
    const heads = model({ changelog: many }).zones.updates.filter((r) => r.kind === "header").map((r) => r.cols[0]);
    expect(heads).toEqual(["V0.4.0", "V0.3.0", "V0.2.0"]);
  });

  it("reports library status", () => {
    expect(model().libraryStatus).toBe("2 TAPES");
    expect(model({ library: snapshot([item("a", "A")]) }).libraryStatus).toBe("1 TAPE");
    expect(model({ library: snapshot([], { scanning: true }) }).libraryStatus).toBe("SCANNING");
  });
});
