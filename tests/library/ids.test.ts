import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isFolderId, isInside, isItemId, itemIdFor, newFolderId } from "../../electron/library/ids";

describe("library ids", () => {
  it("item id is the first 16 hex of sha1(realpath) and stable", () => {
    const id = itemIdFor("/v/a.mp4");
    expect(id).toBe(createHash("sha1").update("/v/a.mp4").digest("hex").slice(0, 16));
    expect(itemIdFor("/v/a.mp4")).toBe(id);
    expect(itemIdFor("/v/b.mp4")).not.toBe(id);
    expect(isItemId(id)).toBe(true);
  });
  it("folder ids are random f- + 8 hex", () => {
    const a = newFolderId();
    expect(a).toMatch(/^f-[0-9a-f]{8}$/);
    expect(isFolderId(a)).toBe(true);
    expect(newFolderId()).not.toBe(a);
  });
  it("validators reject anything else", () => {
    for (const bad of [undefined, null, 3, "", "F-0000000a", "f-0000000", "f-0000000g", "f-0000000a ", "../x"]) {
      expect(isFolderId(bad)).toBe(false);
    }
    for (const bad of [undefined, 7, "0123456789abcde", "0123456789abcdef0", "0123456789ABCDEF", "0123456789abcdeg"]) {
      expect(isItemId(bad)).toBe(false);
    }
    expect(isItemId("0123456789abcdef")).toBe(true);
  });
});

describe("isInside", () => {
  it("accepts the root itself and paths below it", () => {
    expect(isInside("/a/b", "/a/b")).toBe(true);
    expect(isInside("/a/b", "/a/b/")).toBe(true);
    expect(isInside("/a/b/", "/a/b")).toBe(true);
    expect(isInside("/a/b", "/a/b/c/d.mp4")).toBe(true);
  });
  it("rejects sibling prefixes, parents and traversal", () => {
    expect(isInside("/a/b", "/a/bc")).toBe(false);
    expect(isInside("/a/b", "/a/bc/d.mp4")).toBe(false);
    expect(isInside("/a/b", "/a")).toBe(false);
    expect(isInside("/a/b", "/a/b/../c")).toBe(false);
  });
  it("handles the filesystem root", () => {
    expect(isInside("/", "/x/y")).toBe(true);
  });
});
