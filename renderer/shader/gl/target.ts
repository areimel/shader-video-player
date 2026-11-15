export type TargetFormat = "rgba16f" | "rgba8";
export type TargetFilter = "linear" | "nearest";

export interface TargetOptions { format: TargetFormat; filter: TargetFilter }

/** Offscreen colour target. Orientation convention: see program.ts. */
export interface RenderTarget {
  readonly texture: WebGLTexture;
  readonly fbo: WebGLFramebuffer;
  readonly format: TargetFormat;
  width: number;
  height: number;
}

function allocate(gl: WebGL2RenderingContext, t: RenderTarget): void {
  gl.bindTexture(gl.TEXTURE_2D, t.texture);
  if (t.format === "rgba16f") gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, t.width, t.height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, t.width, t.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  clearTarget(gl, t);
}

export function createTarget(gl: WebGL2RenderingContext, width: number, height: number, opts: TargetOptions): RenderTarget {
  const texture = gl.createTexture();
  const fbo = gl.createFramebuffer();
  const filter = opts.filter === "linear" ? gl.LINEAR : gl.NEAREST;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const target: RenderTarget = { texture, fbo, format: opts.format, width, height };
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  allocate(gl, target);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    disposeTarget(gl, target);
    throw new Error(`Render target ${width}x${height} ${opts.format} is incomplete (0x${status.toString(16)})`);
  }
  return target;
}

/** Reallocates (and clears) only when the size changed. Returns whether it did. */
export function resizeTarget(gl: WebGL2RenderingContext, t: RenderTarget, width: number, height: number): boolean {
  if (t.width === width && t.height === height) return false;
  t.width = width;
  t.height = height;
  allocate(gl, t);
  return true;
}

export function clearTarget(gl: WebGL2RenderingContext, t: RenderTarget): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

export function disposeTarget(gl: WebGL2RenderingContext, t: RenderTarget): void {
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.texture);
}

/**
 * Two targets for feedback passes. A frame renders into `older` and then calls swap(),
 * after which `latest` is the frame just drawn and `older` is the one before it.
 */
export class PingPong {
  private readonly pair: [RenderTarget, RenderTarget];
  private i = 0;

  constructor(private readonly gl: WebGL2RenderingContext, width: number, height: number, opts: TargetOptions) {
    const first = createTarget(gl, width, height, opts);
    try {
      this.pair = [first, createTarget(gl, width, height, opts)];
    } catch (e) {
      disposeTarget(gl, first);
      throw e;
    }
  }

  get latest(): RenderTarget { return this.pair[this.i]; }
  get older(): RenderTarget { return this.pair[1 - this.i]; }
  get width(): number { return this.pair[0].width; }
  get height(): number { return this.pair[0].height; }

  swap(): void { this.i = 1 - this.i; }

  resize(width: number, height: number): boolean {
    const a = resizeTarget(this.gl, this.pair[0], width, height);
    const b = resizeTarget(this.gl, this.pair[1], width, height);
    return a || b;
  }

  clear(): void {
    this.pair.forEach((t) => clearTarget(this.gl, t));
  }

  dispose(): void {
    this.pair.forEach((t) => disposeTarget(this.gl, t));
  }
}
