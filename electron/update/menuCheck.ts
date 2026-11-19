import { dialog, type MessageBoxOptions } from "electron";
import { openLink } from "../links";
import { getWindow } from "../window";
import { checkForUpdate } from "./check";

/** Help > Check for updates...: reports only; installing is `shader-video-player update` in a terminal. */
export async function checkFromMenu(currentVersion: string): Promise<void> {
  const win = getWindow();
  const show = (o: MessageBoxOptions) => (win ? dialog.showMessageBox(win, o) : dialog.showMessageBox(o));
  try {
    const r = await checkForUpdate(currentVersion);
    if (!r.newer) {
      await show({ type: "info", message: "Shader Video Player is up to date.", detail: `Version ${r.current} is the newest release.` });
      return;
    }
    const { response } = await show({
      type: "info",
      message: `Version ${r.latest} is available.`,
      detail: "Run `shader-video-player update` in a terminal to install it.",
      buttons: ["Open releases page", "Close"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) openLink("releases");
  } catch (e) {
    await show({ type: "error", message: "Could not check for updates.", detail: e instanceof Error ? e.message : String(e) });
  }
}
