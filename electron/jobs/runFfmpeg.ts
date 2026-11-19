import type { ChildProcess } from "node:child_process";
import { ffmpegPath } from "../media/binaries";
import { PROGRESS_ARGS } from "../media/ffmpegArgs";
import { spawnTracked, tailLines } from "../media/processes";
import { createFfmpegProgress } from "./ffmpegProgress";
import type { Job } from "./job";

/**
 * Runs ffmpeg for a job. `PROGRESS_ARGS` are inserted here, so callers pass only their own args
 * (they should still include `-y`, `-nostdin` unless `stdin` is set, and INPUT_PROTOCOLS).
 * `done` rejects with ffmpeg's last stderr line on a non-zero exit; a cancelled job never rejects.
 */
export function runFfmpeg(
  job: Job, args: string[], durationSec: number, opts: { stdin?: boolean } = {},
): { child: ChildProcess; done: Promise<void> } {
  const child = spawnTracked(ffmpegPath(), [...PROGRESS_ARGS, ...args], { stdout: true, stdin: opts.stdin });
  job.killOnCancel(child);
  const progress = createFfmpegProgress(durationSec);
  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    const f = progress.push(chunk);
    if (f !== null) job.report(f);
  });
  const tail = tailLines(child.stderr!);
  const done = new Promise<void>((resolve, reject) => {
    child.on("error", (e) => reject(e));
    child.on("close", (code, signal) => {
      if (job.state === "cancelled" || code === 0) return resolve();
      const last = tail().filter(Boolean).pop();
      reject(new Error(last ?? `ffmpeg exited with ${code ?? signal}`));
    });
  });
  return { child, done };
}
