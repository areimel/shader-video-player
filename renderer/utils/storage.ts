import type { MediaInfo } from "../types/player";
import { LOOP_MODES, type LoopMode } from "./queue";
import { SUB_SIZES, type SubSize } from "./subtitleTiming";

const KEY = "svp.positions";
const MAX_ENTRIES = 200;

type Positions = Record<string, { t: number; at: number }>;

const keyOf = (i: MediaInfo) => `${i.path}|${i.sizeBytes}`;

function read(): Positions {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Positions; } catch { return {}; }
}

export function loadPosition(info: MediaInfo): number {
  const t = read()[keyOf(info)]?.t ?? 0;
  return t > 5 && t < info.durationSec - 10 ? t : 0;
}

export function savePosition(info: MediaInfo, t: number): void {
  const all = read();
  if (t < 5 || t > info.durationSec - 10) delete all[keyOf(info)];
  else all[keyOf(info)] = { t, at: Date.now() };
  const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at).slice(0, MAX_ENTRIES);
  const trimmed: Positions = {};
  keys.forEach((k) => (trimmed[k] = all[k]));
  try { localStorage.setItem(KEY, JSON.stringify(trimmed)); } catch { /* quota */ }
}

const LOOP_KEY = "svp.loop";

export function loadLoop(): LoopMode {
  try {
    const v = localStorage.getItem(LOOP_KEY);
    return LOOP_MODES.find((m) => m === v) ?? "off";
  } catch { return "off"; }
}

export function saveLoop(mode: LoopMode): void {
  try { localStorage.setItem(LOOP_KEY, mode); } catch { /* unavailable */ }
}

const REMAINING_KEY = "svp.showRemaining";

export function loadShowRemaining(): boolean {
  try { return localStorage.getItem(REMAINING_KEY) === "1"; } catch { return false; }
}

export function saveShowRemaining(on: boolean): void {
  try { localStorage.setItem(REMAINING_KEY, on ? "1" : "0"); } catch { /* unavailable */ }
}

const SUB_SIZE_KEY = "svp.subSize";

export function loadSubSize(): SubSize {
  try {
    const v = localStorage.getItem(SUB_SIZE_KEY);
    return SUB_SIZES.find((s) => s.id === v)?.id ?? "m";
  } catch { return "m"; }
}

export function saveSubSize(size: SubSize): void {
  try { localStorage.setItem(SUB_SIZE_KEY, size); } catch { /* unavailable */ }
}
