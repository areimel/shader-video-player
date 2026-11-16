import type { LibraryItem, LibraryMetaPatch, LibrarySnapshot, RecentFile } from "../../../shared/types";
import type { HomeRow } from "./types";
import { formatDuration, formatResolution } from "./text";

export const MAX_RECENTS = 5;

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function applyMetaPatches(snapshot: LibrarySnapshot, patches: LibraryMetaPatch[]): LibrarySnapshot {
  if (patches.length === 0) return snapshot;
  const byId = new Map(patches.map((p) => [p.id, p]));
  let changed = false;
  const items = snapshot.items.map((it) => {
    const p = byId.get(it.id);
    if (!p) return it;
    changed = true;
    return { ...it, durationSec: p.durationSec, width: p.width, height: p.height, probe: p.probe };
  });
  return changed ? { ...snapshot, items } : snapshot;
}

const byDirThenName = (a: LibraryItem, b: LibraryItem) =>
  collator.compare(a.dir, b.dir) || collator.compare(a.name, b.name);

export const countLabel = (n: number) => `${n} ${n === 1 ? "TAPE" : "TAPES"}`;

function folderRows(snapshot: LibrarySnapshot): HomeRow[] {
  const rows: HomeRow[] = [];
  for (const folder of snapshot.folders) {
    const items = snapshot.items.filter((i) => i.folderId === folder.id).sort(byDirThenName);
    rows.push({
      id: `folder:${folder.id}`,
      kind: "header",
      cols: [folder.name, folder.missing ? "MISSING" : countLabel(items.length)],
      action: { type: "removeFolder", folderId: folder.id },
      alert: folder.missing || undefined,
    });
    let dir = "";
    for (const it of items) {
      if (it.dir !== dir) {
        dir = it.dir;
        if (dir !== "") rows.push({ id: `dir:${folder.id}:${dir}`, kind: "text", cols: [dir] });
      }
      rows.push({
        id: `item:${it.id}`,
        kind: "item",
        cols: [it.name, formatDuration(it.durationSec), formatResolution(it.width, it.height)],
        action: { type: "openItem", itemId: it.id },
      });
    }
  }
  return rows;
}

export function libraryRows(snapshot: LibrarySnapshot, recents: RecentFile[]): HomeRow[] {
  const rows: HomeRow[] = [];
  const shown = recents.slice(0, MAX_RECENTS);
  if (shown.length > 0) {
    rows.push({ id: "recent-header", kind: "header", cols: ["RECENTLY PLAYED"] });
    for (const r of shown) {
      rows.push({ id: `recent:${r.path}`, kind: "item", cols: [r.name], action: { type: "openRecent", path: r.path } });
    }
  }
  if (snapshot.folders.length === 0 && shown.length === 0) {
    rows.push({ id: "empty", kind: "text", cols: ["ADD A FOLDER TO LIST YOUR VIDEOS"] });
  }
  rows.push(...folderRows(snapshot));
  rows.push(
    { id: "act:add", kind: "action", cols: ["+ ADD FOLDER"], action: { type: "addFolder" } },
    { id: "act:rescan", kind: "action", cols: ["RESCAN"], action: { type: "rescan" } },
    { id: "act:open", kind: "action", cols: ["OPEN FILE"], action: { type: "openDialog" } },
  );
  return rows;
}
