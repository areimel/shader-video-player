import type { CliCommand } from "../router";
import { EXIT_FAIL, EXIT_OK, EXIT_USAGE } from "../router";
import { COMMAND_SPECS } from "../args";
import { startDownload } from "../../download/download";
import { parseVideoUrl } from "../../download/url";
import type { Job } from "../../jobs/job";

/** Resolves when the job finishes or the run is aborted; `onChange` sees every job update. */
function waitFor(job: Job, signal: AbortSignal, onChange: () => void): Promise<void> {
  return new Promise((resolve) => {
    let off = () => undefined as void;
    const done = () => { off(); signal.removeEventListener("abort", done); resolve(); };
    off = job.onChange(() => { onChange(); if (job.finished) done(); });
    signal.addEventListener("abort", done);
    if (signal.aborted || job.finished) done();
  });
}

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
    await waitFor(job, ctx.signal, () => ctx.reporter.update(job.progress));
    if (ctx.signal.aborted) { job.cancel(); return EXIT_FAIL; } // the router maps an aborted run to 130
    if (job.state !== "done" || !job.outputPath) {
      ctx.reporter.finish();
      ctx.error(`download: ${job.error ?? "failed"}`);
      return EXIT_FAIL;
    }
    ctx.reporter.finish();
    ctx.log(job.outputPath);
    if (ctx.flags["no-play"]) return EXIT_OK;
    return { handoff: [job.outputPath], registerDownloads: true };
  },
};
