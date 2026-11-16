import type { LibraryItem, LibrarySnapshot } from "../../shared/types";
import type { ChangelogEntry, DrawOp, HomeClock, HomeFrame } from "../../renderer/utils/home/types";
import { buildModel, type HomeModelInput } from "../../renderer/utils/home/model";

export const clock: HomeClock = { timeText: "12:41AM", elapsed: 0, reducedMotion: false };

export function item(id: string, name: string, over: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id, folderId: "f-1", name, dir: "", sizeBytes: 1, modifiedMs: 1, durationSec: 4012, width: 1920, height: 1080,
    probe: "ok", thumb: null, ...over,
  } as LibraryItem;
}

export function snapshot(items: LibraryItem[], over: Partial<LibrarySnapshot> = {}): LibrarySnapshot {
  return {
    revision: 1, scanning: false,
    folders: [{ id: "f-1", name: "Movies", path: "/m", missing: false, truncated: false }],
    items, ...over,
  };
}

export const changelog: ChangelogEntry[] = [
  { version: "0.2.0", date: "2026-11-16", items: ["Library folders on the home screen", "Home screen drawn on the TV", "Per-folder rescan"] },
  { version: "0.1.0", date: "2026-11-01", items: ["First release with CRT and VHS effects"] },
];

export function input(over: Partial<HomeModelInput> = {}): HomeModelInput {
  return {
    library: snapshot([item("a", "Alien.mkv"), item("b", "Akira.mp4", { durationSec: 7452, height: 720, width: 1280 })]),
    recents: [{ path: "/m/Alien.mkv", name: "Alien.mkv", openedAt: 1 }],
    effects: [
      { id: "crt", label: "CRT television", presets: [{ id: "consumer", label: "Consumer TV (composite)" }, { id: "pvm", label: "Studio monitor" }] },
      { id: "vhs", label: "VHS tape", presets: [{ id: "rental", label: "Worn rental" }] },
    ],
    tv: { activeEffectId: "crt", selectedEffectId: "crt", presetId: "consumer" },
    changelog,
    credits: { version: "0.2.0", author: "Alec Reimel", thirdParty: ["Electron", "React", "Vite", "Archivo", "Press Start 2P"] },
    ...over,
  };
}

export const model = (over: Partial<HomeModelInput> = {}) => buildModel(input(over));

/** A model that overflows every zone. */
export function bigModel() {
  const items = Array.from({ length: 40 }, (_, i) => item(`i${i}`, `Some very long movie title number ${i} extended.mkv`, { dir: i % 2 ? "Season 1" : "" }));
  const entries: ChangelogEntry[] = [3, 2, 1, 0].map((v) => ({
    version: `0.${v}.0`, date: "2026-11-16", items: ["A fairly long changelog line that must wrap", "Short", "Another reasonably long line here"],
  }));
  return model({
    library: snapshot(items),
    changelog: entries,
    credits: { version: "0.2.0", author: "An Author With A Quite Long Name Indeed", thirdParty: Array.from({ length: 12 }, (_, i) => `Library number ${i}`) },
  });
}

/** Renders the draw list into a 40x30 text grid: accent bars as '#', bands as '=', text overlaid. */
export function ascii(frame: HomeFrame): string[] {
  const grid = Array.from({ length: 30 }, () => Array<string>(40).fill(" "));
  const fill = { bg: " ", band: "=", accent: "#" } as Record<string, string>;
  const put = (op: Extract<DrawOp, { op: "text" }>) => {
    const s = op.scale ?? 1;
    const chars = Array.from(op.text);
    const start = op.align === "right" ? op.x / 8 - chars.length * s : op.x / 8;
    chars.forEach((c, i) => { for (let k = 0; k < s; k++) { const g = grid[op.y / 8]; if (g) g[start + i * s + k] = k === 0 ? c : " "; } });
  };
  for (const op of frame.ops) {
    if (op.op === "rect") {
      const ch = fill[op.color];
      if (ch === undefined) continue;
      for (let y = op.y / 8; y < (op.y + op.h) / 8; y++) for (let x = op.x / 8; x < (op.x + op.w) / 8; x++) grid[y]![x] = ch;
    } else put(op);
  }
  return grid.map((r) => r.join(""));
}
