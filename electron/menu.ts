import { Menu, type MenuItemConstructorOptions } from "electron";
import { showOpenDialog } from "./ipc";
import { pushSelection } from "./selection";
import { getWindow } from "./window";

async function openFromMenu(): Promise<void> {
  try {
    const result = await showOpenDialog();
    if (result) pushSelection(Promise.resolve(result));
  } catch (e) {
    getWindow()?.webContents.send("media:error", (e as Error).message);
  }
}

export function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        { label: "Open…", accelerator: "CmdOrCtrl+O", click: () => void openFromMenu() },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { label: "View", submenu: [{ role: "togglefullscreen" }, { role: "toggleDevTools" }] },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
