import { spawn, type ChildProcess } from "node:child_process";
import type { Readable } from "node:stream";

const tracked = new Set<ChildProcess>();
/** Children spawned with `group: true`: they lead their own process group, which is killed as a whole. */
const grouped = new WeakSet<ChildProcess>();

/**
 * `stdout: true` pipes stdout for callers that read the output (library metadata probes, ffmpeg progress);
 * `stdin: true` pipes stdin (frames fed to an encoder). `group: true` makes the child a process-group leader
 * (`detached`; stdio and ref-counting are unchanged) so killProcess also reaches what it spawned (yt-dlp's ffmpeg). stderr is always piped: drain it (see `tailLines`).
 */
export function spawnTracked(cmd: string, args: string[], opts: { stdin?: boolean; stdout?: boolean; group?: boolean } = {}): ChildProcess {
  const child = spawn(cmd, args, { stdio: [opts.stdin ? "pipe" : "ignore", opts.stdout ? "pipe" : "ignore", "pipe"], detached: opts.group === true });
  if (opts.group) grouped.add(child);
  tracked.add(child);
  child.on("exit", () => tracked.delete(child));
  // A child that failed to spawn (binary not installed) emits "error", has no pid and never emits "exit".
  // "error" from a failed kill of a live child keeps it tracked so killAll still reaches it.
  child.on("error", () => { if (child.pid === undefined) tracked.delete(child); });
  return child;
}

export function killProcess(child: ChildProcess | null): void {
  if (!child || child.exitCode !== null) return;
  if (grouped.has(child) && child.pid !== undefined) {
    try { process.kill(-child.pid, "SIGKILL"); return; } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e;
    }
  }
  child.kill("SIGKILL");
}

export function killAll(): void {
  tracked.forEach((c) => killProcess(c));
  tracked.clear();
}

/** Drains a stream (so the child never blocks on a full pipe) and keeps its last `n` lines. */
export function tailLines(stream: Readable, n = 20): () => string[] {
  let lines: string[] = [];
  let partial = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => {
    const parts = (partial + chunk).split(/\r?\n|\r/);
    partial = parts.pop() ?? "";
    for (const l of parts) if (l) lines.push(l);
    if (lines.length > n) lines = lines.slice(-n);
  });
  return () => (partial ? [...lines, partial] : [...lines]).slice(-n);
}
