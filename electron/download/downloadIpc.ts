import { ipcMain } from "electron";

/** Stub: the download team fills this in. Resolves to the job id, or null when the user cancelled a dialog. */
export function registerDownloadIpc(): void {
  ipcMain.handle("download:start", async (_e, _url: unknown): Promise<string | null> => {
    throw new Error("Not available yet");
  });
}
