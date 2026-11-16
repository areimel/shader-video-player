import { describe, expect, it } from "vitest";
import { folderConflict } from "../../electron/library/folders";
import { itemIdFor } from "../../electron/library/ids";
import { applyMeta, buildItems, publicItem } from "../../electron/library/state";

const entry = (name: string, dir = "") => ({
  path: `/lib/${dir ? `${dir}/` : ""}${name}`, real: `/lib/${dir ? `${dir}/` : ""}${name}`, name, dir, size: 10, mtimeMs: 5,
});

describe("library items", () => {
  it("builds pending items, or fills them from the cache", () => {
    const [a, b] = buildItems("f-0000000a", [entry("a.mp4"), entry("b.mp4", "s")],
      (j) => (j.path === "/lib/a.mp4" ? { ok: true, durationSec: 3, width: 4, height: 5 } : null));
    expect(a).toMatchObject({ id: itemIdFor("/lib/a.mp4"), folderId: "f-0000000a", probe: "ok", durationSec: 3, width: 4 });
    expect(b).toMatchObject({ dir: "s", probe: "pending", durationSec: null });
  });

  it("never exposes paths to the renderer", () => {
    const [a] = buildItems("f-0000000a", [entry("a.mp4")], () => null);
    expect(JSON.stringify(publicItem(a))).not.toContain("/lib");
  });

  it("applies probe results only to the same file version", () => {
    const items = buildItems("f-0000000a", [entry("a.mp4"), entry("b.mp4")], () => null);
    const byId = new Map(items.map((i) => [i.id, i]));
    const job = (i: number, size = 10) => ({ id: items[i].id, path: items[i].real, size, mtimeMs: 5 });
    const patches = applyMeta(byId, [
      { job: job(0), meta: { ok: true, durationSec: 9, width: 640, height: 480 } },
      { job: job(1, 99), meta: { ok: false } },
      { job: { ...job(1), id: "0000000000000000" }, meta: { ok: false } },
    ]);
    expect(patches).toEqual([{ id: items[0].id, durationSec: 9, width: 640, height: 480, probe: "ok" }]);
    expect(items[1].probe).toBe("pending");
  });
});

describe("folderConflict", () => {
  const existing = [{ real: "/media/videos", name: "videos" }];
  it("rejects duplicates, nested and containing folders, and the filesystem root", () => {
    expect(folderConflict(existing, "/media/videos")).toMatch(/already in the library/);
    expect(folderConflict(existing, "/media/videos/shows")).toMatch(/inside "videos"/);
    expect(folderConflict(existing, "/media")).toMatch(/contains "videos"/);
    expect(folderConflict(existing, "/")).toMatch(/root/);
  });
  it("accepts siblings that only share a prefix", () => {
    expect(folderConflict(existing, "/media/videos2")).toBeNull();
    expect(folderConflict([], "/home/me/Videos")).toBeNull();
  });
});
