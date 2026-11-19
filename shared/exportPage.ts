/** Contract between the main process and the hidden export page (frames and pixels only, never paths). */

export const EXPORT_CHANNELS = {
  init: "export-page:init",
  frame: "export-page:frame",
  end: "export-page:end",
  ready: "export-page:ready",
  pixels: "export-page:pixels",
  error: "export-page:error",
} as const;

export interface ExportInit {
  effectId?: string;
  presetId?: string | null;
  /** Untrusted parameter values: the page heals them against the effect. */
  raw?: unknown;
  sourceSize: { width: number; height: number };
  outputSize: { width: number; height: number };
  fps: number;
}

export interface ExportFrame {
  n: number;
  bytes: Uint8Array;
}

export interface ExportPageBridge {
  onInit(cb: (init: ExportInit) => void): void;
  onFrame(cb: (frame: ExportFrame) => void): void;
  onEnd(cb: () => void): void;
  sendPixels(n: number, bytes: Uint8Array): void;
  sendError(message: string): void;
  ready(): void;
}
