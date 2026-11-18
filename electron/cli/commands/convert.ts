import { resolve } from "node:path";
import { startConvert } from "../../convert/convert";
import { nativeMime } from "../../media/formats";
import { probeFile } from "../../media/probe";
import { EXIT_CANCELLED, EXIT_FAIL, EXIT_OK, EXIT_USAGE, type CliCommand } from "../router";
import { COMMAND_SPECS } from "../args";

export const convertCommand: CliCommand = {
  name: "convert",
  usage: "convert <file> [-o out] [--force]",
  summary: "Convert a video to MP4 for smooth playback",
  flags: COMMAND_SPECS.convert.flags,
  async run(ctx) {
    const file = ctx.positionals[0];
    if (!file) { ctx.error("convert: missing <file>"); return EXIT_USAGE; }
    const info = await probeFile(resolve(file));
    if (nativeMime(info) && ctx.flags.force !== true) {
      ctx.error("convert: already plays natively; use --force to convert anyway");
      return EXIT_FAIL;
    }
    const out = typeof ctx.flags.output === "string" ? resolve(ctx.flags.output) : undefined;
    const job = startConvert(info, info.audioTracks[0]?.ordinal ?? 0, out);
    const onAbort = () => job.cancel();
    ctx.signal.addEventListener("abort", onAbort);
    return new Promise<number>((done) => {
      const update = () => {
        if (job.state === "running") {
          ctx.reporter.update({ ...job.progress, label: `Converting ${info.name}` });
          return;
        }
        ctx.signal.removeEventListener("abort", onAbort);
        ctx.reporter.finish();
        if (job.state === "done") { ctx.log(job.outputPath ?? ""); done(EXIT_OK); }
        else if (job.state === "cancelled") done(EXIT_CANCELLED);
        else { ctx.error(`convert: ${job.error ?? "failed"}`); done(EXIT_FAIL); }
      };
      job.onChange(update);
      update();
    });
  },
};
