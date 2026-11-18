import type { CliCommand } from "../router";
import { COMMAND_SPECS } from "../args";

export const exportCommand: CliCommand = {
  name: "export",
  usage: "export <file> [--effect id] [--preset id] [--settings f.json] [--size WxH] [-o out]",
  summary: "Render a video with a shader effect baked in",
  flags: COMMAND_SPECS.export.flags,
  needsGpu: true,
  async run(ctx) {
    ctx.error("export: not implemented yet");
    return 1;
  },
};
