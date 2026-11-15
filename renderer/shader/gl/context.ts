export interface GlCaps {
  /** RGBA16F can be rendered to (and filtered); otherwise targets fall back to RGBA8. */
  floatTargets: boolean;
}

export interface GlContext {
  readonly gl: WebGL2RenderingContext;
  /** Re-probed after every context restore. */
  readonly caps: GlCaps;
  isLost(): boolean;
  /** Returns an unsubscribe function. */
  onLost(cb: () => void): () => void;
  onRestored(cb: () => void): () => void;
  dispose(): void;
}

function probeCaps(gl: WebGL2RenderingContext): GlCaps {
  const ext = gl.getExtension("EXT_color_buffer_float") ?? gl.getExtension("EXT_color_buffer_half_float");
  if (!ext) return { floatTargets: false };
  // Extension presence is not a guarantee; confirm a framebuffer is actually complete.
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 1, 1, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fbo);
  gl.deleteTexture(tex);
  return { floatTargets: ok };
}

export function createGlContext(canvas: HTMLCanvasElement): GlContext {
  const gl = canvas.getContext("webgl2", {
    antialias: false, depth: false, stencil: false, alpha: false,
    preserveDrawingBuffer: false, powerPreference: "high-performance",
  });
  if (!gl) throw new Error("WebGL2 is not available");

  let lost = false;
  let caps = probeCaps(gl);
  const lostCbs = new Set<() => void>();
  const restoredCbs = new Set<() => void>();

  const handleLost = (e: Event) => {
    e.preventDefault(); // required, otherwise the browser never restores the context
    lost = true;
    lostCbs.forEach((cb) => cb());
  };
  const handleRestored = () => {
    lost = false;
    caps = probeCaps(gl);
    restoredCbs.forEach((cb) => cb());
  };
  canvas.addEventListener("webglcontextlost", handleLost);
  canvas.addEventListener("webglcontextrestored", handleRestored);

  const subscribe = (set: Set<() => void>) => (cb: () => void) => {
    set.add(cb);
    return () => { set.delete(cb); };
  };
  return {
    gl,
    get caps() { return caps; },
    isLost: () => lost || gl.isContextLost(),
    onLost: subscribe(lostCbs),
    onRestored: subscribe(restoredCbs),
    dispose() {
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
      lostCbs.clear();
      restoredCbs.clear();
    },
  };
}
