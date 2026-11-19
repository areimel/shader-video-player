import { createGlContext, type GlContext } from "./context";
import { createPipeline } from "./effectPipeline";
import { effectUniforms, type RunnableEffect } from "./effectUniforms";
import type { FrameInput } from "./frameInput";
import { PassGraph } from "./passGraph";
import type { Size } from "./passTypes";
import { clampDelta, hasActiveAnimation, mediaPosition, shouldRender } from "./renderPolicy";
import { VideoSource } from "./videoSource";

export type { RunnableEffect };

/**
 * Drives one effect on one canvas/input pair: dirty tracking, rAF scheduling, feedback resets and
 * rebuilding after a context loss. Rendering only happens when something changed, or while an
 * animated parameter is non-zero and the input is playing.
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
    private readonly input: FrameInput,
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
    this.cleanups.push(input.listen({
      onJump: () => { this.graph?.resetFeedback(); this.source?.uploadNow(true); this.invalidate(); },
      // Re-upload first so derived values see the new size.
      onResized: () => { this.source?.uploadNow(); this.refreshUniforms(); this.invalidate(); },
      onPlayState: () => this.invalidate(), // on pause: one final render, then the loop idles
    }));
    this.init();
  }

  /** Builds (or rebuilds after context restore) every GL resource. */
  private init(): void {
    this.teardown();
    if (this.disposed || this.ctx.isLost()) return;
    try {
      const { source, graph } = createPipeline(this.ctx, this.effect, this.input, {
        onFrame: () => this.invalidate(),
        onError: (e) => this.fail(e),
      });
      this.source = source;
      this.graph = graph;
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

  /**
   * Renders the current frame and encodes it as PNG. The drawing buffer is not preserved, so the
   * snapshot is taken synchronously right after the draw (toBlob captures at call time).
   */
  capture(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.graph || this.ctx.isLost()) return reject(new Error("The effect is not ready"));
      this.renderNow();
      if (!this.graph) return reject(new Error("The effect failed to render"));
      this.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the frame"))), "image/png");
    });
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
    this.uniformValues = effectUniforms(this.effect, this.userValues, env.viewport, env.video);
    try {
      this.graph?.resize(this.viewport, env.video, this.uniformValues); // allocates targets, which can throw
    } catch (e) {
      this.fail(e);
    }
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
    return shouldRender({ dirty: this.dirty, playing: this.input.playing(), animating: hasActiveAnimation(this.effect.params, this.userValues) });
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
        time: mediaPosition(this.startOffset, this.input.time()),
        delta,
        frame: this.frame++,
        videoFrame: source.videoFrame,
      });
    } catch (e) {
      this.fail(e);
    }
  }
}
