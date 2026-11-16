import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nodeWalkFs, walkFolder, type WalkFs } from "../../electron/library/walker";

let base: string;
let root: string;
const always = () => true;

function file(rel: string, bytes = 1): void {
  const p = join(root, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, Buffer.alloc(bytes));
}

async function walk(r = root, limits?: { maxDepth: number; maxItems: number }) {
  const res = await walkFolder(r, nodeWalkFs, always, limits);
  if (res.status !== "ok") throw new Error(`walk ${res.status}`);
  return res;
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "svp-walk-"));
  root = join(base, "lib");
  mkdirSync(root);
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("walkFolder", () => {
  it("finds supported videos recursively with relative dirs, sizes and natural order", async () => {
    file("b.mkv", 3);
    file("a.mp4");
    file("notes.txt");
    file("cover.jpg");
    file("Show/ep10.mp4");
    file("Show/ep2.mp4");
    file("Show/S1/x.webm");
    const res = await walk();
    expect(res.entries.map((e) => `${e.dir}|${e.name}`)).toEqual([
      "|a.mp4", "|b.mkv", "Show|ep2.mp4", "Show|ep10.mp4", "Show/S1|x.webm",
    ]);
    expect(res.entries[1].size).toBe(3);
    expect(res.truncated).toBe(false);
  });

  it("skips dot files and dot directories", async () => {
    file(".hidden.mp4");
    file(".cache/a.mp4");
    file("ok.mp4");
    expect((await walk()).entries.map((e) => e.name)).toEqual(["ok.mp4"]);
  });

  it("never descends a symlinked directory", async () => {
    file("real/a.mp4");
    symlinkSync(join(root, "real"), join(root, "link"));
    symlinkSync(root, join(root, "loop"));
    expect((await walk()).entries.map((e) => `${e.dir}/${e.name}`)).toEqual(["real/a.mp4"]);
  });

  it("keeps a symlinked file only when it resolves inside the root, and once", async () => {
    mkdirSync(join(base, "outside"));
    writeFileSync(join(base, "outside", "x.mp4"), "x");
    symlinkSync(join(base, "outside", "x.mp4"), join(root, "escape.mp4"));
    file("sub/target.mp4");
    symlinkSync(join(root, "sub", "target.mp4"), join(root, "alias.mp4"));
    symlinkSync(join(root, "sub", "target.mp4"), join(root, "alias-noext"));
    const res = await walk();
    // alias.mp4 is visited first (root before sub) and claims the target; target.mp4 is then a duplicate.
    expect(res.entries.map((e) => e.name)).toEqual(["alias.mp4"]);
    expect(res.entries[0].real).toBe(join(res.root, "sub", "target.mp4"));
  });

  it("walks a root that is itself a symlink, from its realpath", async () => {
    file("a.mp4");
    symlinkSync(root, join(base, "rootlink"));
    const res = await walk(join(base, "rootlink"));
    expect(res.root).toBe(join(base, "lib"));
    expect(res.entries[0].path).toBe(join(base, "lib", "a.mp4"));
  });

  it("caps depth and reports truncated", async () => {
    file("1/2/3/deep.mp4");
    file("1/shallow.mp4");
    const res = await walk(root, { maxDepth: 2, maxItems: 100 });
    expect(res.entries.map((e) => e.name)).toEqual(["shallow.mp4"]);
    expect(res.truncated).toBe(true);
    expect((await walk(root, { maxDepth: 3, maxItems: 100 })).truncated).toBe(false);
  });

  it("caps items and reports truncated", async () => {
    for (let i = 0; i < 5; i++) file(`v${i}.mp4`);
    const res = await walk(root, { maxDepth: 8, maxItems: 3 });
    expect(res.entries.map((e) => e.name)).toEqual(["v0.mp4", "v1.mp4", "v2.mp4"]);
    expect(res.truncated).toBe(true);
    expect((await walk(root, { maxDepth: 8, maxItems: 5 })).truncated).toBe(false);
  });

  it("reports a missing root", async () => {
    expect(await walkFolder(join(base, "nope"), nodeWalkFs, always)).toEqual({ status: "missing" });
  });

  it("stops as soon as it is superseded", async () => {
    file("a/x.mp4");
    file("b/y.mp4");
    let calls = 0;
    const counting: WalkFs = { ...nodeWalkFs, readdir: (d) => { calls++; return nodeWalkFs.readdir(d); } };
    let current = true;
    const res = walkFolder(root, counting, () => current);
    current = false;
    expect(await res).toEqual({ status: "superseded" });
    expect(calls).toBeLessThanOrEqual(1);
  });

  it("does not descend a directory swapped for a symlink after it was listed", async () => {
    const dirent = (name: string, kind: "f" | "d") => ({
      name, isFile: () => kind === "f", isDirectory: () => kind === "d", isSymbolicLink: () => false,
    });
    const listings: Record<string, ReturnType<typeof dirent>[]> = {
      "/r": [dirent("out", "d"), dirent("in", "d"), dirent("ok", "d")],
      "/r/ok": [dirent("a.mp4", "f")],
      "/etc": [dirent("secret.mp4", "f")],
      "/r/ok2": [dirent("b.mp4", "f")],
    };
    // By descent time "out" points outside the root and "in" at another directory inside it.
    const links: Record<string, string> = { "/r/out": "/etc", "/r/in": "/r/ok2" };
    const read: string[] = [];
    const fake: WalkFs = {
      realpath: async (p) => links[p] ?? p,
      readdir: async (d) => { read.push(d); return listings[links[d] ?? d] ?? []; },
      stat: async () => ({ isFile: () => true, size: 1, mtimeMs: 1 }),
    };
    const res = await walkFolder("/r", fake, always);
    if (res.status !== "ok") throw new Error(res.status);
    expect(res.entries.map((e) => e.path)).toEqual(["/r/ok/a.mp4"]);
    expect(read).toEqual(["/r", "/r/ok"]);
  });

  it("works on an injected fake filesystem", async () => {
    const dirent = (name: string, kind: "f" | "d") => ({
      name, isFile: () => kind === "f", isDirectory: () => kind === "d", isSymbolicLink: () => false,
    });
    const fake: WalkFs = {
      realpath: async (p) => p,
      readdir: async (d) => (d === "/r" ? [dirent("a.mov", "f"), dirent("s", "d")] : [dirent("b.ts", "f")]),
      stat: async () => ({ isFile: () => true, size: 7, mtimeMs: 42 }),
    };
    const res = await walkFolder("/r", fake, always);
    expect(res).toMatchObject({ status: "ok", truncated: false });
    if (res.status === "ok") expect(res.entries.map((e) => e.path)).toEqual(["/r/a.mov", "/r/s/b.ts"]);
  });
});
