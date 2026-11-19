import { EFFECTS } from "../../renderer/shader/effects/registry";
import { commonChunks } from "../../renderer/shader/gl/commonChunks";
import { resolveIncludes } from "../../renderer/shader/gl/includes";
import { OfflineRenderer } from "../../renderer/shader/gl/offlineRenderer";
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
  smokeOffline(result);
  return result;
}

/** Renders 3 solid-colour frames per effect through the offline renderer and checks the readback. */
function smokeOffline(result: CompileResult): void {
  const src = { width: 64, height: 48 };
  const out = { width: 160, height: 120 };
  const bytes = new Uint8Array(src.width * src.height * 4);
  for (let i = 0; i < bytes.length; i += 4) bytes.set([200, 120, 60, 255], i);
  for (const effect of EFFECTS) {
    const name = `${effect.id}/offline`;
    let renderer: OfflineRenderer | null = null;
    try {
      const values = Object.fromEntries(effect.params.map((p) => [p.id, p.default]));
      renderer = new OfflineRenderer({ effect, values, sourceSize: src, outputSize: out });
      let pixels: Uint8Array = new Uint8Array(0);
      for (let n = 0; n < 3; n++) pixels = renderer.renderFrame(bytes, n, 30);
      if (pixels.length !== out.width * out.height * 4) throw new Error(`readback is ${pixels.length} bytes`);
      if (!pixels.some((v) => v !== 0)) throw new Error("output is all zeros");
      result.compiled.push(name);
    } catch (e) {
      result.errors.push({ pass: name, message: e instanceof Error ? e.message : String(e) });
    } finally {
      renderer?.dispose();
    }
  }
}
