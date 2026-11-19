import { bufferInput, type BufferInput } from "./bufferInput";
import { createGlContext, type GlContext } from "./context";
import { createPipeline, type Pipeline } from "./effectPipeline";
import { effectUniforms, type RunnableEffect } from "./effectUniforms";
import type { Size } from "./passTypes";
import { clampDelta } from "./renderPolicy";

export interface OfflineOptions {
  effect: RunnableEffect;
  values: Record<string, number>;
  sourceSize: Size;
  outputSize: Size;
}

/**
 * Frame-by-frame renderer for export: no rAF, no wall clock. Every call renders exactly one frame
 * from supplied bytes, so the same input always gives the same output.
 */
export class OfflineRenderer {
  private readonly ctx: GlContext;
  private readonly input: BufferInput;
  private readonly pipeline: Pipeline;
  private readonly uniforms: Record<string, number>;
  private readonly pixels: Uint8Array;
  private readonly output: Size;

  constructor({ effect, values, sourceSize, outputSize }: OfflineOptions) {
    this.output = outputSize;
    const canvas = document.createElement("canvas"); // detached
    canvas.width = outputSize.width;
    canvas.height = outputSize.height;
    this.ctx = createGlContext(canvas);
    this.input = bufferInput(sourceSize.width, sourceSize.height);
    try {
      this.pipeline = createPipeline(this.ctx, effect, this.input, {
        onFrame: () => {},
        onError: (e) => { throw e; },
      });
      this.uniforms = effectUniforms(effect, values, outputSize, sourceSize);
      this.pipeline.graph.resize(outputSize, sourceSize, this.uniforms);
      this.pipeline.graph.resetFeedback();
    } catch (e) {
      this.ctx.dispose(true);
      throw e;
    }
    this.pixels = new Uint8Array(outputSize.width * outputSize.height * 4);
  }

  /**
   * Renders frame `n` (at `fps`) from `bytes` (RGBA, sourceSize). Returns RGBA at outputSize in a
   * buffer that the next call reuses. Rows are BOTTOM-UP (readPixels order): the encoder must vflip.
   */
  renderFrame(bytes: Uint8Array | Uint8ClampedArray, n: number, fps: number): Uint8Array {
    const { gl } = this.ctx;
    const { source, graph } = this.pipeline;
    this.input.currentTime = n / fps;
    this.input.push(bytes); // advances source.videoFrame by one; never uploadNow(true) here
    if (!source.uploadIfNew()) throw new Error("Could not upload the frame");
    graph.render(this.uniforms, { time: n / fps, delta: clampDelta(1 / fps), frame: n, videoFrame: source.videoFrame });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, this.output.width, this.output.height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
    return this.pixels;
  }

  dispose(): void {
    this.pipeline.source.dispose();
    this.pipeline.graph.dispose();
    this.ctx.dispose(true);
  }
}
