// Compiles every effect pass on a real GPU: bundles tests/shaders/compile-entry.ts with Vite,
// then runs it inside a hidden Electron window. Exits non-zero if any pass fails.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "vite";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "svp-shader-check-"));

await build({
  configFile: false,
  root,
  logLevel: "error",
  build: {
    outDir, emptyOutDir: true, minify: false,
    lib: { entry: join(root, "tests/shaders/compile-entry.ts"), formats: ["iife"], name: "svpShaderCheck", fileName: () => "check.js" },
  },
});

const res = spawnSync(
  "pnpm", ["exec", "electron", "--no-sandbox", join(root, "scripts/check-shaders-main.cjs"), join(outDir, "check.js")],
  { cwd: root, stdio: "inherit" },
);
rmSync(outDir, { recursive: true, force: true });
process.exit(res.status ?? 1);
