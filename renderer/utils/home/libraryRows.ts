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

/** Per folder, indices into `snapshot.items` in display order (directory, then natural name). */
export type LibraryOrder = Map<string, number[]>;

/**
 * The sort, separate from the rows: metadata patches keep `items` in place and never change names, so the
 * caller can reuse one order across patches (keyed on the revision and folder list) and skip re-sorting.
 */
export function libraryOrder(snapshot: LibrarySnapshot): LibraryOrder {
  const order: LibraryOrder = new Map(snapshot.folders.map((f) => [f.id, []]));
  snapshot.items.forEach((it, i) => order.get(it.folderId)?.push(i));
  for (const list of order.values()) list.sort((a, b) => byDirThenName(snapshot.items[a]!, snapshot.items[b]!));
  return order;
}

function folderRows(snapshot: LibrarySnapshot, order: LibraryOrder): HomeRow[] {
  const rows: HomeRow[] = [];
  for (const folder of snapshot.folders) {
    const items = (order.get(folder.id) ?? []).map((i) => snapshot.items[i]).filter((it): it is LibraryItem => it?.folderId === folder.id);
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
        if (dir !== "") rows.push({ id: `dir:${folder.id}:${dir}`, kind: "subheader", cols: [`${dir}/`] });
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

export function libraryRows(snapshot: LibrarySnapshot, recents: RecentFile[], order: LibraryOrder = libraryOrder(snapshot)): HomeRow[] {
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
  rows.push(...folderRows(snapshot, order));
  rows.push(
    { id: "act:add", kind: "action", cols: ["+ ADD FOLDER"], action: { type: "addFolder" } },
    { id: "act:rescan", kind: "action", cols: ["RESCAN"], action: { type: "rescan" } },
    { id: "act:open", kind: "action", cols: ["OPEN FILE"], action: { type: "openDialog" } },
  );
  return rows;
}

/** No folders and no items: the library before one is loaded (or before the library service is wired). */
export const EMPTY_LIBRARY: LibrarySnapshot = { revision: 0, scanning: false, folders: [], items: [] };

/** Newer-or-equal revision wins; an older snapshot (a late reply racing a push) is ignored. */
export const newerSnapshot = (held: LibrarySnapshot, next: LibrarySnapshot): LibrarySnapshot =>
  next.revision >= held.revision ? next : held;

/** Names of folders in `next` that were not in `prev` (for the "Added ... to the library" toast). */
export function addedFolderNames(prev: LibrarySnapshot, next: LibrarySnapshot): string[] {
  const had = new Set(prev.folders.map((f) => f.id));
  return next.folders.filter((f) => !had.has(f.id)).map((f) => f.name);
}

/** "Movies", "Movies and Shows", "3 folders": the folder part of a library toast. */
export const folderNamesLabel = (names: string[]): string => (names.length > 2 ? `${names.length} folders` : names.join(" and "));
