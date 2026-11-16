import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSuperseded } from "../../shared/superseded";
import type { LibrarySnapshot } from "../../shared/types";
import type { ToastKind } from "../types/player";
import { friendlyError } from "../utils/format";
import { addedFolderNames, applyMetaPatches, EMPTY_LIBRARY, newerSnapshot } from "../utils/home/libraryRows";

export interface Library {
  snapshot: LibrarySnapshot;
  /** Folder picker in the main process; cancelling does nothing. */
  addFolder: () => void;
  /** Registers dropped directories (File objects; the preload resolves their paths). */
  addDropped: (dirs: File[]) => void;
  removeFolder: (folderId: string) => void;
  rescan: () => void;
}

const joinNames = (names: string[]) => names.length > 2 ? `${names.length} folders` : names.join(" and ");

/** The library index from the main process: loaded on mount, replaced on pushes, patched as metadata arrives. */
export function useLibrary(notify: (kind: ToastKind, msg: string) => void): Library {
  const [snapshot, setSnapshot] = useState<LibrarySnapshot>(EMPTY_LIBRARY);
  const ref = useRef(snapshot);
  ref.current = snapshot;
  const accept = useCallback((next: LibrarySnapshot) => setSnapshot((held) => newerSnapshot(held, next)), []);

  useEffect(() => {
    void window.player.getLibrary().then(accept, (e) => notify("error", friendlyError(e)));
    const offLib = window.player.onLibrary(accept);
    const offMeta = window.player.onLibraryMeta((p) => setSnapshot((s) => applyMetaPatches(s, p)));
    return () => { offLib(); offMeta(); };
  }, [accept, notify]);

  const fail = useCallback((e: unknown) => { if (!isSuperseded(e)) notify("error", friendlyError(e)); }, [notify]);
  /** Applies a reply that added folders and names them in a toast. */
  const added = useCallback((next: LibrarySnapshot | null) => {
    if (!next) return;
    const names = addedFolderNames(ref.current, next);
    accept(next);
    if (names.length) notify("success", `Added ${joinNames(names)} to the library`);
  }, [accept, notify]);

  return useMemo(() => ({
    snapshot,
    addFolder: () => void window.player.addLibraryFolder().then(added, fail),
    addDropped: (dirs) => { if (dirs.length) void window.player.addLibraryDropped(dirs).then(added, fail); },
    removeFolder: (folderId) => {
      const name = ref.current.folders.find((f) => f.id === folderId)?.name ?? "the folder";
      void window.player.removeLibraryFolder(folderId).then((s) => {
        accept(s);
        notify("success", `Removed ${name} from the library`);
      }, fail);
    },
    rescan: () => window.player.rescanLibrary(),
  }), [snapshot, added, fail, accept, notify]);
}
