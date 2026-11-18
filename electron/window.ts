import { BrowserWindow, session, type WebContents } from "electron";
import { join } from "node:path";
import { devWindowPlacement } from "./devCapture";

let win: BrowserWindow | null = null;

export function getWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null;
}

/** Every window's page: no new windows, no navigation away, and only fullscreen granted (camera, mic and the rest stay denied). */
export function hardenContents(wc: WebContents): void {
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === "fullscreen"));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === "fullscreen");
  wc.setWindowOpenHandler(() => ({ action: "deny" }));
  wc.on("will-navigate", (e) => e.preventDefault());
}

export function createWindow(onClosed: () => void): BrowserWindow {
  const placement = devWindowPlacement();
  win = new BrowserWindow({
    width: 1100, height: 680, minWidth: 480, minHeight: 320,
    ...placement?.bounds, show: !placement,
    title: "Shader Video Player", backgroundColor: "#17181a",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  hardenContents(win.webContents);
  win.on("closed", () => { win = null; onClosed(); });
  if (placement) {
    const w = win;
    w.once("ready-to-show", () => {
      if (placement.inactive) w.showInactive(); else w.show();
      if (placement.bounds) w.setBounds(placement.bounds); // some window managers place on map; apply again
    });
  }

  const dev = process.env.VITE_DEV_SERVER_URL;
  if (dev) void win.loadURL(dev);
  else void win.loadFile(join(__dirname, "../dist-renderer/index.html"));
  return win;
}
