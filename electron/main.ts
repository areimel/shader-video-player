import { app } from "electron";
import { applyGpuFlags } from "./gpuFlags";
import { registerScheme } from "./protocol";
import { parseCli, type ParsedCli } from "./cli/args";
import { findCommand, runCli } from "./cli/router";
import { cancelAll } from "./jobs/registry";
import { existingVideoFiles, startGui } from "./gui";

/** Starts the GUI if this process gets the single-instance lock; otherwise the running one is told. */
function startGuiOrForward(files: string[]): void {
  if (!app.requestSingleInstanceLock({ files })) {
    app.quit();
    return;
  }
  startGui(files);
}

/** Headless subcommand: no lock, no window, no library. Exits with the command's code. */
function runCommand(parsed: Exclude<ParsedCli, { kind: "gui" }>): void {
  if (parsed.kind === "command" && parsed.name === "version") {
    process.stdout.write(`${app.getVersion()}\n`);
    app.exit(0);
    return;
  }
  const command = parsed.kind === "command" ? findCommand(parsed.name) : undefined;
  app.commandLine.appendSwitch("log-level", "3"); // Chromium noise would drown the progress bar
  if (command?.mayOpenGui) {
    // A handoff may continue into the normal GUI start in this process.
    applyGpuFlags();
    registerScheme();
  } else if (!command?.needsGpu) {
    app.disableHardwareAcceleration();
  }
  app.on("window-all-closed", () => undefined); // a hidden worker window closing must not quit us
  process.on("SIGTERM", () => { cancelAll(); app.exit(143); });

  void app.whenReady().then(async () => {
    const result = await runCli(parsed);
    if (typeof result === "number") {
      app.exit(result);
      return;
    }
    // Handoff: the running instance gets the files, or this process becomes the GUI.
    const files = existingVideoFiles(result.handoff);
    if (!app.requestSingleInstanceLock({ files })) app.exit(0);
    else startGui(files);
  });
}

const parsed = parseCli(process.argv, app.isPackaged);
if (parsed.kind === "gui") {
  applyGpuFlags();
  registerScheme();
  startGuiOrForward(existingVideoFiles(parsed.files));
} else {
  runCommand(parsed);
}
