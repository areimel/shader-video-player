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
