import { app, type BrowserWindow } from "electron";
import { writeFileSync } from "node:fs";

/**
 * Development aid for checking rendering without a person at the screen:
 *   SVP_CAPTURE=/path/out.png   screenshot the window, then quit
 *   SVP_CAPTURE_DELAY=3000      milliseconds to wait before the screenshot
 *   SVP_CAPTURE_KEYS=e,shift+E  keys to press (one per comma) one second after load
 *   SVP_CAPTURE_SIZE=1920x1080  content size of the window
 *   SVP_CAPTURE_EVAL=<js>       expression evaluated in the page just before the screenshot; result is logged
 * Renderer console output is echoed to stdout while capturing.
 */
export function setupDevCapture(win: BrowserWindow): void {
  const out = process.env.SVP_CAPTURE;
  if (!out || app.isPackaged) return;
  const delay = Number(process.env.SVP_CAPTURE_DELAY) || 3000;
  const keys = (process.env.SVP_CAPTURE_KEYS ?? "").split(",").filter(Boolean);

  const [w, h] = (process.env.SVP_CAPTURE_SIZE ?? "").split("x").map(Number);
  if (w > 0 && h > 0) win.setContentSize(w, h);

  win.webContents.on("console-message", (e) => console.log(`[renderer:${e.level}] ${e.message}`));
  win.webContents.once("did-finish-load", () => {
    setTimeout(() => {
      for (const key of keys) {
        // "shift+E" presses E with Shift held.
        const parts = key.split("+");
        const keyCode = parts.pop() ?? "";
        const modifiers = parts as Array<"shift" | "control" | "alt">;
        win.webContents.sendInputEvent({ type: "keyDown", keyCode, modifiers });
        win.webContents.sendInputEvent({ type: "char", keyCode, modifiers });
        win.webContents.sendInputEvent({ type: "keyUp", keyCode, modifiers });
      }
    }, 1000);
    setTimeout(() => {
      const probe = process.env.SVP_CAPTURE_EVAL;
      const evaluated = probe
        ? win.webContents.executeJavaScript(probe).then((r) => console.log(`[eval] ${JSON.stringify(r)}`), (e) => console.log(`[eval error] ${e}`))
        : Promise.resolve();
      // Quit whether or not the capture worked, so an unattended run never hangs.
      void evaluated
        .then(() => win.webContents.capturePage())
        .then((image) => writeFileSync(out, image.toPNG()))
        .catch((e) => console.log(`[capture error] ${e}`))
        .finally(() => app.quit());
    }, delay);
  });
}

export interface DevPlacement {
  bounds?: { x: number; y: number; width: number; height: number };
  /** Show without taking focus, so a test run never lands on top of the person's work. */
  inactive: boolean;
}

/**
 * Dev-only window placement for unattended runs (null in packaged builds or when unset):
 *   SVP_WINDOW_BOUNDS=x,y,w,h   initial window bounds in screen coordinates
 *   SVP_WINDOW_INACTIVE=1       show the window without focusing it
 * GNOME on Wayland ignores client positioning; launch with --ozone-platform=x11 (XWayland) for bounds to apply.
 */
export function devWindowPlacement(): DevPlacement | null {
  if (app.isPackaged) return null;
  const nums = (process.env.SVP_WINDOW_BOUNDS ?? "").split(",").map(Number);
  const bounds = nums.length === 4 && nums.every(Number.isFinite) && nums[2] > 0 && nums[3] > 0
    ? { x: nums[0], y: nums[1], width: nums[2], height: nums[3] }
    : undefined;
  const inactive = process.env.SVP_WINDOW_INACTIVE === "1";
  return bounds || inactive ? { bounds, inactive } : null;
}
