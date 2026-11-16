import { existsSync } from "node:fs";
import { basename } from "node:path";
import type { RecentFile } from "../shared/types";
import { readJson, writeJson } from "./jsonStore";
import { MAX_RECENTS, healRecents } from "./recentsShape";

const FILE = "recents.json";

const listeners: Array<() => void> = [];
export function onRecentsChanged(cb: () => void): void { listeners.push(cb); }

export function getRecents(): RecentFile[] {
  return readJson(FILE, healRecents).filter((r) => existsSync(r.path));
}

export function addRecent(path: string): void {
  const rest = getRecents().filter((r) => r.path !== path);
  const next = [{ path, name: basename(path), openedAt: Date.now() }, ...rest].slice(0, MAX_RECENTS);
  writeJson(FILE, next);
  for (const l of listeners) l();
}

export function isRecent(path: string): boolean {
  return getRecents().some((r) => r.path === path);
}
