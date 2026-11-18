import { checkForUpdate } from "./check";
import { cleanup, downloadAndVerify, installDeb } from "./install";

export interface RunUpdateOptions {
  current: string;
  checkOnly: boolean;
  log: (line: string) => void;
  progress: (fraction: number | null, label: string) => void;
  /** Ctrl-C: stops the check and the download, and nothing is installed. */
  signal?: AbortSignal;
}

/** check -> download/verify -> install -> cleanup. Exit code: 0 ok, 1 failure. Node-only. */
export async function runUpdate(opts: RunUpdateOptions): Promise<number> {
  const { current, checkOnly, log, progress, signal } = opts;
  let dir: string | null = null;
  try {
    log("Checking for updates...");
    const res = await checkForUpdate(current, signal);
    if (!res.newer) {
      log(`Shader Video Player ${current} is up to date.`);
      return 0;
    }
    log(`Version ${res.latest} is available (you have ${current}).`);
    if (checkOnly) {
      log("Run `shader-video-player update` to install it.");
      return 0;
    }
    const label = `Downloading ${res.release.debName}`;
    const dl = await downloadAndVerify(res.release, (f) => progress(f, label), signal);
    dir = dl.dir;
    if (signal?.aborted) return 1; // never start sudo after a Ctrl-C
    log("Checksum verified. Installing (you may be asked for your password)...");
    const code = await installDeb(dl.debPath);
    if (code !== 0) {
      log(`apt-get exited with code ${code}; the update was not installed.`);
      return 1;
    }
    log(`Updated to ${res.latest}.`);
    return 0;
  } catch (e) {
    log(`Update failed: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  } finally {
    if (dir) await cleanup(dir).catch(() => undefined);
  }
}
