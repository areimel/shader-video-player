import { app, Menu, type MenuItemConstructorOptions } from "electron";
import { COMMANDS, GROUP_ORDER, toAccelerator, type CommandGroup, type CommandSpec } from "../shared/commands";
import { openSelection, pushSelection } from "./selection";
import { showOpenDialog } from "./ipc";
import { getRecents, onRecentsChanged } from "./recents";
import { getWindow } from "./window";
import { openLink, setAboutPanel } from "./links";

async function openFromMenu(): Promise<void> {
  try {
    const result = await showOpenDialog();
    if (result) pushSelection(Promise.resolve(result));
  } catch (e) {
    getWindow()?.webContents.send("media:error", (e as Error).message);
  }
}

function send(id: string): void {
  getWindow()?.webContents.send("menu:command", id);
}

function item(c: CommandSpec): MenuItemConstructorOptions {
  const click = c.id === "open" ? () => void openFromMenu() : () => send(c.id);
  if (c.accelerator) return { label: c.label, accelerator: c.accelerator, click };
  // Plain keys are handled in the renderer; show them without letting the menu steal typing.
  const shown = c.keys?.[0] ? toAccelerator(c.keys[0]) : undefined;
  return shown
    ? { label: c.label, accelerator: shown, registerAccelerator: false, click }
    : { label: c.label, click };
}

function recentsMenu(): MenuItemConstructorOptions {
  const recents = getRecents();
  return {
    label: "Open Recent",
    enabled: recents.length > 0,
    submenu: recents.map((r) => ({
      label: r.name,
      click: () => pushSelection(openSelection([r.path])),
    })),
  };
}

function groupMenu(group: CommandGroup): MenuItemConstructorOptions[] {
  return COMMANDS.filter((c) => c.group === group && (c as CommandSpec).menu !== false).map(item);
}

function build(): void {
  const groups = Object.fromEntries(GROUP_ORDER.map((g) => [g, groupMenu(g)])) as Record<CommandGroup, MenuItemConstructorOptions[]>;
  const [open, ...fileRest] = groups.File;
  const view: MenuItemConstructorOptions[] = [...groups.View];
  if (!app.isPackaged) view.push({ type: "separator" }, { role: "toggleDevTools" });
  const template: MenuItemConstructorOptions[] = [
    { label: "File", submenu: [open, recentsMenu(), ...fileRest, { type: "separator" }, { role: "quit" }] },
    { label: "Playback", submenu: groups.Playback },
    { label: "Subtitles", submenu: groups.Subtitles },
    { label: "Effects", submenu: groups.Effects },
    { role: "editMenu" },
    { label: "View", submenu: view },
    { role: "windowMenu" },
    { label: "Help", submenu: [
      { label: "Keyboard shortcuts", accelerator: "Shift+/", registerAccelerator: false, click: () => send("shortcuts") },
      { type: "separator" },
      { label: "Website", click: () => openLink("website") },
      { label: "Report an Issue", click: () => openLink("issues") },
      { type: "separator" },
      { role: "about", label: "About Shader Video Player" },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

let subscribed = false;
export function buildMenu(): void {
  if (!subscribed) { subscribed = true; setAboutPanel(); onRecentsChanged(build); }
  build();
}
