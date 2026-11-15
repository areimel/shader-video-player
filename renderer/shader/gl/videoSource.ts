const VIDEO_FRAME_WRAP = 6_000_000;

/** Owns the video texture. Orientation convention: see program.ts (uploaded unflipped, row 0 = top). */
export class VideoSource {
  readonly texture: WebGLTexture;
  mediaTime = 0;
  /** Presented video frames, wrapped at VIDEO_FRAME_WRAP (a multiple of 2 and 3, so parity and phase stay continuous). */
  videoFrame = 0;
  private width = 0;
  private height = 0;
  private frameReady = false;
  private mipsStale = true;
  private mipFilter = false;
  private callbackId = 0;
  private running = false;
  private failed = false;

  /** `onFrame` fires when the decoder presents a new frame (use it to schedule a render). */
  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly video: HTMLVideoElement,
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
    return { width: this.width || this.video.videoWidth || 1, height: this.height || this.video.videoHeight || 1 };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = (_now: number, meta: VideoFrameCallbackMetadata) => {
      this.mediaTime = meta.mediaTime;
      this.videoFrame = (this.videoFrame + 1) % VIDEO_FRAME_WRAP;
      this.frameReady = true;
      this.onFrame();
      if (this.running) this.callbackId = this.video.requestVideoFrameCallback(tick);
    };
    this.callbackId = this.video.requestVideoFrameCallback(tick);
  }

  stop(): void {
    this.running = false;
    this.video.cancelVideoFrameCallback(this.callbackId);
  }

  /** Uploads if a new frame arrived since the last upload. Returns whether it did. */
  uploadIfNew(): boolean {
    return this.frameReady && this.uploadNow();
  }

  /**
   * Uploads the current frame regardless (paused seeks do not always produce a frame callback).
   * `newFrame` counts the upload as a presented video frame (a seek, which may not fire the frame callback).
   */
  uploadNow(newFrame = false): boolean {
    const v = this.video;
    if (v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || v.videoWidth === 0) return false;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    try {
      if (v.videoWidth === this.width && v.videoHeight === this.height) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, v);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, v);
        this.width = v.videoWidth;
        this.height = v.videoHeight;
      }
    } catch (e) {
      if (!this.failed) {
        this.failed = true;
        console.error("Video upload failed (is the video CORS-clean?)", e);
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
