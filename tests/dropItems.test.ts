import { describe, expect, it } from "vitest";
import { partitionDrop, type DropItemLike } from "../renderer/utils/dropItems";

const fake = (name: string, dir: boolean, kind = "file"): DropItemLike => ({
  kind, getAsFile: () => ({ name } as File), webkitGetAsEntry: () => ({ isDirectory: dir }),
});

describe("partitionDrop", () => {
  it("splits folders from files and skips non-file items", () => {
    const r = partitionDrop([fake("Movies", true), fake("a.mkv", false), fake("text", false, "string")]);
    expect(r.folders.map((f) => f.name)).toEqual(["Movies"]);
    expect(r.files.map((f) => f.name)).toEqual(["a.mkv"]);
  });
});
