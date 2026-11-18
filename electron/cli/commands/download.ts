import type { CliCommand } from "../router";
import { EXIT_FAIL, EXIT_OK, EXIT_USAGE } from "../router";
import { COMMAND_SPECS } from "../args";
import { startDownload } from "../../download/download";
import { parseVideoUrl } from "../../download/url";
import type { Job } from "../../jobs/job";
import { watchJob } from "../watchJob";

export const downloadCommand: CliCommand = {
  name: "download",
  usage: "download <url> [--no-play]",
  summary: "Download a video with yt-dlp and play it",
  flags: COMMAND_SPECS.download.flags,
  mayOpenGui: true,
  async run(ctx) {
    let job: Job;
    try {
      job = startDownload(parseVideoUrl(ctx.positionals[0]));
    } catch (e) {
      ctx.error(`download: ${e instanceof Error ? e.message : String(e)}`);
      return EXIT_USAGE;
    }
    await watchJob(job, ctx.reporter, ctx.signal);
    if (ctx.signal.aborted) return EXIT_FAIL; // the router maps an aborted run to 130
    if (job.state !== "done" || !job.outputPath) {
      ctx.error(`download: ${job.error ?? "failed"}`);
      return EXIT_FAIL;
    }
    ctx.log(job.outputPath);
    if (ctx.flags["no-play"]) return EXIT_OK;
    return { handoff: [job.outputPath], registerDownloads: true };
  },
};
