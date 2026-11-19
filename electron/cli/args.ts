/** Pure command-line parsing (no electron import). */

export type FlagKind = { value: boolean; short?: string };
/** Long flag name (without dashes) -> whether it takes a value, and an optional one-letter alias. */
export type FlagSpec = Record<string, FlagKind>;

export interface CommandSpec {
  flags: FlagSpec;
  minPositionals: number;
  maxPositionals: number;
}

const OUTPUT: FlagKind = { value: true, short: "o" };

/**
 * Registered subcommands. A subcommand matches only when the first non-switch argument equals
 * its name exactly, so `./update` (or an absolute path) still opens a file called "update".
 */
export const COMMAND_SPECS: Record<string, CommandSpec> = {
  download: { flags: { "no-play": { value: false } }, minPositionals: 1, maxPositionals: 1 },
  convert: { flags: { output: OUTPUT, force: { value: false } }, minPositionals: 1, maxPositionals: 1 },
  export: {
    flags: {
      effect: { value: true }, preset: { value: true }, settings: { value: true },
      size: { value: true }, output: OUTPUT,
    },
    minPositionals: 1, maxPositionals: 1,
  },
  update: { flags: { check: { value: false } }, minPositionals: 0, maxPositionals: 0 },
  help: { flags: {}, minPositionals: 0, maxPositionals: 1 },
};

export type ParsedCli =
  | { kind: "gui"; files: string[] }
  | { kind: "command"; name: string; positionals: string[]; flags: Record<string, string | true> }
  | { kind: "error"; message: string };

const PASS_THROUGH_NAMES = [
  "--no-sandbox", "--no-zygote", "--ozone-platform", "--user-data-dir", "--js-flags", "--log-level",
  "--password-store", "--gtk-version", "--lang", "--proxy-server", "--no-proxy-server",
];
const PASS_THROUGH_PREFIXES = [
  "--inspect", "--remote-debugging-", "--enable-", "--disable-", "--force-", "--use-", "--allow-", "--ignore-",
];

/** Chromium/Electron switches that must never be read as ours (they use `--name=value`). */
export function isPassThrough(arg: string): boolean {
  return PASS_THROUGH_NAMES.some((n) => arg === n || arg.startsWith(n + "="))
    || PASS_THROUGH_PREFIXES.some((p) => arg.startsWith(p));
}

/** Arguments after the executable (and, unpackaged, the app path). */
function userArgs(argv: string[], isPackaged: boolean): string[] {
  if (isPackaged) return argv.slice(1);
  // `electron [switches] . args`: skip switches, then the app path.
  let i = 1;
  while (i < argv.length && argv[i].startsWith("-")) i++;
  return argv.slice(i + 1);
}

function parseCommand(name: string, rest: string[]): ParsedCli {
  const spec = COMMAND_SPECS[name];
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--") { positionals.push(...rest.slice(i + 1)); break; }
    if (!arg.startsWith("-") || arg === "-") { positionals.push(arg); continue; }
    const isLong = arg.startsWith("--");
    const eq = isLong ? arg.indexOf("=") : -1;
    const key = eq > 0 ? arg.slice(2, eq) : arg.slice(isLong ? 2 : 1);
    const long = isLong ? key : Object.keys(spec.flags).find((k) => spec.flags[k].short === key);
    const kind = long !== undefined && Object.hasOwn(spec.flags, long) ? spec.flags[long] : undefined;
    if (!long || !kind) {
      if (isPassThrough(arg)) continue;
      return { kind: "error", message: `${name}: unknown option ${eq > 0 ? arg.slice(0, eq) : arg}` };
    }
    if (!kind.value) {
      if (eq > 0) return { kind: "error", message: `${name}: --${long} takes no value` };
      flags[long] = true;
    } else if (eq > 0) {
      flags[long] = arg.slice(eq + 1);
    } else if (i + 1 < rest.length) {
      flags[long] = rest[++i];
    } else {
      return { kind: "error", message: `${name}: --${long} needs a value` };
    }
  }
  if (positionals.length < spec.minPositionals) return { kind: "error", message: `${name}: missing argument` };
  if (positionals.length > spec.maxPositionals) return { kind: "error", message: `${name}: too many arguments` };
  return { kind: "command", name, positionals, flags };
}

export function parseCli(argv: string[], isPackaged: boolean): ParsedCli {
  const args = userArgs(argv, isPackaged);
  const first = args.findIndex((a) => !a.startsWith("-"));
  if (first >= 0 && Object.hasOwn(COMMAND_SPECS, args[first])) {
    return parseCommand(args[first], args.slice(first + 1));
  }
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "command", name: "help", positionals: [], flags: {} };
  }
  if (args.includes("--version")) {
    return { kind: "command", name: "version", positionals: [], flags: {} };
  }
  return { kind: "gui", files: args.filter((a) => !a.startsWith("-")) };
}
