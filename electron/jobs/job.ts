import { randomUUID } from "node:crypto";
import type { ChildProcess } from "node:child_process";
import type { JobAction, JobKind, JobProgress, JobSnapshot, JobState } from "../../shared/jobs";
import { killProcess } from "../media/processes";
import { EtaEstimator } from "./eta";

/** At most this many change events per second while progress is reported. */
const MAX_EVENTS_PER_SEC = 10;
const MIN_EVENT_GAP_MS = 1000 / MAX_EVENTS_PER_SEC;

export class Job {
  readonly id = randomUUID();
  state: JobState = "running";
  progress: JobProgress = { fraction: null, etaSec: null, label: "" };
  error: string | undefined;
  /** Main process only: never part of the snapshot. */
  outputPath: string | null = null;
  private actions: JobAction[] = [];
  private cleanups: Array<() => void> = [];
  private listeners = new Set<() => void>();
  private eta = new EtaEstimator();
  private lastEmit = 0;

  constructor(readonly kind: JobKind, readonly title: string) {}

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  /**
   * Runs when the job is cancelled (kill a child, delete a .part file). Not run on success or failure.
   * Registered after the cancel already happened (a job cancelled while awaiting), it runs at once,
   * so a child spawned late is never left running.
   */
  onCancel(fn: () => void): void {
    if (this.state === "cancelled") {
      try { fn(); } catch { /* cleanup is best effort */ }
      return;
    }
    if (this.finished) return;
    this.cleanups.push(fn);
  }

  /** Convenience: kill `child` on cancel. */
  killOnCancel(child: ChildProcess): void {
    this.onCancel(() => killProcess(child));
  }

  get finished(): boolean {
    return this.state !== "running";
  }

  report(fraction: number | null, label?: string): void {
    if (this.finished) return;
    const now = Date.now();
    const f = fraction === null ? null : Math.min(1, Math.max(0, fraction));
    this.progress = {
      fraction: f,
      etaSec: f === null ? null : this.eta.update(f, now),
      label: label ?? this.progress.label,
    };
    if (now - this.lastEmit >= MIN_EVENT_GAP_MS) this.emit(now);
  }

  succeed(outputPath: string | null, actions: JobAction[]): void {
    if (this.finished) return;
    this.outputPath = outputPath;
    this.actions = actions;
    this.progress = { fraction: 1, etaSec: 0, label: this.progress.label };
    this.finish("done");
  }

  fail(message: string): void {
    if (this.finished) return;
    this.error = message;
    this.finish("failed");
  }

  cancel(): void {
    if (this.finished) return;
    this.state = "cancelled";
    for (const fn of this.cleanups.splice(0)) {
      try { fn(); } catch { /* cleanup is best effort */ }
    }
    this.emit(Date.now());
  }

  snapshot(): JobSnapshot {
    const s: JobSnapshot = {
      id: this.id, kind: this.kind, title: this.title, state: this.state,
      progress: { ...this.progress }, actions: [...this.actions],
    };
    if (this.error !== undefined) s.error = this.error;
    return s;
  }

  private finish(state: JobState): void {
    this.state = state;
    this.cleanups = [];
    this.emit(Date.now());
  }

  private emit(now: number): void {
    this.lastEmit = now;
    for (const cb of [...this.listeners]) cb();
  }
}
