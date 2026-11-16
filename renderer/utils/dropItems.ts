/** The parts of DataTransferItem a drop split needs (structural, so tests can pass plain objects). */
export interface DropItemLike {
  kind: string;
  getAsFile(): File | null;
  webkitGetAsEntry(): { isDirectory: boolean } | null;
}

/**
 * Splits a drop into directories and files. Must run inside the drop handler: the browser empties the
 * DataTransfer afterwards.
 */
export function partitionDrop(items: ArrayLike<DropItemLike>): { folders: File[]; files: File[] } {
  const folders: File[] = [];
  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (it.kind !== "file") continue;
    const file = it.getAsFile();
    if (!file) continue;
    (it.webkitGetAsEntry()?.isDirectory ? folders : files).push(file);
  }
  return { folders, files };
}
