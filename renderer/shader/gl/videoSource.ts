import type { FrameInput, FrameTick } from "./frameInput";

const VIDEO_FRAME_WRAP = 6_000_000;

/**
 * Owns the source texture for any FrameInput (the class keeps its name: passGraph binds it as the "video" input).
 * Orientation convention: see program.ts (uploaded unflipped, row 0 = top).
 */
export class VideoSource {
  readonly texture: WebGLTexture;
  /** Presented frames, wrapped at VIDEO_FRAME_WRAP (a multiple of 2 and 3, so parity and phase stay continuous). */
  videoFrame = 0;
  private width = 0;
  private height = 0;
  private frameReady = false;
  private mipsStale = true;
  private mipFilter = false;
  private unsubscribe: (() => void) | null = null;
  private failed = false;

  /** `onFrame` fires when the input presents a new frame (use it to schedule a render). */
  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly input: FrameInput,
    private readonly onFrame: () => void,
    /** Called once if frames cannot be uploaded to the GPU. */
    private readonly onFailure: (e: Error) => void,
  ) {
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    this.setFilter(false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  get size(): { width: number; height: number } {
    const intrinsic = this.input.size();
    return { width: this.width || intrinsic?.width || 1, height: this.height || intrinsic?.height || 1 };
  }

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.input.subscribe((tick: FrameTick) => {
      this.videoFrame = (this.videoFrame + 1) % VIDEO_FRAME_WRAP;
      // A counter-only tick keeps the last upload (and its mips): the pixels did not change.
      if (tick.image) this.frameReady = true;
      this.onFrame();
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Uploads if a new frame arrived since the last upload. Returns whether it did. */
  uploadIfNew(): boolean {
    return this.frameReady && this.uploadNow();
  }

  /**
   * Uploads the current frame regardless (paused seeks do not always produce a frame callback).
   * `newFrame` counts the upload as a presented frame (a seek, which may not fire the frame callback).
   */
  uploadNow(newFrame = false): boolean {
    const s = this.input.size();
    if (!this.input.ready() || !s) return false;
    const gl = this.gl;
    const image = this.input.image;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    try {
      if (s.width === this.width && s.height === this.height) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, image);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
        this.width = s.width;
        this.height = s.height;
      }
    } catch (e) {
      if (!this.failed) {
        this.failed = true;
        console.error("Frame upload failed (is the source origin-clean?)", e);
        this.onFailure(new Error("Could not upload video frames to the GPU"));
      }
      return false;
    }
    if (newFrame) this.videoFrame = (this.videoFrame + 1) % VIDEO_FRAME_WRAP;
    this.frameReady = false;
    this.mipsStale = true;
    return true;
  }

  /** Binds to a texture unit; with `mips` the mip chain is (re)built when the frame changed. */
  bind(unit: number, mips: boolean): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    this.setFilter(mips);
    if (mips && this.mipsStale && this.width > 0) { // nothing to build before the first frame
      gl.generateMipmap(gl.TEXTURE_2D);
      this.mipsStale = false;
    }
  }

  private setFilter(mips: boolean): void {
    if (mips === this.mipFilter && this.width > 0) return;
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    this.mipFilter = mips;
  }

  dispose(): void {
    this.stop();
    this.gl.deleteTexture(this.texture);
  }
}
