import { app, dialog, ipcMain } from "electron";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isPng, safePngName } from "./pngName";
import { getWindow } from "./window";

export { isPng, safePngName };

export function registerScreenshotIpc(): void {
  ipcMain.handle("screenshot:save", async (_e, png: unknown, name: unknown): Promise<string | null> => {
    if (!isPng(png)) throw new Error("Invalid screenshot data");
    const opts = {
      title: "Save screenshot",
      defaultPath: join(app.getPath("pictures"), safePngName(name)),
      filters: [{ name: "PNG image", extensions: ["png"] }],
    };
    const win = getWindow();
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (res.canceled || !res.filePath) return null;
    await writeFile(res.filePath, png);
    return res.filePath;
  });
}
