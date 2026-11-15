import { EFFECTS } from "../../renderer/shader/effects/registry";
import { commonChunks } from "../../renderer/shader/gl/commonChunks";
import { resolveIncludes } from "../../renderer/shader/gl/includes";
import { ShaderProgram } from "../../renderer/shader/gl/program";

export interface CompileResult {
  compiled: string[];
  errors: Array<{ pass: string; message: string }>;
}

/** Compiles and links every pass of every registered effect on a real WebGL2 context. */
export function run(): CompileResult {
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) return { compiled: [], errors: [{ pass: "(context)", message: "WebGL2 is not available" }] };
  const result: CompileResult = { compiled: [], errors: [] };
  for (const effect of EFFECTS) {
    const chunks = { ...commonChunks, ...effect.chunks };
    for (const pass of effect.passes) {
      const name = `${effect.id}/${pass.id}`;
      try {
        new ShaderProgram(gl, pass.id, resolveIncludes(pass.frag, chunks)).dispose();
        result.compiled.push(name);
      } catch (e) {
        result.errors.push({ pass: name, message: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return result;
}
