import { spawn, type ChildProcess } from "node:child_process";

const tracked = new Set<ChildProcess>();

/** `stdout: true` pipes stdout for callers that read the output (library metadata probes). */
export function spawnTracked(cmd: string, args: string[], opts: { stdout?: boolean } = {}): ChildProcess {
  const child = spawn(cmd, args, { stdio: ["ignore", opts.stdout ? "pipe" : "ignore", "pipe"] });
  tracked.add(child);
  child.on("exit", () => tracked.delete(child));
  return child;
}

export function killProcess(child: ChildProcess | null): void {
  if (child && child.exitCode === null) child.kill("SIGKILL");
}

export function killAll(): void {
  tracked.forEach((c) => killProcess(c));
  tracked.clear();
}
