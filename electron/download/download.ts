import { readdir, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import { ffmpegPath, ytDlpPath } from "../media/binaries";
import { isSupportedExtension } from "../media/formats";
import { appVideosDir } from "../media/outputDir";
import { spawnTracked, tailLines } from "../media/processes";
import { isInside } from "../library/ids";
import { startJob } from "../jobs/registry";
import type { Job } from "../jobs/job";
import { parseVideoUrl } from "./url";
import { buildYtDlpArgs } from "./ytdlpArgs";
import { createTracker } from "./ytdlpProgress";

export const YTDLP_MISSING =
  "yt-dlp is not installed. Install it with `sudo apt install yt-dlp` or `pipx install yt-dlp`.";

/** Leftovers of an interrupted yt-dlp: partial files, resume state, and unmerged per-stream files (`.f251.webm`). */
const LEFTOVER = /\.(part|ytdl|temp)$|\.part-Frag\d+$|\.f[\w-]+\.\w+(\.part)?$/;

async function listDir(dir: string): Promise<Set<string>> {
  try { return new Set(await readdir(dir)); } catch { return new Set(); }
}

/** Deletes files that appeared in `dir` since `before` and look like yt-dlp leftovers. */
async function removeLeftovers(dir: string, before: Set<string>): Promise<void> {
  for (const name of await listDir(dir)) {
    if (!before.has(name) && LEFTOVER.test(name)) await rm(join(dir, name), { force: true }).catch(() => undefined);
  }
}

/** Starts a yt-dlp download of `rawUrl` into the app's videos folder. Throws synchronously on a bad URL. */
export function startDownload(rawUrl: unknown): Job {
  const url = parseVideoUrl(rawUrl);
  const host = new URL(url).hostname.replace(/^www\./, "");
  return startJob("download", `Download from ${host}`, async (job) => {
    const outDir = await appVideosDir();
    const before = await listDir(outDir);
    const args = buildYtDlpArgs(url, outDir, process.env.SVP_FFMPEG_PATH ? ffmpegPath() : undefined);
    const child = spawnTracked(ytDlpPath(), args, { stdout: true });
    job.onCancel(() => {
      child.kill("SIGKILL");
      // The kill is asynchronous; yt-dlp may still be writing until it is gone.
      child.once("close", () => void removeLeftovers(outDir, before));
    });
    job.report(null, "starting");

    const tracker = createTracker();
    let partial = "";
    const onLine = (line: string) => {
      const u = tracker.push(line);
      if (u) job.report(u.fraction, u.label);
    };
    child.stdout!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => {
      const parts = (partial + chunk).split(/\r?\n|\r/);
      partial = parts.pop() ?? "";
      parts.forEach(onLine);
    });
    const tail = tailLines(child.stderr!);

    const code = await new Promise<number | null>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (c) => resolve(c));
    }).catch((e: NodeJS.ErrnoException) => {
      throw new Error(e.code === "ENOENT" ? YTDLP_MISSING : `Could not start yt-dlp: ${e.message}`);
    });
    if (job.state === "cancelled") return;
    if (partial) onLine(partial);
    if (code !== 0) {
      const last = tail().pop();
      throw new Error(last ? last.replace(/^ERROR:\s*/, "") : `yt-dlp exited with ${code}`);
    }

    const printed = tracker.path;
    if (!printed) throw new Error("yt-dlp did not report a file");
    let real: string;
    try {
      real = await realpath(printed);
    } catch {
      throw new Error("The downloaded file could not be found");
    }
    if (!isInside(await realpath(outDir), real)) throw new Error("The download ended up outside the videos folder");
    if (!isSupportedExtension(real)) throw new Error("The downloaded file is not a supported video format");
    job.report(1, "done"); // an already-downloaded file never reported a stage: do not leave "starting" on the finished card
    job.succeed(real, ["open", "reveal"]);
  });
}
