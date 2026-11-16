import { readdir, realpath, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { isSupportedExtension } from "../media/formats";
import { isInside } from "./ids";

/** The slice of `node:fs/promises` the walker needs, injected so tests can run on a fake tree. */
export interface WalkFs {
  readdir(dir: string): Promise<WalkDirent[]>;
  stat(path: string): Promise<{ isFile(): boolean; size: number; mtimeMs: number }>;
  realpath(path: string): Promise<string>;
}

export interface WalkDirent {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

/** The real filesystem. */
export const nodeWalkFs: WalkFs = {
  readdir: (dir) => readdir(dir, { withFileTypes: true }),
  stat: (path) => stat(path),
  realpath: (path) => realpath(path),
};

export interface WalkEntry {
  /** Absolute path below the root's realpath (a symlinked file keeps its link path here). */
  path: string;
  /** Resolved path: what the item id is derived from and what gets opened. */
  real: string;
  name: string;
  /** Directory relative to the root, "" at the root, always "/"-separated. */
  dir: string;
  size: number;
  mtimeMs: number;
}

export type WalkResult =
  | { status: "ok"; root: string; entries: WalkEntry[]; truncated: boolean }
  | { status: "missing" }
  | { status: "superseded" };

export interface WalkLimits {
  maxDepth: number;
  maxItems: number;
}

export const DEFAULT_LIMITS: WalkLimits = { maxDepth: 8, maxItems: 5000 };

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * Recursively lists the videos under `root`. Never descends a symlinked directory (no loops, no escaping
 * the root); a symlinked file is kept only when its target resolves inside the root. Dot entries are
 * skipped. `stillCurrent` is checked after every await: once it returns false the walk stops and reports
 * "superseded" so a stale scan never reaches the index. An unreadable root reports "missing"; an
 * unreadable subdirectory is skipped.
 */
export async function walkFolder(
  root: string, fs: WalkFs, stillCurrent: () => boolean, limits: WalkLimits = DEFAULT_LIMITS,
): Promise<WalkResult> {
  let rootReal: string;
  let top: WalkDirent[];
  try {
    rootReal = await fs.realpath(root);
    if (!stillCurrent()) return { status: "superseded" };
    top = await fs.readdir(rootReal);
  } catch {
    return stillCurrent() ? { status: "missing" } : { status: "superseded" };
  }
  if (!stillCurrent()) return { status: "superseded" };

  const entries: WalkEntry[] = [];
  const seen = new Set<string>();
  let truncated = false;
  // Depth-first with an explicit stack; directories are visited in name order for a stable result.
  const stack: Array<{ dir: string; depth: number; listing: WalkDirent[] | null }> = [{ dir: rootReal, depth: 0, listing: top }];
  while (stack.length) {
    const { dir, depth, listing } = stack.pop()!;
    let list = listing;
    if (!list) {
      // The listing said "directory, not a link", but it may have been swapped for a symlink since:
      // resolve it at descent time and skip it unless it is still exactly the path we built (no link
      // anywhere in it), which also keeps it inside the root.
      try {
        const real = await fs.realpath(dir);
        list = real === dir && isInside(rootReal, real) ? await fs.readdir(dir) : [];
      } catch {
        list = [];
      }
      if (!stillCurrent()) return { status: "superseded" };
    }
    const visible = list.filter((d) => !d.name.startsWith(".")).sort((a, b) => byName.compare(a.name, b.name));
    const subdirs: string[] = [];
    for (const d of visible) {
      if (d.isDirectory() && !d.isSymbolicLink()) subdirs.push(join(dir, d.name));
    }
    const files = visible.filter((d) => (d.isFile() || d.isSymbolicLink()) && isSupportedExtension(d.name));
    const found = await Promise.all(files.map((d) => fileEntry(fs, rootReal, dir, d)));
    if (!stillCurrent()) return { status: "superseded" };
    for (const e of found) {
      if (!e || seen.has(e.real)) continue;
      if (entries.length >= limits.maxItems) {
        truncated = true;
        break;
      }
      seen.add(e.real);
      entries.push(e);
    }
    if (truncated) break;
    if (subdirs.length && depth >= limits.maxDepth) {
      truncated = true;
      continue;
    }
    // Reverse so the first subdirectory by name is popped first.
    for (let i = subdirs.length - 1; i >= 0; i--) stack.push({ dir: subdirs[i], depth: depth + 1, listing: null });
  }
  return { status: "ok", root: rootReal, entries, truncated };
}

async function fileEntry(fs: WalkFs, rootReal: string, dir: string, d: WalkDirent): Promise<WalkEntry | null> {
  const path = join(dir, d.name);
  try {
    let real = path;
    if (d.isSymbolicLink()) {
      real = await fs.realpath(path);
      // A link may point anywhere; only targets inside this library folder (and still videos) count.
      if (!isInside(rootReal, real) || !isSupportedExtension(real)) return null;
    }
    const st = await fs.stat(real);
    if (!st.isFile()) return null;
    const rel = relative(rootReal, dir);
    return { path, real, name: d.name, dir: rel.split(sep).join("/"), size: st.size, mtimeMs: st.mtimeMs };
  } catch {
    return null; // vanished or unreadable since the listing
  }
}
