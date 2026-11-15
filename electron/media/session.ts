import { mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ChildProcess } from "node:child_process";
import type { MediaInfo } from "../../shared/types";
import { supersededError } from "../../shared/superseded";
import { ENCODER_FALLBACKS, buildStreamArgs } from "./ffmpegArgs";
import { ffmpegPath } from "./binaries";
import { killProcess, spawnTracked } from "./processes";

export const CACHE_ROOT = join(tmpdir(), "svp-media-cache");

export class StreamSession {
  readonly id = randomUUID();
  readonly dir = join(CACHE_ROOT, this.id);
  readonly file = join(this.dir, "out.mp4");
  done = false;
  private proc: ChildProcess | null = null;
  private stopped = false;
  private encoderIdx = 0;
  private stderr = "";
  private poll: ReturnType<typeof setInterval> | null = null;
  private rejectStart: ((e: Error) => void) | null = null;

  constructor(
    readonly info: MediaInfo,
    readonly startSec: number,
    readonly audioOrdinal: number,
  ) {
    mkdirSync(this.dir, { recursive: true });
  }

  bytesWritten(): number {
    try { return statSync(this.file).size; } catch { return 0; }
  }

  /** Resolves once data is flowing, rejects if every encoder fails or the session is disposed first (superseded). */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.rejectStart = reject;
      const launch = () => {
        const args = buildStreamArgs(this.info, {
          input: this.info.path, output: this.file, startSec: this.startSec,
          audioOrdinal: this.audioOrdinal, encoder: ENCODER_FALLBACKS[this.encoderIdx],
        });
        const child = spawnTracked(ffmpegPath(), args);
        this.proc = child;
        this.stderr = "";
        child.stderr?.on("data", (d) => (this.stderr += String(d)));
        const poll = setInterval(() => {
          if (this.bytesWritten() > 0) { clearInterval(poll); resolve(); }
        }, 40);
        this.poll = poll;
        child.on("error", (e) => { clearInterval(poll); this.done = true; reject(e); });
        child.on("exit", (code) => {
          clearInterval(poll);
          if (this.stopped) return;
          const ok = code === 0;
          if (!ok && this.bytesWritten() === 0 && this.encoderIdx < ENCODER_FALLBACKS.length - 1) {
            this.encoderIdx++;
            return launch();
          }
          this.done = true;
          if (this.bytesWritten() > 0) resolve();
          else reject(new Error(this.stderr.trim().split("\n").pop() || "ffmpeg failed"));
        });
      };
      launch();
    });
  }

  dispose(): void {
    this.stopped = true;
    this.done = true;
    if (this.poll) clearInterval(this.poll);
    this.rejectStart?.(supersededError()); // no-op if start() already settled
    this.rejectStart = null;
    killProcess(this.proc);
    rmSync(this.dir, { recursive: true, force: true });
  }
}

export function cleanCacheRoot(): void {
  rmSync(CACHE_ROOT, { recursive: true, force: true });
}
