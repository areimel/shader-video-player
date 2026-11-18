/** Background job contract shared by the main process and the renderer. */

export type JobKind = "download" | "convert" | "export";
export type JobState = "running" | "done" | "failed" | "cancelled";

export interface JobProgress {
  /** 0..1, or null when unknown (indeterminate). */
  fraction: number | null;
  etaSec: number | null;
  label: string;
}

export type JobAction = "open" | "reveal";

/** What the renderer sees. The output path never leaves the main process. */
export interface JobSnapshot {
  id: string;
  kind: JobKind;
  title: string;
  state: JobState;
  progress: JobProgress;
  error?: string;
  actions: JobAction[];
}

export interface ExportRequest {
  effectId: string;
  presetId: string | null;
  values: Record<string, number>;
  size: "source" | "1080p" | "window";
  windowSize?: { width: number; height: number };
}

export const JOB_CHANNELS = {
  changed: "job:changed",
  cancel: "job:cancel",
  open: "job:open",
  reveal: "job:reveal",
} as const;
