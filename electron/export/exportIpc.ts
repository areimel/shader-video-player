import { ipcMain } from "electron";

/** Stub: the export team fills this in. Resolves to the job id, or null when the user cancelled a dialog. */
export function registerExportIpc(): void {
  ipcMain.handle("export:start", async (_e, _req: unknown): Promise<string | null> => {
    throw new Error("Not available yet");
  });
}
