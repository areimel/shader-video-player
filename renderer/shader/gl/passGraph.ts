import type { GlCaps } from "./context";
import { resolveIncludes } from "./includes";
import {
  isEnabled, resolveInputs, resolveSize, validatePasses,
  type ResolvedInput, type ResolvedSource,
} from "./passPlan";
import type { PassSpec, Size } from "./passTypes";
import { ShaderProgram, type UniformValue } from "./program";
import { FullscreenTriangle } from "./quad";
import { PingPong, createTarget, disposeTarget, resizeTarget, type RenderTarget, type TargetOptions } from "./target";
import type { VideoSource } from "./videoSource";

export type { PassSpec, SizeEnv, Size, SourceRef } from "./passTypes";
export { GraphError } from "./passPlan";

export interface FrameInfo {
  /** Media time in seconds. */
  time: number;
  /** Seconds since the previous render, already clamped. */
  delta: number;
  /** Rendered frame counter. */
  frame: number;
}

interface PassRuntime {
  spec: PassSpec;
  program: ShaderProgram;
  options: TargetOptions;
  enabled: boolean;
  size: Size;
  /** Absent for the last pass (canvas) and for disabled passes. */
  output: RenderTarget | PingPong | null;
}

const vec4 = (s: Size): number[] => [s.width, s.height, 1 / s.width, 1 / s.height];

export class PassGraph {
  private readonly runtimes: PassRuntime[];
  private readonly quad: FullscreenTriangle;
  private inputs: ResolvedInput[][] = [];
  private inputsKey = "";
  private viewport: Size = { width: 1, height: 1 };
  private videoSize: Size = { width: 1, height: 1 };
  private disposed = false;

  /** Compiles every pass. Throws GraphError (structure) or Error (compile/link, naming the pass). */
  constructor(
    private readonly gl: WebGL2RenderingContext,
    caps: GlCaps,
    passes: readonly PassSpec[],
    chunks: Readonly<Record<string, string>>,
    private readonly video: VideoSource,
  ) {
    validatePasses(passes);
    this.quad = new FullscreenTriangle(gl);
    this.runtimes = [];
    try {
      for (const spec of passes) {
        const format = spec.format === "rgba8" || !caps.floatTargets ? "rgba8" : "rgba16f";
        this.runtimes.push({
          spec, enabled: true, size: this.viewport, output: null,
          options: { format, filter: spec.filter ?? "linear" },
          program: new ShaderProgram(gl, spec.id, resolveIncludes(spec.frag, chunks)),
        });
      }
    } catch (e) {
      this.dispose();
      throw e;
    }
  }

  /** Sets sizes and reallocates only the targets whose size changed (those are cleared). */
  resize(viewport: Size, video: Size, values: Record<string, number>): void {
    this.viewport = viewport;
    this.videoSize = video;
    this.layout(values);
  }

  /** Clears all feedback history (seek, source change). */
  resetFeedback(): void {
    for (const r of this.runtimes) if (r.output instanceof PingPong) r.output.clear();
  }

  /** `values` keys are full uniform names (`p_*`, `d_*`). Draws every enabled pass; the last goes to the canvas. */
  render(values: Readonly<Record<string, number>>, frame: FrameInfo): void {
    if (this.disposed) return;
    const gl = this.gl;
    this.layout(values);
    const lastIndex = this.runtimes.length - 1;

    this.runtimes.forEach((r, index) => {
      if (!r.enabled) return;
      const toCanvas = index === lastIndex;
      const write = this.writeTarget(r);
      gl.bindFramebuffer(gl.FRAMEBUFFER, write?.fbo ?? null);
      gl.viewport(0, 0, r.size.width, r.size.height);

      const uniforms: Record<string, UniformValue> = { ...values };
      this.bindInputs(r, index, uniforms);
      Object.assign(uniforms, {
        uFlipY: toCanvas ? 1 : 0,
        uOutputSize: vec4(r.size), uViewportSize: vec4(this.viewport), uVideoSize: vec4(this.videoSize),
        uTime: frame.time, uFrame: frame.frame, uDeltaTime: frame.delta,
      });
      r.program.setUniforms(uniforms);
      this.quad.draw();
      if (r.output instanceof PingPong) r.output.swap();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const r of this.runtimes) {
      r.program.dispose();
      this.freeOutput(r);
    }
    this.quad.dispose();
  }

  /** Re-evaluates enabled flags and sizes, allocating, resizing or freeing targets as needed. */
  private layout(values: Record<string, number>): void {
    const env = { viewport: this.viewport, video: this.videoSize, values };
    const lastIndex = this.runtimes.length - 1;
    this.runtimes.forEach((r, index) => {
      r.enabled = isEnabled(r.spec, values);
      r.size = index === lastIndex ? this.viewport : resolveSize(r.spec, env);
      if (!r.enabled || index === lastIndex) return this.freeOutput(r);
      const { width, height } = r.size;
      if (!r.output) {
        r.output = r.spec.feedback
          ? new PingPong(this.gl, width, height, r.options)
          : createTarget(this.gl, width, height, r.options);
      } else if (r.output instanceof PingPong) r.output.resize(width, height);
      else resizeTarget(this.gl, r.output, width, height);
    });

    const key = this.runtimes.map((r) => (r.enabled ? "1" : "0")).join("");
    if (key !== this.inputsKey) {
      this.inputs = resolveInputs(this.runtimes.map((r) => r.spec), this.runtimes.map((r) => r.enabled));
      this.inputsKey = key;
    }
  }

  private freeOutput(r: PassRuntime): void {
    if (r.output instanceof PingPong) r.output.dispose();
    else if (r.output) disposeTarget(this.gl, r.output);
    r.output = null;
  }

  private writeTarget(r: PassRuntime): RenderTarget | null {
    return r.output instanceof PingPong ? r.output.older : r.output;
  }

  private bindInputs(r: PassRuntime, index: number, uniforms: Record<string, UniformValue>): void {
    const gl = this.gl;
    this.inputs[index].forEach(({ sampler, source }, unit) => {
      if (source.kind === "video") {
        this.video.bind(unit, r.spec.mipmapInputs === true);
        uniforms[`${sampler}Size`] = vec4(this.videoSize);
      } else {
        const t = this.sourceTarget(source, index);
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, t.texture);
        uniforms[`${sampler}Size`] = vec4({ width: t.width, height: t.height });
      }
      uniforms[sampler] = unit;
    });
  }

  private sourceTarget(source: Extract<ResolvedSource, { kind: "pass" }>, readerIndex: number): RenderTarget {
    const at = this.runtimes.findIndex((p) => p.spec.id === source.id);
    const out = this.runtimes[at].output;
    if (!out) throw new Error(`Pass "${source.id}" has no target to read`);
    if (!(out instanceof PingPong)) return out;
    // A pass that already ran this frame has swapped: its newest output is `latest`, last frame's is `older`.
    // A pass that has not run yet (or is the reader itself) still holds last frame's output in `latest`.
    const ranThisFrame = at < readerIndex;
    return source.prev === ranThisFrame ? out.older : out.latest;
  }
}
