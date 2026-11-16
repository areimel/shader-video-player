import { app } from "electron";
import { randomBytes } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Store names are fixed strings in this codebase; the pattern keeps a typo from escaping userData. */
const NAME = /^[a-z0-9-]+\.json$/;

function storePath(name: string): string {
  if (!NAME.test(name)) throw new Error(`Bad store name: ${name}`);
  return join(app.getPath("userData"), name);
}

/**
 * Reads `userData/<name>` and passes the parsed value (or undefined when the file is missing or not
 * JSON) through `heal`, so callers always get a well-formed value even from a hand-edited or stale file.
 */
export function readJson<T>(name: string, heal: (raw: unknown) => T): T {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(storePath(name), "utf8"));
  } catch {
    raw = undefined;
  }
  return heal(raw);
}

/**
 * Writes atomically (temp file + rename) so a crash mid-write never leaves a truncated file behind.
 * Persistence is non-fatal everywhere it is used: returns false instead of throwing.
 */
export function writeJson(name: string, value: unknown): boolean {
  const target = storePath(name);
  const tmp = `${target}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(value));
    renameSync(tmp, target);
    return true;
  } catch {
    try { rmSync(tmp, { force: true }); } catch { /* leave the temp file; never let cleanup throw */ }
    return false;
  }
}
