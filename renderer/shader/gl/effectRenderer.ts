import { commonChunks } from "./commonChunks";
import { createGlContext, type GlContext } from "./context";
import { PassGraph } from "./passGraph";
import { checkFloatRequirement } from "./passPlan";
import type { PassSpec, Size } from "./passTypes";
import { clampDelta, hasActiveAnimation, mediaPosition, shouldRender, type AnimatedParam } from "./renderPolicy";
import { VideoSource } from "./videoSource";

/** The part of EffectDefinition the renderer needs (structural, so gl/ does not depend on effects/). */
export interface RunnableEffect {
  params: readonly AnimatedParam[];
  passes: readonly PassSpec[];
  chunks: Readonly<Record<string, string>>;
  requiresFloat?: boolean;
  derive(values: Record<string, number>, env: { viewport: Size; video: Size }): Record<string, number>;
}

const prefixed = (prefix: string, values: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k.startsWith(prefix) ? k : prefix + k, v]));

/**
 * Drives one effect on one canvas/video pair: dirty tracking, rAF scheduling, feedback resets and
 * rebuilding after a context loss. Rendering only happens when something changed, or while an
 * animated parameter is non-zero and the video is playing.
 */
export class EffectRenderer {
  private readonly ctx: GlContext;
  private graph: PassGraph | null = null;
  private source: VideoSource | null = null;
  private userValues: Record<string, number> = {};
  private uniformValues: Record<string, number> = {};
  private viewport: Size = { width: 1, height: 1 };
  private dirty = true;
  private raf = 0;
  private frame = 0;
  private lastRender = 0;
  private disposed = false;
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly video: HTMLVideoElement,
    private readonly effect: RunnableEffect,
    private readonly onError: (e: Error) => void,
    /** Plan start offset (seconds): a restarted stream gets a new source, hence a new renderer, so it is fixed per instance. */
    private readonly startOffset = 0,
  ) {
    this.ctx = createGlContext(canvas);
    this.cleanups.push(
      this.ctx.onLost(() => { this.teardown(); }),
      this.ctx.onRestored(() => { this.init(); }),
    );
    const listen = (type: string, fn: () => void) => {
      video.addEventListener(type, fn);
      this.cleanups.push(() => video.removeEventListener(type, fn));
    };
    listen("seeked", () => { this.graph?.resetFeedback(); this.source?.uploadNow(true); this.invalidate(); });
    listen("play", () => this.invalidate());
    listen("pause", () => this.invalidate()); // one final render, then the loop idles
    // The decoded size can change mid-stream (adaptive or concatenated sources): re-upload, then refresh derived values.
    listen("resize", () => { this.source?.uploadNow(); this.refreshUniforms(); this.invalidate(); });
    listen("loadeddata", () => { this.source?.uploadNow(); this.refreshUniforms(); this.invalidate(); });
    this.init();
  }

  /** Builds (or rebuilds after context restore) every GL resource. */
  private init(): void {
    this.teardown();
    if (this.disposed || this.ctx.isLost()) return;
    try {
      const { gl, caps } = this.ctx;
      checkFloatRequirement(this.effect.requiresFloat, caps.floatTargets);
      this.source = new VideoSource(gl, this.video, () => this.invalidate(), (e) => this.fail(e));
      this.graph = new PassGraph(gl, caps, this.effect.passes, { ...commonChunks, ...this.effect.chunks }, this.source);
      this.source.start();
      this.source.uploadNow();
      this.refreshUniforms();
      this.invalidate();
    } catch (e) {
      this.fail(e);
    }
  }

  /** Releases GL resources and reports the failure (the caller turns the effect off). */
  private fail(e: unknown): void {
    this.teardown();
    this.onError(e instanceof Error ? e : new Error(String(e)));
  }

  private teardown(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.source?.dispose();
    this.graph?.dispose();
    this.source = null;
    this.graph = null;
  }

  setValues(values: Record<string, number>): void {
    this.userValues = values;
    this.refreshUniforms();
    this.invalidate();
  }

  /** Canvas backing-store size in device pixels. Clears the canvas, so it renders immediately. */
  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (w === this.viewport.width && h === this.viewport.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.viewport = { width: w, height: h };
    this.refreshUniforms();
    this.graph?.resetFeedback();
    this.renderNow();
  }

  invalidate(): void {
    this.dirty = true;
    this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    this.cleanups.forEach((fn) => fn());
    this.teardown();
    // Unmounted canvas (effect turned off): free the GPU context instead of waiting for GC.
    // A canvas that stays mounted keeps its context for the next effect.
    this.ctx.dispose(!this.canvas.isConnected);
  }

  private refreshUniforms(): void {
    const env = { viewport: this.viewport, video: this.source?.size ?? this.viewport };
    this.uniformValues = {
      ...prefixed("p_", this.userValues),
      ...prefixed("d_", this.effect.derive(this.userValues, env)),
    };
    try {
      this.graph?.resize(this.viewport, env.video, this.uniformValues); // allocates targets, which can throw
    } catch (e) {
      this.fail(e);
    }
  }

  private get playing(): boolean {
    return !this.video.paused && !this.video.ended;
  }

  private schedule(): void {
    if (this.raf || this.disposed || !this.graph) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.renderIfNeeded();
      if (this.needsLoop()) this.schedule();
    });
  }

  private needsLoop(): boolean {
    return shouldRender({ dirty: this.dirty, playing: this.playing, animating: hasActiveAnimation(this.effect.params, this.userValues) });
  }

  private renderIfNeeded(): void {
    if (this.needsLoop()) this.renderNow();
  }

  private renderNow(): void {
    const graph = this.graph;
    const source = this.source;
    if (!graph || !source || this.ctx.isLost()) return;
    source.uploadIfNew();
    if (this.source !== source) return; // the upload failed and tore everything down
    const now = performance.now();
    const delta = this.lastRender ? clampDelta((now - this.lastRender) / 1000) : 0;
    this.lastRender = now;
    this.dirty = false;
    try {
      graph.render(this.uniformValues, {
        time: mediaPosition(this.startOffset, this.playing ? source.mediaTime : this.video.currentTime),
        delta,
        frame: this.frame++,
        videoFrame: source.videoFrame,
      });
    } catch (e) {
      this.fail(e);
    }
  }
}
