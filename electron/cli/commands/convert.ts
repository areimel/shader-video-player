import type { CliCommand } from "../router";
import { COMMAND_SPECS } from "../args";

export const convertCommand: CliCommand = {
  name: "convert",
  usage: "convert <file> [-o out] [--force]",
  summary: "Convert a video to MP4 for smooth playback",
  flags: COMMAND_SPECS.convert.flags,
  async run(ctx) {
    ctx.error("convert: not implemented yet");
    return 1;
  },
};
