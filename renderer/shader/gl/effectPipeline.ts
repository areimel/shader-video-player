import { commonChunks } from "./commonChunks";
import type { GlContext } from "./context";
import type { RunnableEffect } from "./effectUniforms";
import type { FrameInput } from "./frameInput";
import { PassGraph } from "./passGraph";
import { checkFloatRequirement } from "./passPlan";
import { VideoSource } from "./videoSource";

export interface PipelineCallbacks {
  /** The input presented a frame (the live renderer schedules a render). */
  onFrame(): void;
  /** Frame upload failed after start. */
  onError(e: Error): void;
}

export interface Pipeline { source: VideoSource; graph: PassGraph }

/**
 * Shared setup of the live and offline renderers: float-target check, source texture, pass graph, start.
 * Throws (GraphError, compile errors, float refusal) with nothing left allocated.
 */
export function createPipeline(ctx: GlContext, effect: RunnableEffect, input: FrameInput, callbacks: PipelineCallbacks): Pipeline {
  const { gl, caps } = ctx;
  checkFloatRequirement(effect.requiresFloat, caps.floatTargets);
  const source = new VideoSource(gl, input, callbacks.onFrame, callbacks.onError);
  let graph: PassGraph;
  try {
    graph = new PassGraph(gl, caps, effect.passes, { ...commonChunks, ...effect.chunks }, source);
  } catch (e) {
    source.dispose();
    throw e;
  }
  source.start();
  return { source, graph };
}
