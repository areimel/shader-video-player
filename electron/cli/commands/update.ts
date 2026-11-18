import { app } from "electron";
import type { CliCommand } from "../router";
import { COMMAND_SPECS } from "../args";
import { runUpdate } from "../../update/run";

/** Same as EXIT_CANCELLED in router.ts (not imported: router imports this file). */
const CANCELLED = 130;

export const updateCommand: CliCommand = {
  name: "update",
  usage: "update [--check]",
  summary: "Install the newest release (asks for your password via sudo)",
  flags: COMMAND_SPECS.update.flags,
  async run(ctx) {
    // Log lines go to stdout while the progress bar lives on stderr: end the bar first.
    const log = (line: string) => {
      ctx.reporter.finish();
      ctx.log(line);
    };
    const code = await runUpdate({
      current: app.getVersion(),
      signal: ctx.signal,
      checkOnly: ctx.flags.check === true,
      log,
      progress: (fraction, label) => ctx.reporter.update({ fraction, etaSec: null, label }),
    });
    return ctx.signal.aborted ? CANCELLED : code;
  },
};
