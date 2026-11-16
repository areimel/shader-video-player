import type { ChangelogEntry, Credits, HomeModel, HomeRow } from "./types";
import type { LibrarySnapshot, RecentFile } from "../../../shared/types";
import { countLabel, libraryRows } from "./libraryRows";
import { formatDate, wrap } from "./text";

/** Updates rows hold 16 cells (no marker column, scroll hints in the title bar). Keep in step with UPDATES_BOX in layout.ts. */
export const UPDATES_COLS = 16;
export const UPDATES_ROW_CHARS = UPDATES_COLS;
export const UPDATES_SHOWN = 3;
const CUSTOM_PRESET = "custom";

export interface HomeModelInput {
  library: LibrarySnapshot;
  recents: RecentFile[];
  effects: { id: string; label: string; presets: { id: string; label: string }[] }[];
  tv: { activeEffectId: string | null; selectedEffectId: string | null; presetId: string };
  changelog: ChangelogEntry[];
  credits: Credits;
}

/** "Consumer TV (composite)" -> "CONSUMER TV". */
export const presetLabel = (label: string): string => label.replace(/\s*\([^)]*\)\s*$/, "").toUpperCase();

function tvRows(input: HomeModelInput): HomeRow[] {
  const { effects, tv } = input;
  const rows: HomeRow[] = [{
    id: "tv:off", kind: "item", cols: ["OFF"],
    action: { type: "setTv", effectId: null, presetId: null }, current: tv.activeEffectId === null,
  }];
  for (const fx of effects) {
    const active = tv.activeEffectId === fx.id;
    rows.push({ id: `tv:h:${fx.id}`, kind: "header", cols: [fx.label] });
    for (const p of fx.presets) {
      rows.push({
        id: `tv:${fx.id}:${p.id}`, kind: "item", cols: [presetLabel(p.label)],
        action: { type: "setTv", effectId: fx.id, presetId: p.id }, current: active && tv.presetId === p.id,
      });
    }
    if (active && tv.presetId === CUSTOM_PRESET) {
      rows.push({
        id: `tv:${fx.id}:edited`, kind: "item", cols: ["EDITED"],
        action: { type: "setTv", effectId: fx.id, presetId: null }, current: true,
      });
    }
  }
  return rows;
}

/** Changelog entries, then the third-party credits: the updates zone pages through both like a guide channel. */
function updateRows(changelog: ChangelogEntry[], credits: Credits): HomeRow[] {
  const rows: HomeRow[] = [];
  for (const entry of changelog.slice(0, UPDATES_SHOWN)) {
    rows.push({ id: `up:${entry.version}`, kind: "header", cols: [`V${entry.version}`, formatDate(entry.date)] });
    entry.items.forEach((item, i) => {
      wrap(item, UPDATES_ROW_CHARS - 2).forEach((line, k) => {
        rows.push({ id: `up:${entry.version}:${i}:${k}`, kind: "text", cols: [(k === 0 ? "- " : "  ") + line] });
      });
    });
  }
  if (credits.thirdParty.length > 0) {
    rows.push({ id: "up:thanks", kind: "header", cols: ["THANKS TO"] });
    credits.thirdParty.forEach((name, i) => {
      wrap(name, UPDATES_ROW_CHARS - 2).forEach((line, k) => {
        rows.push({ id: `up:thanks:${i}:${k}`, kind: "text", cols: [(k === 0 ? "* " : "  ") + line] });
      });
    });
  }
  return rows;
}

export function buildModel(input: HomeModelInput): HomeModel {
  return {
    zones: { library: libraryRows(input.library, input.recents), tv: tvRows(input), updates: updateRows(input.changelog, input.credits) },
    credits: input.credits,
    libraryStatus: input.library.scanning ? "SCANNING"
      : input.library.folders.length === 0 ? "NO FOLDERS" : countLabel(input.library.items.length),
  };
}
