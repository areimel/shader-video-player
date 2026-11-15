import { app, type BrowserWindow } from "electron";
import { writeFileSync } from "node:fs";

/**
 * Development aid for checking rendering without a person at the screen:
 *   SVP_CAPTURE=/path/out.png   screenshot the window, then quit
 *   SVP_CAPTURE_DELAY=3000      milliseconds to wait before the screenshot
 *   SVP_CAPTURE_KEYS=e,p        keys to press (one per comma) one second after load
 *   SVP_CAPTURE_EVAL=<js>       expression evaluated in the page just before the screenshot; result is logged
 * Renderer console output is echoed to stdout while capturing.
 */
export function setupDevCapture(win: BrowserWindow): void {
  const out = process.env.SVP_CAPTURE;
  if (!out) return;
  const delay = Number(process.env.SVP_CAPTURE_DELAY) || 3000;
  const keys = (process.env.SVP_CAPTURE_KEYS ?? "").split(",").filter(Boolean);

  win.webContents.on("console-message", (e) => console.log(`[renderer:${e.level}] ${e.message}`));
  win.webContents.once("did-finish-load", () => {
    setTimeout(() => {
      for (const keyCode of keys) {
        win.webContents.sendInputEvent({ type: "keyDown", keyCode });
        win.webContents.sendInputEvent({ type: "char", keyCode });
        win.webContents.sendInputEvent({ type: "keyUp", keyCode });
      }
    }, 1000);
    setTimeout(() => {
      const probe = process.env.SVP_CAPTURE_EVAL;
      const evaluated = probe
        ? win.webContents.executeJavaScript(probe).then((r) => console.log(`[eval] ${JSON.stringify(r)}`), (e) => console.log(`[eval error] ${e}`))
        : Promise.resolve();
      void evaluated.then(() => win.webContents.capturePage()).then((image) => {
        writeFileSync(out, image.toPNG());
        app.quit();
      });
    }, delay);
  });
}
