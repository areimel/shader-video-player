import { existsSync } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { basename, dirname, extname } from "node:path";
import type { MediaInfo } from "../../shared/types";
import { startJob } from "../jobs/registry";
import type { Job } from "../jobs/job";
import { runFfmpeg } from "../jobs/runFfmpeg";
import { ENCODER_FALLBACKS } from "../media/ffmpegArgs";
import { appVideosDir, writableDirOr } from "../media/outputDir";
import { partPath, uniqueName } from "../media/outputName";
import { buildConvertArgs } from "./convertArgs";

/** Default output: `<name>.svp.mp4` beside the source, or in the app's Videos folder when that is read-only. */
async function defaultOutput(info: MediaInfo): Promise<string> {
  const dir = await writableDirOr(dirname(info.path), await appVideosDir());
  const base = `${basename(info.path, extname(info.path))}.svp`;
  return uniqueName(dir, base, "mp4", existsSync);
}

/** Writes a smooth-playback MP4 as a job. The `.part` file is renamed on success and removed otherwise. */
export function startConvert(info: MediaInfo, audioOrdinal: number, outPath?: string): Job {
  return startJob("convert", info.name, async (job) => {
    const out = outPath ?? await defaultOutput(info);
    const part = partPath(out);
    job.onCancel(() => void rm(part, { force: true }));
    try {
      let lastError: unknown;
      for (const encoder of ENCODER_FALLBACKS) {
        try {
          await runFfmpeg(job, buildConvertArgs(info, audioOrdinal, encoder, part), info.durationSec).done;
          lastError = undefined;
          break;
        } catch (e) { lastError = e; }
      }
      if (lastError) throw lastError;
      if (job.state === "cancelled") return;
      await rename(part, out);
      job.succeed(out, ["open", "reveal"]);
    } catch (e) {
      await rm(part, { force: true });
      throw e;
    }
  });
}
