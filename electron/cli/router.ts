import { cancelAll } from "../jobs/registry";
import { COMMAND_SPECS, type FlagSpec, type ParsedCli } from "./args";
import { createReporter, type Reporter } from "./progressBar";
import { downloadCommand } from "./commands/download";
import { convertCommand } from "./commands/convert";
import { exportCommand } from "./commands/export";
import { updateCommand } from "./commands/update";

export type { FlagSpec };

export interface CliContext {
  positionals: string[];
  flags: Record<string, string | true>;
  /** Normal output (stdout). */
  log(line: string): void;
  /** Diagnostics (stderr). */
  error(line: string): void;
  reporter: Reporter;
  /** Aborted on SIGINT. */
  signal: AbortSignal;
}

export interface CliCommand {
  name: string;
  usage: string;
  summary: string;
  flags: FlagSpec;
  needsGpu?: boolean;
  /** May hand a file to the GUI, so the process keeps GPU access and the app scheme. */
  mayOpenGui?: boolean;
  /** Exit code, or `{ handoff }` to open these files in the GUI (a running instance, or this one). */
  run(ctx: CliContext): Promise<number | { handoff: string[]; registerDownloads?: boolean }>;
}

export type CliResult = number | { handoff: string[]; registerDownloads?: boolean };

export const EXIT_OK = 0;
export const EXIT_FAIL = 1;
export const EXIT_USAGE = 2;
export const EXIT_CANCELLED = 130;

const helpCommand: CliCommand = {
  name: "help",
  usage: "help [command]",
  summary: "Show this help",
  flags: COMMAND_SPECS.help.flags,
  async run(ctx) {
    const name = ctx.positionals[0];
    const only = name ? COMMANDS.filter((c) => c.name === name) : COMMANDS;
    if (name && !only.length) {
      ctx.error(`help: unknown command ${name}`);
      return EXIT_USAGE;
    }
    ctx.log(usageText(only));
    return EXIT_OK;
  },
};

export const COMMANDS: CliCommand[] = [downloadCommand, convertCommand, exportCommand, updateCommand, helpCommand];

export function findCommand(name: string): CliCommand | undefined {
  return COMMANDS.find((c) => c.name === name);
}

export function usageText(commands: CliCommand[] = COMMANDS): string {
  const lines = ["Usage: shader-video-player [file...]", "       shader-video-player <command> [options]", ""];
  for (const c of commands) {
    lines.push(`  ${c.usage}`, `      ${c.summary}`);
    const flags = Object.entries(c.flags).map(([k, v]) => `--${k}${v.short ? `, -${v.short}` : ""}${v.value ? " <value>" : ""}`);
    if (flags.length) lines.push(`      options: ${flags.join("  ")}`);
  }
  lines.push("", "  --help, -h     Show this help", "  --version      Print the version");
  return lines.join("\n");
}

export async function runCli(parsed: Exclude<ParsedCli, { kind: "gui" }>): Promise<CliResult> {
  const log = (line: string) => void process.stdout.write(`${line}\n`);
  const error = (line: string) => void process.stderr.write(`${line}\n`);
  if (parsed.kind === "error") {
    error(parsed.message);
    error("Run 'shader-video-player help' for usage.");
    return EXIT_USAGE;
  }
  const command = findCommand(parsed.name);
  if (!command) {
    error(`unknown command ${parsed.name}`);
    return EXIT_USAGE;
  }
  const abort = new AbortController();
  const onSigint = () => { abort.abort(); cancelAll(); };
  process.on("SIGINT", onSigint);
  const reporter = createReporter(process.stderr);
  try {
    const result = await command.run({
      positionals: parsed.positionals, flags: parsed.flags, log, error, reporter, signal: abort.signal,
    });
    reporter.finish();
    if (abort.signal.aborted) return EXIT_CANCELLED;
    return result;
  } catch (e) {
    reporter.finish();
    if (abort.signal.aborted) return EXIT_CANCELLED;
    error(`${command.name}: ${e instanceof Error ? e.message : String(e)}`);
    return EXIT_FAIL;
  } finally {
    process.off("SIGINT", onSigint);
  }
}
