/** Pass pipeline contract types. Re-exported from passGraph.ts, which is the import path other modules use. */

/** "video", a pass id, or "<passId>:prev" for last frame's output of a feedback pass. */
export type SourceRef = "video" | string;

export interface Size { width: number; height: number }

/** `values` holds user params and derived values, already named as uniforms (`p_*`, `d_*`). */
export interface SizeEnv { viewport: Size; video: Size; values: Record<string, number> }

export interface PassSpec {
  id: string;
  /** Raw source; `#include`s are resolved by the graph. */
  frag: string;
  /** Sampler uniform name -> source. */
  inputs: Record<string, SourceRef>;
  /** The last pass renders to the canvas, so its size is the viewport. */
  size: "viewport" | ((env: SizeEnv) => Size);
  format?: "rgba16f" | "rgba8";
  filter?: "linear" | "nearest";
  /** Generate mipmaps on the video texture before this pass reads it. */
  mipmapInputs?: boolean;
  /** Keep the previous frame's output readable as "<id>:prev". */
  feedback?: boolean;
  /** A disabled pass is skipped and readers get its first input instead. */
  enabled?: (values: Record<string, number>) => boolean;
}
