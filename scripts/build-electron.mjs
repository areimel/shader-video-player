import { build, context } from "esbuild";

const options = {
  entryPoints: { main: "electron/main.ts", preload: "electron/preload.ts", exportPreload: "electron/exportPreload.ts" },
  outdir: "dist-electron",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  sourcemap: true,
};

if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
