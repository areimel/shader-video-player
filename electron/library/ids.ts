import { createHash, randomBytes } from "node:crypto";
import { resolve, sep } from "node:path";

const ITEM_ID = /^[0-9a-f]{16}$/;
const FOLDER_ID = /^f-[0-9a-f]{8}$/;

/** Stable across scans and restarts, so renderer state (selection, resume points) survives a rescan. */
export function itemIdFor(realPath: string): string {
  return createHash("sha1").update(realPath).digest("hex").slice(0, 16);
}

/** Random rather than derived from the path, so removing and re-adding a folder gives it a fresh id. */
export function newFolderId(): string {
  return `f-${randomBytes(4).toString("hex")}`;
}

export function isItemId(x: unknown): x is string {
  return typeof x === "string" && ITEM_ID.test(x);
}

export function isFolderId(x: unknown): x is string {
  return typeof x === "string" && FOLDER_ID.test(x);
}

/**
 * True when `path` is `root` or lies below it. Compares whole path segments, so `/a/bc` is not inside
 * `/a/b`. Both are normalised lexically only; callers pass realpaths when symlinks matter.
 */
export function isInside(root: string, path: string): boolean {
  const r = resolve(root);
  const p = resolve(path);
  if (p === r) return true;
  return p.startsWith(r.endsWith(sep) ? r : r + sep);
}
