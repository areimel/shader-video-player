import { describe, expect, it } from "vitest";
import { MAX_FOLDERS, folderFile, healFolders, healMetaCache, metaFile } from "../../electron/library/shape";

describe("healFolders", () => {
  it("round-trips a valid file", () => {
    const folders = [{ id: "f-0000000a", path: "/v" }, { id: "f-0000000b", path: "/w x" }];
    expect(healFolders(JSON.parse(JSON.stringify(folderFile(folders))))).toEqual(folders);
  });
  it("heals garbage to an empty list", () => {
    for (const raw of [undefined, null, 3, "x", [], {}, { version: 2, folders: [] }, { version: 1, folders: {} }]) {
      expect(healFolders(raw)).toEqual([]);
    }
  });
  it("drops bad ids, relative paths and duplicates", () => {
    const raw = {
      version: 1,
      folders: [
        { id: "f-0000000a", path: "/v" },
        { id: "bad", path: "/w" },
        { id: "f-0000000b", path: "rel/path" },
        { id: "f-0000000a", path: "/other" },
        { id: "f-0000000c", path: "/v" },
        { id: "f-0000000d", path: 5 },
        null,
        { id: "f-0000000e", path: "/ok", extra: true },
      ],
    };
    expect(healFolders(raw)).toEqual([{ id: "f-0000000a", path: "/v" }, { id: "f-0000000e", path: "/ok" }]);
  });
  it("caps the folder count", () => {
    const folders = Array.from({ length: 40 }, (_, i) => ({ id: `f-${i.toString(16).padStart(8, "0")}`, path: `/v${i}` }));
    expect(healFolders({ version: 1, folders })).toHaveLength(MAX_FOLDERS);
  });
});

describe("healMetaCache", () => {
  const ok = { path: "/v/a.mp4", size: 10, mtimeMs: 5, ok: true, durationSec: 12.5, width: 1920, height: 1080 };
  it("round-trips valid entries", () => {
    const failed = { path: "/v/b.mp4", size: 1, mtimeMs: 1, ok: false, durationSec: null, width: null, height: null };
    expect(healMetaCache(metaFile([ok, failed]))).toEqual([ok, failed]);
  });
  it("keeps nulls on ok entries and clears values on failed ones", () => {
    const live = { ...ok, durationSec: null };
    expect(healMetaCache({ version: 1, entries: [live] })).toEqual([live]);
    expect(healMetaCache({ version: 1, entries: [{ ...ok, ok: false }] })[0]).toMatchObject({ ok: false, width: null });
  });
  it("drops malformed entries", () => {
    const bad = [
      { ...ok, path: "rel" }, { ...ok, size: -1 }, { ...ok, mtimeMs: "1" }, { ...ok, ok: 1 },
      { ...ok, width: 0 }, { ...ok, durationSec: Number.NaN }, { ...ok, height: "1080" }, 7,
    ];
    expect(healMetaCache({ version: 1, entries: bad })).toEqual([]);
    expect(healMetaCache({ version: 1, entries: [ok, { ...ok, size: 99 }] })).toEqual([ok]);
    expect(healMetaCache("nope")).toEqual([]);
  });
});
