import { ipcMain } from "electron";

/** Stub: the convert team fills this in. Resolves to the job id, or null when the user cancelled a dialog. */
export function registerConvertIpc(): void {
  ipcMain.handle("convert:start", async (_e, _audioOrdinal: unknown): Promise<string | null> => {
    throw new Error("Not available yet");
  });
}
