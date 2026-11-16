import { describe, expect, it } from "vitest";
import { applyMetaPatches, libraryRows } from "../../renderer/utils/home/libraryRows";
import { item, snapshot } from "./fixtures";

const recent = (n: number) => ({ path: `/r/${n}.mkv`, name: `r${n}.mkv`, openedAt: n });

describe("libraryRows", () => {
  it("lists recents (max 5), folders, items and the three actions", () => {
    const rows = libraryRows(snapshot([item("a", "B.mkv"), item("b", "A.mkv")]), [1, 2, 3, 4, 5, 6, 7].map(recent));
    expect(rows[0]).toMatchObject({ kind: "header", cols: ["RECENTLY PLAYED"] });
    expect(rows[0]!.action).toBeUndefined();
    expect(rows.filter((r) => r.action?.type === "openRecent")).toHaveLength(5);
    const folder = rows.find((r) => r.id === "folder:f-1")!;
    expect(folder).toMatchObject({ kind: "header", cols: ["Movies", "2 TAPES"], action: { type: "removeFolder", folderId: "f-1" } });
    expect(rows.filter((r) => r.kind === "item" && r.action?.type === "openItem").map((r) => r.cols[0])).toEqual(["A.mkv", "B.mkv"]);
    expect(rows.slice(-3).map((r) => r.action?.type)).toEqual(["addFolder", "rescan", "openDialog"]);
  });

  it("sorts by directory then natural name and shows sub-directory rows", () => {
    const rows = libraryRows(
      snapshot([item("1", "e10.mkv", { dir: "S1" }), item("2", "e2.mkv", { dir: "S1" }), item("3", "z.mkv"), item("4", "a.mkv", { dir: "S0" })]),
      [],
    );
    const seq = rows.filter((r) => r.id.startsWith("item:") || r.id.startsWith("dir:")).map((r) => r.cols[0]);
    expect(seq).toEqual(["z.mkv", "S0", "a.mkv", "S1", "e2.mkv", "e10.mkv"]);
    expect(rows.find((r) => r.id.startsWith("dir:"))!.action).toBeUndefined();
  });

  it("marks a missing folder and gives item columns", () => {
    const snap = snapshot([item("a", "A.mkv", { durationSec: null, width: null, height: null })]);
    snap.folders[0]!.missing = true;
    const rows = libraryRows(snap, []);
    expect(rows[0]).toMatchObject({ alert: true, cols: ["Movies", "MISSING"] });
    expect(rows[1]!.cols).toEqual(["A.mkv", "--:--", ""]);
  });

  it("invites adding a folder when empty", () => {
    const rows = libraryRows(snapshot([], { folders: [] }), []);
    expect(rows.map((r) => r.kind)).toEqual(["text", "action", "action", "action"]);
  });
});

describe("applyMetaPatches", () => {
  it("patches matching items and keeps identity when nothing matches", () => {
    const snap = snapshot([item("a", "A", { probe: "pending", durationSec: null })]);
    const next = applyMetaPatches(snap, [{ id: "a", durationSec: 60, width: 640, height: 480, probe: "ok" }]);
    expect(next.items[0]).toMatchObject({ durationSec: 60, probe: "ok", height: 480 });
    expect(snap.items[0]!.probe).toBe("pending");
    expect(applyMetaPatches(snap, [{ id: "zz", durationSec: 1, width: 1, height: 1, probe: "ok" }])).toBe(snap);
    expect(applyMetaPatches(snap, [])).toBe(snap);
  });
});
