import { formatShaderError } from "./shaderError";

/**
 * Image orientation convention, shared by every pass and the final blit:
 *  - vUv (0,0) is the TOP-LEFT of the image, vUv.y grows downwards.
 *  - The video is uploaded unflipped, so texture row 0 is the image top and texture(uVideo, vUv) is upright.
 *  - Offscreen targets store the image the same way: row 0 (framebuffer y = 0) is the image top.
 *    The vertex shader therefore leaves vUv.y = clip-space y * 0.5 + 0.5 for them.
 *  - The default framebuffer has row 0 at the screen bottom, so the last pass sets uFlipY = 1 and
 *    the vertex shader inverts vUv.y. gl_FragCoord stays bottom-left origin in every pass.
 */
export const FULLSCREEN_VERTEX = `#version 300 es
precision highp float;
uniform float uFlipY;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = vec2(p.x, uFlipY > 0.5 ? 1.0 - p.y : p.y);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export type UniformValue = number | readonly number[];

interface UniformInfo { location: WebGLUniformLocation; type: number }

function compile(gl: WebGL2RenderingContext, passId: string, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(`Pass "${passId}": could not create shader`);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const stage = type === gl.VERTEX_SHADER ? "vertex shader compile" : "fragment shader compile";
    const message = formatShaderError(passId, stage, gl.getShaderInfoLog(shader) ?? "", source);
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export class ShaderProgram {
  readonly program: WebGLProgram;
  private readonly uniforms = new Map<string, UniformInfo>();

  /** `fragSource` must already have its includes resolved. */
  constructor(private readonly gl: WebGL2RenderingContext, readonly passId: string, fragSource: string) {
    const vs = compile(gl, passId, gl.VERTEX_SHADER, FULLSCREEN_VERTEX);
    let fs: WebGLShader;
    try { fs = compile(gl, passId, gl.FRAGMENT_SHADER, fragSource); } catch (e) { gl.deleteShader(vs); throw e; }
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? "";
      gl.deleteProgram(program);
      throw new Error(formatShaderError(passId, "program link", log, fragSource));
    }
    this.program = program;

    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      if (!info || info.size !== 1) continue; // arrays are not part of the engine contract
      const location = gl.getUniformLocation(program, info.name);
      if (location) this.uniforms.set(info.name, { location, type: info.type });
    }
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  /** Sets the declared uniforms found in `values`; names the shader does not declare are ignored. */
  setUniforms(values: Readonly<Record<string, UniformValue>>): void {
    this.use();
    for (const name in values) {
      const info = this.uniforms.get(name);
      if (info) this.upload(name, info, values[name]);
    }
  }

  private upload(name: string, { location, type }: UniformInfo, v: UniformValue): void {
    const gl = this.gl;
    const arr = typeof v === "number" ? [v] : v;
    const need = (n: number) => {
      if (arr.length !== n) throw new Error(`Pass "${this.passId}": uniform ${name} expects ${n} values, got ${arr.length}`);
    };
    switch (type) {
      case gl.FLOAT: need(1); gl.uniform1f(location, arr[0]); break;
      case gl.FLOAT_VEC2: need(2); gl.uniform2f(location, arr[0], arr[1]); break;
      case gl.FLOAT_VEC3: need(3); gl.uniform3f(location, arr[0], arr[1], arr[2]); break;
      case gl.FLOAT_VEC4: need(4); gl.uniform4f(location, arr[0], arr[1], arr[2], arr[3]); break;
      case gl.INT: case gl.BOOL: case gl.SAMPLER_2D: need(1); gl.uniform1i(location, arr[0]); break;
      case gl.INT_VEC2: need(2); gl.uniform2i(location, arr[0], arr[1]); break;
      case gl.INT_VEC3: need(3); gl.uniform3i(location, arr[0], arr[1], arr[2]); break;
      case gl.INT_VEC4: need(4); gl.uniform4i(location, arr[0], arr[1], arr[2], arr[3]); break;
      default: throw new Error(`Pass "${this.passId}": uniform ${name} has unsupported type 0x${type.toString(16)}`);
    }
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}
