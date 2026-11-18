import type { CliCommand } from "../router";
import { COMMAND_SPECS } from "../args";

export const updateCommand: CliCommand = {
  name: "update",
  usage: "update [--check]",
  summary: "Check for a new release and install it",
  flags: COMMAND_SPECS.update.flags,
  async run(ctx) {
    ctx.error("update: not implemented yet");
    return 1;
  },
};
